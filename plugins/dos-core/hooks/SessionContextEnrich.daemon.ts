#!/usr/bin/env bun
/**
 * SessionContextEnrich.daemon.ts - Detached KG + MemPalace enrichment for snapshots
 *
 * PURPOSE:
 * Heavy async counterpart of SessionContextSnapshot.hook.ts. The foreground
 * hook writes a basic snapshot (Resume Briefing, Last Session, Open Threads,
 * Active Corrections) synchronously and exits in <200ms. This daemon runs
 * detached and overwrites the snapshot with an enriched version containing
 * sections 4-7 (Project Knowledge, Deep Memory, Open Commitments, Conflicts).
 *
 * WHY THIS EXISTS:
 * Root cause: the original unified hook was killed by Claude Code's SessionEnd
 * reaper on ~80% of runs with a real project wing. The 1-3s of MemPalace
 * bridge work exceeded the budget. Splitting means the fast basic snapshot
 * is guaranteed; enrichment is best-effort and survives parent teardown
 * because this process is reparented to launchd via detached spawn + unref.
 *
 * INPUT:
 * Environment variable `DOS_ENRICH_INPUT_FILE` points to a JSON temp file
 * written by the foreground hook containing:
 *   { wing, work, basicSnapshot, snapshotPath, validFrom }
 * The temp file is unlinked by this daemon after read.
 *
 * OUTPUT:
 * - Writes enriched snapshot to `${snapshotPath}.tmp` then atomic-renames.
 * - Appends phase entries to `~/.claude/MEMORY/STATE/hook-bg.jsonl`.
 */

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  bridgeAsync,
  batchOps,
  writeKgWrittenFactsAtomic,
  getKgWrittenFactsPath,
  type BridgeOp,
  type BridgeResult,
} from './lib/mempalace';
import { daemonHealth } from './lib/mempalace-daemon';
import { ensureDaemon } from './lib/mempalace-daemon-ensure';
import { startTimer, stopTimer } from './lib/hook-io';
import { getWorkDir } from './lib/paths';
import { listRecentWorkDirs, type WorkSummary } from './lib/prd-utils';
import { isTerminalPhase } from './lib/tab-constants';
import { logBg as logBgBase } from './lib/detachWorker';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');

// MemPalace drawer-count cache (Section 8) — decouples the stats line from the
// ~5.3s `status` aggregation over 54k+ drawers that timed out at the old 3s
// budget AND hogged the serial host-singleton bridge daemon at SessionStart,
// starving the inline MemPalaceWakeUp live-KG reads. Section 8 reads this cache
// (no daemon call); refreshMemoryStatsCache repopulates it off the hot path,
// TTL-gated. [WORK 20260626-164827_mempalace-degraded-decouple]
const MEMORY_STATS_CACHE_PATH = join(DOS_DIR, 'MEMORY', 'STATE', 'memory-stats-cache.json');
const MEMORY_STATS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — drawer count is slow-moving
const MEMORY_STATS_REFRESH_BUDGET_MS = 12_000;    // > cold `status` ~5.3s; runs post-snapshot, off the hot path
const WORK_DIR = getWorkDir();
const HOOK_NAME = 'SessionContextEnrich';

function logBg(entry: Record<string, unknown>): void {
  logBgBase({ hook: HOOK_NAME, mode: 'bg', ...entry });
}

interface DaemonInput {
  wing: string | null;
  work: WorkSummary | null;
  basicSnapshot: string;
  snapshotPath: string;
  validFrom: string;
}

// ─── Written Facts persistence ──────────────────────────────

interface WrittenFact {
  object: string;
  valid_from: string;
}
type WrittenFactsMap = Map<string, WrittenFact>;

function getWrittenFactsPath(): string {
  // RFC-0027 §5.4: canonical path lives in lib/mempalace; this wrapper kept
  // for backward compat with local call sites (e.g., migrateLegacyFactsFile).
  return getKgWrittenFactsPath();
}

function loadWrittenFacts(): WrittenFactsMap {
  const path = getWrittenFactsPath();
  try {
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      if (data.facts && typeof data.facts === 'object' && !Array.isArray(data.facts)) {
        return new Map(Object.entries(data.facts as Record<string, WrittenFact>));
      }
    }
  } catch { /* first run or corrupt */ }
  return new Map();
}

/**
 * Persist the writtenFacts Map. RFC-0027 §5.4 routes this through
 * writeKgWrittenFactsAtomic so concurrent SessionEnds serialize on a
 * file lock and never produce torn writes. Returns silently on lock
 * timeout or filesystem failure — the file is non-critical state.
 */
function saveWrittenFacts(facts: WrittenFactsMap): void {
  const entries = [...facts.entries()].slice(-200);
  const obj = Object.fromEntries(entries);
  writeKgWrittenFactsAtomic({ facts: obj, updated: new Date().toISOString() });
}

/** Legacy facts-file format detection — one-time migration from the pre-v3
 * `{facts: string[]}` schema. Invalidations go through `batchOps` so a
 * palace with hundreds of legacy entries doesn't serially spawn hundreds
 * of subprocesses on first cold start (worst-case was 100 facts × ~500ms
 * = 50s before batching). */
