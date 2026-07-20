/**
 * lib/tier.ts — Effort-to-E-tier mapping per Algorithm v0.0.10 §0 TierConfig.
 *
 * Source of truth: v0.0.10.md §0 TierConfig table. PRD frontmatter `effort:`
 * values map to E-tier integers per the table below. This module is the SINGLE
 * place the mapping lives — adding a tier = edit one table (matches v0.0.10.md
 * §0 TIER-EDIT-LOCALITY invariant per Doctrine Self-Test).
 *
 *   minimal       → E0 (implicit, not in TierConfig table)
 *   standard      → E1
 *   extended      → E2
 *   advanced      → E3
 *   deep          → E4
 *   xhigh         → E5
 *   comprehensive → E6
 *
 * Amendment I-1 (parent PRD 20260526-191054 D3, ratified 2026-05-26):
 *   "Council returns N-of-N unanimous on any cluster AND task tier ≥ E4
 *    (deep/xhigh/comprehensive) → RedTeam fires automatically."
 *
 * Child PRD COUNCIL.md D1 (2026-05-26): all 5 seats picked **E4 strict** per
 * §0 alignment. The amendment-i-proposal.md parenthetical "advanced/deep"
 * was a drafting slip — `advanced` is E3 and does NOT trigger auto-fire.
 * `isAtLeastE4()` returns true ONLY for {deep, xhigh, comprehensive}.
 *
 * Re-usable by future amendment hooks: never inline this mapping table
 * (anti-pattern per child PRD ISC-ANTI-6).
 */

export const EFFORT_TIER_MAP: Readonly<Record<string, number>> = Object.freeze({
  minimal: 0,
  standard: 1,
  extended: 2,
  advanced: 3,
  deep: 4,
  xhigh: 5,
  comprehensive: 6,
});

/**
 * Translate a frontmatter `effort:` token to its E-tier integer (0-6).
 * Unknown/undefined effort returns 0 — fail-quiet, never throws.
 */
export function effortToTier(effort: string | undefined | null): number {
  if (!effort) return 0;
  return EFFORT_TIER_MAP[effort.toLowerCase()] ?? 0;
}

/**
 * Amendment I-1 tier-gate check. E4+ strict per Council D1.
 *
 * Returns true only for: deep (E4), xhigh (E5), comprehensive (E6).
 * Returns false for: advanced (E3), extended (E2), standard (E1), minimal,
 * unknown, undefined.
 */
export function isAtLeastE4(effort: string | undefined | null): boolean {
  return effortToTier(effort) >= 4;
}

/**
 * Frozen allowlist of persistent Council specialist seat subagent_types per
 * ~/.claude/skills/thinking/Council/CouncilMembers.md lines 64-72. Used by
 * the verdict-parser to distinguish Council seat columns from the RedTeam
 * adversarial-review column (which is NOT counted toward unanimity per child
 * PRD ISC-A1 + ISC-ANTI-3).
 *
 * v1 frozen. Composed `general-purpose` seats are NOT counted as Council
 * seats — composed-seat detection deferred per child PRD ISC-A1.
 */
export const COUNCIL_SEAT_ALLOWLIST: ReadonlyArray<string> = Object.freeze([
  'KentBeck',
  'Pragmatic',
  'GregYoung',
  'Cockburn',
  'UncleBob',
  'Fowler',
  'SandiMetz',
  'EricEvans',
  'Feathers',
]);

/**
 * Header tokens used in PRD Council Verdicts tables. These map back to
 * canonical seat names but appear in tables as shortened forms (e.g. "Beck"
 * not "KentBeck", "Young" not "GregYoung"). Characterized against parent PRD
 * 20260526-191054 line 140 actual table header:
 *   | Cand | Beck | pragmatic | Young | cockburn | uncle-bob | RedTeam |
 */
export const SEAT_HEADER_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  beck: 'KentBeck',
  kentbeck: 'KentBeck',
  pragmatic: 'Pragmatic',
  young: 'GregYoung',
  gregyoung: 'GregYoung',
  cockburn: 'Cockburn',
  unclebob: 'UncleBob',
  fowler: 'Fowler',
  sandimetz: 'SandiMetz',
  metz: 'SandiMetz',
  ericevans: 'EricEvans',
  evans: 'EricEvans',
  feathers: 'Feathers',
});

/** Non-seat header tokens that MUST be excluded from unanimity counting. */
export const NON_SEAT_HEADERS: ReadonlySet<string> = new Set([
  'cand',
  'candidate',
  'cluster',
  'redteam',
  'red team',
  'red-team',
]);
