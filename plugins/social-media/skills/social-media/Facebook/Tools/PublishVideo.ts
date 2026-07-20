#!/usr/bin/env bun

/**
 * PublishVideo — Publish a native video post to a Facebook Page via
 * Graph API v24.0.
 *
 * Uses the `file_url` parameter on `/{page-id}/videos` — Meta fetches
 * the video from the public URL you provide. For chunked uploads of
 * local files, see the resumable upload protocol (not implemented in
 * v0.2.0).
 *
 * Usage:
 *   bun PublishVideo.ts --video-url https://example.com/clip.mp4
 *   bun PublishVideo.ts --video-url https://example.com/clip.mp4 \
 *     --title "New release" --description "Shipping notes"
 *
 * @see https://developers.facebook.com/docs/graph-api/reference/page/videos/
 */

import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError, enforcePublish, isDraftOnly } from "../../Lib/cli.ts";
import { graph, GRAPH_VERSION } from "../../Lib/graph.ts";

interface CLIArgs {
  videoUrl: string;
  title?: string;
  description?: string;
  published: boolean;
  yes: boolean;
}

function showHelp(): void {
  console.log(`
PublishVideo - Facebook Page Video CLI (Graph API ${GRAPH_VERSION})

Publishes a native video post to the authenticated Facebook Page.
Meta fetches the video from the public URL you provide and processes
it asynchronously.

USAGE:
  bun PublishVideo.ts --video-url <url> [OPTIONS]

REQUIRED:
  --video-url <url>    PUBLIC http(s) URL of the video (Meta must reach it).
                       Local files are NOT supported in this release.

OPTIONS:
  --title <text>       Video title
  --description <text> Video description body
  --yes                Confirm a LIVE publish. REQUIRED to go live — without --yes
                       (and without --draft) the tool dry-runs and exits without posting.
  --draft              Create as unpublished (otherwise staged, not live)
  --help, -h           Show this help message

SAFETY:
  A bare invocation DRY-RUNS (prints the preview, exits non-zero). Pass --yes to go
  live or --draft to stage. SOCIAL_DRAFT_ONLY=1 forces draft-only mode.

ENVIRONMENT (from ~/.claude/.env, set by Login.ts):
  FACEBOOK_PAGE_ID
  FACEBOOK_PAGE_TOKEN

OUTPUT:
  Returns a Video ID (NOT a Post ID). Processing is async; the video
  may take minutes to become live on the Page feed. Check status in the
  Meta dashboard.

EXAMPLES:
  bun PublishVideo.ts --video-url "https://example.com/release.mp4"
  bun PublishVideo.ts --video-url "https://example.com/clip.mp4" \\
    --title "Shipping announcement" \\
    --description "New social-media pack v0.2.0 released"
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

    if (key === "draft") {
      parsed.published = false;
      continue;
    }
    if (key === "yes") {
      parsed.yes = true;
      continue;
    }

    const value = args[i + 1];
    // Free-text flags (title/description) may legitimately begin with "--",
    // so only reject an absent value, not one that merely looks like a flag.
    if (value === undefined) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }
    switch (key) {
      case "video-url":
        parsed.videoUrl = value;
        i++;
        break;
      case "title":
        parsed.title = value;
        i++;
        break;
      case "description":
        parsed.description = value;
        i++;
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.videoUrl) throw new CLIError("Missing required argument: --video-url");
  if (!/^https?:\/\//i.test(parsed.videoUrl)) {
    throw new CLIError(
      `--video-url must be a publicly reachable http(s) URL, got: ${parsed.videoUrl}`,
    );
  }
  return parsed as CLIArgs;
}

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);

    const pageId = process.env.FACEBOOK_PAGE_ID;
    const pageToken = process.env.FACEBOOK_PAGE_TOKEN;
    if (!pageId) throw new CLIError("Missing FACEBOOK_PAGE_ID in environment. Run Login.ts first.");
    if (!pageToken) throw new CLIError("Missing FACEBOOK_PAGE_TOKEN in environment. Run Login.ts first.");

    // Publish-safety gate (Lib/cli.ts): live video publish requires explicit --yes; a bare
    // invocation dry-runs; --draft stages unpublished; SOCIAL_DRAFT_ONLY forces a draft.
    const guard = enforcePublish(
      { platform: "Facebook", canDraft: true, yes: args.yes, draft: !args.published, draftOnly: isDraftOnly() },
      [
        `Target:      Facebook Page ${pageId} (video)`,
        `Video URL:   ${args.videoUrl}`,
        args.title ? `Title:       ${args.title}` : "",
        args.description ? `Description: ${args.description}` : "",
      ].filter(Boolean),
    );
    const effectivePublished = guard.published;

    console.log(`🎥 Publishing video to Facebook Page ${pageId}...`);

    const params: Record<string, string> = {
      file_url: args.videoUrl,
      published: effectivePublished ? "true" : "false",
    };
    if (args.title) params.title = args.title;
    if (args.description) params.description = args.description;

    const response = await graph<{ id: string }>(`/${pageId}/videos`, {
      method: "POST",
      token: pageToken,
      params,
    });

    console.log(`✅ Video upload accepted by Facebook`);
    console.log(`Video ID: ${response.id}`);
    console.log(`Status:   ${effectivePublished ? "published (async processing)" : "draft"}`);
    console.log(
      `\nNote: this is a Video ID, not a Post ID. Meta processes the video asynchronously —`,
    );
    console.log(
      `it may take several minutes before it is visible on the Page feed.`,
    );
  } catch (error) {
    handleError(error);
  }
}

main();
