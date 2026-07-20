/**
 * R49 (RFC-0085 §2 — V12.6-β) — vNext PRDs at E3+: every `ISC-N` in
 * `## Criteria` MUST have ≥1 corresponding `T-N` row in `## Test Strategy`
 * (or `### Test Strategy` subsection under `## Criteria` per RFC-0080 §2.1).
 *
 * Background: vNext §2.1 (RFC-0080 §2.1) collapsed the standalone Test
 * Strategy section into a subsection under Criteria for vNext PRDs. Per
 * RFC-0085 R49, E3+ effort PRDs must declare T-N coverage rows for every
 * ISC-N. T-N may reference multiple ISCs (one-to-many is fine).
 *
 * Applicability: PRD frontmatter has `format_version: 3` AND effort is one of
 * advanced/deep/xhigh/comprehensive (E3+) AND `## Criteria` is populated.
 *
 * Pass condition: every ISC-N (not ISC-A-N) has ≥1 T-N row that references
 * it (via "T-N: ... ISC-N" pattern or explicit "covers ISC-N" parenthetical).
 *
 * Fail condition: ≥1 ISC-N lacks T-N coverage.
 *
 * Cutoff: PRDs whose `started` predates 2026-05-13 are skipped silently.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";
import { CHECKBOX_STATE_CLASS } from "../lib/prd-doctrine.ts";

const REQUIREMENT =
  "vNext E3+ PRDs: every positive `ISC-N` has ≥1 `T-N` coverage row in `## Test Strategy` (RFC-0080 §2.1 / RFC-0085 R49)";
const RULE_CUTOFF_ISO = "2026-05-13";
const E3_PLUS = new Set(["advanced", "deep", "xhigh", "comprehensive"]);
// Positive ISC-N (NOT ISC-A-N), any checkbox state incl. GFM `[X]` via shared class (SENT-09).
const POSITIVE_ISC_RE = new RegExp(`^- \\[${CHECKBOX_STATE_CLASS}\\]\\s+(ISC-(?!A-)\\d+(?:\\.\\d+)?)`);

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

function extractPositiveIscIds(content: string): string[] {
  const m = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!m) return [];
  const out: string[] = [];
  for (const line of m[1].split("\n")) {
    // Match positive ISC-N (NOT ISC-A-N)
    const cm = line.match(POSITIVE_ISC_RE);
    if (cm) out.push(cm[1]);
  }
  return out;
}

function extractTestStrategyBody(content: string): string {
  // vNext: ### Test Strategy under ## Criteria, OR legacy ## Test Strategy
  const sub = content.match(/### Test Strategy\n([\s\S]*?)(?=\n## |\n### |\n---|$)/);
  if (sub) return sub[1];
  const top = content.match(/## Test Strategy\n([\s\S]*?)(?=\n## |\n---|$)/);
  return top?.[1] ?? "";
}

export const R49_prd_test_coverage: CheckHandler = async (ctx) => {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R49", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
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
    const effort = readField(fm, "effort")?.toLowerCase();
    if (!effort || !E3_PLUS.has(effort)) continue;

    const iscs = extractPositiveIscIds(content);
    if (iscs.length === 0) continue;

    applicable++;
    const testBody = extractTestStrategyBody(content);
    if (!testBody.trim()) {
      fails.push(`${prdPath}: E3+ vNext PRD has ${iscs.length} ISC-N but no Test Strategy section`);
      continue;
    }
    const coveredIscs = new Set([...testBody.matchAll(/\bISC-\d+(?:\.\d+)?\b/g)].map(m => m[0]));
    const uncovered = iscs.filter(i => !coveredIscs.has(i));
    if (uncovered.length > 0) {
      fails.push(`${prdPath}: ${uncovered.length} ISC-N without T-N coverage: ${uncovered.slice(0, 3).join(", ")}`);
    }
  }

  if (applicable === 0) {
    return { rId: "R49", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${prds.length} PRDs; none are vNext + E3+ with positive ISCs yet`] };
  }
  if (fails.length === 0) {
    return { rId: "R49", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable} applicable PRDs — all ISC-N have T-N coverage`] };
  }
  return {
    rId: "R49",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} PRDs with test-coverage gaps:`, ...fails.slice(0, 5)],
  };
};

type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
