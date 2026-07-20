/**
 * R50 (RFC-0085 §2 — V12.6-β) — vNext PRDs: when `## Decisions` (or legacy
 * `## Changelog`) carries learning-loop entries, those entries SHOULD follow
 * the C/R/L Learning Format from v0.0.8 §6.7.
 *
 * Background: Algorithm v0.0.8 §6.7 LEARN phase formalized the conjectured /
 * refuted_by / learned / criterion_now four-line format for reflection
 * entries. R50 mechanizes the discipline at PRD-scan time. Free-form prose
 * entries are flagged as non-canonical (warning tier), not blocked.
 *
 * Applicability: PRD frontmatter has `format_version: 3` AND ## Decisions or
 * ## Changelog section is populated AND ≥1 entry has a leading "YYYY-MM-DD"
 * date (indicating a learning-shaped entry).
 *
 * Pass condition: every dated entry includes the four CRL keywords
 * (conjectured/refuted_by/learned/criterion_now) within ~6 following lines.
 *
 * Fail (warning) condition: ≥1 dated entry missing CRL keywords.
 *
 * Cutoff: PRDs whose `started` predates 2026-05-13 are skipped silently.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";

const REQUIREMENT =
  "vNext PRDs: dated entries in `## Decisions`/`## Changelog` follow C/R/L Learning Format per Algorithm v0.0.8 §6.7 (RFC-0085 R50, warning tier)";
const RULE_CUTOFF_ISO = "2026-05-13";
const DATE_LINE = /^(?:- )?(\d{4}-\d{2}-\d{2})\b/;
const CRL_KEYS = ["conjectured", "refuted_by", "learned", "criterion_now"];

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

function extractSection(content: string, header: string): string {
  const re = new RegExp(`## ${header}\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`);
  const m = content.match(re);
  return m?.[1] ?? "";
}

export const R50_prd_changelog_format: CheckHandler = async (ctx) => {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R50", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
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

    const body = extractSection(content, "Decisions") || extractSection(content, "Changelog");
    if (!body.trim()) continue;

    const lines = body.split("\n");
    const datedIdxs: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (DATE_LINE.test(lines[i])) datedIdxs.push(i);
    }
    if (datedIdxs.length === 0) continue;

    applicable++;
    for (const idx of datedIdxs) {
      const window = lines.slice(idx, Math.min(idx + 6, lines.length)).join(" ").toLowerCase();
      const missing = CRL_KEYS.filter(k => !window.includes(k));
      if (missing.length > 0) {
        fails.push(`${prdPath}: dated entry at "${lines[idx].trim().slice(0, 50)}" missing CRL keys: ${missing.join(",")}`);
      }
    }
  }

  if (applicable === 0) {
    return { rId: "R50", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${prds.length} PRDs; none are vNext with dated Decisions/Changelog entries yet`] };
  }
  if (fails.length === 0) {
    return { rId: "R50", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable} applicable PRDs — all dated entries follow CRL format`] };
  }
  return {
    rId: "R50",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} non-CRL dated entries across ${applicable} PRDs (warning):`, ...fails.slice(0, 5)],
  };
};

type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
