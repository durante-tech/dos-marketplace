/**
 * dlq-drain — drain-layer concern for the Studio sync DLQ
 *
 * Phase-4 sprout from dlq.ts. Owns drainage: drain top-level orchestrator,
 * drainQueueDir per-tool inner loop, drain envelope budget cap (Phase-2
 * Cluster B), reclaim logic (shouldReclaim/parseInflight/isProcessAlive).
 *
 * Re-exported by dlq.ts for back-compat with existing importers
 * (DrainPending.hook.ts imports `drain` from `./lib/dlq`; the shim
 * preserves that surface). Internal drain helpers (claim, quarantine,
 * trip429Circuit, etc.) stay private to this module — not re-exported.
 *
 * Provenance: dlq.ts §drain — consumer (PR1 Primitive #2) plus
 * §Owner-alive reclaim (RedTeam mitigation 1) and §Drain envelope
 * budget (Phase-2 Cluster B, ISC-26..32). Carve performed under
 * Feathers's "smallest carve, re-export shim" prescription + Fowler's
 * Extract Module refactoring (Phase-4 Cluster D, ISC-16..ISC-22 in
 * studio-sync-resilience.md).
 *
 * Public API:
 *   drain(mode)                              — top-level drain orchestrator
 *   drainQueueDir(opts)                      — per-tool inner loop
 *   drainEnvelopeBudget()                    — env-driven budget cap
 *   DRAIN_ENVELOPE_BUDGET_FALLBACK           — default budget (500)
 *
 * Reclaim helpers (re-exported by dlq.ts __internals for tests):
 *   shouldReclaim(dir, name, p99Ms)          — 3-check rule predicate
 *   parseInflight(name)                      — parse {pid}.{epochBoot}
 *   isProcessAlive(pid)                      — kill -0 probe
 *   BOOT_EPOCH                               — system boot epoch (seconds)
 *
 * Types:
 *   DrainMode                                — 'session' | 'startup'
 *   DrainSource                              — 'pending' | 'streaming'
 *   DrainReport                              — re-exported from dlq.ts
 *
 * Internal mutable state:
 *   ACTIVE_INFLIGHT                          — Set of in-flight paths;
 *     dlq.ts's installSigtermHandler iterates this on SIGTERM/SIGINT
 *     to convert .inflight files into .ready.recovered-{pid}.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { uptime as osUptime } from 'node:os';
import { join } from 'node:path';

import { bufferAck, flushAck, rotateAckIfNeeded } from './dlq-ack-ledger';
import { ENVELOPE_VERSION, type EnvelopeV2 } from './dlq-envelope';
import {
  postForDrainWithBody,
  type PostForDrainWithBodyResult,
} from './dlq-transport';
import { tryRepairAndRetry } from './dlq-repair';

// dlq.ts owns: drift logging, circuit state, EXDEV probe, dir resolution,
// filename helpers, TOOL_TO_SUBDIR. We import its internal-but-exported
// value surface (`__drainPort`) for drain to call. Cluster T's transport
// (postForDrain) is imported directly from dlq-transport above.
import {
  __drainPort,
  type DLQScope,
  type DLQTool,
  type DrainReport,
  type ResolvedDirs,
} from './dlq';

// ─────────────────────────────────────────────────────────────────────
// Owner-alive reclaim — 3-check rule
// ─────────────────────────────────────────────────────────────────────

function bootEpochSeconds(): number {
  // Linux: /proc/stat btime <seconds>
  try {
    const s = readFileSync('/proc/stat', 'utf-8');
    const m = s.match(/^btime\s+(\d+)/m);
    if (m && m[1]) return Number.parseInt(m[1], 10);
  } catch { /* not linux */ }

  // macOS: sysctl kern.boottime → via system uptime fallback.
  // os.uptime() returns seconds since SYSTEM boot (not process start), so
  // `now - osUptime()` gives the system boot epoch — stable across the
  // host's lifetime and identical for every process that reads it.
  try {
    const now = Math.floor(Date.now() / 1000);
    const up = Math.floor(osUptime());
    if (up > 0) return now - up;
  } catch { /* fall through */ }

  return 0;
}

export const BOOT_EPOCH = bootEpochSeconds();

export function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export interface InflightParts {
  readyName: string;
  pid: number;
  epochBoot: number;
}

