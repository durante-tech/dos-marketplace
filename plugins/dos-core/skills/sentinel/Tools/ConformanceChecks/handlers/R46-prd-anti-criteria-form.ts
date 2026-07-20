/**
 * R46 (RFC-0085 §2 — V12.6-β) — vNext PRDs: anti-criterion-shaped lines in
 * `## Criteria` MUST use the `ISC-A-N` prefix.
 *
 * Background: Council 2026-05-12 ratified the AC ⊂ OoS subset relation (R45)
 * AND the syntactic form constraint enforced here. Anti-criteria carry the
 * `ISC-A-` prefix so tooling (Reconcile, Sentinel, PRDLint) can distinguish
 * verifiable anti-conditions from positive criteria without semantic parsing.
 *
 * Applicability: PRD frontmatter has `format_version: 3` AND `## Criteria`
 * is present AND ≥1 line in `## Criteria` matches the anti-criterion shape
 * heuristic (starts with literal "Anti:" / "Out:" / contains "must not" or
 * "shall not" after the checkbox).
 *
 * Pass condition: every anti-criterion-shaped line uses ISC-A-N prefix.
 *
 * Fail condition: ≥1 anti-criterion-shaped line uses a non-ISC-A prefix
 * (e.g. plain `ISC-N` or bare `Anti:` without ISC-A-N).
 *
 * Cutoff: PRDs whose `started` predates RFC-0085 V12.6 acceptance
 * (2026-05-13) are skipped silently — pre-rule authoring.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";
import { CHECKBOX_STATE_CLASS } from "../lib/prd-doctrine.ts";

const REQUIREMENT =
  "vNext PRDs: anti-criterion-shaped lines in `## Criteria` must use `ISC-A-N` prefix per RFC-0080 §2.1 + RFC-0085 §2 R46";
const RULE_CUTOFF_ISO = "2026-05-13";
const ANTI_SHAPE = /\b(must not|shall not|never|cannot|may not|MUST NOT|SHALL NOT)\b|^Anti:|^Out:/;
// Any checkbox state, GFM case-insensitive (`[ ]`/`[x]`/`[X]`) via shared class (SENT-09).
const CRITERIA_LINE_RE = new RegExp(`^- \\[${CHECKBOX_STATE_CLASS}\\]\\s+`);
const CRITERIA_ID_RE = new RegExp(`^- \\[${CHECKBOX_STATE_CLASS}\\]\\s+(ISC-[A-Z]?-?[\\w-]*)`);

function listPrdPaths(workDir: string): string[] {
  if (!existsSync(workDir)) return [];
  const out: string[] = [];
  for (const layer of ["active", "archived", ""]) {
    const base = layer ? join(workDir, layer) : workDir;
    if (!existsSync(base)) continue;
    try {
      for (const dir of readdirSync(base)) {
        const prd = join(base, dir, "PRD.md");
        try { if (statSync(prd).isFile()) out.push(prd); } catch {}
      }
    } catch {}
  }
  return out;
}

function readField(fmBody: string, field: string): string | undefined {
  const m = fmBody.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
}

function extractCriteriaLines(content: string): string[] {
  const m = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!m) return [];
  return m[1].split("\n").filter(l => CRITERIA_LINE_RE.test(l));
}

export const R46_prd_anti_criteria_form: CheckHandler = async (ctx) => {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R46", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
  }

  const fails: string[] = [];
  let applicable = 0;

  for (const prdPath of prds) {
    let content: string;
    try { content = readFileSync(prdPath, "utf-8"); } catch { continue; }
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    if (readField(fm, "format_version") !== "3") continue;
    const started = readField(fm, "started");
    if (isPreCutoffISO(started, RULE_CUTOFF_ISO)) continue;

    const lines = extractCriteriaLines(content);
    if (lines.length === 0) continue;

    const antiShapedLines = lines.filter(l => ANTI_SHAPE.test(l));
    if (antiShapedLines.length === 0) continue;

    applicable++;
    for (const line of antiShapedLines) {
      const idMatch = line.match(CRITERIA_ID_RE);
      const id = idMatch?.[1] ?? "";
      if (!/^ISC-A-?\d+/.test(id)) {
        fails.push(`${prdPath}: anti-criterion shape detected but ID is "${id || "(missing)"}" — must use ISC-A-N prefix`);
      }
    }
  }

  if (applicable === 0) {
    return { rId: "R46", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${prds.length} PRDs; none are vNext + have anti-criterion-shaped lines yet`] };
  }
  if (fails.length === 0) {
    return { rId: "R46", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable} applicable PRDs — all anti-criteria use ISC-A-N prefix`] };
  }
  return {
    rId: "R46",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} anti-criteria with wrong ID shape across ${applicable} PRDs:`, ...fails.slice(0, 5)],
  };
};

type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
