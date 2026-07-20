#!/usr/bin/env bun
/**
 * DrainPressure.hook.ts — SessionStart circuit breaker for Studio sync backlog.
 *
 * Counts .pending/ items across all MEMORY subdirectories and writes
 * drain-pressure.json for statusbar consumption.
 *
 * Thresholds (ISC-A3.2):
 *   warn:  > 100 total pending items
 *   alert: > 500 total pending items
 *
 * Writes to: MEMORY/STATE/drain-pressure.json
 * Read by:   statusline/segments/memory.ts (ISC-A3.4 — Stream B coordination)
 *
 * Trigger: SessionStart
 * ISCs: A3.1–A3.3
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { startTimer, stopTimer } from './lib/hook-io';
import { getAllMemorySubdirs, getMemorySubdir } from './lib/paths';

const WARN_THRESHOLD  = 100;  // ISC-A3.2
const ALERT_THRESHOLD = 500;  // ISC-A3.2

interface SubdirCount {
  subdir: string;
  path: string;
  pending: number;
}

/**
 * Count .pending/ items in a directory.
 * Returns 0 if the .pending/ subdirectory doesn't exist.
 */
function countPending(memDir: string, subdir: string): SubdirCount {
  const pendingDir = join(memDir, subdir, '.pending');
  if (!existsSync(pendingDir)) {
    return { subdir, path: pendingDir, pending: 0 };
  }
  try {
    // `.quarantine/` lives INSIDE `.pending/`, so a bare readdirSync().length
    // counted the quarantine directory itself as a queued envelope — WORK, whose
    // .pending holds nothing but that directory, reported 1 item pending. Envelope
    // filenames never start with a dot (`pid-<n>-<seq>.<pid>.<rand>.ready`, and the
    // `.inflight` variants, which ARE real in-progress work and must still count).
    const entries = readdirSync(pendingDir).filter((e) => !e.startsWith('.'));
    return { subdir, path: pendingDir, pending: entries.length };
  } catch {
    return { subdir, path: pendingDir, pending: 0 };
  }
}

/**
 * ISC-A3.1: Count .pending items across all MEMORY subdirs in all project dirs.
 *
 * Scans: STATE, ARTIFACTS, VOICE, RESEARCH, LEARNING, RELATIONSHIP, SECURITY, WORK
 */
function countAllPending(): {
  counts: SubdirCount[];
  total: number;
  bySubdir: Record<string, number>;
} {
  // ISC-A3.1: scan across ALL dirs (global + project-scoped)
  const SCANNED_SUBDIRS = [
    'STATE', 'ARTIFACTS', 'VOICE', 'RESEARCH',
    'LEARNING', 'RELATIONSHIP', 'SECURITY', 'WORK',
  ];

  // Gather unique memory roots to scan
  const memRoots = new Set<string>();
  for (const sub of SCANNED_SUBDIRS) {
    try {
      const dirs = getAllMemorySubdirs(sub);
      for (const d of dirs) {
        // d = <root>/MEMORY/<sub> → root = ../../
        memRoots.add(join(d, '..', '..'));
      }
    } catch { /* getAllMemorySubdirs may fail on broken projects */ }

    // getAllMemorySubdirs enumerates projects from PROJECTS.md, which does not
    // exist on this install — so it returns the global root ALONE, even when
    // CLAUDE_PROJECT_DIR is set. But the DLQ writers and DrainPending both
    // resolve their queues with getMemorySubdir(), which IS project-first.
    //
    // The alarm was therefore counting a directory the queues never use. It
    // reported total:0 / alert:false while 3036 envelopes (oldest 2026-04-28)
    // sat in the project tree, and the statusline reads this file and showed a
    // healthy DLQ. Include the resolver the queues actually use. (Forge H-111.)
    try {
      memRoots.add(join(getMemorySubdir(sub), '..', '..'));
    } catch { /* resolver may throw on an unbootstrapped project */ }
  }

  // Fallback: always include global MEMORY root
  const globalMemory = join(process.env.DOS_DIR || join(homedir(), '.claude'), 'MEMORY');
  memRoots.add(join(globalMemory, '..'));

  const counts: SubdirCount[] = [];
  const bySubdir: Record<string, number> = {};

  for (const root of memRoots) {
    const memDir = join(root, 'MEMORY');
    if (!existsSync(memDir)) continue;

    for (const sub of SCANNED_SUBDIRS) {
      const result = countPending(memDir, sub);
      if (result.pending > 0) {
        counts.push(result);
        bySubdir[sub] = (bySubdir[sub] ?? 0) + result.pending;
      }
    }
  }

  const total = Object.values(bySubdir).reduce((a, b) => a + b, 0);
  return { counts, total, bySubdir };
}

const _t = startTimer('DrainPressure');
process.on('exit', () => {
  try { stopTimer(_t, 'SessionStart'); } catch { /* never fail */ }
});

const { total, bySubdir } = countAllPending();
const warn  = total > WARN_THRESHOLD;
const alert = total > ALERT_THRESHOLD;

// ISC-A3.3: write drain-pressure.json for statusbar
const stateDir = join(
  process.env.DOS_DIR || join(homedir(), '.claude'),
  'MEMORY',
  'STATE',
);

try {
  mkdirSync(stateDir, { recursive: true });
  const payload = {
    total,
    by_subdir: bySubdir,
    warn,
    alert,
    warn_threshold: WARN_THRESHOLD,
    alert_threshold: ALERT_THRESHOLD,
    ts: Date.now(),
    scanned_at: new Date().toISOString(),
  };
  writeFileSync(join(stateDir, 'drain-pressure.json'), JSON.stringify(payload, null, 2));
} catch (err) {
  console.error(`[DrainPressure] failed to write drain-pressure.json: ${err}`);
}

// Surface warning to stderr (operator sees this in session startup)
if (alert) {
  console.error(
    `[DrainPressure] 🚨 ALERT: ${total} pending sync items (threshold: ${ALERT_THRESHOLD}). ` +
    `Studio drain is critically backed up. Run /DrainPending or check Studio connectivity.`,
  );
} else if (warn) {
  console.error(
    `[DrainPressure] ⚠ WARN: ${total} pending sync items (threshold: ${WARN_THRESHOLD}). ` +
    `Studio sync may be stalled. Details: ${JSON.stringify(bySubdir)}`,
  );
} else {
  console.error(`[DrainPressure] pending: ${total} items across ${Object.keys(bySubdir).length} subdirs — OK`);
}

process.exit(0);
