#!/usr/bin/env bun
/**
 * LogArtifact — deterministic artifact-log JSONL render-helper for the dispatch pack.
 *
 * Extracted from WeeklyDispatch.md Step 6 prose (RFC-0126 section 9 B1 render-family
 * remediation). The workflow previously hand-typed a `echo '{...}' >> artifacts.jsonl`
 * template that interpolated timestamp / title / path / sessionId into a single JSONL
 * line. That shell template is a deterministic transform of structured data into an
 * exact line of markdown-adjacent output, so it lives in code with a golden test
 * rather than in prose where the key order or comma placement can drift per run.
 *
 * renderArtifactLine() returns the EXACT bytes the original echo produced for plain
 * ASCII field values: the same key order
 *   timestamp, pack, workflow, type, title, path, wing, sessionId
 * the same `"key":"value"` spacing (none), the same comma joins, and NO trailing
 * newline (the caller / `>>` append adds the line break). Byte-parity with the prose
 * template is pinned by LogArtifact.test.ts.
 *
 * Usage (CLI):
 *   bun LogArtifact.ts render <title> <path> [--workflow W] [--type T] [--wing G]
 *                                            [--timestamp ISO] [--session ID]
 *     Prints the single artifact JSONL line to stdout (no trailing newline beyond
 *     the shell's own). Defaults match WeeklyDispatch: workflow=WeeklyDispatch,
 *     type=blog-post, wing=durante. timestamp defaults to `date -u +%Y-%m-%dT%H:%M:%SZ`
 *     (UTC, second precision); session defaults to $CLAUDE_SESSION_ID.
 */

export interface ArtifactLogFields {
  /** ISO-8601 UTC, second precision — matches `date -u +%Y-%m-%dT%H:%M:%SZ`. */
  timestamp: string;
  pack: string;
  workflow: string;
  type: string;
  title: string;
  /** Absolute path to the produced artifact (the .mdoc). */
  path: string;
  wing: string;
  sessionId: string;
}

/**
 * renderArtifactLine — pure render of a single artifacts.jsonl line.
 *
 * Reproduces the WeeklyDispatch Step 6 echo template byte-for-byte for plain ASCII
 * values: fixed key order, no inter-key spacing, no trailing newline, no
 * contentPreview key (the prose template omitted it). Field values are inserted raw
 * exactly as the shell single-quote concatenation did — the caller is responsible for
 * passing JSON-safe values, mirroring the original prose contract.
 */
export function renderArtifactLine(fields: ArtifactLogFields): string {
  return (
    `{"timestamp":"${fields.timestamp}",` +
    `"pack":"${fields.pack}",` +
    `"workflow":"${fields.workflow}",` +
    `"type":"${fields.type}",` +
    `"title":"${fields.title}",` +
    `"path":"${fields.path}",` +
    `"wing":"${fields.wing}",` +
    `"sessionId":"${fields.sessionId}"}`
  );
}

// WeeklyDispatch defaults — the constants the echo template hard-coded.
export const DISPATCH_PACK = "Dispatch";
export const WEEKLY_DISPATCH_WORKFLOW = "WeeklyDispatch";
export const WEEKLY_DISPATCH_TYPE = "blog-post";
export const DISPATCH_WING = "durante";

/** Current UTC timestamp at second precision — matches `date -u +%Y-%m-%dT%H:%M:%SZ`. */
export function utcTimestampSeconds(now: Date = new Date()): string {
  // toISOString() yields millisecond precision (…:SS.mmmZ); strip to seconds to match
  // the shell `date -u +%Y-%m-%dT%H:%M:%SZ` template exactly.
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseFlag(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

function printHelp(): void {
  console.log(`LogArtifact — Dispatch artifact-log JSONL render-helper

USAGE
  bun LogArtifact.ts render <title> <path> [options]

OPTIONS
  --workflow W     workflow name (default: ${WEEKLY_DISPATCH_WORKFLOW})
  --type T         artifact type (default: ${WEEKLY_DISPATCH_TYPE})
  --wing G         wing (default: ${DISPATCH_WING})
  --timestamp ISO  ISO-8601 UTC second-precision (default: now, UTC)
  --session ID     session id (default: $CLAUDE_SESSION_ID)

Prints one artifacts.jsonl line. Append it yourself, e.g.:
  bun LogArtifact.ts render "<title>" "<path>" >> "$ARTIFACTS_DIR/artifacts.jsonl"`);
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const sub = argv[0];
  if (sub !== "render") {
    console.error(`Error: unknown subcommand '${sub ?? ""}'. Expected: render`);
    process.exit(1);
  }
  const title = argv[1];
  const path = argv[2];
  if (!title || !path || title.startsWith("--") || path.startsWith("--")) {
    console.error("Error: render requires positional <title> <path> arguments");
    process.exit(1);
  }
  const line = renderArtifactLine({
    timestamp: parseFlag(argv, "--timestamp") ?? utcTimestampSeconds(),
    pack: DISPATCH_PACK,
    workflow: parseFlag(argv, "--workflow") ?? WEEKLY_DISPATCH_WORKFLOW,
    type: parseFlag(argv, "--type") ?? WEEKLY_DISPATCH_TYPE,
    title,
    path,
    wing: parseFlag(argv, "--wing") ?? DISPATCH_WING,
    sessionId: parseFlag(argv, "--session") ?? process.env.CLAUDE_SESSION_ID ?? "",
  });
  console.log(line);
}

if (import.meta.main) {
  main();
}
