/**
 * hook-io.ts — Shared stdin reader + timing utilities for DOS hooks
 *
 * Eliminates duplicated stdin-reading boilerplate across individual hooks.
 * Each hook calls readHookInput() to get the parsed JSON payload, and
 * parseTranscriptFromInput() if it needs the full transcript.
 *
 * Timing utilities (startTimer / stopTimer) let hooks measure their own
 * execution time. Data lands in a JSONL file for analysis.
 */

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { applyPluginEnvSeams, isPluginInstall } from './plugin-data-env';

// ─── Hook Timing ─────────────────────────────────

// Apply before any importer computes module-level DOS_DIR/MEMPALACE_DIR.
const RUNTIME_ENV = applyPluginEnvSeams(process.env);
const TIMING_DIR = join(
  RUNTIME_ENV.DOS_DIR || join(homedir(), '.claude'),
  'MEMORY',
  'STATE',
);
const TIMING_FILE = join(TIMING_DIR, 'hook-timing.jsonl');
const TRANSCRIPT_PARSER_PATH = isPluginInstall(RUNTIME_ENV)
  ? join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'DOS', 'Tools', 'TranscriptParser.ts')
  : join(RUNTIME_ENV.DOS_DIR || join(homedir(), '.claude'), 'DOS', 'Tools', 'TranscriptParser.ts');
const MAX_LINES = 1000;
const TRIM_TO = 500;

export interface ParsedTranscript {
  raw: string;
  lastMessage: string;
  userPrompt: string;
  currentResponseText: string;
  voiceCompletion: string;
  plainCompletion: string;
  structured: Record<string, string | undefined>;
  responseState: 'awaitingInput' | 'completed' | 'error';
}

export interface TimerHandle {
  hookName: string;
  startMs: number;
}

/**
 * Start a timer for a hook. Returns a handle to pass to stopTimer.
 */
export function startTimer(hookName: string): TimerHandle {
  return { hookName, startMs: Date.now() };
}

/**
 * Stop a timer and append the timing record to the JSONL file.
 * Never throws — timing failures must not break hooks.
 */
export function stopTimer(timer: TimerHandle, event?: string): void {
  try {
    const durationMs = Date.now() - timer.startMs;
    const record = JSON.stringify({
      hook: timer.hookName,
      event: event || 'unknown',
      duration_ms: durationMs,
      timestamp: new Date().toISOString(),
    });

    // Ensure directory exists
    if (!existsSync(TIMING_DIR)) {
      mkdirSync(TIMING_DIR, { recursive: true });
    }

    appendFileSync(TIMING_FILE, record + '\n', 'utf-8');

    // Cap file size: if over MAX_LINES, trim to last TRIM_TO
    trimTimingFileIfNeeded();
  } catch {
    // Never fail the hook
  }
}

/**
 * If the timing file exceeds MAX_LINES, truncate to the last TRIM_TO lines.
 */
function trimTimingFileIfNeeded(): void {
  try {
    if (!existsSync(TIMING_FILE)) return;
    const content = readFileSync(TIMING_FILE, 'utf-8');
    const lines = content.split('\n').filter(l => l.length > 0);
    if (lines.length > MAX_LINES) {
      const trimmed = lines.slice(-TRIM_TO);
      // writeArtifact:exempt — hook-timing.jsonl trim (scratch path via const)
      writeFileSync(TIMING_FILE, trimmed.join('\n') + '\n', 'utf-8');
    }
  } catch {
    // Never fail the hook
  }
}

export interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
  last_assistant_message?: string;
}

/**
 * Read and parse JSON from stdin with a 500ms timeout.
 * Returns null if stdin is empty or malformed.
 */
export async function readHookInput(): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = '';

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 500);
    });

    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();

    await Promise.race([readPromise, timeoutPromise]);

    if (input.trim()) {
      return JSON.parse(input) as HookInput;
    }
  } catch (error) {
    console.error('[hook-io] Error reading stdin:', error);
  }
  return null;
}

/**
 * Parse transcript from hook input. Waits 150ms for transcript to be
 * fully written to disk before parsing.
 */
export async function parseTranscriptFromInput(input: HookInput): Promise<ParsedTranscript> {
  await new Promise(resolve => setTimeout(resolve, 150));
  const { parseTranscript } = await import(TRANSCRIPT_PARSER_PATH);
  return parseTranscript(input.transcript_path);
}
