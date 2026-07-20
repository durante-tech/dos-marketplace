#!/usr/bin/env bun
/**
 * MemoryInjectionObserve.hook.ts — auto-memory-search at OBSERVE-phase entry.
 *
 * TRIGGER: PreToolUse on Skill | Task
 *
 * RFC-0005 §14.12 — the OBSERVE phase of the Algorithm should enter with
 * relevant memory primed, not cold. This hook fires before Skill or Task
 * invocations (the standard OBSERVE-phase entry points) and injects top-5
 * semantically-similar drawers for the caller's prompt into the conversation.
 *
 * Cooldown: MAX_FIRES per session to avoid saturating context on repeated
 * Skill calls. Conservative default — Skill/Task invocations cluster
 * heavily and each one triggering a fresh search would overwhelm.
 *
 * NON-BLOCKING: always exits 0. Any failure path is silent.
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { bridgeSync } from './lib/mempalace';
import { resolveProjectWingFromEnv } from './lib/project-resolver';
import { atomicWriteSync } from './lib/atomic-write';
import { startTimer, stopTimer } from './lib/hook-io';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const STATE_DIR = join(DOS_DIR, 'MEMORY', 'STATE');
const MAX_FIRES_PER_SESSION = 3;
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes between fires

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    prompt?: string;
    description?: string;
    subject?: string;
    skill?: string;
    args?: string;
  };
}

interface InjectState {
  lastFired: number;
  fireCount: number;
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

function statePath(sessionId: string): string {
  return join(STATE_DIR, `memory-injection-${sessionId}.json`);
}

function readState(sessionId: string): InjectState {
  try {
    const p = statePath(sessionId);
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8')) as InjectState;
  } catch { /* corrupt or missing */ }
  return { lastFired: 0, fireCount: 0 };
}

function writeState(sessionId: string, state: InjectState): void {
  // RFC-0005 §13.1 R2: atomic write — crash-safe, tmp+fsync+rename.
  atomicWriteSync(statePath(sessionId), JSON.stringify(state));
}

function shouldFire(sessionId: string): boolean {
  const s = readState(sessionId);
  if (s.fireCount >= MAX_FIRES_PER_SESSION) return false;
  if (Date.now() - s.lastFired < COOLDOWN_MS) return false;
  return true;
}

function recordFire(sessionId: string): void {
  const s = readState(sessionId);
  s.lastFired = Date.now();
  s.fireCount += 1;
  writeState(sessionId, s);
}

/**
 * Distill a query string from the tool's input. Skill passes `skill` + `args`;
 * Task passes `description` + `prompt` + `subject`. Take whichever we can find.
 */
function extractQuery(input: HookInput): string {
  const ti = input.tool_input ?? {};
  return (ti.prompt || ti.description || ti.subject || ti.args || ti.skill || '').trim();
}

async function main(): Promise<void> {
  const input = await readStdin();
  if (!input?.session_id) process.exit(0);

  const query = extractQuery(input);
  if (query.length < 15) process.exit(0); // skip trivial

  if (!shouldFire(input.session_id)) process.exit(0);

  const { wing } = resolveProjectWingFromEnv();
  const probe = query.slice(0, 500);

  // Try wing-scoped first. If the project is new or drawer wings don't match
  // the current wing name, fall back to unfiltered — better to inject
  // globally-relevant memory than inject nothing.
  let result = bridgeSync('search', { query: probe, wing: wing || undefined, limit: 5 }, 4000);
  let results = result.ok
    ? ((result.data.results || []) as Array<{
        content?: string;
        text?: string;
        metadata?: { wing?: string; room?: string };
      }>)
    : [];

  if (results.length === 0 && wing) {
    result = bridgeSync('search', { query: probe, limit: 5 }, 4000);
    if (result.ok) {
      results = (result.data.results || []) as typeof results;
    }
  }

  // Count the fire BEFORE the zero-result exit: a "fire" is a search ATTEMPT (the
  // subprocess cost is already paid), not a successful injection. Recording only on
  // non-empty results let a session of zero-result searches (e.g. an empty/mismatched
  // wing) fire on EVERY Skill/Task call forever, defeating the 3/session cap. (Forge Gen 33)
  recordFire(input.session_id);

  if (results.length === 0) process.exit(0);

  const lines = results.map(r => {
    const meta = r.metadata || {};
    const w = meta.wing || 'unknown';
    const room = meta.room || 'unknown';
    const body = (r.content || r.text || '').slice(0, 400);
    return `[${w}/${room}] ${body}`;
  });

  // Inject via stdout — Claude Code surfaces pre-tool stdout as advisory context.
  console.log(`\n--- OBSERVE Memory (top-${results.length} drawers for ${input.tool_name ?? 'tool'}) ---`);
  console.log(lines.join('\n\n'));
  console.log(`--- End OBSERVE Memory ---\n`);

  console.error(`[MemoryInjectionObserve] Injected ${results.length} drawer(s) (fire #${readState(input.session_id).fireCount})`);
  process.exit(0);
}

const _t = startTimer('MemoryInjectionObserve');
process.on('exit', () => stopTimer(_t, 'PreToolUse'));
main().catch(() => process.exit(0));
