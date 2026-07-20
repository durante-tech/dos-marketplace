#!/usr/bin/env bun
/**
 * @pack MemPalace
 * @workflow benchmark-harness
 *
 * bench-harness.ts — RFC-0150 minimal harness (M1 recall@k/MRR + M3 scoped hit-rate + latency).
 *
 * Contract (RFC-0150 §2 — non-negotiable):
 *   - STAGING-ONLY: runs against ~/.mempalace-staging/latest (or --staging <dir>);
 *     refuses any path inside the live ~/.mempalace root.
 *   - Measures the REAL read path: spawns the DOS bridge (`mempalace_bridge.py search`)
 *     with MEMPALACE_DIR pointed at the staging snapshot (the bridge's palace-root
 *     seam, _bridge_palace.py get_palace_path). Not a lab shortcut around the bridge.
 *   - PAIRED comparison: --baseline <report.json> refuses cross-snapshot comparisons
 *     and reports per-query deltas + a bootstrap CI (never single-number verdicts —
 *     ANN retrieval is not bit-deterministic across index rebuilds).
 *
 * Usage:
 *   bun Packs/mem-palace/src/Tools/bench-harness.ts                    # baseline run
 *   bun ... --label candidate-X --baseline <prior-report.json>       # paired A/B
 *   bun ... --gold <path> --staging <dir> --k 5 --out <report.json>
 *
 * M2 (temporal-validity) and M4 served-by split are deferred per the operator's
 * 2026-07-02 trim — this file gains them only when a Wave 2 fix needs them.
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

interface GoldEntry {
  id: string;
  query: string;
  /** any-of source_path substrings (empty/absent when expect_content is used) */
  expect?: string[];
  /** any-of content substrings — for drawers that carry no source_path */
  expect_content?: string[];
  scope?: { wing?: string; room?: string };
}

interface QueryResult {
  id: string;
  scoped: boolean;
  rank: number | null; // 1-based rank of first matching result; null = miss in top-k
  ms: number;
  error?: string;
}

interface Metrics {
  n: number;
  recall_at_1: number;
  recall_at_3: number;
  recall_at_k: number;
  mrr: number;
  scoped_n: number;
  scoped_hit_rate: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
}

interface Report {
  generated_at: string;
  label: string;
  snapshot_id: string;
  staging_dir: string;
  gold_version: string;
  gold_path: string;
  k: number;
  mempalace_version: string | null;
  dos_patch_markers: number | null;
  per_query: QueryResult[];
  metrics: Metrics;
}

function arg(flag: string, fallback: string | null = null): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// --distill simulates the IntentRetrieval hook's query mangling (hooks/lib/
// mempalace.ts distillSearchQuery: >5-word prompts collapse to the first 8
// stopword-filtered keywords) so a raw-vs-distilled A/B isolates the W2-2
// question without touching the hook. Stopword list mirrors SEARCH_STOPWORDS.
const DISTILL_STOPWORDS = new Set(['a','an','the','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','must','i','me','my','we','our','you','your','he','she','it','they','this','that','these','those','what','which','who','whom','in','on','at','to','for','of','with','by','from','up','about','into','through','during','before','after','above','below','and','but','or','nor','not','so','yet','both','either','neither','if','then','else','when','where','how','why','all','each','every','some','any','no','just','only','very','too','also','now','here','there','than','more','most','other','such','own','same','let','lets',"let's",'please','want','like','make','go','get','hi','hey','hello','ok','okay','yes','yeah','sure','thanks']);

export function distillLikeHook(raw: string, max = 8): string {
  if (raw.split(/\s+/).length <= 5) return raw;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !DISTILL_STOPWORDS.has(w))
    .slice(0, max)
    .join(' ');
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

// ─── Staging guard ──────────────────────────────────────────────────────────

function resolveStaging(): { dir: string; snapshotId: string } {
  const requested = arg('--staging', join(homedir(), '.mempalace-staging', 'latest'))!;
  const dir = resolve(requested.replace(/^~/, homedir()));
  const live = join(homedir(), '.mempalace');
  // Refuse the live root and anything under it (RFC-0073: validation never
  // touches live DBs). resolve() has already collapsed symlink-free segments;
  // for the `latest` symlink we also refuse post-readlink.
  let physical = dir;
  try { physical = resolve(join(dir, '..'), readlinkSync(dir)); } catch { /* not a symlink */ }
  for (const p of [dir, physical]) {
    if (p === live || p.startsWith(live + '/')) {
      console.error(`REFUSED: ${p} is inside the live palace root (${live}). Staging only.`);
      process.exit(2);
    }
  }
  if (!existsSync(join(physical, 'palace'))) {
    console.error(`REFUSED: ${physical}/palace not found — not a staging snapshot. Run env-setup.sh --resnapshot.`);
    process.exit(2);
  }
  const snapshotId = physical.split('/').pop() ?? physical;
  return { dir: physical, snapshotId };
}

