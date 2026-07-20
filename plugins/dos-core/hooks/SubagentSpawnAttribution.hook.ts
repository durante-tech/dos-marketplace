#!/usr/bin/env bun
/**
 * SubagentSpawnAttribution.hook.ts — PreToolUse (Agent | Task)
 *
 * RFC-0125 Regime 1 (model-orchestrated) — the SPAWN half of per-spawn
 * attribution. When a subagent is spawned, record which PRD is active AT SPAWN
 * TIME, keyed by `tool_use_id`, to an append-only per-session spawn-map:
 *   MEMORY/STATE/spawn-attribution/{session_id}.jsonl
 *
 * SubagentReturnTally (PostToolUse) then attributes the matching return by
 * `tool_use_id` instead of re-resolving a mutable session-global at return time
 * — which drifts when a later PRD becomes mtime-newest (RFC-0125 finding 2).
 *
 * Observation-only: ALWAYS returns {continue:true}; never blocks; fails open.
 * Decoupling note (RFC-0125 OQ2): this hook does NOT write
 * `active-prd-{session}.json` — the two PreToolUse blockers keep their own
 * current-active resolution, so this binding never flips a blocker.
 */

import { atomicAppendSync } from './lib/atomic-write';
import { resolveSessionId } from './lib/paths';
import { resolveActivePrdSlug, spawnMapPath } from './lib/spawn-attribution';
import { readHookInput, startTimer, stopTimer } from './lib/hook-io';

const SPAWN_TOOLS = new Set(['Agent', 'Task']);

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_use_id?: string;
}

async function main(): Promise<void> {
  // Shared cancel-safe reader (H-034) instead of a bare synchronous
  // readFileSync(0): the sync read blocks the process to stdin-EOF with no
  // interrupt on a PreToolUse Agent/Task hook, and this file carries NO
  // startTimer breadcrumb, so a hang was both unbounded AND invisible to the
  // killed-hook diagnostic (H-068). The reader + the added timer fix both.
  const input = (await readHookInput()) as unknown as HookInput | null;
  if (!input || !SPAWN_TOOLS.has(input.tool_name ?? '')) return;

  // No tool_use_id → cannot key a spawn-fact. Skip rather than collide every
  // such spawn on one empty key (finding 10a); the return will MISS the map and
  // honestly record attribution:"fallback" instead.
  const toolUseId = input.tool_use_id ?? '';
  if (!toolUseId) return;

  const sessionId = resolveSessionId(input);
  // Resolve the slug FRESH per spawn — caching across spawns would break
  // multi-PRD binding (the exact finding-2 this hook fixes).
  const fact = {
    tool_use_id: toolUseId,
    prd_slug: resolveActivePrdSlug(sessionId),
    ts: new Date().toISOString(),
  };
  atomicAppendSync(spawnMapPath(sessionId), JSON.stringify(fact));
}

if (import.meta.main) {
  const _t = startTimer('SubagentSpawnAttribution');
  process.on('exit', () => stopTimer(_t, 'PreToolUse'));
  // Force-exit in finally: observation-only, ALWAYS returns {continue:true} and
  // never blocks; the exit also guarantees termination regardless of stdin state.
  main().catch(() => { /* fail open — observation-only hook never blocks */ })
    .finally(() => {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    });
}
