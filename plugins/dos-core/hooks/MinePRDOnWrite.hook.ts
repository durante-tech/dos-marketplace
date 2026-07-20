#!/usr/bin/env bun
/**
 * MinePRDOnWrite.hook.ts — Auto-mine PRDs into MemPalace on write.
 *
 * TRIGGER: PostToolUse on Write | Edit | MultiEdit
 *
 * Fires when the written file is a PRD.md (i.e., its path ends with /PRD.md).
 * Invokes the MemPalace bridge `mine_file` action fire-and-forget so the PRD's
 * decisions / criteria / verification sections get smart-chunked and filed as
 * drawers immediately, without waiting for the SessionEnd harvest cycle.
 *
 * RFC-0005 §14.3 — decision to auto-mine PRDs on write.
 *
 * NON-BLOCKING:
 *   - always exits 0 so the user's flow is never interrupted
 *   - detached subprocess; parent hook returns immediately
 *   - silent no-op when the bridge is not installed or the path does not match
 */

import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { bridgeObserved } from './lib/mempalace';
import { resolveProjectWingFromEnv } from './lib/project-resolver';
import { startTimer, stopTimer } from './lib/hook-io';

// mtime gate cache — skip mine_file when the file's mtime hasn't changed since
// the last mine. The chunker re-mines every chunk on every write; with
// chunk_size=2000 a 15KB PRD generates ~6-12 embedding+dedup-check cycles per
// write (95% land as dupes — 4-8s each is wasted). Cache hit = 1ms fs.statSync
// + 1 JSON read, vs ~5-10s of bridge subprocess + embedding compute.
// Investigation 2026-05-17: same PRD hash mined 34× in 4h pre-gate.
const MINE_CACHE_PATH = join(homedir(), '.claude', 'MEMORY', 'STATE', 'mine-prd-cache.json');

function loadMineCache(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(MINE_CACHE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveMineCache(cache: Record<string, number>): void {
  try {
    mkdirSync(dirname(MINE_CACHE_PATH), { recursive: true });
    writeFileSync(MINE_CACHE_PATH, JSON.stringify(cache));
  } catch {
    /* best-effort — cache miss next time falls through to mine, not a bug */
  }
}

interface HookInput {
  tool_input?: {
    file_path?: string;
  };
}

async function readStdin(): Promise<HookInput | null> {
  try {
    const raw = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 300)),
    ]);
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const input = await readStdin();
  const filePath = input?.tool_input?.file_path ?? '';

  // Only PRD.md files
  if (!filePath.endsWith('/PRD.md') || !existsSync(filePath)) {
    return;
  }

  // mtime gate — skip when the file hasn't changed since the last mine.
  // Fire-and-forget mine fires the cache update synchronously after the spawn
  // so subsequent same-mtime writes short-circuit. False positive (mine fails
  // but cache says succeeded) is benign: next operator write changes mtime
  // and the mine retries naturally.
  let currentMtime: number;
  try {
    currentMtime = statSync(filePath).mtimeMs;
  } catch {
    return; // path unreadable — silent no-op consistent with hook contract
  }
  const cache = loadMineCache();
  if (cache[filePath] === currentMtime) {
    return; // unchanged file — gate fires, skip the ~5-10s mine cost
  }

  // Route to the owning project's wing so mined drawers file correctly.
  const { wing } = resolveProjectWingFromEnv();

  // Observed background call — foreground stays fast while the worker records
  // success/failure in mempalace-bridge-events.jsonl.
  bridgeObserved('mine_file', {
    filepath: filePath,
    wing: wing || 'general',
    room: 'prds',
  }, { hook: 'MinePRDOnWrite', timeoutMs: 300000 });

  cache[filePath] = currentMtime;
  saveMineCache(cache);
}

const _t = startTimer('MinePRDOnWrite');
process.on('exit', () => stopTimer(_t, 'PostToolUse'));
main().catch((err) => {
  console.error('[MinePRDOnWrite] error:', err?.message ?? err);
  process.exit(0);
});
