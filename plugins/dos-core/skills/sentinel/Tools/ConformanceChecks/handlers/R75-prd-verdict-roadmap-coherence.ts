/**
 * R75 (check: presence.prd-verdict-roadmap-coherence) — cross-document
 * coherence invariant between PRD `## Decisions` verdict blocks and
 * `Plans/Roadmaps/v*-master*.md` bucket-item disposition rows.
 *
 * Provenance: A12 of v0.0.18 kickoff council; mechanizes the manual audit
 * gate that `/code-review` caught by hand 7 times across a single 2-hour
 * council synthesis pass (PRD slug `20260525-120255_v0018-kickoff-council-bucket-b`,
 * roadmap lines 33/64/103/124/129/139/163/220 carried stale "B2 still
 * pending" copy while `## Decisions` D2 already recorded the FORK verdict).
 *
 * Council ratification (Round 2 R2-D6 — Architect Finding 5): named this
 * R-rule `R65 presence.prd-verdict-roadmap-coherence`. The check: key
 * preserves the council's verbal anchor; the R-number is bumped to R75 to
 * avoid a runtime registry collision with the existing R65
 * `prd-progress-denominator` handler that shipped 2026-05-15. Collision
 * surfaced during A12 OBSERVE (this file). The Ubiquitous-Language pin is
 * the check: key, not the integer suffix (Evans seat).
 *
 * Invariant:
 *   For every D-block in a PRD's `## Decisions` section of the form
 *     `**D<n>: <ItemId> — <VERDICT>...`
 *   where ItemId matches `[AB]\d+[a-z]?` (e.g. B1a, B2, A11, A12), there
 *   MUST exist a row in some `Plans/Roadmaps/v*-master*.md` table that
 *   names ItemId AND carries text equal to or containing VERDICT (or a
 *   recognized synonym — see VERDICT_SYNONYMS). When found, pass. When
 *   ItemId appears in a roadmap row but the row's verdict text disagrees
 *   with the PRD D-block verdict, fail with both verdicts cited.
 *
 * Parser surface (Engineer's Round 2 pins):
 *   - Verdict-block regex against `## Verdict` / `### Decision` / `## Decisions`
 *     H2/H3 blocks ONLY — NOT freeform prose.
 *   - Cross-reference against `Plans/Roadmaps/v*-master*.md` table rows.
 *   - Verdict tokens supported: FORK, MERGE, DEFER, RATIFY, ACCEPT,
 *     WITHDRAW, AMEND, REJECT (extensible via VERDICT_TOKENS).
 *
 * False-positive exclusions:
 *   (a) PRDs under `MEMORY/WORK/archived/**` — historical artifacts.
 *   (b) Roadmaps under `Plans/Roadmaps/archive/**` (case-insensitive) and
 *       RFCs under `Plans/Specs/Archive/**` — by-design stale.
 *   (c) Fenced code blocks within PRDs — literal samples, not load-bearing
 *       decisions. Stripped via stripCodeFences (R38/R63 idiom).
 *   (d) D-blocks marked `(meta)` — bookkeeping not pinned to a bucket item
 *       (e.g. `D4 (meta): No Round 2 council motion required.`).
 *
 * Ship modes (Engineer's Round 2 pin):
 *   - default: `--advisory` — handler returns `pass` with `evidence` carrying
 *     advisory diagnostics. The Sentinel runner surfaces this in the
 *     "warnings" section but does not gate.
 *   - `DOS_R75_MODE=strict` (or `--strict` via env) — handler returns `fail`
 *     when a stale verdict reference is detected. Promotes after one sprint
 *     of FP-rate measurement per the council Round 2 spec.
 *
 * Tier: warning (RFC-0085 council default for new presence checks).
 *
 * @see MEMORY/WORK/active/20260525-143318_a12-r65-prd-verdict-roadmap-coherence/PRD.md
 * @see MEMORY/WORK/active/20260525-120255_v0018-kickoff-council-bucket-b/PRD.md (R2-D6)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "PRD `## Decisions` D-block verdicts must match the bucket-item row verdict in `Plans/Roadmaps/v*-master*.md`";

// Verdict tokens recognized in `**D<n>: <ItemId> — <VERDICT>...` blocks.
// Order matters only for stable ordering of evidence lines; matching is exact.
const VERDICT_TOKENS = [
  "FORK",
  "MERGE",
  "DEFER",
  "RATIFY",
  "ACCEPT",
  "WITHDRAW",
  "AMEND",
  "REJECT",
] as const;

type VerdictToken = (typeof VERDICT_TOKENS)[number];

// Roadmap-row text that counts as a coherent reflection of each verdict.
// Empirical synonyms observed in the 2026-05-25 kickoff roadmap.
const VERDICT_SYNONYMS: Record<VerdictToken, RegExp> = {
  FORK: /\b(FORK|forked|fork the decision)\b/i,
  MERGE: /\b(MERGE|merged|merge-into)\b/i,
  DEFER: /\b(DEFER|deferred|defer to|defer-to)\b/i,
  RATIFY: /\b(RATIFY|ratified|ratify pre-split|ratify the)\b/i,
  ACCEPT: /\b(ACCEPT|accepted)\b/i,
  WITHDRAW: /\b(WITHDRAW|withdrawn|withdraw the)\b/i,
  AMEND: /\b(AMEND|amended)\b/i,
  REJECT: /\b(REJECT|rejected)\b/i,
};

// Per-line variant used when scanning the section body line-by-line.
// (Multiline D_BLOCK_RE and ITEM_ID_RE were declared during authoring but
// the line-by-line variant subsumes both — removed to satisfy strict TS.)
const D_BLOCK_LINE_RE =
  /^\*\*D(\d+)(?:\s*\(meta\))?:\s+([AB]\d+[a-z]?)\s+—\s+([A-Z][A-Z/-]+)\b/;

// Meta-decision marker — exclude from cross-reference (FP-c).
const META_MARKER_RE = /^\*\*D\d+\s*\(meta\):/;

interface VerdictRecord {
  prdPath: string;
  decisionId: string;     // e.g. "D2"
  itemId: string;         // e.g. "B2"
  verdict: VerdictToken;  // e.g. "FORK"
  line: string;           // raw opening line for evidence
}

interface RoadmapRowMatch {
  roadmapPath: string;
  lineNo: number;
  rowText: string;
  containsVerdict: boolean;
  matchedSynonym: string | null;
}

/**
 * Strip fenced code blocks from markdown content. Preserves line count so
 * line numbers in evidence remain accurate (R63 idiom — reused for R75).
 */
