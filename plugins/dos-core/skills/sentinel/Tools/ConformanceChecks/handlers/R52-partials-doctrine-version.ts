/**
 * R52 (V13.3a — RFC-0083 §5.5 split, doctrine version sweep) — every
 * `Packs/{pack}/src/SKILL.partials.md` MUST NOT carry the canonical legacy
 * v0.0.7-enhanced marker set (Algorithm v0.0.7-enhanced reference, §2.2
 * format, criteriaCount, format_version: 2).
 *
 * Background: V13.3a council mandate (2026-05-10 P1 ownership-clarification)
 * locked the canonical grep pattern `Algorithm v0\.0\.7-enhanced|§2\.2 format|
 * criteriaCount|format_version: 2`. This rule is the forward-only guard that
 * prevents the sweep from regressing as new packs adopt partials.
 *
 * Applicability: any `Packs/<pack>/src/SKILL.partials.md` file exists.
 * `Releases/v0.0.{1..11}/.claude/skills/**` is excluded per Cato F-4.
 *
 * Pass condition: no SKILL.partials.md matches the legacy marker pattern.
 *
 * Fail condition: ≥1 SKILL.partials.md still carries a legacy marker.
 *
 * Status tier: warning (per V13.3a Council mandate — surveillance, not block).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every `Packs/{pack}/src/SKILL.partials.md` MUST be free of canonical legacy v0.0.7-enhanced markers per V13.3a sweep (RFC-0083 §5.5)";
const LEGACY_PATTERN = /Algorithm v0\.0\.7-enhanced|§2\.2 format|criteriaCount|format_version: 2/;

function listPartialsFiles(packsDir: string): string[] {
  const out: string[] = [];
  if (!existsSync(packsDir)) return out;
  for (const pack of readdirSync(packsDir)) {
    const partials = join(packsDir, pack, "src", "SKILL.partials.md");
    try {
      if (statSync(partials).isFile()) out.push(partials);
    } catch {}
  }
  return out;
}

export const R52_partials_doctrine_version: CheckHandler = async (ctx) => {
  const packsDir = join(ctx.repoRoot, "Packs");
  const partials = listPartialsFiles(packsDir);
  if (partials.length === 0) {
    return { rId: "R52", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no Packs/{pack}/src/SKILL.partials.md found"] };
  }

  const fails: string[] = [];
  for (const path of partials) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    const m = content.match(LEGACY_PATTERN);
    if (m) {
      // Find the line number for evidence.
      const lines = content.split("\n");
      let lineNum = 0;
      for (let i = 0; i < lines.length; i++) {
        if (LEGACY_PATTERN.test(lines[i])) { lineNum = i + 1; break; }
      }
      fails.push(`${path}:${lineNum} — legacy marker "${m[0]}"`);
    }
  }

  if (fails.length === 0) {
    return { rId: "R52", requirement: REQUIREMENT, status: "pass", evidence: [`${partials.length} SKILL.partials.md scanned — all free of legacy doctrine markers`] };
  }
  return {
    rId: "R52",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${partials.length} SKILL.partials.md still carry legacy markers (warning tier — V13.3a):`, ...fails.slice(0, 5)],
  };
};

type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
