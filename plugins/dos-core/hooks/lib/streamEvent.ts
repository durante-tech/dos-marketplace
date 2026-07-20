/**
 * streamEvent — event-driven Studio telemetry capture (iter-2 PR3a)
 *
 * Implements the capture primitive from Plans/Specs/studio-sync-streaming.md
 * (§The Three Primitives / Primitive #1). Callers — unified dispatcher
 * in PR3b, or directly from hook modules that care about mid-session
 * streaming — call `capture(tool, payload, opts)`. The primitive wraps
 * the payload in an iter-1 v2 envelope (forward-compatible), writes to
 * `.streaming/` sibling queue via tmp+fsync+rename, and hands off to
 * the iter-1 PR2/drainer path (or SessionStart `--retry-pending`) for
 * POST-to-Studio.
 *
 * All 11 RedTeam R4 mitigations from the spec are baked in:
 *
 *   Attack 1 — Drainer startup race              → drainer owns; unchanged here
 *   Attack 2 — Filename collision                 → {sessionId}-{pid}-{epochMs}-{atomicCounter}.ready
 *   Attack 3 — Submodule bump mid-session         → drainer concern
 *   Attack 4 — First-run before sentinel scan     → bootstrap gate; no mkdir
 *   Attack 5 — rm -rf MEMORY/ mid-session         → ENOENT → 60s in-memory ring
 *   Attack 6 — PostToolUse chain fsync stall      → Promise.race(fs.promises.fsync, 2000ms) → .unfsynced/
 *   Attack 7 — ack.jsonl divergence               → drainer concern (extended separately in dlq.ts)
 *   Attack 8 — Ring-buffer flush loss on crash    → security/corrections BYPASS ring (direct-to-disk)
 *   Attack 9 — 10K drop-oldest drops security     → per-category overflow policy (below)
 *   Attack 10 — 5-hook-per-matcher silent drop    → unified dispatcher concern (PR3b)
 *   Attack 11 — PR3b flip during audit window     → calendar guard (separate tool)
 *
 * Category policy:
 *   security, corrections:           direct-to-disk, drop-NEVER (throws QueueFullError)
 *   artifacts, voice, learnings:     direct-to-disk, drop-oldest-warn at 10k
 *   hook-metrics, kg-deltas:         ring buffer (≤32 events / ≤500ms), drop-oldest-silent at 10k
 *
 * Public API:
 *   capture(tool, payload, opts)    — main entry; async; never throws on normal path
 *   flushRing()                     — explicit flush hook for exit paths
 *   streamingDir(tool, scope)       — resolve .streaming/ path for a tool
 *   __internals                     — test harness
 *
 * NOTE: This module NEVER mkdir's .streaming/. Sentinel's BootstrapDlqDirs
 * owns that (PR3b scope). Missing directory → degraded capture() with one
 * stderr warning per process.
 */

