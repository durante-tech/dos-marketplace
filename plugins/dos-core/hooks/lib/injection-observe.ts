/**
 * injection-observe.ts — V11.5 + V11.6 (RFC-0076 wave 3)
 *
 * Two cross-cutting observability surfaces wrapping memory injection in
 * `IntentRetrieval.hook.ts`:
 *
 *   V11.5 — Project wing pre-flight.
 *     Read `.dos-projects.json` (Tools/ canonical, root fallback) and identify
 *     wings declared in PROJECTS.md but not provisioned in MemPalace (no
 *     drawers in those wing names). Drift events accumulate one line per
 *     session per wing in `MEMORY/STATE/wing-drift.jsonl`. The hook surfaces
 *     them via stdout (the canonical "additionalContext" surface for
 *     UserPromptSubmit hooks — model sees them inline before responding).
 *
 *   V11.6 — Memory-injection circuit breaker.
 *     Track last-5 injection latencies (rolling window) per session. When
 *     `avg > 2000ms` the breaker trips; subsequent injections in this session
 *     are skipped, and a one-time `mempalace.inject.degraded` warning fires
 *     to console. Window resets across sessions because state is keyed by
 *     `session_id` and lives at `MEMORY/STATE/injection-circuit-<sid>.json`.
 *
 * Why both live in one module:
 *   The two surfaces both wrap `injectMemoryContext` (the conceptual
 *   IntentRetrieval flow that emits memory results to stdout). Co-locating
 *   them in one file makes the integration point at the call site obvious:
 *   pre-flight runs once at fire-time, circuit check runs around each
 *   bridge call. Different concerns, same seam.
 *
 * Anchor: RFC-0073 Rule 8 (consumer-driven wing provisioning) + Rule 10
 * (cross-cutting). RFC-0076 ISC-V11.5 + ISC-V11.6.
 *
 * Pure boundary: this module never throws. Every fs/bridge error is
 * swallowed; the host hook MUST continue regardless. Errors that matter
 * surface via the JSONL audit trail, not via exceptions.
 */

import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { atomicWriteSync } from './atomic-write';
import { rotateIfNeeded } from './rotate';

// ─── Path resolution ──────────────────────────────────────────────────────

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const STATE_DIR = join(DOS_DIR, 'MEMORY', 'STATE');

/** Path to the wing-drift JSONL log (V11.5). Override via env for tests. */
export function wingDriftLogPath(): string {
  return process.env.WING_DRIFT_LOG_PATH || join(STATE_DIR, 'wing-drift.jsonl');
}

/** Per-session circuit-breaker state file (V11.6). Override via env for tests. */
export function circuitStatePath(sessionId: string): string {
  return (
    process.env.INJECTION_CIRCUIT_STATE_PATH
    || join(STATE_DIR, `injection-circuit-${sessionId}.json`)
  );
}

/**
 * Resolve `.dos-projects.json` location.
 *   1. `$DOS_PROJECTS_PATH`                  — test-only override (always wins, even
 *                                              when the file does not exist; this lets
 *                                              tests pin "missing registry" behavior
 *                                              without falling through to real paths)
 *   2. `~/Durante/Tools/.dos-projects.json`  — canonical, where SaveProjectsToStudio reads
 *   3. `~/Durante/.dos-projects.json`        — root fallback for legacy installs
 *
 * Returns null when no readable file is found. Callers treat missing
 * registry as "no declared wings" — pre-flight emits no drift events.
 */
export function resolveProjectsRegistryPath(): string | null {
  if (process.env.DOS_PROJECTS_PATH) {
    // Override wins unconditionally so tests can pin "missing file" behavior.
    return existsSync(process.env.DOS_PROJECTS_PATH) ? process.env.DOS_PROJECTS_PATH : null;
  }
  const home = homedir();
  const canonical = join(home, 'Durante', 'Tools', '.dos-projects.json');
  if (existsSync(canonical)) return canonical;
  const fallback = join(home, 'Durante', '.dos-projects.json');
  if (existsSync(fallback)) return fallback;
  return null;
}

// ─── V11.5: declared-wings extraction ─────────────────────────────────────

/** Shape we read from `.dos-projects.json` — only the fields we need. */
interface ProjectEntry {
  id: string;
  name?: string;
  wing: string | null;
  root_path?: string | null;
}

interface ProjectsRegistry {
  projects: ProjectEntry[];
}

export interface DeclaredWing {
  /** Wing name as it appears in `.dos-projects.json`. */
  wing: string;
  /** Absolute or `~/`-prefixed root path the wing maps to. */
  declared_path: string;
  /** Project id from the registry. */
  project_id: string;
}

