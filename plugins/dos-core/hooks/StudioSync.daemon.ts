#!/usr/bin/env bun
/**
 * StudioSync.daemon.ts — Slow-path Studio sync orchestrator.
 *
 * PURPOSE:
 * Runs the registry-driven sync-tool fan-out (one child per SYNC_TOOLS
 * entry — currently 24) + project backfill OFF the SessionEnd critical
 * path. Spawned detached by `StudioSync.hook.ts` after the wrapper
 * validates Studio config.
 *
 * RATIONALE (RFC-0037 follow-up, 2026-05-03):
 * The unified StudioSync hook awaited Promise.race(all children, 5s) plus
 * an unbounded runBackfill HTTP call. On warm-up or slow Studio responses
 * the total exceeded Claude Code's SessionEnd reaper budget and the hook
 * was cancelled silently mid-flight ("Hook cancelled" surfaced in user
 * logs). Mirrors the MemoryHarvest split shipped earlier today and the
 * SessionContextSnapshot/Enrich split from RFC-0027.
 *
 * INPUT:
 * - env: inherited from wrapper (DOS_DIR, Studio config from .gateway.env
 *   loaded via loadProjectEnv in this process — env is duplicated since
 *   the daemon is detached).
 *
 * OUTPUT:
 * - stderr: status messages (lost when stdio:'ignore' from wrapper spawn)
 * - Side effects:
 *   - one child per SYNC_TOOLS entry writes MEMORY/<subdir>/.pending/ envelopes
 *   - Optional direct POSTs from special-mode tools (SaveProjectsToStudio)
 *   - Backfill POST to /api/v1/projects/backfill
 *   - flushDrift writes drift counters
 *
 * PERFORMANCE:
 * - Typical: 5-15s. Detached, so harness can't kill it.
 * - 30s ceiling on child wait (was 5s in unified hook to fit harness budget).
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { startTimer, stopTimer } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';
import { flushDrift } from './lib/dlq';
import { requireStudioConfigOrSkip } from './lib/studioClient';
import { SYNC_TOOLS } from './lib/tool-registry';
import { loadProjects } from './lib/project-resolver';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');

loadProjectEnv();

const studioCfg = requireStudioConfigOrSkip('StudioSync.daemon');
const STUDIO_API_URL = studioCfg.url;
const STUDIO_API_KEY = studioCfg.key;

// Directory is lowercase `research` on disk. The old capital-R path resolved ONLY
// by accident on case-insensitive filesystems (macOS APFS). On a case-sensitive FS
// (Linux/CI/Docker — install.sh supports these) existsSync() would be false for
// EVERY SYNC_TOOLS entry, spawnTool() would return null for all of them, and the
// entire SessionEnd Studio sync fan-out would silently no-op with "0 tools queued"
// and zero errors surfaced (H-077).
const TOOLS_DIR = join(DOS_DIR, 'skills', 'research', 'Tools');

function spawnTool(
  name: string,
  args: string[],
  opts: { env?: Record<string, string | undefined> } = {},
) {
  const toolPath = join(TOOLS_DIR, name);
  if (!existsSync(toolPath)) return null;
  try {
    const env = opts.env ?? { ...process.env, DOS_DLQ_QUEUE_ONLY: '1' };
    const child = Bun.spawn(['nohup', 'bun', toolPath, ...args], {
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
      env,
    });
    return child;
  } catch {
    return null;
  }
}

/**
 * Sync projects from PROJECTS.md to Studio. Each POST is fire-and-forget
 * (no await). Returns immediately after dispatching all requests.
 */
function syncProjectsFromRegistry(): void {
  for (const entry of loadProjects()) {
    const slug = entry.wing.toLowerCase();
    if (!slug || slug === '-') continue;
    const body = JSON.stringify({
      name: entry.project,
      slug,
      path: entry.path,
    });
    fetch(`${STUDIO_API_URL}/api/v1/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STUDIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body,
    }).catch(() => { /* fire-and-forget */ });
  }
}

/**
 * Backfill request — bounded by AbortController so a stuck Studio doesn't
 * pin the daemon indefinitely. The unified hook left this unbounded which
 * was a load-bearing reason it exceeded the harness budget on cold-start.
 */
async function runBackfill(): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    await fetch(`${STUDIO_API_URL}/api/v1/projects/backfill`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STUDIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
    });
  } catch {
    // Fire-and-forget; backfill is idempotent and DrainPending retries.
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  console.error('[StudioSync.daemon] Queueing session data for drainer (queue-only)...');

  const children = new Map<string, NonNullable<ReturnType<typeof spawnTool>>>();
  for (const spec of SYNC_TOOLS) {
    const args = spec.args ?? [];
    const opts = spec.mode === 'special' ? { env: { ...process.env } } : {};
    const child = spawnTool(spec.filename, args, opts);
    if (child) children.set(spec.filename, child);
  }

  syncProjectsFromRegistry();

  // 30s ceiling — detached daemon has no harness pressure, so the budget
  // matches the slowest expected child (typically <10s; cold-start +
  // large JSONL scans push the long tail).
  const allChildrenExit = Promise.all(
    Array.from(children.values()).map(c => c.exited),
  );
  const timeout = new Promise<'timeout'>(resolve =>
    setTimeout(() => resolve('timeout'), 30_000),
  );
  await Promise.race([allChildrenExit, timeout]);

  await runBackfill();

  const queuedCount = children.size;
  console.error(`[StudioSync.daemon] ${queuedCount} tool${queuedCount === 1 ? '' : 's'} queued — DrainPending will flush to Studio`);
}

const _t = startTimer('StudioSync.daemon');

let _timerFlushed = false;
function flushExit(): void {
  if (_timerFlushed) return;
  _timerFlushed = true;
  try { stopTimer(_t, 'SessionEnd'); } catch { /* never fail the daemon */ }
  try { flushDrift(); } catch { /* never fail the daemon */ }
}

process.on('exit', flushExit);
process.on('SIGTERM', () => { flushExit(); process.exit(0); });
process.on('SIGINT', () => { flushExit(); process.exit(0); });

main()
  .catch(() => { /* swallow; flushExit runs on exit handler */ })
  .finally(() => {
    flushExit();
    process.exit(0);
  });
