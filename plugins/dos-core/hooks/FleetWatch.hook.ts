#!/usr/bin/env bun
/**
 * FleetWatch.hook.ts — SessionStart anomaly banner for the fleet's deploy line.
 *
 * THE GAP THIS CLOSES: on 2026-07-10 the Quartermaster session died holding
 * `deployline/.driver.lock`; the deploy line sat unmanned for hours and was
 * only discovered by a manual probe. Nothing in the harness watched the lock.
 * This hook makes the next session start say so.
 *
 * BEHAVIOR (anomaly-only — boot-noise discipline):
 *   - lock ABSENT            → silent (released cleanly; unmanned-by-design)
 *   - lock LIVE (pid alive)  → silent (deploy line manned)
 *   - lock STALE (pid dead)  → ONE banner line: unmanned since <acquired>,
 *                              stale pid, and the relaunch remedy.
 *   - malformed/any error    → silent, fail-open (a watch must never break boot)
 *
 * Local-only: one file read + one signal-0 probe. No network, no gh, no git —
 * queue depth is the Quartermaster's own SURVEY instrument, not a boot banner.
 *
 * Companions: DeployLineGuard.hook.ts (PreToolUse fence on the same lock),
 * DOS/FLEETPROTOCOL.md §3 (lock semantics + takeover), FleetFoundry
 * Workflows/Relaunch.md (the remedy this banner points at).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
// Same lock parsing + liveness semantics as the fence — do not fork them.
import { parseDriverLock, isPidAlive, type DeployLineLock } from './DeployLineGuard.hook';

export interface FleetWatchCtx {
  lock: DeployLineLock | null; // null = absent or unparseable
  holderPidAlive: boolean;
}

/** Pure predicate: banner text on anomaly, null for silence. */
export function decideFleetWatch(ctx: FleetWatchCtx): string | null {
  if (!ctx.lock) return null;          // released cleanly or unreadable → silent
  if (ctx.holderPidAlive) return null; // manned → silent
  return (
    `⚠ FLEET: deploy line UNMANNED — driver lock is stale (pid ${ctx.lock.pid} dead, ` +
    `acquired ${ctx.lock.acquired ?? 'unknown'}, session ${ctx.lock.session.slice(0, 8)}…). ` +
    `Green PRs will queue undrained; enforce-mode fencing blocks everyone else. ` +
    `Relaunch: FleetFoundry Workflows/Relaunch.md (operator launches — takeover is ledgered per FLEETPROTOCOL §3).`
  );
}

function deployLineLockPath(): string {
  return process.env.DOS_DEPLOYLINE_LOCK || join(homedir(), 'Durante', 'deployline', '.driver.lock');
}

if (import.meta.main) {
  try {
    const p = deployLineLockPath();
    const lock = existsSync(p) ? parseDriverLock(readFileSync(p, 'utf-8')) : null;
    const banner = decideFleetWatch({ lock, holderPidAlive: lock ? isPidAlive(lock.pid) : false });
    if (banner) console.log(banner); // SessionStart stdout lands in session context
    process.exit(0);
  } catch {
    process.exit(0); // fail-open: a watch must never break session start
  }
}
