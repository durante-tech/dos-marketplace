#!/usr/bin/env bun
/**
 * IntegrityCheck.hook.ts - DOS Integrity Check (SessionEnd)
 *
 * Runs system integrity check — detects DOS system file changes, spawns background maintenance.
 * Doc cross-ref integrity is handled by DocIntegrity.hook.ts (Stop event) to avoid double execution.
 *
 * TRIGGER: SessionEnd
 * PERFORMANCE: ~50ms (single transcript parse, one handler call). Non-blocking.
 */

import { parseTranscript } from '../DOS/Tools/TranscriptParser';
import { handleSystemIntegrity } from './handlers/SystemIntegrity';
import { startTimer, stopTimer } from './lib/hook-io';

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

async function readStdin(): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = '';
    const timeout = new Promise<void>(r => setTimeout(r, 500));
    const read = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();
    await Promise.race([read, timeout]);
    if (input.trim()) return JSON.parse(input) as HookInput;
  } catch {}
  return null;
}

async function main() {
  const hookInput = await readStdin();
  if (!hookInput?.transcript_path) { process.exit(0); }

  const parsed = parseTranscript(hookInput.transcript_path);

  // Run system integrity check (doc cross-ref is handled by DocIntegrity.hook.ts)
  await handleSystemIntegrity(parsed, hookInput);

  process.exit(0);
}

const _t = startTimer('IntegrityCheck');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));
main().catch(() => process.exit(0));
