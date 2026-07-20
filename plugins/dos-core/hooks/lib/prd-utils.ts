// prd-utils.ts -- Shared PRD functions for hooks
//
// Used by: PRDSync.hook.ts (PostToolUse), PRDStateSync.hook.ts (Stop)
//
// Functions:
//   findLatestPRD() -- scan MEMORY/WORK/[slug]/PRD.md by mtime
//   parseFrontmatter() -- extract YAML frontmatter to object (RFC-0010 Phase 0: YAML-list-aware)
//   writeFrontmatterField() -- update single field in existing frontmatter
//   countCriteria() -- count checked/unchecked in Criteria section
//   syncToWorkJson() -- upsert session into work.json from frontmatter

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import { dosPath } from './paths';
import { isTerminalPhase } from './tab-constants';

export const WORK_DIR = dosPath('MEMORY', 'WORK');
export const WORK_JSON = dosPath('MEMORY', 'STATE', 'work.json');

// V14.2 migration (2026-05-13, RFC-0081 §3): the PRD parser primitives below
// moved to `@durante/prd`. Implementations are byte-identical to the prior
// V12.0 versions (the library was extracted from this file per V12.2). The
// DOS-runtime glue further down (findLatestPRD, work.json sync, session
// state, listRecentWorkDirs) remains in this file — it depends on hook-time
// concerns (filesystem layout, session registry) that don't belong in a
// generic PRD parser library.
//
// Re-exports preserve back-compat for any consumer importing from
// `./lib/prd-utils`. Per RFC-0112 D1, hooks route their PRD-parser imports
// THROUGH this module (not directly through `@durante/prd`) so the fail-soft
// resolution below covers every consumer in one place.
import type { Frontmatter, Criterion, PRDDocument } from '@durante/prd';
export type { Frontmatter, Criterion } from '@durante/prd';

// ─── RFC-0112: fail-soft @durante/prd resolution ───────────────────────────
// A fresh DOS install has no `node_modules` — a static `import ... from
// '@durante/prd'` fails the WHOLE hook module load, crashing the hook on
// every fire. This loader resolves the parser fail-soft instead:
//   1. workspace `@durante/prd` FIRST — D4: the maintainer's live edits win,
//      a stale vendored bundle never shadows fresh workspace source.
//   2. the vendored bundle SECOND — a fresh customer install with no
//      workspace falls back to the self-contained shipped artifact.
// On total failure it degrades LOUD (stderr — never silent, RedTeam F6) and
// the wrapper functions below return safe no-op values, so a consuming hook
// skips PRD-derived work rather than crashing. The try/catch wraps ONLY
// module resolution — never the DOS-glue functions further down, whose own
// crashes (fs errors in syncToWorkJson etc.) must surface, not be masked
// (RedTeam F4).
type PrdModule = typeof import('@durante/prd');

function loadPrdModule(): PrdModule | null {
  const candidates = ['@durante/prd', join(import.meta.dir, 'vendor', 'prd-bundle.js')];
  for (const spec of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(spec) as PrdModule;
    } catch { /* try the next candidate */ }
  }
  console.error(
    '[DOS RFC-0112] @durante/prd unresolvable (workspace package + vendored ' +
    'bundle both failed) — PRD parsing degraded. Provision the vendored ' +
    'bundle via `bun ~/Durante/Tools/bundle-hook-deps.ts`.',
  );
  return null;
}

const _prd: PrdModule | null = loadPrdModule();

/** True when the `@durante/prd` parser resolved; false on a degraded fresh install. */
export const prdAvailable: boolean = _prd !== null;

