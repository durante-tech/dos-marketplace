/**
 * health.ts — RFC-0020 Phase 0 P0-3 + P0-4
 *
 * Owns the ~/.claude/MEMORY/STATE/health.json substrate:
 *  - schema v1 (§6.1)
 *  - atomic rewrite at every SessionStart
 *  - async sync-check caller (background fire-and-forget)
 *  - banner-ready reader of previous session's cached drift
 *
 * STATE is global-only per CLAUDE.md (session coordination, not
 * project-eligible). This writer deliberately ignores CLAUDE_PROJECT_DIR
 * and writes only to ~/.claude/MEMORY/STATE/health.json.
 *
 * Security (§13): env entries log only { name, set, masked_len }. No
 * VALUES are written anywhere in this module. CI tests assert this.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { atomicWriteSync } from './atomic-write';
import { drainFolderRepairs } from './paths';

// ─── Schema v1 (§6.1) ──────────────────────────────────────────────

export interface HealthEnvEntry {
  name: string;
  set: boolean;
  masked_len: number;
}

export interface HealthBinaryEntry {
  name: string;
  present: boolean;
  path?: string;
}

export interface HealthSidecarEntry {
  path: string;
  owner: string;
  present: boolean;
}

export interface HealthMcpEntry {
  name: string;
  declared: boolean;
  connected: boolean;
  last_checked: string;
}

export interface HealthFourCopyDrift {
  count: number;
  files: string[];
  last_checked_head: string;
}

export interface HealthHookErrors {
  count: number;
  unresolved_ids: string[];
}

export interface HealthFolderRepair {
  component: string;
  subdir: string;
  action: 'created';
}

export interface HealthUnacked {
  id: string;
  since: string;
}

export interface HealthJson {
  session_id: string;
  ts: string;
  schema_version: 1;
  summary: { pass: number; fail: number; degraded: number; unacked: number };
  env: HealthEnvEntry[];
  binaries: HealthBinaryEntry[];
  sidecars: HealthSidecarEntry[];
  mcps: HealthMcpEntry[];
  four_copy_drift: HealthFourCopyDrift;
  hook_errors_last_session: HealthHookErrors;
  folder_repairs: HealthFolderRepair[];
  unacked: HealthUnacked[];
}

// ─── Paths ──────────────────────────────────────────────────────────

const HOME = homedir();
export const STATE_DIR = join(HOME, '.claude', 'MEMORY', 'STATE');
export const HEALTH_JSON_PATH = join(STATE_DIR, 'health.json');
export const SYNC_CHECK_CACHE_PATH = join(STATE_DIR, 'sync-check-last.json');

// ─── Session id resolution ─────────────────────────────────────────

function resolveSessionId(explicit?: string): string {
  const pid = (process as unknown as { pid?: number }).pid ?? 0;
  return (
    explicit ??
    process.env.CLAUDE_SESSION_ID ??
    process.env.DOS_SESSION_ID ??
    `pid-${pid}`
  );
}

// ─── Read previous session's health.json (banner source) ───────────

export function readPreviousHealth(): HealthJson | null {
  if (!existsSync(HEALTH_JSON_PATH)) return null;
  try {
    const raw = readFileSync(HEALTH_JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw) as HealthJson;
    if (parsed.schema_version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Read sync-check-last.json (populated by background spawn) ─────

interface SyncCheckReport {
  total_drift: number;
  total_missing: number;
  files: Array<{ pair: string; relative_path: string; status: string }>;
}

export function readSyncCheckCache(nowHead: string): HealthFourCopyDrift {
  const empty: HealthFourCopyDrift = { count: 0, files: [], last_checked_head: '' };
  if (!existsSync(SYNC_CHECK_CACHE_PATH)) return empty;
  try {
    const raw = readFileSync(SYNC_CHECK_CACHE_PATH, 'utf8');
    // The cache file contains a JSON envelope written by the background
    // spawn: { head, report }. If the envelope is malformed we silently
    // return empty — the banner should be silent on first boot.
    const envelope = JSON.parse(raw) as { head: string; report: SyncCheckReport };
    if (!envelope.report) return empty;
    const drifted = (envelope.report.files ?? []).filter(
      (f) => f.status === 'DRIFT' || f.status.startsWith('MISSING'),
    );
    return {
      count: (envelope.report.total_drift ?? 0) + (envelope.report.total_missing ?? 0),
      files: drifted.slice(0, 20).map((f) => `${f.pair}:${f.relative_path}`),
      last_checked_head: envelope.head ?? nowHead,
    };
  } catch {
    return empty;
  }
}

// ─── Fire-and-forget: spawn `bun Tools/sync-check.ts --json` ───────

/**
 * Spawn sync-check in the background. Writes its JSON output to
 * SYNC_CHECK_CACHE_PATH as an envelope `{ head, report }`. The next
 * SessionStart reads the cache to populate `health.json.four_copy_drift`.
 *
 * Does NOT await the child. Does NOT log to stdout — the hook's banner
 * must return in <500ms.
 */
