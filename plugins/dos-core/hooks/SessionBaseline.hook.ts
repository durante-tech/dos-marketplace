#!/usr/bin/env bun
/**
 * SessionBaseline.hook.ts — SessionStart auto-fire of `session-baseline capture`
 *
 * PURPOSE:
 * At session start, snapshot the working tree (modified + untracked +
 * dirty-submodule paths) into MEMORY/STATE/session-{id}-baseline.json so
 * later tooling can answer "did the AI touch this file, or was it already
 * dirty when the operator started the session?" without manual enumeration.
 *
 * Removes the recurring friction documented in PRD
 * `20260513-145627_v0015-foundation-fix-and-session-starter` (ISC-4 +
 * Feature-2) — last session burned ~13 files of manual operator-vs-AI
 * enumeration to keep operator's separate in-flight work out of AI commits.
 *
 * CONTRACT:
 *   - TRIGGER: SessionStart
 *   - INPUT: stdin JSON (session_id, transcript_path, hook_event_name)
 *   - SIDE EFFECT: writes MEMORY/STATE/session-{id}-baseline.json (via tool)
 *   - IDEMPOTENT: no-op if baseline already exists for this session_id
 *   - PERFORMANCE: foreground spawn, ~200-500ms; well under the 1s ISC-4
 *     budget. Never blocks session start (always exits 0).
 *   - FAILURE PATH (H-012, Gen 176): on spawn-failed/spawn-error, write a tiny
 *     pending MARKER (sync file write — ZERO new session-start processes, the
 *     constraint the Gen-3 detached-retry revert taught). SessionCleanup's
 *     SessionEnd sweep reaps markers for still-active sessions and stamps the
 *     late baseline's provenance. Telemetry: event gains a '-marked' suffix
 *     when the marker landed (H-094: state must be log-visible).
 *
 * INTER-HOOK RELATIONSHIPS:
 *   - INDEPENDENT OF: KittyEnvPersist, LoadContext, BuildCLAUDE,
 *     MemPalaceWakeUp, SelectionCacheWarm, SessionContextSnapshot
 *   - Ordering inside the SessionStart array is unconstrained — this hook
 *     only reads + writes its own baseline file; it does not consume state
 *     produced by peer hooks.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readHookInput, startTimer, stopTimer } from './lib/hook-io';
import {
  baselinePath,
  resolveBaselineTool,
  writePendingMarker,
} from './lib/session-baseline-pending';

function captureBaseline(sessionId: string): 'spawn-ok' | 'spawn-failed' | 'spawn-error' {
  const tool = resolveBaselineTool();
  if (!existsSync(tool)) return 'spawn-failed';
  try {
    const r = spawnSync('bun', [tool, 'capture', `--session-id=${sessionId}`], {
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (r.error || (r.status ?? 0) !== 0) return 'spawn-failed';
    return 'spawn-ok';
  } catch {
    return 'spawn-error';
  }
}

async function main(): Promise<void> {
  const timer = startTimer('SessionBaseline');
  let event = 'no-op';
  try {
    const input = await readHookInput();
    if (!input || !input.session_id) {
      event = 'skip-no-session-id';
      return;
    }
    const sessionId = input.session_id;
    if (existsSync(baselinePath(sessionId))) {
      event = 'skip-baseline-exists';
      return;
    }
    event = captureBaseline(sessionId);
    // H-012 (Gen 176): failed capture → pending marker; the SessionCleanup
    // sweep retries it while the session is still alive. Marker write is a
    // sync file touch — zero new session-start processes (Gen-3 constraint).
    if (event !== 'spawn-ok') {
      const transcriptPath = (input as { transcript_path?: string }).transcript_path || '';
      if (writePendingMarker(sessionId, transcriptPath, event)) {
        event = `${event}-marked`;
      }
    }
  } catch {
    event = 'error-unhandled';
  } finally {
    stopTimer(timer, event);
  }
}

if (import.meta.main) {
  await main();
}

export { baselinePath, captureBaseline, main };
