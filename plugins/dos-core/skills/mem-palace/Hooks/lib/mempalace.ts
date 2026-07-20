/**
 * Centralized MemPalace invocation for DOS hooks.
 *
 * ALL hooks that call the MemPalace bridge should use this module instead of
 * hardcoding the `uv run --with mempalace python bridge.py` command array.
 * This gives us ONE place to control:
 *   - The mempalace package source (PyPI vs local path)
 *   - The bridge script path
 *   - Timeout defaults
 *   - Common spawn patterns (sync vs fire-and-forget)
 *
 * Plugin mode uses the exact vendored-patches.lock pin; maintainer mode keeps
 * its historical MEMPALACE_PKG_SPEC override/range behavior.
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { homedir, tmpdir } from 'os';
import { fileURLToPath } from 'url';
import {
  applyPluginEnvSeams,
  buildPluginPythonLaunch,
  isPluginInstall,
  PLUGIN_CODE_PATHS,
} from './plugin-data-env';

const RUNTIME_ENV = applyPluginEnvSeams(process.env);
const DOS_DIR = RUNTIME_ENV.DOS_DIR || join(homedir(), '.claude');
const THIS_FILE_DIR = dirname(fileURLToPath(import.meta.url));

/** The bridge script that hooks call. */
export const BRIDGE_PATH = isPluginInstall(RUNTIME_ENV)
  ? PLUGIN_CODE_PATHS.bridgePath
  : join(DOS_DIR, 'DOS', 'Tools', 'mempalace_bridge.py');
export const BRIDGE_WORKER_PATH = isPluginInstall(RUNTIME_ENV)
  ? PLUGIN_CODE_PATHS.observedBridgeWorkerPath
  : join(DOS_DIR, 'hooks', 'ObservedBridgeWorker.ts');

/**
 * MemPalace package spec for `uv run --with`.
 *
 * Priority: MEMPALACE_PKG_SPEC env var → upstream PyPI `mempalace>=3.4.1,<4`.
 * The lower bound is pinned to 3.4.1: 3.4.0 shipped an embedding-OOM-in-repair
 * bug that forked unpruned full-size palace copies and froze the host
 * (incident 2026-06-22); 3.4.1 (2026-06-15) batches embeds at 32 docs and adds
 * max_backups=10 auto-pruning. The earlier 3.3.5 floor closed a separate
 * resolution split (uv resolving a stale cached 3.3.4 vs system 3.3.5; PRD
 * 20260528 pure-uv migration). Operators can override via `MEMPALACE_PKG_SPEC`.
 */
const MEMPALACE_PKG_SPEC = process.env.MEMPALACE_PKG_SPEC
  || 'mempalace>=3.4.1,<4';

/**
 * Build the command prefix array for invoking the bridge via uv.
 * Returns: ['uv', 'run', '--with', '<spec>', 'python', '<bridge_path>']
 */
export function bridgeCmd(): string[] {
  if (isPluginInstall(RUNTIME_ENV)) {
    return buildPluginPythonLaunch([BRIDGE_PATH], RUNTIME_ENV).cmd;
  }
  return ['uv', 'run', '--with', MEMPALACE_PKG_SPEC, 'python', BRIDGE_PATH];
}

/**
 * Build a full command array for a bridge action.
 * Returns: [...bridgeCmd(), action, JSON.stringify(args)]
 */
export function bridgeAction(action: string, args: Record<string, unknown> = {}): string[] {
  return [...bridgeCmd(), action, JSON.stringify(args)];
}

// ─── Python binary resolution (I9.1, intel-context enhancement DAG 2026-05-04) ──
//
// Exported for intel-context.ts so it no longer maintains its own
// PYTHON_CANDIDATES list (I9.2). Both tools share the same on-disk cache
// at ~/.cache/dos/intel-context-python.txt (I9.3): whichever invocation
// runs first writes the winner; subsequent cold starts skip the probe.

const PYTHON_BRIDGE_CACHE = join(homedir(), '.cache', 'dos', 'intel-context-python.txt');
const PYTHON_BRIDGE_CANDIDATES = [
  process.env.MEMPALACE_PYTHON,
  join(homedir(), '.local', 'share', 'mise', 'shims', 'python3'),
  join(homedir(), '.pyenv', 'shims', 'python3'),
  'python3',
].filter(Boolean) as string[];

let _bridgePythonBin: string | null = null;

/**
 * Resolve the python binary that has `chromadb` + `mempalace` importable.
 * Result is cached in memory (process lifetime) and on disk (cross-invocation).
 * Never throws — falls back to bare `python3` when no candidate probes succeed.
 */