export function parseInflight(name: string): InflightParts | null {
  // {sessionId}-{seq:08d}[.{pid}.{rand}].inflight.{pid}.{epochBoot}
  //
  // hooks-007 added a collision-proof `.{pid}.{rand}` infix to ready/tmp
  // names so concurrent sibling sync tools sharing a parent .pending/ never
  // produce the same filename. inflightFilename strips `.ready$` and appends
  // `.inflight.{pid}.{epochBoot}`, so that infix survives into the inflight
  // name. The prefix capture must therefore reconstruct the WHOLE ready stem
  // (seq + optional infix), not just `{stem}-{8digit}` — otherwise reclaim
  // can't rename a stranded .inflight back to its real .ready. Anchor on the
  // last `.inflight.{pid}.{epochBoot}` suffix and treat everything before it
  // as the ready stem; legacy names with no infix still match.
  const m = name.match(/^(.+\-\d{8}(?:\..+)?)\.inflight\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return {
    readyName: `${m[1]}.ready`,
    pid: Number.parseInt(m[2]!, 10),
    epochBoot: Number.parseInt(m[3]!, 10),
  };
}

export function shouldReclaim(
  pendingDir: string,
  inflightName: string,
  p99Ms: number,
): boolean {
  const parts = parseInflight(inflightName);
  if (!parts) return false;

  if (isProcessAlive(parts.pid)) return false;

  if (parts.epochBoot === BOOT_EPOCH) return false;

  let mtime: number;
  try {
    mtime = statSync(join(pendingDir, inflightName)).mtimeMs;
  } catch {
    return false;
  }

  const ageMs = Date.now() - mtime;
  const reclaimThresholdMs = Math.max(120_000, 2 * p99Ms);
  return ageMs > reclaimThresholdMs;
}

// ─────────────────────────────────────────────────────────────────────
// Drain envelope budget — Phase-2 Cluster B (ISC-26..32)
//
// `drain()` walks every tool × every scope × {.pending, .streaming}. During
// extended Studio outages the queues can accumulate hundreds of thousands of
// envelopes; a single drain pass would then slam the gateway with sustained
// throughput once it returns ("thunderpost"). The global budget caps total
// envelopes attempted per `drain()` invocation. When hit, drain breaks the
// outer per-tool loop and exits cleanly — remaining tools wait for the next
// invocation. Budget hit ≠ 429: CIRCUIT_STATE is NOT touched.
//
// Counter increments on `aggregate.read` after each `drainQueueDir` call —
// post-attempt accounting so we count actual work done, not aspirational
// scans. Per-tool fairness is NOT implemented in v1: a single noisy tool
// can exhaust the budget. TODO: round-robin scheduler if this becomes a
// real issue. For now, log + tolerate.
// ─────────────────────────────────────────────────────────────────────

export const DRAIN_ENVELOPE_BUDGET_FALLBACK = 500;

export function drainEnvelopeBudget(): number {
  const env = process.env.DOS_DLQ_DRAIN_MAX_ENVELOPES_PER_INVOCATION;
  if (env === undefined) return DRAIN_ENVELOPE_BUDGET_FALLBACK;
  const n = Number.parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : DRAIN_ENVELOPE_BUDGET_FALLBACK;
}

// ─────────────────────────────────────────────────────────────────────
// drain — consumer
// ─────────────────────────────────────────────────────────────────────

export type DrainMode = 'session' | 'startup';
export type DrainSource = 'pending' | 'streaming';

interface DrainOptions {
  tool: DLQTool;
  dirs: ResolvedDirs;
  queuePath: string;
  source: DrainSource;
  p99Ms: number;
  timeoutMs: number;
  /**
   * Max .ready envelopes to drain from this dir in a single call. Used by
   * the round-robin scheduler in `drain()` to prevent any one tool from
   * starving the others within one invocation. Omit (or pass Infinity)
   * to drain everything.
   */
  sliceLimit?: number;
}

/**
 * Concurrent .ready POST count inside drainQueueDir. Tune down if Studio
 * shows 429s (the per-tool circuit breaker still catches that).
 */
const ENVELOPE_CONCURRENCY_FALLBACK = 10;
function envelopeConcurrency(): number {
  const env = process.env.DOS_DLQ_DRAIN_CONCURRENCY;
  if (env === undefined) return ENVELOPE_CONCURRENCY_FALLBACK;
  const n = Number.parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : ENVELOPE_CONCURRENCY_FALLBACK;
}

/**
 * Bound the SIGTERM data-loss window for the local ack ledger by flushing
 * mid-drain. flushAck also runs at end-of-drain regardless.
 */
const ACK_FLUSH_EVERY = 100;

type QuarantineReason = 'uid-mismatch' | 'shape' | `v${number}`;
type QuarantineKind = 'quarantined-uid' | 'quarantined-shape' | 'quarantined-version';

// PRD ISC-B1..B9 + D-2026-05-05-1 — 4xx classification for the bleed-stop.
//
// The drainer used to renameSync(.inflight → .ready) for every non-2xx
// response. That meant 400 / 404 / 410 / 422 looped forever, hammering
// Studio with payloads that would never succeed. classifyFailure converts
// the raw HTTP outcome into one of five buckets:
//
//   retry              — re-queue the envelope (with bumped attempts)
//   quarantine-poison  — 400 / 410 / 413 / 422 after N=3 attempts
//   quarantine-route   — 404 IMMEDIATE (route gone, no retry helps)
//   quarantine-auth    — 401 / 403 after N=1 attempt (one chance for transient)
//   drop               — reserved for future use; never returned today
//
// Net: 429 still trips the circuit (handled separately by caller); 408
// and 5xx are transient retries; network errors are transient retries.
// Anything unhandled is conservatively retried (we'd rather waste a
// drain cycle than discard a valid envelope on an unfamiliar status).

export type FailureBucket =
  | { action: 'retry'; reason: string }
  | { action: 'quarantine-poison'; reason: string }
  | { action: 'quarantine-route'; reason: string }
  | { action: 'quarantine-auth'; reason: string }
  | { action: 'drop'; reason: string };

type FailureLike =
  | { status: number; retryAfterSeconds?: number; body?: string }
  | { error: string };

const POISON_THRESHOLD = 3;
const AUTH_THRESHOLD = 1;

/**
 * A POST outcome the drainer treats as TERMINAL SUCCESS: any 2xx, plus 409.
 *
 * Studio returns 409 Conflict when an idempotency-keyed POST has already
 * landed. Because every DOS Studio route derives its idempotency key from a
 * hash of rawBody (R-DLQ-1), a 409 means the exact row is already durably
 * persisted server-side — the work is done. It must therefore be acked +
 * removed, exactly like a 2xx: NOT retried (the un-handled-409 path looped
 * 35k+ envelopes/day, attempts climbing to 382) and NOT quarantined (there is
 * nothing to review — the data is safe). The ack lets producer-side dedup skip
 * the row forever after. [council: GregYoung idempotent-consumer verdict]
 */
export function isTerminalSuccess(status: number): boolean {
  return (status >= 200 && status < 300) || status === 409;
}

export function classifyFailure(res: FailureLike, attempts: number): FailureBucket {
  if ('error' in res) return { action: 'retry', reason: `network: ${res.error}` };
  const s = res.status;
  if (isTerminalSuccess(s)) {
    // 2xx and 409 are success-equivalents and are routed to handlePostSuccess
    // upstream (drainOneReadyEntry) — they must never reach the failure
    // classifier. Fail loud so any future routing drift is caught in tests.
    throw new Error(`classifyFailure called on success-equivalent status ${s}`);
  }
  if (s === 404) {
    // Studio returns JSON on a real missing route; an HTML body means a
    // different process answered the port (wrong dev server, mid-restart).
    // Retry rather than fatally quarantine.
    const body = ('body' in res ? res.body ?? '' : '').trimStart();
    if (body.startsWith('<')) {
      return { action: 'retry', reason: 'wrong-server 404 (HTML body — Studio not answering)' };
    }
    return { action: 'quarantine-route', reason: 'route missing' };
  }
  if (s === 401 || s === 403) {
    return attempts >= AUTH_THRESHOLD
      ? { action: 'quarantine-auth', reason: `auth ${s}` }
      : { action: 'retry', reason: `auth ${s} (first attempt)` };
  }
  if (s === 429) {
    return { action: 'retry', reason: 'rate limited (circuit handles)' };
  }
  if (s === 408 || s >= 500) {
    return { action: 'retry', reason: `server ${s}` };
  }
  if (s === 400 || s === 410 || s === 413 || s === 422) {
    return attempts >= POISON_THRESHOLD
      ? { action: 'quarantine-poison', reason: `${s} after ${attempts} attempts` }
      : { action: 'retry', reason: `${s} (attempt ${attempts}/${POISON_THRESHOLD})` };
  }
  return { action: 'retry', reason: `unhandled ${s}` };
}

// Drift-log kinds emitted by the new failure path. Cast at logDrift
// callsite — __drainPort.logDrift's union doesn't list these yet.
type QuarantineBucketKind = 'quarantined-4xx' | 'quarantined-route' | 'quarantined-auth';

function bucketSubdir(action: FailureBucket['action']): string {
  switch (action) {
    case 'quarantine-poison': return '4xx';
    case 'quarantine-route': return 'route';
    case 'quarantine-auth': return 'auth';
    default: return 'unknown';
  }
}

function bucketKind(action: FailureBucket['action']): QuarantineBucketKind {
  switch (action) {
    case 'quarantine-poison': return 'quarantined-4xx';
    case 'quarantine-route': return 'quarantined-route';
    case 'quarantine-auth': return 'quarantined-auth';
    default: return 'quarantined-4xx';
  }
}

interface SidecarReason {
  status: number | null;
  body_excerpt: string;
  classifiedAt: string;
  correlationId: string | null;
  idempotencyKey: string | null;
  reason: string;
  attempts: number;
}

const BODY_EXCERPT_MAX = 4096;

function buildSidecar(
  res: FailureLike,
  envelope: EnvelopeV2,
  body: string,
  reason: string,
  attempts: number,
): SidecarReason {
  const excerpt = body.length > BODY_EXCERPT_MAX
    ? body.slice(0, BODY_EXCERPT_MAX)
    : body;
  return {
    status: 'status' in res ? res.status : null,
    body_excerpt: excerpt,
    classifiedAt: new Date().toISOString(),
    correlationId: envelope.correlationId ?? null,
    idempotencyKey: envelope.idempotencyKey ?? null,
    reason,
    attempts,
  };
}

function quarantineToBucket(
  inflightPath: string,
  name: string,
  bucket: 'quarantine-poison' | 'quarantine-route' | 'quarantine-auth',
  sidecar: SidecarReason,
  opts: DrainOptions,
  report: DrainReport,
): boolean {
  const sub = bucketSubdir(bucket);
  const targetDir = ensureQuarantineDir(opts.dirs, sub);
  if (!targetDir) {
    // Couldn't create the quarantine dir — fall through to caller for retry.
    report.errors.push({ file: name, reason: `quarantine-mkdir-failed:${sub}` });
    return false;
  }
  const target = join(targetDir, name);
  try {
    renameSync(inflightPath, target);
  } catch (err) {
    report.errors.push({ file: name, reason: `quarantine-rename-failed:${String(err)}` });
    return false;
  }
  // Best-effort sidecar — non-fatal if the write fails (we still moved the
  // envelope; operator can re-classify by hand from the file body).
  try {
    const sidecarPath = `${target}.reason.json`;
    writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2), { mode: 0o600 });
  } catch { /* non-fatal */ }
  report.quarantined++;
  return true;
}

