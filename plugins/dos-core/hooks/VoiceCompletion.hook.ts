#!/usr/bin/env bun
/**
 * VoiceCompletion.hook.ts — Send completion voice line to TTS server
 *
 * PURPOSE:
 * Extracts the 🗣️ voice line from Claude's response and sends it to
 * the ElevenLabs voice server for spoken playback.
 *
 * TRIGGER: Stop
 *
 * NEEDS TRANSCRIPT: Yes (for voice line extraction)
 *
 * VOICE GATE: Only fires for main terminal sessions (not subagents).
 * Checks for kitty-sessions/{sessionId}.json to determine if main session.
 *
 * HANDLER: handlers/VoiceNotification.ts
 */

import { readHookInput, parseTranscriptFromInput, startTimer, stopTimer } from './lib/hook-io';
import { handleVoice } from './handlers/VoiceNotification';

/**
 * Voice gate: only main terminal sessions get voice.
 * The old kitty-sessions file check was unreliable — new sessions
 * had no file and were incorrectly blocked.
 */
function isMainSession(): boolean {
  // A subagent is signalled by CLAUDE_AGENT_TYPE — the DOS-wide convention, proven
  // live (WorktreeMemoryWriteGuard gates on it; 50 real Explore events in
  // worktree-write-blocks.jsonl). The primary session carries no agent type.
  //
  // The prior gate keyed ONLY on CLAUDE_CODE_AGENT_TASK_ID, which appears in no
  // other file in the tree and in no telemetry, so the subagent branch could never
  // be taken and every subagent Stop announced by voice. That env var is kept as a
  // belt-and-suspenders in case Claude Code itself sets it (the docstring claimed
  // so; I could not confirm or refute an external var), but the gate no longer
  // depends on it alone. This is additive: a real main session has both unset and
  // is still main, so it only tightens subagent suppression. (Forge H-113.)
  return !process.env.CLAUDE_CODE_AGENT_TASK_ID && !process.env.CLAUDE_AGENT_TYPE;
}

async function main() {
  const input = await readHookInput();
  if (!input) { process.exit(0); }

  // Voice gate: skip subagent sessions
  if (!isMainSession()) {
    console.error('[VoiceCompletion] Voice OFF (not main session)');
    process.exit(0);
  }

  const parsed = await parseTranscriptFromInput(input);

  try {
    await handleVoice(parsed, input.session_id);
  } catch (err) {
    console.error('[VoiceCompletion] Handler failed:', err);
  }

  process.exit(0);
}

const _t = startTimer('VoiceCompletion');
process.on('exit', () => stopTimer(_t, 'Stop'));
main().catch((err) => {
  console.error('[VoiceCompletion] Fatal:', err);
  process.exit(0);
});