function migrateLegacyFactsFile(): boolean {
  const path = getWrittenFactsPath();
  if (!existsSync(path)) return false;

  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return false;
  }

  const d = data as { facts?: unknown };
  if (!d.facts || !Array.isArray(d.facts)) return false;

  const legacyFacts = d.facts as string[];
  if (legacyFacts.length === 0) return false;

  type LegacyItem = { op: BridgeOp };
  const items: LegacyItem[] = [];
  for (const entry of legacyFacts) {
    const firstColon = entry.indexOf(':');
    if (firstColon === -1) continue;
    const secondColon = entry.indexOf(':', firstColon + 1);
    if (secondColon === -1) continue;
    const subject = entry.slice(0, firstColon);
    const predicate = entry.slice(firstColon + 1, secondColon);
    const object = entry.slice(secondColon + 1);
    if (!subject || !predicate || !object) continue;
    items.push({
      op: { action: 'invalidate', args: { subject, predicate, object: object.slice(0, 200) } },
    });
  }

  const result = batchOps(items, { logFn: logBg });

  saveWrittenFacts(new Map());
  logBg({ phase: 'legacy-migration', invalidated: result.ok, total: legacyFacts.length });
  return true;
}

// ─── Bridge op planner (batch-first) ──────────────────────────────
//
// enrichKG was previously N sequential bridgeSync calls — each paying the
// full uv subprocess startup (~300-800ms). On a typical SessionEnd with 5
// decisions + 1 working_on + 5 stack techs + blockers, that's ~12 round
// trips ≈ 4-8s of bridge time. Planning collects all ops into a list which
// `batchOps` fires via `bridge.batch` (one subprocess, shared ChromaDB + KG
// connection), then each PlannedOp's `apply` callback mutates writtenFacts
// based on per-op success. See lib/mempalace.ts batchOps for the fallback
// semantics (partial results preserved; outright batch failure falls back
// to per-call bridgeSync).

type StatKey = 'written' | 'superseded' | 'invalidated';

interface PlannedOp {
  op: BridgeOp;
  /** Mutation applied to `writtenFacts` when this op succeeds. */
  apply: (facts: WrittenFactsMap) => void;
  /** Stats bucket to increment on success. */
  statKey: StatKey;
}

function planInvalidate(
  subject: string,
  predicate: string,
  object: string,
  writtenFactsKey: string,
  statKey: StatKey,
): PlannedOp {
  const trimmedObject = object.substring(0, 200);
  return {
    op: { action: 'invalidate', args: { subject, predicate, object: trimmedObject } },
    apply: (facts) => { facts.delete(writtenFactsKey); },
    statKey,
  };
}

function planAddFact(
  subject: string,
  predicate: string,
  object: string,
  validFrom: string,
  writtenFactsKey: string,
  statKey: StatKey,
): PlannedOp {
  const trimmedObject = object.substring(0, 200);
  return {
    op: { action: 'add_kg_fact', args: { subject, predicate, object: trimmedObject, valid_from: validFrom } },
    apply: (facts) => { facts.set(writtenFactsKey, { object, valid_from: validFrom }); },
    statKey,
  };
}

/**
 * Plan the upsert of (subject, predicate, object). Pushes 0-2 ops:
 *   - 0 ops when existing fact already matches the new object (unchanged)
 *   - 1 op when writing a net-new value (add_kg_fact only)
 *   - 2 ops when superseding a single-valued prior (invalidate + add_kg_fact)
 * Returns the unchanged-hit count so the caller can tally it against
 * EnrichStats.unchanged (which does NOT involve a bridge round trip).
 */
function planUpsert(
  subject: string,
  predicate: string,
  object: string,
  validFrom: string,
  writtenFacts: WrittenFactsMap,
  opts: { singleValued: boolean },
  planned: PlannedOp[],
): { unchanged: boolean } {
  const key = opts.singleValued
    ? `${subject}:${predicate}`
    : `${subject}:${predicate}:${object.substring(0, 100)}`;

  const existing = writtenFacts.get(key);
  if (existing && existing.object === object) return { unchanged: true };

  const supersedes = opts.singleValued && !!existing;
  if (supersedes) {
    // singleValued supersede reuses the SAME key for the outgoing fact
    planned.push(planInvalidate(subject, predicate, existing!.object, key, 'superseded'));
  }
  planned.push(
    planAddFact(subject, predicate, object, validFrom, key, supersedes ? 'superseded' : 'written'),
  );
  return { unchanged: false };
}

/**
 * Plan invalidations for tracked facts whose object is no longer in the
 * current set. Read-only over `writtenFacts` — no shallow copy needed since
 * we only push to `planned` (the facts Map is mutated later by `apply`).
 */
function planInvalidateMissing(
  subject: string,
  predicate: string,
  currentObjects: string[],
  writtenFacts: WrittenFactsMap,
  planned: PlannedOp[],
): void {
  const keyPrefix = `${subject}:${predicate}:`;
  const currentSet = new Set(currentObjects);
  for (const [key, val] of writtenFacts) {
    if (!key.startsWith(keyPrefix)) continue;
    if (currentSet.has(val.object)) continue;
    planned.push(planInvalidate(subject, predicate, val.object, key, 'invalidated'));
  }
}