/**
 * Atomic in-place re-write of a `.inflight.{pid}.{boot}` envelope file with
 * a bumped `attempts` counter, then rename back to `.ready`. This is the
 * retry path's persistence step — the next drainer will see the new
 * counter and apply the N-strike threshold correctly.
 *
 * Atomicity: write to `.tmp.attempts.<rand>` next door, fsync, rename onto
 * the .ready target. A crash between rewriteWithBumpedAttempts and the
 * eventual unlinkSync(.inflight) leaves the original .inflight intact for
 * the SIGTERM/reclaim path to recover. Worst case: one extra retry.
 *
 * Returns true on success; false leaves the caller to fall back to the
 * original "rename .inflight → .ready without bump" behavior so we never
 * lose the envelope.
 */
function rewriteWithBumpedAttempts(
  inflightPath: string,
  readyPath: string,
  envelope: EnvelopeV2,
  nextAttempts: number,
): boolean {
  const dir = inflightPath.slice(0, inflightPath.lastIndexOf('/'));
  const tmp = join(dir, `.tmp.attempts.${process.pid}.${Math.random().toString(36).slice(2, 8)}`);
  const updated: EnvelopeV2 = { ...envelope, attempts: nextAttempts };
  let fd: number | undefined;
  try {
    fd = openSync(tmp, 'w', 0o600);
    writeFileSync(fd, JSON.stringify(updated));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    // Two-step: replace .inflight contents via tmp→inflight rename, then
    // rename .inflight→.ready. We do tmp→.ready directly and unlink the
    // .inflight as the second step; that is atomic-equivalent (the .ready
    // target appears with the right contents in one rename) and removes
    // a window where a concurrent reclaim could see the old contents.
    renameSync(tmp, readyPath);
    try { unlinkSync(inflightPath); } catch { /* best-effort */ }
    return true;
  } catch {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* best-effort */ }
    }
    try { unlinkSync(tmp); } catch { /* best-effort */ }
    return false;
  }
}

