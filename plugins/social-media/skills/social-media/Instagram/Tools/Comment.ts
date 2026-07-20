#!/usr/bin/env bun

/**
 * Comment — Reply to or delete a comment on an Instagram media post.
 *
 * Actions:
 *   reply   — POST /{comment-id}/replies with --message
 *   delete  — DELETE /{comment-id} (requires --yes guard)
 *
 * Note: Instagram uses the `/replies` edge for threading, unlike Facebook
 * which uses `/comments`. This is a platform difference, not a bug.
 *
 * Usage:
 *   bun Comment.ts --action reply --comment-id 17841... --message "Thanks!"
 *   bun Comment.ts --action delete --comment-id 17841... --yes
 */

import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { graph, GRAPH_VERSION } from "../../Lib/graph.ts";

type Action = "reply" | "delete";
const VALID_ACTIONS: Action[] = ["reply", "delete"];

interface CLIArgs {
  action: Action;
  commentId: string;
  message?: string;
  yes: boolean;
}

function showHelp(): void {
  console.log(`
Comment - Instagram Comment Reply/Delete CLI (Graph API ${GRAPH_VERSION})

Reply to or delete a comment on an Instagram media post.

USAGE:
  bun Comment.ts --action <reply|delete> --comment-id <id> [OPTIONS]

REQUIRED:
  --action <action>      One of: ${VALID_ACTIONS.join(", ")}
  --comment-id <id>      Comment ID from Fetch.ts --type comments

OPTIONS:
  --message <text>       Reply body (required for --action reply)
  --yes                  Confirm deletion (required for --action delete)
  --help, -h             Show this help message

ENVIRONMENT (from ~/.claude/.env, set by Facebook Login.ts):
  FACEBOOK_PAGE_TOKEN

EXAMPLES:
  bun Comment.ts --action reply --comment-id 17841000000000000 --message "Thanks!"
  bun Comment.ts --action delete --comment-id 17841000000000000 --yes
`);
  process.exit(0);
}

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
  }

  const parsed: Partial<CLIArgs> = { yes: false };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}`);
    }
    const key = flag.slice(2);

    if (key === "yes") {
      parsed.yes = true;
      continue;
    }

    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }
    switch (key) {
      case "action":
        if (!VALID_ACTIONS.includes(value as Action)) {
          throw new CLIError(
            `Invalid --action: ${value}. Must be: ${VALID_ACTIONS.join(", ")}`,
          );
        }
        parsed.action = value as Action;
        i++;
        break;
      case "comment-id":
        parsed.commentId = value;
        i++;
        break;
      case "message":
        parsed.message = value;
        i++;
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.action) throw new CLIError("Missing required argument: --action");
  if (!parsed.commentId) throw new CLIError("Missing required argument: --comment-id");
  if (parsed.action === "reply" && !parsed.message) {
    throw new CLIError("--message is required when --action=reply");
  }
  if (parsed.action === "delete" && !parsed.yes) {
    throw new CLIError(
      "Deleting a comment is destructive — pass --yes to confirm.",
    );
  }
  return parsed as CLIArgs;
}

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);

    const pageToken = process.env.FACEBOOK_PAGE_TOKEN;
    if (!pageToken) throw new CLIError("Missing FACEBOOK_PAGE_TOKEN. Run Facebook Login.ts first.");

    if (args.action === "reply") {
      console.log(`💬 Replying to IG comment ${args.commentId}...`);
      const response = await graph<{ id: string }>(`/${args.commentId}/replies`, {
        method: "POST",
        token: pageToken,
        params: { message: args.message! },
      });
      console.log(`✅ Reply posted`);
      console.log(`Reply ID: ${response.id}`);
    } else {
      console.log(`🗑️  Deleting IG comment ${args.commentId}...`);
      await graph<{ success: boolean }>(`/${args.commentId}`, {
        method: "DELETE",
        token: pageToken,
      });
      console.log(`✅ Comment deleted`);
    }
  } catch (error) {
    handleError(error);
  }
}

main();
