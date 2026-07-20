/**
 * hookRunner.ts — RFC-0020 Phase 0 P0-1
 *
 * Wraps a hook's main() in try/catch, captures failures to
 * ~/.claude/MEMORY/STATE/hook-errors.jsonl via a 3-tier fallback ladder,
 * and writes a LAST_SESSION_START_OK sentinel on clean exit.
 *
 * Phase 0 scope (§7.1 P0-1): prove the pattern on one hook (LoadContext).
 * Phase 1 extends to remaining hooks. The wrapper is ADDITIVE — hooks that
 * don't import runHook keep invoking their main() directly and behave
 * identically to pre-RFC-0020.
 *
 * 3-tier ladder (§6.2):
 *   1. atomicAppendSync(STATE/hook-errors.jsonl, line)
 *   2. fallback: appendFileSync(~/.claude/logs/hook-boot.log, line)
 *   3. final: process.stderr.write(line + "\n")
 *
 * Rollback: callers stop importing runHook; hooks invoke main() directly.
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { atomicAppendSync, atomicWriteSync } from './atomic-write';

// ─── Types ──────────────────────────────────────────────────────────

export interface HookErrorLine {
  ts: string;
  session_id: string;
  hook: string;
  phase: string;
  error_class: string;
  message: string;
  stack_head: string[];
  resolved: boolean;
  ack_id: string | null;
}

export interface RunHookOpts {
  /** Hook name for error attribution (e.g. "LoadContext"). */
  name: string;
  /** Event phase label (e.g. "SessionStart"). */
  phase: string;
  /** Explicit session id — defaults to env CLAUDE_SESSION_ID / DOS_SESSION_ID. */
  sessionId?: string;
  /** Skip writing the LAST_SESSION_START_OK sentinel on success. */
  skipSentinel?: boolean;
}

// ─── Paths ──────────────────────────────────────────────────────────

const HOME = homedir();
const STATE_DIR = join(HOME, '.claude', 'MEMORY', 'STATE');
const LOGS_DIR = join(HOME, '.claude', 'logs');

export const HOOK_ERRORS_PATH = join(STATE_DIR, 'hook-errors.jsonl');
export const HOOK_BOOT_LOG_PATH = join(LOGS_DIR, 'hook-boot.log');
export const LAST_SESSION_START_OK_PATH = join(STATE_DIR, 'LAST_SESSION_START_OK');

// ─── Session id resolution (mirrors writeArtifact.ts) ───────────────

function resolveSessionId(explicit?: string): string {
  // `process.pid` is not declared in the hook ambient types; Bun provides it
  // at runtime. Cast to unknown for the type-only reference so hooks can
  // still identify themselves when no session id is available.
  const pid = (process as unknown as { pid?: number }).pid ?? 0;
  return (
    explicit ??
    process.env.CLAUDE_SESSION_ID ??
    process.env.DOS_SESSION_ID ??
    `pid-${pid}`
  );
}

// ─── Env-value sanitizer (§13 security) ─────────────────────────────
//
// Scrubs known env VALUES from emitted message + stack frames so a thrown
// error that happens to print `process.env.DOS_GATEWAY_API_KEY` doesn't
// leak the secret into hook-errors.jsonl.

const SENSITIVE_ENV_KEYS = [
  'DOS_GATEWAY_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GROK_API_KEY',
  'PERPLEXITY_API_KEY',
  'BRAVE_API_KEY',
  'BRIGHTDATA_API_KEY',
  'APIFY_API_TOKEN',
  'GITHUB_TOKEN',
  'STUDIO_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'FACEBOOK_PAGE_TOKEN',
  'LINKEDIN_ACCESS_TOKEN',
];

function sanitize(text: string): string {
  let out = text;
  for (const key of SENSITIVE_ENV_KEYS) {
    const val = process.env[key];
    if (val && val.length >= 8) {
      out = out.split(val).join(`[REDACTED:${key}]`);
    }
  }
  return out;
}

// ─── Stack head bounded to 8 frames (§13) ──────────────────────────

