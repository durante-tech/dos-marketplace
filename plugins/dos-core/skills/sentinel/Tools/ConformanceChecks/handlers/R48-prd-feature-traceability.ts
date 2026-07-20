/**
 * R48 (RFC-0085 §2 — V12.6-β) — vNext PRDs: bidirectional traceability between
 * `## Features` entries and `## Criteria` ISC-N rows.
 *
 * Background: vNext §3 (RFC-0080 §3) introduced the `## Features` section
 * to express feature slices. Each `Feature-N` row carries the user-facing
 * description; the verifiable claims live in `## Criteria` as `ISC-N`. The
 * bidirectional invariant: every Feature-N references ≥1 ISC-N AND every
 * referenced ISC-N exists in `## Criteria`.
 *
 * Applicability: PRD frontmatter has `format_version: 3` AND `## Features`
 * section is populated.
 *
 * Pass condition: every Feature-N has ≥1 ISC-N reference in its body lines
 * AND every referenced ISC-N matches an existing `## Criteria` row.
 *
 * Fail condition: orphan Feature-N (no ISC-N reference) OR orphan ISC-ref
 * (Feature points to a non-existent ISC-N).
 *
 * Cutoff: PRDs whose `started` predates 2026-05-13 are skipped silently.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";

const REQUIREMENT =
  "vNext PRDs: every `Feature-N` in `## Features` references ≥1 ISC-N; every referenced ISC-N exists in `## Criteria` (RFC-0080 §3 / RFC-0085 R48)";
const RULE_CUTOFF_ISO = "2026-05-13";

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

function extractIscIds(content: string): Set<string> {
  const out = new Set<string>();
  const m = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!m) return out;
  for (const line of m[1].split("\n")) {
    const cm = line.match(/^- \[[ x]\]\s+(ISC-[A-Z]?-?\d+(?:\.\d+)?)/);
    if (cm) out.add(cm[1]);
  }
  return out;
}

function extractFeatureBlocks(content: string): { id: string; body: string }[] {
  const m = content.match(/## Features\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!m) return [];
  const out: { id: string; body: string }[] = [];
  const blocks = m[1].split(/(?=^###?\s+Feature-\d+\b|^- \[[ x]\]\s+Feature-\d+\b)/m);
  for (const block of blocks) {
    const idMatch = block.match(/Feature-(\d+)/);
    if (idMatch) out.push({ id: `Feature-${idMatch[1]}`, body: block });
  }
  return out;
}

export const R48_prd_feature_traceability: CheckHandler = async (ctx) => {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R48", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
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

    const features = extractFeatureBlocks(content);
    if (features.length === 0) continue;

    applicable++;
    const knownIscs = extractIscIds(content);
    for (const f of features) {
      const refs = [...f.body.matchAll(/\bISC-[A-Z]?-?\d+(?:\.\d+)?\b/g)].map(m => m[0]);
      if (refs.length === 0) {
        fails.push(`${prdPath}: ${f.id} has zero ISC-N references in body`);
        continue;
      }
      for (const ref of refs) {
        if (!knownIscs.has(ref)) {
          fails.push(`${prdPath}: ${f.id} references ${ref} but no such ISC in ## Criteria`);
        }
      }
    }
  }

  if (applicable === 0) {
    return { rId: "R48", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${prds.length} PRDs; none are vNext + have ## Features populated yet`] };
  }
  if (fails.length === 0) {
    return { rId: "R48", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable} applicable PRDs — all Feature/ISC traceability intact`] };
  }
  return {
    rId: "R48",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} traceability gaps across ${applicable} PRDs:`, ...fails.slice(0, 5)],
  };
};

type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
