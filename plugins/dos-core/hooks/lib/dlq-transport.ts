/**
 * dlq-transport — transport concern for the Studio sync DLQ
 *
 * Phase-4 sprout from dlq.ts. Owns the transport concern: postDirect (HTTP POST
 * with auth + gzip + Retry-After honoring + circuit-break delegation), postForDrain
 * (drain-local POST that returns Retry-After without auto-sleep), parseRetryAfter
 * (RFC 7231 + integer), applyJitter (±10%), fallbackDirectPost (bootstrap-missing
 * with one-shot operator hint).
 *
 * Re-exported by dlq.ts for back-compat — dlq.test.ts imports `parseRetryAfter`,
 * `applyJitter`, and accesses `__internals.postDirect` + `__internals.GZIP_MIN_BYTES`,
 * all of which the shim preserves.
 *
 * Provenance: dlq.ts §postDirect / §postForDrain / §Retry-After honoring (U-G3c) +
 * §Gzip threshold (U-G5) + §bootstrap-missing operator hint (ISC-33..37). Carve
 * performed under Feathers's "smallest carve, re-export shim" prescription +
 * Fowler's Extract Module refactoring (Phase-4 Cluster T, ISC-8..ISC-15 in
 * studio-sync-resilience.md).
 *
 * Circuit-state decoupling (recommended option (a) from Cluster T spec): the
 * network/retry mechanics here are pure with respect to CIRCUIT_STATE — postDirect
 * and postForDrain only return status (and retryAfterSeconds for postForDrain).
 * trip429Circuit, handlePostSuccess, and CIRCUIT_STATE itself remain in dlq.ts as
 * drain-orchestration concerns. This file imports zero circuit symbols.
 *
 * Public API:
 *   postDirect(endpoint, envelope, timeoutMs)         — direct POST with auto-sleep on 429
 *   postForDrain(endpoint, envelope, timeoutMs)       — drain POST that returns Retry-After
 *   parseRetryAfter(value, now)                       — RFC 7231 §7.1.3 parser
 *   applyJitter(ms, rand?)                            — ±10% symmetric jitter
 *   fallbackDirectPost(args)                          — bootstrap-missing fallback path
 *   gzipEnabled()                                     — env-gated gzip toggle
 *   GZIP_MIN_BYTES                                    — 64 KiB threshold constant
 *   __resetBootstrapMissingForTests()                 — test-only sentinel reset
 *
 * Types:
 *   PostResult                                        — postDirect return shape
 *   PostForDrainResult                                — postForDrain return shape
 *   FallbackDirectPostArgs                            — fallbackDirectPost input shape
 *   FallbackDirectPostResult                          — fallbackDirectPost return shape
 */

import { gzipSync } from 'node:zlib';

import { canonicalJson } from './dlq-envelope';
import type { EnvelopeV2 } from './dlq-envelope';
// Type-only import keeps the cycle erased at runtime — dlq.ts imports values
// from this module; this module only references DLQTool as a type.
import type { DLQTool } from './dlq';

// ─────────────────────────────────────────────────────────────────────
// Gzip threshold — U-G5 / Wave-0
// ─────────────────────────────────────────────────────────────────────
//
// Request bodies whose UTF-8 serialized size exceeds GZIP_MIN_BYTES are
// gzip-wrapped by postDirect() and annotated with `Content-Encoding: gzip`
// before hitting the Studio gateway. The server-side companion is
// `apps/web/lib/gateway/compression.ts → readJsonWithOptionalGzip(request)`
// which reverses the wrap before Zod parse. Threshold comes from the
// parent PRD (Studio sync queue architecture, §Work units U-G5) and
// represents the rough break-even for gzip overhead on typical JSON.
// Non-gzipped bodies keep the existing Content-Type-only header set.
//
// HOLD 2026-04-27 — set DOS_DLQ_GZIP=off in .gateway.env to disable
// client-side gzip until readJsonWithOptionalGzip is wired into the
// five aggregate routes (/api/v1/{plans,sessions,memory/snapshots,
// hooks/metrics,kg/sync}). Reproduced: identical 87 KiB payload returns
// 201 without gzip, 400 "Invalid request body" with `Content-Encoding:
// gzip`. Threshold constant stays load-bearing for ISC tests; only the
// runtime apply path is gated.

export const GZIP_MIN_BYTES = 64 * 1024;

export function gzipEnabled(): boolean {
  return process.env.DOS_DLQ_GZIP !== 'off';
}

