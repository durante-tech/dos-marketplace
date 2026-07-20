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

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'fs';
import { rotateIfNeeded } from './rotate';
import { join } from 'path';
import { homedir } from 'os';
import { applyPluginEnvSeams, isPluginInstall, PLUGIN_CODE_PATHS } from './plugin-data-env';

// ─── Hook Timing ─────────────────────────────────

// Apply before any importer computes module-level DOS_DIR/MEMPALACE_DIR. The
// maintainer path stays ~/.claude; plugin hooks route timing/state under their
// persistent plugin data. DOS_HOOK_IO_STATE_DIR remains a narrow test override.
const RUNTIME_ENV = applyPluginEnvSeams(process.env);
const TIMING_DIR = process.env.DOS_HOOK_IO_STATE_DIR || join(
  RUNTIME_ENV.DOS_DIR || join(homedir(), '.claude'),
  'MEMORY',
  'STATE',
);
const TIMING_FILE = join(TIMING_DIR, 'hook-timing.jsonl');
export const TRANSCRIPT_PARSER_PATH = isPluginInstall(RUNTIME_ENV)
  ? PLUGIN_CODE_PATHS.transcriptParserPath
  : join(RUNTIME_ENV.DOS_DIR || join(homedir(), '.claude'), 'DOS', 'Tools', 'TranscriptParser.ts');

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

// SIGKILL-proof breadcrumbs live in a SEPARATE file from hook-timing.jsonl.
// Rationale: hook-timing.jsonl is a *drained queue* — SaveHookMetricsToStudio
// removes the leading content it syncs (drainLeadingContent), which would erase
// a start breadcrumb before any killed-hook analysis could read it. Keeping the
// breadcrumbs here keeps hook-timing.jsonl byte-identical for every existing
// reader, and a hook SIGKILLed at session teardown is detectable as a
// `phase:"start"` line with no matching `phase:"finalize"` in this file.
const STARTS_FILE = join(TIMING_DIR, 'hook-starts.jsonl');

// TODO(HookTimingRotate.hook.ts): rotation/trimming is intentionally NOT
// done here. The previous read-full-and-rewrite pattern was a lossy race
// — two hooks finishing within milliseconds both re-read stale content
// and both rewrote, dropping each other's appended lines. A future
// dedicated rotation hook (e.g., HookTimingRotate.hook.ts on SessionEnd)
// should own size-capping with a single-writer guarantee. Until then we
// stay append-only; the file grows unbounded but loses no data.

export interface TimerHandle {
  hookName: string;
  startMs: number;
  /** pid+startMs correlation key linking the start ↔ finalize breadcrumbs. */
  id: string;
}

/**
 * Append one breadcrumb line to hook-starts.jsonl. Best-effort; never throws.
 * Kept separate from stopTimer's hook-timing.jsonl append so a failure in one
 * path cannot suppress the other.
 */
function appendBreadcrumb(record: Record<string, unknown>): void {
  try {
    if (!existsSync(TIMING_DIR)) mkdirSync(TIMING_DIR, { recursive: true });
    rotateStartsPreservingPairs();
    appendFileSync(STARTS_FILE, JSON.stringify(record) + '\n', 'utf-8');
  } catch {
    // Never fail the hook on a breadcrumb write.
  }
}

// Rotation must not split a start from its finalize across files: the killed-hook
// analysis `{starts} \ {finalizes}` is computed over hook-starts.jsonl alone, and a
// pair split by a plain rename reads as a false SIGKILL at every rotation boundary.
// So on rotation, carry every not-yet-finalized start line forward into the fresh
// file. The read→rename→write window can theoretically drop a concurrent append
// (breadcrumbs are best-effort telemetry); the previous behavior manufactured
// false kill diagnoses deterministically, which is strictly worse.
const STARTS_ROTATE_BYTES = 5 * 1024 * 1024;
function rotateStartsPreservingPairs(): void {
  try {
    const size = statSync(STARTS_FILE).size;
    if (size <= STARTS_ROTATE_BYTES) return;
    const lines = readFileSync(STARTS_FILE, 'utf-8').split('\n').filter(Boolean);
    const finalized = new Set<string>();
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        if (rec.phase === 'finalize' && rec.id) finalized.add(rec.id);
      } catch { /* skip malformed line */ }
    }
    const openStarts = lines.filter((line: string) => {
      try {
        const rec = JSON.parse(line);
        return rec.phase === 'start' && rec.id && !finalized.has(rec.id);
      } catch { return false; }
    });
    const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');
    renameSync(STARTS_FILE, STARTS_FILE.replace(/\.jsonl$/, `-${stamp}.jsonl`));
    if (openStarts.length) {
      appendFileSync(STARTS_FILE, openStarts.join('\n') + '\n', 'utf-8');
    }
  } catch {
    // ENOENT (no file yet) or any race — silent; append continues regardless.
  }
}

/**
 * Start a timer for a hook. Returns a handle to pass to stopTimer.
 *
 * Write-on-start: appends a `phase:"start"` breadcrumb to hook-starts.jsonl
 * IMMEDIATELY, so a hook SIGKILLed at session teardown (SIGKILL skips
 * process.on('exit'), so stopTimer never runs) still leaves durable proof it
 * started. The killed-hook set is exactly {starts} \ {finalizes}.
 */
export function startTimer(hookName: string): TimerHandle {
  const startMs = Date.now();
  const id = `${process.pid}-${startMs}`;
  appendBreadcrumb({
    ts: new Date(startMs).toISOString(),
    hook: hookName,
    pid: process.pid,
    phase: 'start',
    id,
  });
  return { hookName, startMs, id };
}

/**
 * Stop a timer and append the timing record to the JSONL file.
 * Never throws — timing failures must not break hooks.
 *
 * Append-only by design: rotation/trimming is deferred to a single-writer
 * rotation hook to eliminate the read-full-and-rewrite race (see TODO at
 * top of file).
 */
export function stopTimer(timer: TimerHandle, event?: string): void {
  try {
    const durationMs = Date.now() - timer.startMs;
    // hook-timing.jsonl schema is UNCHANGED (hook/event/duration_ms/timestamp) —
    // SaveHookMetricsToStudio and every other reader depend on this exact shape.
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

    rotateIfNeeded(TIMING_FILE);
    appendFileSync(TIMING_FILE, record + '\n', 'utf-8');
  } catch {
    // Never fail the hook
  }

  // Finalize breadcrumb (separate append so a timing-file failure never
  // suppresses it). Pairs with the start breadcrumb by `id`; its presence is
  // what proves the hook was NOT killed before teardown.
  appendBreadcrumb({
    ts: new Date().toISOString(),
    hook: timer.hookName,
    pid: process.pid,
    phase: 'finalize',
    id: timer.id,
  });
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

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<void>((resolve) => {
      timer = setTimeout(() => resolve(), 500);
    });

    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();

    await Promise.race([readPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    // A still-pending reader.read() on held-open stdin keeps the event loop
    // alive: the hook process hangs to stdin EOF even after main() returns
    // (Forge H-034 — fleet-wide, ~30 consumer hooks). Cancel releases stdin.
    reader.cancel().catch(() => {});

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