// ─── Provenance stamps ──────────────────────────────────────────────────────

function stampMempalace(): { version: string | null; markers: number | null } {
  try {
    const out = execFileSync('python3', ['-c',
      "import importlib.util as u, importlib.metadata as md; s=u.find_spec('mempalace'); print(md.version('mempalace')); print(list(s.submodule_search_locations)[0])",
    ], { encoding: 'utf-8', timeout: 10_000 });
    const [version, dir] = out.trim().split('\n');
    let markers: number | null = null;
    try {
      markers = (readFileSync(join(dir, 'mcp_server.py'), 'utf-8').match(/DOS-PATCH/g) ?? []).length;
    } catch { /* leave null */ }
    return { version: version ?? null, markers };
  } catch {
    return { version: null, markers: null };
  }
}

// ─── Bridge search (the real read path) ─────────────────────────────────────

// --bridge <path> lets an A/B run point at a slice-worktree bridge (patched code)
// while the baseline uses the installed one. Env vars pass through, so candidate
// flags (e.g. DOS_SCOPED_SEARCH_NATIVE=0) compose from the caller's shell.
const BRIDGE = arg('--bridge', join(homedir(), '.claude', 'DOS', 'Tools', 'mempalace_bridge.py'))!;

function bridgeSearch(stagingDir: string, query: string, k: number, scope?: GoldEntry['scope']):
  { results: Array<{ source_path?: string; wing?: string; content?: string }>; ms: number; error?: string } {
  const payload: Record<string, unknown> = { query, limit: k };
  if (scope?.wing) payload.wing = scope.wing;
  if (scope?.room) payload.room = scope.room;
  const t0 = performance.now();
  try {
    const out = execFileSync('python3', [BRIDGE, 'search', JSON.stringify(payload)], {
      encoding: 'utf-8',
      timeout: 120_000,
      env: { ...process.env, MEMPALACE_DIR: stagingDir },
    });
    const ms = performance.now() - t0;
    const parsed = JSON.parse(out) as { results?: Array<{ source_path?: string; wing?: string }>; error?: string };
    if (parsed.error) return { results: [], ms, error: parsed.error };
    return { results: parsed.results ?? [], ms };
  } catch (e) {
    return { results: [], ms: performance.now() - t0, error: String(e).slice(0, 200) };
  }
}

function rankOf(results: Array<{ source_path?: string; wing?: string; content?: string }>, entry: GoldEntry): number | null {
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const pathOk = (entry.expect ?? []).some(sub => (r.source_path ?? '').includes(sub));
    const contentOk = (entry.expect_content ?? []).some(sub => (r.content ?? '').includes(sub));
    const wingOk = !entry.scope?.wing || r.wing === entry.scope.wing;
    if ((pathOk || contentOk) && wingOk) return i + 1;
  }
  return null;
}

// ─── Metrics + bootstrap ────────────────────────────────────────────────────

function computeMetrics(rows: QueryResult[], k: number): Metrics {
  const n = rows.length;
  const hitAt = (kk: number) => rows.filter(r => r.rank !== null && r.rank <= kk).length / Math.max(1, n);
  const mrr = rows.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / Math.max(1, n);
  const scoped = rows.filter(r => r.scoped);
  const lat = rows.map(r => r.ms).sort((a, b) => a - b);
  return {
    n,
    recall_at_1: +hitAt(1).toFixed(4),
    recall_at_3: +hitAt(3).toFixed(4),
    recall_at_k: +hitAt(k).toFixed(4),
    mrr: +mrr.toFixed(4),
    scoped_n: scoped.length,
    scoped_hit_rate: +(scoped.filter(r => r.rank !== null).length / Math.max(1, scoped.length)).toFixed(4),
    latency_p50_ms: Math.round(percentile(lat, 50)),
    latency_p95_ms: Math.round(percentile(lat, 95)),
  };
}

/** Paired bootstrap over query deltas. Deterministic LCG so reruns agree. */
export function bootstrapDeltaCI(deltas: number[], resamples = 1000): { mean: number; lo: number; hi: number } {
  if (deltas.length === 0) return { mean: 0, lo: 0, hi: 0 };
  let seed = 42;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const means: number[] = [];
  for (let b = 0; b < resamples; b++) {
    let s = 0;
    for (let i = 0; i < deltas.length; i++) s += deltas[Math.floor(rnd() * deltas.length)];
    means.push(s / deltas.length);
  }
  means.sort((a, b) => a - b);
  const mean = deltas.reduce((a, c) => a + c, 0) / deltas.length;
  return { mean: +mean.toFixed(4), lo: +percentile(means, 2.5).toFixed(4), hi: +percentile(means, 97.5).toFixed(4) };
}

