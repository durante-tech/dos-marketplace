/**
 * triangulate.ts — RFC-0037 Phase 2 conditional fan-out (V11.22).
 *
 * When read-coverage drops below the threshold (default 40%, configurable
 * via DOS_RFC_0037_COVERAGE_THRESHOLD), single-primitive recall isn't
 * surfacing enough canonical data to justify a focused dispatch. This
 * module fans out to ALL registered primitives and returns the merged
 * list of RecallResults so the consumer can present a broader recall
 * surface.
 *
 * This is OPERATIONAL fan-out triangulation. It is NOT the RFC-0037 §6
 * "abstraction-extraction" decision — that remains a separate, deferred
 * call governed by the 14-day Reflect (RFC-0037 §7.2). V11.22 governs the
 * runtime fallback semantics; the abstraction-extraction stays unnamed
 * per Sandi's discipline until a 4th call site genuinely shares load.
 *
 * Per RFC-0037 integration boundaries: this module DOES NOT modify
 * RecallAdapter.ts, intent-classifier.ts, or bridge code. It composes
 * the existing public RecallAdapter surface (`recall(primitive)`).
 *
 * Operator toggle (V11.22):
 *   DOS_RFC_0037_TRIANGULATE=1   — enable cutover at consumer call sites
 *   (unset)                      — preserve single-primitive baseline
 *
 * Soak observability:
 *   Every consumer call computes the coverage fraction and writes a
 *   "would-have-triangulated" decision via {@link recordTriangulationDecision}
 *   so the soak window reveals whether triangulation would have helped
 *   BEFORE the operator flips the toggle on by default.
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { RecallAdapter, RecallResult } from './RecallAdapter';
import { RECALL_PRIMITIVE_KEYS } from './recallFormat';
import {
  readCoverage,
  shouldTriangulate,
  resolveCoverageThreshold,
  type CoverageResult,
} from './coverageMetric';

/** Operator toggle env var. Set to '1' to enable cutover. */
export const TRIANGULATE_TOGGLE_ENV = 'DOS_RFC_0037_TRIANGULATE';

/** Filename for the soak observability decision log. */
const DECISION_LOG_FILENAME = 'triangulate-decision.jsonl';

// ─── Decision computation ──────────────────────────────────────────────

/**
 * The triangulation decision for a single consumer call site. Both fields
 * matter for the soak window:
 *   - `triggered`: true iff coverage < threshold AND at least one primitive
 *     would actually be queried (i.e., consumer would broaden recall surface)
 *   - `enabledByOperator`: true iff the env toggle is set; lets the soak log
 *     distinguish "would have triggered if toggle on" from "actually did"
 */
export interface TriangulationDecision {
  /** Always present — the coverage envelope at decision time. */
  coverage: CoverageResult;
  /** True iff coverage < threshold (operational triangulation should fire). */
  triggered: boolean;
  /** True iff DOS_RFC_0037_TRIANGULATE=1 (toggle is set). */
  enabledByOperator: boolean;
  /** True iff `triggered && enabledByOperator` — i.e., consumer should
   *  actually call {@link triangulate} this turn. */
  shouldFanOut: boolean;
  /** The threshold this decision used (after env / arg overrides). */
  threshold: number;
  /** Wall-clock ISO 8601 — used by the decision-log writer. */
  decidedAt: string;
}

/**
 * Compute the V11.22 triangulation decision for a consumer call site.
 * Pure function — no I/O. Callers pass the registry of known primitives
 * (typically {@link RECALL_PRIMITIVE_KEYS}) and any threshold override.
 *
 * @param options.registry Registered primitive keys; defaults to
 *   {@link RECALL_PRIMITIVE_KEYS}.
 * @param options.thresholdOverride 0..1 threshold; defaults to env or 0.40.
 * @param options.coverageOverride Pre-computed coverage; useful when the
 *   caller already read it (avoids double-reading the JSONL file).
 */
export function decideTriangulation(
  options: {
    registry?: readonly string[];
    thresholdOverride?: number;
    coverageOverride?: CoverageResult;
  } = {},
): TriangulationDecision {
  const registry = options.registry ?? RECALL_PRIMITIVE_KEYS;
  const coverage =
    options.coverageOverride ?? readCoverage(registry);
  const threshold = resolveCoverageThreshold(options.thresholdOverride);
  const triggered = shouldTriangulate(coverage, threshold);
  const enabledByOperator = process.env[TRIANGULATE_TOGGLE_ENV] === '1';

  return {
    coverage,
    triggered,
    enabledByOperator,
    shouldFanOut: triggered && enabledByOperator,
    threshold,
    decidedAt: new Date().toISOString(),
  };
}

