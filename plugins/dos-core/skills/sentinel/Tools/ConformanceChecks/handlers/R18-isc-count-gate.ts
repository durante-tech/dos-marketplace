/**
 * R18 (RFC-0059) — Every WORK PRD's ISC count meets the effort tier floor.
 *
 * Reads MEMORY/WORK/{slug}/PRD.md files, extracts the `effort` tier from
 * frontmatter, counts ISC checkbox items (lines matching `- [ ]` or `- [x]`
 * with ISC- prefix), and verifies count >= the tier's ISC floor.
 *
 * Tier floors (from Algorithm v0.0.7-enhanced TierConfig §0):
 *   standard:     8    extended:  16    advanced:  24
 *   deep:        40    xhigh:     50    comprehensive: 64
 *
 * PRDs with unrecognized effort values are flagged as a separate warning class
 * and do not block the gate (operator oversight rather than silent pass).
 *
 * Failure modes:
 *   - No MEMORY/WORK/ directory → not_applicable
 *   - No PRD.md files found → not_applicable
 *   - Any PRD's ISC count < tier floor → fail
 *
 * Note on R-id namespace: RFC-0028 registered R18 (backup-health,
 * check key `presence.backup-health`). This handler uses the distinct
 * check key `presence.isc-count-gate` (RFC-0059 §13.1). Both coexist.
 *
 * Why R-class: ISC count gates are structural proof that the operator
 * decomposed work adequately before building. Under-decomposed PRDs produce
 * untestable progress tracking, defeating the PRD-as-System-of-Record contract.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import {
  TIER_FLOORS_VNEXT,
  countVNextIscs,
  listPrdPaths,
  isPreIscFloorCutoff,
} from "../lib/prd-doctrine.ts";

const REQUIREMENT =
  "Every WORK PRD's ISC count must meet the effort tier floor (standard: 8, extended: 16, advanced: 24, deep: 40, xhigh: 50, comprehensive: 64)";

/**
 * ISC floors, ISC checkbox counter, recursive PRD enumeration, and the
 * 2026-05-05 legacy-exemption cutoff all come from the shared prd-doctrine SoT
 * so R18 and PRDLint enforce byte-identical doctrine. Pre-fix this handler kept
 * private copies AND scanned only the flat MEMORY/WORK/{slug} layout — silently
 * skipping every active/ + archived/ bucketed PRD since the RFC-0037 split (the
 * ISC-12 recursion gap).
 */

/** Parse YAML frontmatter between first two `---` delimiters. */
function parseFrontmatter(content: string): Record<string, string> | null {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (endIdx === -1) return null;
  const result: Record<string, string> = {};
  for (let i = 1; i < endIdx; i++) {
    const m = lines[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (m) result[m[1]] = m[2].trim();
  }
  return result;
}

export async function r18IscCountGate(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");

  if (!existsSync(workRoot)) {
    return {
      rId: "R18-RFC0059",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`MEMORY/WORK/ not found under ${ctx.repoRoot}`],
    };
  }

  // Recurse active/ + archived/ + flat layout via the shared SoT (ISC-12).
  const prdPaths = listPrdPaths(workRoot);

  if (prdPaths.length === 0) {
    return {
      rId: "R18-RFC0059",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No PRD.md files found under ${workRoot}`],
    };
  }

  const failEvidence: string[] = [];
  const passEvidence: string[] = [];

  for (const prdPath of prdPaths) {
    // Legacy exemption: PRDs scaffolded before the R18 cutoff (2026-05-05)
    // are out of scope for the tier-floor gate (shared with PRDLint via the SoT).
    if (isPreIscFloorCutoff(prdPath)) continue;

    let content: string;
    try {
      content = readFileSync(prdPath, "utf-8");
    } catch (err) {
      failEvidence.push(
        `${prdPath}: could not read — ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const frontmatter = parseFrontmatter(content);
    const effort = (frontmatter?.effort ?? "").toLowerCase().trim();

    if (!effort) {
      failEvidence.push(`${prdPath}: missing effort field in frontmatter — cannot apply ISC floor gate`);
      continue;
    }

    const floor = TIER_FLOORS_VNEXT[effort];
    if (floor === undefined) {
      // Not a recognized effort tier — warn but don't fail the gate
      passEvidence.push(
        `${prdPath}: effort '${effort}' not in TierConfig — gate not applied (unrecognized tier)`,
      );
      continue;
    }

    const iscCount = countVNextIscs(content);
    if (iscCount < floor) {
      failEvidence.push(
        `${prdPath}: effort '${effort}' requires ≥${floor} ISCs, found ${iscCount}`,
      );
    } else {
      passEvidence.push(
        `${prdPath}: effort '${effort}', ${iscCount} ISC(s) ≥ floor ${floor}`,
      );
    }
  }

  if (failEvidence.length > 0) {
    return {
      rId: "R18-RFC0059",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: failEvidence,
    };
  }

  return {
    rId: "R18-RFC0059",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: passEvidence.length > 0
      ? passEvidence
      : [`${prdPaths.length} PRD(s) checked — all meet effort tier ISC floor`],
  };
}