// Wrapper functions — delegate to the resolved parser, or return safe no-op
// values when degraded. Same call surface the prior static re-exports gave,
// so existing consumers (PRDSync, SessionContextSnapshot, prd-kg, …) need no
// signature change.
export function parseFrontmatter(content: string): Frontmatter | null {
  return _prd ? _prd.parseFrontmatter(content) : null;
}
export function getScalarField(
  fm: Frontmatter | Record<string, string | string[]> | null,
  name: string,
): string | undefined {
  return _prd ? _prd.getScalarField(fm, name) : undefined;
}
export function writeFrontmatterField(content: string, field: string, value: string): string {
  return _prd ? _prd.writeFrontmatterField(content, field, value) : content;
}
export function countCriteria(content: string): { checked: number; total: number } {
  return _prd ? _prd.countCriteria(content) : { checked: 0, total: 0 };
}
export function parseCriteriaList(content: string): Criterion[] {
  return _prd ? _prd.parseCriteriaList(content) : [];
}
export function detectFormatVersion(
  content: string,
): { status: 'valid' | 'missing' | 'invalid'; version?: 2 | 3; raw?: string } {
  return _prd ? _prd.detectFormatVersion(content) : { status: 'missing' };
}
export function parsePRDContent(content: string): PRDDocument {
  if (_prd) return _prd.parsePRDContent(content);
  return {
    formatVersion: undefined,
    frontmatter: {},
    sections: [],
    criteria: [],
    rawContent: content,
  } as unknown as PRDDocument;
}

export function findLatestPRD(): string | null {
  if (!existsSync(WORK_DIR)) return null;
  let latest: string | null = null;
  let latestMtime = 0;
  for (const dir of readdirSync(WORK_DIR)) {
    const prd = join(WORK_DIR, dir, 'PRD.md');
    try {
      const s = statSync(prd);
      if (s.mtimeMs > latestMtime) { latestMtime = s.mtimeMs; latest = prd; }
    } catch {}
  }
  return latest;
}

export function readRegistry(): { sessions: Record<string, any> } {
  try {
    const data = JSON.parse(readFileSync(WORK_JSON, 'utf-8'));
    return data.sessions ? data : { sessions: {} };
  } catch { return { sessions: {} }; }
}

export function writeRegistry(reg: { sessions: Record<string, any> }): void {
  mkdirSync(join(dosPath('MEMORY'), 'STATE'), { recursive: true });
  const tmp = WORK_JSON + '.tmp';
  writeFileSync(tmp, JSON.stringify(reg, null, 2));
  renameSync(tmp, WORK_JSON);
}

