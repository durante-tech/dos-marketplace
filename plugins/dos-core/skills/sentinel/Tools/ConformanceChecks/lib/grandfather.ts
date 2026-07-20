/**
 * grandfather — shared cutoff-comparison helper for PRD-frontmatter Sentinel
 * rules (R44, R45, R46, R47, R48, R49, R50, R51, R63, R78).
 *
 * Provenance:
 *   - Joint PRD: MEMORY/WORK/active/20260526-210258_r46-r78-joint-timezone-fix/PRD.md
 *   - Council decision: COUNCIL.md D1 — Option A (UTC-normalize) unanimous
 *     across all 5 seats (Young, UncleBob, Fowler, Feathers, SandiMetz).
 *   - Surfacing audit: MEMORY/WORK/active/20260527-presence-council-before-body-rule/cato-review.md
 *     F1 (HIGH) — grandfather string-compare ignored timezone offset.
 *   - Implementation order: COUNCIL.md D3 + D5 — Feathers' Cover-and-Modify;
 *     characterization fixtures pin current buggy behavior BEFORE helper
 *     extraction, then verdict deltas at the migration commit ARE the audit.
 *
 * The bug it replaces:
 *   The prior pattern `started.slice(0, 10) < RULE_CUTOFF_ISO` performs a
 *   lexicographic compare on the date-prefix of the ISO timestamp. For a PRD
 *   authored in São Paulo (`-03:00`) at `2026-05-26T00:00:00-03:00`, the
 *   slice yields `'2026-05-26'`, which compares equal to a cutoff of
 *   `2026-05-26` and therefore fails the strict-less-than — the PRD is NOT
 *   grandfathered, even though the UTC equivalent is `2026-05-26T03:00:00Z`
 *   which IS on (or before, with a few hours' slack) the cutoff calendar
 *   day in UTC terms. The cutoff is a calendar-day concept; the corpus has
 *   no per-rule timezone, so UTC is the canonical reference frame.
 *
 * Semantics (Option A — UTC-normalize):
 *   Parse `startedISO` as a Date (absolute instant). Convert that instant
 *   to its UTC calendar day. Compare strictly-less-than the cutoff's UTC
 *   calendar day. Pre-cutoff (UTC) → grandfathered (true). On or after
 *   cutoff (UTC) → rule applies (false).
 *
 *   Why strict-less-than (not <=): a rule ratified ON day X applies to
 *   anything authored ON day X. Only authoring BEFORE day X is grandfathered.
 *   This matches the original `<` intent — the fix is solely about timezone
 *   normalization, not about flipping the inequality.
 *
 * Failure modes — all return `false` (rule applies, safer default):
 *   - startedISO is `undefined`, empty string, or not a parseable date.
 *   - cutoffISO is missing or malformed (cutoff would be NaN → comparison
 *     short-circuits false, so the rule applies).
 *
 * Choosing `false` (rule applies) on malformed input is the conservative
 * call: if we cannot decide whether the PRD was authored before the rule,
 * we apply the rule. This preserves the auditability invariant that no
 * PRD silently escapes a rule due to a parse error.
 */

/**
 * Determine if a PRD `started:` timestamp falls strictly before a rule's
 * grandfather cutoff (UTC-normalized calendar-day semantics — Council D1
 * Option A per joint PRD 20260526-210258_r46-r78-joint-timezone-fix).
 *
 * Honors "calendar-day cutoff is a UTC concept". Replaces the prior
 * `slice(0,10) < RULE_CUTOFF_ISO` lexicographic compare that silently
 * mis-grandfathered timezone-bearing ISO timestamps (e.g. São Paulo -03:00
 * authoring environment) — the original gap Cato F1 audit surfaced on R78,
 * shared shape-mirror with R44/R45/R46/R47/R48/R49/R50/R51/R63 (×2).
 *
 * @param startedISO — PRD `started:` frontmatter value (any ISO-8601 form)
 * @param cutoffISO — rule's RULE_CUTOFF_ISO constant (YYYY-MM-DD form)
 * @returns true if the PRD's UTC calendar day is strictly before cutoff
 *          calendar day (i.e. PRD is grandfathered). false otherwise OR
 *          if startedISO is malformed/unparseable (rule applies — safer default).
 */
export function isPreCutoffISO(
  startedISO: string | undefined,
  cutoffISO: string,
): boolean {
  if (!startedISO || startedISO.length === 0) return false;
  if (!cutoffISO || cutoffISO.length === 0) return false;

  // Parse the started instant. Date.parse returns NaN for unparseable
  // input — that case falls through to `false` (rule applies).
  const startedMs = Date.parse(startedISO);
  if (Number.isNaN(startedMs)) return false;

  // Convert started to its UTC calendar day at 00:00:00.000 UTC.
  const startedDate = new Date(startedMs);
  const startedUtcDayMs = Date.UTC(
    startedDate.getUTCFullYear(),
    startedDate.getUTCMonth(),
    startedDate.getUTCDate(),
  );

  // Parse the cutoff. Cutoffs in the corpus are always bare YYYY-MM-DD form;
  // appending `T00:00:00Z` forces UTC interpretation regardless of host TZ.
  // We accept richer ISO forms defensively (e.g. an operator who writes
  // `2026-05-13T00:00:00Z` in a future rule) by normalizing through Date.parse.
  const cutoffNormalized = /^\d{4}-\d{2}-\d{2}$/.test(cutoffISO)
    ? `${cutoffISO}T00:00:00Z`
    : cutoffISO;
  const cutoffMs = Date.parse(cutoffNormalized);
  if (Number.isNaN(cutoffMs)) return false;

  const cutoffDate = new Date(cutoffMs);
  const cutoffUtcDayMs = Date.UTC(
    cutoffDate.getUTCFullYear(),
    cutoffDate.getUTCMonth(),
    cutoffDate.getUTCDate(),
  );

  return startedUtcDayMs < cutoffUtcDayMs;
}

/**
 * Active grandfather semantics — exported for reviewer grep-ability per
 * joint PRD ISC-B3. If a future PRD rotates to Option B or C, this constant
 * is the one-stop discovery point alongside the helper body.
 */
export const GRANDFATHER_SEMANTICS =
  "A: UTC-normalize (Council D1, joint PRD 20260526-210258)";