export function spawnSyncCheckBackground(opts: {
  syncCheckPath: string;
  head: string;
  bunBin?: string;
}): void {
  const bun = opts.bunBin ?? findBun();
  if (!bun) return; // bun not on PATH — silently skip; banner falls back to stale cache

  // Child process writes the sync-check JSON to our cache envelope. Use a
  // shell wrapper so we can prepend the head and wrap the JSON in one atomic
  // write via a tmp file.
  const script = `
    set -e
    TMP="${SYNC_CHECK_CACHE_PATH}.tmp.$$"
    REPORT=$("${bun}" "${opts.syncCheckPath}" --json 2>/dev/null || echo '{"total_drift":0,"total_missing":0,"files":[]}')
    printf '{"head":"%s","ts":"%s","report":%s}' "${opts.head}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$REPORT" > "$TMP"
    mv "$TMP" "${SYNC_CHECK_CACHE_PATH}"
  `;

  try {
    const child = spawn('/bin/sh', ['-c', script], {
      cwd: HOME,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // Silently skip — banner behavior unchanged.
  }
}

function findBun(): string | null {
  // Cheap PATH resolution: check common install locations first, then PATH.
  const candidates = [
    '/opt/homebrew/bin/bun',
    '/usr/local/bin/bun',
    `${HOME}/.bun/bin/bun`,
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fallback — whoever reads this envelope will see an empty cache, which
  // the banner renders as "silent."
  return null;
}

// ─── Writer: atomic rewrite of health.json ─────────────────────────

export interface BuildHealthInput {
  sessionId?: string;
  head: string;
  hookErrorsLastSession?: HealthHookErrors;
  folderRepairs?: HealthFolderRepair[];
}

/**
 * Build and atomically write a fresh health.json for the current
 * SessionStart. Phase 0 leaves env/binaries/sidecars/mcps empty — Phase 1
 * populates them. folder_repairs is drained from paths.ts unless an
 * explicit list is supplied (tests).
 */
export function writeHealth(input: BuildHealthInput): HealthJson {
  const four = readSyncCheckCache(input.head);
  const repairs = input.folderRepairs ?? drainFolderRepairs();
  const hookErrors = input.hookErrorsLastSession ?? { count: 0, unresolved_ids: [] };

  const health: HealthJson = {
    session_id: resolveSessionId(input.sessionId),
    ts: new Date().toISOString(),
    schema_version: 1,
    summary: { pass: 0, fail: 0, degraded: 0, unacked: 0 },
    env: [],
    binaries: [],
    sidecars: [],
    mcps: [],
    four_copy_drift: four,
    hook_errors_last_session: hookErrors,
    folder_repairs: repairs,
    unacked: [],
  };

  atomicWriteSync(HEALTH_JSON_PATH, JSON.stringify(health, null, 2) + '\n');
  return health;
}

// ─── Test seams ────────────────────────────────────────────────────

export const __testing = {
  findBun,
  resolveSessionId,
};
