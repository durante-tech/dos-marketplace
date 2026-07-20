/**
 * detachWorker.ts — spawn-and-detach helper for slow hooks
 *
 * Problem: hooks that call inference() on UserPromptSubmit or Stop block
 * Claude Code for 10–15 seconds per turn. None of the inference output is
 * consumed synchronously by the user — ratings, tab titles, and doc
 * integrity scans all just write to disk for offline analysis.
 *
 * Solution: at foreground entry the hook reads stdin, then hands the parsed
 * payload to a detached background copy of itself. Foreground exits in
 * ~20ms with `{continue:true}`. Background does the slow work silently.
 *
 * Usage (at the top of every wrapped hook):
 *
 *   import { runDetachedOrForeground } from './lib/detachWorker';
 *
 *   async function heavyWork(input: HookInput): Promise<void> {
 *     // ... the original main() body (inference, writes, etc.)
 *   }
 *
 *   runDetachedOrForeground({
 *     hookName: 'RatingCapture',
 *     heavyWork,
 *   });
 *
 * The helper:
 *   - reads stdin once in foreground
 *   - writes the JSON payload to /tmp/dos-hook-{name}-{pid}-{ts}.json
 *   - respawns the script with DOS_HOOK_BG=1 + DOS_HOOK_INPUT_FILE=<path>
 *     via child_process.spawn({ detached: true, stdio: 'ignore' }) + unref()
 *   - prints `{"continue":true}` to stdout in foreground and exits
 *   - in background mode, reads the input file, runs heavyWork, cleans up
 *
 * Observability: every background run appends a line to
 * ~/.claude/MEMORY/STATE/hook-bg.jsonl so silent failures are detectable.
 */

import { spawn } from 'child_process';
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  appendFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';

const BG_ENV = 'DOS_HOOK_BG';
const INPUT_FILE_ENV = 'DOS_HOOK_INPUT_FILE';
const HOOK_NAME_ENV = 'DOS_HOOK_NAME';

export const BG_LOG_PATH = join(
  process.env.DOS_DIR ?? join(process.env.HOME ?? '/tmp', '.claude'),
  'MEMORY',
  'STATE',
  'hook-bg.jsonl',
);

export function logBg(entry: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  try {
    const dir = dirname(BG_LOG_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(BG_LOG_PATH, line);
  } catch { /* best-effort */ }
}

function readStdinSync(): string {
  // Bun + Node both support readFileSync(0, 'utf-8') for stdin.
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

export interface DetachOptions<TInput> {
  hookName: string;
  heavyWork: (input: TInput) => Promise<void> | void;
  /**
   * Called in foreground ONLY, after stdin is parsed, before detach. Return
   * false to abort detach (e.g., skip-this-invocation fast-paths).
   */
  foregroundFilter?: (input: TInput) => boolean;
}

/**
 * Entry point wrapper. Call this as the last line of the hook file.
 * Automatically routes to background mode when DOS_HOOK_BG=1 is set.
 */
export async function runDetachedOrForeground<TInput = unknown>(
  opts: DetachOptions<TInput>,
): Promise<never> {
  const isBg = process.env[BG_ENV] === '1';

  if (isBg) {
    // Background mode — read input file, run heavy work, cleanup.
    const inputPath = process.env[INPUT_FILE_ENV] ?? '';
    const startMs = Date.now();
    let input: TInput | null = null;
    try {
      input = JSON.parse(readFileSync(inputPath, 'utf-8')) as TInput;
    } catch (err) {
      logBg({
        hook: opts.hookName,
        mode: 'bg',
        phase: 'read-input',
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
    try {
      unlinkSync(inputPath);
    } catch { /* file will be cleaned by tmp reaper */ }
    try {
      await opts.heavyWork(input);
      logBg({
        hook: opts.hookName,
        mode: 'bg',
        phase: 'done',
        duration_ms: Date.now() - startMs,
      });
      process.exit(0);
    } catch (err) {
      logBg({
        hook: opts.hookName,
        mode: 'bg',
        phase: 'heavy-work',
        duration_ms: Date.now() - startMs,
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  }

  // Foreground mode — read stdin, parse, optionally filter, detach.
  const raw = readStdinSync();
  let input: TInput;
  try {
    input = JSON.parse(raw) as TInput;
  } catch {
    // No valid input — nothing to do.
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  if (opts.foregroundFilter && !opts.foregroundFilter(input)) {
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  // Write payload to a temp file and respawn self detached.
  const inputPath = join(
    tmpdir(),
    `dos-hook-${opts.hookName.toLowerCase()}-${process.pid}-${Date.now()}.json`,
  );
  try {
    writeFileSync(inputPath, JSON.stringify(input));
  } catch (err) {
    logBg({
      hook: opts.hookName,
      mode: 'fg',
      phase: 'write-input',
      error: err instanceof Error ? err.message : String(err),
    });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  const script = process.argv[1];
  if (!script) {
    logBg({ hook: opts.hookName, mode: 'fg', phase: 'no-script', error: 'argv[1] missing' });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  try {
    const child = spawn(process.execPath, [script], {
      env: {
        ...process.env,
        [BG_ENV]: '1',
        [INPUT_FILE_ENV]: inputPath,
        [HOOK_NAME_ENV]: opts.hookName,
      },
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    logBg({
      hook: opts.hookName,
      mode: 'fg',
      phase: 'spawned',
      child_pid: child.pid ?? -1,
    });
  } catch (err) {
    logBg({
      hook: opts.hookName,
      mode: 'fg',
      phase: 'spawn',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}
