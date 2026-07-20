#!/usr/bin/env bun
/**
 * verify-urls - the actual URL-verification gate for Research citations.
 *
 * Research's headline value-prop is truth-grounding: "a single broken link is a
 * catastrophic failure." Until now that promise was enforced only by prose and
 * agent goodwill — there was ZERO URL-verification code. This module is the real,
 * tested, soft-failing gate.
 *
 * NAMING DISTINCTION (read this before reaching for the sibling file)
 * ------------------------------------------------------------------
 * The co-located `ResearchVaultGates.ts` is MISLEADINGLY NAMED. Despite "Vault"
 * in the filename, it does NOT gate URLs or vault files — it gates the
 * DeepInvestigation workflow's ENTITY FUNNEL (breadth/depth predicates over a
 * parsed `Entity[]`: thin-category detection, next-entity selection, the breadth
 * and depth gates, the iteration-state branch). It never touches a URL.
 *
 * THIS file (`verify-urls.ts`) is the actual URL gate. The two are siblings in
 * the same Tools/ directory and must not be confused. `ResearchVaultGates.ts` is
 * deliberately NOT renamed here (out of scope, and renaming a tested module is a
 * separate change) — this note exists so the distinction is documented in-place.
 *
 * DESIGN (mirrors the ResearchVaultGates verdict-shape family)
 * ------------------------------------------------------------
 * Same idiom as the sibling: a deterministic predicate plus a thin CLI slot,
 * oracle-tested. The only impure edge — the network call — is isolated behind an
 * injectable `FetchStatus` seam so the predicate stays pure and the tests stay
 * deterministic (no real network). The top-level verdict reuses the sibling's
 * string-union "verdict" idiom (`"verified" | "flagged"`, cf. `IterationPhase`)
 * rather than inventing a parallel verdict type system.
 *
 * SOFT-FAIL SEMANTICS
 * -------------------
 * A transient 403 / timeout / non-200 / malformed URL FLAGS that one URL
 * (status "flagged" + a reason) and annotates the manifest. It does NOT throw and
 * does NOT hard-abort the whole run — one bad citation never crashes the gate
 * (OoS-5). The verdict object distinguishes "all verified" from "N flagged"
 * structurally (`verdict`, `flagged` count) so a downstream Save step can read it.
 *
 * The process EXIT CODE encodes the same thing as an ADVISORY: a non-zero exit
 * when any URL is flagged, so an automated caller notices — but `--override`
 * (alias `--soft`) lets the operator deliberately proceed (exit 0) after seeing
 * the manifest. The manifest is always printed regardless of exit code.
 *
 * INGESTION (matches the sibling's JSON-in contract; the sibling reads argv, this
 * one additionally falls back to stdin so it composes in a pipe):
 *   echo '{"urls":["https://a","https://b"]}' | bun verify-urls.ts
 *   bun verify-urls.ts '{"urls":["https://a"]}'         # JSON as argv instead
 *   ... | bun verify-urls.ts --max-time 5               # per-URL curl timeout (s)
 *   ... | bun verify-urls.ts --override                 # proceed anyway (exit 0)
 * A bare top-level JSON array of URLs is also accepted.
 *
 * MANIFEST (stdout, pretty JSON):
 *   {
 *     "verdict": "verified" | "flagged",
 *     "total": N, "ok": N, "flagged": N,
 *     "urls": [ { "url", "status": "ok"|"flagged", "http_code", "reason"? }, ... ]
 *   }
 *
 * NOTE on content-type: ISC-19's canonical curl command
 * (`curl -s -o /dev/null -w "%{http_code}" -L --max-time <n> <url>`) discards the
 * body and returns only the status code, so the deterministic gate keys on the
 * HTTP 200 boundary. Content-type sanity would require widening the `FetchStatus`
 * seam to also carry `%{content_type}`; that is a documented extension point kept
 * out for now so the injected seam stays exactly `(url) => Promise<number>`.
 *
 * EXIT CODES
 * ----------
 *   0  all URLs verified (or empty list), OR flagged-but-overridden via --override
 *   1  CLI usage error / malformed JSON / input has no `urls` array
 *   2  ADVISORY: at least one URL flagged and --override was NOT passed (soft-fail)
 */

/** Per-URL verdict status. */
export type UrlStatus = "ok" | "flagged";

/** One verified citation URL. `reason` is present only for flagged URLs. */
export interface UrlVerdict {
  url: string;
  status: UrlStatus;
  http_code: number;
  reason?: string;
}

/**
 * Top-level gate verdict. Mirrors the sibling's string-union verdict idiom
 * (cf. `IterationPhase`): "verified" iff every URL is ok, otherwise "flagged".
 */
export type GateVerdict = "verified" | "flagged";

/** The per-URL pass/fail MANIFEST plus rolled-up counts (ISC-19). */
export interface VerificationManifest {
  verdict: GateVerdict;
  total: number;
  ok: number;
  flagged: number;
  urls: UrlVerdict[];
}

/**
 * The injectable network seam (ISC-22). Real implementation shells out to curl;
 * tests override it with a stub returning canned codes. A "no response"
 * (timeout / DNS failure / curl error) is represented as code 0.
 */
export type FetchStatus = (url: string) => Promise<number>;

/** Default per-URL curl timeout in seconds. */
export const DEFAULT_MAX_TIME_SEC = 10;

// ---------------------------------------------------------------------------
// Pure predicate — HTTP code -> verdict status (both sides of the 200 boundary)
// ---------------------------------------------------------------------------

/**
 * Classify a single HTTP status code. Exactly 200 is "ok"; everything else is
 * "flagged" with a human-readable reason. Code 0 is the "no response" sentinel
 * (timeout / DNS / curl error). PURE — no I/O, no throw.
 */
