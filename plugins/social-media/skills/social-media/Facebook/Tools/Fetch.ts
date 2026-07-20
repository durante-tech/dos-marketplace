#!/usr/bin/env bun

/**
 * Fetch — Retrieve Facebook Page data via Graph API v24.0.
 *
 * Three modes via --type:
 *   posts     — paginated list of recent Page posts
 *   insights  — Page-level metrics (impressions, engaged users, etc.)
 *   comments  — paginated comments on a specific post (requires --post-id)
 *
 * Pagination is capped at --max-pages (default 10) to prevent runaway loops.
 * Each record is emitted as one line of JSON to stdout; summary goes to stderr.
 *
 * Usage:
 *   bun Fetch.ts --type posts --max-pages 3
 *   bun Fetch.ts --type insights --metrics page_impressions,page_fans
 *   bun Fetch.ts --type comments --post-id 123456_987654
 */

import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { graph, graphPaginate, GRAPH_VERSION } from "../../Lib/graph.ts";

type FetchType = "posts" | "insights" | "comments";

interface CLIArgs {
  type: FetchType;
  maxPages: number;
  metrics?: string;
  postId?: string;
  fields?: string;
  since?: number;
  until?: number;
}

const VALID_TYPES: FetchType[] = ["posts", "insights", "comments"];

function showHelp(): void {
  console.log(`
Fetch - Facebook Page Data CLI (Graph API ${GRAPH_VERSION})

Retrieves posts, insights, or comments from the authenticated Facebook Page.
Run Login.ts first to authenticate.

USAGE:
  bun Fetch.ts --type <type> [OPTIONS]

REQUIRED:
  --type <type>       One of: ${VALID_TYPES.join(", ")}

OPTIONS:
  --max-pages <n>     Max pagination pages (default 10, safety cap)
  --fields <csv>      Comma-separated field list (posts only)
  --metrics <csv>     Comma-separated metric list (insights only)
  --since <unix-ts>   Start of date range (insights only)
  --until <unix-ts>   End of date range (insights only)
  --post-id <id>      Post ID (required for --type comments)
  --help, -h          Show this help message

ENVIRONMENT (from ~/.claude/.env, set by Login.ts):
  FACEBOOK_PAGE_ID
  FACEBOOK_PAGE_TOKEN

EXAMPLES:
  bun Fetch.ts --type posts --max-pages 3
  bun Fetch.ts --type insights
  bun Fetch.ts --type insights --metrics page_impressions,page_engaged_users
  bun Fetch.ts --type insights --since $(date -v-7d +%s) --until $(date +%s)
  bun Fetch.ts --type comments --post-id 123456_987654
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
      case "post-id":
        parsed.postId = value;
        i++;
        break;
      case "fields":
        parsed.fields = value;
        i++;
        break;
      case "since": {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n <= 0) {
          throw new CLIError(`Invalid --since: ${value} (expected unix timestamp)`);
        }
        parsed.since = n;
        i++;
        break;
      }
      case "until": {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n <= 0) {
          throw new CLIError(`Invalid --until: ${value} (expected unix timestamp)`);
        }
        parsed.until = n;
        i++;
        break;
      }
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (parsed.since !== undefined && parsed.until !== undefined && parsed.since >= parsed.until) {
    throw new CLIError(`--since must be earlier than --until`);
  }

  if (!parsed.type) throw new CLIError("Missing required argument: --type");
  if (parsed.type === "comments" && !parsed.postId) {
    throw new CLIError("--post-id is required when --type=comments");
  }
  return parsed as CLIArgs;
}

async function fetchPosts(
  pageId: string,
  token: string,
  args: CLIArgs,
): Promise<void> {
  const fields =
    args.fields ??
    "id,message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares";
  console.error(`📥 Fetching posts from Page ${pageId}...`);

  let count = 0;
  for await (const post of graphPaginate<Record<string, unknown>>(
    `/${pageId}/posts`,
    {
      method: "GET",
      token,
      params: { fields, limit: 25 },
      maxPages: args.maxPages,
    },
  )) {
    count++;
    console.log(JSON.stringify(post));
  }
  console.error(`\n✅ Retrieved ${count} post(s) (max-pages: ${args.maxPages})`);
}

async function fetchInsights(
  pageId: string,
  token: string,
  args: CLIArgs,
): Promise<void> {
  const metrics =
    args.metrics ??
    "page_impressions,page_engaged_users,page_post_engagements,page_fans";
  const rangeLabel =
    args.since && args.until
      ? ` (${new Date(args.since * 1000).toISOString()} → ${new Date(args.until * 1000).toISOString()})`
      : "";
  console.error(`📊 Fetching insights for Page ${pageId}: ${metrics}${rangeLabel}`);

  const params: Record<string, string | number> = { metric: metrics };
  if (args.since !== undefined) params.since = args.since;
  if (args.until !== undefined) params.until = args.until;

  const response = await graph<{ data: unknown[] }>(`/${pageId}/insights`, {
    method: "GET",
    token,
    params,
  });
  console.log(JSON.stringify(response, null, 2));
  console.error(`\n✅ Retrieved insights`);
}

async function fetchComments(
  postId: string,
  token: string,
  args: CLIArgs,
): Promise<void> {
  console.error(`💬 Fetching comments for post ${postId}...`);

  let count = 0;
  for await (const comment of graphPaginate<Record<string, unknown>>(
    `/${postId}/comments`,
    {
      method: "GET",
      token,
      params: {
        fields: "id,from,message,created_time,like_count",
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

    const pageId = process.env.FACEBOOK_PAGE_ID;
    const pageToken = process.env.FACEBOOK_PAGE_TOKEN;
    if (!pageId) {
      throw new CLIError("Missing FACEBOOK_PAGE_ID in environment. Run Login.ts first.");
    }
    if (!pageToken) {
      throw new CLIError("Missing FACEBOOK_PAGE_TOKEN in environment. Run Login.ts first.");
    }

    switch (args.type) {
      case "posts":
        await fetchPosts(pageId, pageToken, args);
        break;
      case "insights":
        await fetchInsights(pageId, pageToken, args);
        break;
      case "comments":
        await fetchComments(args.postId!, pageToken, args);
        break;
    }
  } catch (error) {
    handleError(error);
  }
}

main();
