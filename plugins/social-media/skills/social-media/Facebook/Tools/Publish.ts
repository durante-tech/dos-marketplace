#!/usr/bin/env bun

/**
 * Publish — Create a post on a Facebook Page via Graph API v24.0.
 *
 * Reads FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN from ~/.claude/.env
 * (set by Login.ts).
 *
 * Routes based on attachment type:
 *   --image  <ref>         → POST /{page-id}/photos (native photo post)
 *   --images <csv of refs> → Multi-photo post: upload each as unpublished,
 *                            then POST /{page-id}/feed with attached_media.
 *   --link   <url>         → POST /{page-id}/feed with link preview
 *   (none)                 → POST /{page-id}/feed with message only
 *
 * An image ref is a public http(s) URL OR a local file path.
 * --image, --images, and --link are mutually exclusive.
 * Supports --draft for unpublished posts.
 *
 * Usage:
 *   bun Publish.ts --message "hello world"
 *   bun Publish.ts --message "new essay" --link https://example.com/essay
 *   bun Publish.ts --message "caption" --image https://example.com/photo.jpg
 *   bun Publish.ts --message "caption" --image ~/Downloads/photo.png
 *   bun Publish.ts --message "swipe" --images a.png,b.png,c.png
 *   bun Publish.ts --message "scheduled content" --draft
 *
 * @see https://developers.facebook.com/docs/pages/publishing/
 * @see https://developers.facebook.com/docs/graph-api/reference/page/photos/
 */

import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError, enforcePublish, isDraftOnly } from "../../Lib/cli.ts";
import { graph, GRAPH_BASE, GRAPH_VERSION, GraphAPIError, type GraphError } from "../../Lib/graph.ts";

interface CLIArgs {
  message: string;
  link?: string;
  image?: string;
  images?: string[];
  published: boolean;
  yes: boolean;
  scheduledPublishTime?: number;
}

const MIN_SCHEDULE_OFFSET_SEC = 10 * 60;
const MAX_SCHEDULE_OFFSET_SEC = 6 * 30 * 24 * 60 * 60;
const MAX_MULTI_PHOTO = 10;
const MIN_MULTI_PHOTO = 2;