export function syncToWorkJson(fm: Frontmatter, prdPath: string, content?: string, sessionId?: string): void {
  // RFC-0010 Phase 0: fm values may be string[] (e.g., parent, supersedes).
  // work.json only consumes scalar PRD-authoring fields; narrow defensively here.
  const scalar = (k: string): string => getScalarField(fm, k) ?? '';
  const slug = scalar('slug');
  if (!slug) return;
  const dosDir = dosPath();
  const relativePrd = prdPath.replace(dosDir + '/', '');
  const registry = readRegistry();

  // Migration: if there's a 'starting' or 'native' placeholder entry for this session UUID,
  // remove it. PRDSync replaces it with the full PRD-based entry keyed by slug.
  if (sessionId) {
    for (const [oldSlug, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID === sessionId && (session.mode === 'starting' || session.mode === 'native') && oldSlug !== slug) {
        delete registry.sessions[oldSlug];
        break;
      }
    }
  }

  const existing = registry.sessions[slug] || {};
  const newPhase = scalar('phase') || 'observe';
  const timestamp = new Date().toISOString();

  // Look up the 4-word session name from session-names.json (authoritative source)
  let sessionName = existing.sessionName || '';
  if (sessionId) {
    try {
      const namesPath = dosPath('MEMORY', 'STATE', 'session-names.json');
      if (existsSync(namesPath)) {
        const names = JSON.parse(readFileSync(namesPath, 'utf-8'));
        if (names[sessionId]) sessionName = names[sessionId];
      }
    } catch {}
  }

  // Construct phaseHistory: append entry when phase changes
  const phaseHistory: any[] = existing.phaseHistory || [];
  const lastPhase = phaseHistory.length > 0 ? phaseHistory[phaseHistory.length - 1] : null;
  if (!lastPhase || lastPhase.phase !== newPhase.toUpperCase()) {
    // Close previous phase
    if (lastPhase && !lastPhase.completedAt) {
      lastPhase.completedAt = Date.now();
    }
    phaseHistory.push({
      phase: newPhase.toUpperCase(),
      startedAt: Date.now(),
      criteriaCount: 0,
      agentCount: 0,
    });
  }

  // Parse criteria from PRD content if available
  const criteria = content ? parseCriteriaList(content) : (existing.criteria || []);

  // Update criteriaCount on current phase entry
  if (phaseHistory.length > 0) {
    phaseHistory[phaseHistory.length - 1].criteriaCount = criteria.length;
  }

  const iterationStr = scalar('iteration');
  registry.sessions[slug] = {
    prd: relativePrd,
    task: scalar('task'),
    sessionName: sessionName || undefined,
    sessionUUID: sessionId || existing.sessionUUID || undefined,
    phase: newPhase,
    progress: scalar('progress') || '0/0',
    effort: scalar('effort') || 'standard',
    mode: scalar('mode') || 'interactive',
    started: scalar('started') || timestamp,
    updatedAt: timestamp,
    criteria,
    structuredCriteria: {
      version: 'rfc-0001',
      source: 'PRD.md',
      criteria,
      projection: {
        phase: newPhase,
        progress: scalar('progress') || '0/0',
        effort: scalar('effort') || 'standard',
      },
    },
    phaseHistory,
    ...(iterationStr ? { iteration: parseInt(iterationStr) || 1 } : {}),
  };

  // Clean stale sessions:
  // - Completed sessions older than 24h
  // - Any non-complete session older than 7 days (prevents unbounded growth)
  const now = Date.now();
  const SEVEN_DAYS = 7 * 86400000;
  for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
    const updated = new Date(session.updatedAt || session.started || 0).getTime();
    if (isTerminalPhase(session.phase) && now - updated > 86400000) {
      delete registry.sessions[slug];
    } else if (now - updated > SEVEN_DAYS) {
      delete registry.sessions[slug];
    }
  }

  writeRegistry(registry);
}

/** Update sessionName in work.json for a given session UUID. Called by SessionAutoName on name upgrade.
 *  Only updates the most recent non-complete entry for the UUID to avoid keeping stale entries alive. */
export function updateSessionNameInWorkJson(sessionUUID: string, sessionName: string): void {
  try {
    const registry = readRegistry();
    // Find the most recent non-complete entry for this UUID
    let bestSlug: string | null = null;
    let bestTime = 0;
    for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID !== sessionUUID) continue;
      if (isTerminalPhase(session.phase)) continue;
      const t = new Date(session.updatedAt || session.started || 0).getTime();
      if (t > bestTime) { bestTime = t; bestSlug = slug; }
    }
    if (bestSlug) {
      registry.sessions[bestSlug].sessionName = sessionName;
      registry.sessions[bestSlug].updatedAt = new Date().toISOString();
      writeRegistry(registry);
    }
  } catch {}
}

/**
 * Upsert a session into work.json — handles BOTH native and algorithm modes.
 * Called by SessionAutoName on first prompt for ALL sessions.
 *
 * For native mode: phase='native', stays as-is (updated by subsequent prompts).
 * For algorithm mode: phase='starting', replaced by PRDSync when PRD.md is written.
 *
 * On subsequent prompts, only updates `updatedAt` to keep the session "alive".
 */
