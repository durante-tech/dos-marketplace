/**
 * R44 (RFC-0080 §2.2 / RFC-0085 council-2026-05-12) — vNext PRDs at
 * effort >= standard must declare a `parent_rfc:` frontmatter field.
 *
 * Background: RFC-0080 §2.2 collapsed `## Vision` body section into a
 * frontmatter pointer per the 2026-05-12 4-voice council verdict. The kite-
 * level summary-goal travels via `parent_rfc:` rather than duplicating
 * Strategic Intent in PRD body prose. Orphan PRDs declare `parent_rfc: none`
 * AND surface Strategic Intent inline with the 🪶 ORPHAN STRATEGIC INTENT
 * line-prefix marker (RFC-0080 §6.1 Named-Smell Policy).
 *
 * Applicability: PRD frontmatter has `format_version: 3` AND `effort` is one
 * of standard/extended/advanced/deep/xhigh/comprehensive.
 *
 * Pass condition: frontmatter contains `parent_rfc:` field with any value
 * (including the literal `none` for orphan PRDs).
 *
 * Fail condition: vNext effort >= standard PRD with no `parent_rfc:` field.
 * Warning-tier (Cockburn dissent preserved — v0.0.13 measurement may revisit
 * whether the pointer-field discipline holds vs re-promoting ## Vision).
 *
 * Cutoff: PRDs whose `started` predates RFC-0080 acceptance (2026-05-12) are
 * skipped silently — the rule didn't exist when they were authored.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";
import { STANDARD_PLUS_EFFORT, listPrdPaths } from "../lib/prd-doctrine.ts";

const REQUIREMENT =
  "vNext PRDs (format_version: 3) at effort >= standard must declare a `parent_rfc:` frontmatter field per RFC-0080 §2.2";
// STANDARD_PLUS + listPrdPaths come from the shared prd-doctrine SoT (the same
// recursive enumerator R17/R18/PRDLint use); R44's proven recursion was the
// template lifted into that module.
const STANDARD_PLUS = STANDARD_PLUS_EFFORT;
const RULE_CUTOFF_ISO = "2026-05-12";

function readField(fmBody: string, field: string): string | undefined {
  const m = fmBody.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
}

export const R44_parent_rfc_frontmatter: CheckHandler = async (ctx) => {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R44", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
  }

  const fails: string[] = [];
  let scanned = 0;
  let applicable = 0;

  for (const prdPath of prds) {
    let content: string;
    try { content = readFileSync(prdPath, "utf-8"); } catch { continue; }
    scanned++;
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];

    const formatVersion = readField(fm, "format_version");
    if (formatVersion !== "3") continue; // legacy v2.1 PRDs not subject to R44

    const started = readField(fm, "started");
    if (isPreCutoffISO(started, RULE_CUTOFF_ISO)) continue; // pre-rule cutoff (UTC-normalized — lib/grandfather.ts)

    const effort = readField(fm, "effort")?.toLowerCase();
    if (!effort || !STANDARD_PLUS.has(effort)) continue;

    applicable++;
    const parentRfc = readField(fm, "parent_rfc");
    if (!parentRfc) {
      fails.push(`${prdPath}: format_version: 3 + effort: ${effort} — missing parent_rfc field`);
    }
  }

  if (applicable === 0) {
    return { rId: "R44", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${scanned} PRDs; none are vNext + effort >= standard yet`] };
  }
  if (fails.length === 0) {
    return { rId: "R44", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable}/${applicable} applicable PRDs declare parent_rfc`] };
  }
  return {
    rId: "R44",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${applicable} applicable PRDs missing parent_rfc:`, ...fails.slice(0, 5)],
  };
};

// CheckHandler type alias for ergonomic export — re-declared locally to avoid
// import cycle when this file is loaded directly.
type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
