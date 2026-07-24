/**
 * capability-select-core.ts — RFC-0134 C1 relevance scorer, PURE CORE.
 *
 * Port of the pure functions from the dos repo's Tools/capability-select.ts
 * (canonical source of the ALGORITHM — keep the two in sync when the scoring
 * changes; this copy exists because hooks cannot import across the repo
 * boundary on customer installs). Consumed by OrchestratorPrompt.hook.ts to
 * emit the ADVISORY capability-routing line at prompt time (maturity roadmap
 * P2.4 / audit F2). No I/O, no clock, no RNG — same (task, entries) input
 * yields a byte-identical result.
 *
 * The output NEVER gates: rank() informs the advisor line and the
 * routing-decisions log; abstention (zero meaningful overlap) is a first-class
 * result, not an error.
 */

export interface ScorableEntry {
  id: string;
  surface: string;
  path?: string;
  useWhen?: string;
  surfaceTokenCount?: number;
}

export interface Candidate {
  id: string;
  surface: string;
  path?: string;
  score: number;
  matchedTerms: string[];
  breadthFactor: number;
}

export interface RankResult {
  schema: "dos-capability-select/v1";
  task: string;
  floor: number;
  abstained: boolean;
  candidates: Candidate[];
}

/**
 * Stoplist: english function words PLUS the generic capability verbs
 * (create/build/review/audit/update/fix/run/make/check) — the cross-catalog
 * terms that, unstripped, make every skill look relevant (RFC-0134 §4.1).
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "create", "build", "review", "audit", "update", "fix", "run", "make", "check",
  "use", "using", "used", "add", "set", "get", "do", "doing", "done", "work",
  "working", "help", "need", "want", "new",
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "this",
  "that", "is", "are", "be", "as", "at", "by", "from", "it", "its", "into", "via",
  "we", "our", "you", "your", "i", "me", "my", "they", "their", "he", "she",
  "but", "not", "no", "if", "then", "else", "so", "than", "when", "where", "what",
  "which", "who", "how", "all", "any", "each", "some", "more", "most", "can",
  "will", "should", "would", "could", "out", "up", "down", "off", "over", "about",
]);

/** lowercase, split on non-alphanumerics, drop length<2 and stopwords. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export interface RankOptions {
  n?: number;
  /** abstain when the top score is ≤ floor (default 0 → abstain only on zero overlap). */
  floor?: number;
}

/**
 * PURE. Rank `entries` against `task`. Deterministic for a fixed (task, entries).
 * IDF-weighted task coverage × breadth penalty; see the canonical file's header
 * for the full design rationale (Jaccard-union bug, Sentinel-ranked-#12 bug).
 */
export function rank(task: string, entries: ScorableEntry[], opts: RankOptions = {}): RankResult {
  const n = opts.n ?? 5;
  const floor = opts.floor ?? 0;
  const taskTokens = new Set(tokenize(task));

  const triggers = new Map<string, Set<string>>();
  const df = new Map<string, number>();
  const tokenCounts: number[] = [];
  for (const e of entries) {
    const toks = new Set(tokenize(e.useWhen ?? ""));
    triggers.set(e.id, toks);
    tokenCounts.push(e.surfaceTokenCount ?? toks.size);
    for (const t of toks) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = entries.length;
  const medianTokens = median(tokenCounts.filter((c) => c > 0));
  const idf = (t: string): number => Math.log(N / (df.get(t) ?? N));

  const taskIdfTotal = [...taskTokens].reduce((acc, t) => acc + idf(t), 0);

  const scored: Candidate[] = entries.map((e) => {
    const trig = triggers.get(e.id)!;
    const matched: string[] = [];
    for (const t of taskTokens) if (trig.has(t)) matched.push(t);
    matched.sort();
    const idfSum = matched.reduce((acc, t) => acc + idf(t), 0);
    const coverage = taskIdfTotal > 0 ? idfSum / taskIdfTotal : 0;
    const surfaceTokens = e.surfaceTokenCount ?? trig.size;
    const breadthFactor =
      surfaceTokens > 0 && medianTokens > 0 ? Math.min(1, medianTokens / surfaceTokens) : 1;
    return {
      id: e.id,
      surface: e.surface,
      path: e.path,
      score: round4(coverage * breadthFactor),
      matchedTerms: matched,
      breadthFactor: round4(breadthFactor),
    };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.matchedTerms.length - a.matchedTerms.length ||
      a.id.localeCompare(b.id),
  );

  const top = scored[0];
  if (!top || top.score <= floor) {
    return { schema: "dos-capability-select/v1", task, floor, abstained: true, candidates: [] };
  }
  return {
    schema: "dos-capability-select/v1",
    task,
    floor,
    abstained: false,
    candidates: scored.filter((c) => c.score > floor).slice(0, n),
  };
}
