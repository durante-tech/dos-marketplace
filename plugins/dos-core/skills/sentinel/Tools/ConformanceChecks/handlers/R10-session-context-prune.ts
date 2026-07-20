/**
 * R10 — SessionEnd prune step for `next-session-context-*.md` >14d.
 *
 * §8.6.2 obligation: SessionEnd must proactively remove stale per-wing
 * snapshot files so they don't accumulate indefinitely. The reference
 * shape in SessionCleanup.hook.ts:157-208:
 *
 *   const SNAPSHOT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;  // 14 days
 *   function pruneStaleSnapshots(): void { … }
 *   … pruneStaleSnapshots();   // called from main flow
 *
 * Handler confirms both anchors in the configured SessionCleanup file:
 *   1. A `next-session-context-` literal (the file pattern being pruned)
 *   2. A day-threshold expression: `14 \* 24 \* 60 \* 60 \* 1000`, the
 *      equivalent `14 \* 86400000`, or `SNAPSHOT_MAX_AGE_MS` token
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const DEFAULT_FILE = "SessionCleanup.hook.ts";
const FILE_PATTERN_RE = /next-session-context-/;
const DAY_THRESHOLD_RE = /14\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000|14\s*\*\s*86400000|SNAPSHOT_MAX_AGE_MS/;

export async function r10SessionContextPrune(ctx: CheckContext): Promise<CheckResult> {
  const path = ctx.sessionCleanupPath ?? join(ctx.hooksRoot, DEFAULT_FILE);

  if (!existsSync(path)) {
    return {
      rId: "R10",
      requirement: "SessionEnd prune step for next-session-context-*.md >14d",
      status: "not_applicable",
      evidence: [`${path} not found — SessionCleanup hook not installed`],
    };
  }

  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch (err) {
    return {
      rId: "R10",
      requirement: "SessionEnd prune step for next-session-context-*.md >14d",
      status: "fail",
      evidence: [`${path} unreadable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const evidence: string[] = [];
  if (!FILE_PATTERN_RE.test(content)) {
    evidence.push(`${path}: no reference to \`next-session-context-\` snapshot pattern`);
  }
  if (!DAY_THRESHOLD_RE.test(content)) {
    evidence.push(`${path}: no 14-day threshold (looked for \`14 * 24 * 60 * 60 * 1000\` / \`14 * 86400000\` / \`SNAPSHOT_MAX_AGE_MS\`)`);
  }

  return {
    rId: "R10",
    requirement: "SessionEnd prune step for next-session-context-*.md >14d",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence: evidence.length === 0 ? [`${path}: snapshot pattern + 14-day threshold both present`] : evidence,
  };
}