export function classifyCode(http_code: number): { status: UrlStatus; reason?: string } {
  if (http_code === 200) return { status: "ok" };
  if (http_code === 0) {
    return { status: "flagged", reason: "no-response (timeout / DNS / curl error)" };
  }
  return { status: "flagged", reason: `non-200 (HTTP ${http_code})` };
}

/**
 * Whether a string is a fetchable http(s) citation URL. Rejects non-strings,
 * unparseable strings, and non-http(s) schemes (e.g. `file:`, `javascript:`) —
 * the latter doubles as a safety guard before the value reaches the shell. PURE.
 */
export function isFetchableUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Roll a list of per-URL verdicts into the manifest. An empty list is
 * trivially "verified" (total 0) — the gate never blocks on zero citations.
 * PURE.
 */
export function buildManifest(urls: UrlVerdict[]): VerificationManifest {
  const flagged = urls.filter((u) => u.status === "flagged").length;
  const ok = urls.length - flagged;
  return {
    verdict: flagged === 0 ? "verified" : "flagged",
    total: urls.length,
    ok,
    flagged,
    urls,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator — soft-failing, never throws (ISC-21)
// ---------------------------------------------------------------------------

/**
 * Verify each citation URL through the injected `fetchStatus` seam and build the
 * manifest. Malformed / non-http(s) URLs are flagged WITHOUT calling the seam.
 * A throw from the seam is caught and treated as code 0 (no-response). One bad
 * URL flags only itself — the whole run never aborts. Returns a resolved
 * promise (no rejection) so callers can `await` without try/catch.
 */
export async function verifyUrls(
  urls: string[],
  fetchStatus: FetchStatus = makeCurlStatus(DEFAULT_MAX_TIME_SEC),
): Promise<VerificationManifest> {
  const results: UrlVerdict[] = [];
  for (const url of urls) {
    if (!isFetchableUrl(url)) {
      results.push({
        url: String(url),
        status: "flagged",
        http_code: 0,
        reason: "malformed-url (not a fetchable http/https URL)",
      });
      continue;
    }
    let code: number;
    try {
      code = await fetchStatus(url);
    } catch {
      code = 0;
    }
    const { status, reason } = classifyCode(code);
    results.push(reason ? { url, status, http_code: code, reason } : { url, status, http_code: code });
  }
  return buildManifest(results);
}

// ---------------------------------------------------------------------------
// Real network seam — curl (the only impure code in this module)
// ---------------------------------------------------------------------------

/**
 * Build the production `FetchStatus`. Shells out to the ISC-19 canonical curl
 * command via an args array (no shell, so the URL can't be injected):
 *   curl -s -o /dev/null -w "%{http_code}" -L --max-time <maxTimeSec> <url>
 * Returns the parsed HTTP code, or 0 when curl prints "000" / fails to spawn.
 */
export function makeCurlStatus(maxTimeSec: number): FetchStatus {
  return async (url: string): Promise<number> => {
    try {
      const proc = Bun.spawn(
        [
          "curl",
          "-s",
          "-o",
          "/dev/null",
          "-w",
          "%{http_code}",
          "-L",
          "--max-time",
          String(maxTimeSec),
          url,
        ],
        { stdout: "pipe", stderr: "ignore" },
      );
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      const code = parseInt(out.trim(), 10);
      return Number.isFinite(code) ? code : 0;
    } catch {
      return 0;
    }
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_FLAGGED_ADVISORY = 2;

interface CliArgs {
  jsonText: string;
  override: boolean;
  maxTime: number;
}

/** Parse flags + locate the JSON payload (argv arg, else stdin). */
async function collectArgs(argv: string[]): Promise<CliArgs> {
  let override = false;
  let maxTime = DEFAULT_MAX_TIME_SEC;
  let jsonArg: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--override" || a === "--soft") {
      override = true;
    } else if (a === "--max-time") {
      maxTime = parseInt(argv[++i] ?? "", 10) || DEFAULT_MAX_TIME_SEC;
    } else if (a.startsWith("--max-time=")) {
      maxTime = parseInt(a.slice("--max-time=".length), 10) || DEFAULT_MAX_TIME_SEC;
    } else if (!a.startsWith("--")) {
      jsonArg = a;
    }
  }

  const jsonText = jsonArg ?? (await Bun.stdin.text());
  return { jsonText, override, maxTime };
}

/** Extract a string[] of URLs from either a bare array or a `{urls:[...]}` object. */
function extractUrls(parsed: unknown): string[] | null {
  if (Array.isArray(parsed)) return parsed.map(String);
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { urls?: unknown }).urls)) {
    return ((parsed as { urls: unknown[] }).urls).map(String);
  }
  return null;
}

async function main(argv: string[]): Promise<number> {
  try {
    const { jsonText, override, maxTime } = await collectArgs(argv);
    const urls = extractUrls(JSON.parse(jsonText));
    if (urls === null) {
      process.stderr.write(
        "verify-urls: input must be a JSON array of URLs or an object with a 'urls' array.\n" +
          `Usage: echo '{"urls":["https://..."]}' | bun verify-urls.ts ` +
          `[--max-time <s>] [--override|--soft]\n`,
      );
      return EXIT_USAGE;
    }

    const manifest = await verifyUrls(urls, makeCurlStatus(maxTime));
    process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");

    if (manifest.flagged > 0 && !override) return EXIT_FLAGGED_ADVISORY;
    return EXIT_OK;
  } catch {
    process.stderr.write("verify-urls: malformed JSON input.\n");
    return EXIT_USAGE;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