interface ExecStats { written: number; superseded: number; invalidated: number; failed: number }

function executePlanned(planned: PlannedOp[], writtenFacts: WrittenFactsMap): ExecStats {
  const exec: ExecStats = { written: 0, superseded: 0, invalidated: 0, failed: 0 };
  batchOps(planned, {
    onSuccess: (p) => {
      p.apply(writtenFacts);
      exec[p.statKey]++;
    },
    onFailure: () => { exec.failed++; },
    logFn: logBg,
  });
  return exec;
}

// ─── Project metadata helpers ──────────────────────────────

function getProjectStack(wing: string): string[] {
  const projectsPath = join(DOS_DIR, 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  try {
    if (!existsSync(projectsPath)) return [];
    const content = readFileSync(projectsPath, 'utf-8');
    const allLines = content.split('\n');

    const headerLine = allLines.find(l => /\|\s*Project\s*\|/i.test(l));
    if (!headerLine) return [];
    const headers = headerLine.split('|').map(c => c.trim().toLowerCase()).filter(Boolean);
    const stackIdx = headers.indexOf('stack');
    if (stackIdx === -1) return [];

    const wingLines = allLines.filter(l => l.includes('|') && l.includes(wing));
    for (const line of wingLines) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length > stackIdx) {
        return cols[stackIdx].split(',').map(s => s.trim()).filter(Boolean);
      }
    }
  } catch (err) {
    logBg({ phase: 'get-stack-error', error: String(err).slice(0, 200) });
  }
  return [];
}

function getRecentBlockers(): string[] {
  const blockers: string[] = [];
  const entries = listRecentWorkDirs({
    workDir: WORK_DIR,
    limit: 10,
    cutoffMs: 72 * 60 * 60 * 1000,
  });

  for (const { prdPath } of entries) {
    try {
      const content = readFileSync(prdPath, 'utf-8');
      const phase = content.match(/^phase:\s*"?(\w+)"?/m)?.[1];
      if (isTerminalPhase(phase)) continue;

      const unchecked = content.match(/- \[ \] ISC-\d+:\s*(.+)/g);
      if (unchecked && unchecked.length > 0) {
        for (const line of unchecked.slice(0, 3)) {
          const text = line.replace(/- \[ \] ISC-\d+:\s*/, '').trim();
          if (text.length > 10) blockers.push(text.substring(0, 120));
        }
      }
    } catch { /* skip */ }

    if (blockers.length >= 5) break;
  }

  return blockers;
}

// ─── enrichKG ──────────────────────────────

interface EnrichStats {
  written: number;
  superseded: number;
  invalidated: number;
  unchanged: number;
}

function enrichKG(work: WorkSummary | null, projectWing: string, today: string): EnrichStats {
  const stats: EnrichStats = { written: 0, superseded: 0, invalidated: 0, unchanged: 0 };
  const writtenFacts = loadWrittenFacts();
  const planned: PlannedOp[] = [];

  if (work) {
    for (const decision of work.decisions.slice(0, 5)) {
      const match = decision.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\s*(.+)$/);
      const validFrom = match ? match[1] : today;
      const text = match ? match[2] : decision;
      const { unchanged } = planUpsert(
        projectWing, 'decided', text, validFrom,
        writtenFacts, { singleValued: false }, planned,
      );
      if (unchanged) stats.unchanged++;
    }

    // working_on and completed share a task but live under different keys, so
    // planUpsert's built-in supersession won't cross-invalidate between them.
    // Plan it explicitly here.
    const predicate = work.unfinished ? 'working_on' : 'completed';
    const otherPredicate = work.unfinished ? 'completed' : 'working_on';
    const otherKey = `${projectWing}:${otherPredicate}`;
    const otherExisting = writtenFacts.get(otherKey);
    if (otherExisting && otherExisting.object === work.task) {
      planned.push(planInvalidate(projectWing, otherPredicate, otherExisting.object, otherKey, 'invalidated'));
    }
    const { unchanged } = planUpsert(
      projectWing, predicate, work.task, today,
      writtenFacts, { singleValued: true }, planned,
    );
    if (unchanged) stats.unchanged++;
  }

  const stack = getProjectStack(projectWing);
  planInvalidateMissing(projectWing, 'uses', stack, writtenFacts, planned);
  for (const tech of stack) {
    const { unchanged } = planUpsert(
      projectWing, 'uses', tech, today,
      writtenFacts, { singleValued: false }, planned,
    );
    if (unchanged) stats.unchanged++;
  }

  const blockers = getRecentBlockers();
  planInvalidateMissing(projectWing, 'blocked_by', blockers, writtenFacts, planned);
  for (const blocker of blockers) {
    const { unchanged } = planUpsert(
      projectWing, 'blocked_by', blocker, today,
      writtenFacts, { singleValued: false }, planned,
    );
    if (unchanged) stats.unchanged++;
  }

  const exec = executePlanned(planned, writtenFacts);
  stats.written = exec.written;
  stats.superseded = exec.superseded;
  stats.invalidated = exec.invalidated;

  if (stats.written + stats.superseded + stats.invalidated > 0) {
    saveWrittenFacts(writtenFacts);
  }

  return stats;
}

