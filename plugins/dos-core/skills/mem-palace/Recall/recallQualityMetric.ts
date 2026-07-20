/**
 * recallQualityMetric.ts — RFC-0131 §3 Concern C2 (Phase 3), the objective
 * recall-QUALITY metric the corpus has never had.
 *
 * The gap (RFC-0131 §1.2): dos-memory-status reports HNSW health (plumbing),
 * write-success (persistence), and `coverageMetric.ts` HOTNESS ("does the
 * read-port surface ANY of the things it knows about?") — but NOTHING answers
 * the correctness question: when `queryMemory()` runs for a KNOWN query, does
 * it return the RIGHT KG facts? This module is the correctness axis.
 *
 * Metric (RFC-0131 §3.3). For a query q with expected triple set E(q) and the
 * retrieved triple set R(q) (the triples a recall path actually returned), and
 * a given ALIGNMENT between them:
 *     P (precision) = |distinct aligned R indices| / |R(q)|
 *     R (recall)    = |distinct aligned E indices| / |E(q)|
 *     Triplet-F1    = 2PR / (P + R)
 *   tracked number  = mean Triplet-F1 over the fixture.
 *
 * PHASE 3 SCOPE (RFC-0131 §5): the deterministic arithmetic over a GIVEN
 * alignment, plus an operator-curated fixture, unit-tested with a deterministic
 * aligner (exact-triple-match) — NO LLM, NO live-recall run, NO bridge/daemon
 * touch. Phase 4 swaps `exactMatchAlignment` for an RFC-0069 LLM-as-judge node
 * aligner and produces the first baseline + warn-band. The alignment is an
 * INPUT here precisely so P4 can replace the judge without touching this math.
 *
 * Alignment is a list of {retrievedIdx, expectedIdx} pairs (NOT a bijection
 * assumption) so P uses distinct-aligned-R and R uses distinct-aligned-E
 * separately — exactly as §3.3 specifies and as a fuzzy P4 judge (one expected
 * fact satisfied by two retrieved phrasings, etc.) requires.
 *
 * Pure: the scorer never throws and does no I/O. `loadFixture` is the single
 * I/O surface and returns a `{ok:false,reason}` envelope (mirrors
 * coverageMetric.ts) so callers degrade gracefully.
 */

import { existsSync, readFileSync } from 'node:fs';

/** A KG fact as stored by `add_kg_fact` (subject/predicate/object). */
export interface Triple {
  subject: string;
  predicate: string;
  object: string;
}

/** One alignment edge: retrieved index i is judged to satisfy expected index j. */
export interface AlignmentPair {
  retrievedIdx: number;
  expectedIdx: number;
}

/** An aligner: given retrieved + expected triples, return the satisfied pairs.
 *  Phase 3 ships `exactMatchAlignment`; Phase 4 supplies an LLM-as-judge aligner
 *  of the same shape. */
export type Aligner = (retrieved: Triple[], expected: Triple[]) => AlignmentPair[];

/** One fixture row — an operator-curated (query -> expected facts) entry. */
export interface RecallQualityQuery {
  /** Stable id for tracking a query across cadenced runs. */
  id: string;
  /** The natural-language / search query to execute against a recall path. */
  query: string;
  /** Which recall surface to run it through (search | kg_query | recallXxx).
   *  A fixture parameter (RFC-0131 §3.3) so surfaces can be compared. P3 stores
   *  it; P4 dispatches on it. */
  recall_path: string;
  /** The KG triples a correct recall SHOULD return for this query. */
  expected: Triple[];
  /** ISO date the expected set was last curated (drift guard, RFC-0131 §3.5). */
  last_curated: string;
}

/** Per-query score. */
export interface QueryScore {
  id: string;
  precision: number;
  recall: number;
  f1: number;
  retrievedCount: number;
  expectedCount: number;
  alignedRetrieved: number;
  alignedExpected: number;
}

export interface RecallQualityReport {
  meanF1: number;
  n: number;
  perQuery: QueryScore[];
}

export type LoadFixtureResult =
  | { ok: true; queries: RecallQualityQuery[] }
  | { ok: false; reason: string };