export async function resolveBridgePython(): Promise<string> {
  if (_bridgePythonBin) return _bridgePythonBin;
  const fs = require('fs') as typeof import('fs');
  // I9.3: check shared on-disk cache for cold-start speedup
  try {
    if (fs.existsSync(PYTHON_BRIDGE_CACHE)) {
      const v = fs.readFileSync(PYTHON_BRIDGE_CACHE, 'utf8').trim();
      if (v) { _bridgePythonBin = v; return v; }
    }
  } catch { /* ignore */ }
  // Probe candidates in priority order
  for (const candidate of PYTHON_BRIDGE_CANDIDATES) {
    try {
      const proc = Bun.spawn([candidate, '-c', 'import chromadb, mempalace'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await proc.exited;
      if (proc.exitCode === 0) {
        _bridgePythonBin = candidate;
        // Write disk cache so next caller skips the probe
        try {
          const pathMod = require('path') as typeof import('path');
          const dir = pathMod.dirname(PYTHON_BRIDGE_CACHE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          // writeArtifact:exempt — python-bridge path cache (state)
          fs.writeFileSync(PYTHON_BRIDGE_CACHE, candidate + '\n');
        } catch { /* ignore cache write failure */ }
        return candidate;
      }
    } catch { /* candidate not found — try next */ }
  }
  _bridgePythonBin = 'python3';
  return _bridgePythonBin;
}

/**
 * Fix #2 (Sage concurrency-race recovery, 2026-06-30): synchronously read the
 * on-disk python interpreter cache written by resolveBridgePython(). Returns
 * the cached path when available, null otherwise.
 *
 * Purpose: cold-spawn sites that use `uv run python bridge.py` cannot kill the
 * python grandchild when Bun's timeout fires — uv is the direct child, and
 * killing uv leaves python holding the palace mmap, creating a self-amplifying
 * orphan leak. When we have a cached direct interpreter path, we spawn python
 * itself so Bun's kill hits it directly and no orphan survives the timeout.
 *
 * The async resolveBridgePython() writes the cache on first probe; this sync
 * reader consumes it without a probe so it is safe to call from spawnSync
 * contexts. Returns null → caller falls back to the uv command (correct at
 * first install before any session has warmed the cache).
 */
function resolveBridgePythonCached(): string | null {
  if (_bridgePythonBin) return _bridgePythonBin;
  try {
    const fs = require('fs') as typeof import('fs');
    if (fs.existsSync(PYTHON_BRIDGE_CACHE)) {
      const v = fs.readFileSync(PYTHON_BRIDGE_CACHE, 'utf8').trim();
      if (v) {
        _bridgePythonBin = v;
        return v;
      }
    }
  } catch { /* cache missing or unreadable — fall back to uv */ }
  return null;
}

/**
 * Build the command array for a cold-spawn bridge action, preferring a direct
 * python invocation over `uv run` when the interpreter cache is warm.
 *
 * Direct path: [pythonBin, BRIDGE_PATH, action, argsJson]
 *   Bun's timeout-kill hits python directly → no orphaned grandchild.
 *
 * uv fallback: bridgeAction() — used only before the cache is written
 *   (i.e., the very first session start before MemPalaceDaemonPrewarm runs).
 *
 * The relay paths (tryDaemonRelay / relaySpawnArgs) are unaffected: they never
 * call bridgeCmd() / bridgeAction() and already carry their own timeout-kill.
 */
function bridgeActionDirect(action: string, args: Record<string, unknown>): string[] {
  // A maintainer interpreter cache is host-global and may point at a different
  // MemPalace version. Plugin mode must stay on its exact scoped environment.
  if (isPluginInstall(RUNTIME_ENV)) return bridgeAction(action, args);
  const pyBin = resolveBridgePythonCached();
  if (pyBin) {
    return [pyBin, BRIDGE_PATH, action, JSON.stringify(args)];
  }
  // Cache cold — fall back to uv run (first-install path).
  return bridgeAction(action, args);
}

/**
 * RFC-0005 §14.2 discriminated union for bridge results. Callers MUST check
 * `.ok` before reading `.data`. Prior contract (return null on failure) is
 * gone — nulls collapsed four distinct failure modes and made consumers
 * conflate "no matches" with "subsystem degraded" (§11.4 Clause 2).
 */
export type BridgeOk<T = Record<string, unknown>> = { ok: true; data: T };
export type BridgeFail = { ok: false; reason: string };
export type BridgeResult<T = Record<string, unknown>> = BridgeOk<T> | BridgeFail;

// ─── RFC-0027 §5.6: Bridge↔MCP drift probe ─────────────────────────────
//
// The live bridge exposes 36 actions while the MemPalace MCP server exposes
// a related but not identical tool surface. Cardinality drift means an LLM-visible MCP tool
// can succeed against the lib while bypassing bridge logging, batching, and
// the ring-buffer error funnel. We do not yet have data on whether agents
// actually call those un-bridged tools — §5.6 ships the probe so the soak
// produces signal without prejudging the answer.
//
// KNOWN_BRIDGE_ACTIONS is hand-curated from the ACTIONS dispatcher in
// mempalace_bridge.py (last sync 2026-05-27 against bridge __version__
// 3.3.5). Keep this in lockstep with that dispatcher; drift here is the
// false-positive class for the probe.
const KNOWN_BRIDGE_ACTIONS: ReadonlySet<string> = new Set([
  'add_drawer',
  'add_kg_fact',
  'append_reflection',
  'audit_drawer',
  'backfill_closets',
  'batch',
  'build_closets',
  'classify',
  'create_tunnel',
  'delete_drawer',
  'diary',
  'fact_check',
  'find_tunnels',
  'graph_stats',
  'init',
  'invalidate',
  'kg_query',
  'kg_query_predicate',
  'kg_stats',
  'kg_timeline',
  'last_checkpoint',
  'last_checkpoint_at',
  'list_drawers',
  'memories_filed_away',
  'merge_entities',
  'mine_convos',
  'mine_dir',
  'mine_file',
  'reconcile',
  'rebuild_closets',
  'search',
  'status',
  'suggest_parent',
  'traverse',
  'update_drawer',
  'update_entity',
  'upsert_drawer',
  'wake_up',
]);

function driftProbePath(): string {
  return process.env.MEMPALACE_DRIFT_PROBE_PATH
    || join(DOS_DIR, 'MEMORY', 'LEARNING', 'SIGNALS', 'mempalace-drift.jsonl');
}

/**
 * Append a JSONL drift event when an unknown action enters the bridge call
 * boundary. The probe is non-blocking — file-open or write errors are
 * swallowed so a logging failure never breaks the bridge call. `via` records
 * which entry point saw the unknown action so the soak triage can compare
 * sync (foreground, returns result) vs fire (fire-and-forget) call shapes.
 */
// RFC-0027 §5.6 — keep V-8-style test fixtures out of the production drift stream.
const TEST_ACTION_RE = /(^|_)test(_|$)/i;

function recordDriftEvent(action: string, via: 'bridgeSync' | 'bridgeFire'): void {
  if (KNOWN_BRIDGE_ACTIONS.has(action)) return;
  if (TEST_ACTION_RE.test(action)) return;
  try {
    const fs = require('fs') as any;
    const path = driftProbePath();
    const dir = require('path').dirname(path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      action,
      via,
      source: 'hooks/lib/mempalace.ts',
    };
    fs.appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Drift telemetry is advisory — never break a bridge call.
  }
}

// ─── Memory Observation Port (producer) ─────────────────────────────────
//
// Every bridge invocation funnels through bridgeSync / bridgeFire / batchOps,
// so this single producer captures the full memory-operation stream that
// downstream consumers (rollup daemon, soak triage, drift detectors) replay
// from $DOS_DIR/MEMORY/STATE/memory-events.jsonl. Lazy rotation keeps the
// file bounded; secrets in args are redacted before serialization. Telemetry
// MUST never break a bridge call — every failure path is swallowed.
// v2 (W1-S1, 2026-06-10): summarizeBridgeResult ports the canonical three-bucket
// classifier from bridge.py _classify_result_status (MP-008/MP-010). Lines with
// v>=2 are classified by the shared truth table; metrics that must not mix
// pre-fix misclassified rows with post-fix rows filter on v>=2 (D7 forward-only).
const MEMORY_EVENTS_VERSION = 2;

// Mutating bridge actions (shared fixture with dos-memory-status.ts — the
// write-success-rate universe). Used here for two W1-S1 guarantees: (a) a
// caller budget never SIGTERMs a mutating action below WRITE_MIN_GRACE_MS
// (timeoutForAction), and (b) budget-exceeded reclassification to 'degraded'
// applies to non-mutating actions only — an abandoned write is a
// data-integrity event and stays 'error' (D5). 'classify' removed in the
// W1-S1 review pass: the bridge classify action is read-only text
// classification (MemPalaceClassifyOnAddDrawer.hook.ts documents it as such);
// it was in the historical radiator set by accident of name.
// PRD-B: the action set lives in fixtures/bridge-write-actions.json — the
// single source of truth (never re-inline a literal here; the fixture test
// catches it). Static JSON import: resolved at load, no runtime fs dependency.
import bridgeWriteActionsFixture from './fixtures/bridge-write-actions.json';
const WRITE_ACTIONS = new Set<string>(bridgeWriteActionsFixture.write_actions);

export function isWriteAction(action: string): boolean {
  return WRITE_ACTIONS.has(action);
}
const MEMORY_EVENTS_MAX_BYTES = 10 * 1024 * 1024;  // 10MB
const MEMORY_EVENTS_RETAIN_BYTES = 5 * 1024 * 1024; // 5MB after rotation
const MEMORY_EVENTS_REDACT_KEYS = new Set([
  'studio_api_key',
  'dos_gateway_api_key',
  'password',
  'token',
  'secret',
  'api_key',
]);

// W1-S1 D8 fixture sink: when DOS_BRIDGE_TEST_SINK=1, BOTH telemetry streams
// divert to *-test.jsonl siblings so test fixtures never pollute production
// writeSuccessRate (the 2026-06-10 02:25-03:54Z wing:"test"/bogus_action cluster
// counted against the live 98% floor). Explicit per-path envs still win.
function testSink(): boolean {
  return process.env.DOS_BRIDGE_TEST_SINK === '1';
}

function memoryEventsPath(): string {
  return process.env.MEMPALACE_EVENTS_PATH
    || join(DOS_DIR, 'MEMORY', 'STATE',
      testSink() ? 'memory-events-test.jsonl' : 'memory-events.jsonl');
}

function summarizeArgs(args: Record<string, unknown>): string {
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (MEMORY_EVENTS_REDACT_KEYS.has(k.toLowerCase())) {
      redacted[k] = '<redacted>';
    } else if (typeof v === 'string' && v.length > 60) {
      redacted[k] = v.slice(0, 60) + '…';
    } else {
      redacted[k] = v;
    }
  }
  const s = JSON.stringify(redacted);
  return s.length > 120 ? s.slice(0, 120) + '…' : s;
}

function recordMemoryEvent(entry: {
  op_kind: string;
  via: 'bridgeSync' | 'bridgeAsync' | 'bridgeFire' | 'batchOps' | 'queueOp';
  args_summary: string;
  result_summary: string;
  duration_ms: number;
  // 'noop' joined the TS union in W1-S1 — it already existed in the wire format
  // (the Python writer emits it for duplicate/skip/not_found/partial), so this
  // aligns the type with wire reality rather than changing the schema.
  status: 'ok' | 'error' | 'degraded' | 'fire-and-forget' | 'noop';
  // RFC-0122 ISC-20: true when the warm-daemon relay served this call instead
  // of a `mempalace_bridge.py` subprocess spawn. Lets the bridge-event-ratio
  // metric (dos-memory-status) exclude relayed events from the spawn-parity
  // numerator — a relayed call legitimately produces an event with no spawn.
  relay?: boolean;
  // RFC-0128 / mempalace-012: originating hook tag, when the typed client
  // (mempalace-client.callSync) supplies opts.callerHook. Lets daemon-baseline
  // analysis attribute latency to a specific hook. Omitted for direct callers.
  caller_hook?: string;
}): void {
  try {
    const fs = require('fs') as any;
    const path = memoryEventsPath();
    const dir = require('path').dirname(path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Lazy rotation: at >MAX_BYTES, slice tail to RETAIN_BYTES on a newline.
    try {
      const stat = fs.statSync(path);
      if (stat.size > MEMORY_EVENTS_MAX_BYTES) {
        const data = fs.readFileSync(path);
        const sliced = data.slice(data.length - MEMORY_EVENTS_RETAIN_BYTES);
        const newlineIdx = sliced.indexOf(0x0A);
        // writeArtifact:exempt — memory-events.jsonl size-trim rewrite (state log)
        fs.writeFileSync(path, newlineIdx >= 0 ? sliced.slice(newlineIdx + 1) : sliced);
      }
    } catch {
      // file missing or stat fails — fine, append below will create it.
    }
    const event = {
      ts: new Date().toISOString(),
      v: MEMORY_EVENTS_VERSION,
      session_id: process.env.CLAUDE_SESSION_ID || null,
      ...entry,
    };
    fs.appendFileSync(path, JSON.stringify(event) + '\n');
  } catch {
    // Telemetry must never break a bridge call.
  }
}

// In-band statuses the bridge uses for benign no-ops (duplicate writes, skips,
// absent ids, partial batches, thin-content rejects, block-mode reflection
// schema rejects). Mirrors bridge.py _classify_result_status — these MUST NOT
// score 'ok' (they did not persist a mutation) and MUST NOT score
// 'degraded'/'error' (they are by-design outcomes). MP-PY-01 added 'skipped'
// (thin-content) and 'schema-violation' (block-mode reflection reject).
const NOOP_STATUSES = new Set([
  'duplicate', 'skip', 'skipped', 'not_found', 'partial', 'schema-violation',
]);

/**
 * W1-S1 (2026-06-10): canonical three-bucket classifier, ported verbatim from
 * bridge.py _classify_result_status (which self-declares "shared with the TS
 * writer" — MP-008/MP-010; the TS half was never implemented, so every
 * payload-shaped read success classified 'degraded': kg_stats 96%, status 70%,
 * memories_filed_away 100% on 2026-06-10). Shared truth-table fixture:
 * hooks/lib/fixtures/bridge-classifier-truth-table.json — keep BOTH classifiers
 * pinned to it. One TS-side addition mirrored INTO the Python classifier in the
 * same slice: `error_type` presence denies 'ok' (deny-by-shape guard — a novel
 * error payload lacking `status` must not classify ok).
 *
 * `opts.budget` carries the budget-SIGTERM context (D5): when the caller passed
 * an explicit budget and the child was SIGTERM-killed (exit 143), NON-MUTATING
 * actions classify 'degraded' with result_summary 'budget-exceeded(<ms>)' — a
 * by-design degradation, not an error. Mutating actions keep 'error': an
 * abandoned write is a data-integrity event (the HNSW re-quarantine feeder).
 */
export function summarizeBridgeResult(
  exitCode: number | null,
  stdoutText: string,
  stderrText: string,
  opts?: { action?: string; explicitBudgetMs?: number },
): { result_summary: string; status: 'ok' | 'error' | 'degraded' | 'noop' } {
  if (exitCode === 0) {
    const stdout = stdoutText.trim();
    if (!stdout) {
      return { result_summary: 'degraded:empty-stdout', status: 'degraded' };
    }
    try {
      const parsed = JSON.parse(stdout) as Record<string, unknown> | unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        if (p.status === 'error' || p.isError === true || 'error_type' in p) {
          const detail = String(p.error_type ?? p.message ?? 'in-band');
          return { result_summary: ('err:' + detail).slice(0, 80), status: 'error' };
        }
        if (typeof p.status === 'string' && NOOP_STATUSES.has(p.status)) {
          return { result_summary: 'noop:' + p.status, status: 'noop' };
        }
      }
      // Payload-shaped success (dict without error markers, array, scalar) — ok.
      return { result_summary: 'ok', status: 'ok' };
    } catch {
      return { result_summary: 'degraded:parse-error', status: 'degraded' };
    }
  }
  // Budget-SIGTERM reclassification (D5): explicit caller budget + SIGTERM kill
  // on a non-mutating action is by-design degradation, not an error. exitCode
  // null is the same kill seen through Bun.spawnSync's signal lens (review
  // finding #11: a child without a SIGTERM handler reports exitCode null +
  // signalCode SIGTERM; the bridge's facade handler exits 143, but SIGKILL
  // escalation or a pre-handler kill still surfaces as null).
  if (
    (exitCode === 143 || exitCode === null) &&
    opts?.explicitBudgetMs != null &&
    opts.action != null &&
    !WRITE_ACTIONS.has(opts.action)
  ) {
    return {
      result_summary: `budget-exceeded(${opts.explicitBudgetMs}ms)`,
      status: 'degraded',
    };
  }
  const tail = (stderrText || '').trim().slice(0, 60) || `exit=${exitCode}`;
  return { result_summary: 'err:' + tail, status: 'error' };
}

/**
 * Append an error line to the §11.4.2 ring buffer. Never throws.
 */
function bridgeEventsPath(): string {
  return process.env.MEMPALACE_BRIDGE_EVENTS_PATH
    || join(DOS_DIR, 'MEMORY', 'STATE',
      testSink() ? 'mempalace-bridge-events-test.jsonl' : 'mempalace-bridge-events.jsonl');
}

function bridgeErrorsPath(): string {
  return process.env.MEMPALACE_ERRORS_PATH
    || join(DOS_DIR, 'MEMORY', 'STATE',
      testSink() ? 'mempalace-errors-test.jsonl' : 'mempalace-errors.jsonl');
}

function appendJsonl(path: string, entry: Record<string, unknown>): void {
  try {
    const fs = require('fs') as any;
    const dir = require('path').dirname(path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // Observability logs are advisory; never block the caller.
  }
}

export function appendBridgeEvent(entry: Record<string, unknown>): void {
  appendJsonl(bridgeEventsPath(), entry);
}

// uv resolver chatter — non-error stderr emitted whenever `uv run --with mempalace`
// resolves the github URL pin. Pre-2026-05-04 these flooded mempalace-errors.jsonl
// because the bridge reported `result_summary: "err:" + stderrText.slice(0,60)` even
// when exit=0 with valid JSON. Filter at write-site so historical callers are immune.
const UV_CHATTER_RE = /^(?:\s*Updating https:\/\/|\s*Resolved \d+|\s*Built \w|\s*Audited |\s*Bytecode-compiled |\s+Building wheels|\s*Downloading |\s*Prepared \d+|\s*Installed \d+|\s*Uninstalled )/m;

function isUvChatter(reason: string): boolean {
  return UV_CHATTER_RE.test(reason);
}

function appendRingBuffer(action: string, reason: string, source = 'bridgeSync'): void {
  // Skip uv resolver chatter — it's not a bridge error, it's a non-error stderr line
  // that got captured by summarizeBridgeResult's stderr-tail and surfaced as `err:`.
  if (isUvChatter(reason)) return;
  try {
    appendJsonl(bridgeErrorsPath(), {
      source: 'bridgeSync',
      ...(source === 'bridgeSync' ? {} : { source }),
      action,
      reason: reason.slice(0, 500),
    });
  } catch {
    // Ring buffer is advisory; never block the caller.
  }
}

// ─── Predicate Gate (P3, RFC-0028 enhancement DAG 2026-05-04) ───────────────
//
// validatePredicate(name) checks a predicate against the canonical vocabulary
// defined in PREDICATES.md. Parses and memoizes on first call; subsequent
// calls are O(1) Set lookups. In BLOCK MODE (the locked default per {PRINCIPAL.NAME}):
//
//   bridgeSync('add_kg_fact', { predicate: 'unknown_pred', ... })
//   → BridgeFail { ok: false, reason: 'predicate-gate: unknown predicate ...' }
//
// Soft override: DOS_PREDICATE_GATE=warn  — logs to stderr, allows through.
// Hard override: DOS_PREDICATE_GATE=off   — disables gate entirely (emergency).
//
// The vocab loader searches for PREDICATES.md in priority order:
//   1. $DOS_DIR/skills/mem-palace/PREDICATES.md  (live install)
//   2. $DOS_DIR/../Packs/mem-palace/PREDICATES.md (Durante repo layout)
//
// If PREDICATES.md is not found, the gate fails open (allows through) to
// prevent blocking on missing registry during first-time installs.

let _predicateVocab: { canonicals: Set<string>; aliases: Map<string, string> } | null = null;

function loadPredicateVocab(): { canonicals: Set<string>; aliases: Map<string, string> } {
  if (_predicateVocab) return _predicateVocab;

  const fs = require('fs') as { existsSync: (p: string) => boolean; readFileSync: (p: string, enc: string) => string };
  const predicatesCandidates = [
    ...(isPluginInstall(RUNTIME_ENV)
      ? [PLUGIN_CODE_PATHS.predicateVocabularyPath]
      : []),
    join(DOS_DIR, 'skills', 'mem-palace', 'PREDICATES.md'),
    join(DOS_DIR, '..', '..', 'Packs', 'mem-palace', 'PREDICATES.md'),
  ];

  let text = '';
  for (const p of predicatesCandidates) {
    try {
      if (fs.existsSync(p)) {
        text = fs.readFileSync(p, 'utf8');
        break;
      }
    } catch { /* keep trying */ }
  }

  const canonicals = new Set<string>();
  const aliases = new Map<string, string>();

  if (text) {
    // Parse §1 tables ONLY (MP-PY-02 parity, 2026-07-07): §7's pending-triage
    // rows reuse the same backtick table-row shape, so an unrestricted sweep
    // made THIS gate more permissive than both the auditor
    // (validate-predicates.py) and the Python bridge's now-§1-restricted
    // enforce_predicate_gate — a TS-approved write the bridge then rejects is
    // a misattributed failure. Keep in lockstep with bridge.py.
    let inSection1 = false;
    for (const line of text.split('\n')) {
      const heading = line.match(/^##\s+(\d+)\./);
      if (heading) {
        inSection1 = heading[1] === '1';
        continue;
      }
      if (!inSection1) continue;
      const m = line.match(/^\|\s*`([a-z][a-z0-9_]*)`\s*\|/);
      if (m) canonicals.add(m[1]);
    }

    // Parse §2 fenced JSON block for alias map.
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const aliasObj = JSON.parse(jsonMatch[1]) as Record<string, string>;
        for (const [alias, canonical] of Object.entries(aliasObj)) {
          aliases.set(alias, canonical);
        }
      } catch { /* alias map parse failure — aliases stay empty */ }
    }
  }

  _predicateVocab = { canonicals, aliases };
  return _predicateVocab;
}

/**
 * Validate a predicate name against the canonical vocabulary in PREDICATES.md.
 * Returns `{ valid: true }` for canonical predicates, known aliases, and when
 * the vocabulary file cannot be located (fail-open). Returns `{ valid: false,
 * reason }` for names that are neither canonical nor a known alias.
 */
export function validatePredicate(name: string): { valid: boolean; reason?: string } {
  const { canonicals, aliases } = loadPredicateVocab();
  if (canonicals.size === 0) {
    // Vocabulary failed to load — fail open so a missing registry doesn't block writes.
    return { valid: true };
  }
  if (canonicals.has(name) || aliases.has(name)) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: `unknown predicate "${name}" — not in PREDICATES.md canonical list or alias map`,
  };
}

/**
 * Common result-parsing for sync and async bridge calls. Handles the five
 * shared failure modes (non-zero exit, empty stdout, JSON parse, in-band
 * error) and logs every failure to the RFC-0005 §11.4.2 ring buffer.
 * Callers (bridgeSync, bridgeAsync) collect stdout/stderr/exitCode via
 * whatever spawn flavor they use and hand the raw strings here.
 */
export function parseBridgeResult(
  action: string,
  exitCode: number | null,
  stdoutText: string,
  stderrText: string,
  recordFailure = true,
  // W1-S1: failure-attribution context. `path` tags which transport produced
  // the bytes (relay vs cold spawn) so empty-stdout lines are diagnosable
  // (ISC-19); `explicitBudgetMs` marks a caller-passed budget so a SIGTERM kill
  // on a non-mutating action logs as by-design budget overrun, not bare
  // exit=143 (ISC-14).
  opts?: { path?: 'relay' | 'cold'; explicitBudgetMs?: number },
): BridgeResult {
  if (exitCode !== 0) {
    const budgetKill =
      (exitCode === 143 || exitCode === null) &&
      opts?.explicitBudgetMs != null && !WRITE_ACTIONS.has(action);
    const reason = budgetKill
      ? `budget-exceeded(${opts!.explicitBudgetMs}ms)`
      : `exit=${exitCode} ${stderrText}`.trim();
    process.stderr.write(`[mempalace] ${action} failed: ${reason}\n`);
    if (recordFailure) appendRingBuffer(action, reason);
    return { ok: false, reason };
  }
  const stdout = stdoutText.trim();
  if (!stdout) {
    const reason = `empty stdout (${opts?.path ?? 'unknown'})`;
    if (recordFailure) appendRingBuffer(action, reason);
    return { ok: false, reason };
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stdout) as Record<string, unknown>;
  } catch (parseErr) {
    const reason = `parse-error: ${parseErr}`;
    if (recordFailure) appendRingBuffer(action, reason);
    return { ok: false, reason };
  }
  // In-band error response: bridge exits 0 but payload signals failure.
  if (parsed.isError === true || parsed.status === 'error') {
    const reason = `bridge-error: ${parsed.error_type ?? parsed.message ?? 'unspecified'}`;
    if (recordFailure) appendRingBuffer(action, reason);
    return { ok: false, reason };
  }
  return { ok: true, data: parsed };
}