// In-flight tracker — drainOneReadyEntry adds/removes per envelope; the
// SIGTERM handler in dlq.ts iterates this set to convert .inflight files
// to .ready.recovered-{pid} on graceful shutdown.
export const ACTIVE_INFLIGHT: Set<string> = new Set();

function emptyDrainReport(): DrainReport {
  return { read: 0, posted: 0, requeued: 0, quarantined: 0, reclaimed: 0, errors: [] };
}

function quarantine(
  full: string,
  name: string,
  opts: DrainOptions,
  report: DrainReport,
  reason: QuarantineReason,
  kind: QuarantineKind,
): void {
  const q = ensureQuarantineDir(opts.dirs, reason);
  if (!q) return;
  try {
    renameSync(full, join(q, name));
    report.quarantined++;
    __drainPort.logDrift({ tool: opts.tool, kind, file: name });
  } catch { /* best-effort */ }
}

function reclaimIfDead(name: string, opts: DrainOptions, report: DrainReport): void {
  if (!shouldReclaim(opts.queuePath, name, opts.p99Ms)) return;
  const parts = parseInflight(name);
  if (!parts) return;
  try {
    renameSync(join(opts.queuePath, name), join(opts.queuePath, parts.readyName));
    report.reclaimed++;
    __drainPort.logDrift({ tool: opts.tool, kind: 'reclaimed', file: name });
  } catch (err) {
    report.errors.push({ file: name, reason: String(err) });
  }
}