function showHelp(): void {
  console.log(`
Publish - Facebook Page Post CLI (Graph API ${GRAPH_VERSION})

Posts a message to the authenticated Facebook Page's feed.
Run Login.ts first to authenticate.

USAGE:
  bun Publish.ts --message "<text>" [OPTIONS]

REQUIRED:
  --message <text>    Post message body (quote if it contains spaces)

OPTIONS:
  --link <url>        Attach a link preview to a feed post (mutually exclusive with --image/--images)
  --image <url|path>  Publish a native photo post. Accepts a public http(s) URL
                      OR a local file path (uploaded via multipart).
                      Posts to /{page-id}/photos.
  --images <csv>      Publish a multi-photo feed post (2–10 photos). Comma-separated
                      list of public URLs or local file paths. Each is uploaded
                      unpublished, then attached to a single feed post.
                      Mutually exclusive with --image and --link.
  --yes               Confirm a LIVE publish to the public Page. REQUIRED to go live —
                      without --yes (and without --draft) the tool prints a dry-run
                      preview and exits without posting.
  --draft             Create an unpublished draft instead of going live
  --schedule <ts>     Schedule the post. <ts> is a unix timestamp in seconds.
                      Must be between 10 minutes and 6 months in the future.
                      Mutually exclusive with --draft. Still requires --yes.
  --help, -h          Show this help message

SAFETY:
  Publishing to a public account is irreversible, so a bare invocation DRY-RUNS
  (prints the composed post + target, exits non-zero) — pass --yes to go live or
  --draft to stage. Set SOCIAL_DRAFT_ONLY=1 in the environment to force draft-only
  mode (a consumer-set, unspoofable boundary).

ENVIRONMENT (from ~/.claude/.env, set by Login.ts):
  FACEBOOK_PAGE_ID
  FACEBOOK_PAGE_TOKEN

EXAMPLES:
  bun Publish.ts --message "Shipped the new social-media pack"
  bun Publish.ts --message "New essay" --link "https://example.com/essay"
  bun Publish.ts --message "look at this" --image "https://example.com/photo.jpg"
  bun Publish.ts --message "look at this" --image ~/Downloads/photo.png
  bun Publish.ts --message "swipe →" --images ~/Downloads/a.png,~/Downloads/b.png,~/Downloads/c.png
  bun Publish.ts --message "Saved for later" --draft
  bun Publish.ts --message "Tomorrow at 9am PT" --schedule $(date -v+1d -v9H -v0M -v0S +%s)
`);
  process.exit(0);
}

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
  }

  const parsed: Partial<CLIArgs> = { published: true, yes: false };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}`);
    }
    const key = flag.slice(2);

    // Boolean flag
    if (key === "draft") {
      parsed.published = false;
      continue;
    }
    if (key === "yes") {
      parsed.yes = true;
      continue;
    }

    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }
    switch (key) {
      case "message":
        parsed.message = value;
        i++;
        break;
      case "link":
        parsed.link = value;
        i++;
        break;
      case "image":
        parsed.image = value;
        i++;
        break;
      case "images":
        parsed.images = value.split(",").map((s) => s.trim()).filter(Boolean);
        i++;
        break;
      case "schedule": {
        const ts = parseInt(value, 10);
        if (Number.isNaN(ts) || ts <= 0) {
          throw new CLIError(`Invalid --schedule: ${value} (expected unix timestamp in seconds)`);
        }
        parsed.scheduledPublishTime = ts;
        i++;
        break;
      }
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.message) throw new CLIError("Missing required argument: --message");
  const attachmentFlags = [parsed.link, parsed.image, parsed.images].filter(Boolean).length;
  if (attachmentFlags > 1) {
    throw new CLIError("--link, --image, and --images are mutually exclusive");
  }
  if (parsed.image) {
    parsed.image = resolveImageRef(parsed.image, "--image");
  }
  if (parsed.images) {
    if (parsed.images.length < MIN_MULTI_PHOTO || parsed.images.length > MAX_MULTI_PHOTO) {
      throw new CLIError(
        `--images requires ${MIN_MULTI_PHOTO}–${MAX_MULTI_PHOTO} entries, got ${parsed.images.length}`,
      );
    }
    parsed.images = parsed.images.map((ref) => resolveImageRef(ref, "--images"));
  }
  if (parsed.scheduledPublishTime !== undefined) {
    if (parsed.published === false) {
      throw new CLIError("--schedule and --draft are mutually exclusive");
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const offset = parsed.scheduledPublishTime - nowSec;
    if (offset < MIN_SCHEDULE_OFFSET_SEC) {
      throw new CLIError(
        `--schedule must be at least 10 minutes in the future (got ${offset}s from now)`,
      );
    }
    if (offset > MAX_SCHEDULE_OFFSET_SEC) {
      throw new CLIError(
        `--schedule must be at most 6 months in the future (got ${Math.floor(offset / 86400)}d from now)`,
      );
    }
  }
  return parsed as CLIArgs;
}

function resolveImageRef(ref: string, flagName: string): string {
  if (/^https?:\/\//i.test(ref)) return ref;
  const localPath = resolve(ref.replace(/^~/, process.env.HOME ?? ""));
  if (!existsSync(localPath)) {
    throw new CLIError(
      `${flagName} must be a public http(s) URL or an existing local file, got: ${ref}`,
    );
  }
  return localPath;
}

async function uploadSinglePhoto(
  pageId: string,
  token: string,
  ref: string,
  params: Record<string, string>,
): Promise<{ id: string; post_id?: string }> {
  if (/^https?:\/\//i.test(ref)) {
    return graph<{ id: string; post_id?: string }>(`/${pageId}/photos`, {
      method: "POST",
      token,
      params: { ...params, url: ref },
    });
  }
  return uploadPhotoMultipart(pageId, token, ref, params);
}

async function uploadPhotoMultipart(
  pageId: string,
  token: string,
  filePath: string,
  extraParams: Record<string, string>,
): Promise<{ id: string; post_id?: string }> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new CLIError(`Image file not found: ${filePath}`);
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(extraParams)) form.set(k, v);
  form.set("access_token", token);
  form.set("source", new Blob([await file.arrayBuffer()], { type: file.type || "image/png" }), basename(filePath));

  const url = `${GRAPH_BASE}/${pageId}/photos`;
  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CLIError(
      `Graph API ${GRAPH_VERSION} /${pageId}/photos returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const maybeError = (json as { error?: GraphError }).error;
  if (!res.ok || maybeError) {
    throw new GraphAPIError(maybeError ?? { message: `HTTP ${res.status}` }, res.status, `/${pageId}/photos`);
  }
  return json as { id: string; post_id?: string };
}

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);

    const pageId = process.env.FACEBOOK_PAGE_ID;
    const pageToken = process.env.FACEBOOK_PAGE_TOKEN;
    if (!pageId) {
      throw new CLIError("Missing FACEBOOK_PAGE_ID in environment. Run Login.ts first.");
    }
    if (!pageToken) {
      throw new CLIError("Missing FACEBOOK_PAGE_TOKEN in environment. Run Login.ts first.");
    }

    const requestedSchedule = args.scheduledPublishTime !== undefined;
    const draftOnly = isDraftOnly();

    // Publish-safety gate (Lib/cli.ts): a live OR scheduled public post requires explicit
    // --yes; a bare invocation dry-runs (never silently publishes); --draft stages an
    // unpublished post; SOCIAL_DRAFT_ONLY forces a draft regardless of flags.
    const guard = enforcePublish(
      { platform: "Facebook", canDraft: true, yes: args.yes, draft: !args.published, draftOnly },
      [
        `Target:   Facebook Page ${pageId}`,
        `Message:  ${args.message}`,
        args.link ? `Link:     ${args.link}` : "",
        args.image ? `Image:    ${args.image}` : "",
        args.images ? `Images:   ${args.images.join(", ")}` : "",
        requestedSchedule ? `Schedule: ${new Date(args.scheduledPublishTime! * 1000).toISOString()}` : "",
      ].filter(Boolean),
    );

    // Draft-only mode must not auto-publish in the future, so it also drops any schedule.
    const scheduled = draftOnly ? false : requestedSchedule;
    const statusLabel = scheduled ? "scheduled" : guard.published ? "published" : "draft";
    const effectivePublished = scheduled ? false : guard.published;

    const target = args.images
      ? `multi-photo feed (${args.images.length})`
      : args.image
        ? /^https?:\/\//i.test(args.image)
          ? "photo"
          : "photo (local upload)"
        : args.link
          ? "feed (link)"
          : "feed";
    console.log(`📣 Publishing ${target} to Facebook Page ${pageId} (${statusLabel})...`);

    if (args.images) {
      console.log(`📤 Uploading ${args.images.length} unpublished photos...`);
      const photoIds: string[] = [];
      for (const ref of args.images) {
        const uploaded = await uploadSinglePhoto(pageId, pageToken, ref, { published: "false" });
        console.log(`  ✓ ${/^https?:\/\//i.test(ref) ? ref : basename(ref)} → ${uploaded.id}`);
        photoIds.push(uploaded.id);
      }

      console.log(`\n📣 Creating feed post with ${photoIds.length} attached photos...`);
      const feedParams: Record<string, string> = {
        message: args.message,
        published: effectivePublished ? "true" : "false",
      };
      photoIds.forEach((id, i) => {
        feedParams[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
      });
      if (scheduled) feedParams.scheduled_publish_time = String(args.scheduledPublishTime);

      const response = await graph<{ id: string }>(`/${pageId}/feed`, {
        method: "POST",
        token: pageToken,
        params: feedParams,
      });

      console.log(`✅ Post created`);
      console.log(`Post ID:  ${response.id}`);
      console.log(`Photos:   ${photoIds.join(", ")}`);
      console.log(`Status:   ${statusLabel}`);
      if (scheduled) {
        const whenISO = new Date(args.scheduledPublishTime! * 1000).toISOString();
        console.log(`Publish time: ${whenISO}`);
      }
      return;
    }

    const params: Record<string, string> = {
      published: effectivePublished ? "true" : "false",
    };
    if (args.image) {
      params.caption = args.message;
    } else {
      params.message = args.message;
      if (args.link) params.link = args.link;
    }
    if (scheduled) {
      params.scheduled_publish_time = String(args.scheduledPublishTime);
    }

    const response = args.image
      ? await uploadSinglePhoto(pageId, pageToken, args.image, params)
      : await graph<{ id: string; post_id?: string }>(`/${pageId}/feed`, {
          method: "POST",
          token: pageToken,
          params,
        });

    console.log(`✅ Post created`);
    if (response.post_id) {
      console.log(`Photo ID: ${response.id}`);
      console.log(`Post ID:  ${response.post_id}`);
    } else {
      console.log(`Post ID:  ${response.id}`);
    }
    console.log(`Status:   ${statusLabel}`);
    if (scheduled) {
      const whenISO = new Date(args.scheduledPublishTime! * 1000).toISOString();
      console.log(`Publish time: ${whenISO}`);
    }
  } catch (error) {
    handleError(error);
  }
}

main();
