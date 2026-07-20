#!/usr/bin/env bun
/**
 * DocIntegrity.hook.ts — Check cross-refs if system docs/hooks were modified
 *
 * PURPOSE:
 * Runs deterministic + inference-powered doc integrity checks when system
 * files (hooks, DOS docs, skills, components) were modified during the session.
 * Self-gating: returns instantly when no system files changed.
 *
 * TRIGGER: Stop
 *
 * NEEDS TRANSCRIPT: Yes (to detect which files were modified via tool_use entries)
 *
 * HANDLER: handlers/DocCrossRefIntegrity.ts
 *
 * PERF: ran foreground synchronously and burned ~15s per Stop event on LLM
 * doc-drift inference. Now detaches to a background process via
 * lib/detachWorker. Foreground exits in ~20ms; the inference keeps running.
 */

import { parseTranscriptFromInput, startTimer, stopTimer } from './lib/hook-io';
import { handleDocCrossRefIntegrity } from './handlers/DocCrossRefIntegrity';
import { runDetachedOrForeground, logBg } from './lib/detachWorker';
import { loadProjectEnv } from './lib/paths';

loadProjectEnv();

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  hook_event_name?: string;
}

async function heavyWork(input: HookInput): Promise<void> {
  const parsed = await parseTranscriptFromInput(input as any);
  try {
    await handleDocCrossRefIntegrity(parsed, input as any);
  } catch (err) {
    // This runs in the detached child (stdio:'ignore'), and heavyWork then resolves
    // normally — so without a structured line, runDetachedOrForeground logs phase:done
    // and a real handler failure is indistinguishable from a clean, drift-free run.
    // Mirror to logBg, the channel detachWorker keeps "so silent failures are
    // detectable" (Forge H-118, the muted-diagnostics class of H-112).
    console.error('[DocIntegrity] Handler failed:', err);
    logBg({ hook: 'DocIntegrity', mode: 'bg', phase: 'handler-error', error: String(err) });
  }
}

// Foreground timer only — background duration is captured in hook-bg.jsonl.
if (process.env.DOS_HOOK_BG !== '1') {
  const _t = startTimer('DocIntegrity');
  process.on('exit', () => stopTimer(_t, 'Stop'));
}

runDetachedOrForeground<HookInput>({
  hookName: 'DocIntegrity',
  heavyWork,
}).catch((err) => {
  console.error('[DocIntegrity] Fatal:', err);
  logBg({ hook: 'DocIntegrity', mode: 'bg', phase: 'fatal', error: String(err) });
  process.exit(0);
});
