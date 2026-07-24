/**
 * R102 — presence.archetype-scope-declared (Archer Run 4 gen-52; RFC-0164 D-A.2).
 *
 * Background: RFC-0164 D-A made the archetype scope layer a first-class PRD
 * section with a mandatory-or-declined applicability predicate. A feature PRD
 * authored after ratification (2026-07-22) is in exactly one of two valid
 * states: it carries the SeedScope scope section (`seeded from archetype
 * <name> v<version>`) or it carries a `Declined: <reason>` line in its
 * Decisions. Silence — neither — is the lint finding, never a valid state
 * (D-A.2 verbatim). R101 audits the CONTENT of a scope block that exists;
 * this rule audits the EXISTENCE side of the predicate — the joint that
 * "nothing but agent diligence" guarded before ratification (RFC-0164 §1.1).
 *
 * Ownership note (D-A.4): the RFC assigns the PRD pack's CheckCompleteness
 * the predicate lint at PRD-format level (operator-gated diff, still owed
 * per §6). R102 is the COMPLEMENTARY Sentinel-side corpus audit — same
 * shape as R101's relationship to ValidateScopeBlock: the pack surface owns
 * the law at authoring time, Sentinel audits the corpus after the fact.
 * Ship sanctioned by the Run-4 launch directive (Stage-2 R-rule promotion,
 * R102 verified next-free); operator signature gates the PR.
 *
 * Detection — applicable PRDs (flat MEMORY/WORK/<slug>/ + active/<slug>/):
 *   • modified within the recency window (default 14d, `recencyDays` seam)
 *   • authored on/after ratification. Authored-time derivation, in order:
 *     (1) the WORK slug-date prefix `YYYYMMDD-HHMMSS_` (deterministic,
 *     filesystem-independent — survives clone/rsync/backup-restore);
 *     (2) fs birthtime where positive; (3) underivable → EXCLUDED, never
 *     included (mtime is NEVER consulted for the ratification decision:
 *     recency + mtime-fallback would make the gate a guaranteed no-op once
 *     now ≥ ratification + window — skeptic finding C2). Slug dates parse
 *     as UTC; ±TZ-offset slack at the day boundary is accepted (warn-only).
 *   • feature-shaped: a Criteria heading (any of `## Criteria`,
 *     `## Ideal State Criteria`, `### Criteria`, levels 2-4) OR a
 *     checkbox-declared ISC line (`- [ ] ISC-…`). Bare ISC tokens in prose
 *     do NOT qualify — records/retro/campaign PRDs that merely QUOTE ISC
 *     ids stay out of scope (skeptic finding B1).
 *
 * A PRD satisfies the predicate iff it matches the SeedScope marker OR a
 * `Declined: <reason>` line. The Declined line is scoped to the Decisions
 * section when one exists (D-A.2 names "PRD Decisions"); a PRD without a
 * Decisions heading degrades to a whole-body scan (documented residual:
 * a quoted Declined line elsewhere can false-satisfy in that shape only).
 * List forms `- Declined:`, `* Declined:`, `1. Declined:`, `2) Declined:`
 * and bold `**Declined**:` are all accepted (skeptic finding A1).
 *
 * The scope-section regex is RFC-0164 D-A.1's NORMATIVE machine-detection
 * contract, verbatim what R101 keys on. Deliberately NOT relaxed for
 * malformed variants (`v0.5`, `v0.5.0-beta`): the contract is ratified,
 * R101/R102 divergence would be a defect, and a malformed header is itself
 * the bug (skeptic finding A3 — declined with reason).
 *
 * Pure text predicate — no CLI spawn, no install-state read.
 *
 * Warn-only ship (R93-R98/R101 advisory precedent): ALWAYS returns
 * `status: "pass"` once applicable PRDs exist; silent PRDs surface via
 * evidence only. Promotion shares R101's ladder (RFC-0164 §3.3 — each step
 * a separate operator sign-off).
 *
 * Failure modes:
 *   - No MEMORY/WORK/ → not_applicable
 *   - No feature-shaped post-ratification PRD in window → not_applicable
 *   - Silent PRDs → pass (warn-only), per-PRD evidence lines (capped at 20,
 *     remainder count stated — no silent caps)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Feature PRDs authored after RFC-0164 ratification carry the archetype scope section or a Declined: line — silence is never a valid state (D-A.2)";

const DEFAULT_RECENCY_DAYS = 14;

// RFC-0164 D-A ratification date (2026-07-22T00:00:00Z). Seam: ratificationMs.
const DEFAULT_RATIFICATION_MS = Date.UTC(2026, 6, 22);

const EVIDENCE_CAP = 20;

// RFC-0164 D-A.1 normative machine-detection contract (verbatim — R101 keys on it).
const MATCH_MARKER = /seeded from archetype\s+([a-z0-9-]+)\s+v(\d+\.\d+\.\d+)/;

// D-A.2: "a `Declined: <reason>` line in PRD Decisions" — reason required.
// Accepts dash/star bullets, numbered lists (1. / 2)), and bold Declined.
const DECLINED_LINE =
  /^\s*(?:(?:[-*]|\d+[.)])\s+)?(?:\*\*)?Declined(?:\*\*)?:\s*\S/m;

const DECISIONS_HEADING = /^#{2,4}\s+[^\n]*\bDecisions?\b[^\n]*$/m;
const NEXT_HEADING = /^#{1,4}\s+/m;

// Feature-shaped = a Criteria heading (levels 2-4, any title containing the
// word) OR a checkbox-declared ISC line. Bare ISC tokens in prose never match.
const CRITERIA_HEADING = /^#{2,4}\s+[^\n]*\bCriteria\b/m;
const CRITERIA_CHECKBOX = /^\s*[-*]\s*\[[ xX]?\]\s*ISC-/m;

// WORK slug-date prefix: 20260722-143000_some-slug → authored 2026-07-22T14:30:00Z.
const SLUG_DATE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/;

function declinedDeclared(body: string): boolean {
  const h = body.match(DECISIONS_HEADING);
  if (h && h.index !== undefined) {
    const start = h.index + h[0].length;
    const rest = body.slice(start);
    const next = rest.match(NEXT_HEADING);
    const section = next ? rest.slice(0, next.index) : rest;
    return DECLINED_LINE.test(section);
  }
  // No Decisions heading — degrade to whole-body scan (documented residual).
  return DECLINED_LINE.test(body);
}

function featureShaped(body: string): boolean {
  return CRITERIA_HEADING.test(body) || CRITERIA_CHECKBOX.test(body);
}

interface PrdStat {
  prd: string;
  authoredMs: number | null;
}

function authoredMsFor(
  entryName: string,
  birthtimeMs: number | undefined,
): number | null {
  const m = entryName.match(SLUG_DATE);
  if (m) {
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (!Number.isNaN(t)) return t;
  }
  if (birthtimeMs && birthtimeMs > 0) return birthtimeMs;
  return null; // underivable → caller EXCLUDES (never mtime — see header)
}

function listRecentPrdFiles(
  workRoot: string,
  recencyMs: number,
  nowMs: number,
): PrdStat[] {
  const files: PrdStat[] = [];
  const roots = [workRoot, join(workRoot, "active")];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry === "active" || entry === "archived") continue;
      const prd = join(root, entry, "PRD.md");
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(prd);
      } catch {
        continue;
      }
      if (nowMs - st.mtimeMs > recencyMs) continue;
      files.push({ prd, authoredMs: authoredMsFor(entry, st.birthtimeMs) });
    }
  }
  return files;
}

export async function r102ArchetypeScopeDeclared(
  ctx: CheckContext,
): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  if (!existsSync(workRoot)) {
    return {
      rId: "R102",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${workRoot} not found — no PRD corpus to audit`],
    };
  }

  const nowMs = ctx.nowMs ?? Date.now();
  const recencyDays =
    (ctx as { recencyDays?: number }).recencyDays ?? DEFAULT_RECENCY_DAYS;
  const recencyMs = recencyDays * 24 * 60 * 60 * 1000;
  const ratificationMs =
    (ctx as { ratificationMs?: number }).ratificationMs ??
    DEFAULT_RATIFICATION_MS;

  const applicable: Array<{ prd: string; declared: boolean }> = [];
  for (const { prd, authoredMs } of listRecentPrdFiles(
    workRoot,
    recencyMs,
    nowMs,
  )) {
    // Underivable authored-time or pre-ratification → out of scope
    // (D-A binds post-ratification PRDs only, §5 — exclusion is the safe side).
    if (authoredMs === null || authoredMs < ratificationMs) continue;
    let body: string;
    try {
      body = readFileSync(prd, "utf-8");
    } catch {
      continue;
    }
    if (!featureShaped(body)) continue;
    const declared = MATCH_MARKER.test(body) || declinedDeclared(body);
    applicable.push({ prd, declared });
  }

  if (applicable.length === 0) {
    return {
      rId: "R102",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `No feature-shaped PRD authored after ratification and modified in last ${recencyDays} days`,
      ],
    };
  }

  const silent = applicable.filter((a) => !a.declared);
  const evidence: string[] = [];
  for (const { prd } of silent.slice(0, EVIDENCE_CAP)) {
    evidence.push(
      `${prd}: feature-shaped, post-ratification — neither scope section nor Declined: line (D-A.2 silence)`,
    );
  }
  if (silent.length > EVIDENCE_CAP) {
    evidence.push(
      `…${silent.length - EVIDENCE_CAP} more silent PRD(s) beyond evidence cap`,
    );
  }
  if (silent.length === 0) {
    evidence.push(
      `0 silent PRDs — all ${applicable.length} applicable PRD(s) declare (scope section or Declined:)`,
    );
  }

  // Warn-only AUDIT tier: silence is evidence, never a fail verdict.
  return {
    rId: "R102",
    requirement: REQUIREMENT,
    status: "pass",
    evidence,
  };
}
