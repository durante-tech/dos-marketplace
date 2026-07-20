/**
 * DLQ — shared dead-letter-queue helper for Save*ToStudio.ts
 *
 * Implements iter-1's Primitive #1 (queueOrPost) and Primitive #3
 * (bootstrap gate) from Plans/Specs/studio-sync-resilience.md.
 *
 * All 12 iter-1 RedTeam mitigations are baked in:
 *
 *   1. owner-alive `{pid}.{epoch_boot}` reclaim requires ALL THREE of:
 *      kill -0 fails AND epoch_boot mismatch AND age > 2× p99.
 *   2. Drainer filters strictly by `endsWith('.ready')`; never `*.json`.
 *   3. Monotonic per-session sequence counter: `{sessionId}-{seq:08d}`.
 *   4. Payload v2 envelope shipped from day one.
 *   5. Bootstrap gate — helper REFUSES to mkdir `.pending/`.
 *   6. EXDEV re-check on every queue write AND every drain invocation.
 *   7. No auto-recreate of MEMORY/ — fail loud and disable queueing
 *      for the rest of the session.
 *   8. 5s AbortController timeout + SIGTERM handler that renames
 *      `.inflight` → `.ready.recovered-{pid}` before propagating.
 *   9. Lowercase filenames + APFS case-insensitivity probe at init.
 *  10. Non-principal-UID files quarantined after 14 days with one
 *      warning per unique file.
 *  11. `--retry-pending` callers run `sync-check.ts` as a precondition
 *      (implemented via drainMode='startup').
 *  12. Callers (StudioSync.hook.ts) are responsible for flushing
 *      hook-timing.jsonl before process.exit — helper exposes
 *      flushDrift() for that path.
 *
 * Public API:
 *   queueOrPost(payload, endpoint, opts)     — producer
 *   drain(mode)                              — consumer
 *   installSigtermHandler()                  — call once at process start
 *   flushDrift()                             — synchronous flush for exit path
 *   digestOfBody(obj)                        — content-addressable digest
 *
 * NOTE: This helper never mkdir's .pending/. Bootstrap is Sentinel's job.
 * Missing directory → direct POST + sync-drift entry, no silent failure.
 */

