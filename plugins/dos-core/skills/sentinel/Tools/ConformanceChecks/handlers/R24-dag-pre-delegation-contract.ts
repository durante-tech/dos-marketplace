/**
 * R24 — DAG-shaped PRDs declare a Pre-Delegation Contract in ## Decisions.
 *
 * A DAG-shaped PRD is one with `mode: interactive` in frontmatter, indicating
 * it uses multiple parallel agents. The Algorithm DAG-WITH-TEAMMATES procedure
 * mandates that such PRDs include a ## Decisions section with an explicit
 * "Pre-Delegation Contract" (file ownership table) before any agent is spawned.
 *
 * This check:
 *   1. Scans MEMORY/WORK/{slug}/PRD.md files under ctx.repoRoot
 *   2. Filters to DAG-shaped PRDs (mode: interactive)
 *   3. Verifies each has a ## Decisions section containing "Pre-Delegation Contract"
 *
 * Detection pattern: looks for the literal text "Pre-Delegation Contract" anywhere
 * under a `## Decisions` heading. Case-sensitive per the canonical doctrine phrasing.
 *
 * Failure modes:
 *   - No MEMORY/WORK/ directory → not_applicable
 *   - No DAG-shaped PRDs found → not_applicable
 *   - DAG PRD lacks ## Decisions section → fail
 *   - DAG PRD has ## Decisions but no "Pre-Delegation Contract" → fail
 *
 * Why R-class: file-zone conflicts in parallel agent sessions are catastrophic
 * (concurrent writes to shared files). The Pre-Delegation Contract is the only
 * static artifact that prevents this — its absence is a structural safety gap,
 * not a style preference.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "DAG-shaped PRDs (mode: interactive) must have a Pre-Delegation Contract in the ## Decisions section";

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

/**
 * Returns true if the PRD body contains a ## Decisions section with
 * "Pre-Delegation Contract" somewhere in it.
 */
function hasPreDelegationContract(content: string): boolean {
  // Find ## Decisions heading
  const decisionsIdx = content.search(/^##\s+Decisions/m);
  if (decisionsIdx === -1) return false;

  // Extract content from ## Decisions to next ## heading (or end of file)
  const afterDecisions = content.slice(decisionsIdx);
  // Find the next ## heading after the ## Decisions heading (offset by 1 to skip Decisions itself)
  const nextSectionIdx = afterDecisions.slice(1).search(/^##\s+/m);
  const decisionsSection =
    nextSectionIdx === -1 ? afterDecisions : afterDecisions.slice(0, nextSectionIdx);

  return decisionsSection.includes("Pre-Delegation Contract");
}

export async function r24DagPreDelegationContract(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");

  if (!existsSync(workRoot)) {
    return {
      rId: "R24",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`MEMORY/WORK/ not found under ${ctx.repoRoot}`],
    };
  }

  let entries: string[];
  try {
    entries = readdirSync(workRoot);
  } catch (err) {
    return {
      rId: "R24",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Failed to read ${workRoot}: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const dagPrdPaths: string[] = [];

  // R24 ratified 2026-05-05 (handler shipped alongside R18/R20/R32 cohort).
  // PRDs scaffolded BEFORE this cutoff predate the Pre-Delegation Contract
  // doctrine; legacy exemption preserves rule intent (forward drift).
  const R24_CUTOFF_MS = new Date("2026-05-05T00:00:00Z").getTime();
  const R24_SLUG_TS_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/;

  for (const entry of entries.sort()) {
    const prdPath = join(workRoot, entry, "PRD.md");
    if (!existsSync(prdPath)) continue;
    try {
      if (!statSync(prdPath).isFile()) continue;
    } catch {
      continue;
    }

    // Legacy exemption: skip PRDs scaffolded before R24 cutoff.
    const slugMatch = R24_SLUG_TS_RE.exec(entry);
    if (slugMatch) {
      const d = new Date(`${slugMatch[1]}-${slugMatch[2]}-${slugMatch[3]}T${slugMatch[4]}:${slugMatch[5]}:${slugMatch[6]}Z`);
      if (!isNaN(d.getTime()) && d.getTime() < R24_CUTOFF_MS) continue;
    }

    let content: string;
    try {
      content = readFileSync(prdPath, "utf-8");
    } catch {
      continue;
    }

    const frontmatter = parseFrontmatter(content);
    if ((frontmatter?.mode ?? "").toLowerCase().trim() === "interactive") {
      dagPrdPaths.push(prdPath);
    }
  }

  if (dagPrdPaths.length === 0) {
    return {
      rId: "R24",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No DAG-shaped PRDs (mode: interactive) found under ${workRoot}`],
    };
  }

  const failEvidence: string[] = [];

  for (const prdPath of dagPrdPaths) {
    let content: string;
    try {
      content = readFileSync(prdPath, "utf-8");
    } catch (err) {
      failEvidence.push(`${prdPath}: cannot read — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (!hasPreDelegationContract(content)) {
      const hasDecisions = /^##\s+Decisions/m.test(content);
      failEvidence.push(
        hasDecisions
          ? `${prdPath}: ## Decisions section exists but lacks "Pre-Delegation Contract"`
          : `${prdPath}: no ## Decisions section — Pre-Delegation Contract not present`,
      );
    }
  }

  if (failEvidence.length > 0) {
    return {
      rId: "R24",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: failEvidence,
    };
  }

  return {
    rId: "R24",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${dagPrdPaths.length} DAG PRD(s) checked — all have Pre-Delegation Contract in ## Decisions`,
    ],
  };
}
