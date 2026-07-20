/**
 * dlq-repair — Repair Adapter for idempotency-key drift (Feathers's Wrap Method).
 *
 * Provenance: PRD ISC-H4 (council 2026-05-05). Studio's inner-artifacts route
 * (and any other route still using `keyFrom: (b) => digestOfBody(parsed.data)`)
 * computes its idempotency key over the Zod-coerced body. Producer-side
 * `digestOfBody(body)` runs over the un-coerced body. When the body contains
 * a Date or other coerced field, the two digests diverge; Studio answers
 * `400 { error: "idempotency_key_mismatch", expected: <studio-digest> }`.
 *
 * Without an in-band repair, the 23,835 stranded inner-artifacts envelopes
 * would loop forever (or, post-bleed-stop, get quarantined as poison after
 * N=3). This module catches the 400 mid-flight, parses Studio's `expected`
 * digest out of the response body, builds a one-shot envelope with the
 * corrected key, and POSTs once via `postForDrain`. Any non-2xx outcome
 * declares the envelope unrepairable and lets the caller fall through to
 * the standard classifier.
 *
 * Design constraints (Feathers Wrap Method):
 *   - DO NOT mutate the on-disk envelope. The caller owns the .inflight
 *     file; repair operates on an in-memory clone.
 *   - DO NOT loop. Exactly one repair attempt per drain visit. If the
 *     `expected` field is missing or the parse fails, return unrepairable
 *     IMMEDIATELY so the standard classifier can do its job.
 *   - DO NOT touch `.attempts`. The caller's classifier already knows how
 *     to count; the repair branch is orthogonal.
 *
 * Scope: this module is the producer-time digest patch. The proper fix is
 * Stream S's "Studio routes digest rawBody, not parsed.data". When Stream S
 * lands, the 400 mismatch will stop happening for new envelopes; this
 * repair adapter remains as a defense-in-depth net for stranded queues
 * and future schema-coerce regressions.
 *
 * Public API:
 *   tryRepairAndRetry(envelope, failureBody, ctx)
 *     → { outcome: 'repaired'; status: number }
 *     → { outcome: 'unrepairable'; reason: string }
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EnvelopeV2 } from './dlq-envelope';
import { postForDrain } from './dlq-transport';

export type RepairOutcome =
  | { outcome: 'repaired'; status: number }
  | { outcome: 'unrepairable'; reason: string };

export interface RepairContext {
  endpoint: string;
  timeoutMs: number;
}

interface ParsedMismatch {
  error: string;
  expected?: string;
  received?: string;
}

// ─── W2-S3 ISC-6 — shape-validate Studio's `expected` before adopting ──
//
// W2-S1 D7: the adapter adopted Studio's `expected` verbatim — a Studio-side
// bug (or a poisoned response) could inject any byte sequence as the replay
// key. W2-S2 D12: a third 400-subclass exists (format-invalid legacy keys
// with `/`), so adopted keys must clear the gateway regex too. The contract
// ships next to this module; validation reads the same file the producers
// derive keys from, so the two surfaces cannot drift apart.

interface ContractShape {
  endpoints: Record<string, { schema?: string }>;
  header: { regex: string };
}

let _contract: ContractShape | null | undefined;

function loadContract(): ContractShape | null {
  if (_contract !== undefined) return _contract;
  try {
    _contract = JSON.parse(
      readFileSync(join(import.meta.dir, 'idempotency-keys.json'), 'utf-8'),
    ) as ContractShape;
  } catch {
    _contract = null;
  }
  return _contract;
}

/**
 * Returns null when `expected` is shape-valid for `endpoint`, else a
 * machine-stable unrepairable reason. Conservative: any contract-read or
 * lookup failure declines the repair (the standard classifier takes over).
 */
function validateExpectedShape(endpoint: string, expected: string): string | null {
  const contract = loadContract();
  if (!contract) return 'contract-unavailable';
  const row = contract.endpoints[endpoint];
  if (!row?.schema) return 'endpoint-not-in-contract';
  let regex: RegExp;
  try {
    regex = new RegExp(contract.header.regex);
  } catch {
    return 'contract-regex-invalid';
  }
  if (!regex.test(expected)) return 'expected-shape-invalid:regex';
  const prefix = row.schema.slice(0, row.schema.indexOf('{'));
  if (prefix.length > 0 && !expected.startsWith(prefix)) {
    return 'expected-shape-invalid:prefix';
  }
  return null;
}

/**
 * Parse Studio's idempotency-mismatch response body. Returns null on any
 * shape deviation so the caller treats it as unrepairable rather than
 * silently misbehaving on unexpected payloads.
 */
function parseMismatchBody(failureBody: string): ParsedMismatch | null {
  if (typeof failureBody !== 'string' || failureBody.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(failureBody);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.error !== 'string') return null;
  return {
    error: o.error,
    expected: typeof o.expected === 'string' ? o.expected : undefined,
    received: typeof o.received === 'string' ? o.received : undefined,
  };
}

/**
 * One-shot repair-and-retry for `idempotency_key_mismatch` 400 responses.
 *
 * Returns `{ outcome: 'repaired', status }` on a 2xx replay (the on-disk
 * envelope can then be unlinked by the caller). Returns
 * `{ outcome: 'unrepairable', reason }` on every other path — malformed
 * body, missing `expected`, error category not "idempotency_key_mismatch",
 * non-2xx replay, or transport error.
 *
 * IMPORTANT: this function performs exactly one network call. No internal
 * loop. The caller is responsible for not re-invoking it on the same
 * envelope within the same drain pass.
 */
export async function tryRepairAndRetry(
  envelope: EnvelopeV2,
  failureBody: string,
  ctx: RepairContext,
): Promise<RepairOutcome> {
  const parsed = parseMismatchBody(failureBody);
  if (!parsed) {
    return { outcome: 'unrepairable', reason: 'body-not-json-or-missing-error' };
  }
  if (parsed.error !== 'idempotency_key_mismatch') {
    return { outcome: 'unrepairable', reason: `error-not-mismatch:${parsed.error}` };
  }
  if (!parsed.expected) {
    return { outcome: 'unrepairable', reason: 'missing-expected-digest' };
  }
  const shapeError = validateExpectedShape(ctx.endpoint, parsed.expected);
  if (shapeError) {
    return { outcome: 'unrepairable', reason: shapeError };
  }

  // In-memory clone — DO NOT mutate caller's envelope. The on-disk
  // .inflight file remains the canonical record so a crash mid-repair
  // leaves the envelope re-driveable by the next drainer.
  const repaired: EnvelopeV2 = {
    ...envelope,
    idempotencyKey: parsed.expected,
  };

  const res = await postForDrain(ctx.endpoint, repaired, ctx.timeoutMs);
  if ('error' in res) {
    return { outcome: 'unrepairable', reason: `transport:${res.error}` };
  }
  if (res.status >= 200 && res.status < 300) {
    return { outcome: 'repaired', status: res.status };
  }
  return { outcome: 'unrepairable', reason: `replay-status-${res.status}` };
}