/** Canonical key for a triple. Built from the three NAMED role-fields (so the
 *  key is independent of JS property-enumeration order) via `JSON.stringify` of
 *  the `[subject, predicate, object]` tuple — an UNAMBIGUOUS join: JSON escaping
 *  + the array structure mean no field content can forge a field boundary.
 *
 *  Two earlier collision vectors are deliberately closed (a recall-QUALITY
 *  metric must never inflate via a FALSE alignment — the optimistic lie is the
 *  dangerous direction): (1) it is CASE-SENSITIVE (no lowercasing — `iOS` vs
 *  `ios`, `getMemorySubdir` vs `getmemorysubdir` stay distinct); (2) only
 *  BOUNDARY whitespace is normalized (`trim`) — internal `\n`/`\t`/multi-space
 *  is SIGNIFICANT, so a newline-bearing fact does NOT equal a space-joined one,
 *  and a magic separator char in a field cannot collapse two distinct triples to
 *  one key (the QA 2026-06-02 finding). The role order s|p|o is positional. */
export function tripletKey(t: Triple): string {
  const norm = (s: string): string => String(s ?? '').trim();
  return JSON.stringify([norm(t.subject), norm(t.predicate), norm(t.object)]);
}

/**
 * Deterministic exact-match aligner: a retrieved triple satisfies an expected
 * triple iff their canonical keys are identical. Produces a 1:1 greedy matching
 * (each retrieved index and each expected index is used at most once) so
 * duplicate triples cannot inflate the aligned counts. This is the strictest
 * possible judge and the Phase-3 stand-in for the Phase-4 LLM aligner.
 */
export function exactMatchAlignment(retrieved: Triple[], expected: Triple[]): AlignmentPair[] {
  // Map each expected key -> queue of still-unconsumed expected indices.
  const expectedByKey = new Map<string, number[]>();
  expected.forEach((t, j) => {
    const k = tripletKey(t);
    const q = expectedByKey.get(k);
    if (q) q.push(j);
    else expectedByKey.set(k, [j]);
  });

  const pairs: AlignmentPair[] = [];
  retrieved.forEach((t, i) => {
    const q = expectedByKey.get(tripletKey(t));
    if (q && q.length > 0) {
      const j = q.shift() as number; // consume one expected index
      pairs.push({ retrievedIdx: i, expectedIdx: j });
    }
  });
  return pairs;
}

/**
 * Score one query. Pure. Edge conventions (RFC-0131 §3.3, made explicit + tested):
 *   - E empty & R empty  -> P=R=F1=1 (vacuously perfect: nothing to find, found nothing wrong)
 *   - E empty & R nonempty-> P=0, R=1, F1=0 (retrieved noise when nothing was expected)
 *   - E nonempty & R empty-> P=0, R=0, F1=0 (missed everything)
 *   - P+R = 0            -> F1=0 (never NaN)
 */
export function scoreQuery(retrieved: Triple[], expected: Triple[], align: Aligner): {
  precision: number;
  recall: number;
  f1: number;
  alignedRetrieved: number;
  alignedExpected: number;
} {
  // Bounds-validate the aligner's pairs: a swapped-in Phase-4 LLM-as-judge
  // aligner can hallucinate an out-of-range or duplicate index, which — counted
  // blindly — would push precision/recall/F1 ABOVE 1 (the metric lying
  // optimistically, the exact failure RFC-0131 §3.2 warns against). Drop any
  // pair whose indices don't address real triples; distinct valid indices can
  // never exceed the array lengths, so P,R <= 1 is guaranteed.
  const pairs = align(retrieved, expected).filter(
    (p) =>
      Number.isInteger(p.retrievedIdx) && p.retrievedIdx >= 0 && p.retrievedIdx < retrieved.length &&
      Number.isInteger(p.expectedIdx) && p.expectedIdx >= 0 && p.expectedIdx < expected.length,
  );
  const alignedRetrieved = new Set(pairs.map((p) => p.retrievedIdx)).size;
  const alignedExpected = new Set(pairs.map((p) => p.expectedIdx)).size;

  const rCount = retrieved.length;
  const eCount = expected.length;

  const precision = rCount === 0 ? (eCount === 0 ? 1 : 0) : alignedRetrieved / rCount;
  const recall = eCount === 0 ? 1 : alignedExpected / eCount;

  const denom = precision + recall;
  const f1 = denom === 0 ? 0 : (2 * precision * recall) / denom;

  return { precision, recall, f1, alignedRetrieved, alignedExpected };
}

