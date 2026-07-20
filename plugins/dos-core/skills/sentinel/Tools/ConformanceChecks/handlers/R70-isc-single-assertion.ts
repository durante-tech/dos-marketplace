/**
 * R70 — Every PRD ISC body MUST be a single atomic assertion.
 *
 * Fires (warning) when any ISC line in a PRD body contains a scope-word
 * suggesting hidden enumeration: `and` / `plus` / `as well as` / `all` /
 * `every` / `comprehensive` / `each` / `including`. Per Algorithm v0.0.10
 * §3.1 Splitting Test, these words flag a fat criterion that bundles
 * multiple atomic items.
 *
 * The exception protocol (Metz, council 2026-05-17): an ISC MAY contain a
 * scope-word if the SAME line OR the line immediately above contains the
 * literal token `pairing-exception:` followed by ≤32 words of justification.
 *
 * Empirical justification: prd-projector baseline 2026-05-17 found 533 fat
 * criteria across 111 of 200 scanned PRDs (55.5%) — making this the most
 * widespread doctrine violation in the corpus. Splitting Test exists in
 * doctrine §3.1 but was being ignored at scale. R70 mechanizes enforcement.
 *
 * Scope:
 *   - Scans MEMORY/WORK/**\/PRD.md (legacy flat layout)
 *   - Scans MEMORY/WORK/active/**\/PRD.md
 *   - Scans MEMORY/WORK/archived/**\/PRD.md
 *   - Caller chooses repoRoot.
 *
 * Algorithm:
 *   1. Walk MEMORY/WORK/ for PRD.md files.
 *   2. For each PRD, extract body (post-frontmatter).
 *   3. For each line matching /^- \[[ x]\] ISC-/ : strip prefix
 *      ("- [x] ISC-N:"), check remaining body against scope-word regex.
 *   4. If scope-word found AND no `pairing-exception:` token in same/prior
 *      line → record finding.
 *
 * Status:
 *   - pass: every ISC body is atomic OR has an explicit pairing exception
 *   - fail: at least one ISC contains scope-word without exception; evidence
 *     lists `<path>:<lineno> <scope-word> <truncated body>`
 *   - not_applicable: MEMORY/WORK/ absent OR no PRDs found
 *
 * Tier: warning (RFC-0085 council default for new presence checks; flip to
 * block after 14-day soak per RFC-0085 §4.2 rollout convention).
 *
 * References:
 *   - Algorithm v0.0.10 §3.1 (Splitting Test) + §3.3 (PLAN-time recheck)
 *   - Council 2026-05-17 — Metz seat verdict + §1.4 baseline data
 *   - MEMORY/RESEARCH/2026-05/prd-projector-baseline-2026-05-17.md
 *   - Plans/Specs/RFC-0108-prd-ecosystem-context-map.md §4 (Ubiquitous Language: ISC = atomic by definition)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { CHECKBOX_STATE_CLASS } from "../lib/prd-doctrine.ts";

const REQUIREMENT =
  "Every PRD ISC body MUST be a single atomic assertion (Splitting Test §3.1); scope-words `and|plus|as well as|all|every|comprehensive|each|including` require pairing-exception justification";

// Any checkbox state, GFM case-insensitive (`[ ]`/`[x]`/`[X]`) via shared class (SENT-09).
const ISC_LINE_RE = new RegExp(`^- \\[${CHECKBOX_STATE_CLASS}\\] ISC[-_]([\\w-]+):\\s*(.*)$`);
const SCOPE_WORD_RE = /\b(and|plus|as well as|all|every|comprehensive|each|including)\b/i;
const PAIRING_EXCEPTION_RE = /pairing-exception:/i;

interface Finding {
  path: string;
  line: number;
  iscId: string;
  scopeWord: string;
  bodyExcerpt: string;
}

function readBody(content: string): string {
  const m = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1] : content;
}

function walkPrds(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (entry === "node_modules" || entry === ".git") continue;
        walk(full);
      } else if (entry === "PRD.md") {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

function scanPrd(path: string): Finding[] {
  const content = readFileSync(path, "utf8");
  const body = readBody(content);
  const lines = body.split("\n");
  const findings: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(ISC_LINE_RE);
    if (!m) continue;
    const iscId = m[1];
    const iscBody = m[2];
    const scopeMatch = iscBody.match(SCOPE_WORD_RE);
    if (!scopeMatch) continue;
    // Check this line or the line above for pairing-exception
    const priorLine = i > 0 ? lines[i - 1] : "";
    if (PAIRING_EXCEPTION_RE.test(line) || PAIRING_EXCEPTION_RE.test(priorLine)) continue;
    findings.push({
      path,
      line: i + 1,
      iscId,
      scopeWord: scopeMatch[1],
      bodyExcerpt: iscBody.slice(0, 80),
    });
  }
  return findings;
}

export async function r70IscSingleAssertion(ctx: CheckContext): Promise<CheckResult> {
  const rId = "R70";
  const workRoots: string[] = [];
  for (const sub of ["MEMORY/WORK", "MEMORY/WORK/active", "MEMORY/WORK/archived"]) {
    const candidate = join(ctx.repoRoot, sub);
    if (existsSync(candidate)) workRoots.push(candidate);
  }
  if (workRoots.length === 0) {
    return {
      rId,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["MEMORY/WORK directory not present in repoRoot"],
    };
  }
  const allPrds = new Set<string>();
  for (const root of workRoots) {
    for (const prd of walkPrds(root)) allPrds.add(prd);
  }
  if (allPrds.size === 0) {
    return {
      rId,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["no PRD.md files found under MEMORY/WORK"],
    };
  }
  const allFindings: Finding[] = [];
  for (const prd of allPrds) {
    allFindings.push(...scanPrd(prd));
  }
  if (allFindings.length === 0) {
    return {
      rId,
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`scanned ${allPrds.size} PRDs, 0 fat criteria found`],
    };
  }
  const evidence = allFindings
    .slice(0, 20)
    .map((f) => `${f.path}:${f.line} ISC-${f.iscId} scope-word=${f.scopeWord} body="${f.bodyExcerpt}"`);
  if (allFindings.length > 20) {
    evidence.push(`... and ${allFindings.length - 20} more (total ${allFindings.length} fat criteria across ${allPrds.size} PRDs)`);
  }
  return {
    rId,
    requirement: REQUIREMENT,
    status: "fail",
    evidence,
  };
}
