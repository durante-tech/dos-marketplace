/**
 * RFC-0001 orchestration runtime — gate evaluators.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor iter 2. Pure
 * functions over Criterion / PhaseRecord / EffortLevel state — no I/O, no
 * process.env, no mutation. Adding a new gate type means adding an evaluator
 * here and a dispatch case in `evaluateGate`.
 */

import { EFFORT_DEFAULTS, type Criterion, type EffortLevel, type GateResult, type PhaseRecord } from "./types";
import { stableJson } from "./utils";

export interface GateContext {
  lastPhaseRecord?: PhaseRecord;
  criteria: readonly Criterion[];
  effort: EffortLevel;
  category: string;
  phaseRecords: readonly PhaseRecord[];
}

function filled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function slotFilled(ctx: GateContext, slot: string): GateResult {
  const value = ctx.lastPhaseRecord?.slots[slot];
  return {
    gate: "slot_filled",
    pass: filled(value),
    message: filled(value) ? `slot '${slot}' is filled` : `slot '${slot}' is empty`,
    diagnostics: { slot },
  };
}

export function criteriaMinCount(ctx: GateContext, minimum: number): GateResult {
  const actual = ctx.criteria.length;
  return {
    gate: "criteria_min_count",
    pass: actual >= minimum,
    message: `criteria count ${actual}/${minimum}`,
    diagnostics: { actual, minimum },
  };
}

export function criteriaMinCountForEffort(ctx: GateContext): GateResult {
  return { ...criteriaMinCount(ctx, EFFORT_DEFAULTS[ctx.effort].criteriaFloor), gate: "criteria_min_count_for_effort" };
}

export function criteriaHasAnti(ctx: GateContext): GateResult {
  const count = ctx.criteria.filter((c) => c.isAnti).length;
  return {
    gate: "criteria_has_anti",
    pass: count > 0,
    message: count > 0 ? "anti-criterion present" : "missing anti-criterion",
    diagnostics: { count },
  };
}

export function criteriaHasTest(ctx: GateContext): GateResult {
  const requiresTest = ctx.category === "code" || ctx.category === "creation" || ctx.category === "pipeline";
  const count = ctx.criteria.filter((c) => {
    const haystack = `${c.id} ${c.subject} ${c.description} ${stableJson(c.verificationMethod ?? {})}`.toLowerCase();
    return /\b(test|tests|lint|typecheck|verify|spec)\b/.test(haystack);
  }).length;
  return {
    gate: "criteria_has_test",
    pass: !requiresTest || count > 0,
    message: !requiresTest || count > 0 ? "test criterion requirement satisfied" : "code-change task requires a test criterion",
    diagnostics: { requiresTest, count },
  };
}

export function criteriaCriticalPass(ctx: GateContext): GateResult {
  const strict = ctx.effort === "standard" || ctx.effort === "extended" || ctx.effort === "advanced";
  const blockers = strict
    ? ctx.criteria.filter((c) => c.priority === "critical" && (c.status !== "completed" || !filled(c.evidence)))
    : ctx.criteria.filter((c) => c.status === "failed");
  return {
    gate: "criteria_critical_pass",
    pass: blockers.length === 0,
    message:
      blockers.length === 0
        ? "critical criteria pass"
        : strict
          ? `${blockers.length} critical criteria missing completion evidence`
          : `${blockers.length} criteria explicitly failed`,
    diagnostics: { strict, blockers: blockers.map((c) => c.id) },
  };
}

export function criteriaCoverage(ctx: GateContext): GateResult {
  const coverage = ctx.lastPhaseRecord?.slots.criteria_coverage;
  const missing: string[] = [];
  for (const c of ctx.criteria) {
    let covered = false;
    if (coverage && typeof coverage === "object" && !Array.isArray(coverage)) {
      const v = (coverage as Record<string, unknown>)[c.id];
      covered = Array.isArray(v) ? v.length > 0 : filled(v);
    }
    if (!covered) missing.push(c.id);
  }
  return {
    gate: "criteria_coverage",
    pass: missing.length === 0,
    message: missing.length === 0 ? "all criteria have plan coverage" : `${missing.length} criteria lack plan coverage`,
    diagnostics: { missing },
  };
}

export function evaluateGate(type: string, ctx: GateContext, parameter?: unknown): GateResult {
  switch (type) {
    case "slot_filled":
      return slotFilled(ctx, String(parameter ?? ""));
    case "criteria_min_count":
      return criteriaMinCount(ctx, Number(parameter ?? 0));
    case "criteria_min_count_for_effort":
      return criteriaMinCountForEffort(ctx);
    case "criteria_has_anti":
      return criteriaHasAnti(ctx);
    case "criteria_has_test":
      return criteriaHasTest(ctx);
    case "criteria_critical_pass":
      return criteriaCriticalPass(ctx);
    case "criteria_coverage":
      return criteriaCoverage(ctx);
    default:
      return { gate: type, pass: false, message: `unknown gate '${type}'` };
  }
}