// ─── Commitment Conflict Detection ──────────────────────────────

interface ConflictDescription {
  assignee: string;
  commitmentA: string;
  wingA: string;
  deadlineA: string;
  commitmentB: string;
  wingB: string;
  deadlineB: string;
}

function parseDeadlineFromObject(object: string): { text: string; deadlineIso: string | null } {
  const match = object.match(/\[deadline:\s*(\d{4}-\d{2}-\d{2})\]/);
  if (match) {
    const text = object.replace(/\s*\[deadline:\s*\d{4}-\d{2}-\d{2}\]/, '').trim();
    return { text, deadlineIso: match[1] };
  }
  return { text: object, deadlineIso: null };
}

/** Detect conflicts from a pre-fetched `committed_to` fact set. Keeping the
 * fetch out of this function lets callers share one bridge round-trip across
 * section 6 (wing-scoped commitments) and section 7 (global conflict scan). */
function detectConflicts(allFacts: any[]): ConflictDescription[] {
  const active = allFacts.filter((f: any) => f.current !== false);
  if (active.length < 2) return [];

  const entries = active.map((f: any) => {
    const { text, deadlineIso } = parseDeadlineFromObject(f.object || '');
    return {
      subject: f.subject || 'unknown',
      object: text,
      deadlineIso,
      wing: f.metadata?.wing || 'unknown',
      validFrom: f.valid_from || '',
    };
  }).filter((e) => e.deadlineIso !== null);

  if (entries.length < 2) return [];

  const byAssignee = new Map<string, typeof entries>();
  for (const entry of entries) {
    const group = byAssignee.get(entry.subject) || [];
    group.push(entry);
    byAssignee.set(entry.subject, group);
  }

  const conflicts: ConflictDescription[] = [];
  const OVERLAP_THRESHOLD_DAYS = 3;

  for (const [assignee, commitments] of byAssignee) {
    if (commitments.length < 2) continue;

    for (let i = 0; i < commitments.length; i++) {
      for (let j = i + 1; j < commitments.length; j++) {
        const a = commitments[i];
        const b = commitments[j];
        if (a.wing === b.wing && a.wing !== 'unknown') continue;

        const dateA = new Date(a.deadlineIso!);
        const dateB = new Date(b.deadlineIso!);
        const diffDays = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays <= OVERLAP_THRESHOLD_DAYS) {
          conflicts.push({
            assignee,
            commitmentA: a.object.substring(0, 80),
            wingA: a.wing,
            deadlineA: a.deadlineIso!,
            commitmentB: b.object.substring(0, 80),
            wingB: b.wing,
            deadlineB: b.deadlineIso!,
          });
        }
      }
    }
  }

  return conflicts;
}

// ─── Enrichment section builders (parallel via Promise.all) ─────────────

async function fetchSection4(projectWing: string): Promise<string[]> {
  const parts: string[] = [];
  const kgResult: BridgeResult = await bridgeAsync('kg_timeline', { entity: projectWing }, 3000);
  if (!kgResult.ok) return parts;
  const tl = (kgResult.data as any).timeline;
  if (!Array.isArray(tl) || tl.length === 0) return parts;

  const currentFacts = tl.filter((f: any) => f.current).slice(0, 10);
  if (currentFacts.length === 0) return parts;

  parts.push(`## Project Knowledge (${projectWing})`);
  for (const f of currentFacts) {
    parts.push(`- **${f.predicate}:** ${f.object} _(since ${f.valid_from})_`);
  }
  parts.push('');
  return parts;
}

