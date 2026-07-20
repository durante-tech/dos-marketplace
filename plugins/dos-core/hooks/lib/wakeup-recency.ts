/**
 * wakeup-recency.ts — pure recency filter for MemPalaceWakeUp live-KG synthesis.
 *
 * Extracted as a dependency-free seam (no heavy imports) so the recency logic is
 * unit-testable without importing the side-effecting hook module, whose
 * transitive import chain (hook-io → DOS/Tools/TranscriptParser) only resolves
 * in the live-install layout.
 *
 * mempalace-008: kg_query_predicate (the bridge action MemPalaceWakeUp calls)
 * only honors predicate/as_of/subject/object — the `hours: 24` arg the hook
 * passes is silently dropped, so query_relationship() returns ALL current facts
 * for the predicate across all time. Without a client-side window the
 * "Last Session" block was unbounded by recency and the
 * "zero facts → snapshot fallback" branch rarely fired because old facts always
 * inflated the count.
 */

/** Minimal shape of a KG fact as returned by kg_query_predicate. */
export interface RecencyFact {
  created_at?: string;
  ts?: string;
  valid_from?: string;
}

/** Recency window (ms) for the "Last Session" live-KG synthesis. */
export const WAKEUP_RECENCY_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Keep only facts whose timestamp falls within `windowMs` of `nowMs`.
 *
 * Timestamp precedence matches the hook's sort order: created_at → ts →
 * valid_from (the stored-triple date). Facts with no parseable timestamp are
 * KEPT (fail-open) so a malformed timestamp never erases a genuinely-recent
 * fact.
 */
export function filterFactsByRecency<T extends RecencyFact>(
  facts: T[],
  windowMs: number = WAKEUP_RECENCY_MS,
  nowMs: number = Date.now(),
): T[] {
  const cutoff = nowMs - windowMs;
  return facts.filter((f) => {
    const raw = f.created_at || f.ts || f.valid_from || "";
    if (!raw) return true; // no timestamp — keep (fail-open)
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return true; // unparseable — keep (fail-open)
    return t >= cutoff;
  });
}
