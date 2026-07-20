/**
 * coverageMetric.ts — RFC-0037 §7.1 read-coverage metric reader (V11.22).
 *
 * Operationalizes the metric defined by RFC-0037 §7.1:
 *   "Of next 100 OBSERVE-phase memory reads, fraction served by
 *    recallXxx() vs the 5 regex-classified intents."
 *
 * Concrete definition over the existing `recall-coverage.jsonl` stream
 * (written by IntentRetrieval.hook.ts since V11.16):
 *
 *   coverage = | { p in REGISTRY : p has >=1 CANONICAL fire in window } |
 *              -----------------------------------------------------------
 *                                | REGISTRY |
 *
 * This is per-registry coverage — answers "does the read-port surface ANY
 * of the things it knows about?" rather than "is the read-port hot?". A
 * tiny corpus where 1 of 3 registered primitives gets a hit shows 0.33
 * (low), guiding the V11.22 triangulation cutover decision.
 *
 * Window is rolling — last N hours, default 24, configurable via
 * DOS_RFC_0037_COVERAGE_WINDOW_H. Signal file path follows the standard
 * project-first MEMORY resolver chain (project / cwd / global ~/.claude).
 *
 * Pure with one I/O call (readFileSync). Never throws — every failure
 * path returns a `{ ok: false, reason }` envelope so callers can degrade
 * gracefully (and the V11.22 toggle defaults to OFF, preserving baseline).
 *
 * Per RFC-0037 integration boundaries: this module DOES NOT touch
 * RecallAdapter.ts, intent-classifier.ts, or bridge code. It reads a
 * JSONL signal file written by IntentRetrieval.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Default rolling window for coverage in hours. RFC-0037 §7.1 specifies
 *  "next 100 reads" — wall-clock hours are a more operational proxy that
 *  doesn't require maintaining a sliding ringbuffer. 24h matches the operator's
 *  typical session cadence (1-2 sessions/day). */
const DEFAULT_WINDOW_HOURS = 24;

/** Default triangulation trigger threshold (0..1). Per V11.22 brief: "when
 *  coverage drops below 40%, RecallAdapter call sites fan out to backup
 *  backends instead of single backend." */
export const DEFAULT_COVERAGE_THRESHOLD = 0.40;

/** One entry of the recall-coverage.jsonl stream. Mirrors what
 *  IntentRetrieval.hook.ts writes via appendSignal('recall-coverage.jsonl', ...).
 *  The hook's writes are the single source of truth — additional fields here
 *  are ignored by the reader. */
interface CoverageSignalEntry {
  /** ISO 8601 timestamp at write time. */
  ts?: string;
  /** Operation kind. Currently only 'canonical' is emitted by IntentRetrieval. */
  op_kind?: string;
  /** The session that emitted the fire (informational; not used in the metric). */
  session_id?: string;
  /** The primitive that hit. Lowercase, matching RECALL_REGISTRY keys. */
  primitive?: string;
  /** What the classifier matched on (informational). */
  matchedPattern?: string;
}

/**
 * Result envelope for {@link readCoverage}. Always has the `ok` flag so
 * callers can branch on signal-file-missing vs. signal-file-empty without
 * heuristics. Fraction is in [0, 1].
 */
export type CoverageResult =
  | {
      ok: true;
      /** Coverage in [0, 1]; numerator / denominator. */
      fraction: number;
      /** Number of unique registered primitives with >=1 hit in window. */
      hitPrimitives: readonly string[];
      /** All registered primitive keys (sorted). Source of truth for denominator. */
      registeredPrimitives: readonly string[];
      /** Total raw events in the rolling window (informational). */
      eventsInWindow: number;
      /** Path of the JSONL signal file that was read. */
      signalPath: string;
      /** Window in hours that produced this fraction. */
      windowHours: number;
    }
  | {
      ok: false;
      reason: 'signal-missing' | 'signal-unreadable' | 'registry-empty';
      /** Best-effort path. Empty when not resolvable. */
      signalPath: string;
      /** Hours considered. */
      windowHours: number;
    };

/**
 * Resolve the path to recall-coverage.jsonl using the standard project-first
 * MEMORY resolver chain ($CLAUDE_PROJECT_DIR / cwd / global ~/.claude).
 *
 * Reads of $CLAUDE_PROJECT_DIR/MEMORY/LEARNING/SIGNALS/recall-coverage.jsonl
 * win when the project has its own per-project SIGNALS directory; otherwise
 * we fall through to the global file at ~/.claude/MEMORY/LEARNING/SIGNALS/.
 * This mirrors getMemorySubdir('LEARNING') without importing that hook lib
 * (V11.22 stays pack-local; no hook-lib coupling).
 */
function resolveCoverageSignalPath(): string {
  const candidates: string[] = [];
  if (process.env.CLAUDE_PROJECT_DIR) {
    candidates.push(
      join(
        process.env.CLAUDE_PROJECT_DIR,
        'MEMORY',
        'LEARNING',
        'SIGNALS',
        'recall-coverage.jsonl',
      ),
    );
  }
  candidates.push(
    join(process.cwd(), 'MEMORY', 'LEARNING', 'SIGNALS', 'recall-coverage.jsonl'),
  );
  const dosDir = process.env.DOS_DIR || join(homedir(), '.claude');
  candidates.push(
    join(dosDir, 'MEMORY', 'LEARNING', 'SIGNALS', 'recall-coverage.jsonl'),
  );

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  // Return the global path as the canonical "missing" sentinel — callers
  // can branch on `ok: false, reason: 'signal-missing'` and surface this
  // path in error messages.
  return candidates[candidates.length - 1];
}