async function fetchSection5(projectWing: string): Promise<string[]> {
  const parts: string[] = [];
  const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
  if (!claudeProjectDir) return parts;
  // Claude Code's auto-memory does NOT live inside the project directory. It lives at
  // ~/.claude/projects/<encoded-project-path>/memory/MEMORY.md, where the encoding maps
  // both '/' and '.' to '-' (the same encoding as SubagentArtifactSync, Forge H-088).
  // Building `${CLAUDE_PROJECT_DIR}/memory/MEMORY.md` pointed at a path that never exists,
  // so this "Deep Memory (cross-index)" enrichment section was always silently empty and
  // the resume briefing never surfaced it. (Forge H-115.)
  const encoded = '-' + claudeProjectDir.replace(/^\//, '').replace(/[/.]/g, '-');
  const memoryMdPath = join(homedir(), '.claude', 'projects', encoded, 'memory', 'MEMORY.md');
  if (!existsSync(memoryMdPath)) return parts;

  const memoryContent = readFileSync(memoryMdPath, 'utf-8');
  const topics = memoryContent
    .split('\n')
    .filter(l => l.startsWith('- ['))
    .map(l => {
      const dashMatch = l.match(/— (.+)$/);
      return dashMatch ? dashMatch[1].trim() : '';
    })
    .filter(t => t.length > 10)
    .slice(0, 3);

  if (topics.length === 0) return parts;

  // Parallelize the topic searches — they're independent.
  const searchResults = await Promise.all(
    topics.map(topic => bridgeAsync('search', { query: topic, limit: 1, wing: projectWing }, 1500)
      .then((data): { topic: string; result: BridgeResult } => ({ topic, result: data }))),
  );

  const crossResults: string[] = [];
  for (const { topic, result } of searchResults) {
    if (!result.ok) continue;
    const results = ((result.data as any).results || []) as any[];
    if (results.length === 0) continue;
    const r = results[0];
    const content = (r.content || r.document || '').substring(0, 300);
    const room = r.metadata?.room || 'unknown';
    if (content.length > 50 && !topic.toLowerCase().includes(content.substring(0, 30).toLowerCase())) {
      crossResults.push(`**${room}:** ${content}`);
    }
    if (crossResults.join('\n').length > 1500) break;
  }

  if (crossResults.length === 0) return parts;

  parts.push(`## Deep Memory (cross-index)`);
  for (const cr of crossResults) {
    parts.push(cr);
    parts.push('');
  }
  return parts;
}

/** Sections 6 + 7 share a global `committed_to` fetch: section 6 filters it
 * to the current wing for the commitments list, section 7 inspects the full
 * set for cross-wing deadline collisions. One bridge call instead of two.
 * Section 6 also needs `deferred` which is wing-specific — fetched in parallel. */
async function fetchSections6And7(projectWing: string): Promise<string[]> {
  const parts: string[] = [];

  const [allCommitmentsResult, deferResult] = await Promise.all([
    bridgeAsync('kg_query_predicate', { predicate: 'committed_to' }, 3000),
    bridgeAsync('kg_query_predicate', { predicate: 'deferred', wing: projectWing }, 3000),
  ]);

  const allCommitments = allCommitmentsResult.ok
    ? (((allCommitmentsResult.data as any).facts || []) as any[])
    : [];

  const openCommitments = allCommitments
    .filter((f: any) => f.current !== false)
    .filter((f: any) => {
      const subj = (f.subject || '') as string;
      return subj === projectWing || subj === `project:${projectWing}`;
    })
    .slice(0, 8);
  const activeDeferrals = deferResult.ok
    ? (((deferResult.data as any).facts || []) as any[])
        .filter((f: any) => f.current !== false)
        .slice(0, 5)
    : [];

  if (openCommitments.length > 0 || activeDeferrals.length > 0) {
    parts.push(`## Open Commitments`);
    if (openCommitments.length > 0) {
      parts.push(`**${openCommitments.length} active commitment(s):**`);
      for (const c of openCommitments.slice(0, 5)) {
        parts.push(`- ${c.object} _(since ${c.valid_from})_`);
      }
      if (openCommitments.length > 5) {
        parts.push(`- _...and ${openCommitments.length - 5} more_`);
      }
    }
    if (activeDeferrals.length > 0) {
      parts.push(`\n**${activeDeferrals.length} deferred item(s):**`);
      for (const d of activeDeferrals.slice(0, 3)) {
        parts.push(`- ${d.object} _(deferred ${d.valid_from})_`);
      }
    }
    parts.push('');
  }

  const conflicts = detectConflicts(allCommitments);
  if (conflicts.length > 0) {
    parts.push(`## Commitment Conflicts`);
    for (const c of conflicts.slice(0, 5)) {
      parts.push(`- ${c.assignee} committed to "${c.commitmentA}" (${c.wingA}, by ${c.deadlineA}) AND "${c.commitmentB}" (${c.wingB}, by ${c.deadlineB}) -- overlapping deadlines`);
    }
    parts.push('');
  }

  return parts;
}

/** Section 8 — Memory Stats snapshot. Reports drawer + KG fact counts for the
 * current wing, total drawers across the palace, and the timestamps of the
 * last MemoryHarvest run and the most recent algorithm reflection. Pure
 * read-only — never writes to the palace or KG. Bridge errors degrade the
 * section to a single "(stats unavailable — bridge error)" line so the rest
 * of the snapshot still ships. */
async function fetchSection8MemoryStats(projectWing: string | null): Promise<string[]> {
  const parts: string[] = [];
  const wing = projectWing || 'global';
  const snapshotTs = new Date().toISOString();
  parts.push(`## Memory Stats (snapshot ${snapshotTs})`);

  let drawersInWing: number | null = null;
  let totalDrawers: number | null = null;
  let kgFacts: number | null = null;

  // Drawer counts come from the TTL cache (memory-stats-cache.json), NOT a live
  // `status` call: status aggregates all 54k+ drawers (~5.3s), timed out at the
  // old 3s budget, and hogged the serial host-singleton bridge daemon — starving
  // the inline MemPalaceWakeUp live-KG reads. refreshMemoryStatsCache repopulates
  // this off the hot path. [WORK 20260626-164827_mempalace-degraded-decouple]
  let cacheAgeMs: number | null = null;
  try {
    if (existsSync(MEMORY_STATS_CACHE_PATH)) {
      const cache = JSON.parse(readFileSync(MEMORY_STATS_CACHE_PATH, 'utf-8')) as {
        total_drawers?: number; wings?: Record<string, number>;
      };
      if (typeof cache.total_drawers === 'number') totalDrawers = cache.total_drawers;
      if (projectWing && cache.wings && typeof cache.wings[projectWing] === 'number') {
        drawersInWing = cache.wings[projectWing];
      }
      // Age from file mtime — the SAME clock refreshMemoryStatsCache's TTL gate
      // uses, so the displayed age and the refresh decision never disagree. (The
      // cache's `ts` field is informational only; mtime is the source of truth.)
      cacheAgeMs = Date.now() - statSync(MEMORY_STATS_CACHE_PATH).mtimeMs;
    }
  } catch (err) {
    logBg({ phase: 'memory-stats-cache-read-error', error: String(err).slice(0, 200) });
  }

  // KG facts stay a cheap, single-entity live query (only when a wing is set).
  if (projectWing) {
    const kgResult = await bridgeAsync('kg_query', { entity: projectWing }, 3000);
    if (kgResult.ok) {
      const data = kgResult.data as any;
      if (typeof data?.count === 'number') kgFacts = data.count;
    }
  }

  const cacheNote = cacheAgeMs === null
    ? ' (drawer counts warming)'
    : cacheAgeMs > MEMORY_STATS_CACHE_TTL_MS
      ? ` (cached ${formatDaemonUptime(cacheAgeMs / 1000)} ago)`
      : '';
  parts.push(`- Drawers in ${wing}: ${drawersInWing ?? 0}`);
  parts.push(`- KG facts on ${wing}: ${kgFacts ?? 0}`);
  parts.push(`- Total drawers across all wings: ${totalDrawers ?? 0}${cacheNote}`);

  // Last MemoryHarvest — read mtime of MEMORY/STATE/memory-harvest-last.json
  const harvestLogPath = join(DOS_DIR, 'MEMORY', 'STATE', 'memory-harvest-last.json');
  let lastHarvest = 'never';
  try {
    if (existsSync(harvestLogPath)) {
      const mt = statSync(harvestLogPath).mtime;
      lastHarvest = mt.toISOString();
    }
  } catch (err) {
    logBg({ phase: 'memory-stats-harvest-stat-error', error: String(err).slice(0, 200) });
  }
  parts.push(`- Last MemoryHarvest: ${lastHarvest}`);

  // Last reflection — tail -1 of algorithm-reflections.jsonl, parse timestamp
  const reflPath = join(DOS_DIR, 'MEMORY', 'LEARNING', 'REFLECTIONS', 'algorithm-reflections.jsonl');
  let lastReflection = 'never';
  try {
    if (existsSync(reflPath)) {
      const content = readFileSync(reflPath, 'utf-8').trim();
      if (content.length > 0) {
        const lastLine = content.split('\n').filter(Boolean).pop() || '';
        try {
          const entry = JSON.parse(lastLine);
          if (entry?.timestamp && typeof entry.timestamp === 'string') {
            lastReflection = entry.timestamp;
          }
        } catch { /* malformed JSONL line — leave as 'never' */ }
      }
    }
  } catch (err) {
    logBg({ phase: 'memory-stats-reflection-read-error', error: String(err).slice(0, 200) });
  }
  parts.push(`- Last reflection: ${lastReflection}`);

  // Signals — count rating entries across project + global SIGNALS dirs and
  // surface latest timestamp + 7-day window count as a single line. Closes the
  // "I don't see Signals" gap from the 2026-05-08 architectural council
  // (D2/D8 unanimous fix-now, RedTeam-tightened to minimal-viable-radiator).
  const signalsPaths: string[] = [];
  if (process.env.CLAUDE_PROJECT_DIR) {
    signalsPaths.push(join(process.env.CLAUDE_PROJECT_DIR, 'MEMORY', 'LEARNING', 'SIGNALS', 'ratings.jsonl'));
  }
  signalsPaths.push(join(DOS_DIR, 'MEMORY', 'LEARNING', 'SIGNALS', 'ratings.jsonl'));

  let signalsCount = 0;
  let signalsLast = '';
  let signalsLastMs = 0;
  let signalsLast7d = 0;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const seen = new Set<string>();
  for (const path of signalsPaths) {
    if (seen.has(path)) continue;
    seen.add(path);
    try {
      if (!existsSync(path)) continue;
      const content = readFileSync(path, 'utf-8').trim();
      if (!content) continue;
      const lines = content.split('\n').filter(Boolean);
      signalsCount += lines.length;
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const ts = entry?.timestamp;
          if (typeof ts === 'string') {
            const t = Date.parse(ts);
            if (Number.isFinite(t)) {
              if (t > signalsLastMs) { signalsLastMs = t; signalsLast = ts; }
              if (t >= sevenDaysAgo) signalsLast7d++;
            }
          }
        } catch { /* malformed line — skip */ }
      }
    } catch (err) {
      logBg({ phase: 'memory-stats-signals-read-error', path, error: String(err).slice(0, 200) });
    }
  }
  parts.push(`- Signals: ${signalsCount} total (${signalsLast7d} last 7d), last ${signalsLast || 'never'}`);

  // RFC-0075 ISC-9 — Bridge daemon health line (V11.18 wave 4).
  // Probe the persistent MemPalace bridge daemon. If it's reachable, surface
  // uptime + request count + p50 latency as a single SessionStart Signals
  // line. If unreachable (daemon down or never spawned), gracefully omit —
  // a missing line carries the operator-meaningful signal "subprocess path
  // is doing all the work" without polluting the snapshot with dead-line
  // noise. autoSpawn=false inside daemonHealth() ensures we never start
  // the daemon just to render this line.
  try {
    const health = await daemonHealth();
    if (health) {
      const uptimeSec = typeof health.uptime_seconds === 'number'
        ? health.uptime_seconds
        : 0;
      const requestCount = typeof health.request_count === 'number'
        ? health.request_count
        : 0;
      const p50 = typeof health.p50_latency_ms === 'number'
        ? Math.round(health.p50_latency_ms)
        : null;
      const errorCount = typeof health.error_count === 'number'
        ? health.error_count
        : 0;
      const palaceWatch = (health.palace_watch as Record<string, unknown> | undefined) || {};
      const invalidations = typeof palaceWatch.invalidations === 'number'
        ? palaceWatch.invalidations
        : 0;

      const uptimeStr = formatDaemonUptime(uptimeSec);
      const p50Str = p50 !== null ? `${p50}ms` : 'n/a';
      const tail = errorCount > 0 || invalidations > 0
        ? ` (errors=${errorCount}, invalidations=${invalidations})`
        : '';
      parts.push(
        `- Bridge daemon: alive ${uptimeStr}, ${requestCount} calls, p50 ${p50Str}${tail}`,
      );
    }
  } catch (err) {
    // Health probe must never break the snapshot. Log to bg telemetry but
    // omit the line — operator interprets absence as "daemon down".
    logBg({ phase: 'daemon-health-probe-error', error: String(err).slice(0, 200) });
  }

  parts.push('');
  return parts;
}

