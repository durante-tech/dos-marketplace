#!/usr/bin/env bun
/**
 * MemoryBackup.hook.ts — SessionEnd hook for local MEMORY backup (P0 safety).
 *
 * Spawns dos-backup.ts detached so it doesn't block the SessionEnd lifecycle.
 * Exits in <500ms regardless of backup duration.
 *
 * Also directly cron-callable:
 *   bun MemoryBackup.hook.ts   # same as bun dos-backup.ts
 *
 * Trigger: SessionEnd
 *
 * Locates dos-backup.ts via:
 *   1. realpathSync(DOS_DIR)/../../.. → parent repo Tools/
 *   2. DOS_DIR/DOS/Tools/ (install copy fallback)
 *
 * Coupling:
 *   - Tools/dos-backup.ts (the backup tool being spawned)
 *   - RmGuard.hook.ts (reads last backup age for block message)
 *   - ISC-A1.4
 */

import { existsSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { startTimer, stopTimer } from './lib/hook-io';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');

/**
 * Locate dos-backup.ts using two strategies:
 *   1. Resolve DOS_DIR symlink → walk up to parent repo Tools/
 *   2. Installed copy at DOS_DIR/DOS/Tools/dos-backup.ts
 */
function findBackupScript(): string | null {
  // Strategy 1: resolve symlink chain to locate parent repo
  try {
    const realDosDir = realpathSync(DOS_DIR);
    // Releases/v0.0.6/.claude → up 3 = repo root (Durante/)
    const repoRoot = resolve(realDosDir, '..', '..', '..');
    const candidate = join(repoRoot, 'Tools', 'dos-backup.ts');
    if (existsSync(candidate)) return candidate;
  } catch { /* realpathSync fails on non-existent paths */ }

  // Strategy 2: installed copy
  const installCandidate = join(DOS_DIR, 'DOS', 'Tools', 'dos-backup.ts');
  if (existsSync(installCandidate)) return installCandidate;

  return null;
}

function lastBackupAge(): string {
  try {
    const backupRoot = join(
      homedir(),
      'Library',
      'Application Support',
      'DOS',
      'backups',
    );
    if (!existsSync(backupRoot)) return 'never';
    // Get most recent date-labelled dir
    const { readdirSync } = require('node:fs');
    const dirs = readdirSync(backupRoot)
      .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse();
    if (dirs.length === 0) return 'never';
    const latest = dirs[0];
    const latestPath = join(backupRoot, latest, 'MANIFEST.json');
    if (!existsSync(latestPath)) return latest;
    const stat = statSync(latestPath);
    const ageMs = Date.now() - stat.mtime.getTime();
    const ageHours = Math.round(ageMs / (1000 * 60 * 60));
    return ageHours < 24 ? `${ageHours}h ago` : `${Math.round(ageHours / 24)}d ago`;
  } catch {
    return 'unknown';
  }
}

const _t = startTimer('MemoryBackup');
process.on('exit', () => {
  try { stopTimer(_t, 'SessionEnd'); } catch { /* never fail */ }
});

const backupScript = findBackupScript();

if (!backupScript) {
  console.error('[MemoryBackup] dos-backup.ts not found — skipping backup');
  console.error(`[MemoryBackup] last backup: ${lastBackupAge()}`);
  process.exit(0);
}

// Spawn detached — does not block SessionEnd
try {
  const child = spawn(process.execPath, [backupScript], {
    env: { ...process.env },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  console.error(`[MemoryBackup] spawned dos-backup.ts pid=${child.pid ?? -1}, last backup: ${lastBackupAge()}`);
} catch (err) {
  console.error(`[MemoryBackup] failed to spawn dos-backup.ts: ${err}`);
}

process.exit(0);
