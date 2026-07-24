/**
 * session-baseline-pending.ts — H-012 marker + reap machinery (Forge Gen 176).
 *
 * PROBLEM: SessionBaseline's capture spawn dies at the 5s timeout under
 * concurrent session starts (git-status contention) — ~21-35% of sessions get
 * NO baseline, and the hook's idempotence check means nothing ever retries.
 * The Gen-3 detached-retry remedy REVERTED (T2 session-start wedge), leaving
 * the binding constraint: the remedy must add ZERO new session-start processes.
 *
 * SHAPE (staked Gen 170; JUDGE-folded Gen 176): on capture failure the
 * SessionStart hook writes a tiny pending MARKER (sync file write, no
 * process). Reaping rides an EXISTING SessionEnd hook (SessionCleanup):
 *   • prune: own-session (a post-end baseline is meaningless), baseline
 *     already present, marker older than the 15-min reap window (bounds
 *     late-capture pollution — a stale reap would classify the session's own
 *     AI writes as pre-existing dirt; past the window the loud
 *     '✗ no baseline' failure is the honest outcome), corrupt marker,
 *     transcript gone
 *   • reap:  fresh marker + transcript active (<1h mtime) → re-run the
 *     capture (≤2 capture ATTEMPTS per sweep — attempts, not successes, so a
 *     failing-capture storm cannot stretch SessionEnd beyond ~2×10s — 10s cap
 *     each) and stamp the baseline captured_late + reaped_at + provenance
 *   • skip:  inactive-but-fresh markers wait for a later sweep
 *
 * Known-harmless race: two concurrent SessionEnd sweeps can double-attempt
 * the same marker (one wasted spawn, unlink ENOENT swallowed, counts skew).
 * Soft machinery — no lock is warranted.
 *
 * Seams (tests only, never set in production): DOS_BASELINE_STATE_DIR,
 * DOS_BASELINE_TOOL.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function resolveStateDir(): string {
  return process.env.DOS_BASELINE_STATE_DIR || join(homedir(), 'Durante', 'MEMORY', 'STATE');
}

export function resolveBaselineTool(): string {
  return process.env.DOS_BASELINE_TOOL || join(homedir(), 'Durante', 'Tools', 'session-baseline.ts');
}

export function baselinePath(sessionId: string): string {
  return join(resolveStateDir(), `session-${sessionId}-baseline.json`);
}

export function pendingMarkerPath(sessionId: string): string {
  return join(resolveStateDir(), `session-${sessionId}-baseline-pending.json`);
}

export interface PendingMarker {
  session_id: string;
  transcript_path: string;
  requested_at: string;
  reason: string;
}

/** Sync, tiny, no child process — safe on the session-start path. */
export function writePendingMarker(sessionId: string, transcriptPath: string, reason: string): boolean {
  try {
    const marker: PendingMarker = {
      session_id: sessionId,
      transcript_path: transcriptPath,
      requested_at: new Date().toISOString(),
      reason,
    };
    writeFileSync(pendingMarkerPath(sessionId), JSON.stringify(marker) + '\n');
    return true;
  } catch {
    return false;
  }
}

const MAX_CAPTURE_ATTEMPTS_PER_SWEEP = 2; // attempts, not successes (JUDGE F2)
const CAPTURE_TIMEOUT_MS = 10_000;
const ACTIVE_TRANSCRIPT_MS = 60 * 60 * 1000; // transcript written <1h ago = session still active
const REAP_FRESH_MS = 15 * 60 * 1000; // reap window — bounds late-capture misattribution (JUDGE F1)

export interface ReapResult {
  reaped: number;
  pruned: number;
  skipped: number;
}

/**
 * One bounded sweep. Never throws; every marker outcome is counted.
 * currentSessionId = the session whose SessionEnd is running this sweep —
 * its own marker is pruned (capture-after-end is meaningless).
 */
export function reapPendingBaselines(currentSessionId?: string): ReapResult {
  const res: ReapResult = { reaped: 0, pruned: 0, skipped: 0 };
  const dir = resolveStateDir();
  if (!existsSync(dir)) return res;

  let names: string[];
  try {
    names = readdirSync(dir).filter(
      (n) => n.startsWith('session-') && n.endsWith('-baseline-pending.json'),
    );
  } catch {
    return res;
  }

  let captureAttempts = 0;
  for (const name of names) {
    const markerFile = join(dir, name);
    // Corrupt/truncated markers prune immediately — otherwise they re-throw
    // on every sweep forever (JUDGE F3).
    let marker: Partial<PendingMarker>;
    try {
      marker = JSON.parse(readFileSync(markerFile, 'utf8')) as Partial<PendingMarker>;
    } catch {
      try {
        unlinkSync(markerFile);
      } catch {
        // gone already — still counts as pruned
      }
      res.pruned++;
      continue;
    }
    try {
      const sid = marker.session_id;
      if (!sid) {
        unlinkSync(markerFile);
        res.pruned++;
        continue;
      }
      if (currentSessionId && sid === currentSessionId) {
        unlinkSync(markerFile);
        res.pruned++;
        continue;
      }
      if (existsSync(baselinePath(sid))) {
        unlinkSync(markerFile);
        res.pruned++;
        continue;
      }
      const age = Date.now() - new Date(marker.requested_at || 0).getTime();
      if (!Number.isFinite(age) || age > REAP_FRESH_MS) {
        unlinkSync(markerFile);
        res.pruned++;
        continue;
      }
      const tp = marker.transcript_path || '';
      if (!tp || !existsSync(tp)) {
        unlinkSync(markerFile);
        res.pruned++;
        continue;
      }
      let active = false;
      try {
        active = Date.now() - statSync(tp).mtimeMs < ACTIVE_TRANSCRIPT_MS;
      } catch {
        // stat race — treat as inactive, retry next sweep
      }
      if (!active) {
        res.skipped++;
        continue;
      }
      if (captureAttempts >= MAX_CAPTURE_ATTEMPTS_PER_SWEEP) {
        res.skipped++;
        continue;
      }
      const tool = resolveBaselineTool();
      if (!existsSync(tool)) {
        res.skipped++;
        continue;
      }
      captureAttempts++;
      // Explicit env spread: bun children spawned WITHOUT an env option do not
      // see runtime process.env mutations (observed Gen 176) — the spread
      // snapshots the live env at spawn time. Production-neutral.
      const r = spawnSync('bun', [tool, 'capture', `--session-id=${sid}`], {
        encoding: 'utf-8',
        timeout: CAPTURE_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });
      if (r.error || (r.status ?? 0) !== 0 || !existsSync(baselinePath(sid))) {
        res.skipped++;
        continue;
      }
      // Provenance stamp: a late baseline is a different confidence class —
      // AI writes made between start and reap appear as pre-existing dirt.
      try {
        const b = JSON.parse(readFileSync(baselinePath(sid), 'utf8'));
        b.captured_late = true;
        b.reaped_at = new Date().toISOString();
        if (currentSessionId) b.reaped_by_session = currentSessionId;
        writeFileSync(baselinePath(sid), JSON.stringify(b, null, 2) + '\n');
      } catch {
        // stamp is best-effort; the capture still counts
      }
      unlinkSync(markerFile);
      res.reaped++;
    } catch {
      res.skipped++;
    }
  }
  return res;
}
