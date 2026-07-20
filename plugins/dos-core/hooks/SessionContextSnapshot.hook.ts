#!/usr/bin/env bun
/**
 * SessionContextSnapshot.hook.ts - Pre-compute next session's context (SessionEnd)
 *
 * PURPOSE:
 * At session end, when we have full information about what was worked on,
 * generate a context snapshot for the NEXT session. This replaces the blind
 * ChromaDB query in MemPalaceWakeUp with a pre-computed, relevant summary.
 *
 * ARCHITECTURE (split 2026-04-23):
 * This foreground hook is the FAST PATH — writes the basic snapshot (Resume
 * Briefing, Last Session, Open Threads, Active Corrections) synchronously in
 * <200ms, then spawns a detached daemon (`SessionContextEnrich.daemon.ts`)
 * which does the slow MemPalace/KG enrichment in the background. See that
 * file's header for the full rationale — in short, Claude Code's SessionEnd
 * reaper was killing the unified hook ~80% of the time on runs with a real
 * project wing because 1-3s of bridge work exceeded the budget.
 *
 * TRIGGER: SessionEnd (and SessionStart with --if-stale=N for self-healing)
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, transcript_path, reason)
 * - Files: MEMORY/WORK/<dir>/PRD.md, MEMORY/LEARNING/*
 *
 * OUTPUT:
 * - stderr: Status messages
 * - Writes: MEMORY/STATE/next-session-context-<wing>.md (basic snapshot, synchronous)
 * - Spawns: SessionContextEnrich.daemon.ts (overwrites snapshot with enrichment)
 * - exit(0): Always (non-blocking)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - MUST RUN AFTER: WorkCompletionLearning (needs learning files)
 * - MUST RUN AFTER: MemPalaceLearn (learnings filed to palace)
 * - INDEPENDENT OF: SessionCleanup
 *
 * PERFORMANCE:
 * - Foreground: <200ms (file reads + snapshot write + daemon spawn)
 * - Daemon: 1-3s in background, does not block parent
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, statSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { resolveProjectWingFromEnv } from './lib/project-resolver';
// V12.3-β split migration (RFC-0082 §1): parsing functions from @durante/prd;
// listRecentWorkDirs + WorkSummary type remain local (state surfaces).
// RFC-0112 D1: PRD-parser primitives route THROUGH ./lib/prd-utils (the
// fail-soft loader) — never a direct static `@durante/prd` import, which
// would crash this hook's module load on a fresh install with no node_modules.
import { parseFrontmatter, getScalarField, listRecentWorkDirs, prdAvailable, type WorkSummary } from './lib/prd-utils';
import { PRD_PHASE_COMPLETE } from './lib/tab-constants';
import { readHookInput, startTimer, stopTimer } from './lib/hook-io';
import { getWorkDir, getMemorySubdir } from './lib/paths';
import { buildWorkOsBoardSection } from './lib/work-os-board';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const MEMORY_DIR = join(DOS_DIR, 'MEMORY');
const STATE_DIR = join(MEMORY_DIR, 'STATE');
const WORK_DIR = getWorkDir();
const LEARNING_DIR = getMemorySubdir('LEARNING');

/** Per-wing snapshot path — prevents cross-project overwrites in multi-session scenarios */
function getSnapshotPath(wing: string | null): string {
  const suffix = wing || 'global';
  return join(STATE_DIR, `next-session-context-${suffix}.md`);
}


// ─── Last Session Work Summary ──────────────────────────────

/** 60s freshness threshold — PRDs written within this window are considered
 * "in-flight" from the still-active session and skipped for summary purposes.
 * Prevents the snapshot from baking a mid-algorithm `phase: plan 0/10` into KG. */
const INFLIGHT_WINDOW_MS = 60 * 1000;

