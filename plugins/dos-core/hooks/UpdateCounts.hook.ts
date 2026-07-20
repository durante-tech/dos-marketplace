#!/usr/bin/env bun
/**
 * UpdateCounts.hook.ts - System Counts Update (SessionEnd)
 *
 * PURPOSE:
 * Updates settings.json counts (skills, hooks, ratings, etc.) and refreshes the
 * Anthropic usage/cost cache so the next session's banner/statusline has fresh
 * data.
 *
 * ARCHITECTURE (v0.0.20 lifecycle refactor):
 *   The cheap local file-counting runs INLINE (refreshCountsSync, ~5-30ms, no
 *   network). The slow Anthropic usage/cost fetch (~3s, up to ~8s with an admin
 *   key) is DETACHED to a background copy of this hook so the SessionEnd
 *   critical path exits in <100ms instead of blocking ~3s inline.
 *
 *     foreground (DOS_UPDATECOUNTS_BG unset):
 *       refreshCountsSync() inline  →  spawn detached self (DOS_UPDATECOUNTS_BG=1)
 *       →  exit fast. Never blocks on the network.
 *     background (DOS_UPDATECOUNTS_BG=1):
 *       refreshUsageCache() only  →  writes MEMORY/STATE/usage-cache.json  →  exit.
 *
 *   The env marker prevents the background copy from re-spawning (no loop). If
 *   the detach spawn is impossible (argv[1] missing or spawn throws) the fetch
 *   runs inline as a fallback so the usage cache is never silently skipped.
 *
 * TRIGGER: SessionEnd
 * PERFORMANCE: foreground <100ms; the network fetch is off the critical path.
 */

import { spawn } from 'child_process';
import { refreshCountsSync, refreshUsageCache } from './handlers/UpdateCounts';
import { startTimer, stopTimer } from './lib/hook-io';

const BG_ENV = 'DOS_UPDATECOUNTS_BG';

/** Foreground: fast, synchronous local counting + detach the slow usage fetch. */
async function foreground(): Promise<void> {
  // Cheap, synchronous, no network — safe on the SessionEnd critical path.
  try {
    const counts = refreshCountsSync();
    if (counts) {
      console.error(`[UpdateCounts] Updated: SK:${counts.topLevelSkills}(${counts.skills}) WF:${counts.workflows} HK:${counts.hooks} AG:${counts.agents} PK:${counts.packs} TR:${counts.traitCombinations}`);
    } else {
      console.error('[UpdateCounts] refreshCountsSync returned null — settings.json untouched');
    }
  } catch (err) {
    console.error('[UpdateCounts] counts refresh failed:', err);
  }

  // Detach the Anthropic usage/cost fetch to a background copy of this hook.
  const script = process.argv[1];
  if (!script) {
    // No script path to respawn — run the fetch inline so the usage cache still
    // refreshes (rare; only when argv[1] is unavailable).
    try { await refreshUsageCache(); } catch { /* non-fatal */ }
    return;
  }
  try {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, [BG_ENV]: '1' },
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (err) {
    // Spawn failed — fall back to inline fetch so we don't silently skip it.
    console.error('[UpdateCounts] detach spawn failed, running usage fetch inline:', err);
    try { await refreshUsageCache(); } catch { /* non-fatal */ }
  }
}

/** Background: the detached usage/cost network fetch (off the critical path). */
async function background(): Promise<void> {
  try {
    await refreshUsageCache();
  } catch (err) {
    console.error('[UpdateCounts.bg] usage refresh failed:', err);
  }
}

const isBg = process.env[BG_ENV] === '1';
const _t = startTimer(isBg ? 'UpdateCounts.usage' : 'UpdateCounts');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));

(isBg ? background() : foreground())
  .catch((err) => { console.error('[UpdateCounts] Error:', err); })
  .finally(() => process.exit(0));
