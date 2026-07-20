// @durante/prd/Doctrine — the single canonical PRD-completeness contract.
//
// The prd pack owns PRDFORMAT.md (Conway's Law), so it owns the validity rules.
// Every other surface — Sentinel R17/R18/R38/R44/R45/R46/R65, PRDLint, the two
// PRD hooks — imports these predicates instead of re-deriving them. Doctrine
// imports ZERO consumer symbols (no consumer→owner cycle): it depends only on
// the Parser primitives in this same package.
//
// Why this module exists (PG1, dogfood-proven): the CheckCompleteness workflow
// graded only 4 of 13 completeness gates and emitted a FALSE-COMPLETE — it never
// checked the progress-denominator parity (R65), the ISC count-floor (R18), or
// the four required Algorithm sections. The exact denominator bug shipped in
// campaign firing #3 (`progress: 0/66` against 67 ISC, caught only by a manual
// grep). `checkCompleteness()` runs all 13 gates so a ✅ COMPLETE verdict means
// every downstream gate will also pass — computed, never asserted.

import { parsePRDContent, parseFrontmatter } from "../Parser/index.ts";
import type { Frontmatter } from "../Parser/types.ts";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

export const DOCTRINE_VERSION = "1.0.0" as const;

/** vNext PRD required frontmatter base fields (Algorithm §2.2 / RFC-0080 / R17). */
export const REQUIRED_FIELDS = [
  "task",
  "slug",
  "effort",
  "phase",
  "progress",
  "mode",
  "started",
  "updated",
] as const;

/** TierConfig ISC floors keyed by vNext effort name (Algorithm §0 / R18). */
export const TIER_FLOORS: Readonly<Record<string, number>> = {
  standard: 8,
  extended: 16,
  advanced: 24,
  deep: 40,
  xhigh: 50,
  comprehensive: 64,
};

/** Effort ordering for "min effort" gating of the Algorithm sections. */
const EFFORT_RANK: Readonly<Record<string, number>> = {
  standard: 1,
  extended: 2,
  advanced: 3,
  deep: 4,
  xhigh: 5,
  comprehensive: 6,
};

/**
 * The four required Algorithm-mode sections (ISC-24 — ONE table read by the
 * CheckCompleteness runner, the prd-section-presence hook, and Sentinel R38).
 * `minEffort` is the tier at/above which the section is REQUIRED; below it the
 * gate is not_applicable.
 */
