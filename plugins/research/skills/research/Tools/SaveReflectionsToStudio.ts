#!/usr/bin/env bun
/**
 * SaveReflectionsToStudio - Sync algorithm reflections to Studio Performance API
 *
 * Reads algorithm-reflections.jsonl and POSTs each entry to /api/v1/reflections.
 *
 * USAGE
 * -----
 *   bun SaveReflectionsToStudio.ts --import-all
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { queueOrPost, digestOfBody } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import {
  upcastReflectionJsonlEntry,
  type RuntimeReflection,
  type UpcastQuarantine,
} from '../Lib/upcasters/reflection-jsonl-entry';

// ---------------------------------------------------------------------------
// ENV
// ---------------------------------------------------------------------------

loadEnv();

// Mirror of SaveSignalsToStudio.ts:22-54 — global + per-project LEARNING
// dirs. Closes [R-reflections-global] (CLAUDE.md Appendix A): SaveReflections
// previously read only ~/.claude/MEMORY/LEARNING/REFLECTIONS, dropping all
// per-project reflections on the floor.
function getAllDirs(subdir: string): string[] {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, '.claude');
  const dirs: string[] = [];
  const seen = new Set<string>();

  const globalDir = join(dosDir, 'MEMORY', subdir);
  if (existsSync(globalDir)) { dirs.push(globalDir); seen.add(globalDir); }

  const projectsPath = join(dosDir, 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  if (existsSync(projectsPath)) {
    try {
      const content = readFileSync(projectsPath, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.startsWith('|') || line.includes('---') || line.includes('Path')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        const rawPath = cells[1];
        if (!rawPath || rawPath === '-') continue;
        // Expand $HOME / ${HOME} / ~ to match the canonical expandPath
        // (hooks/lib/paths.ts) — a PROJECTS.md row using $HOME was silently
        // skipped before because only the ~ prefix was handled. [hooks-003]
        const fullPath = rawPath
          .replace(/^\$HOME(?=\/|$)/, home)
          .replace(/^\$\{HOME\}(?=\/|$)/, home)
          .replace(/^~(?=\/|$)/, home);
        const projectDir = join(fullPath, 'MEMORY', subdir);
        if (!seen.has(projectDir) && existsSync(projectDir)) {
          dirs.push(projectDir);
          seen.add(projectDir);
        }
      }
    } catch { /* non-critical */ }
  }

  return dirs;
}

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveReflectionsToStudio');

// ---------------------------------------------------------------------------
// NORMALIZE
// ---------------------------------------------------------------------------

function normalizeEffort(effort: string): string {
  const e = effort.toLowerCase().trim();
  const valid = ['standard', 'extended', 'advanced', 'deep', 'comprehensive'];
  return valid.includes(e) ? e.toUpperCase() : 'STANDARD';
}

function sanitizeIso(ts: string | undefined): string | undefined {
  if (!ts) return undefined;
  // "2026-04-22T19:42:30Z-0300" is illegal ISO (Z + offset). new Date()
  // returns Invalid Date and z.coerce.date() rejects it. Keep the offset,
  // drop the Z — that's what the emitter meant.
  const m = ts.match(/^(.+)Z([+-]\d{2}:?\d{0,2})$/);
  return m ? `${m[1]}${m[2]}` : ts;
}

// ---------------------------------------------------------------------------
// SYNC
// ---------------------------------------------------------------------------