import {
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  opendirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';

import {
  ENVELOPE_VERSION,
  wrapEnvelope,
  type EnvelopeV2,
} from './dlq-envelope';
import {
  postDirect,
  retryAfterDefaultMs,
  retryAfterMaxMs,
  fallbackDirectPost as transportFallbackDirectPost,
  __resetBootstrapMissingForTests,
  GZIP_MIN_BYTES,
} from './dlq-transport';
// Phase-4 Cluster D — drain layer sprout. dlq.ts owns transport-orchestration
// (queueOrPost), drift logging, circuit state, and the SIGTERM handler;
// dlq-drain owns the drain orchestrator + per-tool inner loop + reclaim
// helpers. Cycle-safe: dlq-drain imports our internal `__drainPort` value
// surface; we import its `drain`/`drainQueueDir` plus the reclaim helpers
// (parseInflight/shouldReclaim/BOOT_EPOCH still surfaced via __internals)
// and ACTIVE_INFLIGHT (the SIGTERM handler iterates this).
import {
  drainEnvelopeBudget,
  DRAIN_ENVELOPE_BUDGET_FALLBACK,
  parseInflight,
  shouldReclaim,
  BOOT_EPOCH,
  ACTIVE_INFLIGHT,
} from './dlq-drain';
import { getMemorySubdir, dosPath } from './paths';
import { resolveProjectSlug, isDosTenantPath } from './project-context';

// ─────────────────────────────────────────────────────────────────────
// Phase-4 sprout re-exports
// ─────────────────────────────────────────────────────────────────────
//
// Cluster E (ISC-1..ISC-7)  — envelope concern moved to ./dlq-envelope.
// Cluster T (ISC-8..ISC-15) — transport concern moved to ./dlq-transport.
// Cluster D (ISC-16..ISC-22) — drain layer moved to ./dlq-drain.
//
// dlq.ts re-exports the surface for back-compat with existing importers
// (notably dlq.test.ts which uses `import { canonicalJson, digestOfBody,
// parseRetryAfter, applyJitter, drain } from './dlq'` and
// DrainPending.hook.ts which imports `drain` from `./lib/dlq`).

export { canonicalJson, digestOfBody } from './dlq-envelope';
export type { EnvelopeV2 } from './dlq-envelope';
export { parseRetryAfter, applyJitter } from './dlq-transport';
export { drain } from './dlq-drain';
export type { DrainMode, DrainSource } from './dlq-drain';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type DLQScope = 'project' | 'install';

export type DLQTool =
  | 'artifacts'
  | 'inner-artifacts'
  | 'security-events'
  | 'sessions'
  | 'work'
  | 'reflections'
  | 'signals'
  | 'kg'
  | 'corrections'
  | 'failures'
  | 'learnings'
  | 'memory-snapshots'
  | 'memory-events'
  | 'hook-metrics'
  | 'voice-events'
  | 'relationships-notes'
  | 'research'
  | 'plans'
  // RFC-0068 ISC-10 — claude_code.skill_activated OTEL ingestion.
  // Drains MEMORY/STATE/skill-activations.jsonl to /api/v1/skills/activations.
  // STATE-mapped because the stream is operationally session-coordination
  // data (parallel to sessions/), and the events are emitted alongside the
  // mode-classifier banner — the same locus where session-id is canonical.
  | 'skill-activations'
  // RFC-0074 Phases 2-6 (V11.19) — Algorithm banner-fire-rate ingestion.
  // Drains MEMORY/STATE/banner-fire-events.jsonl (produced by
  // Tools/banner-fire-analyzer.ts, V11.8) to /api/v1/banner-fire. STATE-mapped
  // because the stream is per-turn session telemetry parallel to skill-
  // activations and sessions/.
  | 'banner-fire'
  // Phase-3 status: deferrals + commitments are now LIVE queue-mode tools
  // (tool-registry.ts maps both to mode:'queue' via queueOrPost). projects
  // remains special-mode (direct POST to /api/v1/projects to seed the
  // slug→Project.id table before the queue's auth-bearer can resolve). All
  // three carry real TOOL_TO_SUBDIR + INSTALL_ONLY mappings (STATE-scoped).
  | 'deferrals'
  | 'projects'
  | 'commitments'
  // v0.0.20 campaign slice 0b — TELOS corpus + KG goal facts → /api/v1/telos
  // (NET-NEW Studio route; SaveTelosToStudio gated by DOS_TELOS_SYNC=1 until
  // the route ships). STATE-mapped: purpose-graph snapshots are session-
  // coordination telemetry parallel to kg/memory-snapshots.
  | 'telos'
  // ISC-30 / audit F6 — workflow run receipts. SaveWorkflowReceiptsToStudio
  // scans transcript wf_*/journal.jsonl into MEMORY/STATE/workflow-receipts.jsonl
  // → /api/v1/workflow/receipts (NET-NEW Studio route). STATE-mapped: per-run
  // fan-out telemetry parallel to hook-metrics/skill-activations.
  | 'workflow-receipts';

export interface QueueOpts {
  /** DOS tool name; controls which MEMORY/{subdir}/.pending/ the payload goes into. */
  tool: DLQTool;
  /** Per-call timeout in ms. Defaults to DOS_DLQ_TIMEOUT_MS env or 5000. */
  timeoutMs?: number;
  /** 'project' (default) respects CLAUDE_PROJECT_DIR resolver; 'install' forces ~/.claude/MEMORY/ */
  scope?: DLQScope;
  /** Stable idempotency key computed by caller from payload. */
  idempotencyKey?: string;
  /** Session ID for filename prefix. Defaults to process.env.DOS_SESSION_ID or pid-based fallback. */
  sessionId?: string;
  /** Correlation ID for end-to-end tracing. Auto-generated (UUID v4) if omitted. */
  correlationId?: string;
  /**
   * Queue-only mode — write the envelope to .pending/ and return without
   * attempting the POST. Used by hook lifecycle callers that must finish
   * under the harness's hook timeout. The drainer (SessionStart/SessionEnd
   * DrainPending hook, or a future LaunchAgent) is responsible for shipping.
   *
   * Defaults to `process.env.DOS_DLQ_QUEUE_ONLY === '1'` so the entire
   * StudioSync spawn fleet can be switched to queue-only with one env var.
   */
  queueOnly?: boolean;
}

export type QueueResult =
  | { outcome: 'posted'; status: number }
  | { outcome: 'queued'; path: string; reason: string }
  | { outcome: 'dropped'; reason: string };

export interface DrainReport {
  read: number;
  posted: number;
  requeued: number;
  quarantined: number;
  reclaimed: number;
  errors: Array<{ file: string; reason: string }>;
}

// ─────────────────────────────────────────────────────────────────────
// Subdirectory mapping — per-tool MEMORY/ subdir
// ─────────────────────────────────────────────────────────────────────

const TOOL_TO_SUBDIR: Record<DLQTool, string> = {
  artifacts: 'ARTIFACTS',
  // RFC-0032 W1 — inner-artifacts walks ARTIFACTS+SECURITY+LEARNING but
  // its DLQ envelopes land in ARTIFACTS/.pending/ (the conceptual primary
  // subdir for artifact rows; always exists post-Sentinel bootstrap).
  'inner-artifacts': 'ARTIFACTS',
  'security-events': 'SECURITY',
  sessions: 'STATE',
  work: 'WORK',
  reflections: 'LEARNING',
  signals: 'LEARNING',
  kg: 'STATE',
  corrections: 'LEARNING',
  failures: 'LEARNING',
  learnings: 'LEARNING',
  'memory-snapshots': 'STATE',
  'memory-events': 'STATE',
  'hook-metrics': 'STATE',
  'voice-events': 'VOICE',
  'relationships-notes': 'RELATIONSHIP',
  research: 'RESEARCH',
  plans: 'STATE',
  // RFC-0068 ISC-10 — STATE/.pending lands the skill-activation envelopes;
  // skill-activations.jsonl producer (out of scope for this tool) writes to
  // MEMORY/STATE/skill-activations.jsonl, and this tool drains it.
  'skill-activations': 'STATE',
  // RFC-0074 V11.19 — STATE/.pending lands the banner-fire envelopes;
  // banner-fire-events.jsonl producer is Tools/banner-fire-analyzer.ts
  // (V11.8 shipped 2026-05-09); SaveBannerFireToStudio.ts drains it.
  'banner-fire': 'STATE',
  telos: 'STATE',
  // deferrals + commitments: LIVE queue tools (Phase-3 migrated to queueOrPost);
  // STATE-mapped because they are KG-derived session-coordination telemetry.
  // projects: special-mode (direct POST), STATE-mapped for symmetry though it
  // does not currently route through the queue.
  deferrals: 'STATE',
  projects: 'STATE',
  commitments: 'STATE',
  // ISC-30 / F6 — STATE/.pending lands the workflow-receipt envelopes;
  // SaveWorkflowReceiptsToStudio synthesizes them from transcript journals into
  // MEMORY/STATE/workflow-receipts.jsonl and drains here. STATE-mapped: per-run
  // fan-out telemetry parallel to hook-metrics/skill-activations/banner-fire.
  'workflow-receipts': 'STATE',
};

// Tools that live under install (~/.claude/MEMORY/) regardless of scope.
// Convention: STATE-mapped tools are install-scoped — STATE is global infra
// (session coordination, registries) per CLAUDE.md project-level memory rules.
const INSTALL_ONLY: ReadonlySet<DLQTool> = new Set([
  'sessions',
  'kg',
  'memory-snapshots',
  'memory-events',
  'hook-metrics',
  'voice-events',
  'relationships-notes',
  'plans',
  // RFC-0068 ISC-10 — STATE-mapped, install-scoped per the standing rule
  // (STATE is global infra: session coordination + registries).
  'skill-activations',
  // RFC-0074 V11.19 — banner-fire is STATE-mapped → install-scoped.
  'banner-fire',
  // deferrals + commitments (live queue tools) + projects (special-mode) —
  // STATE-mapped, follow the same install-scope rule (STATE is global infra).
  'deferrals',
  'projects',
  'commitments',
  'telos',
  // ISC-30 / F6 — workflow-receipts is STATE-mapped → install-scoped (per-run
  // fan-out telemetry, global under ~/.claude/MEMORY/STATE).
  'workflow-receipts',
]);

// ─────────────────────────────────────────────────────────────────────
// Envelope concern (v2 envelope + canonicalJson/digestOfBody) lives in
// ./dlq-envelope. See the Phase-4 sprout re-exports above for the public
// surface that callers and tests rely on.
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// Filename scheme — all lowercase, monotonic seq per session
// ─────────────────────────────────────────────────────────────────────

const SEQ_COUNTERS = new Map<string, number>();

function nextSeq(pendingDir: string, sessionId: string): number {
  const seqFile = join(pendingDir, `.seq.${sessionId}`);
  let seq = SEQ_COUNTERS.get(seqFile);
  if (seq === undefined) {
    try {
      const raw = readFileSync(seqFile, 'utf-8').trim();
      seq = Number.parseInt(raw, 10) || 0;
    } catch {
      seq = 0;
    }
  }
  seq = seq + 1;
  SEQ_COUNTERS.set(seqFile, seq);
  try {
    const fd = openSync(seqFile, 'w');
    writeFileSync(fd, String(seq));
    fsyncSync(fd);
    closeSync(fd);
  } catch {
    // Best-effort persistence; in-memory counter wins per-process.
  }
  return seq;
}

// hooks-007 — collision-proof per-write infix. nextSeq() is an unlocked
// read-modify-write of a per-session .seq file and each Save*ToStudio child
// carries its own empty in-memory SEQ_COUNTERS map, so two siblings that
// share a parent .pending/ (e.g. STATE for sessions/kg/plans/…) can both
// compute the SAME seq and clobber each other's .tmp/.ready (openSync 'w' =
// O_CREAT|O_TRUNC, no O_EXCL; rename last-write-wins) — one envelope is
// silently lost. Mirroring flushCircuitState's `.tmp.${pid}.${rand}` scheme,
// we splice ${pid}.${rand} into BOTH the temp and the final ready name so two
// processes can never produce the same path. The drainer filters strictly by
// `endsWith('.ready')` (dlq-drain.ts) and inflightFilename strips `.ready$`,
// so the extra infix is inert downstream.
function writeUniqInfix(): string {
  return `${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
}

function readyFilename(sessionId: string, seq: number): string {
  const safeSession = sessionId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const padded = String(seq).padStart(8, '0');
  return `${safeSession}-${padded}.${writeUniqInfix()}.ready`;
}

function tmpFilename(sessionId: string, seq: number): string {
  const safeSession = sessionId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const padded = String(seq).padStart(8, '0');
  return `${safeSession}-${padded}.${writeUniqInfix()}.tmp`;
}

function inflightFilename(readyName: string, pid: number, epochBoot: number): string {
  return `${readyName.replace(/\.ready$/, '')}.inflight.${pid}.${epochBoot}`;
}

// ─────────────────────────────────────────────────────────────────────
// Owner-alive reclaim — 3-check rule
// ─────────────────────────────────────────────────────────────────────
//
// Phase-4 Cluster D (ISC-16..ISC-22) — bootEpochSeconds, BOOT_EPOCH,
// isProcessAlive, parseInflight, shouldReclaim, and InflightParts moved
// to ./dlq-drain. Re-imported above for the SIGTERM handler (parseInflight)
// and __internals test surface (parseInflight, shouldReclaim, BOOT_EPOCH,
// isProcessAlive). 3-check semantics unchanged.

// ─────────────────────────────────────────────────────────────────────
// Circuit break — U-G3d
//
// Per-tool consecutive-429 tracking. When a tool's drain hits
// DOS_DLQ_CIRCUIT_THRESHOLD (default 5) consecutive 429 responses,
// the circuit "trips" and that tool's drain is paused for
// `Retry-After × DOS_DLQ_CIRCUIT_MULTIPLIER` (default 2). First 2xx
// closes the circuit and resets the counter. Different tools maintain
// independent counters — one noisy tool does not halt the rest.
//
// Retry-After parsing reuses U-G3c's `parseRetryAfter` helper. The
// raw seconds value is extracted via `postForDrain` (below) instead of
// `postDirect`, because `postDirect` auto-sleeps on 429 which would
// defeat the circuit-break purpose for drain callers.
// ─────────────────────────────────────────────────────────────────────

interface CircuitState {
  consecutive429: number;
  resumeAt: number; // epoch ms; 0 = not tripped
}
// hooks-008 — circuit state is keyed by the envelope's `endpoint` (the real
// rate-limit locus), NOT by DLQTool. drain() dedups the work list by parent
// dir, so a single nominal opts.tool stands in for every sibling tool that
// shares a MEMORY subdir (e.g. STATE → sessions/kg/plans/memory-snapshots/…).
// Keying the circuit by opts.tool let a 429 storm on one route (e.g.
// /api/v1/kg/sync) trip the circuit recorded as 'sessions' and stall every
// healthy sibling endpoint under that parent. Endpoint keys isolate the pause
// to the throttled route. The on-disk persistence already serializes the map
// as Record<string, …>, so string keys are storage-compatible.
const CIRCUIT_STATE = new Map<string, CircuitState>();

// ─────────────────────────────────────────────────────────────────────
// Cluster P (ISC-16…ISC-25) — CIRCUIT_STATE persistence
//
// Persist the consecutive-429 counters across DrainPending respawns so a
// circuit that tripped in one process keeps Studio off the hot path
// during the next session/startup drain. File layout:
//
//   ${DOS_DIR}/MEMORY/STATE/circuit-state.json
//
// On-disk shape:
//   { version: 1, tools: { [DLQTool]: { consecutive429, resumeAt } } }
//
// Race window: two DrainPending instances flushing at the same moment is
// last-write-wins on the rename target. Atomic rename guarantees no torn
// file is ever observable; intra-session counter loss is bounded by how
// often DrainPending forks. Acceptable for now — file-locking would add
// hook latency for a counter we already overwrite with each successful
// 2xx anyway.
//
// Schema versioning: version=1 today. Future migrations bump version +
// add a converter; mismatch on load currently clears the map and warns.
// ─────────────────────────────────────────────────────────────────────

const CIRCUIT_STATE_VERSION = 1 as const;

function circuitStatePath(): string {
  return join(dosPath('MEMORY'), 'STATE', 'circuit-state.json');
}

interface PersistedCircuitState {
  version: number;
  tools: Record<string, { consecutive429: number; resumeAt: number }>;
}

let _circuitStateLoaded = false;
let _circuitStateLoadWarned = false;
let _circuitStateFlushWarned = false;

function isPersistedCircuitState(x: unknown): x is PersistedCircuitState {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as { version?: unknown; tools?: unknown };
  if (typeof o.version !== 'number') return false;
  if (typeof o.tools !== 'object' || o.tools === null) return false;
  for (const v of Object.values(o.tools as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null) return false;
    const e = v as { consecutive429?: unknown; resumeAt?: unknown };
    if (typeof e.consecutive429 !== 'number') return false;
    if (typeof e.resumeAt !== 'number') return false;
  }
  return true;
}

function loadCircuitState(): void {
  _circuitStateLoaded = true; // mark loaded even on miss/error so we don't retry
  const target = circuitStatePath();
  let raw: string;
  try {
    raw = readFileSync(target, 'utf-8');
  } catch (err) {
    const e = err as { code?: string };
    if (e.code !== 'ENOENT' && !_circuitStateLoadWarned) {
      _circuitStateLoadWarned = true;
      console.error(
        `[dlq.loadCircuitState] read failed for ${target}: ${(err as Error).message}`,
      );
    }
    CIRCUIT_STATE.clear();
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    if (!_circuitStateLoadWarned) {
      _circuitStateLoadWarned = true;
      console.error(
        `[dlq.loadCircuitState] parse failed for ${target}: ${(err as Error).message}`,
      );
    }
    CIRCUIT_STATE.clear();
    return;
  }
  if (!isPersistedCircuitState(parsed) || parsed.version !== CIRCUIT_STATE_VERSION) {
    if (!_circuitStateLoadWarned) {
      _circuitStateLoadWarned = true;
      console.error(
        `[dlq.loadCircuitState] shape/version mismatch for ${target} (got version=${
          (parsed as { version?: unknown })?.version
        }); discarding`,
      );
    }
    CIRCUIT_STATE.clear();
    return;
  }
  CIRCUIT_STATE.clear();
  for (const [tool, state] of Object.entries(parsed.tools)) {
    CIRCUIT_STATE.set(tool as DLQTool, {
      consecutive429: state.consecutive429,
      resumeAt: state.resumeAt,
    });
  }
}

function ensureCircuitStateLoaded(): void {
  if (!_circuitStateLoaded) loadCircuitState();
}

function flushCircuitState(): boolean {
  // W2-S3 Fix 1 — never persist a never-loaded map. flushDrift() co-fires
  // this on SessionEnd/SIGTERM/drain-tail, so a process that buffered drift
  // but never touched circuit state would otherwise overwrite a concurrent
  // drainer's fresh trips with an empty snapshot. Every legitimate mutator
  // (dlq-drain.ts recordSuccess/record429) calls ensureCircuitStateLoaded()
  // first, so loaded=false guarantees there is nothing of ours to persist.
  if (!_circuitStateLoaded) return false;
  const target = circuitStatePath();
  const dir = dirname(target);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (!_circuitStateFlushWarned) {
      _circuitStateFlushWarned = true;
      console.error(
        `[dlq.flushCircuitState] mkdir failed for ${dir}: ${(err as Error).message}`,
      );
    }
    return false;
  }
  const payload: PersistedCircuitState = {
    version: CIRCUIT_STATE_VERSION,
    tools: {},
  };
  for (const [tool, state] of CIRCUIT_STATE.entries()) {
    payload.tools[tool] = {
      consecutive429: state.consecutive429,
      resumeAt: state.resumeAt,
    };
  }
  // Atomic rename: write to .tmp.<pid>.<rand>, fsync, rename onto target.
  // Last-write-wins between concurrent flushers; readers never see torn JSON.
  const tmp = `${target}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
  let fd: number | undefined;
  try {
    fd = openSync(tmp, 'w', 0o600);
    const buf = Buffer.from(JSON.stringify(payload), 'utf-8');
    writeFileSync(fd, buf);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, target);
    return true;
  } catch (err) {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* best-effort */ }
    }
    try { unlinkSync(tmp); } catch { /* best-effort */ }
    if (!_circuitStateFlushWarned) {
      _circuitStateFlushWarned = true;
      console.error(
        `[dlq.flushCircuitState] write failed for ${target}: ${(err as Error).message}`,
      );
    }
    return false;
  }
}

