#!/usr/bin/env bun

/**
 * Publish — Create a LinkedIn post on the authenticated member's profile
 * via the versioned /rest/posts API.
 *
 * Reads LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN, and
 * LINKEDIN_TOKEN_EXPIRES_AT from ~/.claude/.env (set by Login.ts).
 *
 * Supported content types (personal profile only):
 *   --message                            text-only post (required on every call)
 *   --image <url|path>                   single image post
 *   --images <csv>                       multi-image carousel (2–20)
 *   --article <url>                      article / link preview post
 *
 * --image, --images, and --article are mutually exclusive.
 *
 * Polls, PDF/document posts, and native scheduling are NOT supported on
 * personal profiles by the LinkedIn API — they are gated to organizations.
 *
 * Usage:
 *   bun Publish.ts --message "hello world"
 *   bun Publish.ts --message "caption" --image ~/Downloads/photo.png
 *   bun Publish.ts --message "swipe →" --images a.png,b.png,c.png
 *   bun Publish.ts --message "new essay" --article https://example.com/essay
 *   bun Publish.ts --message "draft" --draft
 *
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
 */

import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError, enforcePublish, isDraftOnly } from "../../Lib/cli.ts";
import {
  LINKEDIN_VERSION,
  linkedinFetch,
  putToUploadUrl,
} from "../../Lib/linkedin.ts";

// ============================================================================
// Types & Constants
// ============================================================================

type Visibility = "PUBLIC" | "CONNECTIONS";
const VALID_VISIBILITIES: Visibility[] = ["PUBLIC", "CONNECTIONS"];
const MIN_CAROUSEL = 2;
const MAX_CAROUSEL = 20;

interface CLIArgs {
  message: string;
  image?: string;
  images?: string[];
  article?: string;
  articleTitle?: string;
  articleDescription?: string;
  articleThumbnail?: string;
  visibility: Visibility;
  published: boolean;
  yes: boolean;
}