function pairedVerdict(base: Report, cand: Report): string {
  const lines: string[] = [];
  if (base.snapshot_id !== cand.snapshot_id) {
    console.error(`REFUSED: cross-snapshot comparison (${base.snapshot_id} vs ${cand.snapshot_id}). Re-run on one snapshot.`);
    process.exit(2);
  }
  const byId = new Map(base.per_query.map(q => [q.id, q]));
  const hitDeltas: number[] = [];
  const rrDeltas: number[] = [];
  for (const c of cand.per_query) {
    const b = byId.get(c.id);
    if (!b) continue;
    hitDeltas.push((c.rank !== null ? 1 : 0) - (b.rank !== null ? 1 : 0));
    rrDeltas.push((c.rank ? 1 / c.rank : 0) - (b.rank ? 1 / b.rank : 0));
  }
  const hit = bootstrapDeltaCI(hitDeltas);
  const rr = bootstrapDeltaCI(rrDeltas);
  const call = (ci: { mean: number; lo: number; hi: number }) =>
    ci.lo > 0 ? 'IMPROVED' : ci.hi < 0 ? 'REGRESSED' : 'indistinguishable';
  lines.push(`paired vs ${base.label} (snapshot ${base.snapshot_id}, n=${hitDeltas.length}):`);
  lines.push(`  recall@k delta ${hit.mean} [${hit.lo}, ${hit.hi}] → ${call(hit)}`);
  lines.push(`  MRR delta      ${rr.mean} [${rr.lo}, ${rr.hi}] → ${call(rr)}`);
  lines.push(`  latency p95    ${base.metrics.latency_p95_ms}ms → ${cand.metrics.latency_p95_ms}ms`);
  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): number {
  const k = parseInt(arg('--k', '5')!, 10);
  const goldPath = resolve(arg('--gold', join(import.meta.dir, '..', '..', 'bench', 'gold.jsonl'))!);
  const label = arg('--label', 'baseline')!;
  const { dir: stagingDir, snapshotId } = resolveStaging();

  const lines = readFileSync(goldPath, 'utf-8').trim().split('\n').map(l => JSON.parse(l));
  const meta = lines.find(l => l._meta) ?? { version: 'unknown' };
  const gold: GoldEntry[] = lines.filter(l => !l._meta);

  console.error(`bench-harness: ${gold.length} gold queries (${meta.version}) vs snapshot ${snapshotId} [label=${label}]`);

  const distillMode = process.argv.includes('--distill');
  if (distillMode) console.error('  (--distill: queries mangled like the IntentRetrieval hook)');

  const perQuery: QueryResult[] = [];
  for (const entry of gold) {
    const q = distillMode ? distillLikeHook(entry.query) : entry.query;
    const { results, ms, error } = bridgeSearch(stagingDir, q, k, entry.scope);
    const rank = error ? null : rankOf(results, entry);
    perQuery.push({ id: entry.id, scoped: !!entry.scope, rank, ms: Math.round(ms), ...(error ? { error } : {}) });
    console.error(`  ${entry.id} ${rank !== null ? `rank ${rank}` : 'MISS'} ${Math.round(ms)}ms${error ? ` ERROR ${error}` : ''}`);
  }

  const stamp = stampMempalace();
  const report: Report = {
    generated_at: new Date().toISOString(),
    label,
    snapshot_id: snapshotId,
    staging_dir: stagingDir,
    gold_version: String(meta.version),
    gold_path: goldPath,
    k,
    mempalace_version: stamp.version,
    dos_patch_markers: stamp.markers,
    per_query: perQuery,
    metrics: computeMetrics(perQuery, k),
  };

  const outPath = resolve(arg('--out', join(import.meta.dir, '..', '..', 'bench', `report-${label}-${snapshotId}.json`))!);
  // writeArtifact:exempt — bench report — pack-internal dev tooling output
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out: outPath, metrics: report.metrics }, null, 2));

  const baselinePath = arg('--baseline');
  if (baselinePath) {
    const base = JSON.parse(readFileSync(resolve(baselinePath), 'utf-8')) as Report;
    console.log(pairedVerdict(base, report));
  }
  return 0;
}

if (import.meta.main) process.exit(main());
