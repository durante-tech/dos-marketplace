#!/usr/bin/env bun
/**
 * LastResponseCache.hook.ts — Cache last response for RatingCapture bridge
 *
 * PURPOSE:
 * Caches the last assistant response text to disk so RatingCapture
 * (which fires on UserPromptSubmit) can access the previous response.
 *
 * TRIGGER: Stop
 *
 * NEEDS TRANSCRIPT: No (uses last_assistant_message from stdin, transcript fallback)
 */

import { readHookInput, parseTranscriptFromInput, startTimer, stopTimer } from './lib/hook-io';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

async function main() {
  const input = await readHookInput();
  if (!input) { process.exit(0); }

  // Prefer last_assistant_message from stdin (v2.1.47+), fall back to transcript parse
  let lastResponse = input.last_assistant_message;
  if (!lastResponse) {
    const parsed = await parseTranscriptFromInput(input);
    lastResponse = parsed.lastMessage;
  }

  if (lastResponse) {
    try {
      const dosDir = process.env.DOS_DIR || join(homedir(), '.claude');
      // Session-KEY the cache: a single global last-response.txt is shared by
      // ALL concurrent sessions across ALL projects, so a second session (esp.
      // in a loop fleet) overwrites it and RatingCapture then bakes THIS session's
      // response into the WRONG session's low-rating learning (H-070, the H-066
      // global/project class). RatingCapture reads the same session-keyed name.
      const cachePath = join(
        dosDir, 'MEMORY', 'STATE',
        input.session_id ? `last-response-${input.session_id}.txt` : 'last-response.txt',
      );
      writeFileSync(cachePath, lastResponse.slice(0, 2000), 'utf-8');
    } catch (err) {
      console.error('[LastResponseCache] Failed to write:', err);
    }
  }

  process.exit(0);
}

const _t = startTimer('LastResponseCache');
process.on('exit', () => stopTimer(_t, 'Stop'));
main().catch((err) => {
  console.error('[LastResponseCache] Fatal:', err);
  process.exit(0);
});