interface InitializeUploadResponse {
  value: {
    uploadUrl: string;
    uploadUrlExpiresAt: number;
    image: string;
  };
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
Publish - LinkedIn Personal Post CLI (REST version ${LINKEDIN_VERSION})

Creates a post on the authenticated member's LinkedIn profile via the
versioned /rest/posts API. Run Login.ts first to authenticate.

USAGE:
  bun Publish.ts --message "<text>" [OPTIONS]

REQUIRED:
  --message <text>         Post body / commentary (quote if it has spaces)

CONTENT (mutually exclusive):
  --image <url|path>       Single image post. URL or local file.
  --images <csv>           Multi-image carousel (2–20). Comma-separated
                           URLs or local file paths.
  --article <url>          Article / link-preview post. Pair with:
                             --article-title <text>
                             --article-description <text>
                             --article-thumbnail <url|path>

OPTIONS:
  --visibility <v>         PUBLIC or CONNECTIONS (default PUBLIC)
  --yes                    Confirm a LIVE publish. REQUIRED to go live — without --yes
                           (and without --draft) the tool dry-runs and exits without posting.
  --draft                  Save as DRAFT instead of PUBLISHED
  --help, -h               Show this help message

SAFETY:
  A bare invocation DRY-RUNS (prints the preview, exits non-zero). Pass --yes to go
  live or --draft to stage. SOCIAL_DRAFT_ONLY=1 forces draft-only mode.

ENVIRONMENT (from ~/.claude/.env, set by Login.ts):
  LINKEDIN_ACCESS_TOKEN
  LINKEDIN_PERSON_URN
  LINKEDIN_TOKEN_EXPIRES_AT

EXAMPLES:
  bun Publish.ts --message "Hello from the DOS social-media pack"
  bun Publish.ts --message "look at this" --image ~/Downloads/photo.png
  bun Publish.ts --message "swipe →" --images a.png,b.png,c.png
  bun Publish.ts --message "new essay" \\
    --article https://example.com/essay \\
    --article-title "The Algorithm" \\
    --article-description "Why every answer should earn its existence"
  bun Publish.ts --message "draft idea" --draft --visibility CONNECTIONS
`);
  process.exit(0);
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
  }

  const parsed: Partial<CLIArgs> = {
    visibility: "PUBLIC",
    published: true,
    yes: false,
  };
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
    // Free-text flags (message) may legitimately begin with "--",
    // so only reject an absent value, not one that merely looks like a flag.
    if (value === undefined) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }
    switch (key) {
      case "message":
        parsed.message = value;
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
      case "article":
        parsed.article = value;
        i++;
        break;
      case "article-title":
        parsed.articleTitle = value;
        i++;
        break;
      case "article-description":
        parsed.articleDescription = value;
        i++;
        break;
      case "article-thumbnail":
        parsed.articleThumbnail = value;
        i++;
        break;
      case "visibility": {
        const v = value.toUpperCase() as Visibility;
        if (!VALID_VISIBILITIES.includes(v)) {
          throw new CLIError(
            `--visibility must be one of ${VALID_VISIBILITIES.join(", ")}`,
          );
        }
        parsed.visibility = v;
        i++;
        break;
      }
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.message) throw new CLIError("Missing required argument: --message");
  const contentFlags = [parsed.image, parsed.images, parsed.article].filter(Boolean).length;
  if (contentFlags > 1) {
    throw new CLIError("--image, --images, and --article are mutually exclusive");
  }

  if (parsed.image) {
    parsed.image = resolveImageRef(parsed.image, "--image");
  }
  if (parsed.images) {
    if (parsed.images.length < MIN_CAROUSEL || parsed.images.length > MAX_CAROUSEL) {
      throw new CLIError(
        `--images requires ${MIN_CAROUSEL}–${MAX_CAROUSEL} entries, got ${parsed.images.length}`,
      );
    }
    parsed.images = parsed.images.map((ref) => resolveImageRef(ref, "--images"));
  }
  if (parsed.article && !/^https?:\/\//i.test(parsed.article)) {
    throw new CLIError(`--article must be an http(s) URL, got: ${parsed.article}`);
  }
  if (parsed.articleThumbnail) {
    parsed.articleThumbnail = resolveImageRef(parsed.articleThumbnail, "--article-thumbnail");
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

// ============================================================================
// Upload helpers
// ============================================================================

/**
 * Upload a single image (local file path or public URL) and return the
 * resulting `urn:li:image:...` URN for use in the post body.
 */
async function uploadImage(
  personUrn: string,
  token: string,
  ref: string,
): Promise<string> {
  const init = await linkedinFetch<InitializeUploadResponse>(
    "/rest/images?action=initializeUpload",
    {
      method: "POST",
      token,
      body: { initializeUploadRequest: { owner: personUrn } },
    },
  );
  const { uploadUrl, image: imageUrn } = init.body.value;

  const bytes = /^https?:\/\//i.test(ref)
    ? await fetchRemoteBytes(ref)
    : await Bun.file(ref).arrayBuffer();

  await putToUploadUrl(uploadUrl, bytes, token);
  return imageUrn;
}

async function fetchRemoteBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new CLIError(`Failed to fetch ${url} (HTTP ${res.status})`);
  }
  return res.arrayBuffer();
}

// ============================================================================
// Token freshness check
// ============================================================================

function assertTokenFresh(): void {
  const expiresAt = process.env.LINKEDIN_TOKEN_EXPIRES_AT;
  if (!expiresAt) return;
  const expiresAtSec = parseInt(expiresAt, 10);
  if (Number.isNaN(expiresAtSec)) {
    throw new CLIError(
      `Invalid LINKEDIN_TOKEN_EXPIRES_AT in ~/.claude/.env (must be unix timestamp in seconds). Re-run Login.ts.`,
    );
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (expiresAtSec <= nowSec) {
    throw new CLIError(
      `LinkedIn access token expired at ${new Date(expiresAtSec * 1000).toISOString()}. Re-run Login.ts to authenticate.`,
    );
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);

    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const personUrn = process.env.LINKEDIN_PERSON_URN;
    if (!token) {
      throw new CLIError("Missing LINKEDIN_ACCESS_TOKEN in environment. Run Login.ts first.");
    }
    if (!personUrn) {
      throw new CLIError("Missing LINKEDIN_PERSON_URN in environment. Run Login.ts first.");
    }

    assertTokenFresh();

    // Publish-safety gate (Lib/cli.ts): live publish requires explicit --yes; a bare
    // invocation dry-runs; --draft stages a DRAFT; SOCIAL_DRAFT_ONLY forces a draft.
    const guard = enforcePublish(
      { platform: "LinkedIn", canDraft: true, yes: args.yes, draft: !args.published, draftOnly: isDraftOnly() },
      [
        `Target:     LinkedIn ${personUrn}`,
        `Message:    ${args.message}`,
        args.image ? `Image:      ${args.image}` : "",
        args.images ? `Images:     ${args.images.join(", ")}` : "",
        args.article ? `Article:    ${args.article}` : "",
        `Visibility: ${args.visibility}`,
      ].filter(Boolean),
    );

    const lifecycleState = guard.published ? "PUBLISHED" : "DRAFT";
    const target = args.images
      ? `multi-image (${args.images.length})`
      : args.image
        ? "single image"
        : args.article
          ? "article"
          : "text";
    console.log(`📣 Publishing ${target} post to LinkedIn as ${personUrn} (${lifecycleState.toLowerCase()})...`);

    // Build content block based on flags.
    let content: Record<string, unknown> | undefined;

    if (args.image) {
      console.log(`📤 Uploading image...`);
      const imageUrn = await uploadImage(personUrn, token, args.image);
      console.log(`  ✓ ${basename(args.image)} → ${imageUrn}`);
      content = { media: { id: imageUrn } };
    } else if (args.images) {
      console.log(`📤 Uploading ${args.images.length} images in parallel...`);
      const imageUrns = await Promise.all(
        args.images.map((ref) => uploadImage(personUrn, token, ref)),
      );
      args.images.forEach((ref, i) => {
        console.log(`  ✓ ${/^https?:\/\//i.test(ref) ? ref : basename(ref)} → ${imageUrns[i]}`);
      });
      content = {
        multiImage: {
          images: imageUrns.map((id) => ({ id })),
        },
      };
    } else if (args.article) {
      let thumbnailUrn: string | undefined;
      if (args.articleThumbnail) {
        console.log(`📤 Uploading article thumbnail...`);
        thumbnailUrn = await uploadImage(personUrn, token, args.articleThumbnail);
      }
      const article: Record<string, unknown> = { source: args.article };
      if (args.articleTitle) article.title = args.articleTitle;
      if (args.articleDescription) article.description = args.articleDescription;
      if (thumbnailUrn) article.thumbnail = thumbnailUrn;
      content = { article };
    }

    const postBody: Record<string, unknown> = {
      author: personUrn,
      commentary: args.message,
      visibility: args.visibility,
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState,
      isReshareDisabledByAuthor: false,
    };
    if (content !== undefined) postBody.content = content;

    console.log(`\n📣 Creating post via /rest/posts...`);
    const response = await linkedinFetch<unknown>("/rest/posts", {
      method: "POST",
      token,
      body: postBody,
    });

    const postUrn = response.restliId;
    console.log(`\n✅ Post created`);
    if (postUrn) {
      console.log(`Post URN:  ${postUrn}`);
      const encoded = encodeURIComponent(postUrn);
      console.log(`View at:   https://www.linkedin.com/feed/update/${encoded}/`);
    } else {
      console.log(`(No x-restli-id header returned — check your LinkedIn feed directly.)`);
    }
    console.log(`Status:    ${lifecycleState.toLowerCase()}`);
    console.log(`\nNote: LinkedIn's own-profile cache can hide your post for ~30s from your own view. Check in incognito or from another account to verify.`);
  } catch (error) {
    handleError(error);
  }
}

main();
