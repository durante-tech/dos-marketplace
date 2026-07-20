#!/usr/bin/env bun
/**
 * StudioSync.hook.ts — Fast-path SessionEnd wrapper.
 *
 * PURPOSE:
 * Validates Studio config (or skips) and spawns detached
 * `StudioSync.daemon.ts` to run the registry-driven sync-tool fan-out
 * (one child per SYNC_TOOLS entry — currently 24) + project backfill OFF
 * the SessionEnd critical path. Exits in <500ms.
 *
 * WHY THIS SPLIT (RFC-0037 follow-up, 2026-05-03):
 * The unified StudioSync hook awaited Promise.race(all children, 5s) plus
 * an unbounded runBackfill HTTP call. Total exceeded Claude Code's
 * SessionEnd reaper budget — surface symptom: "Hook cancelled" in user
 * logs. Mirrors the MemoryHarvest split shipped earlier today and the
 * SessionContextSnapshot/Enrich split from RFC-0027.
 *
 * TRIGGER: SessionEnd
 *
 * INPUT:
 * - stdin: hook event JSON (unused — daemon reads its own env)
 * - env: STUDIO_API_URL/KEY via .gateway.env (loaded by both wrapper and daemon)
 *
 * OUTPUT:
 * - stderr: spawn confirmation
 * - Spawns: StudioSync.daemon.ts (detached, ignores stdio)
 * - exit(0): always (non-blocking)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - MUST RUN AFTER: WorkCompletionLearning, MemoryHarvest, SessionContextSnapshot
 * - INDEPENDENT OF: SessionCleanup
 *
 * PERFORMANCE:
 * - Wrapper: <500ms (config check + spawn)
 * - Daemon: 5-15s in background, does not block parent
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { startTimer, stopTimer } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';
import { requireStudioConfigOrSkip } from './lib/studioClient';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const DAEMON_SCRIPT = join(DOS_DIR, 'hooks', 'StudioSync.daemon.ts');

loadProjectEnv();

// Validate Studio config in the wrapper so a misconfigured operator gets
// the skip log immediately rather than the daemon dying silently. The
// daemon also re-validates (it runs in its own process and can't trust
// what the wrapper saw) — see daemon header for the env-duplication
// rationale.
requireStudioConfigOrSkip('StudioSync.hook');

function spawnSyncDaemon(): void {
  if (!existsSync(DAEMON_SCRIPT)) {
    console.error(`[StudioSync] Daemon missing at ${DAEMON_SCRIPT} — skipping sync`);
    return;
  }
  try {
    const child = spawn(process.execPath, [DAEMON_SCRIPT], {
      env: { ...process.env },
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    console.error(`[StudioSync] Spawned daemon pid=${child.pid ?? -1}`);
  } catch (err) {
    console.error(`[StudioSync] Failed to spawn daemon: ${err}`);
  }
}

const _t = startTimer('StudioSync');
process.on('exit', () => {
  try { stopTimer(_t, 'SessionEnd'); } catch { /* never fail the hook */ }
});

spawnSyncDaemon();
process.exit(0);