// ─── Fan-out execution ─────────────────────────────────────────────────

/**
 * Result of a fan-out across all registered primitives. Consumers can
 * format this with {@link formatTriangulatedResults} or render their own
 * surface. Skipped primitives (adapter returned null) appear in
 * `skipped` with no result; failures (adapter threw) appear in
 * `errors` with the message.
 */
export interface TriangulationFanOut {
  /** The decision that produced this fan-out (echoed for logging). */
  decision: TriangulationDecision;
  /** Successful per-primitive recalls — keys are lowercase primitive names. */
  results: Array<{ primitive: string; result: RecallResult }>;
  /** Primitives whose adapter returned null (registry-shape miss). */
  skipped: string[];
  /** Primitives whose adapter threw — captured to keep fan-out total. */
  errors: Array<{ primitive: string; error: string }>;
}

/**
 * Fan out a single recall dispatch across ALL registered primitives.
 *
 * Concurrency: each primitive is dispatched in parallel; wall-clock is
 * bounded by the slowest backend (palace bridge spawn typically dominates
 * at ~5s per primitive). Total wall-clock for the registry of 3 is
 * roughly 5s, NOT 15s.
 *
 * Errors are captured per-primitive — the fan-out always returns a complete
 * envelope so the consumer can show partial results when one backend fails.
 *
 * Per RFC-0037 integration boundaries: uses only the public
 * `adapter.recall(primitive)` surface — no introspection into RECALL_REGISTRY
 * shapes or mutation of state.
 *
 * @param adapter A constructed RecallAdapter.
 * @param decision Optional pre-computed decision (avoids recomputing if
 *   the caller already decided).
 * @param registry Primitives to fan out across; defaults to
 *   {@link RECALL_PRIMITIVE_KEYS}.
 */
export async function triangulate(
  adapter: RecallAdapter,
  options: {
    decision?: TriangulationDecision;
    registry?: readonly string[];
  } = {},
): Promise<TriangulationFanOut> {
  const decision = options.decision ?? decideTriangulation();
  const registry = options.registry ?? RECALL_PRIMITIVE_KEYS;

  // Settle each dispatch independently so one throw doesn't poison the
  // whole fan-out. Promise.allSettled keeps the per-primitive outcome
  // observable.
  const settled = await Promise.allSettled(
    registry.map(async (primitive) => {
      const result = await adapter.recall(primitive);
      return { primitive, result };
    }),
  );

  const results: Array<{ primitive: string; result: RecallResult }> = [];
  const skipped: string[] = [];
  const errors: Array<{ primitive: string; error: string }> = [];

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    const primitive = registry[i];
    if (outcome.status === 'fulfilled') {
      const value = outcome.value;
      if (value.result === null) {
        skipped.push(primitive);
      } else {
        results.push({ primitive, result: value.result });
      }
    } else {
      const reason = outcome.reason as unknown;
      errors.push({
        primitive,
        error:
          reason instanceof Error
            ? reason.message
            : typeof reason === 'string'
              ? reason
              : 'unknown',
      });
    }
  }

  return { decision, results, skipped, errors };
}

// ─── Soak observability ────────────────────────────────────────────────

/**
 * Resolve the destination path for the V11.22 triangulation decision log.
 * Mirrors recallCoverage path resolution: project-first, then cwd, then
 * global ~/.claude/MEMORY/LEARNING/SIGNALS/.
 *
 * The directory is created on demand so the first write doesn't fail on
 * a fresh project.
 */
function resolveDecisionLogPath(): string {
  const candidates: string[] = [];
  if (process.env.CLAUDE_PROJECT_DIR) {
    candidates.push(
      join(
        process.env.CLAUDE_PROJECT_DIR,
        'MEMORY',
        'LEARNING',
        'SIGNALS',
        DECISION_LOG_FILENAME,
      ),
    );
  }
  candidates.push(
    join(process.cwd(), 'MEMORY', 'LEARNING', 'SIGNALS', DECISION_LOG_FILENAME),
  );
  const dosDir = process.env.DOS_DIR || join(homedir(), '.claude');
  candidates.push(
    join(dosDir, 'MEMORY', 'LEARNING', 'SIGNALS', DECISION_LOG_FILENAME),
  );

  // Project-first if its parent SIGNALS dir already exists; else cwd-first
  // if THAT exists; else fall through to global. This mirrors the read-
  // resolver chain in coverageMetric.ts to avoid splitting writes vs reads
  // across different paths.
  for (const path of candidates) {
    if (existsSync(dirname(path))) return path;
  }
  // Default to global; create-on-demand handles missing dir.
  return candidates[candidates.length - 1];
}