/** Format daemon uptime in seconds as a compact human string.
 * "47s" | "12m" | "3h 12m" | "2d 4h" — drops the smaller unit at higher
 * scales to keep the SessionStart Signals line single-line at 72 columns.
 */
function formatDaemonUptime(uptimeSec: number): string {
  if (!Number.isFinite(uptimeSec) || uptimeSec < 0) return 'n/a';
  const totalSec = Math.floor(uptimeSec);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const totalHr = Math.floor(totalMin / 60);
  const minRemainder = totalMin - totalHr * 60;
  if (totalHr < 24) {
    return minRemainder > 0 ? `${totalHr}h ${minRemainder}m` : `${totalHr}h`;
  }
  const days = Math.floor(totalHr / 24);
  const hrRemainder = totalHr - days * 24;
  return hrRemainder > 0 ? `${days}d ${hrRemainder}h` : `${days}d`;
}

async function buildEnrichmentSections(projectWing: string | null): Promise<string> {
  // Memory Stats section runs even on a wing-less (global) session — total
  // drawers, harvest mtime, and reflection timestamp are still meaningful.
  const memoryStatsPromise = fetchSection8MemoryStats(projectWing);

  if (!projectWing) {
    const memoryStatsLines = await memoryStatsPromise;
    return memoryStatsLines.length > 0 ? '\n' + memoryStatsLines.join('\n') : '';
  }

  const settled = await Promise.allSettled([
    fetchSection4(projectWing),
    fetchSection5(projectWing),
    fetchSections6And7(projectWing),
    memoryStatsPromise,
  ]);

  const lines: string[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      lines.push(...result.value);
    } else {
      logBg({ phase: 'enrich-section-error', error: String(result.reason).slice(0, 200) });
    }
  }

  return lines.length > 0 ? '\n' + lines.join('\n') : '';
}

