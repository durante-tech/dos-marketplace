/**
 * R98 — presence.task-projection-wired (ninth-generation guard; RFC-0149 machinery).
 *
 * RFC-0149 shipped the PRD-ISC → Task-tools projection: the advisory parity
 * lint `Tools/task-projection-check.ts` (reads MEMORY/STATE/task-events.jsonl
 * per session, flags no-projection / fat-task / completed-unverified) is the
 * warn-tier "teeth" the v0.0.10 §6.3 PLAN TASK PROJECTION substep points to
 * (2026-07-04 doctrine wiring, PRD 20260704-004247). If that tool (or its
 * test) is silently deleted, the doctrine substep points at nothing and the
 * projection contract loses its only observable enforcement — the exact
 * advisory-graveyard regression the wiring exists to prevent.
 *
 * This is a PRESENCE guard, not a runtime parity check: the per-session parity
 * IS `task-projection-check.ts` (invoked at VERIFY with --prd); a repo-scanning
 * Sentinel rule cannot meaningfully read per-session runtime state, and doing
 * so would misclassify as install-class. So R98 guards that the parent-repo
 * f(HEAD) footprint of the parity machinery stays present — deterministic,
 * committed-class, gate-safe (RFC-0149 §5 + the R39 install-class discipline).
 *
 * Warn-only ship (R80/R91/R93/R94/R97 advisory precedent): with a Tools/ root
 * present it ALWAYS returns `status: "pass"`, missing artifacts in evidence
 * only; a repo with no Tools/ root returns `not_applicable` (dropped into a
 * non-DOS repo — inspected nothing, not a false green). Promote to fail-tier
 * only after an FP-rate soak. Decision logic lives in
 * `__testing__.missingProjectionArtifacts`.
 */

import { existsSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "presence.task-projection-wired: the RFC-0149 parity-lint (Tools/task-projection-check.ts + its test) — the warn-tier teeth the §6.3 TASK PROJECTION doctrine substep points to — stays present in-tree";

const R_ID = "R98";

/** Parent-repo f(HEAD) footprint of the RFC-0149 projection parity machinery. */
const REQUIRED_ARTIFACTS = [
  "Tools/task-projection-check.ts",
  "Tools/task-projection-check.test.ts",
] as const;

/**
 * Pure decision function: which required RFC-0149 parity-lint artifacts are
 * absent under repoRoot. Empty array = fully wired.
 */
export function missingProjectionArtifacts(repoRoot: string): string[] {
  return REQUIRED_ARTIFACTS.filter((rel) => !existsSync(join(repoRoot, rel)));
}

/**
 * R98 handler. `not_applicable` when repoRoot is not the DOS monorepo (no
 * Tools/ root); otherwise always `status: "pass"` (warn-only), with any
 * missing RFC-0149 parity-lint artifact named in evidence.
 */
export async function r98TaskProjectionWired(ctx: CheckContext): Promise<CheckResult> {
  if (!existsSync(join(ctx.repoRoot, "Tools"))) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no Tools/ root under ${ctx.repoRoot} — not the DOS monorepo`],
    };
  }

  const missing = missingProjectionArtifacts(ctx.repoRoot);

  const summary =
    missing.length === 0
      ? "presence.task-projection-wired: RFC-0149 parity-lint present (task-projection-check.ts + test)"
      : `presence.task-projection-wired (WARN-ONLY): ${missing.length} RFC-0149 parity-lint artifact(s) missing — the §6.3 TASK PROJECTION teeth would be silently gone`;

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [summary, ...missing.map((m) => `MISSING: ${m}`)],
  };
}

export const __testing__ = { missingProjectionArtifacts };
