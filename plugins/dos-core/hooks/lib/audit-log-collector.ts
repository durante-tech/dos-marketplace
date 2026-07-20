/**
 * Bridge action audit log — RFC-0075 Phase 0.5 (V11.7).
 *
 * Every MemPalace bridge action invocation appends one JSON line to
 * `~/.claude/MEMORY/STATE/bridge-actions.jsonl`. Data accumulates ≥7 days
 * to establish the p50/p95/p99 latency baseline that Phase 1 (the
 * persistent daemon) is measured against.
 *
 * Contract (one line per call):
 *   { ts, action, args_hash, latency_ms, result_status, session_id, caller_hook? }
 *
 *   - ts            — ISO8601 timestamp, write-time
 *   - action        — bridge action name (e.g. "search", "kg_query")
 *   - args_hash     — first 16 hex chars of sha256 over the JSON of args with
 *                     TOP-LEVEL keys sorted (see hashArgs) — so the hash is
 *                     insertion-order-insensitive at the top level, matching the
 *                     Python bridge's _hash_args. (Nested objects are NOT
 *                     recurse-sorted on either side; both preserve nested
 *                     insertion order identically, so same-shape calls agree.)
 *                     short enough to grep, long enough to disambiguate
 *                     ~50-100 distinct invocation shapes per session
 *   - latency_ms    — wall-clock duration of the bridge call in ms
 *   - result_status — 'ok' | 'error' | 'degraded' | 'fire-and-forget'
 *   - session_id    — DOS_SESSION_ID || CLAUDE_SESSION_ID || null
 *   - caller_hook   — optional; carried through from observed-bridge-worker
 *                     and (future) hookRunner-tagged callers
 *
 * Schema chosen to satisfy two specs:
 *   1. RFC-0075 §0.5: { action, args_hash, duration_ms, status, caller_hook }
 *   2. V11.7 prompt:  { ts, action, args_hash, latency_ms, result_status, session_id }
 *
 * The implementation emits the SUPERSET so both readers are satisfied.
 *
 * Telemetry constraints (mirroring memory-events.jsonl in mempalace.ts):
 *   - NEVER throws — every fs error is swallowed
 *   - NEVER blocks the bridge call — appendFileSync is sync but cheap
 *   - Lazy rotation at 10MB: tail RETAIN_BYTES on next write, snap to newline
 *   - Path overridable via $BRIDGE_ACTIONS_LOG_PATH for tests
 *
 * Why a separate file from memory-events.jsonl:
 *   memory-events records the OPERATION (op_kind, args_summary, result_summary)
 *   for the rollup-daemon and drift triage. bridge-actions records the
 *   INVOCATION (timing, hash) for daemon ROI baselining. Different consumer,
 *   different retention, different schema — keep them physically separate so
 *   a daemon-baseline analyzer can scan one file without grepping past
 *   higher-volume operation traces.
 */

import { createHash } from 'node:crypto';
import { join } from 'path';
import { homedir } from 'os';
import { rotateIfNeeded } from './rotate';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');

/** Bridge actions audit log file. */
export function bridgeActionsLogPath(): string {
  return process.env.BRIDGE_ACTIONS_LOG_PATH
    || join(DOS_DIR, 'MEMORY', 'STATE', 'bridge-actions.jsonl');
}

/**
 * Rotation threshold — files with `size > MAX_BYTES` are rotated to
 * `bridge-actions-<ISO-stamp>.jsonl` so the daemon-baseline analyzer can
 * still scan historical data across the ≥7-day soak window. Rename-based
 * rotation (rotate.ts) preserves history; we deliberately oversize the
 * threshold past rotate.ts's 5MB default because Phase 0.5 is explicitly
 * a long-tail data-collection exercise.
 */
const MAX_BYTES = 10 * 1024 * 1024;   // 10MB

/**
 * The five possible status values. 'fire-and-forget' applies to bridgeFire
 * (no exit code observed). 'degraded' applies when bridge exits 0 but the
 * payload signals partial success. 'error' is non-zero exit or in-band
 * failure. 'ok' is the canonical success. 'unknown' is a guard for
 * pre-completion records (currently unused — reserved for daemon Phase 1).
 */
export type BridgeActionStatus = 'ok' | 'error' | 'degraded' | 'fire-and-forget' | 'unknown';

/** One emitted record. */
export interface BridgeActionRecord {
  ts: string;
  action: string;
  args_hash: string;
  latency_ms: number;
  result_status: BridgeActionStatus;
  session_id: string | null;
  caller_hook?: string | undefined;
}

/**
 * Compute a stable, short hash of the action's argument shape.
 * Returns the first 16 hex chars of sha256(canonical JSON).
 * Empty / undefined args hash to a stable sentinel.
 */
export function hashArgs(args: Record<string, unknown> | undefined | null): string {
  if (!args || Object.keys(args).length === 0) return 'empty___________';
  try {
    // Sort keys for stable ordering — distinct args with same shape produce
    // the same hash, regardless of property insertion order.
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(args).sort()) sorted[k] = args[k];
    const canonical = JSON.stringify(sorted);
    return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  } catch {
    // Cyclic args (rare for bridge calls) or stringify throw → stable sentinel
    return 'unhashable______';
  }
}

/**
 * Resolve session id from the canonical env priority chain.
 * Mirrors hookRunner / dlq / writeArtifact / streamEvent.
 */
function resolveSessionId(): string | null {
  return (
    process.env.DOS_SESSION_ID
    || process.env.CLAUDE_SESSION_ID
    || null
  );
}

/**
 * Append one record to bridge-actions.jsonl.
 *
 * NEVER throws. Every fs error is swallowed. Caller passes:
 *
 *   recordBridgeAction({
 *     action: 'search',
 *     args: { query: 'foo', wing: 'bar' },
 *     latency_ms: 1452,
 *     result_status: 'ok',
 *     caller_hook: 'SessionContextEnrich',  // optional
 *   });
 *
 * Layer-cake order: caller computes start/end (Date.now()), passes the
 * elapsed ms; this function does NOT measure latency itself — that
 * separation lets bridgeSync, bridgeAsync, bridgeFire, and the observed
 * worker all use identical wall-clock measurement points relative to
 * their own spawn semantics (sync vs async vs detached).
 */
export function recordBridgeAction(input: {
  action: string;
  args: Record<string, unknown> | undefined | null;
  latency_ms: number;
  result_status: BridgeActionStatus;
  caller_hook?: string;
}): void {
  try {
    const fs = require('fs') as typeof import('fs');
    const path = bridgeActionsLogPath();
    const dir = require('path').dirname(path);
    fs.mkdirSync(dir, { recursive: true });
    rotateIfNeeded(path, { maxBytes: MAX_BYTES });
    const record: BridgeActionRecord = {
      ts: new Date().toISOString(),
      action: input.action,
      args_hash: hashArgs(input.args),
      latency_ms: Math.max(0, Math.round(input.latency_ms)),
      result_status: input.result_status,
      session_id: resolveSessionId(),
      ...(input.caller_hook ? { caller_hook: input.caller_hook } : {}),
    };
    fs.appendFileSync(path, JSON.stringify(record) + '\n');
  } catch {
    // Audit log is advisory — never break a bridge call.
  }
}
