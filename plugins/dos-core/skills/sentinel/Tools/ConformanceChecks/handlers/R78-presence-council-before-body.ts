/**
 * R78 (check: presence.council-before-body) — Council BEFORE artifact phase
 * ordering, mechanized.
 *
 * Provenance:
 *   - Parent canonical: MEMORY/CANONICAL/patterns/council-before-artifact.md
 *     (§"Mechanical surface (forward-looking)") — names this R-rule explicitly.
 *   - Parent PRD: MEMORY/WORK/active/20260526-191054_reflection-upgrade-design-council/PRD.md
 *     - Decision D5 (UncleBob Council seat amendment) — "Phase Entry fail-closed
 *       via new R-rule" — landed a 5th Sentinel R-rule beyond the 4 originally
 *       scoped in Cluster A.
 *     - Decision D9 (self-validating session) — "The session is its own
 *       validation set" — establishes the contract that the rule MUST pass on
 *       the parent PRD that authorized its creation.
 *   - Design PRD: MEMORY/WORK/active/20260527-presence-council-before-body-rule/PRD.md
 *     (22 ISCs across 5 clusters; this handler implements Cluster A + B + C).
 *   - n=3 corpus activations (parent PRD Activation Ledger row 5):
 *       20260520-CrunchScaffold (44→46 ISC post-Council rewrite)
 *       20260519-Brastemp-landing (1247-line HTML post-DreamTeam rewrite)
 *       20260521-cockpit-mock-retirement (16-ISC context overflow)
 *     Meets ISC-ANTI-2 promotion threshold (≥2 corpus activations).
 *
 * Invariant:
 *   When a PRD has `effort ∈ {advanced, deep, xhigh, comprehensive}` (E3+ per
 *   Algorithm v0.0.10 §0 TierConfig) AND has `Council` in its capability set,
 *   the PRD body MUST contain a populated `## Council Verdicts` section before
 *   the body is authored beyond the thin ISC skeleton.
 *
 * Tier-threshold decision: design PRD ISC-D2 flagged the E3 vs E4 question
 * (D5 verbatim says "≥ E4" but §0 ANTI-SKIP mandates Council at "effort ≥ E3
 * AND criteria_count ≥ 16"). This handler ships at E3+ to match TierConfig's
 * §0 ANTI-SKIP semantics — the doctrinally-consistent choice. An operator who
 * wants the narrower D5-conservative E4-only interpretation can flip the
 * TRIGGER_EFFORTS set below by removing "advanced".
 *
 * Pass condition: trigger fires AND `## Council Verdicts` section is populated
 *   (≥1 non-empty content row beyond the H2 header and any table-separator
 *   noise). Empty stub (header only, `_TBD_` placeholder, table with only
 *   header+separator rows) counts as empty per design PRD ISC-A3.
 *
 * Fail condition: trigger fires AND section missing OR empty.
 *
 * Bypass paths (all return `pass` or `not_applicable`):
 *   1. Grandfather (`started` predates RULE_CUTOFF_ISO = 2026-05-26) →
 *      `not_applicable` with skip-reason "pre-rule authoring". Mirrors R46's
 *      `RULE_CUTOFF_ISO` pattern line-for-line.
 *   2. Decline-respecting: `Declined: Council[ <suffix>]` line in `## Decisions`
 *      → `pass`. Parent PRD itself uses `Declined: Council skill orchestration
 *      shell` for a legitimate decline while still applying the Council pattern
 *      via parallel Agent calls; handler MUST recognize this as pass.
 *   3. Override syntax: `Override presence.council-before-body reason: <text>`
 *      (≤32 words) in `## Decisions` → `pass` with evidence sidecar
 *      `operator-override: <reason>`. Per design PRD ISC-B3 — operator-declared
 *      bypass precedent inherited from Decline Protocol (parent §4 v0.0.8).
 *   4. Non-trigger: `effort` below E3+ OR Council not in capability set →
 *      `not_applicable`.
 *
 * Shape mirror: R17 (frontmatter parsing), R46 (RULE_CUTOFF_ISO grandfather),
 * R65 (body section extraction + return-shape conventions), R63 (Decline
 * protocol parsing).
 *
 * Tier: warning (RFC-0085 council default for new presence checks).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";

const REQUIREMENT =
  "When effort ≥ E3 (advanced/deep/xhigh/comprehensive) AND Council is in capability set, the PRD body must contain a populated `## Council Verdicts` section before body authoring proceeds";

// Grandfather cutoff per design PRD ISC-ANTI-3. Council-before-body is a
// forward-going norm ratified by parent PRD on 2026-05-26. PRDs scaffolded
// before this date could not have followed a discipline that did not yet
// exist; applying R78 retroactively would replay v0.0.5:470 advisory-failure
// mode. Mirrors R46's RULE_CUTOFF_ISO pattern (line-for-line).
//
// Cato F1 audit RESOLVED — joint PRD 20260526-210258_r46-r78-joint-timezone-fix
// extracted the comparison into `lib/grandfather.ts::isPreCutoffISO` with
// Option A (UTC-normalize) semantics, Council-ratified unanimously (D1). All
// 10 shape-mirror handlers (R44/R45/R46/R47/R48/R49/R50/R51/R63/R78) now share
// the helper — see that file for semantics, edge-cases, and unit tests.
const RULE_CUTOFF_ISO = "2026-05-26";

// Per design PRD ISC-D2 — ship at E3+ per §0 TierConfig ANTI-SKIP clause.
// E3 = "advanced", E4 = "deep", E5 = "xhigh", E6 = "comprehensive".
// Operator can downgrade to E4-only by removing "advanced" from this set.
const TRIGGER_EFFORTS: ReadonlySet<string> = new Set([
  "advanced",
  "deep",
  "xhigh",
  "comprehensive",
]);

// Override syntax per design PRD ISC-B3. Word-cap of 32 mirrors the
// concise-justification convention used in the Decline Protocol parent §4.
const OVERRIDE_LINE_RE =
  /^[-*\s]*Override\s+presence\.council-before-body\s+reason:\s*(.+)$/m;
const OVERRIDE_WORD_CAP = 32;

// Decline-respect per design PRD ISC-A5. Matches `Declined: Council` and
// variants like `Declined: Council skill orchestration shell` (parent PRD's
// own legitimate decline). Word-boundary anchored on the right so we don't
// accidentally match `Declined: Counciling` or similar.
const DECLINE_LINE_RE = /^[-*\s]*Declined:\s*Council(?:[\s,.—:;)]|$)/im;

interface Frontmatter {
  effort?: string;
  started?: string;
  phase?: string;
}

function parseFrontmatter(content: string): Frontmatter | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const read = (k: string) =>
    fm
      .match(new RegExp(`^${k}:\\s*(.+)$`, "m"))
      ?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, "");
  return {
    effort: read("effort")?.toLowerCase(),
    started: read("started"),
    phase: read("phase")?.toLowerCase(),
  };
}

function readBody(content: string): string {
  const m = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1] : content;
}

/**
 * Detect whether `Council` appears in the PRD's declared capability set.
 * Accepts several shapes observed in the corpus:
 *   - `🏹 CAPABILITIES SELECTED:` block (canonical Algorithm v0.0.10 §4 form)
 *   - `## Capabilities` / `## Capability ledger` H2 sections
 *   - `Capabilities Selected:` inline marker
 *   - Capability-ledger table row containing the token `Council` (parent
 *     PRD's `Capability ledger reconciliation` table uses this shape with
 *     `Council (Skill)` in the leftmost column)
 *
 * Returns true if `Council` (case-insensitive, whole-word) appears in any
 * of those scopes.
 */