function parseWorkDir(dirName: string): WorkSummary | null {
  // RFC-0112: fail-soft degradation. Without the PRD parser this dir cannot
  // be summarised — skip it; the snapshot is built from whatever dirs remain.
  if (!prdAvailable) return null;
  const prdPath = join(WORK_DIR, dirName, 'PRD.md');
  if (!existsSync(prdPath)) return null;

  let content: string;
  try {
    content = readFileSync(prdPath, 'utf-8');
  } catch {
    return null;
  }

  const fm = parseFrontmatter(content);
  if (!fm) return null;

  const task = getScalarField(fm, 'task') || 'Unknown';
  const slug = getScalarField(fm, 'slug') || dirName;
  const phase = getScalarField(fm, 'phase') || 'unknown';
  const progress = getScalarField(fm, 'progress') || '0/0';

  const decisions: string[] = [];
  const decisionsMatch = content.match(/## Decisions\n([\s\S]*?)(?=\n## |$)/);
  if (decisionsMatch) {
    const lines = decisionsMatch[1].trim().split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^- /, '').trim();
      if (cleaned) decisions.push(cleaned);
    }
  }

  const uncheckedCriteria: string[] = [];
  const uncheckedMatches = content.match(/- \[ \] .+/g);
  if (uncheckedMatches) {
    for (const line of uncheckedMatches) {
      const text = line.replace(/^- \[ \] /, '').trim();
      if (text.length > 5) uncheckedCriteria.push(text);
    }
  }

  let context = '';
  const contextMatch = content.match(/## Context\n([\s\S]*?)(?=\n## |$)/);
  if (contextMatch) {
    context = contextMatch[1].trim().substring(0, 500);
  }

  let sessionName = '';
  const sessionId = getScalarField(fm, 'session_id');
  if (sessionId) {
    try {
      const namesPath = join(STATE_DIR, 'session-names.json');
      if (existsSync(namesPath)) {
        const names = JSON.parse(readFileSync(namesPath, 'utf-8'));
        sessionName = names[sessionId] || '';
      }
    } catch { /* non-critical */ }
  }

  // 'done' is terminal alongside 'complete' (6 live PRDs use it) — without this
  // a finished 'done' PRD is flagged UNFINISHED in the Resume Briefing (H-058).
  return { task, slug, phase, progress, decisions, unfinished: phase !== PRD_PHASE_COMPLETE && phase !== 'done', context, uncheckedCriteria, sessionName };
}

function getLastSessionWork(): WorkSummary | null {
  const now = Date.now();
  const entries = listRecentWorkDirs({ workDir: WORK_DIR, limit: 10 });

  let firstNonInflightNonComplete: WorkSummary | null = null;

  for (const { dirName, prdPath } of entries) {
    let mtimeMs: number;
    try {
      mtimeMs = statSync(prdPath).mtimeMs;
    } catch {
      continue;
    }
    if (now - mtimeMs < INFLIGHT_WINDOW_MS) {
      process.stderr.write(`[SessionContextSnapshot] Skipping in-flight PRD ${dirName} (${Math.round((now - mtimeMs) / 1000)}s old)\n`);
      continue;
    }

    const summary = parseWorkDir(dirName);
    if (!summary) continue;

    if (!summary.unfinished) return summary;
    if (!firstNonInflightNonComplete) firstNonInflightNonComplete = summary;
  }

  return firstNonInflightNonComplete;
}

// ─── Active Corrections ──────────────────────────────────