// hooks-008 — keyed by envelope.endpoint, not opts.tool. `tool` is still
// passed for drift telemetry (so the log line attributes the pause to the
// nominal tool), but the gate/state lookup uses the endpoint locus.
function circuitIsOpen(endpoint: string, tool: DLQTool): boolean {
  __drainPort.ensureCircuitStateLoaded();
  const state = __drainPort.CIRCUIT_STATE.get(endpoint);
  if (!state || state.resumeAt === 0) return false;
  if (Date.now() < state.resumeAt) return true;
  __drainPort.logDrift({ tool, kind: 'circuit-close', consecutive429: state.consecutive429 });
  __drainPort.CIRCUIT_STATE.delete(endpoint);
  return false;
}

function ownedByCurrentUid(
  full: string,
  name: string,
  opts: DrainOptions,
  report: DrainReport,
): boolean {
  try {
    const st = statSync(full);
    if (st.uid === process.getuid?.()) return true;
    quarantine(full, name, opts, report, 'uid-mismatch', 'quarantined-uid');
    return false;
  } catch (err) {
    report.errors.push({ file: name, reason: String(err) });
    return false;
  }
}

function readAndValidateEnvelope(
  full: string,
  name: string,
  opts: DrainOptions,
  report: DrainReport,
): EnvelopeV2 | null {
  let envelope: EnvelopeV2;
  try {
    envelope = JSON.parse(readFileSync(full, 'utf-8')) as EnvelopeV2;
  } catch (err) {
    quarantine(full, name, opts, report, 'shape', 'quarantined-shape');
    report.errors.push({ file: name, reason: String(err) });
    return null;
  }
  if (envelope.version !== ENVELOPE_VERSION) {
    quarantine(full, name, opts, report, `v${envelope.version}`, 'quarantined-version');
    return null;
  }
  return envelope;
}

function claim(full: string, name: string, opts: DrainOptions): string | null {
  const inflightPath = join(
    opts.queuePath,
    __drainPort.inflightFilename(name, process.pid, BOOT_EPOCH),
  );
  try {
    renameSync(full, inflightPath);
    return inflightPath;
  } catch {
    return null; // another drainer claimed it
  }
}

function handlePostSuccess(
  inflightPath: string,
  envelope: EnvelopeV2,
  opts: DrainOptions,
  res: { status: number },
  report: DrainReport,
  name: string,
): void {
  try { unlinkSync(inflightPath); } catch { /* best-effort */ }
  report.posted++;
  // U-G3d: any 2xx closes the circuit for this endpoint. Emit
  // `circuit-close` if it was tripped; always clear state.
  // hooks-008 — keyed by envelope.endpoint so a recovery on one route only
  // closes that route's circuit, never a parent-mate's.
  __drainPort.ensureCircuitStateLoaded();
  const prior = __drainPort.CIRCUIT_STATE.get(envelope.endpoint);
  if (prior && prior.resumeAt > 0) {
    __drainPort.logDrift({ tool: opts.tool, kind: 'circuit-close', consecutive429: prior.consecutive429 });
  }
  __drainPort.CIRCUIT_STATE.delete(envelope.endpoint);
  __drainPort.logDrift({ tool: opts.tool, kind: 'drained', file: name, status: res.status });
  // PR3a: witness ack on every successful POST (both pending + streaming).
  bufferAck({
    endpoint: envelope.endpoint,
    idempotencyKey: envelope.idempotencyKey,
    status: res.status,
    source: opts.source,
    drainedAt: new Date().toISOString(),
    capturedAt: envelope.capturedAt,
  });
}

// hooks-008 — circuit is tripped per envelope.endpoint, not per opts.tool, so
// a 429 storm on one route pauses only that route. `opts.tool` is retained for
// drift telemetry attribution.
function trip429Circuit(
  endpoint: string,
  opts: DrainOptions,
  retryAfterSeconds: number | undefined,
): void {
  __drainPort.ensureCircuitStateLoaded();
  const prior = __drainPort.CIRCUIT_STATE.get(endpoint) ?? { consecutive429: 0, resumeAt: 0 };
  const next = { consecutive429: prior.consecutive429 + 1, resumeAt: prior.resumeAt };
  const threshold = __drainPort.circuitThreshold();
  if (next.consecutive429 >= threshold && next.resumeAt === 0) {
    const secs = retryAfterSeconds ?? __drainPort.CIRCUIT_DEFAULT_RETRY_AFTER_SECONDS;
    const pauseMs = secs * 1000 * __drainPort.circuitMultiplier();
    next.resumeAt = Date.now() + pauseMs;
    __drainPort.logDrift({
      tool: opts.tool,
      kind: 'circuit-open',
      consecutive429: next.consecutive429,
      resumeAt: next.resumeAt,
      pauseMs,
      retryAfterSeconds: secs,
    });
  }
  __drainPort.CIRCUIT_STATE.set(endpoint, next);
}