// ─────────────────────────────────────────────────────────────────────
// Retry-After honoring — U-G3c
//
// When Studio returns 429, `postDirect` parses the `Retry-After` response
// header per RFC 7231 §7.1.3 (integer seconds OR IMF-fixdate HTTP-date),
// applies ±10% symmetric jitter, caps the wait at
// DOS_DLQ_RETRY_AFTER_MAX_MS, and sleeps before returning the 429 status.
//
// Non-429 responses ignore the header entirely.
// Malformed / missing header on 429 → DOS_DLQ_RETRY_AFTER_DEFAULT_MS.
//
// Envelope-level scope: the pause applies to the CURRENT `postDirect`
// invocation; caller-level requeue logic (queueOrPost + drainQueueDir)
// is untouched. Circuit-breaking across envelopes is U-G3d's concern.
// ─────────────────────────────────────────────────────────────────────

const RETRY_AFTER_DEFAULT_MS_FALLBACK = 60_000;
const RETRY_AFTER_MAX_MS_FALLBACK = 120_000;

/**
 * Parse an HTTP `Retry-After` header value into milliseconds.
 *
 * Accepts:
 *   - non-negative integer seconds (`"30"`, `"0"`).
 *   - HTTP-date per RFC 7231 §7.1.3 (IMF-fixdate, RFC 850, asctime —
 *     all three handled transparently by `Date.parse`).
 *
 * Returns:
 *   - ms to wait (>= 0; past HTTP-date clamps to 0).
 *   - `null` on null/undefined/empty/negative/malformed input (caller
 *     should fall back to DOS_DLQ_RETRY_AFTER_DEFAULT_MS).
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now: number,
): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Integer-seconds form. `^\d+$` forbids leading sign, decimals, exponents.
  if (/^\d+$/.test(trimmed)) {
    const secs = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(secs) || secs < 0) return null;
    return secs * 1000;
  }

  // Reject numeric-looking tokens that failed the integer test (signed,
  // decimal, exponent). Without this guard, `Date.parse('-5')` happily
  // returns a year-0005-BC epoch on some V8 builds, silently crediting
  // the caller with a multi-billion-ms wait instead of falling back.
  if (/^[+\-]?\d/.test(trimmed) || /^[+\-]?\.\d/.test(trimmed)) {
    return null;
  }

  // HTTP-date form. Date.parse returns NaN on malformed.
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  const delta = parsed - now;
  return delta > 0 ? delta : 0;
}

/**
 * Apply symmetric ±10% jitter to a duration.
 *
 * Uniform in `[0.9 * ms, 1.1 * ms]`. Result is non-negative and
 * rounded to whole ms (setTimeout-friendly). `rand` defaults to
 * `Math.random`; tests inject a deterministic generator.
 */
export function applyJitter(
  ms: number,
  rand: () => number = Math.random,
): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const factor = 0.9 + 0.2 * rand();
  return Math.max(0, Math.round(ms * factor));
}

export function retryAfterDefaultMs(): number {
  const env = process.env.DOS_DLQ_RETRY_AFTER_DEFAULT_MS;
  if (env === undefined) return RETRY_AFTER_DEFAULT_MS_FALLBACK;
  const n = Number(env);
  return Number.isFinite(n) && n >= 0 ? n : RETRY_AFTER_DEFAULT_MS_FALLBACK;
}

export function retryAfterMaxMs(): number {
  const env = process.env.DOS_DLQ_RETRY_AFTER_MAX_MS;
  if (env === undefined) return RETRY_AFTER_MAX_MS_FALLBACK;
  const n = Number(env);
  return Number.isFinite(n) && n >= 0 ? n : RETRY_AFTER_MAX_MS_FALLBACK;
}

function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────
// postDirect — direct POST with auto-sleep on 429
// ─────────────────────────────────────────────────────────────────────

export type PostResult = { status: number } | { error: string };