function getActiveCorrections(limit: number = 5): string[] {
  const corrections: Array<{ text: string; age: number }> = [];

  const reflPath = join(LEARNING_DIR, 'REFLECTIONS', 'algorithm-reflections.jsonl');
  if (existsSync(reflPath)) {
    try {
      const lines = readFileSync(reflPath, 'utf-8').trim().split('\n').filter(Boolean).slice(-10);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.reflection_q1) {
            const age = Date.now() - new Date(entry.timestamp).getTime();
            corrections.push({
              text: entry.reflection_q1.substring(0, 120),
              age,
            });
          }
        } catch { /* skip malformed */ }
      }
    } catch { /* skip */ }
  }

  const failuresDir = join(LEARNING_DIR, 'FAILURES');
  if (existsSync(failuresDir)) {
    try {
      const months = readdirSync(failuresDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
        .map(d => d.name)
        .sort()
        .reverse()
        .slice(0, 2);

      for (const month of months) {
        const monthPath = join(failuresDir, month);
        const dirs = readdirSync(monthPath, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
          .sort()
          .reverse()
          .slice(0, 5);

        for (const dir of dirs) {
          const dateMatch = dir.match(/^(\d{4}-\d{2}-\d{2})/);
          const slug = dir.replace(/^\d{4}-\d{2}-\d{2}-\d{6}_/, '').replace(/-/g, ' ');
          const age = dateMatch ? Date.now() - new Date(dateMatch[1]).getTime() : Infinity;
          corrections.push({ text: slug.substring(0, 80), age });
        }
      }
    } catch { /* skip */ }
  }

  corrections.sort((a, b) => a.age - b.age);
  return corrections.slice(0, limit).map(c => c.text);
}

// ─── Unfinished Threads ──────────────────────────────────

function getUnfinishedThreads(): string[] {
  const threads: string[] = [];
  const entries = listRecentWorkDirs({
    workDir: WORK_DIR,
    limit: 10,
    cutoffMs: 72 * 60 * 60 * 1000,
  });

  for (const { prdPath } of entries) {
    try {
      const head = readFileSync(prdPath, 'utf-8').substring(0, 400);
      const phase = head.match(/^phase:\s*"?(\w+)"?/m)?.[1];
      const task = head.match(/^task:\s*"?(.+?)"?\s*$/m)?.[1];
      if (phase && phase !== PRD_PHASE_COMPLETE && phase !== 'done' && task) threads.push(task);
    } catch { /* skip */ }
  }

  return threads.slice(0, 5);
}

// ─── Build Basic Snapshot (sections 0-3 only; enrichment runs in daemon) ─────────

function buildBasicSnapshot(
  work: WorkSummary | null,
  corrections: string[],
  unfinished: string[],
  projectWing: string | null,
  projectName: string | null,
): string {
  const parts: string[] = [];
  const now = new Date().toISOString();

  parts.push(`# Session Context Snapshot`);
  parts.push(`_Generated: ${now} | Project: ${projectName || 'global'} (${projectWing || 'no wing'})_\n`);

  // Section 0: Resume Briefing (only for unfinished work)
  if (work && work.unfinished) {
    parts.push(`## Resume Briefing`);
    parts.push(`**Task:** ${work.task}`);
    parts.push(`**Phase:** ${work.phase} (${work.progress})`);
    if (work.uncheckedCriteria.length > 0) {
      parts.push(`\n**Unchecked Criteria:**`);
      for (const c of work.uncheckedCriteria) {
        parts.push(`- [ ] ${c}`);
      }
    }
    if (work.decisions.length > 0) {
      parts.push(`\n**Last 3 Decisions:**`);
      for (const d of work.decisions.slice(-3)) {
        parts.push(`- ${d}`);
      }
    }
    parts.push('');
  }

  // Section 1: Where we left off
  if (work) {
    parts.push(`## Last Session`);
    const nameLabel = work.sessionName ? ` _(${work.sessionName})_` : '';
    parts.push(`**Task:** ${work.task}${nameLabel}`);
    parts.push(`**Status:** ${work.phase} (${work.progress})`);
    if (work.unfinished) {
      parts.push(`**⚠️ UNFINISHED** — this work was not completed`);
    }
    if (work.decisions.length > 0) {
      parts.push(`\n**Recent Decisions:**`);
      for (const d of work.decisions.slice(0, 5)) {
        parts.push(`- ${d}`);
      }
    }
    parts.push('');
  }

  // Section 2: Unfinished threads (beyond last session)
  if (unfinished.length > 0) {
    parts.push(`## Open Threads (last 72h)`);
    for (const t of unfinished) {
      parts.push(`- ${t}`);
    }
    parts.push('');
  }

  // Section 3: Active corrections
  if (corrections.length > 0) {
    parts.push(`## Active Corrections`);
    parts.push(`_Apply these behavioral adjustments this session:_`);
    for (const c of corrections) {
      parts.push(`- ${c}`);
    }
    parts.push('');
  }

  // Section 3.5: Work OS Board (read path — one bounded file read of the
  // projection cache written by Tools/work-os.ts; '' when absent/malformed,
  // so customer installs without Work OS render nothing here).
  const board = buildWorkOsBoardSection(join(STATE_DIR, 'work-os-snapshot.json'), Date.now());
  if (board) parts.push(board);

  // Sections 4-7 (Project Knowledge, Deep Memory, Commitments, Conflicts) are
  // appended asynchronously by SessionContextEnrich.daemon.ts.

  return parts.join('\n');
}

// ─── Detach enrichment daemon ──────────────────────────────

/** Daemon script path — resolved relative to this hook file. */
const DAEMON_SCRIPT = join(DOS_DIR, 'hooks', 'SessionContextEnrich.daemon.ts');

function spawnEnrichmentDaemon(
  wing: string | null,
  projectName: string | null,
  work: WorkSummary | null,
  basicSnapshot: string,
  snapshotPath: string,
): void {
  if (!existsSync(DAEMON_SCRIPT)) {
    process.stderr.write(`[SessionContextSnapshot] Daemon missing at ${DAEMON_SCRIPT} — skipping enrichment\n`);
    return;
  }

  const inputPath = join(
    tmpdir(),
    `dos-enrich-${process.pid}-${Date.now()}.json`,
  );

  const payload = {
    wing,
    projectName,
    work,
    basicSnapshot,
    snapshotPath,
    validFrom: new Date().toISOString().split('T')[0],
  };

  try {
    writeFileSync(inputPath, JSON.stringify(payload));
  } catch (err) {
    process.stderr.write(`[SessionContextSnapshot] Failed to write daemon input: ${err}\n`);
    return;
  }

  try {
    const child = spawn(process.execPath, [DAEMON_SCRIPT], {
      env: {
        ...process.env,
        DOS_ENRICH_INPUT_FILE: inputPath,
      },
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    writeBreadcrumb('daemon-spawned', {
      daemon_pid: child.pid ?? -1,
      input_file: inputPath,
      wing,
    });
  } catch (err) {
    process.stderr.write(`[SessionContextSnapshot] Failed to spawn daemon: ${err}\n`);
  }
}

// ─── Main ──────────────────────────────

/** Parse --if-stale=<hours> flag. When set, the hook regenerates the snapshot
 * only if the existing snapshot is missing or older than the threshold.
 * Used by SessionStart invocation to make the pipeline self-healing when
 * SessionEnd was skipped (crash, /clear, force-quit). */
function getIfStaleHours(): number | null {
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--if-stale=(\d+(?:\.\d+)?)$/);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

/** Diagnostic breadcrumb log. Written at main() entry, at each early exit, and
 * at successful completion. Diffing `status=entry` vs `status=complete` lines
 * reveals whether Claude Code is invoking this hook at SessionEnd and whether
 * the parallel-hook reaper is killing it before writeFileSync flushes. Capped
 * by tail-trim on each write to prevent unbounded growth. */
const BREADCRUMB_PATH = join(STATE_DIR, 'session-context-snapshot-breadcrumbs.jsonl');
const BREADCRUMB_MAX_LINES = 500;

/** Append-only writes for the common path; tail-trim only runs on `entry` so
 * the self-healing cap still kicks in once per run without paying the
 * read+split+rewrite cost on every breadcrumb call. */
function writeBreadcrumb(
  status: 'entry' | 'complete' | 'skipped' | 'error' | 'daemon-spawned',
  extra: Record<string, unknown> = {},
): void {
  try {
    const entry = {
      ts: new Date().toISOString(),
      status,
      pid: process.pid,
      argv: process.argv.slice(2),
      trigger: process.env.CLAUDE_HOOK_EVENT || extra.hook_event_name || 'unknown',
      ...extra,
    };
    const line = JSON.stringify(entry) + '\n';

    if (status === 'entry') {
      let existing = '';
      if (existsSync(BREADCRUMB_PATH)) {
        try { existing = readFileSync(BREADCRUMB_PATH, 'utf-8'); } catch { /* tolerate */ }
      }
      const combined = existing + line;
      const lines = combined.split('\n').filter(Boolean);
      const trimmed = lines.length > BREADCRUMB_MAX_LINES
        ? lines.slice(-BREADCRUMB_MAX_LINES).join('\n') + '\n'
        : combined;
      writeFileSync(BREADCRUMB_PATH, trimmed);
    } else {
      appendFileSync(BREADCRUMB_PATH, line);
    }
  } catch {
    // Breadcrumb failure must never break the hook itself
  }
}

async function main() {
  const hookInput = (await readHookInput()) as {
    session_id?: string;
    hook_event_name?: string;
    reason?: string;
  } | null;
  const sessionId = hookInput?.session_id || 'unknown';
  const hookEventName = hookInput?.hook_event_name;
  const reason = hookInput?.reason;

  writeBreadcrumb('entry', { session_id: sessionId, hook_event_name: hookEventName, reason });

  // RFC-0112: announce parser degradation once per fire (the snapshot still
  // builds — Resume Briefing/Last Session sections derived from PRD parsing
  // are simply omitted; regex-derived sections are unaffected).
  if (!prdAvailable) {
    console.error('[SessionContextSnapshot] @durante/prd degraded (RFC-0112) — PRD-derived snapshot sections omitted');
  }

  // --if-stale gate: short-circuit if snapshot is already fresh enough
  const ifStaleHours = getIfStaleHours();
  if (ifStaleHours !== null) {
    const { wing } = resolveProjectWingFromEnv();
    const snapshotPath = getSnapshotPath(wing);
    if (existsSync(snapshotPath)) {
      try {
        const ageMs = Date.now() - statSync(snapshotPath).mtimeMs;
        if (ageMs < ifStaleHours * 60 * 60 * 1000) {
          console.error(`[SessionContextSnapshot] Snapshot fresh (${Math.round(ageMs / 60000)}min < ${ifStaleHours}h) — skipping regeneration`);
          writeBreadcrumb('skipped', { session_id: sessionId, reason: 'snapshot_fresh', age_min: Math.round(ageMs / 60000) });
          process.exit(0);
        }
        console.error(`[SessionContextSnapshot] Snapshot stale (${Math.round(ageMs / 3600000)}h >= ${ifStaleHours}h) — regenerating`);
      } catch {
        // mtime read failed — fall through to regenerate
      }
    } else {
      console.error(`[SessionContextSnapshot] No snapshot exists for wing ${wing || 'global'} — generating`);
    }
  }

  console.error('[SessionContextSnapshot] Starting basic snapshot generation...');

  const { wing: projectWing, project: projectName } = resolveProjectWingFromEnv();

  const work = getLastSessionWork();
  const corrections = getActiveCorrections(5);
  const unfinished = getUnfinishedThreads();

  const basicSnapshot = buildBasicSnapshot(work, corrections, unfinished, projectWing, projectName);
  const snapshotPath = getSnapshotPath(projectWing);

  try {
    writeFileSync(snapshotPath, basicSnapshot);
    console.error(`[SessionContextSnapshot] Wrote basic snapshot (${basicSnapshot.length} chars) to ${snapshotPath}`);
  } catch (err) {
    console.error(`[SessionContextSnapshot] Failed to write snapshot: ${err}`);
    writeBreadcrumb('error', { session_id: sessionId, error: String(err).substring(0, 200) });
    process.exit(0);
  }

  // Spawn detached daemon for KG + MemPalace enrichment. Daemon overwrites
  // the snapshot with basic + sections 4-7 via atomic rename.
  spawnEnrichmentDaemon(projectWing, projectName, work, basicSnapshot, snapshotPath);

  writeBreadcrumb('complete', { session_id: sessionId, snapshot_chars: basicSnapshot.length, wing: projectWing });
  process.exit(0);
}

const _t = startTimer('SessionContextSnapshot');
process.on('exit', (code) => {
  const event = process.env.CLAUDE_HOOK_EVENT
    || (process.argv.slice(2).some(a => a.startsWith('--if-stale=')) ? 'SessionStart' : 'SessionEnd');
  stopTimer(_t, event);
});
main().catch((err) => {
  console.error(`[SessionContextSnapshot] Fatal: ${err}`);
  writeBreadcrumb('error', { error: String(err).substring(0, 200) });
  process.exit(0);
});