/**
 * Last-resort requeue path — used when the bumped-attempts rewrite fails.
 * Preserves the legacy behavior (rename .inflight → .ready, no counter bump)
 * so an envelope is never lost on filesystem hiccups. Counter stays at the
 * pre-failure value; next drain will increment it.
 */
function requeueWithoutBump(
  inflightPath: string,
  full: string,
  name: string,
  report: DrainReport,
): void {
  try {
    renameSync(inflightPath, full);
    report.requeued++;
  } catch (err) {
    report.errors.push({ file: name, reason: String(err) });
  }
}

/**
 * Post-failure dispatch for the bleed-stop:
 *
 *   1. Compute nextAttempts = (envelope.attempts ?? 0) + 1.
 *   2. If status === 400 AND attempts === 1 AND body parses as
 *      `idempotency_key_mismatch`, run the Repair Adapter.
 *   3. Classify into a FailureBucket and route:
 *      - retry              → atomic rewrite with bumped attempts → .ready
 *      - quarantine-poison  → move .inflight to .quarantine/4xx/ + sidecar
 *      - quarantine-route   → move .inflight to .quarantine/route/ + sidecar
 *      - quarantine-auth    → move .inflight to .quarantine/auth/ + sidecar
 *      - drop               → unreachable today (throws)
 *   4. 429 still trips the per-tool circuit (independent of bucketing).
 *
 * On any unexpected error path, fall through to requeueWithoutBump so we
 * never lose the envelope. Quarantine moves are best-effort: a failed
 * mkdir leaves the envelope re-driveable.
 */
async function handlePostFailure(
  inflightPath: string,
  full: string,
  opts: DrainOptions,
  res: PostForDrainWithBodyResult,
  envelope: EnvelopeV2,
  report: DrainReport,
  name: string,
): Promise<void> {
  const priorAttempts = typeof envelope.attempts === 'number' ? envelope.attempts : 0;
  const nextAttempts = priorAttempts + 1;
  const status = 'status' in res ? res.status : undefined;
  const body = 'status' in res ? res.body : '';

  // 429 still trips the per-tool circuit, regardless of bucketing.
  // (FailureBucket maps 429→retry; the circuit is the throughput-shaping
  // signal that lives orthogonally on top.)
  if ('status' in res && res.status === 429) {
    trip429Circuit(envelope.endpoint, opts, res.retryAfterSeconds);
  }

  // PRD ISC-H4 — Repair Adapter for idempotency-key drift. Only runs on
  // 400 + first attempt; subsequent visits fall through to the classifier
  // (which will quarantine after N=3). The repair adapter performs ONE
  // additional POST with the corrected key; on success it has the same
  // effect as a normal 2xx (envelope is gone, drift records `drained`).
  if (status === 400 && priorAttempts === 0 && body.length > 0) {
    const repair = await tryRepairAndRetry(envelope, body, {
      endpoint: envelope.endpoint,
      timeoutMs: opts.timeoutMs,
    });
    if (repair.outcome === 'repaired') {
      try { unlinkSync(inflightPath); } catch { /* best-effort */ }
      report.posted++;
      __drainPort.logDrift({
        tool: opts.tool,
        kind: 'drained',
        file: name,
        status: repair.status,
      });
      bufferAck({
        endpoint: envelope.endpoint,
        idempotencyKey: envelope.idempotencyKey,
        status: repair.status,
        source: opts.source,
        drainedAt: new Date().toISOString(),
        capturedAt: envelope.capturedAt,
      });
      return;
    }
    // Unrepairable — fall through to standard classification with the
    // unrepairable reason captured in drift telemetry.
    __drainPort.logDrift({
      tool: opts.tool,
      kind: 'post-failed',
      file: name,
      status: 400,
      message: `repair-unrepairable: ${repair.reason}`,
    });
  }

  const bucket = classifyFailure(res, nextAttempts);

  if (bucket.action === 'retry') {
    const ok = rewriteWithBumpedAttempts(inflightPath, full, envelope, nextAttempts);
    if (ok) {
      report.requeued++;
    } else {
      requeueWithoutBump(inflightPath, full, name, report);
    }
    __drainPort.logDrift({
      tool: opts.tool,
      kind: 'post-failed',
      file: name,
      status,
      message: 'error' in res ? res.error : bucket.reason,
    });
    return;
  }

  if (bucket.action === 'drop') {
    // Reserved bucket — unreachable today. Fail loud rather than silently
    // discarding so any future drift is caught in tests.
    requeueWithoutBump(inflightPath, full, name, report);
    throw new Error(`classifyFailure returned 'drop' for ${name}; not implemented`);
  }

  // Quarantine path — move to bucket subdir, emit sidecar, log drift.
  const sidecar = buildSidecar(res, envelope, body, bucket.reason, nextAttempts);
  const moved = quarantineToBucket(inflightPath, name, bucket.action, sidecar, opts, report);
  if (!moved) {
    // Quarantine move failed — preserve the envelope by requeuing.
    requeueWithoutBump(inflightPath, full, name, report);
    return;
  }
  __drainPort.logDrift({
    tool: opts.tool,
    kind: bucketKind(bucket.action),
    file: name,
    status,
    message: bucket.reason,
  } as Parameters<typeof __drainPort.logDrift>[0]);
}