const CIRCUIT_THRESHOLD_FALLBACK = 5;
const CIRCUIT_MULTIPLIER_FALLBACK = 2;
const CIRCUIT_DEFAULT_RETRY_AFTER_SECONDS = 60;

function circuitThreshold(): number {
  const env = process.env.DOS_DLQ_CIRCUIT_THRESHOLD;
  if (env === undefined) return CIRCUIT_THRESHOLD_FALLBACK;
  const n = Number.parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : CIRCUIT_THRESHOLD_FALLBACK;
}

function circuitMultiplier(): number {
  const env = process.env.DOS_DLQ_CIRCUIT_MULTIPLIER;
  if (env === undefined) return CIRCUIT_MULTIPLIER_FALLBACK;
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : CIRCUIT_MULTIPLIER_FALLBACK;
}

// ─────────────────────────────────────────────────────────────────────
// Drain envelope budget — Phase-2 Cluster B (ISC-26..32)
// ─────────────────────────────────────────────────────────────────────
//
// Phase-4 Cluster D (ISC-16..ISC-22) — DRAIN_ENVELOPE_BUDGET_FALLBACK and
// drainEnvelopeBudget moved to ./dlq-drain alongside the drain orchestrator.
// Re-imported above for orchestration symmetry; __internals re-exports
// preserve the test surface contract.

