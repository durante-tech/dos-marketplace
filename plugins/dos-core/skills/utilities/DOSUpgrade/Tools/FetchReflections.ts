#!/usr/bin/env bun
/**
 * FetchReflections - Pull algorithm reflections from Studio for AlgorithmUpgrade
 *
 * Used by the MineReflections and AlgorithmUpgrade workflows to source
 * cross-session, cross-device reflection data from Studio's canonical record.
 *
 * Pipeline:
 *   1. Page GET /api/v1/reflections (cursor loop) for the list of records
 *   2. Hydrate each record's Q1/Q2/Q3 via GET /api/v1/reflections/{id}
 *      (list select omits the long text fields — see reflection.service.ts)
 *   3. Normalize camelCase Studio shape to snake_case JSONL schema that
 *      SaveReflectionsToStudio already uses for writes
 *   4. Optionally merge with local algorithm-reflections.jsonl, deduped by
 *      prd_id (Studio wins — it is the post-sync canonical record)
 *
 * Graceful degradation:
 *   - STUDIO_API_URL or STUDIO_API_KEY missing → stderr warn, local-only, exit 0
 *   - Studio HTTP error                        → stderr warn, local-only, exit 0
 *
 * Usage:
 *   bun FetchReflections.ts                       # Studio-only, all tiers
 *   bun FetchReflections.ts --merge-local         # Studio ∪ local (default in workflows)
 *   bun FetchReflections.ts --effort EXTENDED     # filter by effort tier
 *   bun FetchReflections.ts --limit 50            # cap total records
 *   bun FetchReflections.ts --help
 *
 * Future optimization: if Studio's list endpoint gains a ?include=text flag
 * (returning Q1/Q2/Q3 in the list select), drop the per-id detail N+1 and
 * fold hydration into the cursor loop.
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../../Lib/env';

// ---------------------------------------------------------------------------
// ENV LOADING — mirrors Packs/research/src/Tools/SaveReflectionsToStudio.ts
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SCHEMA
// ---------------------------------------------------------------------------

interface StudioReflectionListItem {
  id: string;
  prdId: string;
  effort: string;
  taskDescription: string;
  criteriaCount: number;
  criteriaPassed: number;
  criteriaFailed: number;
  sentiment: number;
  withinBudget: boolean;
  reflectedAt: string;
}

interface StudioReflectionDetail extends StudioReflectionListItem {
  reflectionQ1?: string | null;
  reflectionQ2?: string | null;
  reflectionQ3?: string | null;
}

interface JsonlReflection {
  timestamp: string;
  effort_level: string;
  task_description: string;
  criteria_count: number;
  criteria_passed: number;
  criteria_failed: number;
  prd_id: string;
  implied_sentiment: number;
  reflection_q1?: string;
  reflection_q2?: string;
  reflection_q3?: string;
  within_budget: boolean;
}

function toJsonl(r: StudioReflectionDetail): JsonlReflection {
  return {
    timestamp: r.reflectedAt,
    effort_level: r.effort.toLowerCase(),
    task_description: r.taskDescription,
    criteria_count: r.criteriaCount,
    criteria_passed: r.criteriaPassed,
    criteria_failed: r.criteriaFailed,
    prd_id: r.prdId,
    implied_sentiment: r.sentiment,
    ...(r.reflectionQ1 ? { reflection_q1: r.reflectionQ1 } : {}),
    ...(r.reflectionQ2 ? { reflection_q2: r.reflectionQ2 } : {}),
    ...(r.reflectionQ3 ? { reflection_q3: r.reflectionQ3 } : {}),
    within_budget: r.withinBudget,
  };
}

// ---------------------------------------------------------------------------
// STUDIO FETCH
// ---------------------------------------------------------------------------

async function fetchListPage(
  baseUrl: string,
  apiKey: string,
  opts: { cursor?: string; limit?: number; effort?: string },
): Promise<{ items: StudioReflectionListItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (opts.cursor) params.set('cursor', opts.cursor);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.effort) params.set('effort', opts.effort);
  const url = `${baseUrl}/api/v1/reflections${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Studio list fetch failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as {
    data: StudioReflectionListItem[];
    nextCursor: string | null;
  } as any;
}

async function fetchDetail(
  baseUrl: string,
  apiKey: string,
  id: string,
): Promise<StudioReflectionDetail | null> {
  const url = `${baseUrl}/api/v1/reflections/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Studio detail fetch failed for ${id}: ${response.status}`);
  }
  return (await response.json()) as StudioReflectionDetail;
}

async function hydrateWithPool<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!);
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchFromStudio(opts: {
  limit?: number;
  effort?: string;
}): Promise<JsonlReflection[]> {
  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const baseUrl = process.env.STUDIO_API_URL;
  const apiKey = process.env.STUDIO_API_KEY;
  if (!baseUrl || !apiKey) {
    console.error('fetchreflections: Studio env missing (STUDIO_API_URL/STUDIO_API_KEY), local-only mode');
    return [];
  }

  const pageSize = 100;
  const aggregated: StudioReflectionListItem[] = [];
  let cursor: string | undefined;
  let safety = 100;
  while (safety-- > 0) {
    const page: any = await fetchListPage(baseUrl, apiKey, {
      cursor,
      limit: pageSize,
      effort: opts.effort,
    });
    const items = (page.data ?? page.items ?? []) as StudioReflectionListItem[];
    aggregated.push(...items);
    if (opts.limit && aggregated.length >= opts.limit) break;
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  const capped = opts.limit ? aggregated.slice(0, opts.limit) : aggregated;
  const hydrated = await hydrateWithPool(
    capped,
    async (row) => {
      try {
        const detail = await fetchDetail(baseUrl, apiKey, row.id);
        return detail ?? ({ ...row } as StudioReflectionDetail);
      } catch (err) {
        console.error(`fetchreflections: detail fetch for ${row.id} failed: ${(err as Error).message}`);
        return { ...row } as StudioReflectionDetail;
      }
    },
    10,
  );
  return hydrated.map(toJsonl);
}

// ---------------------------------------------------------------------------
// LOCAL READ
// ---------------------------------------------------------------------------

// Mirror of SaveReflectionsToStudio.ts getAllDirs('LEARNING') — global +
// per-project REFLECTIONS dirs, honoring DOS_DIR. Closes the DOSUpgrade-side
// recurrence of [R-reflections-global] (CLAUDE.md Appendix A): reading only
// the global JSONL silently drops every per-project reflection.
function getAllReflectionJsonlPaths(): string[] {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, '.claude');
  const paths: string[] = [];
  const seen = new Set<string>();
  const push = (dir: string) => {
    const filepath = join(dir, 'MEMORY', 'LEARNING', 'REFLECTIONS', 'algorithm-reflections.jsonl');
    if (!seen.has(filepath) && existsSync(filepath)) {
      seen.add(filepath);
      paths.push(filepath);
    }
  };

  push(dosDir);

  const projectsPath = join(dosDir, 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  if (existsSync(projectsPath)) {
    try {
      const content = readFileSync(projectsPath, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.startsWith('|') || line.includes('---') || line.includes('Path')) continue;
        const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        const rawPath = cells[1];
        if (!rawPath || rawPath === '-') continue;
        const fullPath = rawPath
          .replace(/^\$HOME(?=\/|$)/, home)
          .replace(/^\$\{HOME\}(?=\/|$)/, home)
          .replace(/^~(?=\/|$)/, home);
        push(resolve(fullPath));
      }
    } catch {
      // unreadable PROJECTS.md → global-only, same degradation as SaveReflections
    }
  }
  return paths;
}

function readLocalJsonl(): JsonlReflection[] {
  const out: JsonlReflection[] = [];
  for (const filepath of getAllReflectionJsonlPaths()) {
    const lines = readFileSync(filepath, 'utf-8')
      .split('\n')
      .filter((l) => l.trim());
    for (const line of lines) {
      try {
        out.push(JSON.parse(line));
      } catch {
        // skip malformed line
      }
    }
  }
  return out;
}

function mergeStudioWins(studio: JsonlReflection[], local: JsonlReflection[]): JsonlReflection[] {
  const byId = new Map<string, JsonlReflection>();
  for (const entry of local) {
    if (entry.prd_id) byId.set(entry.prd_id, entry);
  }
  for (const entry of studio) {
    if (entry.prd_id) byId.set(entry.prd_id, entry);
  }
  return [...byId.values()].sort((a, b) =>
    (b.timestamp ?? '').localeCompare(a.timestamp ?? ''),
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.error(
    [
      'FetchReflections — pull algorithm reflections from Studio + local JSONL',
      '',
      'Usage:',
      '  bun FetchReflections.ts [flags]',
      '',
      'Flags:',
      '  --merge-local        Merge local algorithm-reflections.jsonl (Studio wins on conflict)',
      '  --effort <TIER>      Filter by effort tier (STANDARD|EXTENDED|ADVANCED|DEEP|COMPREHENSIVE)',
      '  --limit <N>          Cap total records returned',
      '  --help               Show this help',
      '',
      'Output: one JSONL record per line on stdout, matching the algorithm-reflections.jsonl schema.',
      'Studio unavailable (missing env or HTTP error) falls back to local-only output, exit 0.',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  loadEnv();

  const mergeLocal = args.includes('--merge-local');
  const effortIdx = args.indexOf('--effort');
  const effort = effortIdx >= 0 ? args[effortIdx + 1]?.toUpperCase() : undefined;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? '', 10) || undefined : undefined;

  let studio: JsonlReflection[] = [];
  try {
    studio = await fetchFromStudio({ limit, effort });
  } catch (err) {
    console.error(`fetchreflections: Studio fetch failed, falling back to local: ${(err as Error).message}`);
    studio = [];
  }

  const local = mergeLocal ? readLocalJsonl() : [];
  const merged = mergeStudioWins(studio, local);
  const capped = limit ? merged.slice(0, limit) : merged;

  for (const entry of capped) {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  console.error(
    `fetchreflections: ${studio.length} from Studio, ${local.length} from local, ${capped.length} emitted`,
  );
}

main().catch((err) => {
  console.error(`fetchreflections: fatal ${err?.message ?? err}`);
  process.exit(1);
});