// ─── Main helpers ──────────────────────────────

function readDaemonInput(inputPath: string): DaemonInput {
  let input: DaemonInput;
  try {
    input = JSON.parse(readFileSync(inputPath, 'utf-8')) as DaemonInput;
  } catch (err) {
    logBg({ phase: 'read-input-error', path: inputPath, error: String(err).slice(0, 200) });
    process.exit(1);
  }
  try { unlinkSync(inputPath); } catch { /* tolerate */ }
  return input!;
}

function runKgEnrichment(wing: string, work: WorkSummary | null, validFrom: string): void {
  const stats = enrichKG(work, wing, validFrom);
  logBg({
    phase: 'kg-enriched',
    wing,
    written: stats.written,
    superseded: stats.superseded,
    invalidated: stats.invalidated,
    unchanged: stats.unchanged,
  });
}

function writeEnrichedSnapshot(snapshotPath: string, finalContent: string, wing: string | null): void {
  const tmpPath = `${snapshotPath}.tmp`;
  try {
    writeFileSync(tmpPath, finalContent);
  } catch (err) {
    logBg({ phase: 'write-error', step: 'writeFile', wing, error: String(err).slice(0, 200) });
    try { unlinkSync(tmpPath); } catch { /* tolerate */ }
    process.exit(1);
  }
  try {
    renameSync(tmpPath, snapshotPath);
  } catch (err) {
    logBg({ phase: 'write-error', step: 'rename', wing, error: String(err).slice(0, 200) });
    try { unlinkSync(tmpPath); } catch { /* tolerate */ }
    process.exit(1);
  }
}