function boundedStackHead(stack: string | undefined): string[] {
  if (!stack) return [];
  const frames = stack.split('\n').slice(1).map((f) => f.trim()).filter(Boolean);
  return frames.slice(0, 8).map(sanitize);
}

// ─── 3-tier write ladder ───────────────────────────────────────────

function ensureDir(path: string): void {
  try { mkdirSync(path, { recursive: true }); } catch { /* swallow */ }
}

function writeErrorLadder(line: HookErrorLine): void {
  const serialized = JSON.stringify(line);

  // Tier 1: atomic append to hook-errors.jsonl. atomicAppendSync already
  // ensures the parent directory exists.
  if (atomicAppendSync(HOOK_ERRORS_PATH, serialized)) return;

  // Tier 2: append to ~/.claude/logs/hook-boot.log
  try {
    ensureDir(LOGS_DIR);
    appendFileSync(HOOK_BOOT_LOG_PATH, serialized + '\n');
    return;
  } catch { /* fall through */ }

  // Tier 3: stderr
  try { process.stderr.write(serialized + '\n'); } catch { /* cannot do anything more */ }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Run a hook's async main() under a try/catch that logs thrown errors
 * to hook-errors.jsonl via the 3-tier ladder. On clean exit, writes the
 * LAST_SESSION_START_OK sentinel (unless opts.skipSentinel).
 *
 * Returns the value of fn() on success. Re-throws the original error
 * AFTER logging so the caller's non-zero exit semantics are preserved.
 */
export async function runHook<T>(opts: RunHookOpts, fn: () => Promise<T> | T): Promise<T> {
  const sessionId = resolveSessionId(opts.sessionId);
  try {
    const result = await fn();
    if (!opts.skipSentinel) writeSessionStartOkSentinel();
    return result;
  } catch (err) {
    const e = err as Error;
    const line: HookErrorLine = {
      ts: new Date().toISOString(),
      session_id: sessionId,
      hook: opts.name,
      phase: opts.phase,
      error_class: e?.name ?? 'Error',
      message: sanitize(String(e?.message ?? err)),
      stack_head: boundedStackHead(e?.stack),
      resolved: false,
      ack_id: null,
    };
    writeErrorLadder(line);
    throw err;
  }
}

/**
 * Atomically write the LAST_SESSION_START_OK sentinel with the current
 * ISO timestamp. Idempotent — repeated calls overwrite the timestamp.
 */
export function writeSessionStartOkSentinel(): void {
  ensureDir(STATE_DIR);
  atomicWriteSync(LAST_SESSION_START_OK_PATH, new Date().toISOString() + '\n');
}

/**
 * Read the sentinel and return { exists, ageMs, stale } where stale=true
 * if the sentinel is missing or older than 24h. Callers use this to
 * surface "the last SessionStart did not complete cleanly."
 */
export function readSessionStartOkSentinel(nowMs: number = Date.now()): {
  exists: boolean;
  ageMs: number | null;
  stale: boolean;
} {
  if (!existsSync(LAST_SESSION_START_OK_PATH)) {
    return { exists: false, ageMs: null, stale: true };
  }
  try {
    const content = readFileSync(LAST_SESSION_START_OK_PATH, 'utf8').trim();
    const ts = new Date(content).getTime();
    if (Number.isNaN(ts)) {
      // Fall back to mtime when the file content is not a valid ISO stamp.
      const mtime = statSync(LAST_SESSION_START_OK_PATH).mtimeMs;
      const ageMs = nowMs - mtime;
      return { exists: true, ageMs, stale: ageMs > 24 * 60 * 60 * 1000 };
    }
    const ageMs = nowMs - ts;
    return { exists: true, ageMs, stale: ageMs > 24 * 60 * 60 * 1000 };
  } catch {
    return { exists: true, ageMs: null, stale: true };
  }
}

// ─── Test seams (exported for Tools/test-rfc-0020-phase0.ts) ───────

export const __testing = {
  sanitize,
  boundedStackHead,
  writeErrorLadder,
  SENSITIVE_ENV_KEYS,
};
