#!/usr/bin/env bun
/**
 * BootstrapDlqDirs — create the DLQ directory structure under MEMORY/
 *
 * Called from Sentinel scan Phase 1b. Sentinel is the ONLY path that
 * creates .pending/ + .streaming/ + .quarantine/ directories — the
 * dlq.ts and streamEvent.ts helpers both refuse to mkdir, so an
 * unbootstrapped install gracefully degrades to direct POST (dlq) or
 * no-op (streamEvent) instead of silently reaching into the wrong
 * memory tier.
 *
 * BEHAVIOR
 * --------
 *   - Per sync-eligible subdir (WORK / LEARNING / RESEARCH / ARTIFACTS
 *     / SECURITY at project + STATE / VOICE / RELATIONSHIP at install),
 *     create:
 *         MEMORY/{subdir}/.pending/      (mode 0600, principal UID)  # iter-1
 *         MEMORY/{subdir}/.streaming/    (mode 0600, principal UID)  # iter-2 PR3a
 *         MEMORY/{subdir}/.unfsynced/    (mode 0600, principal UID)  # iter-2 PR3a (fsync watchdog)
 *         MEMORY/{subdir}/.quarantine/   (mode 0700, principal UID)
 *   - At successful completion, write `.sentinel/.bootstrapped` marker
 *     at the project root AND the install root so that streamEvent.ts's
 *     bootstrap gate can confirm initialization.
 *   - macOS: run `tmutil addexclusion` on each created .pending/ and
 *     .streaming/ so Time Machine doesn't back up partially-flushed queues.
 *   - iCloud / Dropbox refusal: if MEMORY/ resolves under a known
 *     cloud-sync root, refuse bootstrap with an actionable error.
 *     rename(2) atomicity is not guaranteed under advisory-lock
 *     filesystems and corrupts the DLQ silently.
 *   - Idempotent: re-running is safe — existing dirs are chmod-fixed
 *     but not touched otherwise.
 *
 * See Plans/Specs/studio-sync-resilience.md Primitive #3 (bootstrap gate).
 * See Plans/Specs/studio-sync-streaming.md Primitive #3 (streaming bootstrap).
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { spawnSync } from 'child_process';
import { homedir, platform } from 'os';
import { join, resolve } from 'path';

// ─────────────────────────────────────────────────────────────────────
// Subdir table
// ─────────────────────────────────────────────────────────────────────

const PROJECT_ELIGIBLE_SUBDIRS = [
  'WORK',
  'LEARNING',
  'RESEARCH',
  'ARTIFACTS',
  'SECURITY',
] as const;

const INSTALL_ONLY_SUBDIRS = [
  'STATE',
  'VOICE',
  'RELATIONSHIP',
] as const;

// ─────────────────────────────────────────────────────────────────────
// Cloud-sync refusal
// ─────────────────────────────────────────────────────────────────────

const CLOUD_SYNC_PREFIXES = [
  join(homedir(), 'Library', 'Mobile Documents'), // iCloud
  join(homedir(), 'Dropbox'),
  join(homedir(), 'OneDrive'),
  join(homedir(), 'Google Drive'),
  join(homedir(), 'pCloud'),
  join(homedir(), 'Box'),
];

function isUnderCloudSync(abs: string): string | null {
  const a = resolve(abs);
  for (const prefix of CLOUD_SYNC_PREFIXES) {
    const p = resolve(prefix);
    if (a === p || a.startsWith(p + '/')) return prefix;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Directory creation — idempotent
// ─────────────────────────────────────────────────────────────────────

interface BootstrapResult {
  created: string[];
  existing: string[];
  refused: string[];
  excluded: string[];
  warnings: string[];
}

function ensureDir(
  path: string,
  mode: number,
  result: BootstrapResult,
): boolean {
  if (existsSync(path)) {
    result.existing.push(path);
    try {
      chmodSync(path, mode);
    } catch {
      result.warnings.push(`chmod ${path}: failed`);
    }
    return true;
  }
  try {
    mkdirSync(path, { recursive: true, mode });
    result.created.push(path);
    return true;
  } catch (err) {
    result.warnings.push(
      `mkdir ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

function addTimeMachineExclusion(path: string, result: BootstrapResult): void {
  if (platform() !== 'darwin') return;
  // Escape hatch for CI/tests/sandboxes where `tmutil` is slow or restricted —
  // exclusion is a non-critical TM optimization, never a correctness gate.
  if (process.env.DOS_SKIP_TMUTIL === '1') return;
  const exclusion = spawnSync('tmutil', ['addexclusion', path], {
    stdio: 'pipe',
  });
  if (!exclusion.error && exclusion.status === 0) {
    result.excluded.push(path);
    return;
  }
  // tmutil requires specific perms; not critical
  result.warnings.push(`tmutil addexclusion ${path}: failed`);
}

function bootstrapSubdir(
  memRoot: string,
  subdir: string,
  result: BootstrapResult,
): void {
  const parent = join(memRoot, subdir);
  if (!existsSync(parent)) {
    result.warnings.push(
      `${parent} does not exist — run Phase 1b MEMORY/ scaffold first`,
    );
    return;
  }

  const cloudRoot = isUnderCloudSync(parent);
  if (cloudRoot) {
    result.refused.push(`${parent} (under ${cloudRoot})`);
    return;
  }

  // 0o700 not 0o600 — directories without the execute bit deny traversal,
  // so any openSync inside returns EACCES. Matches sibling .quarantine
  // below and project-level .pending dirs that have always been 0o700.
  // Regression fixed 2026-04-27 after silent-drop investigation traced
  // 4 INSTALL_ONLY endpoint dropouts (sessions/plans/memory-snapshots/
  // hook-metrics) to this bit.
  const pendingDir = join(parent, '.pending');
  if (ensureDir(pendingDir, 0o700, result)) {
    addTimeMachineExclusion(pendingDir, result);
  }

  // iter-2 PR3a: sibling .streaming/ queue + .unfsynced/ watchdog sink.
  const streamingDir = join(parent, '.streaming');
  if (ensureDir(streamingDir, 0o700, result)) {
    addTimeMachineExclusion(streamingDir, result);
  }
  const unfsyncedDir = join(parent, '.unfsynced');
  ensureDir(unfsyncedDir, 0o700, result);

  const quarantineDir = join(parent, '.quarantine');
  ensureDir(quarantineDir, 0o700, result);
}

function writeBootstrapSentinel(root: string, result: BootstrapResult): void {
  const sentinelDir = join(root, '.sentinel');
  if (!ensureDir(sentinelDir, 0o755, result)) return;
  const marker = join(sentinelDir, '.bootstrapped');
  try {
    // writeArtifact:exempt — .sentinel/.bootstrapped marker (state)
    writeFileSync(
      marker,
      JSON.stringify(
        {
          bootstrappedAt: new Date().toISOString(),
          tool: 'BootstrapDlqDirs',
          host: process.env.HOSTNAME ?? '',
          uid: process.getuid?.() ?? -1,
        },
        null,
        2,
      ) + '\n',
      { mode: 0o644 },
    );
    result.created.push(marker);
  } catch (err) {
    result.warnings.push(
      `writeFile ${marker}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function uidCheck(memRoot: string, result: BootstrapResult): void {
  try {
    const st = statSync(memRoot);
    const myUid = process.getuid?.();
    if (myUid !== undefined && st.uid !== myUid) {
      result.warnings.push(
        `MEMORY/ uid=${st.uid}, current uid=${myUid} — principal UID mismatch; non-UID files will quarantine`,
      );
    }
  } catch {
    // Non-critical
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectRoot = args[0] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const installRoot = process.env.DOS_DIR ?? join(homedir(), '.claude');

  const result: BootstrapResult = {
    created: [],
    existing: [],
    refused: [],
    excluded: [],
    warnings: [],
  };

  // Project-level bootstrap
  const projectMem = join(projectRoot, 'MEMORY');
  if (existsSync(projectMem)) {
    uidCheck(projectMem, result);
    for (const subdir of PROJECT_ELIGIBLE_SUBDIRS) {
      bootstrapSubdir(projectMem, subdir, result);
    }
  } else {
    result.warnings.push(
      `${projectMem} does not exist — project-level bootstrap skipped. Run Sentinel Phase 1b first.`,
    );
  }

  // Install-level bootstrap (STATE / VOICE / RELATIONSHIP)
  const installMem = join(installRoot, 'MEMORY');
  if (existsSync(installMem)) {
    uidCheck(installMem, result);
    for (const subdir of INSTALL_ONLY_SUBDIRS) {
      // No Sentinel scan step mkdir's the install-level STATE/VOICE/RELATIONSHIP
      // parents (projectScaffoldDirs deliberately excludes them), so on a fresh
      // install bootstrapSubdir would early-return with a warning and these dirs
      // would never get .pending/.quarantine (sentinel-rest-015). Create the
      // parent here when absent — recursive — before bootstrapping it. Existing
      // dirs are left untouched (no perm change) so this stays idempotent.
      const installSubdir = join(installMem, subdir);
      if (!existsSync(installSubdir)) {
        ensureDir(installSubdir, 0o755, result);
      }
      bootstrapSubdir(installMem, subdir, result);
    }
    // Install-level also gets .pending/ for project-eligible subdirs
    // because some tools use install-scope regardless (see dlq.ts
    // INSTALL_ONLY set).
    for (const subdir of PROJECT_ELIGIBLE_SUBDIRS) {
      const parent = join(installMem, subdir);
      if (existsSync(parent)) bootstrapSubdir(installMem, subdir, result);
    }
  } else {
    result.warnings.push(
      `${installMem} does not exist — install-level bootstrap skipped`,
    );
  }

  // iter-2 PR3a: write .sentinel/.bootstrapped marker at both roots so
  // that streamEvent.ts's bootstrap gate can confirm initialization.
  // Skip if we hit any refusal OR any mkdir failure — a partial bootstrap
  // (queue dirs that failed to create) must NOT claim the install is ready,
  // or streamEvent.ts routes writes to a non-existent tier (sentinel-rest-007).
  const mkdirFailed = result.warnings.some((w) => w.startsWith('mkdir '));
  if (result.refused.length === 0 && !mkdirFailed) {
    writeBootstrapSentinel(projectRoot, result);
    if (projectRoot !== installRoot) {
      writeBootstrapSentinel(installRoot, result);
    }
  }

  console.log(JSON.stringify(result, null, 2));

  if (result.refused.length > 0) {
    process.stderr.write(
      `\n[BootstrapDlqDirs] REFUSED: MEMORY/ lives under a cloud-sync root. ` +
        `Move MEMORY/ off iCloud/Dropbox/OneDrive/etc or set DOS_DIR to a local path.\n`,
    );
    process.exit(2);
  }
}

await main();