export function upsertSession(sessionUUID: string, sessionName: string, task: string, mode: 'native' | 'starting' = 'native'): void {
  try {
    const registry = readRegistry();
    const timestamp = new Date().toISOString();

    // Check if this session already has an entry (by UUID match, native or starting)
    let existingSlug: string | null = null;
    for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID === sessionUUID && (session.mode === 'native' || session.mode === 'starting')) {
        existingSlug = slug;
        break;
      }
    }

    if (existingSlug) {
      // Session exists — just bump updatedAt
      registry.sessions[existingSlug].updatedAt = timestamp;
      if (sessionName) registry.sessions[existingSlug].sessionName = sessionName;
    } else {
      // New session — create lightweight entry
      // Generate slug from timestamp + sanitized task
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const datePrefix = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}00`;
      const taskSlug = (task || sessionName || 'session')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
      const slug = `${datePrefix}_${taskSlug}`;

      registry.sessions[slug] = {
        task: task || sessionName || (mode === 'native' ? 'Native session' : 'Starting...'),
        sessionName: sessionName || undefined,
        sessionUUID: sessionUUID,
        phase: mode === 'native' ? 'native' : 'starting',
        progress: '0/0',
        effort: mode === 'native' ? 'native' : 'standard',
        mode: mode,
        started: timestamp,
        updatedAt: timestamp,
      };
    }

    writeRegistry(registry);
  } catch {}
}

/** @deprecated Use upsertSession instead */
export const upsertNativeSession = upsertSession;

// ─── Session-context shared helpers (used by SessionContextSnapshot + daemon) ──

export interface WorkSummary {
  task: string;
  slug: string;
  phase: string;
  progress: string;
  decisions: string[];
  unfinished: boolean;
  context: string;
  sessionName: string;
  uncheckedCriteria: string[];
}

export interface WorkDirEntry {
  dirName: string;
  prdPath: string;
  dirTimeMs: number;
}

/**
 * Enumerate recent WORK/ directories matching the `YYYYMMDD-HHMMSS_slug` pattern.
 * Callers parse the PRD themselves via parseFrontmatter or ad-hoc regex.
 *
 * - `limit` caps the number of matches returned (after sort).
 * - `cutoffMs` drops entries older than now-cutoffMs. Iteration is newest-first,
 *   so this bounds the scan.
 * - `workDir` defaults to the caller-resolved WORK_DIR (pass getWorkDir()).
 */
export function listRecentWorkDirs(opts: {
  workDir: string;
  limit?: number;
  cutoffMs?: number;
}): WorkDirEntry[] {
  const { workDir, limit = 10, cutoffMs } = opts;
  if (!existsSync(workDir)) return [];

  const now = Date.now();
  const entries: WorkDirEntry[] = [];

  try {
    // Gather timestamp-named PRD dirs from the flat root AND the RFC-0037
    // active/archived buckets. The buckets hold the MAJORITY of the corpus
    // (134 active vs 128 flat at last count) including the most recent work;
    // the old flat-only scan was blind to all of them, so the next-session
    // snapshot silently dropped every migrated PRD (H-059). dirName is the
    // timestamp-prefixed slug, so it sorts correctly across containers.
    const candidates: Array<{ dirName: string; container: string }> = [];
    for (const container of [workDir, join(workDir, 'active'), join(workDir, 'archived')]) {
      let names: string[];
      try { names = readdirSync(container); } catch { continue; }
      for (const n of names) {
        if (/^\d{8}-\d{6}_/.test(n)) candidates.push({ dirName: n, container });
      }
    }
    // Newest-first; break on cutoff stays valid because the list is sorted desc.
    candidates.sort((a, b) => b.dirName.localeCompare(a.dirName));

    const seen = new Set<string>();
    for (const { dirName, container } of candidates) {
      if (seen.has(dirName)) continue; // a slug can't be in two buckets; first (newest sort) wins
      const match = dirName.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/);
      if (!match) continue;
      const [, y, mo, d, h, mi, s] = match;
      const dirTimeMs = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();
      if (cutoffMs !== undefined && now - dirTimeMs > cutoffMs) break;

      const prdPath = join(container, dirName, 'PRD.md');
      if (!existsSync(prdPath)) continue;
      seen.add(dirName);
      entries.push({ dirName, prdPath, dirTimeMs });
      if (entries.length >= limit) break;
    }
  } catch { /* swallow — caller treats empty as "nothing to do" */ }

  return entries;
}