/**
 * Synchronous bridge call. Returns `{ok, data}` on success, `{ok:false, reason}`
 * on any failure mode (non-zero exit, empty stdout, JSON parse, spawn throw).
 * RFC-0005 §11.4.2 R8: failures are also appended to the errors ring buffer.
 * Never throws.
 */
/**
 * Per-action subprocess timeout map (B1/B2 fix, RFC-0075 follow-up).
 *
 * The historic blanket 5000ms timeout was SIGTERMing the bridge subprocess
 * mid-flush on write actions, leaving ChromaDB's HNSW index header on disk
 * with stale offsets → next session's first call crashed on index load.
 * Read-heavy actions (search) and any kg write that touches the HNSW index
 * need at least 30s of headroom; pure-light actions stay at 5s.
 *
 * Override (rare) still wins: callers passing an explicit `timeoutMs` keep
 * full control — the map only fills in the default.
 */
const PER_ACTION_TIMEOUT_MS: Record<string, number> = {
  // READ actions are bounded so a prompt-blocking hook (IntentRetrieval recall)
  // can never stack them past the UserPromptSubmit deadline. With the warm
  // daemon (RFC-0122) reads are ~75ms; this 12s cap only bites the cold/
  // degraded/lock-contended case, where failing fast to an empty recall is far
  // better than blocking the prompt for >90s. WRITE actions keep 30s (HNSW
  // flush-corruption safety — untouched).
  search: 12000,
  kg_query_predicate: 12000,
  add_drawer: 30000,
  update_drawer: 30000,
  upsert_drawer: 30000,
  add_kg_fact: 15000,
  batch: 60000,
  mine_file: 30000,
  // W1-S1: status does the HNSW quarantine sweep + full wing census on a cold
  // open (~10-12s) — the 5s default was killing it (92 'empty stdout'/day at
  // baseline, exit laundered to 0 by the facade SIGTERM handler pre-W1-S1).
  // Read action: an explicit caller override still wins. Bounded 15s->10s so the
  // wing-drift preflight status() can't dominate the prompt deadline under load.
  status: 10000,
};

const DEFAULT_BRIDGE_TIMEOUT_MS = 5000;

// W1-S1 review revision (#7/#12): the first cut floored WRITE overrides at the
// full per-action default (30-60s), which silently defeated batchTimeoutFor's
// deliberate scaling cap and turned tuned hook deadlines (MemPalaceStop's 8s
// add_drawer SessionEnd budget) into 30s hangs. The corruption concern is
// narrower than the floor was: a kill is only dangerous when it lands before
// the facade SIGTERM handler can drain + flush (exit-truth commit 2b8a5c1
// makes the kill path drain-then-exit-143). A minimum GRACE — not the full
// default — keeps pathological sub-second write kills impossible while
// honoring every tuned budget at or above it.
const WRITE_MIN_GRACE_MS = 3000;

export function timeoutForAction(action: string, override?: number): number {
  const fallback = PER_ACTION_TIMEOUT_MS[action] ?? DEFAULT_BRIDGE_TIMEOUT_MS;
  if (override != null) {
    // W1-S1 D5/ISC-15 (feeder sever, revised): a caller budget bounds how
    // long it waits on READS; on MUTATING actions it is raised to at least
    // WRITE_MIN_GRACE_MS so the child always has room to reach the facade
    // drain. Tuned write budgets >= the grace are honored verbatim.
    if (WRITE_ACTIONS.has(action)) return Math.max(override, WRITE_MIN_GRACE_MS);
    return override;
  }
  return fallback;
}

/** RFC-0122: warm-daemon socket + the cheap net-only relay bridgeSync spawns. */
const DAEMON_SOCKET_PATH =
  RUNTIME_ENV.MEMPALACE_DAEMON_SOCKET || join(DOS_DIR, 'MEMORY', 'STATE', '.mempalace.sock');
const RELAY_PATH = isPluginInstall(RUNTIME_ENV)
  ? join(THIS_FILE_DIR, 'mempalace-relay.ts')
  : join(DOS_DIR, 'hooks', 'lib', 'mempalace-relay.ts');

/**
 * RFC-0122: when `DOS_USE_BRIDGE_DAEMON=1` and the daemon socket is live, route
 * the action through the warm daemon via a cheap net-only relay subprocess
 * (~75ms warm) instead of the cold `mempalace_bridge.py` subprocess (~12s). The
 * daemon's response is byte-identical to the subprocess stdout
 * (bridge_daemon._dispatch guarantees this), so the returned triple drops
 * straight into bridgeSync's existing summarize/record/parse path.
 *
 * Returns null to signal "fall back to the subprocess" — when the toggle is off,
 * the socket is absent, the relay exits non-zero (daemon down / timeout), or the
 * output isn't JSON. The fallback is what keeps injection working when the daemon
 * is unavailable; the relay is a pure accelerator, never a hard dependency.
 */
/**
 * RFC-0122: true when daemon routing is enabled (`DOS_USE_BRIDGE_DAEMON=1`) AND
 * the daemon socket is live. Single guard shared by all three relay sites
 * (sync / async / fire) so the flag + socket-existence policy can never drift
 * between paths. Conservative by design: socket-existence only, never spawns.
 */
export function relayCanRoute(): boolean {
  if (process.env.DOS_USE_BRIDGE_DAEMON !== '1') return false;
  const { existsSync } = require('fs') as typeof import('fs');
  return existsSync(DAEMON_SOCKET_PATH);
}

/** W1-S2: debounce window for relay-miss-triggered daemon re-ensure. Equal to
 * the ensure lib's LOCK_STALE_MS by design — tune them together. */
const REENSURE_DEBOUNCE_MS = 30_000;

/** W1-S2: in-process negative cache. After a confirmed relay miss, skip relay
 * attempts for a short grace so a wedged-but-accepting daemon cannot make a
 * serial caller (StudioSync iterates ~20 sync tools in one process) pay the
 * full relay timeout on every call (review #11). Cross-process recovery is the
 * stamp + ensure lock; this is purely the in-process fast-path. */
