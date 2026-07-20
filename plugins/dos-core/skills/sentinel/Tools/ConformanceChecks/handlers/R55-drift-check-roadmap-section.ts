/**
 * R55 (v0.0.15 foundation-fix sprint, PRD-20260513-145627 ISC-6 regression
 * guard) — `Tools/drift-check.ts` must define a `runRoadmapReconcile`
 * function so the drift-check radiator includes roadmap reconciliation
 * output.
 *
 * Background: ISC-6 added the roadmap-reconcile section to drift-check.ts
 * so operators see roadmap vs ledger drift in one place. The function
 * `runRoadmapReconcile` is the load-bearing entry-point that produces the
 * section. If a future refactor renames or inlines the function, the
 * roadmap section disappears silently from drift-check output.
 *
 * Applicability: <repoRoot>/Tools/drift-check.ts exists.
 *
 * Pass condition: comment-stripped source contains a declaration/call of
 * `runRoadmapReconcile` (SENT-05: a raw whole-file `includes()` stayed green
 * when the function was deleted but a comment still mentioned it).
 *
 * Fail condition: file exists but the function is not declared/called (a mere
 * comment mention no longer counts).
 *
 * Not_applicable: Tools/drift-check.ts not found.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { stripSlashComments, hasDeclarationOrCall } from "../lib/source-presence.ts";

const REQUIREMENT =
  "Tools/drift-check.ts must define a `runRoadmapReconcile` function (ISC-6 regression guard)";
const FUNCTION_TOKEN = "runRoadmapReconcile";

export async function r55DriftCheckRoadmapSection(ctx: CheckContext): Promise<CheckResult> {
  const driftCheckPath = join(ctx.repoRoot, "Tools", "drift-check.ts");

  if (!existsSync(driftCheckPath)) {
    return {
      rId: "R55",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Tools/drift-check.ts not found at ${driftCheckPath}`],
    };
  }

  let src: string;
  try {
    src = readFileSync(driftCheckPath, "utf-8");
  } catch (err) {
    return {
      rId: "R55",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${driftCheckPath} unreadable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (!hasDeclarationOrCall(stripSlashComments(src), FUNCTION_TOKEN)) {
    return {
      rId: "R55",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${driftCheckPath}: no declaration/call of '${FUNCTION_TOKEN}' in comment-stripped source — roadmap-reconcile section dropped`,
        "ISC-6 wired roadmap reconciliation into drift-check; the function must remain defined/called (a comment mention no longer counts) to preserve the radiator.",
      ],
    };
  }

  return {
    rId: "R55",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`${driftCheckPath}: '${FUNCTION_TOKEN}' declared/called — roadmap-reconcile section wired`],
  };
}
