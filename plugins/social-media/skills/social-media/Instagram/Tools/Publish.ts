#!/usr/bin/env bun

/**
 * Publish — Instagram Business media publishing via Graph API v24.0.
 *
 * Supports four media types via --media-type:
 *   image    (default) — single photo feed post
 *   reels             — video reel (longer polling timeout by default)
 *   stories           — story (image or video, disappears after 24h)
 *   carousel          — 2–10 image carousel
 *
 * All flows follow Meta's two-step container pattern:
 *   1. Create container(s) (POST /{ig-user-id}/media)
 *   2. Poll container.status_code until FINISHED
 *   3. Publish (POST /{ig-user-id}/media_publish with creation_id)
 *
 * Image URLs (and video URLs) must be publicly reachable — Meta fetches
 * media from its own servers. Local files are NOT supported.
 *
 * Usage:
 *   bun Publish.ts --image-url https://example.com/photo.jpg --caption "hello"
 *   bun Publish.ts --media-type reels --video-url https://example.com/clip.mp4 --caption "..."
 *   bun Publish.ts --media-type stories --image-url https://example.com/photo.jpg
 *   bun Publish.ts --media-type carousel --image-urls https://a.jpg,https://b.jpg,https://c.jpg --caption "..."
 *
 * @see https://developers.facebook.com/docs/instagram-api/guides/content-publishing/
 */

import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError, enforcePublish, isDraftOnly } from "../../Lib/cli.ts";
import { graph, GRAPH_VERSION } from "../../Lib/graph.ts";

// ============================================================================
// Types
// ============================================================================

type MediaType = "image" | "reels" | "stories" | "carousel";
const VALID_MEDIA_TYPES: MediaType[] = ["image", "reels", "stories", "carousel"];

type ContainerStatus =
  | "IN_PROGRESS"
  | "FINISHED"
  | "ERROR"
  | "PUBLISHED"
  | "EXPIRED";

interface CLIArgs {
  mediaType: MediaType;
  imageUrl?: string;
  videoUrl?: string;
  imageUrls?: string[];
  caption?: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  yes: boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_IMAGE_POLL_TIMEOUT_MS = 120_000;
const DEFAULT_VIDEO_POLL_TIMEOUT_MS = 300_000;

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
Publish - Instagram Business Media CLI (Graph API ${GRAPH_VERSION})

Publishes to an Instagram Business account via the two-step container
flow. Supports photos, reels, stories, and carousels.

USAGE:
  bun Publish.ts [--media-type <type>] [OPTIONS]

MEDIA TYPES:
  image    (default)  Single photo feed post. Requires --image-url.
  reels               Video reel. Requires --video-url. Polls longer by default.
  stories             Story (image or video). Requires --image-url OR --video-url.
  carousel            Multi-image carousel (2–10). Requires --image-urls.

COMMON OPTIONS:
  --caption <text>        Caption text (not allowed for stories)
  --image-url <url>       Public http(s) URL of an image
  --video-url <url>       Public http(s) URL of a video
  --image-urls <csv>      Comma-separated image URLs for carousel (2–10)
  --poll-interval <ms>    Poll interval in ms (default ${DEFAULT_POLL_INTERVAL_MS})
  --poll-timeout <ms>     Poll timeout in ms (default ${DEFAULT_IMAGE_POLL_TIMEOUT_MS}
                          for image/carousel/stories, ${DEFAULT_VIDEO_POLL_TIMEOUT_MS} for reels)
  --yes                   Confirm a LIVE publish. REQUIRED — Instagram has no draft
                          state, so without --yes the tool dry-runs and exits without
                          posting. (SOCIAL_DRAFT_ONLY=1 hard-refuses IG: it cannot stage.)
  --help, -h              Show this help

ENVIRONMENT (from ~/.claude/.env, set by Facebook Login.ts):
  FACEBOOK_IG_USER_ID
  FACEBOOK_PAGE_TOKEN

EXAMPLES:
  # Single photo (default media-type)
  bun Publish.ts --image-url "https://example.com/photo.jpg" --caption "hello"

  # Reel
  bun Publish.ts --media-type reels \\
    --video-url "https://example.com/clip.mp4" --caption "new release"

  # Story (image)
  bun Publish.ts --media-type stories --image-url "https://example.com/story.jpg"

  # Story (video)
  bun Publish.ts --media-type stories --video-url "https://example.com/story.mp4"