interface ReflectionEntry {
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

type SyncOutcome = 'synced' | 'failed' | 'skipped';

async function syncEntry(
  entry: ReflectionEntry,
  acked: Set<string>,
): Promise<SyncOutcome> {
  const body = {
    prdId: entry.prd_id,
    effort: normalizeEffort(entry.effort_level),
    taskDescription: entry.task_description,
    criteriaCount: entry.criteria_count,
    criteriaPassed: entry.criteria_passed,
    criteriaFailed: entry.criteria_failed,
    sentiment: Math.max(1, Math.min(10, entry.implied_sentiment)),
    withinBudget:
      typeof entry.within_budget === 'boolean' ? entry.within_budget : true,
    reflectionQ1: entry.reflection_q1 || undefined,
    reflectionQ2: entry.reflection_q2 || undefined,
    reflectionQ3: entry.reflection_q3 || undefined,
    reflectedAt: sanitizeIso(entry.timestamp),
  };

  // FIREWALL: one key, reused for both the dedup check and the
  // idempotencyKey. Never two separate expressions — a divergence here
  // would skip rows that then enqueue under a different key (silent loss)
  // or re-enqueue already-acked rows (DLQ re-flood, incident 2026-06-22).
  const key = `reflection:${entry.prd_id}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip

  const queueResult = await queueOrPost(body, '/api/v1/reflections', {
    tool: 'reflections',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${entry.prd_id}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

// ---------------------------------------------------------------------------
// CANONICAL SYNC (RFC-0115 — gated by DOS_REFLECTION_UPCAST_ENABLED)
// ---------------------------------------------------------------------------

const UPCAST_ENABLED =
  process.env.DOS_REFLECTION_UPCAST_ENABLED === '1' ||
  process.env.DOS_REFLECTION_UPCAST_ENABLED === 'true';

/**
 * Map a canonical RuntimeReflection (upcaster output) to the Studio POST body
 * and sync it. Canonical fields go top-level; the deprecated doctrine fields
 * are lifted out of `_doctrine_residual` to populate Studio's now-nullable
 * legacy columns when the source row carried them, and the full residual is
 * preserved as `doctrineResidual` for losslessness.
 */
async function syncRuntimeReflection(
  rr: RuntimeReflection,
  acked: Set<string>,
): Promise<SyncOutcome> {
  const residual = (rr._doctrine_residual ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;

  const body = {
    prdId: rr.prd_id,
    effort: normalizeEffort(rr.effort),
    sentiment: Math.max(1, Math.min(10, rr.implied_sentiment)),
    phase: rr.phase || undefined,
    reflection: rr.reflection || undefined,
    tags: rr.tags && rr.tags.length > 0 ? [...rr.tags] : undefined,
    runtimeSessionId: rr.session_id || undefined,
    reflectedAt: sanitizeIso(rr.timestamp),
    doctrineResidual: rr._doctrine_residual ? { ...residual } : undefined,
    taskDescription:
      typeof residual.task_description === 'string' ? residual.task_description : undefined,
    criteriaCount: num(residual.criteria_count),
    criteriaPassed: num(residual.criteria_passed),
    criteriaFailed: num(residual.criteria_failed),
    withinBudget:
      typeof residual.within_budget === 'boolean' ? residual.within_budget : undefined,
  };

  const key = `reflection:${rr.prd_id}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped';

  const queueResult = await queueOrPost(body, '/api/v1/reflections', {
    tool: 'reflections',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${rr.prd_id}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

/**
 * Persist an un-upcastable row to the upcaster's own quarantine (NOT Studio),
 * per RFC-0115 quarantine policy. Studio never sees malformed source rows.
 */
function quarantineUpcastFailure(learningDir: string, q: UpcastQuarantine): void {
  const dir = join(learningDir, 'REFLECTIONS', '.quarantine', 'upcast-failure');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${q.rowHash}.json`),
      JSON.stringify(
        {
          category: q.category,
          reason: q.reason,
          sourceLine: q.sourceLine,
          quarantinedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(`Quarantine write failed for ${q.rowHash}: ${String(e).slice(0, 120)}`);
  }
}

// ---------------------------------------------------------------------------
// IMPORT ALL
// ---------------------------------------------------------------------------

async function importAll(): Promise<void> {
  const learningDirs = getAllDirs('LEARNING');
  if (learningDirs.length === 0) {
    console.error('No LEARNING directories found');
    process.exit(0);
  }

  // Load already-acked idempotency keys ONCE — every row whose key is in
  // the ledger is skipped instead of re-enqueued. Without this the entire
  // corpus re-floods the DLQ each SessionEnd (incident 2026-06-22).
  const acked = loadAckedKeys("reflection:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;
  let quarantined = 0;
  let total = 0;

  for (const learningDir of learningDirs) {
    const filepath = join(learningDir, 'REFLECTIONS', 'algorithm-reflections.jsonl');
    if (!existsSync(filepath)) continue;

    const lines = readFileSync(filepath, 'utf-8').split('\n').filter((l) => l.trim());
    total += lines.length;

    for (const line of lines) {
      if (UPCAST_ENABLED) {
        // RFC-0115: normalize every heterogeneous source shape via the
        // upcaster; un-upcastable rows go to the upcaster quarantine, not Studio.
        const result = upcastReflectionJsonlEntry(line);
        if ('kind' in result && result.kind === 'quarantine') {
          quarantineUpcastFailure(learningDir, result);
          quarantined++;
          continue;
        }
        const outcome = await syncRuntimeReflection(result, acked);
        if (outcome === 'synced') synced++;
        else if (outcome === 'skipped') skipped++;
        else failed++;
      } else {
        // Legacy raw-read path (flag off — behavior unchanged).
        try {
          const entry = JSON.parse(line) as ReflectionEntry;
          if (!entry.prd_id || !entry.task_description) {
            failed++;
            continue;
          }
          const outcome = await syncEntry(entry, acked);
          if (outcome === 'synced') synced++;
          else if (outcome === 'skipped') skipped++;
          else failed++;
        } catch {
          failed++;
        }
      }
    }
  }

  console.error(
    `Import complete (${UPCAST_ENABLED ? 'upcast' : 'legacy'} mode): ${synced} synced, ${skipped} skipped, ${quarantined} quarantined, ${failed} failed (of ${total} total from ${learningDirs.length} dirs)`,
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveReflectionsToStudio.ts --import-all');
  process.exit(1);
}