/** Score a fixture query against an already-retrieved set, returning a QueryScore. */
export function scoreFixtureQuery(q: RecallQualityQuery, retrieved: Triple[], align: Aligner): QueryScore {
  const s = scoreQuery(retrieved, q.expected, align);
  return {
    id: q.id,
    precision: s.precision,
    recall: s.recall,
    f1: s.f1,
    retrievedCount: retrieved.length,
    expectedCount: q.expected.length,
    alignedRetrieved: s.alignedRetrieved,
    alignedExpected: s.alignedExpected,
  };
}

/** Mean Triplet-F1 over per-query scores. Mean is over QUERIES (each query
 *  weighted equally), not over triples. n=0 -> meanF1=0 (never NaN). */
export function meanTripletF1(perQuery: QueryScore[]): RecallQualityReport {
  const n = perQuery.length;
  const meanF1 = n === 0 ? 0 : perQuery.reduce((acc, q) => acc + q.f1, 0) / n;
  return { meanF1, n, perQuery };
}

/** Validate one parsed fixture row into a RecallQualityQuery, or return null. */
function coerceQuery(raw: unknown): RecallQualityQuery | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.query !== 'string') return null;
  if (typeof o.recall_path !== 'string') return null;
  if (typeof o.last_curated !== 'string') return null;
  if (!Array.isArray(o.expected) || o.expected.length === 0) return null;
  const expected: Triple[] = [];
  for (const t of o.expected) {
    if (!t || typeof t !== 'object') return null;
    const tt = t as Record<string, unknown>;
    if (typeof tt.subject !== 'string' || typeof tt.predicate !== 'string' || typeof tt.object !== 'string') {
      return null;
    }
    // Reject a degenerate triple whose any role is empty/whitespace-only after
    // trim: those all canonicalize to the same key and would false-align
    // (code-review 2026-06-02). A well-formed KG fact never has an empty role.
    if (tt.subject.trim() === '' || tt.predicate.trim() === '' || tt.object.trim() === '') {
      return null;
    }
    expected.push({ subject: tt.subject, predicate: tt.predicate, object: tt.object });
  }
  return { id: o.id, query: o.query, recall_path: o.recall_path, expected, last_curated: o.last_curated };
}

/**
 * Load the operator-curated recall-quality fixture (JSONL). Never throws —
 * returns a `{ok:false,reason}` envelope on any failure (mirrors
 * coverageMetric.ts). One malformed row fails the whole load loudly rather than
 * silently scoring against a partial fixture (a wrong denominator silently lies
 * — RFC-0131 §3.2 / the bridge-event-ratio lesson).
 */
export function loadFixture(path: string): LoadFixtureResult {
  if (!existsSync(path)) return { ok: false, reason: `fixture not found at ${path}` };
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch (e) {
    return { ok: false, reason: `read error: ${String(e)}` };
  }
  // A comment is a line beginning with `//` that contains NO `{` — a pure prose
  // note. A line like `//{"id":...}` (commented-out data, an easy paste typo) is
  // NOT treated as a comment: it falls through to JSON.parse and fails LOUDLY
  // rather than silently shrinking the fixture (a wrong denominator lies).
  const lines = text.split('\n').map((l) => l.trim())
    .filter((l) => l.length > 0 && !(l.startsWith('//') && !l.includes('{')));
  if (lines.length === 0) return { ok: false, reason: 'fixture is empty (no data rows)' };

  const queries: RecallQualityQuery[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[i]);
    } catch (e) {
      return { ok: false, reason: `line ${i + 1}: JSON parse error — ${String(e)}` };
    }
    const q = coerceQuery(parsed);
    if (!q) return { ok: false, reason: `line ${i + 1}: malformed query (need id/query/recall_path/last_curated + nonempty expected[] of {subject,predicate,object})` };
    if (seen.has(q.id)) return { ok: false, reason: `line ${i + 1}: duplicate query id "${q.id}"` };
    seen.add(q.id);
    queries.push(q);
  }
  return { ok: true, queries };
}