import {
  existsSync,
  openSync,
  closeSync,
  writeFileSync,
  renameSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { fsync as fsyncAsync, rename as renameAsync } from 'node:fs/promises';
import { join, dirname } from 'node:path';

import { dosPath, expandPath } from './paths';
import { __internals as dlqInternals, digestOfBody } from './dlq';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

/** The 7 streaming-eligible tools per studio-sync-streaming.md §The 7 vs 9 split. */
export type StreamingTool =
  | 'artifacts'
  | 'voice-events'
  | 'security-events'
  | 'kg'
  | 'corrections'
  | 'learnings'
  | 'hook-metrics';

/** Event category — determines backpressure + ring-buffer policy. */
export type EventCategory =
  | 'security'
  | 'corrections'
  | 'artifacts'
  | 'voice'
  | 'learnings'
  | 'hook-metrics'
  | 'kg-deltas';

export type StreamScope = 'project' | 'install';

export interface CaptureOpts {
  sessionId?: string;
  toolCallId?: string;
  eventSeq?: number;
  /** Explicit idempotency key; otherwise computed from idempotency-keys.json schemaEvent */
  idempotencyKey?: string;
  /** Per-call fsync budget; default 2000ms per spec §Fsync watchdog */
  fsyncTimeoutMs?: number;
  /** Force install-scope (~/.claude/MEMORY/); default follows tool's INSTALL_ONLY status */
  scope?: StreamScope;
  /** Override category; only for tests */
  categoryOverride?: EventCategory;
  /** Endpoint path (required for envelope + idempotency key lookup) */
  endpoint?: string;
  /** Fields that feed the schemaEvent placeholders (eventId, kgTxId, entitySha, hookName, artifactSeq) */
  keyFields?: Record<string, string | number>;
}

export type CaptureResult =
  | { outcome: 'streamed'; path: string }
  | { outcome: 'ringed'; size: number }
  | { outcome: 'degraded'; reason: string }
  | { outcome: 'dropped'; reason: string }
  | { outcome: 'unfsynced'; path: string };

/** Thrown when security/corrections queue overflows 10k — halts PostToolUse deliberately. */
export class QueueFullError extends Error {
  readonly category: EventCategory;
  constructor(category: EventCategory) {
    super(
      `DOS telemetry queue full for ${category} events — run \`dos drain\` before continuing`,
    );
    this.name = 'QueueFullError';
    this.category = category;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Policy tables
// ─────────────────────────────────────────────────────────────────────

/** Studio endpoint per streaming tool. Mirrors idempotency-keys.json streamableEndpoints. */
const TOOL_TO_ENDPOINT: Record<StreamingTool, string> = {
  artifacts: '/api/v1/artifacts',
  'voice-events': '/api/v1/voice/events',
  'security-events': '/api/v1/security/events',
  kg: '/api/v1/kg/sync',
  corrections: '/api/v1/corrections',
  learnings: '/api/v1/learnings',
  'hook-metrics': '/api/v1/hooks/metrics',
};

/** Category per tool — determines overflow + ring policy. */
const TOOL_TO_CATEGORY: Record<StreamingTool, EventCategory> = {
  artifacts: 'artifacts',
  'voice-events': 'voice',
  'security-events': 'security',
  kg: 'kg-deltas',
  corrections: 'corrections',
  learnings: 'learnings',
  'hook-metrics': 'hook-metrics',
};

type OverflowPolicy = 'drop-NEVER' | 'drop-oldest-warn' | 'drop-oldest-silent';

/** Per-category overflow policy at 10k queue depth (RedTeam Attack 9). */
const CATEGORY_OVERFLOW: Record<EventCategory, OverflowPolicy> = {
  security: 'drop-NEVER',
  corrections: 'drop-NEVER',
  artifacts: 'drop-oldest-warn',
  voice: 'drop-oldest-warn',
  learnings: 'drop-oldest-warn',
  'hook-metrics': 'drop-oldest-silent',
  'kg-deltas': 'drop-oldest-silent',
};

/** Categories that use the ring buffer (high-volume, low-consequence only). */
const RING_CATEGORIES: ReadonlySet<EventCategory> = new Set<EventCategory>([
  'hook-metrics',
  'kg-deltas',
]);

// Policy constants — spec §Architecture
const QUEUE_OVERFLOW_LIMIT = 10_000;
const RING_MAX_EVENTS = 32;
const RING_MAX_AGE_MS = 500;
const FSYNC_WATCHDOG_MS_DEFAULT = 2_000;
const ENOENT_TTL_MS = 60_000;

// Bootstrap sentinel file — absent → degrade to no-op
const BOOTSTRAP_SENTINEL = '.bootstrapped';

// ─────────────────────────────────────────────────────────────────────
// Atomic per-process monotonic counter (RedTeam Attack 2 — never wall-clock)
// ─────────────────────────────────────────────────────────────────────

let ATOMIC_COUNTER = 0;
function nextAtomicCounter(): number {
  ATOMIC_COUNTER += 1;
  return ATOMIC_COUNTER;
}

// ─────────────────────────────────────────────────────────────────────
// Directory resolution — mirrors dlq.ts TOOL_TO_SUBDIR semantics
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve `.streaming/` path for a given tool + scope.
 * Returns null if parent MEMORY/{subdir}/ does not exist (bootstrap missing).
 */
export function streamingDir(
  tool: StreamingTool,
  scope: StreamScope = 'project',
): string | null {
  // dlq's TOOL_TO_SUBDIR and INSTALL_ONLY are authoritative; reuse them.
  const subdirMap = dlqInternals.TOOL_TO_SUBDIR as Record<string, string>;
  const subdir = subdirMap[tool];
  if (!subdir) return null;

  const installOnlyTools = new Set<string>([
    'sessions',
    'kg',
    'memory-snapshots',
    'hook-metrics',
    'voice-events',
    'relationships-notes',
    'plans',
  ]);
  const forceInstall = scope === 'install' || installOnlyTools.has(tool);
  let parent: string | null = null;
  if (forceInstall) {
    parent = join(dosPath('MEMORY'), subdir);
  } else if (process.env.CLAUDE_PROJECT_DIR) {
    parent = join(expandPath(process.env.CLAUDE_PROJECT_DIR), 'MEMORY', subdir);
  } else {
    try {
      parent = join(process.cwd(), 'MEMORY', subdir);
    } catch {
      parent = null;
    }
  }

  if (!parent || !existsSync(parent)) return null;
  return join(parent, '.streaming');
}

/**
 * Enumerate resolved .streaming/ dirs across all streaming tools + scopes.
 * Used by drain() extension in dlq.ts to sweep events alongside .pending/.
 */
export function streamingDirs(): Array<{
  tool: StreamingTool;
  scope: StreamScope;
  path: string;
}> {
  const out: Array<{ tool: StreamingTool; scope: StreamScope; path: string }> = [];
  const tools = Object.keys(TOOL_TO_ENDPOINT) as StreamingTool[];
  for (const tool of tools) {
    for (const scope of ['project', 'install'] as StreamScope[]) {
      const p = streamingDir(tool, scope);
      if (p && existsSync(p)) out.push({ tool, scope, path: p });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Bootstrap gate — degrade if .sentinel/.bootstrapped missing
// ─────────────────────────────────────────────────────────────────────

let BOOTSTRAP_WARNED = false;

function isBootstrapped(): boolean {
  // .sentinel/ lives at the project root — try CLAUDE_PROJECT_DIR first, then cwd.
  const candidates: string[] = [];
  if (process.env.CLAUDE_PROJECT_DIR) {
    candidates.push(join(process.env.CLAUDE_PROJECT_DIR, '.sentinel', BOOTSTRAP_SENTINEL));
  }
  try {
    candidates.push(join(process.cwd(), '.sentinel', BOOTSTRAP_SENTINEL));
  } catch { /* no cwd */ }
  candidates.push(join(dosPath('.sentinel'), BOOTSTRAP_SENTINEL));
  for (const c of candidates) {
    if (existsSync(c)) return true;
  }
  return false;
}

function warnBootstrapOnce(): void {
  if (BOOTSTRAP_WARNED) return;
  BOOTSTRAP_WARNED = true;
  process.stderr.write(
    '[streamEvent] Bootstrap missing (.sentinel/.bootstrapped); degrading to no-op. ' +
      'Run: sentinel scan\n',
  );
}

// ─────────────────────────────────────────────────────────────────────
// ENOENT resilience — in-memory 60s TTL ring (RedTeam Attack 5)
// ─────────────────────────────────────────────────────────────────────

interface EnoentEvent {
  tool: StreamingTool;
  envelope: StreamEnvelopeV2;
  expiresAt: number;
  targetDir: string;
}

const ENOENT_RING: EnoentEvent[] = [];

function sweepEnoentRing(): void {
  const now = Date.now();
  for (let i = ENOENT_RING.length - 1; i >= 0; i--) {
    const ev = ENOENT_RING[i];
    if (!ev) continue;
    if (ev.expiresAt < now) {
      ENOENT_RING.splice(i, 1);
      continue;
    }
    if (existsSync(ev.targetDir)) {
      // target reappeared — try to write
      try {
        writeEnvelopeDirectSync(ev.targetDir, ev.envelope);
        ENOENT_RING.splice(i, 1);
      } catch {
        // stay in ring until TTL expires
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Envelope — extends iter-1 v2 with eventScope (forward-compatible)
// ─────────────────────────────────────────────────────────────────────

interface StreamEnvelopeV2 {
  version: 2;
  tool: StreamingTool;
  endpoint: string;
  idempotencyKey: string | null;
  capturedAt: string;
  eventScope: 'session' | 'event' | 'global';
  sessionId: string;
  payload: unknown;
}

function resolveIdempotencyKey(
  tool: StreamingTool,
  keyFields: Record<string, string | number> | undefined,
  payload: unknown,
  sessionId: string,
): { key: string | null; scope: 'session' | 'event' | 'global' } {
  const idempotencyJsonPath = dosPath('hooks', 'lib', 'idempotency-keys.json');
  let table: Record<string, { schemaEvent?: string; scopeEvent?: string; schema?: string; scope?: string }>;
  try {
    const raw = JSON.parse(readFileSync(idempotencyJsonPath, 'utf-8')) as {
      endpoints: Record<
        string,
        { schemaEvent?: string; scopeEvent?: string; schema?: string; scope?: string }
      >;
    };
    table = raw.endpoints;
  } catch {
    return { key: null, scope: 'event' };
  }
  const endpoint = TOOL_TO_ENDPOINT[tool];
  const entry = table[endpoint];
  if (!entry) return { key: null, scope: 'event' };
  const template = entry.schemaEvent ?? entry.schema ?? null;
  const scope = (entry.scopeEvent ?? entry.scope ?? 'event') as
    | 'session'
    | 'event'
    | 'global';
  if (!template) return { key: null, scope };

  const fields: Record<string, string | number> = {
    sessionId,
    ...(keyFields ?? {}),
    digestOfBody: digestOfBody(payload),
  };
  let key = template;
  key = key.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = fields[name];
    return v === undefined ? `{${name}}` : String(v);
  });
  return { key, scope };
}

function wrapStreamEnvelope(
  tool: StreamingTool,
  payload: unknown,
  opts: CaptureOpts,
): StreamEnvelopeV2 {
  const sessionId = sessionIdFor(opts);
  const { key, scope } = resolveIdempotencyKey(
    tool,
    opts.keyFields,
    payload,
    sessionId,
  );
  return {
    version: 2,
    tool,
    endpoint: opts.endpoint ?? TOOL_TO_ENDPOINT[tool],
    idempotencyKey: opts.idempotencyKey ?? key,
    capturedAt: new Date().toISOString(),
    eventScope: scope,
    sessionId,
    payload,
  };
}

function sessionIdFor(opts: CaptureOpts): string {
  return (
    opts.sessionId ??
    process.env.DOS_SESSION_ID ??
    process.env.CLAUDE_SESSION_ID ??
    `pid-${process.pid}`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Filename scheme (spec §Filename scheme) — monotonic + non-wall-clock
// ─────────────────────────────────────────────────────────────────────

function safeSessionSlug(sessionId: string): string {
  return sessionId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function readyFilename(sessionId: string, counter: number): string {
  const ms = Date.now();
  return `${safeSessionSlug(sessionId)}-${process.pid}-${ms}-${String(counter).padStart(8, '0')}.ready`;
}

function tmpFilename(base: string): string {
  return base.replace(/\.ready$/, '.tmp');
}

// ─────────────────────────────────────────────────────────────────────
// Direct-to-disk write (security/corrections/artifacts/voice/learnings path)
// ─────────────────────────────────────────────────────────────────────

function writeEnvelopeDirectSync(
  targetDir: string,
  envelope: StreamEnvelopeV2,
): string {
  const counter = nextAtomicCounter();
  const base = readyFilename(envelope.sessionId, counter);
  const tmp = join(targetDir, tmpFilename(base));
  const ready = join(targetDir, base);
  const fd = openSync(tmp, 'w', 0o600);
  try {
    writeFileSync(fd, JSON.stringify(envelope));
    // Synchronous fsync — acceptable fallback path for the ENOENT sweep;
    // normal path uses async fsync with watchdog (writeEnvelopeWithWatchdog).
    require('node:fs').fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, ready);
  return ready;
}

async function writeEnvelopeWithWatchdog(
  targetDir: string,
  envelope: StreamEnvelopeV2,
  unfsyncedDir: string,
  fsyncTimeoutMs: number,
): Promise<{ outcome: 'streamed'; path: string } | { outcome: 'unfsynced'; path: string }> {
  const counter = nextAtomicCounter();
  const base = readyFilename(envelope.sessionId, counter);
  const tmp = join(targetDir, tmpFilename(base));
  const ready = join(targetDir, base);

  const fd = openSync(tmp, 'w', 0o600);
  writeFileSync(fd, JSON.stringify(envelope));

  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      fsyncAsync(fd),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error('fsync-watchdog'), { code: 'EWATCHDOG' })),
          fsyncTimeoutMs,
        );
      }),
    ]);
    if (timer) clearTimeout(timer);
    closeSync(fd);
    renameSync(tmp, ready);
    return { outcome: 'streamed', path: ready };
  } catch (err) {
    if (timer) clearTimeout(timer);
    try { closeSync(fd); } catch { /* fd may already be closed */ }
    // fsync stalled — relocate tmp into .unfsynced/ under the .streaming/ parent
    if (
      (err as NodeJS.ErrnoException).code === 'EWATCHDOG' &&
      existsSync(unfsyncedDir)
    ) {
      const relocated = join(unfsyncedDir, base);
      try {
        await renameAsync(tmp, relocated);
        return { outcome: 'unfsynced', path: relocated };
      } catch {
        // fall through to delete + rethrow
      }
    }
    try { unlinkSync(tmp); } catch { /* best-effort */ }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Queue-depth helpers — counted via readdir (RedTeam Attack 9)
// ─────────────────────────────────────────────────────────────────────

function queueDepth(streamingPath: string): number {
  try {
    const entries = readdirSync(streamingPath);
    let n = 0;
    for (const name of entries) {
      if (name.endsWith('.ready')) n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

function dropOldest(streamingPath: string): string | null {
  let entries: string[];
  try {
    entries = readdirSync(streamingPath);
  } catch {
    return null;
  }
  const ready = entries.filter((n) => n.endsWith('.ready')).sort();
  const victim = ready[0];
  if (!victim) return null;
  try {
    unlinkSync(join(streamingPath, victim));
    return victim;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Ring buffer — hook-metrics + kg-deltas
// ─────────────────────────────────────────────────────────────────────

interface RingEntry {
  envelope: StreamEnvelopeV2;
  targetDir: string;
  unfsyncedDir: string;
  fsyncTimeoutMs: number;
  enqueuedAt: number;
}

const RINGS = new Map<EventCategory, RingEntry[]>();

function getRing(cat: EventCategory): RingEntry[] {
  let r = RINGS.get(cat);
  if (!r) {
    r = [];
    RINGS.set(cat, r);
  }
  return r;
}

function shouldFlush(ring: RingEntry[]): boolean {
  if (ring.length === 0) return false;
  if (ring.length >= RING_MAX_EVENTS) return true;
  const first = ring[0];
  if (!first) return false;
  return Date.now() - first.enqueuedAt >= RING_MAX_AGE_MS;
}

async function flushRingCategory(cat: EventCategory): Promise<void> {
  const ring = getRing(cat);
  if (ring.length === 0) return;

  // Drain by target directory — each ring entry may point at a different
  // .streaming/ (project vs install; different tool within same category,
  // though current tool→category mapping is 1:1 for hook-metrics/kg-deltas).
  const byDir = new Map<string, RingEntry[]>();
  for (const e of ring) {
    const bucket = byDir.get(e.targetDir) ?? [];
    bucket.push(e);
    byDir.set(e.targetDir, bucket);
  }
  ring.length = 0;

  for (const [targetDir, entries] of byDir) {
    if (entries.length === 0) continue;
    const first = entries[0];
    if (!first) continue;
    const batchEnvelope: StreamEnvelopeV2 = {
      version: 2,
      tool: first.envelope.tool,
      endpoint: first.envelope.endpoint,
      idempotencyKey: null, // batch payloads get content-addressable key downstream
      capturedAt: new Date().toISOString(),
      eventScope: first.envelope.eventScope,
      sessionId: first.envelope.sessionId,
      payload: entries.map((e) => e.envelope.payload),
    };
    try {
      await writeEnvelopeWithWatchdog(
        targetDir,
        batchEnvelope,
        first.unfsyncedDir,
        first.fsyncTimeoutMs,
      );
    } catch {
      // best-effort ring flush; drop silently for low-consequence categories
    }
  }
}

/** Flush every ring; call on exit paths. */
export async function flushRing(): Promise<void> {
  for (const cat of RING_CATEGORIES) {
    await flushRingCategory(cat);
  }
}

// ─────────────────────────────────────────────────────────────────────
// capture() — public entry
// ─────────────────────────────────────────────────────────────────────

export async function capture(
  tool: StreamingTool,
  payload: unknown,
  opts: CaptureOpts = {},
): Promise<CaptureResult> {
  if (!isBootstrapped()) {
    warnBootstrapOnce();
    return { outcome: 'degraded', reason: 'bootstrap-missing' };
  }

  const scope: StreamScope = opts.scope ?? 'project';
  const targetDir = streamingDir(tool, scope);
  if (!targetDir) {
    return { outcome: 'degraded', reason: 'parent-missing' };
  }

  const envelope = wrapStreamEnvelope(tool, payload, opts);

  if (!existsSync(targetDir)) {
    return parkInEnoentRing(tool, envelope, targetDir);
  }

  const category: EventCategory = opts.categoryOverride ?? TOOL_TO_CATEGORY[tool];
  const fsyncTimeoutMs = opts.fsyncTimeoutMs ?? FSYNC_WATCHDOG_MS_DEFAULT;
  const unfsyncedDir = join(dirname(targetDir), '.unfsynced');

  enforceOverflow(tool, targetDir, category);

  if (RING_CATEGORIES.has(category)) {
    return ringDispatch(category, envelope, targetDir, unfsyncedDir, fsyncTimeoutMs);
  }

  return directDispatch(tool, envelope, targetDir, unfsyncedDir, fsyncTimeoutMs);
}

// ─────────────────────────────────────────────────────────────────────
// capture() helpers — file-local stepdown
// ─────────────────────────────────────────────────────────────────────

/** Park an event in the ENOENT TTL ring and kick a sweep (RedTeam Attack 5). */
function parkInEnoentRing(
  tool: StreamingTool,
  envelope: StreamEnvelopeV2,
  targetDir: string,
): CaptureResult {
  ENOENT_RING.push({
    tool,
    envelope,
    expiresAt: Date.now() + ENOENT_TTL_MS,
    targetDir,
  });
  sweepEnoentRing();
  return { outcome: 'degraded', reason: 'streaming-dir-missing' };
}

/**
 * Enforce per-category overflow policy at QUEUE_OVERFLOW_LIMIT (RedTeam Attack 9).
 * Throws QueueFullError for drop-NEVER categories; drops-oldest + optional warn
 * for drop-oldest policies; frees one slot so the caller can continue.
 */
function enforceOverflow(
  tool: StreamingTool,
  targetDir: string,
  category: EventCategory,
): void {
  const depth = queueDepth(targetDir);
  if (depth < QUEUE_OVERFLOW_LIMIT) return;

  const policy = CATEGORY_OVERFLOW[category];
  if (policy === 'drop-NEVER') {
    throw new QueueFullError(category);
  }
  dropOldest(targetDir);
  if (policy === 'drop-oldest-warn') {
    process.stderr.write(
      `[streamEvent] ${tool} queue at ${depth} — dropped oldest\n`,
    );
  }
  // slot freed — caller continues with the new event
}

/** Enqueue in the ring buffer; flush and return 'streamed' if threshold reached. */
async function ringDispatch(
  category: EventCategory,
  envelope: StreamEnvelopeV2,
  targetDir: string,
  unfsyncedDir: string,
  fsyncTimeoutMs: number,
): Promise<CaptureResult> {
  const ring = getRing(category);
  ring.push({ envelope, targetDir, unfsyncedDir, fsyncTimeoutMs, enqueuedAt: Date.now() });
  if (shouldFlush(ring)) {
    await flushRingCategory(category);
    return { outcome: 'streamed', path: targetDir };
  }
  return { outcome: 'ringed', size: ring.length };
}

/**
 * Write directly to disk with fsync watchdog.
 * On ENOENT parks in ring; on EWATCHDOG returns 'unfsynced'; other errors return 'dropped'.
 */
async function directDispatch(
  tool: StreamingTool,
  envelope: StreamEnvelopeV2,
  targetDir: string,
  unfsyncedDir: string,
  fsyncTimeoutMs: number,
): Promise<CaptureResult> {
  try {
    return await writeEnvelopeWithWatchdog(targetDir, envelope, unfsyncedDir, fsyncTimeoutMs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      ENOENT_RING.push({
        tool,
        envelope,
        expiresAt: Date.now() + ENOENT_TTL_MS,
        targetDir,
      });
      return { outcome: 'degraded', reason: 'enoent' };
    }
    if (code === 'EWATCHDOG') {
      return { outcome: 'unfsynced', path: targetDir };
    }
    return { outcome: 'dropped', reason: `write-failed:${code ?? 'unknown'}` };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────

export const __internals = {
  QUEUE_OVERFLOW_LIMIT,
  RING_MAX_EVENTS,
  RING_MAX_AGE_MS,
  FSYNC_WATCHDOG_MS_DEFAULT,
  TOOL_TO_ENDPOINT,
  TOOL_TO_CATEGORY,
  CATEGORY_OVERFLOW,
  RING_CATEGORIES,
  wrapStreamEnvelope,
  readyFilename,
  tmpFilename,
  nextAtomicCounter,
  getRing,
  shouldFlush,
  queueDepth,
  isBootstrapped,
  resetForTests: () => {
    ATOMIC_COUNTER = 0;
    BOOTSTRAP_WARNED = false;
    RINGS.clear();
    ENOENT_RING.length = 0;
  },
};