/**
 * Load declared wings from the projects registry. Returns empty array on any
 * read or parse error. Filters out projects with `wing: null` (e.g.
 * builders-compass — audience project, no palace wing).
 */
export function loadDeclaredWings(registryPath?: string): DeclaredWing[] {
  const path = registryPath ?? resolveProjectsRegistryPath();
  if (!path) return [];
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as ProjectsRegistry;
    if (!parsed?.projects || !Array.isArray(parsed.projects)) return [];
    const out: DeclaredWing[] = [];
    for (const p of parsed.projects) {
      if (!p?.wing || typeof p.wing !== 'string') continue;
      out.push({
        wing: p.wing,
        declared_path: typeof p.root_path === 'string' ? p.root_path : '(unknown)',
        project_id: typeof p.id === 'string' ? p.id : p.wing,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ─── V11.5: wing-drift detection ──────────────────────────────────────────

export interface WingDriftEvent {
  /** ISO 8601 UTC timestamp. */
  ts: string;
  /** Wing name (e.g. "road-to-next"). */
  wing: string;
  /** root_path from `.dos-projects.json`. */
  declared_path: string;
  /** Drawer count in MemPalace for this wing. 0 means unprovisioned. */
  drawer_count: number;
  /** Session that observed the drift. Idempotency key with `wing`. */
  session_id: string | null;
}

/**
 * Compute drift events for the current session. A wing drifts when it is
 * declared in `.dos-projects.json` but has 0 drawers in MemPalace.
 *
 * `wingDrawerCounts` is the `wings` field from `mempalaceClient.status()`
 * (or any equivalent shape mapping wing → { total }). Pass it directly so
 * this function stays pure and testable.
 */
export function detectWingDrift(
  declared: DeclaredWing[],
  wingDrawerCounts: Record<string, { total: number } | number>,
  sessionId: string | null,
): WingDriftEvent[] {
  const out: WingDriftEvent[] = [];
  const ts = new Date().toISOString();
  for (const d of declared) {
    const entry = wingDrawerCounts[d.wing];
    const count = typeof entry === 'number' ? entry : (entry?.total ?? 0);
    if (count === 0) {
      out.push({
        ts,
        wing: d.wing,
        declared_path: d.declared_path,
        drawer_count: 0,
        session_id: sessionId,
      });
    }
  }
  return out;
}

/**
 * Read the existing wing-drift JSONL and return the (session_id, wing)
 * tuples already logged. Used to deduplicate — one entry per session per
 * wing, per the V11.5 acceptance criterion.
 *
 * Returns empty Set on read or parse error.
 */
export function readLoggedDriftKeys(): Set<string> {
  const path = wingDriftLogPath();
  if (!existsSync(path)) return new Set();
  try {
    const text = readFileSync(path, 'utf-8');
    const seen = new Set<string>();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as WingDriftEvent;
        if (ev.session_id && ev.wing) {
          seen.add(`${ev.session_id}::${ev.wing}`);
        }
      } catch {
        // skip malformed line
      }
    }
    return seen;
  } catch {
    return new Set();
  }
}

/**
 * Append drift events to the JSONL log. Filters out (session, wing) tuples
 * already present. Returns the events that were actually written so the
 * caller can decide whether to surface a banner.
 */
export function recordWingDrift(events: WingDriftEvent[]): WingDriftEvent[] {
  if (events.length === 0) return [];
  const path = wingDriftLogPath();
  const written: WingDriftEvent[] = [];
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    rotateIfNeeded(path);
    const logged = readLoggedDriftKeys();
    const lines: string[] = [];
    for (const ev of events) {
      const key = `${ev.session_id ?? 'no-session'}::${ev.wing}`;
      if (logged.has(key)) continue;
      logged.add(key);
      lines.push(JSON.stringify(ev));
      written.push(ev);
    }
    if (lines.length > 0) {
      appendFileSync(path, lines.join('\n') + '\n');
    }
  } catch {
    // Audit log is advisory — never break the host hook.
  }
  return written;
}

/**
 * Compose a one-shot banner for the additionalContext surface. Returns null
 * when no drift events fire (caller skips emitting). Banner is intentionally
 * compact — operator-facing pre-flight surface, not a full report.
 */
export function formatWingDriftBanner(events: WingDriftEvent[]): string | null {
  if (events.length === 0) return null;
  const lines: string[] = [];
  lines.push('⚠ WING DRIFT — projects declared in .dos-projects.json without provisioned palace wings:');
  for (const ev of events) {
    lines.push(`  - ${ev.wing} (${ev.declared_path}) → 0 drawers`);
  }
  lines.push('  Hint: these wings have zero filed drawers — reconcile is read-only and will not change that. Either accept the empty wing, or accumulate PRDs/learnings while working in the project root so drawers file there naturally.');
  return lines.join('\n');
}

// ─── V11.6: circuit-breaker primitives ────────────────────────────────────

/** Threshold above which the breaker trips. RFC-0076 ISC-V11.6: 2 seconds. */
export const CIRCUIT_LATENCY_THRESHOLD_MS = 2000;
/** Rolling window size. RFC-0076 ISC-V11.6: last 5 calls. */
export const CIRCUIT_WINDOW_SIZE = 5;

export interface CircuitState {
  /** Rolling latency samples in ms; max length CIRCUIT_WINDOW_SIZE. */
  samples: number[];
  /** True once breaker has tripped this session. */
  tripped: boolean;
  /** True once the warning has been emitted (one-shot). */
  warning_emitted: boolean;
  /** Session this state belongs to — sanity check. */
  session_id: string;
}

function emptyCircuitState(sessionId: string): CircuitState {
  return {
    samples: [],
    tripped: false,
    warning_emitted: false,
    session_id: sessionId,
  };
}

export function readCircuitState(sessionId: string): CircuitState {
  const path = circuitStatePath(sessionId);
  if (!existsSync(path)) return emptyCircuitState(sessionId);
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CircuitState>;
    return {
      samples: Array.isArray(parsed.samples) ? parsed.samples.slice(-CIRCUIT_WINDOW_SIZE) : [],
      tripped: !!parsed.tripped,
      warning_emitted: !!parsed.warning_emitted,
      session_id: typeof parsed.session_id === 'string' ? parsed.session_id : sessionId,
    };
  } catch {
    return emptyCircuitState(sessionId);
  }
}

