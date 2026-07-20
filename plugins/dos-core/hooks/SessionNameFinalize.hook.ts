#!/usr/bin/env bun
/**
 * SessionNameFinalize.hook.ts - Finalize session name at SessionEnd
 *
 * PURPOSE:
 * Re-names the session using actual conversation content instead of the
 * first-prompt keyword extraction. Reads last 5 user messages, runs
 * Haiku inference to produce an accurate 4-8 word title.
 *
 * TRIGGER: SessionEnd (Group 1 — runs before StudioSync so the name
 *          is finalized before it syncs to Studio)
 *
 * PERFORMANCE:
 * - ~1-2s (Haiku inference on ~500 tokens)
 * - Skips if session has < 3 messages
 */

import { startTimer, stopTimer, readHookInput } from './lib/hook-io';
import { spawn as nodeSpawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');

async function main() {
  // Shared reader: loops until EOF and cancels the pending read. A single
  // reader.read() (the old code) returns only the FIRST chunk, so a SessionEnd
  // payload split across chunks silently truncated, JSON.parse failed into the
  // empty catch, sessionId stayed '' and the session name was never finalized —
  // indistinguishable from "no stdin" (H-080).
  const input = await readHookInput();
  const sessionId = (input?.session_id as string | undefined) || '';

  if (!sessionId) {
    process.exit(0);
  }

  // Spawn finalize as detached process (non-blocking)
  try {
    const hookPath = join(DOS_DIR, 'hooks', 'SessionAutoName.hook.ts');
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const child = nodeSpawn('bun', [hookPath, '--finalize', sessionId], {
      detached: true,
      stdio: 'ignore',
      env,
    });
    child.unref();
    console.error(`[SessionNameFinalize] Spawned finalize for ${sessionId}`);
  } catch {
    // Non-critical
  }

  process.exit(0);
}

const _t = startTimer('SessionNameFinalize');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));
main();