const RELAY_DOWN_GRACE_MS = 3_000;
let relayDownUntil = 0;

/** Call-time resolution (not a module constant) so test seams that swap
 * DOS_DIR after first import still land in the overridden tree. `||` (not ??)
 * matches the module-constant convention: a set-but-EMPTY DOS_DIR must fall
 * back, never produce cwd-relative paths (review #6-TS). */
function reensurePaths(): { stateDir: string; stamp: string; hook: string } {
  const dosDir = process.env.DOS_DIR || DOS_DIR;
  const stateDir = join(dosDir, 'MEMORY', 'STATE');
  return {
    stateDir,
    stamp: join(stateDir, '.daemon-reensure-stamp'),
    hook: isPluginInstall(RUNTIME_ENV)
      ? join(THIS_FILE_DIR, '..', 'MemPalaceDaemonEnsure.hook.ts')
      : join(dosDir, 'hooks', 'MemPalaceDaemonEnsure.hook.ts'),
  };
}

/**
 * W1-S2: mid-session daemon-death recovery. Before this, a daemon that died
 * uncleanly left its socket behind; relayCanRoute()'s existsSync-only guard
 * kept routing every call into a failed relay + cold fallback FOREVER (the
 * SessionStart ensure hook only fires once). On a relay miss this schedules a
 * detached, spawn-locked ensureDaemon run (the ensure lib already serializes
 * concurrent spawners via its O_EXCL lockfile, and daemon STARTUP owns stale-
 * socket unlinking via _maybe_unlink_stale_socket).
 *
 * Protocol constraints (Council/RedTeam 2026-06-11): this client path NEVER
 * unlinks the socket — a client-side unlink races a freshly-bound daemon and
 * creates an invisible live holder on an unlinked inode. Read-only probe,
 * debounced spawn, nothing else. Returns true when a re-ensure was scheduled
 * (or would be, under DOS_DAEMON_REENSURE_DRYRUN=1 — the test seam).
 */
export function scheduleDaemonReensure(): boolean {
  const fs = require('fs') as typeof import('fs');
  let claimed = false;
  let stampPath = '';
  try {
    const { stateDir, stamp, hook } = reensurePaths();
    stampPath = stamp;
    // The spawn target must exist — a missing hook (stripped install, layout
    // drift) must NOT burn the debounce window pretending recovery is in
    // flight (review #3: silent permanent non-recovery).
    if (process.env.DOS_DAEMON_REENSURE_DRYRUN !== '1' && !fs.existsSync(hook)) return false;
    // Claim-by-create: unlink-if-expired then O_EXCL create, so exactly ONE
    // process per window pays the spawn — a 50-hook parallel relay-miss storm
    // must not boot 50 bun interpreters just to lose the ensure lock
    // (review #8: the stat-then-write check was non-atomic).
    try {
      const age = Date.now() - fs.statSync(stamp).mtimeMs;
      if (age < REENSURE_DEBOUNCE_MS) return false;
      fs.unlinkSync(stamp);
    } catch {
      // stamp absent (or vanished in a race) — fall through to claim.
    }
    fs.mkdirSync(stateDir, { recursive: true });
    const fd = fs.openSync(stamp, 'wx');
    fs.writeSync(fd, String(Date.now()));
    fs.closeSync(fd);
    claimed = true;
    if (process.env.DOS_DAEMON_REENSURE_DRYRUN === '1') return true;
    // process.execPath, not 'bun' — hook environments without bun on PATH are
    // exactly the case this recovery exists for (review #3; matches the
    // relaySpawnArgs convention 20 lines down).
    const proc = Bun.spawn([process.execPath, hook], {
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    });
    proc.unref();
    return true;
  } catch {
    // A failed spawn must release the claim so the next miss can retry —
    // otherwise the window is burned on a recovery that never launched.
    if (claimed && stampPath) {
      try {
        fs.unlinkSync(stampPath);
      } catch {
        /* already gone */
      }
    }
    return false;
  }
}

/** RFC-0122: argv + env for spawning the net-only relay. Shared builder so the
 * argv order and the `MEMPALACE_RELAY_TIMEOUT_MS` env contract live in one
 * place (a relay-protocol change is then a one-line edit, not three). */
export function relaySpawnArgs(
  action: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): { cmd: string[]; env: Record<string, string | undefined> } {
  return {
    cmd: [process.execPath, RELAY_PATH, DAEMON_SOCKET_PATH, action, JSON.stringify(args)],
    env: { ...process.env, MEMPALACE_RELAY_TIMEOUT_MS: String(timeoutMs) },
  };
}

/** RFC-0122: shared "is this daemon stdout usable?" check — non-zero exit or a
 * non-JSON body means fall back to the cold subprocess. Identical contract for
 * the sync and async relay so they can never disagree on a valid response. */
export function relayOutputOrNull(
  exitCode: number | null,
  stdoutText: string,
): { exitCode: number; stdoutText: string; stderrText: string } | null {
  if (exitCode !== 0) return null;
  const trimmed = stdoutText.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  // W1-S1 remediation (#1): a draining daemon answers every queued request
  // with a daemon_stopping envelope instead of dispatching it (bounded
  // teardown). Treat that envelope as relay-miss so the caller falls back to
  // a cold spawn and the request still gets served.
  if (trimmed.includes('"daemon_stopping"')) return null;
  return { exitCode: 0, stdoutText, stderrText: '' };
}

function tryDaemonRelay(
  action: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): { exitCode: number; stdoutText: string; stderrText: string } | null {
  if (!relayCanRoute()) return null;
  if (Date.now() < relayDownUntil) return null; // W1-S2 negative cache (review #11)
  try {
    const { cmd, env } = relaySpawnArgs(action, args, timeoutMs);
    const proc = Bun.spawnSync(cmd, { timeout: timeoutMs, env });
    const stdoutText = proc.stdout.toString();
    const out = relayOutputOrNull(proc.exitCode, stdoutText);
    // W1-S2: a miss while the socket EXISTS means the daemon behind it is
    // dead or wedged — short in-process backoff + a debounced re-ensure so
    // the session recovers instead of paying failed-relay + cold forever.
    // A daemon_stopping drain envelope is the one miss flavor that must NOT
    // trigger re-ensure: the old daemon still holds the palace while it
    // drains, and racing a new spawn against it widens the dual-holder
    // window (review #9).
    if (out === null) {
      relayDownUntil = Date.now() + RELAY_DOWN_GRACE_MS;
      if (!stdoutText.includes('"daemon_stopping"')) scheduleDaemonReensure();
    }
    return out;
  } catch {
    // Local spawn failure (bad argv, ENOENT mid-sync) is NOT daemon death —
    // do not burn the re-ensure window on it (review #9).
    return null;
  }
}

/**
 * RFC-0122 ISC-21: async sibling of `tryDaemonRelay` for `bridgeAsync`. Same
 * conservative policy (toggle on + socket present, NEVER auto-spawn) and same
 * `{exitCode, stdoutText, stderrText} | null` contract, so the result drops
 * straight into bridgeAsync's existing `parseBridgeResult` path — byte-identical
 * downstream behavior whether relayed or cold-spawned. Uses `Bun.spawn`
 * (non-blocking) instead of `spawnSync` so parallel `Promise.all` callers keep
 * their concurrency. Returns null to fall back to the cold subprocess.
 */