export interface AlgorithmSectionRule {
  id: string;
  label: string;
  marker: RegExp;
  minEffort: keyof typeof EFFORT_RANK;
  authority: string;
}
export const ALGORITHM_SECTION_RULES: readonly AlgorithmSectionRule[] = [
  { id: "G10", label: "📊 BRIEF INTEGRITY", marker: /📊\s*BRIEF INTEGRITY/, minEffort: "standard", authority: "prd-section-presence.hook" },
  { id: "G11", label: "📐 PARALLELISM", marker: /📐\s*PARALLELISM/, minEffort: "advanced", authority: "prd-section-presence.hook" },
  { id: "G12", label: "📚 MEMORY HEALTH", marker: /📚\s*MEMORY HEALTH/, minEffort: "deep", authority: "Sentinel R38" },
  { id: "G13", label: "### Schema Pre-Flight", marker: /###\s*Schema Pre-Flight/, minEffort: "standard", authority: "prd-section-presence.hook" },
];

/** The ONE canonical ISC checkbox line regex (ISC-8). `- [ ] ISC-N:` / `- [x] ISC-N:`. */
export const ISC_LINE_RE = /^\s*-\s*\[[ xX]\]\s*ISC-/gm;

/** The ONE canonical ISC counter — count of vNext criteria checkbox lines. */
export function countIscLines(body: string): number {
  return (body.match(ISC_LINE_RE) ?? []).length;
}

/** R18 ISC-floor cutoff — PRDs scaffolded before this predate the mechanized floor. */
export const ISC_FLOOR_CUTOFF_MS = new Date("2026-05-05T00:00:00Z").getTime();
const SLUG_TS_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/;

/** Parse the leading `YYYYMMDD-HHMMSS_` slug timestamp (ms) from a path or slug. */
export function prdSlugMs(prdPathOrSlug: string): number | null {
  const dir = prdPathOrSlug.includes("/") ? prdPathOrSlug.split("/").slice(-2, -1)[0] ?? "" : prdPathOrSlug;
  const m = SLUG_TS_RE.exec(dir);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** True when a PRD predates the ISC-floor cutoff (exempt from the count gate). */
export function isPreIscFloorCutoff(prdPathOrSlug: string): boolean {
  const ms = prdSlugMs(prdPathOrSlug);
  return ms !== null && ms < ISC_FLOOR_CUTOFF_MS;
}

/**
 * Enumerate PRD.md paths under a MEMORY/WORK root — recursing the RFC-0037
 * active/ + archived/ buckets AND the legacy flat layout, deduped (ISC-9).
 */
export function listPrdPaths(workRoot: string): string[] {
  if (!existsSync(workRoot)) return [];
  const seen = new Set<string>();
  for (const layer of ["active", "archived", ""]) {
    const base = layer ? join(workRoot, layer) : workRoot;
    if (!existsSync(base)) continue;
    let entries: string[];
    try {
      entries = readdirSync(base);
    } catch {
      continue;
    }
    for (const dir of entries.sort()) {
      const prd = join(base, dir, "PRD.md");
      try {
        if (statSync(prd).isFile()) seen.add(prd);
      } catch {
        /* not a PRD dir */
      }
    }
  }
  return [...seen];
}

// ── Findings model ──────────────────────────────────────────────────────────

export type GateStatus = "pass" | "fail" | "not_applicable" | "inconclusive";
export interface GateFinding {
  id: string;
  rule: string;
  severity: "block" | "warn";
  status: GateStatus;
  evidence: string;
  fix?: string;
  authority?: string;
}

export type Verdict = "COMPLETE" | "INCOMPLETE" | "PARTIAL-CHECK";
export interface CompletenessReport {
  verdict: Verdict;
  contract: string;
  gatesTotal: number;
  gatesEvaluated: number;
  pass: number;
  fail: number;
  inconclusive: number;
  na: number;
  findings: GateFinding[];
}

function scalar(fm: Frontmatter, key: string): string | undefined {
  const v = fm[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Section heading present anywhere in the raw body (literal `## Heading`). */
function hasHeading(raw: string, heading: string): boolean {
  return new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(raw);
}

// ── The 13 gate predicates (each pure: doc → GateFinding) ────────────────────

/** G1 — format_version: 3 (vNext). */
export function gateFormatVersion(fm: Frontmatter): GateFinding {
  const fv = scalar(fm, "format_version");
  return {
    id: "G1", rule: "format-version", severity: "block",
    status: fv === "3" ? "pass" : "fail",
    evidence: `format_version=${fv ?? "(absent)"} expected 3`,
    fix: "add `format_version: 3` to frontmatter",
    authority: "Parser dual-mode dispatch",
  };
}

/** G2 — all 8 required vNext frontmatter fields present (R17). */
export function gateRequiredFields(fm: Frontmatter): GateFinding {
  const missing = REQUIRED_FIELDS.filter((f) => {
    const v = scalar(fm, f);
    return v === undefined || v === "";
  });
  return {
    id: "G2", rule: "required-frontmatter", severity: "block",
    status: missing.length === 0 ? "pass" : "fail",
    evidence: missing.length ? `missing: ${missing.join(", ")}` : "all 8 present",
    fix: missing.length ? `add: ${missing.join(", ")}` : undefined,
    authority: "Sentinel R17",
  };
}

/** G3 — parent_rfc present at effort >= standard (R44). */
export function gateParentRfc(fm: Frontmatter): GateFinding {
  const effort = (scalar(fm, "effort") ?? "").toLowerCase();
  const applicable = effort in TIER_FLOORS;
  const parent = scalar(fm, "parent_rfc");
  if (!applicable) {
    return { id: "G3", rule: "parent-rfc", severity: "warn", status: "not_applicable", evidence: `effort '${effort}' below standard`, authority: "Sentinel R44" };
  }
  return {
    id: "G3", rule: "parent-rfc", severity: "warn",
    status: parent && parent.length > 0 ? "pass" : "fail",
    evidence: parent ? `parent_rfc=${parent}` : "parent_rfc absent",
    fix: "set `parent_rfc:` (use `none` + 🪶 ORPHAN STRATEGIC INTENT for orphans)",
    authority: "Sentinel R44",
  };
}

/** G4 — anti-criteria present and OoS section present (R45 derivability proxy). */
export function gateAcSubsetOos(raw: string, antiCount: number): GateFinding {
  const hasOos = hasHeading(raw, "Out of Scope");
  const ok = antiCount === 0 || hasOos;
  return {
    id: "G4", rule: "ac-derivable-from-oos", severity: "warn",
    status: ok ? "pass" : "fail",
    evidence: ok ? `${antiCount} anti-criteria with Out of Scope` : `${antiCount} anti-criteria but no ## Out of Scope`,
    fix: "every anti-criterion must trace to an Out of Scope bullet",
    authority: "Sentinel R45",
  };
}

/** G5 — anti-criteria use the ISC-A-N form (R46). */
export function gateAntiCriteriaForm(antiIds: string[]): GateFinding {
  const bad = antiIds.filter((id) => !/^ISC-A-?\d+/i.test(id));
  return {
    id: "G5", rule: "anti-criteria-form", severity: "warn",
    status: antiIds.length === 0 ? "not_applicable" : bad.length === 0 ? "pass" : "fail",
    evidence: antiIds.length === 0 ? "no anti-criteria" : bad.length ? `non-ISC-A ids: ${bad.slice(0, 3).join(", ")}` : `${antiIds.length} well-formed`,
    fix: "anti-criteria must use the `ISC-A-N` id prefix",
    authority: "Sentinel R46",
  };
}

/** G6 — section order matches the vNext order. */
export function gateSectionOrder(raw: string): GateFinding {
  // Lightweight: Problem precedes Criteria precedes Verification when present.
  const idx = (h: string) => raw.search(new RegExp(`^##\\s+${h}\\b`, "m"));
  const problem = idx("Problem");
  const criteria = idx("Criteria");
  const verification = idx("Verification");
  const ordered =
    (problem === -1 || criteria === -1 || problem < criteria) &&
    (criteria === -1 || verification === -1 || criteria < verification);
  return {
    id: "G6", rule: "section-order", severity: "warn",
    status: ordered ? "pass" : "fail",
    evidence: ordered ? "Problem < Criteria < Verification" : "section order violates vNext sequence",
    fix: "reorder sections to the vNext order (Problem … Criteria … Verification)",
    authority: "Sentinel R-section-order",
  };
}

/** G7 — progress field has X/Y shape. */
export function gateProgressFormat(fm: Frontmatter): GateFinding {
  const p = scalar(fm, "progress") ?? "";
  const ok = /^\d+\/\d+$/.test(p);
  return {
    id: "G7", rule: "progress-format", severity: "block",
    status: ok ? "pass" : "fail",
    evidence: ok ? `progress=${p}` : `progress=${p || "(absent)"} expected N/M`,
    fix: "set `progress: <done>/<total>`",
    authority: "Sentinel R17 (progress shape)",
  };
}

/** G8 — progress DENOMINATOR == live ISC checkbox count (R65). THE dogfood gate. */
export function gateProgressDenominator(fm: Frontmatter, iscCount: number, phase: string): GateFinding {
  const p = scalar(fm, "progress") ?? "";
  const m = /^(\d+)\/(\d+)$/.exec(p);
  // Observe-phase no-op: ISCs may not be authored yet (ISC-6).
  if (phase === "observe") {
    return { id: "G8", rule: "progress-denominator", severity: "block", status: "not_applicable", evidence: "phase:observe — denominator binds once ISC exist", authority: "Sentinel R65" };
  }
  if (!m) {
    return { id: "G8", rule: "progress-denominator", severity: "block", status: "inconclusive", evidence: `progress=${p || "(absent)"} not N/M — cannot compare`, fix: "fix progress to N/M first (G7)", authority: "Sentinel R65" };
  }
  const denom = Number(m[2]);
  const ok = denom === iscCount;
  return {
    id: "G8", rule: "progress-denominator", severity: "block",
    status: ok ? "pass" : "fail",
    evidence: ok ? `denominator ${denom} == ${iscCount} ISC` : `denominator ${denom} != ${iscCount} live ISC checkboxes`,
    fix: `set progress denominator to ${iscCount}`,
    authority: "Sentinel R65",
  };
}

/** G9 — total ISC count >= effort-tier floor (R18). */
export function gateIscFloor(fm: Frontmatter, iscCount: number, phase: string, slug: string): GateFinding {
  const effort = (scalar(fm, "effort") ?? "").toLowerCase();
  const floor = TIER_FLOORS[effort];
  if (phase === "observe") {
    return { id: "G9", rule: "isc-count-floor", severity: "block", status: "not_applicable", evidence: "phase:observe — floor binds once ISC exist", authority: "Sentinel R18" };
  }
  if (floor === undefined) {
    return { id: "G9", rule: "isc-count-floor", severity: "block", status: "not_applicable", evidence: `effort '${effort}' has no TierConfig floor`, authority: "Sentinel R18" };
  }
  if (isPreIscFloorCutoff(slug)) {
    return { id: "G9", rule: "isc-count-floor", severity: "block", status: "not_applicable", evidence: "PRD predates the 2026-05-05 R18 cutoff (exempt)", authority: "Sentinel R18" };
  }
  const ok = iscCount >= floor;
  return {
    id: "G9", rule: "isc-count-floor", severity: "block",
    status: ok ? "pass" : "fail",
    evidence: ok ? `${iscCount} ISC >= ${effort} floor ${floor}` : `${iscCount} ISC below ${effort} floor ${floor}`,
    fix: `decompose to >= ${floor} atomic ISC`,
    authority: "Sentinel R18",
  };
}

/** G10-G13 — the four required Algorithm sections, gated by effort. */
export function gateAlgorithmSection(rule: AlgorithmSectionRule, raw: string, fm: Frontmatter): GateFinding {
  const effort = (scalar(fm, "effort") ?? "standard").toLowerCase();
  const rank = EFFORT_RANK[effort] ?? 1;
  const required = rank >= EFFORT_RANK[rule.minEffort];
  if (!required) {
    return { id: rule.id, rule: `section:${rule.label}`, severity: "warn", status: "not_applicable", evidence: `effort '${effort}' below ${rule.minEffort}`, authority: rule.authority };
  }
  const present = rule.marker.test(raw);
  return {
    id: rule.id, rule: `section:${rule.label}`, severity: rule.minEffort === "deep" ? "block" : "warn",
    status: present ? "pass" : "fail",
    evidence: present ? `${rule.label} present` : `${rule.label} missing (required at effort >= ${rule.minEffort})`,
    fix: `add the ${rule.label} section`,
    authority: rule.authority,
  };
}

// ── The union runner ─────────────────────────────────────────────────────────

/**
 * Run all 13 completeness gates over a PRD path or raw content and COMPUTE the
 * verdict (gates.every PASS||NA). The verdict is never authored — absence of a
 * finding is inconclusive, not a pass (fail-closed, RFC-0081 §2.3): any block
 * gate that is `fail` → INCOMPLETE; any block gate `inconclusive`/unevaluated →
 * PARTIAL-CHECK (COMPLETE is impossible while a gate could not run).
 */
export function checkCompleteness(pathOrContent: string): CompletenessReport {
  const isPath = !pathOrContent.includes("\n") && /\.md$/.test(pathOrContent);
  const raw = isPath ? readFileSync(pathOrContent, "utf-8") : pathOrContent;
  const slug = isPath ? pathOrContent : (scalarSlug(raw) ?? "");

  let fm: Frontmatter;
  let antiIds: string[];
  try {
    const doc = parsePRDContent(raw);
    fm = doc.frontmatter;
    antiIds = doc.criteria.filter((c) => c.isAnti).map((c) => c.id);
  } catch {
    fm = parseFrontmatter(raw) ?? {};
    antiIds = [...raw.matchAll(/^\s*-\s*\[[ xX]\]\s*(ISC-A-?\d+)/gim)].map((m) => m[1]);
  }
  // Denominator convention: ALL ISC checkbox lines, including anti-criteria
  // (ISC-A-N) — matches how authored PRDs count (firing #3: 67 ISC incl ISC-A-1..7).
  const iscCount = countIscLines(raw);
  const phase = (scalar(fm, "phase") ?? "").toLowerCase();
  const effortSlug = slug || (scalar(fm, "slug") ?? "");

  const findings: GateFinding[] = [
    gateFormatVersion(fm),
    gateRequiredFields(fm),
    gateParentRfc(fm),
    gateAcSubsetOos(raw, antiIds.length),
    gateAntiCriteriaForm(antiIds),
    gateSectionOrder(raw),
    gateProgressFormat(fm),
    gateProgressDenominator(fm, iscCount, phase),
    gateIscFloor(fm, iscCount, phase, effortSlug),
    ...ALGORITHM_SECTION_RULES.map((r) => gateAlgorithmSection(r, raw, fm)),
  ];

  const pass = findings.filter((f) => f.status === "pass").length;
  const fail = findings.filter((f) => f.status === "fail").length;
  const inconclusive = findings.filter((f) => f.status === "inconclusive").length;
  const na = findings.filter((f) => f.status === "not_applicable").length;
  const evaluated = pass + fail + inconclusive;

  // COMPUTE the verdict (fail-closed). A block fail → INCOMPLETE; a block
  // inconclusive → PARTIAL-CHECK; otherwise COMPLETE.
  const blockFail = findings.some((f) => f.severity === "block" && f.status === "fail");
  const blockInconclusive = findings.some((f) => f.severity === "block" && f.status === "inconclusive");
  const anyFail = fail > 0;
  let verdict: Verdict;
  if (blockFail || anyFail) verdict = "INCOMPLETE";
  else if (blockInconclusive) verdict = "PARTIAL-CHECK";
  else verdict = "COMPLETE";

  return {
    verdict,
    contract: `prd-doctrine@${DOCTRINE_VERSION}`,
    gatesTotal: findings.length,
    gatesEvaluated: evaluated,
    pass, fail, inconclusive, na,
    findings,
  };
}

function scalarSlug(raw: string): string | undefined {
  return raw.match(/^slug:\s*(\S+)/m)?.[1];
}
