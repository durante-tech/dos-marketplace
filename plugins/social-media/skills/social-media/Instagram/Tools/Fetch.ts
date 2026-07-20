#!/usr/bin/env bun

/**
 * Fetch — Retrieve Instagram Business data via Graph API v24.0.
 *
 * Three modes via --type:
 *   media      — paginated list of recent IG media (posts)
 *   insights   — per-media metrics (requires --media-id)
 *   comments   — paginated comments on a media item (requires --media-id)
 *
 * Pagination is capped at --max-pages (default 10).
 * Each record is emitted as one line of JSON to stdout; summaries to stderr.
 *
 * Usage:
 *   bun Fetch.ts --type media --max-pages 3
 *   bun Fetch.ts --type insights --media-id 17841000000000000
 *   bun Fetch.ts --type comments --media-id 17841000000000000
 */

import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { graph, graphPaginate, GRAPH_VERSION } from "../../Lib/graph.ts";

type FetchType = "media" | "insights" | "comments";

interface CLIArgs {
  type: FetchType;
  mediaId?: string;
  maxPages: number;
  metrics?: string;
  fields?: string;
}

const VALID_TYPES: FetchType[] = ["media", "insights", "comments"];

function showHelp(): void {
  console.log(`
Fetch - Instagram Business Data CLI (Graph API ${GRAPH_VERSION})

Retrieves media, insights, or comments from an Instagram Business account.
Run Facebook/Tools/Login.ts first to authenticate.

USAGE:
  bun Fetch.ts --type <type> [OPTIONS]

REQUIRED:
  --type <type>       One of: ${VALID_TYPES.join(", ")}

OPTIONS:
  --media-id <id>     Media ID (required for --type insights | comments)
  --max-pages <n>     Max pagination pages (default 10)
  --fields <csv>      Comma-separated field list (media only)
  --metrics <csv>     Comma-separated metric list (insights only)
  --help, -h          Show this help message

ENVIRONMENT (from ~/.claude/.env, set by Facebook Login.ts):
  FACEBOOK_IG_USER_ID
  FACEBOOK_PAGE_TOKEN

EXAMPLES:
  bun Fetch.ts --type media --max-pages 3
  bun Fetch.ts --type insights --media-id 17841000000000000
  bun Fetch.ts --type insights --media-id 17841000000000000 --metrics impressions,reach
  bun Fetch.ts --type comments --media-id 17841000000000000
`);
  process.exit(0);
}

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
  }

  const parsed: Partial<CLIArgs> = { maxPages: 10 };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}`);
    }
    const key = flag.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }
    switch (key) {
      case "type":
        if (!VALID_TYPES.includes(value as FetchType)) {
          throw new CLIError(
            `Invalid --type: ${value}. Must be: ${VALID_TYPES.join(", ")}`,
          );
        }
        parsed.type = value as FetchType;
        i++;
        break;
      case "media-id":
        parsed.mediaId = value;
        i++;
        break;
      case "max-pages": {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n < 1) {
          throw new CLIError(`Invalid --max-pages: ${value}`);
        }
        parsed.maxPages = n;
        i++;
        break;
      }
      case "metrics":
        parsed.metrics = value;
        i++;
        break;
      case "fields":
        parsed.fields = value;
        i++;
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.type) throw new CLIError("Missing required argument: --type");
  if ((parsed.type === "insights" || parsed.type === "comments") && !parsed.mediaId) {
    throw new CLIError(`--media-id is required when --type=${parsed.type}`);
  }
  return parsed as CLIArgs;
}

async function fetchMedia(
  igUserId: string,
  token: string,
  args: CLIArgs,
): Promise<void> {
  const fields =
    args.fields ??
    "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count";
  console.error(`📥 Fetching media from IG user ${igUserId}...`);

  let count = 0;
  for await (const media of graphPaginate<Record<string, unknown>>(
    `/${igUserId}/media`,
    {
      method: "GET",
      token,
      params: { fields, limit: 25 },
      maxPages: args.maxPages,
    },
  )) {
    count++;
    console.log(JSON.stringify(media));
  }
  console.error(`\n✅ Retrieved ${count} media item(s) (max-pages: ${args.maxPages})`);
}

async function fetchInsights(
  mediaId: string,
  token: string,
  args: CLIArgs,
): Promise<void> {
  const metrics =
    args.metrics ?? "impressions,reach,likes,comments,saved,shares";
  console.error(`📊 Fetching insights for media ${mediaId}: ${metrics}`);

  const response = await graph<{ data: unknown[] }>(`/${mediaId}/insights`, {
    method: "GET",
    token,
    params: { metric: metrics },
  });
  console.log(JSON.stringify(response, null, 2));
  console.error(`\n✅ Retrieved insights`);
}

async function fetchComments(
  mediaId: string,
  token: string,
  args: CLIArgs,
): Promise<void> {
  console.error(`💬 Fetching comments for media ${mediaId}...`);

  let count = 0;
  for await (const comment of graphPaginate<Record<string, unknown>>(
    `/${mediaId}/comments`,
    {
      method: "GET",
      token,
      params: {
        fields: "id,username,text,timestamp,like_count",
        limit: 25,
      },
      maxPages: args.maxPages,
    },
  )) {
    count++;
    console.log(JSON.stringify(comment));
  }
  console.error(`\n✅ Retrieved ${count} comment(s)`);
}

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);

    const igUserId = process.env.FACEBOOK_IG_USER_ID;
    const pageToken = process.env.FACEBOOK_PAGE_TOKEN;
    if (!igUserId) {
      throw new CLIError(
        "Missing FACEBOOK_IG_USER_ID. Run Facebook/Tools/Login.ts first and ensure the Page has a linked IG Business account.",
      );
    }
    if (!pageToken) {
      throw new CLIError(
        "Missing FACEBOOK_PAGE_TOKEN. Run Facebook/Tools/Login.ts first.",
      );
    }

    switch (args.type) {
      case "media":
        await fetchMedia(igUserId, pageToken, args);
        break;
      case "insights":
        await fetchInsights(args.mediaId!, pageToken, args);
        break;
      case "comments":
        await fetchComments(args.mediaId!, pageToken, args);
        break;
    }
  } catch (error) {
    handleError(error);
  }
}

main();