export async function postDirect(
  endpoint: string,
  envelope: EnvelopeV2,
  timeoutMs: number,
): Promise<PostResult> {
  const url = process.env.STUDIO_API_URL;
  const key = process.env.STUDIO_API_KEY;
  if (!url || !key) return { error: 'studio-creds-missing' };

  // U-G5: gzip-wrap bodies larger than GZIP_MIN_BYTES (64 KiB). Surgical —
  // only the body + Content-Encoding header change. All other headers,
  // the AbortController signal, and the method/URL are unchanged so the
  // parallel U-G3c (Retry-After) edit can merge without conflict.
  //
  // hooks-015 — serialize with canonicalJson (key-sorted), the SAME basis
  // digestOfBody hashes for the Idempotency-Key. The wire bytes Studio
  // receives then hash to the producer's key (Studio hashes rawBody per the
  // Idempotency-Key digest contract). Plain JSON.stringify preserves insertion
  // order, so a key that wasn't already sorted diverged from the producer
  // digest → 400 idempotency_key_mismatch + an extra repair round-trip.
  const bodyJson = canonicalJson(envelope.payload);
  const bodyBytes = Buffer.byteLength(bodyJson, 'utf-8');
  const shouldGzip = gzipEnabled() && bodyBytes > GZIP_MIN_BYTES;
  const fetchBody: string | Uint8Array<ArrayBuffer> = shouldGzip
    ? new Uint8Array(gzipSync(Buffer.from(bodyJson, 'utf-8')))
    : bodyJson;

  const ac = new AbortController();
  const tId = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(endpoint, url).toString(), {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(envelope.idempotencyKey ? { 'Idempotency-Key': envelope.idempotencyKey } : {}),
        ...(envelope.correlationId ? { 'x-dos-correlation-id': envelope.correlationId } : {}),
        ...(envelope.projectSlug ? { 'x-dos-project-slug': envelope.projectSlug } : {}),
        ...(shouldGzip ? { 'Content-Encoding': 'gzip' } : {}),
      },
      body: fetchBody,
    });
    clearTimeout(tId);

    // Retry-After honoring — applies ONLY to 429. Other non-2xx status
    // codes propagate to the caller without any artificial pause.
    if (res.status === 429) {
      const headerValue = res.headers.get('retry-after');
      const parsed = parseRetryAfter(headerValue, Date.now());
      const baseMs = parsed ?? retryAfterDefaultMs();
      const jittered = applyJitter(baseMs);
      const capped = Math.min(jittered, retryAfterMaxMs());
      await sleepMs(capped);
    }

    return { status: res.status };
  } catch (err) {
    clearTimeout(tId);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// postForDrain — U-G3d drain-local POST that returns Retry-After
//
// Parallels postDirect's request-side logic (headers, gzip, envelope
// serialization) but does NOT auto-sleep on 429. The raw Retry-After
// seconds value is returned so drainQueueDir can compute resumeAt for
// the per-tool circuit state. Non-429 responses ignore the header.
// ─────────────────────────────────────────────────────────────────────

export type PostForDrainResult =
  | { status: number; retryAfterSeconds?: number }
  | { error: string };

/**
 * Drain-time POST result that ALSO carries the response body so the drainer
 * can run the Repair Adapter (PRD ISC-H4). Mirrors postForDrain's success/
 * error union; success branch adds `body: string` (raw, possibly empty).
 *
 * Body capture is best-effort: if `res.text()` throws (e.g. truncated),
 * the field is set to the empty string and the caller treats it as
 * unrepairable. We do not re-classify the network call; status drives
 * the bucket, body is auxiliary.
 */
export type PostForDrainWithBodyResult =
  | { status: number; retryAfterSeconds?: number; body: string }
  | { error: string };

export async function postForDrain(
  endpoint: string,
  envelope: EnvelopeV2,
  timeoutMs: number,
): Promise<PostForDrainResult> {
  const url = process.env.STUDIO_API_URL;
  const key = process.env.STUDIO_API_KEY;
  if (!url || !key) return { error: 'studio-creds-missing' };

  // Mirror postDirect's body encoding (U-G5 gzip >64KiB) AND its hooks-015
  // canonicalJson wire basis so drain-time POSTs hash to the producer's
  // Idempotency-Key (Studio hashes rawBody).
  const bodyJson = canonicalJson(envelope.payload);
  const bodyBytes = Buffer.byteLength(bodyJson, 'utf-8');
  const shouldGzip = gzipEnabled() && bodyBytes > GZIP_MIN_BYTES;
  const fetchBody: string | Uint8Array<ArrayBuffer> = shouldGzip
    ? new Uint8Array(gzipSync(Buffer.from(bodyJson, 'utf-8')))
    : bodyJson;

  const ac = new AbortController();
  const tId = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(endpoint, url).toString(), {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(envelope.idempotencyKey ? { 'Idempotency-Key': envelope.idempotencyKey } : {}),
        ...(envelope.correlationId ? { 'x-dos-correlation-id': envelope.correlationId } : {}),
        ...(envelope.projectSlug ? { 'x-dos-project-slug': envelope.projectSlug } : {}),
        ...(shouldGzip ? { 'Content-Encoding': 'gzip' } : {}),
      },
      body: fetchBody,
    });
    clearTimeout(tId);

    let retryAfterSeconds: number | undefined;
    if (res.status === 429) {
      const headerValue = res.headers.get('retry-after');
      const parsedMs = parseRetryAfter(headerValue, Date.now());
      if (parsedMs !== null) {
        retryAfterSeconds = Math.max(1, Math.min(600, Math.ceil(parsedMs / 1000)));
      }
    }

    return { status: res.status, retryAfterSeconds };
  } catch (err) {
    clearTimeout(tId);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// postForDrainWithBody — variant that captures response body for repair
//
// PRD ISC-H4 — the drain-side Repair Adapter (dlq-repair.ts) needs the
// response body (e.g. `{"error":"idempotency_key_mismatch","expected":"…"}`)
// to compute the corrected idempotency key on a 400. The original
// postForDrain throws away the body for footprint reasons (drains
// process tens of thousands of envelopes per cycle and never read it
// before). This sibling mirrors postForDrain's behavior exactly except
// it always reads body via res.text() once, returning it on the success
// branch. Errors stay error-only — no body to ship if the call never
// completed. Body capture is best-effort: any exception in res.text()
// degrades to body:'' (treated as unrepairable by the caller).
// ─────────────────────────────────────────────────────────────────────

export async function postForDrainWithBody(
  endpoint: string,
  envelope: EnvelopeV2,
  timeoutMs: number,
): Promise<PostForDrainWithBodyResult> {
  const url = process.env.STUDIO_API_URL;
  const key = process.env.STUDIO_API_KEY;
  if (!url || !key) return { error: 'studio-creds-missing' };

  // hooks-015 — canonicalJson wire basis (matches digestOfBody) so the
  // body Studio re-hashes equals the producer's Idempotency-Key digest.
  const bodyJson = canonicalJson(envelope.payload);
  const bodyBytes = Buffer.byteLength(bodyJson, 'utf-8');
  const shouldGzip = gzipEnabled() && bodyBytes > GZIP_MIN_BYTES;
  const fetchBody: string | Uint8Array<ArrayBuffer> = shouldGzip
    ? new Uint8Array(gzipSync(Buffer.from(bodyJson, 'utf-8')))
    : bodyJson;

  const ac = new AbortController();
  const tId = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(endpoint, url).toString(), {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(envelope.idempotencyKey ? { 'Idempotency-Key': envelope.idempotencyKey } : {}),
        ...(envelope.correlationId ? { 'x-dos-correlation-id': envelope.correlationId } : {}),
        ...(envelope.projectSlug ? { 'x-dos-project-slug': envelope.projectSlug } : {}),
        ...(shouldGzip ? { 'Content-Encoding': 'gzip' } : {}),
      },
      body: fetchBody,
    });
    clearTimeout(tId);

    let retryAfterSeconds: number | undefined;
    if (res.status === 429) {
      const headerValue = res.headers.get('retry-after');
      const parsedMs = parseRetryAfter(headerValue, Date.now());
      if (parsedMs !== null) {
        retryAfterSeconds = Math.max(1, Math.min(600, Math.ceil(parsedMs / 1000)));
      }
    }

    let bodyText: string;
    try {
      bodyText = await res.text();
    } catch {
      bodyText = '';
    }

    return { status: res.status, retryAfterSeconds, body: bodyText };
  } catch (err) {
    clearTimeout(tId);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// fallbackDirectPost — bootstrap-missing one-shot operator hint
//
// ISC-33..37 — operator-visible hint for bootstrap-missing fallback. The
// caller-side drift log is machine-readable but lives in JSONL files
// operators rarely tail. The empty-Studio-dashboard symptom needs a hint
// at fallback time. One-shot per process; subprocesses each get their own
// (acceptable per the parent PRD's risk note).
//
// The sentinel `_bootstrapMissingNotified` is module-scope; subprocesses
// don't share it, which is the desired UX for the ~16 detached sync-tool
// children. dlq.ts's __internals.__resetBootstrapMissingForTests is wired
// to this module's reset helper to keep test isolation working.
// ─────────────────────────────────────────────────────────────────────

let _bootstrapMissingNotified = false;

export function __resetBootstrapMissingForTests(): void {
  _bootstrapMissingNotified = false;
}

export interface FallbackDirectPostArgs {
  /** Tool name — used in the operator-hint stderr line. */
  tool: DLQTool;
  /** MEMORY/{subdir} for the tool — surfaced in the operator hint. */
  toolSubdir: string;
  /** Studio API endpoint to POST to. */
  endpoint: string;
  /** Wrapped envelope. postDirect serializes envelope.payload only. */
  envelope: EnvelopeV2;
  /** Per-call timeout in ms. */
  timeoutMs: number;
}

export type FallbackDirectPostResult =
  | { outcome: 'posted'; status: number }
  | { outcome: 'dropped'; reason: 'bootstrap-missing' };

export async function fallbackDirectPost(
  args: FallbackDirectPostArgs,
): Promise<FallbackDirectPostResult> {
  if (!_bootstrapMissingNotified) {
    _bootstrapMissingNotified = true;
    console.error(
      `[dlq] bootstrap-missing for tool="${args.tool}" — ` +
      `MEMORY/${args.toolSubdir}/.pending/ does not exist. ` +
      `Run /sentinel scan to recreate the project's MEMORY structure. ` +
      `Falling back to direct POST (no DLQ retry safety).`,
    );
  }
  const res = await postDirect(args.endpoint, args.envelope, args.timeoutMs);
  if ('status' in res && res.status >= 200 && res.status < 300) {
    return { outcome: 'posted', status: res.status };
  }
  return { outcome: 'dropped', reason: 'bootstrap-missing' };
}