async function drainOneReadyEntry(
  name: string,
  opts: DrainOptions,
  report: DrainReport,
): Promise<void> {
  const full = join(opts.queuePath, name);
  report.read++;

  if (!ownedByCurrentUid(full, name, opts, report)) return;
  const envelope = readAndValidateEnvelope(full, name, opts, report);
  if (!envelope) return;

  // hooks-008 — gate by the envelope's endpoint circuit (the real rate-limit
  // locus), not by opts.tool. The check moved below envelope parse so the
  // per-route key is available; a 429-tripped route only pauses its own
  // envelopes, never a parent-mate's healthy endpoint. report.read is already
  // incremented (the entry WAS inspected); skipping leaves the .ready in place
  // for the next pass, same as the prior early-return contract.
  if (circuitIsOpen(envelope.endpoint, opts.tool)) return;

  const inflightPath = claim(full, name, opts);
  if (!inflightPath) return;

  ACTIVE_INFLIGHT.add(inflightPath);
  try {
    const res = await postForDrainWithBody(envelope.endpoint, envelope, opts.timeoutMs);
    if ('status' in res && isTerminalSuccess(res.status)) {
      // 2xx OR 409: the row is durably in Studio (409 = idempotent dup,
      // R-DLQ-1). Ack + remove via the existing success path; never retry.
      handlePostSuccess(inflightPath, envelope, opts, res, report, name);
    } else {
      await handlePostFailure(inflightPath, full, opts, res, envelope, report, name);
    }
  } finally {
    ACTIVE_INFLIGHT.delete(inflightPath);
  }
}

// ─────────────────────────────────────────────────────────────────────
// .seq reaper — incident 2026-06-24
// ─────────────────────────────────────────────────────────────────────
// nextSeq() (dlq.ts) persists a `.seq.<sessionId>` counter and never deletes
// it; per-pid fallback session ids leak one file per PID. Reap stale ones,
// bounded per pass. Live envelope filenames carry a pid.rand uniq infix, so a
// reset ordinal after a reap can never collide — the reset is cosmetic.
const SEQ_TTL_MS = (() => {
  const raw = process.env.DOS_DLQ_SEQ_TTL_MS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 6 * 60 * 60 * 1000; // 6h default
})();
const SEQ_REAP_MAX_PER_PASS = (() => {
  const raw = process.env.DOS_DLQ_SEQ_REAP_MAX;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 500;
})();

function reapStaleSeqFiles(entries: string[], queuePath: string): number {
  const now = Date.now();
  let reaped = 0;
  for (const name of entries) {
    if (reaped >= SEQ_REAP_MAX_PER_PASS) break;
    if (!name.startsWith('.seq.')) continue;
    const p = join(queuePath, name);
    try {
      const st = statSync(p);
      if (now - st.mtimeMs < SEQ_TTL_MS) continue; // fresh → owning session may be live
      unlinkSync(p);
      reaped++;
    } catch {
      /* raced with another reaper / writer → skip */
    }
  }
  return reaped;
}

export async function drainQueueDir(opts: DrainOptions): Promise<DrainReport> {
  const report = emptyDrainReport();

  if (!__drainPort.sameFilesystem(opts.dirs.parent, opts.queuePath)) {
    __drainPort.logDrift({
      tool: opts.tool,
      kind: 'exdev',
      message: `drain detected cross-device (${opts.source})`,
    });
    return report;
  }

  let entries: string[];
  try {
    entries = readdirSync(opts.queuePath);
  } catch {
    return report;
  }

  const slice = opts.sliceLimit ?? Infinity;
  const ready: string[] = [];

  // Bounded .seq reaper (incident 2026-06-24): nextSeq() writes one
  // `.seq.<sessionId>` counter file per session and never unlinks it. For
  // short-lived hook subprocesses sessionId falls back to `pid-<pid>`, so a
  // distinct file leaks per PID — 6,962 observed in STATE/.pending, growing.
  // They are inert to the drainer (filtered by the `.` guard below) but bloat
  // the dir and the backpressure count. Reap any `.seq.*` whose mtime is older
  // than the TTL, capped per pass so this never dominates a drain.
  reapStaleSeqFiles(entries, opts.queuePath);

  for (const name of entries) {
    if (name.startsWith('.')) continue;
    if (name.includes('.inflight.')) {
      reclaimIfDead(name, opts, report);
      continue;
    }
    // RedTeam A2 mitigation — no `.json` catchall.
    if (!name.endsWith('.ready')) continue;
    ready.push(name);
    if (ready.length >= slice) break;
  }

  // Concurrent batch POSTs. JS single-threaded → report.read++ and
  // ACTIVE_INFLIGHT mutations are race-free. Only the network I/O parallelizes.
  // drainQueueDir itself is serialized per parent dir by the scheduler in
  // drain(), preserving claim/.inflight rename invariants.
  const concurrency = envelopeConcurrency();
  let processedSinceFlush = 0;
  for (let i = 0; i < ready.length; i += concurrency) {
    const batch = ready.slice(i, i + concurrency);
    await Promise.all(batch.map((name) => drainOneReadyEntry(name, opts, report)));
    processedSinceFlush += batch.length;
    if (processedSinceFlush >= ACK_FLUSH_EVERY) {
      try { flushAck(); } catch { /* best-effort */ }
      processedSinceFlush = 0;
    }
  }

  return report;
}


