#!/usr/bin/env bun
/**
 * NextDispatchOrder — deterministic next-incremental `order:` resolver for the
 * dispatch pack.
 *
 * Extracted from WeeklyDispatch.md Step 5 prose (RFC-0126 section 9 B7
 * CLI-subcommand remediation). The frontmatter template hard-typed
 * `order: <next-incremental>`, leaving the agent to eyeball the existing posts and
 * pick "the next number" by hand each run. That is a deterministic transform of the
 * existing posts' `order:` values into max+1 (or 1 when the directory is empty), so
 * it lives in code with an oracle test rather than in prose where an off-by-one or a
 * mis-read frontmatter line can silently collide two posts on the same order.
 *
 * Split per the pattern guidance:
 *   - extractOrderFromFrontmatter() / nextDispatchOrder()  pure, oracle-tested
 *   - resolveNextDispatchOrder()                           thin filesystem I/O
 *
 * Usage (CLI):
 *   bun NextDispatchOrder.ts next <posts-dir>
 *     Scans <posts-dir> for *.mdoc files, reads each one's `order:` frontmatter
 *     value, and prints the next-incremental order (max existing order + 1, or 1
 *     when no post carries an order). Prints just the integer, no trailing prose.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * extractOrderFromFrontmatter — pull the integer `order:` value out of a single
 * post's text.
 *
 * Matches the first line of the form `order: <int>` (the frontmatter convention the
 * Dispatch workflows emit). Returns the parsed integer, or undefined when the post
 * carries no `order:` line or the value is not a base-10 integer. Tolerant of leading
 * whitespace and surrounding quotes so a post written `order: "3"` still parses.
 */
export function extractOrderFromFrontmatter(text: string): number | undefined {
  const m = text.match(/^\s*order:\s*"?(-?\d+)"?\s*$/m);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * nextDispatchOrder — pure max+1 over the existing order values.
 *
 * Returns the next-incremental order: the largest value in `orders` plus one, or 1
 * when `orders` is empty. This is the exact decision the prose left to the agent;
 * pinning it here removes the per-run off-by-one and collision risk.
 */
export function nextDispatchOrder(orders: number[]): number {
  if (orders.length === 0) return 1;
  return Math.max(...orders) + 1;
}

/**
 * resolveNextDispatchOrder — thin I/O: scan a posts directory and compute the next
 * order. Reads every `*.mdoc` file in `postsDir`, extracts its `order:` value, and
 * delegates the arithmetic to nextDispatchOrder(). A missing directory is treated as
 * empty (order 1) — the first dispatch in a fresh content tree.
 */
export function resolveNextDispatchOrder(postsDir: string): number {
  let entries: string[];
  try {
    entries = readdirSync(postsDir);
  } catch {
    return nextDispatchOrder([]);
  }
  const orders: number[] = [];
  for (const name of entries) {
    if (!name.endsWith(".mdoc")) continue;
    let text: string;
    try {
      text = readFileSync(join(postsDir, name), "utf8");
    } catch {
      continue;
    }
    const order = extractOrderFromFrontmatter(text);
    if (order !== undefined) orders.push(order);
  }
  return nextDispatchOrder(orders);
}

function printHelp(): void {
  console.log(`NextDispatchOrder — Dispatch next-incremental order resolver

USAGE
  bun NextDispatchOrder.ts next <posts-dir>

Scans <posts-dir> for *.mdoc files, reads each post's \`order:\` frontmatter value,
and prints the next-incremental order (max existing + 1, or 1 when empty).`);
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const sub = argv[0];
  if (sub !== "next") {
    console.error(`Error: unknown subcommand '${sub ?? ""}'. Expected: next`);
    process.exit(1);
  }
  const postsDir = argv[1];
  if (!postsDir || postsDir.startsWith("--")) {
    console.error("Error: next requires a <posts-dir> argument");
    process.exit(1);
  }
  console.log(String(resolveNextDispatchOrder(postsDir)));
}

if (import.meta.main) {
  main();
}