/**
 * Record one triangulation decision for soak observability. Writes a
 * single JSONL line per call. Never throws — silent-degrade on any
 * filesystem error. Pure decision data: no per-primitive results or
 * recall payloads (those are too large for an append-only log and the
 * results are already retrievable through normal channels).
 *
 * Schema (one line per record):
 *   {
 *     ts: ISO-8601,
 *     consumer: string,            // e.g. "Tools/recall.ts"
 *     coverage_fraction: number?,  // null if coverage.ok===false
 *     coverage_reason: string?,    // failure reason if any
 *     events_in_window: number?,
 *     window_hours: number,
 *     threshold: number,
 *     hit_primitives: string[]?,   // omitted if coverage.ok===false
 *     triggered: boolean,
 *     enabled_by_operator: boolean,
 *     should_fan_out: boolean,
 *     fan_out_executed: boolean,   // did the consumer actually fan out
 *     primitive_dispatched: string?,  // single-primitive name if not fanned
 *   }
 */
export function recordTriangulationDecision(
  consumer: string,
  decision: TriangulationDecision,
  context: {
    fanOutExecuted: boolean;
    primitiveDispatched: string | null;
  },
): void {
  const path = resolveDecisionLogPath();
  const record: Record<string, unknown> = {
    ts: decision.decidedAt,
    consumer,
    window_hours: decision.coverage.windowHours,
    threshold: decision.threshold,
    triggered: decision.triggered,
    enabled_by_operator: decision.enabledByOperator,
    should_fan_out: decision.shouldFanOut,
    fan_out_executed: context.fanOutExecuted,
    primitive_dispatched: context.primitiveDispatched,
  };

  if (decision.coverage.ok) {
    record.coverage_fraction = decision.coverage.fraction;
    record.events_in_window = decision.coverage.eventsInWindow;
    record.hit_primitives = decision.coverage.hitPrimitives;
  } else {
    record.coverage_fraction = null;
    record.coverage_reason = decision.coverage.reason;
  }

  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf-8');
  } catch {
    // Soak observability is advisory — never break the consumer.
  }
}

// ─── Formatting helpers (consumer-facing) ─────────────────────────────

/**
 * Render a {@link TriangulationFanOut} as compact Markdown. Designed for
 * the same surface as {@link formatRecallResult} (CLI stdout / commit-hint
 * stream / UserPromptSubmit injection). Headers explicitly call out that
 * the result is fan-out (not single-primitive) so the operator knows the
 * surface is broader by construction.
 *
 * Never throws — JSON-serialization fallback and per-primitive truncation
 * keep the output stable on degenerate inputs.
 */
export function formatTriangulatedResults(fanOut: TriangulationFanOut): string {
  const { decision, results, skipped, errors } = fanOut;
  const lines: string[] = [];
  lines.push('## Triangulated Recall (V11.22 fan-out)');
  if (decision.coverage.ok) {
    lines.push(
      `**Coverage:** ${(decision.coverage.fraction * 100).toFixed(1)}% < ${(decision.threshold * 100).toFixed(0)}% threshold; fanning out across ${decision.coverage.registeredPrimitives.length} primitives.`,
    );
  } else {
    lines.push(
      `**Coverage:** unavailable (${decision.coverage.reason}); fan-out preserved by toggle.`,
    );
  }

  for (const { primitive, result } of results) {
    lines.push(`\n### ${primitive}`);
    lines.push(`status=${result.current?.status ?? 'no-claim'} sources=[${result.sources.join(', ')}]`);
  }

  if (skipped.length > 0) {
    lines.push(`\n**Skipped:** ${skipped.join(', ')} (registry mismatch)`);
  }
  if (errors.length > 0) {
    lines.push(`\n**Errors (${errors.length}):**`);
    for (const e of errors.slice(0, 5)) {
      lines.push(`- ${e.primitive}: ${e.error}`);
    }
  }
  return lines.join('\n');
}
