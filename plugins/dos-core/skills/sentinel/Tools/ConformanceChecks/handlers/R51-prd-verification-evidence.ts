/**
 * R51 (RFC-0085 §2 — V12.6-β) — vNext PRDs: every ISC-N marked `[x]` in
 * `## Criteria` MUST have ≥1 entry in `## Verification` referencing it.
 *
 * Background: vNext §2.1 retains `## Verification` as the evidence trail for
 * completed criteria. Marking an ISC `[x]` without a Verification entry
 * leaves the evidence claim un-cited — the close-the-loop gap RFC-0085 R51
 * mechanizes. This is the §4.1 Canon-TDD "close-the-loop terminal" rule
 * that proves the V12.6 rule pipeline end-to-end on a real PRD.
 *
 * Applicability: PRD frontmatter has `format_version: 3` AND ≥1 ISC-N is
 * marked `[x]` AND `## Verification` section exists.
 *
 * Pass condition: every `[x]` ISC-N appears in at least one `## Verification`
 * entry (as plain reference or in the line body).
 *
 * Fail condition: ≥1 `[x]` ISC-N has no Verification entry.
 *
 * Cutoff: PRDs whose `started` predates 2026-05-13 are skipped silently.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";
import { CHECKBOX_CHECKED_CLASS } from "../lib/prd-doctrine.ts";

const REQUIREMENT =
  "vNext PRDs: every ISC-N marked `[x]` in `## Criteria` has ≥1 entry in `## Verification` (RFC-0080 §2.1 / RFC-0085 R51 — close-the-loop terminal)";
const RULE_CUTOFF_ISO = "2026-05-13";
// Accept the checked box in either GFM case (`[x]` or `[X]`) via the shared class (SENT-09).
const CHECKED_ISC_RE = new RegExp(`^- \\[${CHECKBOX_CHECKED_CLASS}\\]\\s+(ISC-[A-Z]?-?\\d+(?:\\.\\d+)?)`);

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

function extractCheckedIscs(content: string): string[] {
  const m = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!m) return [];
  const out: string[] = [];
  for (const line of m[1].split("\n")) {
    const cm = line.match(CHECKED_ISC_RE);
    if (cm) out.push(cm[1]);
  }
  return out;
}

function extractVerificationBody(content: string): string {
  const m = content.match(/## Verification\n([\s\S]*?)(?=\n## |\n---|$)/);
  return m?.[1] ?? "";
}

export const R51_prd_verification_evidence: CheckHandler = async (ctx) => {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R51", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
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

    const checked = extractCheckedIscs(content);
    if (checked.length === 0) continue;

    applicable++;
    const verifyBody = extractVerificationBody(content);
    if (!verifyBody.trim()) {
      fails.push(`${prdPath}: ${checked.length} [x] ISC-N but ## Verification empty`);
      continue;
    }
    const cited = new Set([...verifyBody.matchAll(/\bISC-[A-Z]?-?\d+(?:\.\d+)?\b/g)].map(m => m[0]));
    const uncited = checked.filter(i => !cited.has(i));
    if (uncited.length > 0) {
      fails.push(`${prdPath}: ${uncited.length} checked ISC-N without Verification entries: ${uncited.slice(0, 3).join(", ")}`);
    }
  }

  if (applicable === 0) {
    return { rId: "R51", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${prds.length} PRDs; none are vNext with checked ISCs yet`] };
  }
  if (fails.length === 0) {
    return { rId: "R51", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable} applicable PRDs — every [x] ISC has Verification evidence`] };
  }
  return {
    rId: "R51",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} PRDs with un-cited completions:`, ...fails.slice(0, 5)],
  };
};

type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