function writeCircuitState(state: CircuitState): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    atomicWriteSync(circuitStatePath(state.session_id), JSON.stringify(state));
  } catch {
    // Best-effort persistence — host hook continues.
  }
}

/**
 * Push one latency sample into the rolling window and recompute breaker
 * state. Returns the post-update state so callers can immediately decide
 * whether to skip the next injection.
 */
export function recordInjectionLatency(sessionId: string, latencyMs: number): CircuitState {
  const state = readCircuitState(sessionId);
  // If already tripped, samples don't matter — keep the trip flag sticky.
  state.samples.push(Math.max(0, Math.round(latencyMs)));
  if (state.samples.length > CIRCUIT_WINDOW_SIZE) {
    state.samples = state.samples.slice(-CIRCUIT_WINDOW_SIZE);
  }
  if (!state.tripped && state.samples.length === CIRCUIT_WINDOW_SIZE) {
    const sum = state.samples.reduce((a, b) => a + b, 0);
    const avg = sum / state.samples.length;
    if (avg > CIRCUIT_LATENCY_THRESHOLD_MS) {
      state.tripped = true;
    }
  }
  writeCircuitState(state);
  return state;
}

export interface CircuitDecision {
  /** True when the caller should skip injection. */
  skip: boolean;
  /** One-shot warning text to emit to console — non-null only on the
   * transition fire (subsequent calls return null even though skip=true). */
  warning: string | null;
  /** Post-decision circuit state (for logging / tests). */
  state: CircuitState;
}

/**
 * Decide whether the next injection should be skipped, and emit the
 * one-time `mempalace.inject.degraded` warning if the breaker just tripped.
 *
 * The warning text fires exactly once per session (per RFC-0076 ISC-V11.6).
 * The skip decision sticks for the rest of the session.
 */
export function decideInjectionSkip(sessionId: string): CircuitDecision {
  const state = readCircuitState(sessionId);
  if (!state.tripped) {
    return { skip: false, warning: null, state };
  }
  if (state.warning_emitted) {
    // Already warned, skip silently from now on.
    return { skip: true, warning: null, state };
  }
  // First skip — emit warning, persist warning_emitted flag.
  state.warning_emitted = true;
  writeCircuitState(state);
  const avg =
    state.samples.length > 0
      ? Math.round(state.samples.reduce((a, b) => a + b, 0) / state.samples.length)
      : 0;
  const warning =
    `⚠ mempalace.inject.degraded — last ${state.samples.length} injection latencies avg ${avg}ms ` +
    `(threshold ${CIRCUIT_LATENCY_THRESHOLD_MS}ms). Skipping memory injection for the rest of this session.`;
  return { skip: true, warning, state };
}

/**
 * Test-only: clear the per-session circuit state. Production callers never
 * invoke this — the next session naturally starts with fresh state because
 * the file path is keyed by session_id.
 */
export function resetCircuitState(sessionId: string): void {
  try {
    const path = circuitStatePath(sessionId);
    if (existsSync(path)) {
      atomicWriteSync(path, JSON.stringify(emptyCircuitState(sessionId)));
    }
  } catch {
    // ignore
  }
}