async function tryDaemonRelayAsync(
  action: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ exitCode: number; stdoutText: string; stderrText: string } | null> {
  if (!relayCanRoute()) return null;
  // stderr:'ignore' — the relay's failure signal is its non-zero exit code (read
  // below), so we never consume stderr; ignoring it avoids draining a discarded
  // pipe and keeps the destructure positional-hole-free.
  const { cmd, env } = relaySpawnArgs(action, args, timeoutMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'ignore', env });
    timer = setTimeout(() => {
      try { proc.kill(); } catch { /* already exited */ }
    }, timeoutMs);
    const [stdoutText, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    const out = relayOutputOrNull(exitCode, stdoutText);
    // W1-S2: same recovery contract as the sync relay (see tryDaemonRelay) —
    // backoff + re-ensure on a real miss, never on drain, never from catch.
    if (out === null) {
      relayDownUntil = Date.now() + RELAY_DOWN_GRACE_MS;
      if (!stdoutText.includes('"daemon_stopping"')) scheduleDaemonReensure();
    }
    return out;
  } catch {
    return null;
  } finally {
    // Always clear the kill-timer — including the early `return null` paths and
    // the catch — so a stream-read rejection can't leave an armed timer behind.
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function bridgeSync(
  action: string,
  args: Record<string, unknown> = {},
  timeoutMs?: number,
  recordFailure = true,
  // RFC-0128: optional originating-hook tag threaded into the memory-events
  // record so daemon-baseline analysis can attribute latency to a specific
  // hook. Supplied by the typed client (mempalace-client.callSync); falls back
  // to the DOS_CALLER_HOOK env var when omitted. Previously this 5th positional
  // was passed by callSync but silently dropped here (mempalace-012).
  callerHook?: string,
): BridgeResult {
  const effectiveTimeoutMs = timeoutForAction(action, timeoutMs);
  // ─── Predicate gate (BLOCK MODE by default, DOS_PREDICATE_GATE=warn to soften) ───
  if (action === 'add_kg_fact' && typeof args.predicate === 'string') {
    const gateMode = process.env.DOS_PREDICATE_GATE ?? 'block';
    if (gateMode !== 'off') {
      const check = validatePredicate(args.predicate);
      if (!check.valid) {
        if (gateMode === 'warn') {
          process.stderr.write(`[mempalace] predicate-gate WARN: ${check.reason}\n`);
        } else {
          const reason = `predicate-gate: ${check.reason}`;
          if (recordFailure) appendRingBuffer(action, reason);
          return { ok: false, reason };
        }
      }
    }
  }
  // ─── end predicate gate ───────────────────────────────────────────────────────────
  recordDriftEvent(action, 'bridgeSync');
  const cmd = bridgeActionDirect(action, args);
  const startMs = Date.now();
  // mempalace-012: prefer the explicit callerHook arg, fall back to the env tag.
  const resolvedCallerHook = callerHook || process.env.DOS_CALLER_HOOK || undefined;
  // Hoisted so the catch path can tag the event correctly: a relayed call that
  // throws AFTER dispatch must still record relay:true, else the ratio metric
  // would over-count it as a spawn-backed event (false-high band).
  let usedRelay = false;
  try {
    // RFC-0122: try the warm daemon (relay) first; fall back to the cold
    // subprocess on null. Downstream summarize/record/parse is identical for
    // both because the daemon response is byte-identical to subprocess stdout.
    const relayed = tryDaemonRelay(action, args, effectiveTimeoutMs);
    usedRelay = relayed != null;
    let exitCode: number | null;
    let stdoutText: string;
    let stderrText: string;
    if (relayed) {
      ({ exitCode, stdoutText, stderrText } = relayed);
    } else {
      // Fix #1 (Sage concurrency-race recovery, 2026-06-30): if the daemon socket
      // EXISTS (relayCanRoute) but the relay missed, the daemon is up-but-slow or
      // wedged — NOT genuinely down. For palace-opening READ actions, do NOT
      // cold-spawn a second concurrent ChromaDB handle: that concurrent-open is the
      // exact contention that deadlocks Chroma's rust core (pthread_cond_wait) and
      // wedges the serial daemon. Fail fast to an empty result instead (best-effort
      // recall degrades to no-injection, but the prompt is never blocked and the
      // daemon is never re-wedged). Cold-spawn fallback is kept ONLY when the socket
      // is ABSENT (daemon truly down) or for WRITE actions (which must complete).
      if (relayCanRoute() && !WRITE_ACTIONS.has(action)) {
        recordMemoryEvent({
          op_kind: action,
          via: 'bridgeSync',
          args_summary: summarizeArgs(args),
          result_summary: 'relay-miss:coldspawn-suppressed',
          duration_ms: Date.now() - startMs,
          status: 'degraded',
          relay: false,
          caller_hook: resolvedCallerHook,
        });
        if (recordFailure) appendRingBuffer(action, 'daemon-relay-miss (read; cold-spawn suppressed for concurrency-safety)');
        return { ok: false, reason: 'daemon-relay-miss: cold-spawn suppressed (read, concurrency-safety)' };
      }
      // RFC-0128 D2: the cold CLI dual-emits a memory-events line; we already
      // record one below (recordMemoryEvent), so tell the CLI to suppress its
      // numerator (it still writes the bridge-actions denominator). Bun replaces
      // env wholesale, so spread process.env to keep PATH/HOME/DOS_DIR for `uv`.
      const result = Bun.spawnSync(cmd, {
        timeout: effectiveTimeoutMs,
        env: { ...process.env, DOS_BRIDGE_EMIT: 'ts' },
      });
      exitCode = result.exitCode;
      stdoutText = result.stdout.toString();
      stderrText = result.stderr ? new TextDecoder().decode(result.stderr) : '';
    }
    const failCtx = {
      action,
      path: (usedRelay ? 'relay' : 'cold') as 'relay' | 'cold',
      explicitBudgetMs: timeoutMs != null ? effectiveTimeoutMs : undefined,
    };
    const summary = summarizeBridgeResult(exitCode, stdoutText, stderrText, failCtx);
    recordMemoryEvent({
      op_kind: action,
      via: 'bridgeSync',
      args_summary: summarizeArgs(args),
      result_summary: summary.result_summary,
      duration_ms: Date.now() - startMs,
      status: summary.status,
      relay: usedRelay,
      caller_hook: resolvedCallerHook,
    });
    return parseBridgeResult(action, exitCode, stdoutText, stderrText, recordFailure, failCtx);
  } catch (err) {
    const reason = `spawn-error: ${err}`;
    process.stderr.write(`[mempalace] ${action} error: ${err}\n`);
    if (recordFailure) appendRingBuffer(action, reason);
    recordMemoryEvent({
      op_kind: action,
      via: 'bridgeSync',
      args_summary: summarizeArgs(args),
      result_summary: 'err:' + String(err).slice(0, 60),
      duration_ms: Date.now() - startMs,
      status: 'error',
      relay: usedRelay,
      caller_hook: resolvedCallerHook,
    });
    return { ok: false, reason };
  }
}

/**
 * Async bridge call. Same contract as bridgeSync but spawns non-blocking so
 * callers can `Promise.all` independent actions. Useful when a handler needs
 * 3+ bridge responses whose order doesn't matter — wall-clock becomes
 * bounded by the slowest call instead of the sum of all of them.
 */
export async function bridgeAsync(
  action: string,
  args: Record<string, unknown> = {},
  timeoutMs?: number,
  recordFailure = true,
): Promise<BridgeResult> {
  const effectiveTimeoutMs = timeoutForAction(action, timeoutMs);
  const cmd = bridgeActionDirect(action, args);
  const startMs = Date.now();
  // Hoisted so the catch path tags the event correctly (mirrors bridgeSync): a
  // relayed call that throws AFTER dispatch must still record relay:true, else
  // the spawn-parity ratio would over-count it as a spawn-backed event.
  let usedRelay = false;
  try {
    // RFC-0122 ISC-21: try the warm daemon (async relay) first; fall back to the
    // cold subprocess on null. Routing bridgeAsync — alongside bridgeSync and
    // bridgeFire — is what makes the daemon the sole palace accessor, which is
    // the prerequisite for safely persisting/pre-warming it (the #1161
    // concurrent-open class). Conservative policy: relay only when the socket
    // already exists; never auto-spawn from the hot path.
    const relayed = await tryDaemonRelayAsync(action, args, effectiveTimeoutMs);
    usedRelay = relayed != null;
    let exitCode: number | null;
    let stdoutText: string;
    let stderrText: string;
    if (relayed) {
      ({ exitCode, stdoutText, stderrText } = relayed);
    } else {
      // RFC-0128 D2: the cold CLI dual-emits a memory-events line; we record one
      // below (recordMemoryEvent), so tell the CLI to suppress its numerator via
      // DOS_BRIDGE_EMIT=ts (it still writes the bridge-actions denominator).
      // Without this flag the async cold path was double-counting in the ratio.
      const proc = Bun.spawn(cmd, {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, DOS_BRIDGE_EMIT: 'ts' },
      });
      const timer = setTimeout(() => {
        try { proc.kill(); } catch { /* already exited */ }
      }, effectiveTimeoutMs);

      [stdoutText, stderrText, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      clearTimeout(timer);
    }

    const failCtx = {
      action,
      path: (usedRelay ? 'relay' : 'cold') as 'relay' | 'cold',
      explicitBudgetMs: timeoutMs != null ? effectiveTimeoutMs : undefined,
    };
    const summary = summarizeBridgeResult(exitCode, stdoutText, stderrText, failCtx);
    recordMemoryEvent({
      op_kind: action,
      via: 'bridgeAsync',
      args_summary: summarizeArgs(args),
      result_summary: summary.result_summary,
      duration_ms: Date.now() - startMs,
      status: summary.status,
      relay: usedRelay,
    });
    return parseBridgeResult(action, exitCode, stdoutText, stderrText, recordFailure, failCtx);
  } catch (err) {
    const reason = `spawn-error: ${err}`;
    process.stderr.write(`[mempalace] ${action} error: ${err}\n`);
    if (recordFailure) appendRingBuffer(action, reason);
    recordMemoryEvent({
      op_kind: action,
      via: 'bridgeAsync',
      args_summary: summarizeArgs(args),
      result_summary: 'err:' + String(err).slice(0, 60),
      duration_ms: Date.now() - startMs,
      status: 'error',
      relay: usedRelay,
    });
    return { ok: false, reason };
  }
}

export interface ObservedBridgeWorkerInput {
  action: string;
  args?: Record<string, unknown>;
  hook?: string;
  timeoutMs?: number;
}

export type BridgeRunner = (
  action: string,
  args: Record<string, unknown>,
  timeoutMs: number,
) => BridgeResult;

function defaultObservedBridgeRunner(
  action: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): BridgeResult {
  return bridgeSync(action, args, timeoutMs, false);
}

export function runObservedBridgeWorker(
  input: ObservedBridgeWorkerInput,
  runner: BridgeRunner = defaultObservedBridgeRunner,
): BridgeResult {
  const startMs = Date.now();
  const action = input.action;
  const args = input.args ?? {};
  const timeoutMs = input.timeoutMs ?? 5000;
  let result: BridgeResult;

  try {
    result = runner(action, args, timeoutMs);
  } catch (err) {
    result = { ok: false, reason: `worker-error: ${err instanceof Error ? err.message : String(err)}` };
  }

  const base = {
    source: 'observedBridgeWorker',
    hook: input.hook,
    action,
    timeout_ms: timeoutMs,
    duration_ms: Date.now() - startMs,
  };

  if (result.ok) {
    appendBridgeEvent({
      ...base,
      ok: true,
      status: typeof result.data.status === 'string' ? result.data.status : 'ok',
    });
  } else {
    appendBridgeEvent({
      ...base,
      ok: false,
      reason: result.reason.slice(0, 500),
    });
    appendRingBuffer(action, result.reason, 'observedBridgeWorker');
  }

  return result;
}

/**
 * Observed background bridge call. Foreground hooks stay fast while the
 * detached worker records the bridge result in mempalace-bridge-events.jsonl.
 */
export function bridgeObserved(
  action: string,
  args: Record<string, unknown> = {},
  opts: { hook?: string; timeoutMs?: number } = {},
): void {
  const fs = require('fs') as any;
  const inputPath = join(
    tmpdir(),
    `dos-bridge-${action.replace(/[^A-Za-z0-9_.-]/g, '_')}-${process.pid}-${Date.now()}.json`,
  );
  const payload: ObservedBridgeWorkerInput = {
    action,
    args,
    hook: opts.hook,
    timeoutMs: opts.timeoutMs,
  };

  try {
    // writeArtifact:exempt — bridge spawn payload tmp (hook-internal)
    fs.writeFileSync(inputPath, JSON.stringify(payload));
  } catch (err) {
    const reason = `write-input-error: ${err instanceof Error ? err.message : String(err)}`;
    appendBridgeEvent({ source: 'observedBridgeSpawn', hook: opts.hook, action, ok: false, reason });
    appendRingBuffer(action, reason, 'observedBridgeSpawn');
    return;
  }

  try {
    const child = spawn(process.execPath, [BRIDGE_WORKER_PATH, inputPath], {
      env: process.env,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (err) {
    const reason = `spawn-error: ${err instanceof Error ? err.message : String(err)}`;
    appendBridgeEvent({ source: 'observedBridgeSpawn', hook: opts.hook, action, ok: false, reason });
    appendRingBuffer(action, reason, 'observedBridgeSpawn');
    try { fs.unlinkSync(inputPath); } catch {}
  }
}

/**
 * Fire-and-forget bridge call. Spawns a detached process.
 * Used by hooks that don't need the result (e.g., MemPalaceRate, MemPalaceLearn).
 *
 * RFC-0005 §11.4.2 R8: bridgeFire stderr is appended to
 * $DOS_DIR/MEMORY/STATE/mempalace-errors.jsonl when the file is open-able;
 * falls back to 'ignore' so a log-path failure never breaks the bridge call.
 */
export function bridgeFire(
  action: string,
  args: Record<string, unknown> = {},
): void {
  recordDriftEvent(action, 'bridgeFire');
  const cmd = bridgeActionDirect(action, args);
  const startMs = Date.now();
  // RFC-0122 ISC-21: when the warm daemon is live, route the write through it
  // via a detached relay (fire-and-forget — we never read its result) instead
  // of cold-spawning `mempalace_bridge.py`. Routing bridgeFire is a SAFETY
  // requirement, not a speed one: a cold fire-and-forget subprocess would open
  // the palace concurrently with the daemon (the #1161 segfault class). Sending
  // the mutation through the single daemon process keeps it the sole accessor.
  // Conservative policy mirrors the sync/async paths: relay only when the
  // toggle is on AND the socket already exists; never auto-spawn.
  // KNOWN TRADEOFF (RFC-0122 ISC-22, deferred): the relay path uses
  // stderr:'ignore', so a daemon-side write error is NOT drained into
  // mempalace-errors.jsonl the way the cold path below is. The daemon logs its
  // own dispatch errors server-side; forwarding them back into the ring buffer
  // is a follow-up. Fire-and-forget never guaranteed delivery on either path.
  if (relayCanRoute()) {
    try {
      const { cmd: relayCmd, env: relayEnv } = relaySpawnArgs(action, args, timeoutForAction(action));
      const relayProc = Bun.spawn(relayCmd, { stdout: 'ignore', stderr: 'ignore', env: relayEnv });
      relayProc.unref();
      recordMemoryEvent({
        op_kind: action,
        via: 'bridgeFire',
        args_summary: summarizeArgs(args),
        result_summary: 'relayed',
        duration_ms: Date.now() - startMs,
        status: 'fire-and-forget',
        relay: true,
      });
      return;
    } catch {
      // Relay spawn failed — fall through to the cold subprocess below.
    }
  }
  // E2 (2026-05-04): replaced raw fd approach with pipe+async filter so
  // `uv run` chatter ("   Updating …" / "    Updated …") is dropped before
  // the ring buffer is written. Real errors pass through unchanged. The
  // detached async IIFE does not block the fire-and-forget caller.
  const UV_CHATTER = /^ {3,4}(Updating|Updated) /;
  const errPath = join(DOS_DIR, 'MEMORY', 'STATE', 'mempalace-errors.jsonl');
  // RFC-0128 D2: recordMemoryEvent below writes the numerator for this cold
  // fire; suppress the spawned CLI's duplicate (it keeps the bridge-actions
  // denominator). Spread process.env — Bun replaces env wholesale.
  const proc = Bun.spawn(cmd, {
    stdout: 'ignore',
    stderr: 'pipe',
    env: { ...process.env, DOS_BRIDGE_EMIT: 'ts' },
  });
  (async () => {
    try {
      const fs = require('fs') as any;
      const errDir = join(DOS_DIR, 'MEMORY', 'STATE');
      if (!fs.existsSync(errDir)) fs.mkdirSync(errDir, { recursive: true });
      const dec = new TextDecoder();
      let buf = '';
      for await (const chunk of proc.stderr as unknown as AsyncIterable<Uint8Array>) {
        buf += dec.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line && !UV_CHATTER.test(line)) {
            try { fs.appendFileSync(errPath, line + '\n'); } catch {}
          }
        }
      }
      // Flush remaining buffer (process exited without trailing newline).
      if (buf && !UV_CHATTER.test(buf)) {
        try { fs.appendFileSync(errPath, buf + '\n'); } catch {}
      }
    } catch {}
  })();
  recordMemoryEvent({
    op_kind: action,
    via: 'bridgeFire',
    args_summary: summarizeArgs(args),
    result_summary: 'spawned',
    duration_ms: Date.now() - startMs,
    status: 'fire-and-forget',
  });
}

// ─── Batch operations ─────────────────────────────────
//
// Bulk mutations (sentinel scans, enrichKG, legacy migrations) paid N×
// subprocess startup cost when each op went through bridgeSync. `bridge.batch`
// shares one ChromaDB client + KG connection across all ops in a single
// subprocess — typically 13× faster on a 13-op run. Callers build a list of
// `BridgeOp`s, pass success/failure callbacks, and `batchOps` fires the batch
// (with per-call bridgeSync fallback on outright batch failure).
//
// Pattern originated in MemoryHarvest.hook.ts:618-646 (queueOp/flushOps).
// The abstraction here accepts `items: T extends {op: BridgeOp}` so callers
// can attach per-op metadata (mutation closures, stat keys, origin) that
// flows back to onSuccess/onFailure — needed for SessionContextEnrich
// where each op has a writtenFacts mutation to apply.

export type BridgeOp = { action: string; args: Record<string, unknown> };

/** Push a bridge op onto the caller's ops array. No-ops silently when the
 * bridge script is unreachable — keeps callsites terse and safe on hosts
 * where MemPalace isn't installed. */
export function queueOp(
  ops: BridgeOp[],
  action: string,
  args: Record<string, unknown>,
): void {
  const { existsSync } = require('fs') as { existsSync: (p: string) => boolean };
  if (!existsSync(BRIDGE_PATH)) return;
  ops.push({ action, args });
}

/** Timeout calibration copied from MemoryHarvest.hook.ts:623 — 1.5s baseline
 * + 200ms per op, capped at 30s. Tuned against typical palace sizes. */
export function batchTimeoutFor(opCount: number): number {
  return Math.min(30000, 1500 + opCount * 200);
}

/**
 * Phase enum surfaced through `batchOps` — callers inspecting mode (e.g.
 * MemoryHarvest's `{mode: "batch" | "fallback"}` return) should switch on
 * this instead of string-comparing phase literals. Renames here become type
 * errors at consumer sites.
 */
export type BatchPhase = 'batch-ok' | 'batch-partial' | 'batch-fallback';

export interface BatchExecResult {
  ok: number;
  failed: number;
  phase: BatchPhase;
}

export interface BatchCallbacks<T> {
  /** Optional — omit when the caller only needs the aggregate `{ok, failed, phase}`
   * return value (e.g., MemoryHarvest's flushOps). Callers that must mutate local
   * state per op (e.g., SessionContextEnrich's apply/statKey closures) pass one. */
  onSuccess?: (item: T) => void;
  onFailure?: (item: T) => void;
  logFn?: (entry: { phase: BatchPhase; ops: number; failed?: number; reason?: string }) => void;
}

/**
 * Execute a list of bridge operations via `bridge.batch` with a per-call
 * `bridgeSync` fallback on outright batch failure. Invokes `onSuccess(item)`
 * for every op that completed successfully; `onFailure(item)` for each failed
 * op (optional). Emits phase events via `logFn` when provided:
 *   `batch-ok`       — all ops succeeded in one subprocess
 *   `batch-partial`  — bridge reported per-op results; some failed
 *   `batch-fallback` — batch could not report per-op outcomes; fell back to N serial calls
 */
export function batchOps<T extends { op: BridgeOp }>(
  items: T[],
  callbacks: BatchCallbacks<T>,
): BatchExecResult {
  const stats: BatchExecResult = { ok: 0, failed: 0, phase: 'batch-ok' };
  if (items.length === 0) return stats;

  const log = callbacks.logFn ?? (() => {});
  const ops = items.map(i => i.op);
  const timeoutMs = batchTimeoutFor(ops.length);
  const batchStartMs = Date.now();
  // Build op-kind counts up front; emission happens once on flush regardless
  // of which phase the batch resolves through.
  const opKindCounts: Record<string, number> = {};
  for (const item of items) {
    const k = item.op.action;
    opKindCounts[k] = (opKindCounts[k] ?? 0) + 1;
  }
  const opKindSummary = Object.entries(opKindCounts)
    .map(([k, n]) => `${k}:${n}`)
    .join(',');

  const batchResult = bridgeSync('batch', { operations: ops }, timeoutMs);

  const emitBatchEvent = () => {
    const total = items.length;
    const status: 'ok' | 'error' | 'degraded' =
      stats.failed === 0 ? 'ok' : stats.ok === 0 ? 'error' : 'degraded';
    recordMemoryEvent({
      op_kind: 'batch',
      via: 'batchOps',
      args_summary: `${total} ops: ${opKindSummary}`.slice(0, 120),
      result_summary: `${stats.ok}/${total}`,
      duration_ms: Date.now() - batchStartMs,
      status,
    });
  };

  if (batchResult.ok && batchResult.data.status === 'ok') {
    for (const item of items) { callbacks.onSuccess?.(item); stats.ok++; }
    log({ phase: 'batch-ok', ops: items.length });
    emitBatchEvent();
    return stats;
  }

  if (batchResult.ok && batchResult.data.status === 'partial') {
    const results = (batchResult.data.results as Array<{ status?: string }> | undefined) ?? [];
    for (let i = 0; i < items.length; i++) {
      if (results[i]?.status === 'ok') {
        callbacks.onSuccess?.(items[i]);
        stats.ok++;
      } else {
        callbacks.onFailure?.(items[i]);
        stats.failed++;
      }
    }
    stats.phase = 'batch-partial';
    log({ phase: stats.phase, ops: items.length, failed: stats.failed });
    emitBatchEvent();
    return stats;
  }

  const reason = batchResult.ok ? (batchResult.data.status ?? 'unknown') : batchResult.reason;
  stats.phase = 'batch-fallback';
  log({ phase: stats.phase, ops: items.length, reason: String(reason).slice(0, 120) });

  for (const item of items) {
    const r = bridgeSync(item.op.action, item.op.args, timeoutForAction(item.op.action));
    if (r.ok) {
      callbacks.onSuccess?.(item);
      stats.ok++;
    } else {
      callbacks.onFailure?.(item);
      stats.failed++;
    }
  }
  emitBatchEvent();
  return stats;
}

// ─── Unified queryMemory ─────────────────────────────────

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { getWorkDir } from './paths';
import { isTerminalPhase } from './tab-constants';
import { atomicWriteSync, withFileLock } from './atomic-write';

const STATE_DIR = join(DOS_DIR, 'MEMORY', 'STATE');
const WORK_DIR = getWorkDir();
const CANONICAL_DIR = join(DOS_DIR, 'MEMORY', 'CANONICAL');

// ─── Substrate-ordering assertion (RFC-0037 §4.1, Pragmatic Tip 39) ──────
//
// The new CANONICAL/ asset class holds adjudicated "current truth" per
// load-bearing primitive (Studio, MemPalace, gateway-env, …). When a
// query mentions a primitive AND CANONICAL/{primitive}.md exists, that
// file MUST be reached before the WORK/ scan returns a result —
// otherwise the recall is reading an in-flight receipt instead of the
// adjudicated truth. We don't yet route reads through CANONICAL/
// (Phase 1 is the recall-function sprout); for now, fire a non-blocking
// stderr warning so the inversion is visible. NEVER throw — telemetry
// only, per the brief's "warns to stderr, does NOT throw" constraint.
const SUBSTRATE_ASSERTION_DISABLED = process.env.DOS_SUBSTRATE_ASSERTION === '0';

function findCanonicalPrimitives(): Set<string> {
  if (SUBSTRATE_ASSERTION_DISABLED) return new Set();
  try {
    if (!existsSync(CANONICAL_DIR)) return new Set();
    return new Set(
      readdirSync(CANONICAL_DIR)
        .filter((n) => n.endsWith('.md') && n !== 'README.md')
        .map((n) => n.slice(0, -3).toLowerCase()),
    );
  } catch {
    return new Set();
  }
}

/**
 * Fire a non-blocking stderr warning if any of the queried primitives
 * has a corresponding CANONICAL/{primitive}.md but the read path returned
 * a WORK/ result first. Pure observation — never mutates routing.
 *
 * `primitives` is the lower-cased set of primitive names the caller
 * believes the query references; for callers without explicit hints
 * the entire CANONICAL/ surface is matched against the WORK reading
 * (every CANONICAL primitive becomes a candidate inversion).
 */
export function assertSubstrateOrdering(args: {
  primitives?: string[];
  workReached: boolean;
  source: string;
}): void {
  if (SUBSTRATE_ASSERTION_DISABLED) return;
  if (!args.workReached) return;
  const canonical = findCanonicalPrimitives();
  if (canonical.size === 0) return;

  const probed = (args.primitives && args.primitives.length > 0)
    ? args.primitives.map((p) => p.toLowerCase()).filter((p) => canonical.has(p))
    : Array.from(canonical);
  if (probed.length === 0) return;

  try {
    process.stderr.write(
      `[mempalace] substrate-ordering: WORK/ reached for ${args.source} ` +
        `but CANONICAL/ holds ${probed.join(',')}.md — recall should consult CANONICAL first ` +
        `(non-blocking; RFC-0037 §4.1, Pragmatic Tip 39)\n`,
    );
  } catch {
    // Non-blocking telemetry — never throw.
  }
}

export type MemoryIntent = 'BOOT' | 'RESUME' | 'RECALL' | 'STATUS' | 'SEARCH';

export interface MemoryQuery {
  intent: MemoryIntent;
  query?: string;
  wing?: string;
  limit?: number;
  sessionId?: string;
  /**
   * STATUS intent: when true AND `wing` is set, queryStatus also runs an
   * unscoped `kg_query_predicate` and returns `crossProjectCommitments` in
   * metadata — the set of open commitments whose subject is NOT the current
   * wing. Used by IntentRetrieval.handleStatus to surface multi-project load.
   */
  includeCrossWing?: boolean;
  /**
   * SEARCH intent: output format.
   *   'joined'  (default) — results joined by `\n---\n`, content only.
   *   'compact'           — one line per result as `[wing/room] <content-300>`.
   */
  format?: 'joined' | 'compact';
  /**
   * SEARCH intent: optional client-side relevance gate. When set to a finite
   * number > 0, querySearch drops hits whose effective_distance (preferred) or
   * raw distance exceeds it; BM25-only hits (distance null) are kept fail-open.
   * Undefined/0/NaN/negative disables the gate (today's behavior). The bridge
   * args are unchanged — filtering is uniform TS-side, so every non-hook bridge
   * consumer stays byte-identical.
   */
  maxDistance?: number;
}

export interface MemoryResult {
  intent: MemoryIntent;
  content: string | null;
  source: string;
  metadata?: Record<string, unknown>;
}

/**
 * Unified memory retrieval. Routes to the appropriate backend based on intent.
 * Never throws — returns null content on any failure.
 */
export function queryMemory(query: MemoryQuery): MemoryResult {
  const { intent } = query;
  try {
    switch (intent) {
      case 'BOOT':
      case 'RECALL':
        return querySnapshot(query);
      case 'RESUME':
        return queryResume(query);
      case 'STATUS':
        return queryStatus(query);
      case 'SEARCH':
        return querySearch(query);
      default:
        return { intent, content: null, source: 'unknown' };
    }
  } catch {
    return { intent, content: null, source: 'error' };
  }
}

/**
 * BOOT / RECALL: Read pre-computed session snapshot.
 */
function querySnapshot(query: MemoryQuery): MemoryResult {
  const suffix = query.wing || 'global';
  const snapshotPath = join(STATE_DIR, `next-session-context-${suffix}.md`);

  if (!existsSync(snapshotPath)) {
    return { intent: query.intent, content: null, source: 'snapshot' };
  }

  try {
    const content = readFileSync(snapshotPath, 'utf-8').trim();
    if (content.length < 50) {
      return { intent: query.intent, content: null, source: 'snapshot' };
    }

    const stat = statSync(snapshotPath);
    const ageMs = Date.now() - stat.mtimeMs;
    const ageHours = Math.round(ageMs / 3600000);
    const ageLabel = ageHours < 1 ? 'less than an hour ago'
      : ageHours < 24 ? `${ageHours}h ago`
      : `${Math.round(ageHours / 24)} days ago`;

    return {
      intent: query.intent,
      content,
      source: 'snapshot',
      metadata: { path: snapshotPath, ageMs, ageLabel },
    };
  } catch {
    return { intent: query.intent, content: null, source: 'snapshot' };
  }
}

/**
 * RESUME: Scan WORK/ for most recent non-complete PRD.
 * Extracts task, phase, progress, unchecked criteria.
 */
function listRecentWorkDirs(workDir: string, limit: number): string[] {
  try {
    return readdirSync(workDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{8}-\d{6}_/.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}

function parseFrontmatterFields(
  fmBlock: string,
): { task?: string; phase?: string; progress?: string } {
  const get = (name: string): string | undefined =>
    fmBlock.match(new RegExp(`^${name}:\\s*"?(.+?)"?\\s*$`, 'm'))?.[1];
  return { task: get('task'), phase: get('phase'), progress: get('progress') };
}

function extractUncheckedCriteria(content: string, limit: number): string[] {
  const matches = content.match(/- \[ \] ISC-?\w*:\s*(.+)/g) || [];
  return matches
    .map((line) => line.replace(/- \[ \] ISC-?\w*:\s*/, '').trim())
    .slice(0, limit);
}

function extractRecentDecisions(content: string, limit: number): string[] {
  const block = content.match(/## Decisions\n([\s\S]*?)(?=\n## |$)/);
  if (!block) return [];
  return block[1].trim().split('\n')
    .map((line) => line.replace(/^- /, '').trim())
    .filter((line) => line && line.length > 5)
    .slice(-limit);
}

function extractContextSection(content: string, maxChars: number): string {
  const block = content.match(/## Context\n([\s\S]*?)(?=\n## |$)/);
  return block ? block[1].trim().substring(0, maxChars) : '';
}

function parseResumePrd(workDir: string, dirName: string): MemoryResult | null {
  const prdPath = join(workDir, dirName, 'PRD.md');
  if (!existsSync(prdPath)) return null;

  let content: string;
  try {
    content = readFileSync(prdPath, 'utf-8');
  } catch {
    return null;
  }

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const fm = parseFrontmatterFields(fmMatch[1]);
  if (isTerminalPhase(fm.phase)) return null;

  return {
    intent: 'RESUME',
    content: fm.task || 'Unknown task',
    source: 'prd',
    metadata: {
      prdPath,
      dirName,
      phase: fm.phase || 'unknown',
      progress: fm.progress || '0/0',
      uncheckedCriteria: extractUncheckedCriteria(content, 10),
      recentDecisions: extractRecentDecisions(content, 3),
      context: extractContextSection(content, 300),
    },
  };
}

function queryResume(query: MemoryQuery): MemoryResult {
  if (!existsSync(WORK_DIR)) {
    return { intent: 'RESUME', content: null, source: 'prd' };
  }
  for (const dirName of listRecentWorkDirs(WORK_DIR, 10)) {
    const result = parseResumePrd(WORK_DIR, dirName);
    if (result) {
      // Non-blocking substrate-ordering check (RFC-0037 §4.1):
      // if CANONICAL/{primitive}.md exists for any term in the resumed
      // PRD's task line, fire stderr warning — recall should have
      // consulted CANONICAL/ before reaching WORK/.
      try {
        const taskTokens = (typeof result.content === 'string'
          ? result.content.toLowerCase().split(/[\s,/.-]+/).filter((t) => t.length > 2)
          : []);
        assertSubstrateOrdering({
          primitives: taskTokens,
          workReached: true,
          source: query.intent === 'RESUME' ? `RESUME:${dirName}` : `${query.intent}:${dirName}`,
        });
      } catch {
        // Telemetry must not affect the read path.
      }
      return result;
    }
  }
  return { intent: 'RESUME', content: null, source: 'prd' };
}

/**
 * STATUS: Query KG for commitments, deferrals, blockers. Scan WORK/ for
 * pending items. When `query.wing` is set, KG predicate queries are
 * wing-scoped; when `query.includeCrossWing` is also true, a second
 * unscoped query fills `crossProjectCommitments` so consumers can render
 * "X commitments here, Y elsewhere" without two call-site queries.
 *
 * RFC-0005 §14.9 completion: IntentRetrieval.handleStatus ported here so
 * cross-project logic lives in one place and the hook just formats output.
 */
interface PendingWorkItem {
  task: string;
  phase: string;
  progress: string;
}

interface StatusParts extends Record<string, unknown[]> {
  commitments: unknown[];
  crossProjectCommitments: unknown[];
  deferrals: unknown[];
  blockers: unknown[];
  pendingWork: PendingWorkItem[];
}

const STATUS_LABELS: Array<[keyof StatusParts, string]> = [
  ['commitments', 'commitment(s)'],
  ['crossProjectCommitments', 'cross-project commitment(s)'],
  ['deferrals', 'deferral(s)'],
  ['blockers', 'blocker(s)'],
  ['pendingWork', 'pending work item(s)'],
];

function queryActivePredicate(
  predicate: string,
  scopedTo: string | undefined,
  limit: number,
  extraFilter?: (f: any) => boolean,
): any[] {
  const args: Record<string, unknown> = { predicate };
  if (scopedTo) args.wing = scopedTo;
  try {
    const result = bridgeSync('kg_query_predicate', args, 3000);
    if (!result.ok) return [];
    let facts = ((result.data.facts || []) as any[]).filter(
      (f: any) => f.current !== false,
    );
    // The Python bridge's kg_query_predicate ignores the `wing` arg (it only
    // filters by subject/object), so an unscoped result set comes back for
    // every wing. Enforce wing scoping client-side with the same subject rule
    // crossProjectCommitments uses; drop this guard if the bridge ever honors
    // `wing` natively.
    if (scopedTo) {
      facts = facts.filter((f: any) => {
        const subj = (f.subject || '') as string;
        return subj === scopedTo || subj === `project:${scopedTo}`;
      });
    }
    if (extraFilter) facts = facts.filter(extraFilter);
    return facts.slice(0, limit);
  } catch {
    return [];
  }
}

function loadPendingWork(workDir: string, limit: number): PendingWorkItem[] {
  if (!existsSync(workDir)) return [];
  try {
    const dirs = readdirSync(workDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{8}-\d{6}_/.test(d.name))
      .map((d) => d.name)
      .sort()
      .reverse()
      .slice(0, limit);

    const out: PendingWorkItem[] = [];
    for (const dirName of dirs) {
      const prdPath = join(workDir, dirName, 'PRD.md');
      if (!existsSync(prdPath)) continue;
      const head = readFileSync(prdPath, 'utf-8').substring(0, 400);
      const phase = head.match(/^phase:\s*"?(\w+)"?/m)?.[1];
      const task = head.match(/^task:\s*"?(.+?)"?\s*$/m)?.[1];
      const progress = head.match(/^progress:\s*"?(.+?)"?\s*$/m)?.[1];
      if (phase && !isTerminalPhase(phase) && task) {
        out.push({ task, phase, progress: progress || '?' });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function buildStatusSummary(parts: StatusParts): string {
  return STATUS_LABELS
    .filter(([key]) => parts[key].length > 0)
    .map(([key, label]) => `${parts[key].length} ${label}`)
    .join(', ');
}

function queryStatus(query: MemoryQuery): MemoryResult {
  const wing = query.wing;
  const parts: StatusParts = {
    commitments: queryActivePredicate('committed_to', wing, 10),
    crossProjectCommitments:
      wing && query.includeCrossWing
        ? queryActivePredicate('committed_to', undefined, 5, (f) => {
            const subj = (f.subject || '') as string;
            return subj !== wing && subj !== `project:${wing}`;
          })
        : [],
    deferrals: queryActivePredicate('deferred', wing, 5),
    blockers: queryActivePredicate('blocked_by', wing, 5),
    pendingWork: loadPendingWork(WORK_DIR, 15),
  };

  const hasData = Object.values(parts).some((arr) => arr.length > 0);
  if (!hasData) return { intent: 'STATUS', content: null, source: 'kg' };

  return {
    intent: 'STATUS',
    content: buildStatusSummary(parts),
    source: 'kg',
    metadata: parts,
  };
}

/**
 * Stop-word list shared with `extractKeywords()` — filters noise before a
 * semantic search so short prompts become useful queries.
 */
const SEARCH_STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither',
  'if', 'then', 'else', 'when', 'where', 'how', 'why', 'all', 'each', 'every',
  'some', 'any', 'no', 'just', 'only', 'very', 'too', 'also', 'now', 'here',
  'there', 'than', 'more', 'most', 'other', 'such', 'own', 'same',
  'let', 'lets', "let's", 'please', 'want', 'like', 'make', 'go', 'get',
  'hi', 'hey', 'hello', 'ok', 'okay', 'yes', 'no', 'yeah', 'sure', 'thanks',
]);

/**
 * Distill a prompt into a short keyword list suitable for semantic search.
 * Used by querySearch so consumers don't have to reimplement the filter.
 */
export function extractKeywords(prompt: string, max: number = 8): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !SEARCH_STOPWORDS.has(w))
    .slice(0, max);
}

/**
 * SEARCH: Query MemPalace bridge for semantic search results.
 *
 * `query.format`:
 *   'joined' (default) — content only, joined by `\n---\n`.
 *   'compact'          — one line per result as `[wing/room] <content-800>`.
 *
 * Keyword extraction is applied automatically to the input prompt so short
 * user messages ("what did we decide about auth") become useful queries;
 * callers that have already distilled their query can pass it as-is — the
 * extractor is a no-op on already-short keyword strings.
 */
function emptySearchResult(): MemoryResult {
  return { intent: 'SEARCH', content: null, source: 'mempalace' };
}

// Apply stop-word filter / keyword extraction only on long free-form prompts.
// Short queries (e.g. "RFC-0005 rollout") pass through untouched — extractor
// is a no-op on already-short keyword strings.
function distillSearchQuery(raw: string): string {
  return raw.split(/\s+/).length > 5 ? extractKeywords(raw).join(' ') : raw;
}

function runSemanticSearch(
  distilled: string,
  wing: string | undefined,
  limit: number | undefined,
): any[] {
  const args: Record<string, unknown> = { query: distilled };
  if (wing) args.wing = wing;
  if (limit) args.limit = limit;
  const result = bridgeSync('search', args, 5000);
  if (!result.ok) return [];
  return (result.data.results || result.data.matches || []) as any[];
}

function formatSearchCompact(results: any[]): string {
  return results
    .map((r: any) => {
      // Bridge `search` returns wing/room at top level on current upstream;
      // older payloads nested them under `metadata`. Check both shapes so the
      // header never collapses to [unknown/unknown] when the data is present.
      const wingName = r.wing ?? r.metadata?.wing ?? 'unknown';
      const room = r.room ?? r.metadata?.room ?? 'unknown';
      const body = (r.content || r.document || r.text || '').toString().substring(0, 800);
      return `[${wingName}/${room}] ${body}`;
    })
    .join('\n\n');
}

function formatSearchJoined(results: any[]): string {
  return results
    .map((r: any) => r.content || r.text || r.summary || JSON.stringify(r))
    .join('\n---\n');
}

function querySearch(query: MemoryQuery): MemoryResult {
  if (!query.query) return emptySearchResult();

  const distilled = distillSearchQuery(query.query);
  if (!distilled) return emptySearchResult();

  const results = runSemanticSearch(distilled, query.wing, query.limit);
  if (results.length === 0) return emptySearchResult();

  // Client-side relevance gate (folds the RedTeam max_distance majors): filter
  // in TS, not the bridge, so pre-filter emptiness stays observable to the
  // handleSearch fallback decision and the gate keys on effective_distance
  // (post-closet-boost). Gate is opt-in — disabled unless maxDistance is finite > 0.
  let filtered = results;
  if (
    typeof query.maxDistance === 'number' &&
    query.maxDistance > 0 &&
    Number.isFinite(query.maxDistance)
  ) {
    const maxDistance = query.maxDistance;
    filtered = results.filter((r: any) => {
      // Prefer post-boost distance; fall back to raw. BM25-only hits carry
      // distance null and are kept fail-open (genuine lexical relevance).
      const d =
        typeof r.effective_distance === 'number'
          ? r.effective_distance
          : typeof r.distance === 'number'
            ? r.distance
            : null;
      return d === null || d <= maxDistance;
    });
    if (filtered.length === 0) {
      // Survivors empty but the pre-filter pool was non-empty: signal a relevance
      // miss (NOT a pool miss) so handleSearch suppresses the cross-project
      // fallback — the wing genuinely had matches, they were just too distant.
      return {
        intent: 'SEARCH',
        content: null,
        source: 'mempalace',
        metadata: { preFilterCount: results.length, filteredOut: true, maxDistance },
      };
    }
  }

  const format = query.format || 'joined';
  const content = format === 'compact' ? formatSearchCompact(filtered) : formatSearchJoined(filtered);

  return {
    intent: 'SEARCH',
    content,
    source: 'mempalace',
    metadata: {
      resultCount: filtered.length,
      raw: filtered,
      format,
      preFilterCount: results.length,
      filteredCount: filtered.length,
    },
  };
}

// ─── v3.3.0 Bridge Actions ─────────────────────────────────

/**
 * Check text for contradictions against entity registry and knowledge graph.
 * Returns issues: similar_name, relationship_mismatch, stale_fact.
 */
export function factCheck(
  text: string,
  timeoutMs: number = 5000,
): BridgeResult {
  return bridgeSync('fact_check', { text }, timeoutMs);
}

/**
 * Build closet pointer lines for a specific source file's drawers.
 */
export function buildClosets(
  sourceFile: string,
  timeoutMs: number = 10000,
): BridgeResult {
  return bridgeSync('build_closets', { source_file: sourceFile }, timeoutMs);
}

/**
 * Rebuild closet index for all drawers (or filtered by wing).
 * Migration utility for upgrading from pre-3.3.0 palaces.
 */
export function rebuildClosets(
  wing?: string,
  timeoutMs: number = 30000,
): BridgeResult {
  const args: Record<string, unknown> = {};
  if (wing) args.wing = wing;
  return bridgeSync('rebuild_closets', args, timeoutMs);
}

// ─── KG written-facts persistence (RFC-0027 §5.4) ─────────────────────────
//
// kg-written-facts.json (under MEMORY/STATE/) tracks the (subject, predicate,
// object) tuples that SessionContextEnrich.daemon.ts has previously written
// to the KG so subsequent runs know whether a fact is unchanged, superseded,
// or net-new. The original implementation used a bare writeFileSync, which
// produced two failure modes under bulk SessionEnds:
//
//   1. Torn writes — a process killed mid-write leaves a half-serialized
//      JSON file; the next loadWrittenFacts() catches the parse error and
//      silently resets to an empty Map, dropping the entire history.
//   2. Lost updates — two concurrent daemons both load → modify → save;
//      whichever finishes second clobbers the first's modifications.
//
// The helper below pairs withFileLock (POSIX-atomic mkdir lock,
// hooks/lib/atomic-write.ts) with atomicWriteSync (tmp + fsync + rename) so
// concurrent daemons serialize on the lock and always produce a complete,
// well-formed JSON file. The daemon is the only writer today; routing all
// future call sites through this helper keeps that invariant.

/** The on-disk schema for kg-written-facts.json. */
export interface KgWrittenFact {
  object: string;
  valid_from: string;
}

export interface KgWrittenFactsPayload {
  facts: Record<string, KgWrittenFact>;
  updated: string;
}

/** Canonical path for the kg-written-facts.json state file. STATE is a
 * global-only subdir (CLAUDE.md "global-only subdirs"), so this resolves
 * to $DOS_DIR/MEMORY/STATE/kg-written-facts.json without going through
 * getMemorySubdir. */
export function getKgWrittenFactsPath(): string {
  return join(DOS_DIR, 'MEMORY', 'STATE', 'kg-written-facts.json');
}

/**
 * Write the kg-written-facts.json payload atomically with an exclusive
 * file lock. Returns true on success, false on filesystem failure (the
 * helper is advisory — the daemon's existing error swallow is preserved).
 *
 * Concurrency: withFileLock serializes concurrent writers; atomicWriteSync
 * guarantees torn-write protection on the rename target. The 5s lock
 * timeout matches the daemon's bridge timeouts — long enough for the
 * write to complete, short enough that a wedged lock surfaces as a thrown
 * error the caller can log.
 */
export function writeKgWrittenFactsAtomic(
  payload: KgWrittenFactsPayload,
  timeoutMs: number = 5000,
): boolean {
  const path = getKgWrittenFactsPath();
  try {
    return withFileLock(
      path,
      () => atomicWriteSync(path, JSON.stringify(payload)),
      timeoutMs,
    );
  } catch {
    // withFileLock throws only on lock-acquisition timeout. Treat that the
    // same as any other write failure — non-critical state file, caller's
    // existing swallow keeps the hook nonblocking.
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// v0.0.20 slice 0a-MEMORY — confirmed-write path (read-after-write).
//
// `bridgeFire` is fire-and-forget and `writeSuccessRate` excludes those
// events, so "did my write persist?" was structurally unanswerable. For
// campaign-critical writes (checkpoint facts, decision archives) this
// wrapper performs ONE write via bridgeSync, then an independent read-back,
// and reports `confirmed` only when the read proves the write landed.
//
// Contract (PRD 20260610-153232_v0020-slice-0a-memory ISC-15..21):
//  - read-back failure NEVER re-runs the write (RFC-0128 §6 R1 — a relay
//    that executed then crashed must not be replayed by this layer);
//  - both inner calls carry caller_hook='bridgeSyncConfirmed', so the
//    memory-events log distinguishes confirmed-path traffic WITHOUT adding
//    extra event lines that would skew the RFC-0128 event/action ratio;
//  - unsupported actions are reported honestly (`unsupported-action`),
//    never silently downgraded to plain bridgeSync semantics.
// ─────────────────────────────────────────────────────────────────────

export type ConfirmedDetail =
  | 'confirmed'
  | 'write-failed'
  | 'readback-failed'
  | 'readback-miss'
  | 'page-overflow'
  | 'unsupported-action';

export type ConfirmedWriteResult = {
  write: BridgeResult;
  read: BridgeResult | null;
  confirmed: boolean;
  detail: ConfirmedDetail;
};

/** Injectable runner seam for tests — production default is bridgeSync. */
export type ConfirmedSyncRunner = (
  action: string,
  args: Record<string, unknown>,
  timeoutMs?: number,
  recordFailure?: boolean,
  callerHook?: string,
) => BridgeResult;

const CONFIRMED_CALLER_TAG = 'bridgeSyncConfirmed';

/**
 * Read-back budget. Without an explicit timeout the read legs inherit
 * PER_ACTION_TIMEOUT_MS defaults (kg_query_predicate: 30s) — a confirmed write
 * could then block ~45s synchronously. 8s mirrors the DECISION ARCHIVE budget.
 */
const CONFIRMED_READBACK_TIMEOUT_MS = 8000;

/**
 * Actions this wrapper can independently read back. update_drawer is
 * deliberately ABSENT: its drawer_id pre-exists by definition, so a presence
 * read-back proves nothing about the update — a vacuous confirm is worse than
 * an honest unsupported-action.
 */
const CONFIRMABLE_ACTIONS = new Set(['add_kg_fact', 'add_drawer', 'upsert_drawer']);

/**
 * Mirror of the KG's entity-id normalization (lower, whitespace→underscores,
 * apostrophes stripped). The KG stores the FIRST writer's normalized form
 * (INSERT OR IGNORE), so a strict === against caller args false-negatives on
 * casing/spacing differences.
 */
function kgNormalize(v: unknown): string {
  return String(v ?? '').toLowerCase().replace(/\s+/g, '_').replace(/'/g, '');
}

function confirmKgFact(
  runner: ConfirmedSyncRunner,
  args: Record<string, unknown>,
  write: BridgeResult,
): ConfirmedWriteResult {
  const read = runner(
    'kg_query_predicate',
    { predicate: args.predicate, subject: args.subject },
    CONFIRMED_READBACK_TIMEOUT_MS,
    true,
    CONFIRMED_CALLER_TAG,
  );
  if (!read.ok) return { write, read, confirmed: false, detail: 'readback-failed' };
  const facts = Array.isArray(read.data.facts) ? (read.data.facts as Array<Record<string, unknown>>) : [];
  const wantSubject = kgNormalize(args.subject);
  const wantObject = kgNormalize(args.object);
  const hit = facts.some(
    (f) =>
      kgNormalize(f.subject) === wantSubject &&
      kgNormalize(f.object) === wantObject &&
      f.current !== false,
  );
  return { write, read, confirmed: hit, detail: hit ? 'confirmed' : 'readback-miss' };
}

function confirmDrawer(
  runner: ConfirmedSyncRunner,
  args: Record<string, unknown>,
  write: BridgeResult & { ok: true },
): ConfirmedWriteResult {
  const drawerId = typeof write.data.drawer_id === 'string' ? write.data.drawer_id : undefined;
  if (!drawerId) return { write, read: null, confirmed: false, detail: 'readback-miss' };
  const wing = (write.data.wing as string | undefined) ?? (args.wing as string | undefined);
  const room = (write.data.room as string | undefined) ?? (args.room as string | undefined);
  const limit = 200;
  const read = runner(
    'list_drawers',
    { wing, room, limit, preview_chars: 1 },
    CONFIRMED_READBACK_TIMEOUT_MS,
    true,
    CONFIRMED_CALLER_TAG,
  );
  if (!read.ok) return { write, read, confirmed: false, detail: 'readback-failed' };
  const drawers = Array.isArray(read.data.drawers)
    ? (read.data.drawers as Array<Record<string, unknown>>)
    : [];
  if (drawers.some((d) => d.id === drawerId)) {
    return { write, read, confirmed: true, detail: 'confirmed' };
  }
  // Honest distinction: a full page means the drawer may exist beyond the page.
  const overflowed = typeof read.data.count === 'number' && read.data.count >= limit;
  return { write, read, confirmed: false, detail: overflowed ? 'page-overflow' : 'readback-miss' };
}

/**
 * Write-then-confirm. One write, one independent read-back, never a retry.
 * `confirmed: true` means the read proved persistence; anything else is an
 * honest "unknown" the caller can escalate (e.g. campaign checkpoint mirrors
 * to a plain file when unconfirmed).
 */
export function bridgeSyncConfirmed(
  action: string,
  args: Record<string, unknown> = {},
  opts: { timeoutMs?: number; runner?: ConfirmedSyncRunner } = {},
): ConfirmedWriteResult {
  const runner: ConfirmedSyncRunner = opts.runner ?? bridgeSync;
  if (!CONFIRMABLE_ACTIONS.has(action)) {
    return { write: { ok: false, reason: `no read-back verb for "${action}"` }, read: null, confirmed: false, detail: 'unsupported-action' };
  }
  const write = runner(action, args, opts.timeoutMs, true, CONFIRMED_CALLER_TAG);
  if (!write.ok) return { write, read: null, confirmed: false, detail: 'write-failed' };

  if (action === 'add_kg_fact') return confirmKgFact(runner, args, write);
  return confirmDrawer(runner, args, write as BridgeResult & { ok: true });
}