// ─────────────────────────────────────────────────────────────────────
// EXDEV / filesystem probes
// ─────────────────────────────────────────────────────────────────────

function sameFilesystem(a: string, b: string): boolean {
  try {
    const sa = statSync(a);
    const sb = statSync(b);
    return sa.dev === sb.dev;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Backpressure cap (incident 2026-06-22)
// ─────────────────────────────────────────────────────────────────────
//
// Single chokepoint that bounds EVERY tool's queue. Producers run `--import-all`
// queue-only every session and re-enqueue their whole corpus with no dedup;
// without a ceiling that ran ARTIFACTS/.pending to 4.4M files and STATE/.pending
// to 111k, starving the CPU + the MemPalace daemon. When a tool's .pending
// already holds more than the cap, skip the queue-only write and log a
// `backpressure` drift row. Safe: the skipped envelope regenerates from its
// source on the next import once the drain pulls .pending back under the cap —
// nothing un-synced is lost (the drainer only deletes on a 2xx). Override via
// DOS_DLQ_PENDING_CAP. Normal .pending is hundreds of files, so the 50k default
// is ~50x headroom over healthy operation.
const PENDING_CAP_FALLBACK = 50_000;

function pendingCap(): number {
  const env = process.env.DOS_DLQ_PENDING_CAP;
  if (env === undefined) return PENDING_CAP_FALLBACK;
  const n = Number.parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : PENDING_CAP_FALLBACK;
}

// opendirSync + readSync streams entries one at a time, so the early break is
// bounded even on a multi-million-entry directory (readdirSync would not be).
//
// Counting rules (incident 2026-06-24): the cap must reflect REAL backpressure.
//   - Skip control dotfiles (.seq.*, .quarantine, .parked, .streaming): they are
//     bookkeeping, not queue depth. Counting the per-pid .seq.* leak (6.9k files
//     observed) spuriously inflated depth toward a false trip.
//   - But .quarantine itself can hide hundreds of thousands of dead envelopes as
//     a SINGLE dirent, so a poison-bloated corpus looked shallow and producers
//     kept enqueuing onto it. Recurse ONE level into .quarantine and count its
//     contents toward the same cap. The early-break keeps both passes bounded.
function countDirToward(dir: string, cap: number, start: number): number {
  let handle: ReturnType<typeof opendirSync> | undefined;
  let n = start;
  try {
    handle = opendirSync(dir);
    while (handle.readSync() !== null) {
      if (++n > cap) return n; // early break — bounded
    }
  } catch {
    /* unreadable subdir → contributes nothing */
  } finally {
    try { handle?.closeSync(); } catch { /* best-effort */ }
  }
  return n;
}

function pendingDepthExceeds(pendingDir: string, cap: number): boolean {
  let dir: ReturnType<typeof opendirSync> | undefined;
  let n = 0;
  try {
    dir = opendirSync(pendingDir);
    let ent: ReturnType<NonNullable<typeof dir>['readSync']>;
    while ((ent = dir.readSync()) !== null) {
      const name = ent.name;
      // Control/bookkeeping dotfiles are not queue depth.
      if (name.startsWith('.seq.') || name === '.quarantine' ||
          name === '.parked' || name === '.streaming') continue;
      if (++n > cap) return true;
    }
  } catch {
    return false; // unreadable → don't block on a counting error
  } finally {
    try { dir?.closeSync(); } catch { /* best-effort */ }
  }
  // Quarantine hides its contents behind one dirent; fold them in so a
  // poison-bloated corpus trips the cap instead of looking shallow.
  if (n <= cap) {
    n = countDirToward(join(pendingDir, '.quarantine'), cap, n);
  }
  return n > cap;
}

// ─────────────────────────────────────────────────────────────────────
// sync-drift logging
// ─────────────────────────────────────────────────────────────────────

interface DriftEntry {
  ts: string;
  tool: DLQTool;
  kind:
    | 'posted'
    | 'queued'
    | 'bootstrap-missing'
    | 'exdev'
    | 'timeout'
    | 'direct-fallback'
    | 'reclaimed'
    | 'quarantined-version'
    | 'quarantined-uid'
    | 'quarantined-shape'
    | 'quarantined-4xx'
    | 'quarantined-route'
    | 'quarantined-auth'
    | 'drained'
    | 'post-failed'
    | 'sigterm-recover'
    | 'rm-rf-detected'
    | 'circuit-open'
    | 'circuit-close'
    // RFC-0062 F3 — producer-side cross-tenant scope guard. Emitted when a
    // Save*ToStudio.ts producer detects a foreign-tenant payload path and
    // declines to enqueue (DOS_CROSS_TENANT=block) or parks the envelope
    // (DOS_CROSS_TENANT=park). Operators see one stderr line per occurrence
    // plus a structured drift row for monitoring via dlq-status.ts.
    | 'cross-tenant-blocked'
    // Backpressure cap (incident 2026-06-22) — enqueue skipped because the
    // tool's .pending is pathologically deep (see queueOrPost).
    | 'backpressure';
  endpoint?: string;
  file?: string;
  message?: string;
  count?: number;
  ageMs?: number;
  status?: number;
  // sigterm-recover only: the MEMORY/<subdir>/ the recovered .inflight file
  // lived under. The inflight filename encodes sessionId/seq/pid/epoch but NOT
  // the originating tool, so `tool` cannot be recovered precisely (one subdir
  // can back many tools — e.g. STATE). This field carries the accurate subdir
  // signal; `tool` is set to a documented placeholder for those rows.
  subdir?: string;
  // U-G3d circuit-break fields
  consecutive429?: number;
  resumeAt?: number;
  pauseMs?: number;
  retryAfterSeconds?: number;
}

const DRIFT_BUFFER: DriftEntry[] = [];

function logDrift(entry: Omit<DriftEntry, 'ts'>): void {
  DRIFT_BUFFER.push({ ts: new Date().toISOString(), ...entry });
}

let _flushDriftMkdirWarned = false;

export function flushDrift(): number {
  // Cluster P (ISC-16…ISC-25): co-fire CIRCUIT_STATE persistence on every
  // flushDrift() invocation. flushDrift is the existing exit-path flush
  // surface — StudioSync.hook.ts:198-203 wires it to SessionEnd + SIGTERM,
  // and drain() calls it at the tail of every aggregated drain. Co-firing
  // here means the circuit-state file is updated whenever drift records
  // are flushed, with no new lifecycle hooks needed. The flush is a no-op
  // (overwrites with identical bytes) when CIRCUIT_STATE hasn't changed.
  flushCircuitState();
  if (DRIFT_BUFFER.length === 0) return 0;
  let driftDir: string;
  try {
    driftDir = getMemorySubdir('LEARNING');
  } catch {
    return 0;
  }
  const sysDir = join(driftDir, 'SYS');
  // Self-heal: drift events are observability data — silent no-op on a
  // missing directory is the bug that lets buffered events die with the
  // process. Consistent with paths.ts:144-155 self-heal pattern.
  // recursive: true also creates driftDir if it's missing.
  try {
    mkdirSync(sysDir, { recursive: true });
  } catch (err) {
    if (!_flushDriftMkdirWarned) {
      _flushDriftMkdirWarned = true;
      console.error(`[dlq.flushDrift] mkdir failed for ${sysDir}: ${(err as Error).message}`);
    }
    return 0;
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const target = join(sysDir, `sync-drift-${date}.jsonl`);
  const lines = DRIFT_BUFFER.map((e) => JSON.stringify(e)).join('\n') + '\n';
  try {
    const fd = openSync(target, 'a');
    writeFileSync(fd, lines);
    fsyncSync(fd);
    closeSync(fd);
    const flushed = DRIFT_BUFFER.length;
    DRIFT_BUFFER.length = 0;
    return flushed;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Ack log — witness of drained events (PR3a; RedTeam Attack 7)
//
// Phase-2 sprout — ack-ledger lives in dlq-ack-ledger.ts; re-exported
// here for back-compat (Feathers + Fowler convergence). The buffer,
// manifest, rotation, and flush helpers all moved to the new module.
// dlq.ts continues to call bufferAck / rotateAckIfNeeded / flushAck
// transparently via the named imports below.
//
// File layout (unchanged): ${DOS_DIR}/MEMORY/STATE/ack-{YYYYMMDD}.jsonl
// Manifest (unchanged):    ${DOS_DIR}/MEMORY/STATE/ack-manifest.json
// ─────────────────────────────────────────────────────────────────────

import { __ackInternals } from './dlq-ack-ledger';
export {
  bufferAck,
  flushAck,
  rotateAckIfNeeded,
} from './dlq-ack-ledger';
export type { AckEntry, AckManifestEntry } from './dlq-ack-ledger';

// Phase-4 Cluster T (ISC-8..ISC-15) — the bootstrap-missing one-shot sentinel
// moved into ./dlq-transport alongside fallbackDirectPost. dlq.ts no longer
// owns that mutable state; __resetBootstrapMissingForTests below is wired
// through the imported reset helper for test isolation.

// ─────────────────────────────────────────────────────────────────────
// Bootstrap gate — helper NEVER mkdirs .pending/
// ─────────────────────────────────────────────────────────────────────

export interface ResolvedDirs {
  /** Parent MEMORY/{subdir}/ — must exist (Sentinel creates). */
  parent: string;
  /** .pending/ — must exist (Sentinel creates). If missing → bootstrap-missing. */
  pending: string;
  /** .pending/.quarantine/ — created lazily during drain when needed. */
  quarantine: string;
}

function resolveDirs(tool: DLQTool, scope: DLQScope): ResolvedDirs | null {
  const subdir = TOOL_TO_SUBDIR[tool];
  const forceInstall = INSTALL_ONLY.has(tool) || scope === 'install';

  const parent = forceInstall
    ? join(dosPath('MEMORY'), subdir)
    : getMemorySubdir(subdir);

  if (!existsSync(parent)) return null;

  const pending = join(parent, '.pending');
  const quarantine = join(pending, '.quarantine');

  return { parent, pending, quarantine };
}

function bootstrapCheck(dirs: ResolvedDirs | null): boolean {
  if (!dirs) return false;
  return existsSync(dirs.pending);
}

// ─────────────────────────────────────────────────────────────────────
// SIGTERM handler — convert .inflight → .ready.recovered-{pid}
// ─────────────────────────────────────────────────────────────────────
//
// Phase-4 Cluster D — ACTIVE_INFLIGHT now lives in ./dlq-drain (the drain
// orchestrator adds/removes entries inside drainOneReadyEntry). This handler
// iterates that shared set on graceful shutdown so any in-flight envelope
// becomes a `.ready.recovered-{pid}` artifact for the next drainer to pick up.

let SIGTERM_INSTALLED = false;

export function installSigtermHandler(): void {
  if (SIGTERM_INSTALLED) return;
  SIGTERM_INSTALLED = true;
  const handler = () => {
    for (const p of ACTIVE_INFLIGHT) {
      try {
        const dir = dirname(p);
        const base = p.slice(dir.length + 1);
        const parts = parseInflight(base);
        if (!parts) continue;
        const recovered = `${parts.readyName.replace(/\.ready$/, '')}.ready.recovered-${process.pid}`;
        renameSync(p, join(dir, recovered));
        // The inflight filename encodes sessionId/seq/pid/epoch but NOT the
        // tool, so we recover the accurate MEMORY/<subdir> from the path
        // (dir = MEMORY/<subdir>/.pending). `tool` is reverse-mapped to a
        // representative DLQTool for that subdir (may be ambiguous — the
        // precise tool is unrecoverable here; `subdir` carries the true signal).
        const subdir = dirname(dir).split('/').pop() ?? '';
        const repTool = (Object.keys(TOOL_TO_SUBDIR) as DLQTool[]).find(
          (t) => TOOL_TO_SUBDIR[t] === subdir,
        );
        logDrift({ tool: repTool ?? 'artifacts', kind: 'sigterm-recover', file: p, subdir });
      } catch { /* best-effort */ }
    }
    flushDrift();
  };
  process.on('SIGTERM', handler);
  process.on('SIGINT', handler);
}

// ─────────────────────────────────────────────────────────────────────
// crossTenantGate — RFC-0062 F3 producer-side cross-tenant scope guard
// ─────────────────────────────────────────────────────────────────────
//
// Producers that build envelopes from a filesystem path (e.g.,
// `payload.projectPath`, `payload.filePath`) call this helper BEFORE
// `queueOrPost`. If the path is foreign — i.e., not under any
// `.dos-projects.json` `root_path` and not in the hardcoded ~/.claude /
// ~/Durante allowlist — the helper returns a directive describing what
// to do.
//
// Modes (DOS_CROSS_TENANT env var, default 'block'):
//   - 'block' (default) — log + skip envelope. Operators see a stderr
//     line per occurrence and a `cross-tenant-blocked` drift row for
//     dlq-status.ts visibility.
//   - 'park'  — write the envelope to `.pending/.parked/cross-tenant/`
//     for operator review. Useful when investigating a leak source —
//     the artifacts remain inspectable.
//   - 'allow' — pass-through (kill switch). Producer falls through to
//     normal queueOrPost. Used during ops emergencies only.
//
// On allow OR on-tenant paths the function returns { ok: true } and
// the producer proceeds normally. On 'block' / 'park' it returns
// { ok: false } and the caller MUST skip queueOrPost; the helper has
// already logged drift and (if 'park') written the envelope to disk.
// ─────────────────────────────────────────────────────────────────────

export type CrossTenantMode = 'block' | 'park' | 'allow';

export function getCrossTenantMode(): CrossTenantMode {
  const raw = (process.env.DOS_CROSS_TENANT ?? 'block').trim().toLowerCase();
  if (raw === 'park' || raw === 'allow') return raw;
  return 'block';
}

export interface CrossTenantGateInput {
  /** The DLQ tool name — controls drift-log routing and park subdir. */
  tool: DLQTool;
  /** The destination Studio endpoint (for the drift-log + park sidecar). */
  endpoint: string;
  /**
   * The absolute path field the producer extracted from its payload —
   * typically `payload.projectPath`, `payload.filePath`, or a similar
   * field. May be `null`/`undefined` when the producer's payload has
   * no path field at all (rare); in that case the gate returns ok:true
   * unconditionally — there is nothing to validate.
   */
  absPath: string | null | undefined;
  /**
   * Producer-friendly source label included in the stderr line. Falls
   * back to the tool name when omitted.
   */
  source?: string;
  /**
   * Full envelope payload — used only when mode='park' so the parked
   * file carries the same JSON the producer would have queued.
   */
  payload?: unknown;
}

export type CrossTenantGateResult = { ok: true } | { ok: false; reason: string };

/**
 * Cross-tenant scope guard. Returns ok:true when the producer should
 * proceed (path is on-tenant OR mode='allow' OR no path provided);
 * returns ok:false (with `reason`) when the producer must skip the
 * envelope. In 'block' mode the helper emits a stderr hint and a
 * `cross-tenant-blocked` drift row. In 'park' mode it additionally
 * writes the envelope JSON under `.pending/.parked/cross-tenant/` so
 * operators can audit the leak source.
 */
export function crossTenantGate(input: CrossTenantGateInput): CrossTenantGateResult {
  const { tool, endpoint, absPath, source, payload } = input;
  // No path field — nothing to validate (D-2026-05-05-3 surgical fields).
  if (absPath === null || absPath === undefined || absPath === '') {
    return { ok: true };
  }
  if (typeof absPath !== 'string') {
    // Defensive: producer accidentally passed a non-string path. Treat
    // as foreign — better to block than silently pass an unknown shape.
    logDrift({
      tool,
      kind: 'cross-tenant-blocked',
      endpoint,
      message: `non-string path field (${typeof absPath})`,
    });
    process.stderr.write(
      `[${source ?? tool}] cross-tenant blocked: non-string path field\n`,
    );
    return { ok: false, reason: 'non-string-path' };
  }
  // On-tenant ⇒ proceed.
  if (isDosTenantPath(absPath)) return { ok: true };

  const mode = getCrossTenantMode();

  // Always log the drift event regardless of mode — operators need the rate.
  logDrift({
    tool,
    kind: 'cross-tenant-blocked',
    endpoint,
    file: absPath,
    message: `mode=${mode}; foreign path`,
  });

  if (mode === 'allow') {
    // Kill-switch escape hatch — pass through. Drift row is already logged
    // so the operator still sees the rate.
    process.stderr.write(
      `[${source ?? tool}] cross-tenant allowed (DOS_CROSS_TENANT=allow): ${absPath}\n`,
    );
    return { ok: true };
  }

  // Block (default) — single-line stderr hint per the PRD anti-criteria.
  process.stderr.write(
    `[${source ?? tool}] cross-tenant blocked: ${absPath}\n`,
  );

  if (mode === 'park') {
    // Try to write the envelope under .parked/cross-tenant/ so operators
    // can audit. Best-effort — failure to park does not undo the block.
    try {
      const dirs = resolveDirs(tool, INSTALL_ONLY.has(tool) ? 'install' : 'project');
      if (dirs && existsSync(dirs.pending)) {
        const parkedDir = join(dirs.pending, '.parked', 'cross-tenant');
        if (!existsSync(parkedDir)) mkdirSync(parkedDir, { recursive: true, mode: 0o700 });
        const sessionId = (process.env.DOS_SESSION_ID ?? process.env.CLAUDE_SESSION_ID ?? `pid-${process.pid}`)
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_');
        const stamp = `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.parked`;
        const target = join(parkedDir, stamp);
        const parkedBody = {
          parkedAt: new Date().toISOString(),
          tool,
          endpoint,
          foreignPath: absPath,
          payload: payload ?? null,
        };
        writeFileSync(target, JSON.stringify(parkedBody));
      }
    } catch (err) {
      // Operator-visible warning — don't crash the producer.
      process.stderr.write(
        `[${source ?? tool}] cross-tenant park failed: ${(err as Error).message}\n`,
      );
    }
  }

  return { ok: false, reason: `cross-tenant ${mode}` };
}

// ─────────────────────────────────────────────────────────────────────
// queueOrPost — producer
// ─────────────────────────────────────────────────────────────────────

function sessionIdFor(opts: QueueOpts): string {
  return (
    opts.sessionId ??
    process.env.DOS_SESSION_ID ??
    process.env.CLAUDE_SESSION_ID ??
    `pid-${process.pid}`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Transport concern (postDirect, postForDrain, parseRetryAfter, applyJitter,
// gzip threshold, fallbackDirectPost) lives in ./dlq-transport. Phase-4
// Cluster T (ISC-8..ISC-15). dlq.ts orchestrates around it via the import
// block at the top of the file. Re-exports of parseRetryAfter and applyJitter
// preserve dlq.test.ts's existing import surface.
// ─────────────────────────────────────────────────────────────────────

function writeReadyAtomic(
  dirs: ResolvedDirs,
  envelope: EnvelopeV2,
  sessionId: string,
): string {
  if (!sameFilesystem(dirs.parent, dirs.pending)) {
    logDrift({ tool: envelope.tool, kind: 'exdev', message: 'parent vs .pending cross-device' });
    throw Object.assign(new Error('EXDEV'), { code: 'EXDEV' });
  }

  const seq = nextSeq(dirs.pending, sessionId);
  const tmp = join(dirs.pending, tmpFilename(sessionId, seq));
  const ready = join(dirs.pending, readyFilename(sessionId, seq));

  const fd = openSync(tmp, 'w', 0o600);
  writeFileSync(fd, JSON.stringify(envelope));
  fsyncSync(fd);
  closeSync(fd);

  renameSync(tmp, ready);
  return ready;
}

const DEFAULT_TIMEOUT_MS = 5000;

interface QueueContext {
  tool: DLQTool;
  endpoint: string;
  envelope: EnvelopeV2;
  dirs: ResolvedDirs | null;
  bootstrapped: boolean;
  timeoutMs: number;
  queueOnly: boolean;
  sessionId: string;
}

type WriteReadyOutcome =
  | { ok: true; readyPath: string }
  | { ok: false; result: QueueResult };

type PostResult = { status: number } | { error: string };

const isHttpOk = (res: PostResult): res is { status: number } =>
  'status' in res && res.status >= 200 && res.status < 300;

function envTimeoutMs(): number | undefined {
  const raw = process.env.DOS_DLQ_TIMEOUT_MS;
  return raw ? Number(raw) : undefined;
}

export async function queueOrPost(
  payload: unknown,
  endpoint: string,
  opts: QueueOpts,
): Promise<QueueResult> {
  installSigtermHandler();
  const ctx = buildQueueContext(payload, endpoint, opts);

  if (!ctx.bootstrapped) return await fallbackDirectPost(ctx);

  // Backpressure (incident 2026-06-22): a queue-only producer must not pile onto
  // an already-pathological .pending. Direct-POST callers are exempt — they ship
  // immediately and unlink on 2xx, so they never grow the queue. The skipped
  // envelope regenerates on the next import once the drain pulls depth under cap.
  if (ctx.queueOnly && ctx.dirs && pendingDepthExceeds(ctx.dirs.pending, pendingCap())) {
    logDrift({ tool: ctx.tool, kind: 'backpressure', endpoint: ctx.endpoint, file: ctx.dirs.pending });
    return { outcome: 'dropped', reason: 'backpressure' };
  }

  const written = tryWriteReady(ctx);
  if (!written.ok) return written.result;

  if (ctx.queueOnly) return queueOnlyResult(ctx, written.readyPath);

  return await postOrLeaveQueued(ctx, written.readyPath);
}

function buildQueueContext(
  payload: unknown,
  endpoint: string,
  opts: QueueOpts,
): QueueContext {
  const timeoutMs = opts.timeoutMs ?? envTimeoutMs() ?? DEFAULT_TIMEOUT_MS;
  const scope: DLQScope = opts.scope ?? 'project';
  const envelope = wrapEnvelope(
    payload,
    endpoint,
    opts.tool,
    opts.idempotencyKey,
    opts.correlationId,
  );
  const dirs = resolveDirs(opts.tool, scope);
  return {
    tool: opts.tool,
    endpoint,
    envelope,
    dirs,
    bootstrapped: bootstrapCheck(dirs),
    timeoutMs,
    queueOnly: opts.queueOnly ?? process.env.DOS_DLQ_QUEUE_ONLY === '1',
    sessionId: sessionIdFor(opts),
  };
}

async function fallbackDirectPost(ctx: QueueContext): Promise<QueueResult> {
  // Phase-4 Cluster T (ISC-8..ISC-15) — the one-shot operator-hint stderr line
  // and the network call live in ./dlq-transport. The orchestrator-side drift
  // log entries (`bootstrap-missing` always, `direct-fallback` on success)
  // stay here so logDrift's buffer is the single chokepoint for sync-drift
  // observability. ISC-33..37 behavior (one hint per process, captured by
  // dlq.test.ts) is preserved by transport's module-scope sentinel.
  logDrift({
    tool: ctx.tool,
    kind: 'bootstrap-missing',
    endpoint: ctx.endpoint,
    message: 'Run: sentinel scan (or: dos bootstrap)',
  });
  const result = await transportFallbackDirectPost({
    tool: ctx.tool,
    toolSubdir: TOOL_TO_SUBDIR[ctx.tool],
    endpoint: ctx.endpoint,
    envelope: ctx.envelope,
    timeoutMs: ctx.timeoutMs,
  });
  if (result.outcome === 'posted') {
    logDrift({
      tool: ctx.tool,
      kind: 'direct-fallback',
      endpoint: ctx.endpoint,
      status: result.status,
    });
    return result;
  }
  return result;
}

function tryWriteReady(ctx: QueueContext): WriteReadyOutcome {
  try {
    const readyPath = writeReadyAtomic(ctx.dirs!, ctx.envelope, ctx.sessionId);
    return { ok: true, readyPath };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EXDEV') {
      return { ok: false, result: { outcome: 'dropped', reason: 'exdev' } };
    }
    if (code === 'ENOENT') {
      logDrift({ tool: ctx.tool, kind: 'rm-rf-detected', message: String(err) });
      return { ok: false, result: { outcome: 'dropped', reason: 'enoent' } };
    }
    logDrift({ tool: ctx.tool, kind: 'post-failed', message: String(err) });
    return { ok: false, result: { outcome: 'dropped', reason: 'write-failed' } };
  }
}

// Hook lifecycle callers (StudioSync children) set DOS_DLQ_QUEUE_ONLY=1 so no
// network I/O happens inside the hook's time budget. DrainPending.hook.ts
// ships the .ready file on the next SessionStart/SessionEnd outside the hook.
function queueOnlyResult(ctx: QueueContext, readyPath: string): QueueResult {
  logDrift({
    tool: ctx.tool,
    kind: 'queued',
    endpoint: ctx.endpoint,
    file: readyPath,
    message: 'queue-only',
  });
  return { outcome: 'queued', path: readyPath, reason: 'queue-only' };
}

async function postOrLeaveQueued(
  ctx: QueueContext,
  readyPath: string,
): Promise<QueueResult> {
  const res = await postDirect(ctx.endpoint, ctx.envelope, ctx.timeoutMs);
  if (isHttpOk(res)) {
    try {
      unlinkSync(readyPath);
    } catch { /* drain will clean it */ }
    logDrift({ tool: ctx.tool, kind: 'posted', endpoint: ctx.endpoint, status: res.status });
    return { outcome: 'posted', status: res.status };
  }
  logDrift({
    tool: ctx.tool,
    kind: 'queued',
    endpoint: ctx.endpoint,
    file: readyPath,
    message: 'status' in res ? `http ${res.status}` : res.error,
  });
  return { outcome: 'queued', path: readyPath, reason: 'post-failed' };
}

// ─────────────────────────────────────────────────────────────────────
// drain — consumer
// ─────────────────────────────────────────────────────────────────────
//
// Phase-4 Cluster D (ISC-16..ISC-22) — drain orchestrator (drain),
// per-tool inner loop (drainQueueDir), and all helpers (quarantine,
// reclaimIfDead, circuitIsOpen, ownedByCurrentUid, readAndValidateEnvelope,
// claim, handlePostSuccess, trip429Circuit, handlePostFailure,
// drainOneReadyEntry, ensureQuarantineDir, emptyDrainReport) moved to
// ./dlq-drain. dlq-drain reaches back into our internal symbols via the
// __drainPort export object below; the public API (drain, DrainMode,
// DrainSource) is re-exported at the top of this file for consumer
// compatibility (DrainPending.hook.ts + dlq.test.ts).

// ─────────────────────────────────────────────────────────────────────
// __drainPort — internal value surface for ./dlq-drain
// ─────────────────────────────────────────────────────────────────────
//
// dlq-drain.ts needs to call into dlq.ts state that, by design, stays here:
// circuit state + helpers, drift logging, dir resolution, filename helpers,
// EXDEV probe, TOOL_TO_SUBDIR, and CIRCUIT_DEFAULT_RETRY_AFTER_SECONDS.
// This object is the single chokepoint for that cross-module call surface,
// avoiding ad-hoc named exports and keeping the public dlq.ts API stable.

export const __drainPort = {
  CIRCUIT_STATE,
  circuitThreshold,
  circuitMultiplier,
  CIRCUIT_DEFAULT_RETRY_AFTER_SECONDS,
  ensureCircuitStateLoaded,
  logDrift,
  flushDrift,
  resolveDirs,
  inflightFilename,
  sameFilesystem,
  TOOL_TO_SUBDIR,
};

// ─────────────────────────────────────────────────────────────────────
// Case-sensitivity probe (APFS) — run once at module load
// ─────────────────────────────────────────────────────────────────────

let CASE_INSENSITIVE_FS_DETECTED = false;

export function isCaseInsensitiveFs(): boolean {
  return CASE_INSENSITIVE_FS_DETECTED;
}

(function probeCaseInsensitive() {
  try {
    const tmpBase = process.env.TMPDIR || '/tmp';
    const a = join(tmpBase, `.dos-case-probe-${process.pid}`);
    const b = join(tmpBase, `.dos-case-probe-${process.pid}`.toUpperCase());
    writeFileSync(a, 'x');
    CASE_INSENSITIVE_FS_DETECTED = existsSync(b);
    try {
      unlinkSync(a);
    } catch { /* best-effort */ }
  } catch {
    CASE_INSENSITIVE_FS_DETECTED = false;
  }
})();

// ─────────────────────────────────────────────────────────────────────
// Public helpers for clients that want custom DLQ access
// ─────────────────────────────────────────────────────────────────────

export const __internals = {
  ENVELOPE_VERSION,
  resolveDirs,
  parseInflight,
  shouldReclaim,
  nextSeq,
  // hooks-007 — reset the in-memory per-session seq counter map so a test can
  // simulate a fresh process re-reading the on-disk .seq file (the cross-
  // process collision condition the pid.rand infix protects against).
  __resetSeqCountersForTests: () => { SEQ_COUNTERS.clear(); },
  readyFilename,
  tmpFilename,
  inflightFilename,
  // Lazy getter — BOOT_EPOCH is imported from ./dlq-drain, which circularly
  // imports back from ./dlq. When a consumer enters the cycle via dlq-drain
  // first (e.g. Tools/dlq-reconcile.ts), this object literal is evaluated
  // before dlq-drain has initialized the BOOT_EPOCH const, so an eager
  // reference throws a TDZ ReferenceError at module load. A getter defers the
  // read until after both modules have finished evaluating.
  get BOOT_EPOCH() { return BOOT_EPOCH; },
  TOOL_TO_SUBDIR,
  INSTALL_ONLY,
  wrapEnvelope,
  resolveProjectSlug,
  // U-G3c — exposed so dlq.test.ts can assert cap + default env behavior
  // without re-implementing the arithmetic in tests.
  retryAfterDefaultMs,
  retryAfterMaxMs,
  // U-G5 — expose for gzip threshold tests
  postDirect,
  GZIP_MIN_BYTES,
  // U-G3d — circuit-break test helpers + introspection
  CIRCUIT_STATE,
  circuitThreshold,
  circuitMultiplier,
  __resetCircuitForTests: () => {
    CIRCUIT_STATE.clear();
    // Cluster P: also remove the persisted file and reset the lazy-load
    // sentinel so the next access re-reads from disk (or sees ENOENT).
    try { unlinkSync(circuitStatePath()); } catch { /* best-effort */ }
    _circuitStateLoaded = false;
    _circuitStateLoadWarned = false;
    _circuitStateFlushWarned = false;
  },
  // Cluster P (ISC-16…ISC-25) — circuit-state persistence test surface
  loadCircuitState,
  flushCircuitState,
  circuitStatePath,
  CIRCUIT_STATE_VERSION,
  // Phase-2 Cluster B (ISC-26..32) — expose budget helper + default for
  // direct assertions without re-implementing the env-parse logic in tests.
  drainEnvelopeBudget,
  // Lazy getter — same dlq ↔ dlq-drain circular-import TDZ as BOOT_EPOCH
  // above: DRAIN_ENVELOPE_BUDGET_FALLBACK is a `const` imported from
  // ./dlq-drain, so an eager reference throws when this object literal is
  // evaluated before dlq-drain finishes initializing (dlq-drain-first entry,
  // e.g. Tools/dlq-reconcile.ts). Deferring the read fixes it.
  get DRAIN_ENVELOPE_BUDGET_FALLBACK() { return DRAIN_ENVELOPE_BUDGET_FALLBACK; },
  // ISC-33..37 — expose sentinel reset so dlq.test.ts can re-arm the
  // one-shot bootstrap-missing hint between assertions without bleeding
  // state across tests in the same `bun test` process. Phase-4 Cluster T
  // moved the sentinel itself into ./dlq-transport; this passthrough
  // preserves the test surface contract.
  __resetBootstrapMissingForTests,
};
