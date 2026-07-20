/**
 * R-ACL-4 (RFC-0061) — MEMORY/STATE/ contains at least one pai-merge-audit-{date}.jsonl file.
 *
 * The merge wrapper (Tools/merge-upstream.ts, Phase 2) writes an audit JSONL to
 * MEMORY/STATE/ on every upstream sync. R-ACL-4 checks that the wrapper has been
 * exercised at least once — no audit file means the ACL tooling has never run
 * and the PAI vocabulary leak risk is unmitigated.
 *
 * NOT_APPLICABLE conditions (pre-Phase-4 cadence):
 *   - No MEMORY/STATE/ directory exists at repoRoot or at ~/.claude/MEMORY/STATE/
 *     (fresh install, merge wrapper not yet set up)
 *   - MEMORY/STATE/ exists but contains no pai-merge-audit-*.jsonl (wrapper
 *     authored but operator has not yet initiated a real upstream sync)
 *
 * Resolution chain (first dir that exists wins):
 *   1. ctx.repoRoot/MEMORY/STATE/
 *   2. ~/.claude/MEMORY/STATE/
 *   3. not_applicable
 *
 * Failure modes (only post-Phase-4 cadence):
 *   - This check is designed as a presence gate; absence is always not_applicable,
 *     never a hard fail — upstream syncs are an operator-initiated action.
 *
 * Cross-references:
 *   RFC-0061 §13.1 R-ACL-4 (check: pai-acl.merge-audit-trail-present)
 *   Tools/merge-upstream.ts — writes the audit JSONL
 *   MEMORY/STATE/ — three-step project-first resolution (CLAUDE.md §Project-Level Memory)
 *
 * Enhancement notes:
 *   2026-05-05 — initial authorship (Stream G, RFC-0061 delivery)
 */

import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const R_ID = "R-ACL-4";
const REQUIREMENT =
  "MEMORY/STATE/ contains at least one pai-merge-audit-{date}.jsonl produced by the merge wrapper";

const AUDIT_GLOB_PREFIX = "pai-merge-audit-";
const AUDIT_GLOB_SUFFIX = ".jsonl";

function resolveStateDirs(ctx: CheckContext): string[] {
  return [
    join(ctx.repoRoot, "MEMORY", "STATE"),
    join(homedir(), ".claude", "MEMORY", "STATE"),
  ];
}

function findAuditFiles(stateDir: string): string[] {
  if (!existsSync(stateDir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(stateDir);
  } catch {
    return [];
  }
  return entries.filter(
    (f) => f.startsWith(AUDIT_GLOB_PREFIX) && f.endsWith(AUDIT_GLOB_SUFFIX),
  );
}

export async function rAcl4MergeAuditTrailPresent(ctx: CheckContext): Promise<CheckResult> {
  const stateDirs = resolveStateDirs(ctx);
  const foundDirs: string[] = [];
  const allAuditFiles: string[] = [];

  for (const dir of stateDirs) {
    if (!existsSync(dir)) continue;
    foundDirs.push(dir);
    const files = findAuditFiles(dir);
    for (const f of files) {
      allAuditFiles.push(join(dir, f));
    }
  }

  // No MEMORY/STATE/ directory at all → pre-Phase-4 fresh install
  if (foundDirs.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        "No MEMORY/STATE/ directory found — merge wrapper not yet set up (pre-Phase-4 cadence)",
        `Checked: ${stateDirs.join(", ")}`,
      ],
    };
  }

  // STATE dir exists but no audit files → wrapper authored, not yet run
  if (allAuditFiles.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `MEMORY/STATE/ found (${foundDirs.join(", ")}) but no pai-merge-audit-*.jsonl files present`,
        "Operator has not yet initiated an upstream sync via Tools/merge-upstream.ts — pre-Phase-4 cadence",
        "Once first sync is run, this check will advance to pass",
      ],
    };
  }

  const preview = allAuditFiles.slice(0, 3).map((f) => f.split("/").slice(-1)[0]).join(", ");
  const overflow = allAuditFiles.length > 3 ? ` (+${allAuditFiles.length - 3} more)` : "";

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${allAuditFiles.length} audit file(s) found: ${preview}${overflow}`,
      `State dir(s): ${foundDirs.join(", ")}`,
    ],
    loc: allAuditFiles[0],
  };
}
