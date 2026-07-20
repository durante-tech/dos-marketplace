/**
 * R45 (RFC-0080 §2.1 / RFC-0085 council-2026-05-12) — vNext PRDs: every
 * `ISC-A-N` anti-criterion must be derivable from a corresponding
 * `## Out of Scope` bullet.
 *
 * Background: Council 2026-05-12 ratified the AC ⊂ OoS subset relation —
 * anti-criteria are the testable subset of the `## Out of Scope` scoping
 * fence. Every ISC-A must trace back to an Out of Scope bullet (loosely:
 * keyword overlap, or explicit cross-reference). R45 enforces.
 *
 * Applicability: PRD frontmatter has `format_version: 3` AND `## Out of Scope`
 * section is present AND any `ISC-A-N` criteria are declared.
 *
 * Pass condition: every ISC-A-N description shares ≥1 substantive word with
 * at least one `## Out of Scope` bullet (case-insensitive, stopwords filtered).
 *
 * Fail condition: ≥1 ISC-A-N has zero word-overlap with any OoS bullet.
 *
 * Note: this is a HEURISTIC derivability check — operators can explicit-link
 * via parenthetical `(see ## Out of Scope: <bullet>)` for unambiguous binding.
 * R45 is warning-tier per RFC-0085.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";
import { CHECKBOX_STATE_CLASS } from "../lib/prd-doctrine.ts";

const REQUIREMENT =
  "vNext PRDs: every `ISC-A-N` anti-criterion must be derivable from a `## Out of Scope` bullet per RFC-0080 §2.1 (AC ⊂ OoS)";
// Any checkbox state, GFM case-insensitive (`[ ]`/`[x]`/`[X]`) via shared class (SENT-09).
const ANTI_CRITERION_RE = new RegExp(`^- \\[${CHECKBOX_STATE_CLASS}\\]\\s+(ISC-A[\\w-]*):\\s*(.+)$`);
const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with","by","from","as","is","are","be","not","no",
  "this","that","these","those","it","its","do","does","did","must","should","will","can","may","might","also",
]);
const RULE_CUTOFF_ISO = "2026-05-12";

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

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length >= 3 && !STOPWORDS.has(t))
  );
}

function extractOoSBullets(content: string): string[] {
  const m = content.match(/## Out of Scope\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!m) return [];
  return m[1].split("\n").filter(l => /^[-*]\s+/.test(l)).map(l => l.replace(/^[-*]\s+/, ""));
}

function extractAntiCriteria(content: string): { id: string; desc: string }[] {
  const m = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!m) return [];
  const out: { id: string; desc: string }[] = [];
  for (const line of m[1].split("\n")) {
    const cm = line.match(ANTI_CRITERION_RE);
    if (cm) out.push({ id: cm[1], desc: cm[2] });
  }
  return out;
}

export const R45_ac_derivable_from_oos: CheckHandler = async (ctx) => {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R45", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
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

    const oosBullets = extractOoSBullets(content);
    const antis = extractAntiCriteria(content);
    if (oosBullets.length === 0 || antis.length === 0) continue;

    applicable++;
    const oosTokens = new Set<string>();
    for (const b of oosBullets) for (const t of tokenize(b)) oosTokens.add(t);

    for (const anti of antis) {
      const antiTokens = tokenize(anti.desc);
      const overlap = [...antiTokens].some(t => oosTokens.has(t));
      if (!overlap) {
        fails.push(`${prdPath}: ${anti.id} has no word-overlap with any ## Out of Scope bullet`);
      }
    }
  }

  if (applicable === 0) {
    return { rId: "R45", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${prds.length} PRDs; none have both ## Out of Scope and ISC-A-N declared yet`] };
  }
  if (fails.length === 0) {
    return { rId: "R45", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable} applicable PRDs — all anti-criteria derivable from ## Out of Scope`] };
  }
  return {
    rId: "R45",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} anti-criteria without OoS derivation across ${applicable} PRDs:`, ...fails.slice(0, 5)],
  };
};

type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
