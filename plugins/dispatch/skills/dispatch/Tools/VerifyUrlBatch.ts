#!/usr/bin/env bun
/**
 * VerifyUrlBatch — deterministic URL-verification helper for the dispatch pack.
 *
 * Extracted from WeeklyDispatch.md Step 4 prose (RFC-0126 section 9 B8 remediation).
 * The workflow hand-typed a per-link curl one-liner
 *   curl -s -o /dev/null -w "%{http_code}" -L "URL"   # Must return 200
 * and left the agent to read the status code and decide pass/fail per URL. Two parts
 * of that are deterministic and belong in tested code:
 *   - buildVerifyCommand(url)  the exact curl argv (flags + redirect-follow)
 *   - isUrlVerified(httpCode)  the pass/fail predicate (200 passes, all else drops)
 * The network round-trip itself is non-deterministic I/O and stays thin
 * (verifyUrl / verifyUrlBatch spawn curl); only the command shape and the
 * accept/reject decision are pinned by the oracle test.
 *
 * Usage (CLI):
 *   bun VerifyUrlBatch.ts verify <url> [<url> ...]
 *     Verifies each URL via curl and prints `PASS <code> <url>` or `FAIL <code> <url>`
 *     per line; exits non-zero if any URL fails (so a load-bearing link can gate).
 */

/**
 * The curl flags the prose template used, factored out so the command shape is fixed
 * in one place: silent, discard body, emit only the HTTP status, follow redirects.
 */
export const VERIFY_CURL_FLAGS = ["-s", "-o", "/dev/null", "-w", "%{http_code}", "-L"];

/** The single HTTP status the prose accepted ("# Must return 200"). */
export const VERIFIED_HTTP_CODE = 200;

export interface UrlVerifyResult {
  url: string;
  /** Parsed HTTP status, or 0 when curl produced no usable code (network failure). */
  httpCode: number;
  verified: boolean;
}

/**
 * isUrlVerified — pure pass/fail predicate matching the prose "Must return 200".
 *
 * Returns true only for HTTP 200; every other code (3xx after the -L follow resolves,
 * 4xx, 5xx, or 0 for a network failure) is a drop. Both sides of the 200 boundary are
 * pinned by the oracle test.
 */
export function isUrlVerified(httpCode: number): boolean {
  return httpCode === VERIFIED_HTTP_CODE;
}

/**
 * buildVerifyCommand — pure construction of the curl argv for one URL.
 *
 * Returns ["curl", ...VERIFY_CURL_FLAGS, url] — the exact command the prose hand-typed,
 * with the URL passed as a discrete argv element (not string-interpolated) so it is
 * never re-parsed by a shell. Pinning the argv here removes the per-run transcription
 * risk of a dropped flag.
 */
export function buildVerifyCommand(url: string): string[] {
  return ["curl", ...VERIFY_CURL_FLAGS, url];
}

/** Parse curl's `%{http_code}` stdout into an integer; 0 when unparseable/empty. */
export function parseHttpCode(stdout: string): number {
  const n = Number.parseInt(stdout.trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * verifyUrl — thin I/O: spawn curl for one URL, return the structured verdict.
 * Pure decisioning (command shape + pass/fail) is delegated to the tested helpers.
 */
async function verifyUrl(url: string): Promise<UrlVerifyResult> {
  const [cmd, ...args] = buildVerifyCommand(url);
  let httpCode = 0;
  try {
    const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "ignore" });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    httpCode = parseHttpCode(out);
  } catch {
    httpCode = 0;
  }
  return { url, httpCode, verified: isUrlVerified(httpCode) };
}

/** verifyUrlBatch — verify a list of URLs sequentially, returning all verdicts. */
export async function verifyUrlBatch(urls: string[]): Promise<UrlVerifyResult[]> {
  const results: UrlVerifyResult[] = [];
  for (const url of urls) results.push(await verifyUrl(url));
  return results;
}

function printHelp(): void {
  console.log(`VerifyUrlBatch — Dispatch URL-verification helper

USAGE
  bun VerifyUrlBatch.ts verify <url> [<url> ...]

Verifies each URL via curl (-sL, status only). Prints one line per URL:
  PASS <code> <url>   when the URL returns HTTP 200
  FAIL <code> <url>   otherwise (drop the link or find an alternative source)
Exits non-zero if any URL fails.`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const sub = argv[0];
  if (sub !== "verify") {
    console.error(`Error: unknown subcommand '${sub ?? ""}'. Expected: verify`);
    process.exit(1);
  }
  const urls = argv.slice(1).filter((a) => !a.startsWith("--"));
  if (urls.length === 0) {
    console.error("Error: verify requires at least one <url> argument");
    process.exit(1);
  }
  const results = await verifyUrlBatch(urls);
  let anyFailed = false;
  for (const r of results) {
    if (!r.verified) anyFailed = true;
    console.log(`${r.verified ? "PASS" : "FAIL"} ${r.httpCode} ${r.url}`);
  }
  process.exit(anyFailed ? 1 : 0);
}

if (import.meta.main) {
  void main();
}