/**
 * Parse a window-hours value from env. Returns DEFAULT_WINDOW_HOURS on
 * unset, NaN, negative, or non-finite. Caller can also pass an explicit
 * override via the `windowHours` arg.
 */
function resolveWindowHours(override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return override;
  }
  const env = process.env.DOS_RFC_0037_COVERAGE_WINDOW_H;
  if (!env) return DEFAULT_WINDOW_HOURS;
  const parsed = Number(env);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_WINDOW_HOURS;
  return parsed;
}

/**
 * Parse a threshold value from env. Returns DEFAULT_COVERAGE_THRESHOLD on
 * unset, NaN, out-of-range. Caller can also pass an explicit override.
 */
export function resolveCoverageThreshold(override?: number): number {
  if (
    typeof override === 'number' &&
    Number.isFinite(override) &&
    override >= 0 &&
    override <= 1
  ) {
    return override;
  }
  const env = process.env.DOS_RFC_0037_COVERAGE_THRESHOLD;
  if (!env) return DEFAULT_COVERAGE_THRESHOLD;
  const parsed = Number(env);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_COVERAGE_THRESHOLD;
  }
  return parsed;
}

/**
 * Parse a single JSONL line into a CoverageSignalEntry. Returns null on
 * empty or malformed lines so the reader can skip them silently — JSONL
 * is append-only and the last line may be partially written.
 */
function parseLine(line: string): CoverageSignalEntry | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as CoverageSignalEntry;
  } catch {
    return null;
  }
}

/**
 * Decide whether an entry falls within the rolling window. Entries with
 * missing or unparseable timestamps are EXCLUDED — we'd rather under-count
 * than inflate coverage with malformed data.
 */
function isInWindow(entry: CoverageSignalEntry, cutoffMs: number): boolean {
  if (!entry.ts) return false;
  const tsMs = Date.parse(entry.ts);
  if (Number.isNaN(tsMs)) return false;
  return tsMs >= cutoffMs;
}

/**
 * Compute read-coverage from the recall-coverage.jsonl stream over the
 * rolling window. Pure read; no side effects on the JSONL file.
 *
 * @param registry Sorted list of registered primitive keys. Pass
 *   {@link RECALL_PRIMITIVE_KEYS} from recallFormat.ts (preferred) or
 *   any other source-of-truth list. Empty registry returns
 *   `{ ok: false, reason: 'registry-empty' }` since 0/0 has no meaning.
 * @param options Optional window/path overrides for testing.
 * @returns CoverageResult envelope. Never throws.
 */
export function readCoverage(
  registry: readonly string[],
  options: {
    /** Rolling window in hours; default 24 (DOS_RFC_0037_COVERAGE_WINDOW_H env). */
    windowHours?: number;
    /** Override the JSONL path; default uses the resolver chain. */
    signalPath?: string;
    /** Override "now" for deterministic tests. Defaults to Date.now(). */
    nowMs?: number;
  } = {},
): CoverageResult {
  const windowHours = resolveWindowHours(options.windowHours);
  const signalPath = options.signalPath ?? resolveCoverageSignalPath();

  if (registry.length === 0) {
    return { ok: false, reason: 'registry-empty', signalPath, windowHours };
  }
  if (!existsSync(signalPath)) {
    return { ok: false, reason: 'signal-missing', signalPath, windowHours };
  }

  let raw: string;
  try {
    raw = readFileSync(signalPath, 'utf-8');
  } catch {
    return { ok: false, reason: 'signal-unreadable', signalPath, windowHours };
  }

  const now = options.nowMs ?? Date.now();
  const cutoffMs = now - windowHours * 60 * 60 * 1000;

  const registrySet = new Set(registry.map((p) => p.toLowerCase()));
  const hits = new Set<string>();
  let eventsInWindow = 0;

  for (const line of raw.split('\n')) {
    const entry = parseLine(line);
    if (!entry) continue;
    // Only canonical events feed the metric. EXPECT_RECALL signals
    // from expect-recall.jsonl are a different primitive entirely.
    if (entry.op_kind !== 'canonical') continue;
    if (!isInWindow(entry, cutoffMs)) continue;
    eventsInWindow += 1;
    if (typeof entry.primitive !== 'string') continue;
    const lower = entry.primitive.toLowerCase();
    if (registrySet.has(lower)) {
      hits.add(lower);
    }
  }

  const sortedHits = Object.freeze([...hits].sort());
  return {
    ok: true,
    fraction: hits.size / registry.length,
    hitPrimitives: sortedHits,
    registeredPrimitives: Object.freeze([...registry].sort()),
    eventsInWindow,
    signalPath,
    windowHours,
  };
}

/**
 * Convenience predicate: should V11.22 trigger triangulation given the
 * current coverage and threshold? Returns false on signal-missing or
 * registry-empty (treating "no data" as "preserve single-primitive
 * baseline" — Sandi's "duplication is cheaper than the wrong abstraction"
 * applied to fallback semantics: don't triangulate when you have no
 * evidence either way).
 *
 * @param coverage Result from {@link readCoverage}.
 * @param thresholdOverride Optional 0..1 threshold override; default
 *   resolves DOS_RFC_0037_COVERAGE_THRESHOLD or 0.40.
 */
export function shouldTriangulate(
  coverage: CoverageResult,
  thresholdOverride?: number,
): boolean {
  if (!coverage.ok) return false;
  const threshold = resolveCoverageThreshold(thresholdOverride);
  return coverage.fraction < threshold;
}