function councilInCapabilitySet(body: string): boolean {
  // Shape 1 — explicit emoji-prefix block per Algorithm v0.0.10 §4.
  const emojiIdx = body.indexOf("🏹 CAPABILITIES SELECTED");
  if (emojiIdx >= 0) {
    const after = body.slice(emojiIdx);
    const endMatch = after.match(/\n(?:##\s|🤔)/);
    const section = endMatch ? after.slice(0, endMatch.index!) : after;
    if (/\bCouncil\b/i.test(section)) return true;
  }

  // Shape 2 — `## Capabilities` / `## Capability ledger` H2 sections, or
  // a `**Capability ledger** ...` bold marker (parent PRD shape).
  const sectionPatterns: RegExp[] = [
    /^##\s+Capabilities\b/im,
    /^##\s+Capability\s+ledger\b/im,
    /^\*\*Capability\s+ledger[^*]*\*\*/im,
    /^Capabilities\s+Selected:/im,
  ];
  for (const pat of sectionPatterns) {
    const m = body.match(pat);
    if (!m || m.index === undefined) continue;
    const after = body.slice(m.index);
    const endMatch = after.slice(m[0].length).match(/\n##\s/);
    const section = endMatch
      ? after.slice(0, m[0].length + endMatch.index!)
      : after;
    if (/\bCouncil\b/i.test(section)) return true;
  }

  return false;
}

/**
 * Determine whether the PRD has a populated `## Council Verdicts` section.
 * Per design PRD ISC-A3 a section is "populated" if it contains ≥1 non-empty
 * content row beyond the H2 header. Empty stubs that count as empty:
 *   - header only with no body
 *   - header + `_TBD_` placeholder
 *   - table with only the header row + separator row (no data rows)
 */
function councilVerdictsPopulated(body: string): boolean {
  const headerRe = /^##\s+Council\s+Verdicts\b/m;
  const m = body.match(headerRe);
  if (!m || m.index === undefined) return false;
  const after = body.slice(m.index + m[0].length);
  const endMatch = after.match(/\n##\s/);
  const section = endMatch ? after.slice(0, endMatch.index!) : after;

  // Strip blank lines, comments, and known stub markers.
  const contentLines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^_TBD_$/i.test(l))
    .filter((l) => !/^<!--/.test(l));

  if (contentLines.length === 0) return false;

  // Filter out table header + separator rows. A markdown table separator
  // matches `|---|---|...|` with optional spaces and colons.
  const dataLines = contentLines.filter((l) => {
    if (/^\|[\s|:-]+\|\s*$/.test(l)) return false; // separator row
    return true;
  });

  if (dataLines.length === 0) return false;

  // If the section is entirely a table (every line starts with `|`), we
  // need at least 2 non-separator rows: header + ≥1 data row.
  const allTableLines = dataLines.every((l) => l.startsWith("|"));
  if (allTableLines) {
    return dataLines.length >= 2;
  }

  // Otherwise any non-empty, non-stub content line counts.
  return true;
}

// Scope helper — extract `## Decisions` section slice for scoped regex matches.
// Per Cato F5 audit: override + decline syntax must NOT be honored from prose
// outside the Decisions section (e.g., Implementation Notes containing a
// quoted example of the override syntax would otherwise silently bypass).
function decisionsSection(body: string): string | null {
  const headerRe = /^##\s+Decisions\b/m;
  const m = body.match(headerRe);
  if (!m || m.index === undefined) return null;
  const after = body.slice(m.index + m[0].length);
  const endMatch = after.match(/\n##\s/);
  return endMatch ? after.slice(0, endMatch.index!) : after;
}

function findOverrideReason(body: string): string | null {
  // F5 fix: scope to ## Decisions section (mirrors hasDeclineCouncilLine).
  const section = decisionsSection(body);
  if (section === null) return null;
  const m = section.match(OVERRIDE_LINE_RE);
  if (!m) return null;
  const reason = m[1].trim();
  // Strip trailing punctuation/markdown.
  const cleaned = reason.replace(/[.,;:\s]+$/, "");
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > OVERRIDE_WORD_CAP) return null;
  return cleaned;
}

function hasDeclineCouncilLine(body: string): boolean {
  // Restrict to the `## Decisions` section per design PRD ISC-A5.
  const section = decisionsSection(body);
  if (section === null) return false;
  return DECLINE_LINE_RE.test(section);
}

function listPrdPaths(workDir: string): string[] {
  if (!existsSync(workDir)) return [];
  const out: string[] = [];
  for (const layer of ["active", "archived", ""]) {
    const base = layer ? join(workDir, layer) : workDir;
    if (!existsSync(base)) continue;
    try {
      for (const dir of readdirSync(base)) {
        const prd = join(base, dir, "PRD.md");
        try {
          if (statSync(prd).isFile()) out.push(prd);
        } catch {
          // ignore stat errors
        }
      }
    } catch {
      // ignore readdir errors
    }
  }
  return out;
}

interface PrdVerdict {
  path: string;
  status: "pass" | "fail" | "skip";
  evidence: string;
}

/**
 * Evaluate a single PRD against the R78 invariant. Exported for the
 * self-validating test (which calls into the handler with a synthetic ctx
 * pointing at a tmpdir, but also wants to evaluate the literal parent PRD
 * directly without copying it into a fixture).
 */
export function evaluatePrd(path: string, content: string): PrdVerdict {
  const fm = parseFrontmatter(content);
  if (!fm) {
    return {
      path,
      status: "skip",
      evidence: `${path}: no parseable YAML frontmatter`,
    };
  }

  // Grandfather clause — UTC-normalized via lib/grandfather.ts::isPreCutoffISO
  // (Option A, Council D1; joint PRD 20260526-210258). Shape-mirror with
  // R44/R45/R46/R47/R48/R49/R50/R51/R63.
  if (isPreCutoffISO(fm.started, RULE_CUTOFF_ISO)) {
    return {
      path,
      status: "skip",
      evidence: `${path}: pre-rule authoring (started=${fm.started} < ${RULE_CUTOFF_ISO} UTC)`,
    };
  }

  // Tier gate (design PRD ISC-A1) — only fire on E3+.
  if (!fm.effort || !TRIGGER_EFFORTS.has(fm.effort)) {
    return {
      path,
      status: "skip",
      evidence: `${path}: effort=${fm.effort ?? "(absent)"} below E3+ trigger`,
    };
  }

  const body = readBody(content);

  // Capability gate (design PRD ISC-A2) — Council must be in capability set.
  if (!councilInCapabilitySet(body)) {
    return {
      path,
      status: "skip",
      evidence: `${path}: Council not in capability set`,
    };
  }

  // Operator-override bypass (design PRD ISC-B3).
  const overrideReason = findOverrideReason(body);
  if (overrideReason !== null) {
    return {
      path,
      status: "pass",
      evidence: `${path}: operator-override: ${overrideReason}`,
    };
  }

  // Decline-respect bypass (design PRD ISC-A5).
  if (hasDeclineCouncilLine(body)) {
    return {
      path,
      status: "pass",
      evidence: `${path}: Council legitimately declined in ## Decisions`,
    };
  }

  // Core invariant (design PRD ISC-A3 + ISC-A4).
  if (councilVerdictsPopulated(body)) {
    return {
      path,
      status: "pass",
      evidence: `${path}: ## Council Verdicts populated`,
    };
  }

  return {
    path,
    status: "fail",
    evidence: `${path}: effort=${fm.effort}, Council in capability set, but ## Council Verdicts is empty or missing`,
  };
}

export async function r78PresenceCouncilBeforeBody(
  ctx: CheckContext,
): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");

  if (!existsSync(workRoot)) {
    return {
      rId: "R78",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`MEMORY/WORK/ not found under ${ctx.repoRoot}`],
    };
  }

  const prdPaths = listPrdPaths(workRoot);
  if (prdPaths.length === 0) {
    return {
      rId: "R78",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No PRD.md files found under ${workRoot}`],
    };
  }

  const fails: string[] = [];
  const passes: string[] = [];
  const skipped: string[] = [];

  for (const path of prdPaths) {
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch {
      continue;
    }
    const verdict = evaluatePrd(path, content);
    if (verdict.status === "fail") fails.push(verdict.evidence);
    else if (verdict.status === "pass") passes.push(verdict.evidence);
    else skipped.push(verdict.evidence);
  }

  const applicable = passes.length + fails.length;

  if (applicable === 0) {
    return {
      rId: "R78",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `scanned ${prdPaths.length} PRD(s); none trigger R78 (effort ≥ E3 AND Council in capability set)`,
      ],
    };
  }

  if (fails.length === 0) {
    return {
      rId: "R78",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${passes.length}/${applicable} applicable PRD(s) satisfy R78`,
        ...passes.slice(0, 5),
      ],
    };
  }

  return {
    rId: "R78",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${fails.length}/${applicable} applicable PRD(s) violate R78:`,
      ...fails.slice(0, 5),
    ],
  };
}

// Re-exports for the unit tests so they can probe internals deterministically.
export const __testing__ = {
  evaluatePrd,
  parseFrontmatter,
  councilInCapabilitySet,
  councilVerdictsPopulated,
  findOverrideReason,
  hasDeclineCouncilLine,
  RULE_CUTOFF_ISO,
  TRIGGER_EFFORTS,
};