function stripCodeFences(body: string): string {
  const lines = body.split("\n");
  const out: string[] = new Array(lines.length);
  let inFence = false;
  let fenceMarker = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(\s*)(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[2][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        out[i] = "";
        continue;
      }
      if (inFence && marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
        out[i] = "";
        continue;
      }
    }
    out[i] = inFence ? "" : line;
  }
  return out.join("\n");
}

/**
 * Extract the body of `## Decisions` (and any peer H2 named `## Verdict` or
 * `### Decision` H3 within it). Returns "" if no such section exists.
 *
 * The section ends at the next `^## ` heading or EOF.
 */
function extractDecisionsSection(body: string): string {
  const stripped = stripCodeFences(body);
  // Primary: ## Decisions
  const headerRe = /^##\s+Decisions\b/m;
  const m = stripped.match(headerRe);
  if (!m || m.index === undefined) {
    // Fallback: ## Verdict (singular)
    const altRe = /^##\s+Verdict\b/m;
    const m2 = stripped.match(altRe);
    if (!m2 || m2.index === undefined) return "";
    return sliceUntilNextH2(stripped, m2.index + m2[0].length);
  }
  return sliceUntilNextH2(stripped, m.index + m[0].length);
}

function sliceUntilNextH2(s: string, fromIdx: number): string {
  const after = s.slice(fromIdx);
  const end = after.match(/\n##\s/);
  return end ? after.slice(0, end.index!) : after;
}

/**
 * Parse all D-blocks from a PRD's `## Decisions` section. Skips meta blocks
 * (FP exclusion (d)). Returns empty array if no decisions section.
 */
export function parseDecisionBlocks(content: string, prdPath: string): VerdictRecord[] {
  const section = extractDecisionsSection(content);
  if (!section) return [];

  const out: VerdictRecord[] = [];
  for (const raw of section.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (META_MARKER_RE.test(line)) continue; // FP-d: meta-decisions excluded
    const m = line.match(D_BLOCK_LINE_RE);
    if (!m) continue;
    const verdict = m[3] as VerdictToken;
    if (!VERDICT_TOKENS.includes(verdict)) continue;
    out.push({
      prdPath,
      decisionId: `D${m[1]}`,
      itemId: m[2],
      verdict,
      line: line.trim(),
    });
  }
  return out;
}

/**
 * Walk a directory recursively for `.md` files matching a predicate.
 * Robust to permission errors; silently skips unreadable subtrees.
 */
function walkMarkdown(root: string, accept: (path: string) => boolean): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(root, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      out.push(...walkMarkdown(full, accept));
    } else if (stat.isFile() && entry.endsWith(".md") && accept(full)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Cross-reference: scan roadmap content for rows naming itemId. Returns
 * each match with whether the row's text contains the expected verdict (or
 * a known synonym).
 */
export function findRoadmapRows(
  roadmapContent: string,
  roadmapPath: string,
  itemId: string,
  verdict: VerdictToken,
): RoadmapRowMatch[] {
  const stripped = stripCodeFences(roadmapContent);
  const lines = stripped.split("\n");
  const synonym = VERDICT_SYNONYMS[verdict];
  const matches: RoadmapRowMatch[] = [];

  // Item-id boundary in a table row context. We require ItemId to appear as
  // a token (word-boundary on both sides). Both ID-only forms ("B2") and
  // bolded/`v016-NNN`-coupled forms ("**B2 / v016-003**") are captured.
  const idTokenRe = new RegExp(`(?:^|[^A-Za-z0-9])${itemId}(?![A-Za-z0-9])`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Heuristic: only table rows count (must start with `|` after optional
    // whitespace). Header rows are tolerated since they don't carry verdicts.
    if (!/^\s*\|/.test(line)) continue;
    if (!idTokenRe.test(line)) continue;

    // Empirical FP guard: a table row that is itself a parent/section
    // template (e.g. "| Order | Item | Cascade | Effort |") has no verdict
    // text. Skip lines that look like a header separator (---).
    if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue;

    let containsVerdict = false;
    let matchedSynonym: string | null = null;
    const synMatch = line.match(synonym);
    if (synMatch) {
      containsVerdict = true;
      matchedSynonym = synMatch[0];
    }

    matches.push({
      roadmapPath,
      lineNo: i + 1,
      rowText: line.trim().slice(0, 240),
      containsVerdict,
      matchedSynonym,
    });
  }
  return matches;
}

/**
 * Determine PRD scope per FP exclusion (a): skip MEMORY/WORK/archived/**
 * but keep MEMORY/WORK/{flat}/** and MEMORY/WORK/active/**.
 */
function isPrdInScope(path: string): boolean {
  // Reject archived layer.
  if (/[\\/]MEMORY[\\/]WORK[\\/]archived[\\/]/.test(path)) return false;
  // Reject fixtures dir if present (test fixtures must not be conformance-checked).
  if (/[\\/]__fixtures__[\\/]/.test(path)) return false;
  return true;
}

/**
 * Determine roadmap scope per FP exclusion (b): skip archived roadmap
 * directories (case-insensitive). The repo currently has none, but defend
 * against the obvious future path.
 */
function isRoadmapInScope(path: string): boolean {
  return !/[\\/]archive[\\/]/i.test(path);
}

function collectPrds(workRoot: string): string[] {
  if (!existsSync(workRoot)) return [];
  return walkMarkdown(workRoot, (p) => isPrdInScope(p) && p.endsWith("PRD.md"));
}

function collectMasterRoadmaps(roadmapsRoot: string): string[] {
  if (!existsSync(roadmapsRoot)) return [];
  // Master-pattern: v*-master*.md at any depth under Plans/Roadmaps/, not
  // under any archive/ subdir.
  return walkMarkdown(roadmapsRoot, (p) =>
    isRoadmapInScope(p) && /v[0-9.]+-master[^/\\]*\.md$/.test(p),
  );
}

function resolveMode(): "advisory" | "strict" {
  const env = process.env.DOS_R75_MODE;
  if (env === "strict") return "strict";
  // Tolerant aliases for shipping-day misspells.
  if (env && /^(s|S)trict$/.test(env)) return "strict";
  return "advisory";
}

export async function r75PrdVerdictRoadmapCoherence(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  const roadmapsRoot = join(ctx.repoRoot, "Plans", "Roadmaps");
  const mode = resolveMode();

  const prds = collectPrds(workRoot);
  if (prds.length === 0) {
    return {
      rId: "R75",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No in-scope PRDs found under ${workRoot} (mode=${mode})`],
    };
  }

  const roadmaps = collectMasterRoadmaps(roadmapsRoot);
  if (roadmaps.length === 0) {
    return {
      rId: "R75",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No master roadmaps found under ${roadmapsRoot} (mode=${mode})`],
    };
  }

  // Cache roadmap contents (small N — typically 1-3 master roadmaps).
  const roadmapContents = new Map<string, string>();
  for (const path of roadmaps) {
    try {
      roadmapContents.set(path, readFileSync(path, "utf-8"));
    } catch {
      // Skip unreadable roadmaps; they cannot be a source of truth.
    }
  }

  const allViolations: string[] = [];
  let totalDecisions = 0;
  let coherentDecisions = 0;

  for (const prdPath of prds) {
    let content: string;
    try {
      content = readFileSync(prdPath, "utf-8");
    } catch {
      continue;
    }

    const records = parseDecisionBlocks(content, prdPath);
    if (records.length === 0) continue;

    for (const rec of records) {
      totalDecisions++;

      // Gather all roadmap rows naming this item.
      let foundCoherent = false;
      const staleRows: string[] = [];
      let totalRoadmapRows = 0;
      for (const [rmPath, rmContent] of roadmapContents) {
        const matches = findRoadmapRows(rmContent, rmPath, rec.itemId, rec.verdict);
        totalRoadmapRows += matches.length;
        for (const m of matches) {
          if (m.containsVerdict) {
            foundCoherent = true;
          } else {
            staleRows.push(`${m.roadmapPath}:${m.lineNo} — ${m.rowText}`);
          }
        }
      }

      // If the item is NEVER mentioned in any roadmap, that's a separate
      // class of issue (orphan PRD decision). Surface as advisory only —
      // not every PRD decision is roadmap-tracked (e.g. internal-only
      // research PRDs). FP exclusion: silent.
      if (totalRoadmapRows === 0) continue;

      if (foundCoherent && staleRows.length === 0) {
        coherentDecisions++;
        continue;
      }

      // At least one roadmap row names this item but lacks the verdict.
      // That is the coherence violation we mechanize.
      if (foundCoherent && staleRows.length > 0) {
        // Mixed: some rows agree, others stale. Still a violation.
        allViolations.push(
          `${rec.prdPath}: ${rec.decisionId} ${rec.itemId} verdict=${rec.verdict} — ${staleRows.length} stale roadmap row(s):`,
        );
        for (const r of staleRows.slice(0, 3)) allViolations.push(`    ${r}`);
        continue;
      }
      if (!foundCoherent && staleRows.length > 0) {
        // No coherent row, only stale ones. Highest-confidence drift.
        allViolations.push(
          `${rec.prdPath}: ${rec.decisionId} ${rec.itemId} verdict=${rec.verdict} — 0 coherent roadmap row(s), ${staleRows.length} stale:`,
        );
        for (const r of staleRows.slice(0, 3)) allViolations.push(`    ${r}`);
      }
    }
  }

  if (totalDecisions === 0) {
    return {
      rId: "R75",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Scanned ${prds.length} PRD(s); no \`## Decisions\` D-blocks found (mode=${mode})`],
    };
  }

  const baseEvidence = [
    `mode=${mode}; ${coherentDecisions}/${totalDecisions} D-block(s) coherent with roadmap; ${allViolations.length === 0 ? "no" : allViolations.length} violation(s)`,
  ];

  if (allViolations.length === 0) {
    return {
      rId: "R75",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: baseEvidence,
    };
  }

  // Advisory mode: surface diagnostics but do NOT fail. Per council Round 2
  // R2-D6 — one sprint of FP-rate measurement before promotion.
  if (mode === "advisory") {
    return {
      rId: "R75",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        ...baseEvidence,
        "advisory diagnostics (set DOS_R75_MODE=strict to fail on these):",
        ...allViolations.slice(0, 20),
      ],
    };
  }

  // Strict mode: fail.
  return {
    rId: "R75",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [...baseEvidence, ...allViolations.slice(0, 20)],
  };
}

// Re-exports for unit tests pinning parser internals.
export const __testing__ = {
  parseDecisionBlocks,
  findRoadmapRows,
  stripCodeFences,
  extractDecisionsSection,
  resolveMode,
  VERDICT_TOKENS,
  VERDICT_SYNONYMS,
};