function ensureQuarantineDir(dirs: ResolvedDirs, sub: string): string | null {
  const q = join(dirs.quarantine, sub);
  try {
    if (!existsSync(dirs.quarantine)) {
      // This is the ONE mkdir allowed — quarantine is a safety net, not the DLQ itself.
      mkdirSync(dirs.quarantine, { recursive: true, mode: 0o700 });
    }
    if (!existsSync(q)) mkdirSync(q, { recursive: true, mode: 0o700 });
    return q;
  } catch {
    return null;
  }
}

export async function drain(mode: DrainMode = 'session'): Promise<DrainReport> {
  // mode is part of the public contract (DrainPending.hook passes 'startup'
  // on SessionStart, 'session' otherwise). Reserved for future per-mode
  // telemetry and behavior; current implementation is uniform.
  void mode;

  const timeoutMs = process.env.DOS_DLQ_TIMEOUT_MS
    ? Number(process.env.DOS_DLQ_TIMEOUT_MS)
    : 5000;
  const p99Ms = process.env.DOS_SESSION_END_P99_MS
    ? Number(process.env.DOS_SESSION_END_P99_MS)
    : 60_000;

  const aggregate: DrainReport = {
    read: 0,
    posted: 0,
    requeued: 0,
    quarantined: 0,
    reclaimed: 0,
    errors: [],
  };

  // PR3a: seal yesterday's ack.jsonl into the manifest if not already sealed.
  rotateAckIfNeeded();

  // Build a flat per-(tool, queue) work list. Same-parent dedup collapses
  // duplicate (project, install) scope hits AND tools that intentionally
  // share a parent dir (e.g. STATE for sessions/kg/memory-snapshots/…) —
  // each parent is drained once per pass, with envelope.endpoint driving
  // the actual POST destination per row. Budget-slice each item evenly so
  // no single tool starves the others.
  const envelopeBudget = drainEnvelopeBudget();
  type WorkItem = Pick<DrainOptions, 'tool' | 'dirs' | 'queuePath' | 'source'>;
  const work: WorkItem[] = [];
  const seenParents = new Set<string>();
  for (const tool of Object.keys(__drainPort.TOOL_TO_SUBDIR) as DLQTool[]) {
    for (const scope of ['project', 'install'] as DLQScope[]) {
      const dirs = __drainPort.resolveDirs(tool, scope);
      if (!dirs) continue;
      if (seenParents.has(dirs.parent)) continue;
      seenParents.add(dirs.parent);
      if (existsSync(dirs.pending)) {
        work.push({ tool, dirs, queuePath: dirs.pending, source: 'pending' });
      }
      const streamingPath = join(dirs.parent, '.streaming');
      if (existsSync(streamingPath)) {
        work.push({ tool, dirs, queuePath: streamingPath, source: 'streaming' });
      }
    }
  }

  // Single pass, no rounds — re-rounding would re-process .ready files
  // that 5xx/network retries renamed back into the queue, ballooning
  // `attempts` without real progress. Multiple drain calls (every session
  // boundary fires DrainPending) finish the queue.
  const perItemSlice = Math.max(50, Math.floor(envelopeBudget / Math.max(1, work.length)));
  for (const item of work) {
    if (aggregate.read >= envelopeBudget) break;
    const remaining = envelopeBudget - aggregate.read;
    const r = await drainQueueDir({
      ...item,
      p99Ms,
      timeoutMs,
      sliceLimit: Math.min(perItemSlice, remaining),
    });
    aggregate.read += r.read;
    aggregate.posted += r.posted;
    aggregate.requeued += r.requeued;
    aggregate.quarantined += r.quarantined;
    aggregate.reclaimed += r.reclaimed;
    aggregate.errors.push(...r.errors);
  }

  if (aggregate.read >= envelopeBudget) {
    process.stderr.write(
      `[dlq.drain] budget hit (${aggregate.read} / max=${envelopeBudget} envelopes); remaining tools deferred to next drain pass\n`,
    );
  }

  flushAck();
  __drainPort.flushDrift();
  return aggregate;
}