  # Carousel (2–10 photos)
  bun Publish.ts --media-type carousel \\
    --image-urls "https://a.jpg,https://b.jpg,https://c.jpg" \\
    --caption "three photos"
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
    mediaType: "image",
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    yes: false,
  };

  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}`);
    }
    const key = flag.slice(2);

    // Boolean flag (no value) — handle before the value lookup below.
    if (key === "yes") {
      parsed.yes = true;
      continue;
    }

    const value = args[i + 1];
    // Free-text flags (caption) may legitimately begin with "--",
    // so only reject an absent value, not one that merely looks like a flag.
    if (value === undefined) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }
    switch (key) {
      case "media-type":
        if (!VALID_MEDIA_TYPES.includes(value as MediaType)) {
          throw new CLIError(
            `Invalid --media-type: ${value}. Must be: ${VALID_MEDIA_TYPES.join(", ")}`,
          );
        }
        parsed.mediaType = value as MediaType;
        i++;
        break;
      case "image-url":
        parsed.imageUrl = value;
        i++;
        break;
      case "video-url":
        parsed.videoUrl = value;
        i++;
        break;
      case "image-urls":
        parsed.imageUrls = value.split(",").map((s) => s.trim()).filter(Boolean);
        i++;
        break;
      case "caption":
        parsed.caption = value;
        i++;
        break;
      case "poll-interval": {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n < 100) {
          throw new CLIError(`Invalid --poll-interval: ${value} (min 100ms)`);
        }
        parsed.pollIntervalMs = n;
        i++;
        break;
      }
      case "poll-timeout": {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n < 1000) {
          throw new CLIError(`Invalid --poll-timeout: ${value} (min 1000ms)`);
        }
        parsed.pollTimeoutMs = n;
        i++;
        break;
      }
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (parsed.pollTimeoutMs === undefined) {
    parsed.pollTimeoutMs =
      parsed.mediaType === "reels"
        ? DEFAULT_VIDEO_POLL_TIMEOUT_MS
        : DEFAULT_IMAGE_POLL_TIMEOUT_MS;
  }

  validateByMediaType(parsed);
  return parsed as CLIArgs;
}

function validateByMediaType(parsed: Partial<CLIArgs>): void {
  const t = parsed.mediaType!;

  if (t === "image") {
    if (!parsed.imageUrl) throw new CLIError("--image-url is required for --media-type image");
    assertPublicUrl("--image-url", parsed.imageUrl);
  } else if (t === "reels") {
    if (!parsed.videoUrl) throw new CLIError("--video-url is required for --media-type reels");
    assertPublicUrl("--video-url", parsed.videoUrl);
  } else if (t === "stories") {
    if (!parsed.imageUrl && !parsed.videoUrl) {
      throw new CLIError("--image-url or --video-url is required for --media-type stories");
    }
    if (parsed.imageUrl && parsed.videoUrl) {
      throw new CLIError("--image-url and --video-url are mutually exclusive for stories");
    }
    if (parsed.imageUrl) assertPublicUrl("--image-url", parsed.imageUrl);
    if (parsed.videoUrl) assertPublicUrl("--video-url", parsed.videoUrl);
    if (parsed.caption) {
      throw new CLIError("Stories do not support --caption");
    }
  } else if (t === "carousel") {
    if (!parsed.imageUrls || parsed.imageUrls.length === 0) {
      throw new CLIError("--image-urls is required for --media-type carousel (csv, 2–10 items)");
    }
    if (parsed.imageUrls.length < 2 || parsed.imageUrls.length > 10) {
      throw new CLIError(
        `Carousel requires 2–10 images, got ${parsed.imageUrls.length}`,
      );
    }
    for (const url of parsed.imageUrls) {
      assertPublicUrl("--image-urls item", url);
    }
  }
}

function assertPublicUrl(flagName: string, url: string): void {
  if (!/^https?:\/\//i.test(url)) {
    throw new CLIError(`${flagName} must be a public http(s) URL, got: ${url}`);
  }
}

// ============================================================================
// Graph API Calls — generic container create / poll / publish
// ============================================================================

async function createContainer(
  igUserId: string,
  token: string,
  params: Record<string, string>,
): Promise<string> {
  const response = await graph<{ id: string }>(`/${igUserId}/media`, {
    method: "POST",
    token,
    params,
  });
  return response.id;
}

async function waitForContainer(
  containerId: string,
  token: string,
  intervalMs: number,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: ContainerStatus | "UNKNOWN" = "UNKNOWN";

  while (true) {
    if (Date.now() >= deadline) {
      process.stdout.write("\n");
      throw new CLIError(
        `${label} did not reach FINISHED within ${timeoutMs}ms. Increase --poll-timeout.`,
      );
    }

    const response = await graph<{ status_code: ContainerStatus }>(`/${containerId}`, {
      method: "GET",
      token,
      params: { fields: "status_code" },
    });
    const status = response.status_code;
    if (status !== lastStatus) {
      process.stdout.write(`\r⏳ ${label} status: ${status}${" ".repeat(20)}`);
      lastStatus = status;
    }

    if (status === "FINISHED") {
      process.stdout.write("\n");
      return;
    }
    if (status === "ERROR" || status === "EXPIRED") {
      process.stdout.write("\n");
      throw new CLIError(`${label} processing failed: status_code=${status}`);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) continue;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, remaining)));
  }
}

async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<string> {
  const response = await graph<{ id: string }>(`/${igUserId}/media_publish`, {
    method: "POST",
    token,
    params: { creation_id: containerId },
  });
  return response.id;
}

// ============================================================================
// Per-Media-Type Flows
// ============================================================================

async function publishImage(
  igUserId: string,
  token: string,
  args: CLIArgs,
): Promise<string> {
  console.log(`📸 Creating image container...`);
  const containerId = await createContainer(igUserId, token, {
    image_url: args.imageUrl!,
    ...(args.caption && { caption: args.caption }),
  });
  console.log(`✅ Container created: ${containerId}\n`);

  await waitForContainer(containerId, token, args.pollIntervalMs, args.pollTimeoutMs, "Container");

  console.log(`\n📣 Publishing image...`);
  return publishContainer(igUserId, token, containerId);
}

async function publishReels(
  igUserId: string,
  token: string,
  args: CLIArgs,
): Promise<string> {
  console.log(`🎬 Creating reels container...`);
  const containerId = await createContainer(igUserId, token, {
    media_type: "REELS",
    video_url: args.videoUrl!,
    ...(args.caption && { caption: args.caption }),
  });
  console.log(`✅ Container created: ${containerId}\n`);

  await waitForContainer(
    containerId,
    token,
    args.pollIntervalMs,
    args.pollTimeoutMs,
    "Reels container",
  );

  console.log(`\n📣 Publishing reel...`);
  return publishContainer(igUserId, token, containerId);
}

async function publishStory(
  igUserId: string,
  token: string,
  args: CLIArgs,
): Promise<string> {
  console.log(`📖 Creating story container...`);
  const params: Record<string, string> = { media_type: "STORIES" };
  if (args.imageUrl) params.image_url = args.imageUrl;
  if (args.videoUrl) params.video_url = args.videoUrl;

  const containerId = await createContainer(igUserId, token, params);
  console.log(`✅ Container created: ${containerId}\n`);

  await waitForContainer(
    containerId,
    token,
    args.pollIntervalMs,
    args.pollTimeoutMs,
    "Story container",
  );

  console.log(`\n📣 Publishing story...`);
  return publishContainer(igUserId, token, containerId);
}

async function publishCarousel(
  igUserId: string,
  token: string,
  args: CLIArgs,
): Promise<string> {
  const urls = args.imageUrls!;
  console.log(`🎠 Creating ${urls.length} carousel child containers...`);

  const childIds = await Promise.all(
    urls.map((url) =>
      createContainer(igUserId, token, {
        image_url: url,
        is_carousel_item: "true",
      }),
    ),
  );
  console.log(`✅ Child containers created: ${childIds.join(", ")}\n`);

  console.log(`⏳ Polling each child to FINISHED...`);
  for (let i = 0; i < childIds.length; i++) {
    await waitForContainer(
      childIds[i]!,
      token,
      args.pollIntervalMs,
      args.pollTimeoutMs,
      `Child ${i + 1}/${childIds.length}`,
    );
  }

  console.log(`\n🎠 Creating carousel parent container...`);
  const parentId = await createContainer(igUserId, token, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    ...(args.caption && { caption: args.caption }),
  });
  console.log(`✅ Parent container created: ${parentId}\n`);

  await waitForContainer(
    parentId,
    token,
    args.pollIntervalMs,
    args.pollTimeoutMs,
    "Carousel parent",
  );

  console.log(`\n📣 Publishing carousel...`);
  return publishContainer(igUserId, token, parentId);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);

    const igUserId = process.env.FACEBOOK_IG_USER_ID;
    const pageToken = process.env.FACEBOOK_PAGE_TOKEN;
    if (!igUserId) {
      throw new CLIError(
        "Missing FACEBOOK_IG_USER_ID. Re-run Facebook/Tools/Login.ts and select a Page with a linked Instagram Business account.",
      );
    }
    if (!pageToken) {
      throw new CLIError("Missing FACEBOOK_PAGE_TOKEN. Run Facebook/Tools/Login.ts first.");
    }

    // Publish-safety gate (Lib/cli.ts): Instagram has NO draft state, so the confirm-gate is
    // its only safety — live publish requires explicit --yes; a bare invocation dry-runs; and
    // SOCIAL_DRAFT_ONLY hard-refuses (IG cannot stage a draft). canDraft is false for IG.
    enforcePublish(
      { platform: "Instagram", canDraft: false, yes: args.yes, draft: false, draftOnly: isDraftOnly() },
      [
        `Target:    Instagram Business ${igUserId}`,
        `Media:     ${args.mediaType}`,
        args.imageUrl ? `Image URL: ${args.imageUrl}` : "",
        args.videoUrl ? `Video URL: ${args.videoUrl}` : "",
        args.imageUrls ? `Images:    ${args.imageUrls.join(", ")}` : "",
        args.caption ? `Caption:   ${args.caption}` : "",
      ].filter(Boolean),
    );

    let mediaId: string;
    switch (args.mediaType) {
      case "image":
        mediaId = await publishImage(igUserId, pageToken, args);
        break;
      case "reels":
        mediaId = await publishReels(igUserId, pageToken, args);
        break;
      case "stories":
        mediaId = await publishStory(igUserId, pageToken, args);
        break;
      case "carousel":
        mediaId = await publishCarousel(igUserId, pageToken, args);
        break;
    }

    console.log(`\n✅ Published to Instagram (${args.mediaType})`);
    console.log(`Media ID: ${mediaId}`);
  } catch (error) {
    handleError(error);
  }
}

main();