/** Refresh the Section-8 drawer-count cache (memory-stats-cache.json). TTL-gated
 * and called AFTER the snapshot is written, so the heavy `status` call (~5.3s over
 * 54k+ drawers) never competes with the inline MemPalaceWakeUp live-KG reads on the
 * serial host-singleton daemon. Best-effort; never throws.
 * [WORK 20260626-164827_mempalace-degraded-decouple] */
async function refreshMemoryStatsCache(): Promise<void> {
  const tmp = `${MEMORY_STATS_CACHE_PATH}.tmp`;
  try {
    if (existsSync(MEMORY_STATS_CACHE_PATH)) {
      const age = Date.now() - statSync(MEMORY_STATS_CACHE_PATH).mtimeMs;
      if (age < MEMORY_STATS_CACHE_TTL_MS) return; // fresh — skip the heavy call
    }
    const res = await bridgeAsync('status', {}, MEMORY_STATS_REFRESH_BUDGET_MS);
    if (!res.ok) {
      logBg({ phase: 'memory-stats-cache-refresh-miss', reason: String((res as { reason?: unknown }).reason ?? 'unknown').slice(0, 80) });
      return;
    }
    const data = res.data as any;
    const wings: Record<string, number> = {};
    if (data?.wings && typeof data.wings === 'object') {
      for (const [w, entry] of Object.entries<any>(data.wings)) {
        if (entry && typeof entry.total === 'number') wings[w] = entry.total;
      }
    }
    const payload = JSON.stringify({
      ts: new Date().toISOString(),
      total_drawers: typeof data?.total_drawers === 'number' ? data.total_drawers : 0,
      wings,
    });
    writeFileSync(tmp, payload);
    renameSync(tmp, MEMORY_STATS_CACHE_PATH);
    logBg({ phase: 'memory-stats-cache-refreshed', total_drawers: data?.total_drawers ?? 0, wings: Object.keys(wings).length });
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* tolerate — best-effort cleanup of orphan tmp */ }
    logBg({ phase: 'memory-stats-cache-refresh-error', error: String(err).slice(0, 200) });
  }
}

// ─── Main ──────────────────────────────

async function main() {
  const timer = startTimer(HOOK_NAME);
  const startMs = Date.now();

  const inputPath = process.env.DOS_ENRICH_INPUT_FILE;
  if (!inputPath) {
    logBg({ phase: 'no-input-env' });
    process.exit(1);
  }

  const { wing, work, basicSnapshot, snapshotPath, validFrom } = readDaemonInput(inputPath);
  logBg({ phase: 'spawned', wing, snapshot: snapshotPath });

  migrateLegacyFactsFile();

  // W1-S1 ISC-16: warm the daemon BEFORE the bridge batch below. This daemon's
  // kg_query_predicate/status calls carry 3000ms budgets; against a cold spawn
  // (~12s) those budgets SIGTERM the child (59 exit=143/day at baseline). One
  // bounded ensure (1500ms cap, autoSpawn when lock-owner) turns the batch
  // into warm relays. Failure is non-fatal — calls fall back as before.
  try {
    await ensureDaemon();
  } catch {
    // ensure is best-effort; the bridge calls degrade gracefully without it
  }

  // Run KG enrichment and enrichment-section fetch concurrently — they touch
  // disjoint bridge actions (write path vs read path).
  const [, enrichment] = await Promise.all([
    wing ? Promise.resolve(runKgEnrichment(wing, work, validFrom)) : Promise.resolve(),
    buildEnrichmentSections(wing),
  ]);

  if (!enrichment.trim()) {
    logBg({ phase: 'no-enrichment', wing, duration_ms: Date.now() - startMs });
    stopTimer(timer, 'enrich-daemon');
    process.exit(0);
  }

  const finalContent = basicSnapshot.trimEnd() + '\n' + enrichment.trimEnd() + '\n';
  writeEnrichedSnapshot(snapshotPath, finalContent, wing);

  // Off-hot-path: repopulate the drawer-count cache for the NEXT session. TTL-gated
  // so most starts skip it; when it runs, the snapshot is already written and the
  // heavy `status` no longer contends with the inline wake-up reads.
  await refreshMemoryStatsCache();

  logBg({
    phase: 'done',
    wing,
    snapshot_chars: finalContent.length,
    duration_ms: Date.now() - startMs,
  });

  stopTimer(timer, 'enrich-daemon');
  process.exit(0);
}

main().catch((err) => {
  logBg({ phase: 'fatal', error: String(err).slice(0, 200) });
  process.exit(1);
});
