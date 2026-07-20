/**
 * R90 (Telos #123 F2 — KG-invisibility enforcement) — `Tools/drift-check.ts`
 * must define a `runTelosAnchorAudit` function so the drift radiator includes
 * the corpus→KG anchor-vs-header audit.
 *
 * Background: Telos #123 mints `<!-- telos:<uuid> -->` anchors that map corpus
 * entity headers (`### <title>` in goals.md/projects.md) to KG subjects
 * (goal:/project:). An anchor-less entity is silently invisible to the
 * purpose-graph KG SyncTelos builds — including the North Star's own substrate.
 * F1 mints anchors on append (UpdateTelos.ts); F2 is the enforcement half:
 * drift-check.ts spawns the shipped `UpdateTelos.ts audit` and gates on a
 * positively-classified divergence. `runTelosAnchorAudit` is the load-bearing
 * entry-point that produces the section + drives the gate. If a future refactor
 * renames or inlines it, the anchor gate disappears silently from drift-check.
 *
 * Sibling of R55 (`presence.drift-check-roadmap-section`) — same wiring-canary
 * shape over the same radiator. Source-text presence check (no import) so it
 * runs anywhere drift-check.ts is committed, independent of the operator-local
 * TELOS corpus.
 *
 * Applicability: <repoRoot>/Tools/drift-check.ts exists.
 * Pass: comment-stripped source declares/calls `runTelosAnchorAudit`.
 * Fail: file exists but the function is not declared/called (a comment mention
 *   no longer counts — SENT-05).
 * Not_applicable: Tools/drift-check.ts not found.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { stripSlashComments, hasDeclarationOrCall } from "../lib/source-presence.ts";

const REQUIREMENT =
  "Tools/drift-check.ts must define a `runTelosAnchorAudit` function (Telos #123 F2 anchor-vs-header KG-invisibility gate)";
const FUNCTION_TOKEN = "runTelosAnchorAudit";

export async function r90DriftCheckTelosAnchorSection(ctx: CheckContext): Promise<CheckResult> {
  const driftCheckPath = join(ctx.repoRoot, "Tools", "drift-check.ts");

  if (!existsSync(driftCheckPath)) {
    return {
      rId: "R90",
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
      rId: "R90",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${driftCheckPath} unreadable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (!hasDeclarationOrCall(stripSlashComments(src), FUNCTION_TOKEN)) {
    return {
      rId: "R90",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${driftCheckPath}: no declaration/call of '${FUNCTION_TOKEN}' in comment-stripped source — corpus→KG anchor audit section dropped`,
        "Telos #123 F2 wired the anchor-vs-header audit into drift-check; the function must remain defined/called (a comment mention no longer counts) to preserve the KG-invisibility gate.",
      ],
    };
  }

  return {
    rId: "R90",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`${driftCheckPath}: '${FUNCTION_TOKEN}' declared/called — corpus→KG anchor audit section wired`],
  };
}
