#!/usr/bin/env bun
/**
 * GoalDeadlockDetect.hook.ts — Stop hook that surfaces /goal deadlocks
 *
 * PURPOSE:
 * Detect the failure mode where a session-scoped /goal Stop hook keeps
 * rejecting + the AI keeps surfacing classifier-denial / operator-action-
 * required prose for N consecutive turns. When detected, surface a clear
 * "🚨 DEADLOCK CLEARED" notification with the operator's escape action
 * (`/goal clear`) carried on the universal `systemMessage` field.
 *
 * Implements PRD `20260513-145627_v0015-foundation-fix-and-session-starter`
 * Feature-3 (ISC-5 + ISC-15). Removes the ~100-turn loop pattern documented
 * in the PRD problem statement.
 *
 * CONTRACT:
 *   - TRIGGER: Stop
 *   - INPUT: stdin JSON (session_id, transcript_path, hook_event_name,
 *     stop_hook_active)
 *   - SIDE EFFECT (detector-owned): goal-deadlocks.jsonl entry appended
 *     by `bun Tools/goal-deadlock-detector.ts` when it returns exit-1
 *   - HOOK OUTPUT:
 *       no deadlock        -> exit 0, no stdout (default continue)
 *       deadlock detected  -> exit 0, stdout = {continue:true, systemMessage}
 *       detector missing   -> exit 0, no stdout (degrade gracefully)
 *   - PERFORMANCE: spawn detector (transcript JSONL read), ~100-500ms,
 *     bounded by 5s timeout
 *
 * BOUNDARY (PRD §OOS row 3): no harness modification. The hook does NOT
 * directly clear the harness-managed /goal state — it surfaces the
 * operator-actionable directive instead. Auto-clear of harness-managed
 * goal state would require harness changes, which are out of scope.
 *
 * INTER-HOOK RELATIONSHIPS:
 *   - INDEPENDENT OF: every other Stop hook (reads transcript only)
 *   - The harness's /goal Stop hook may emit `{continue: false}`
 *     concurrently with this hook's `{continue: true}` — most-restrictive
 *     wins, so this hook does not race with goal enforcement. Its load-
 *     bearing output is the systemMessage directive, which the operator reads.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput, startTimer, stopTimer } from './lib/hook-io';
import { emitStopMessage } from './lib/hook-output';

const DETECTOR = join(homedir(), 'Durante', 'Tools', 'goal-deadlock-detector.ts');

interface DetectorReport {
  consecutive_identical?: number;
  deadlock_cues?: string[];
  deadlock_detected?: boolean;
  sample?: string;
}

function runDetector(sessionId: string): { code: number | null; report: DetectorReport | null } {
  if (!existsSync(DETECTOR)) return { code: null, report: null };
  try {
    const r = spawnSync('bun', [DETECTOR, `--session=${sessionId}`, '--json'], {
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (r.error) return { code: null, report: null };
    let report: DetectorReport | null = null;
    if (typeof r.stdout === 'string' && r.stdout.trim()) {
      try {
        report = JSON.parse(r.stdout) as DetectorReport;
      } catch {
        /* keep report null; we'll surface exit-code-based directive */
      }
    }
    return { code: r.status ?? null, report };
  } catch {
    return { code: null, report: null };
  }
}

function buildDeadlockMessage(report: DetectorReport | null): string {
  const count = report?.consecutive_identical ?? '≥3';
  const cues = report?.deadlock_cues?.join(', ') ?? '(see detector report)';
  return [
    '🚨 DEADLOCK CLEARED — `/goal` loop detected.',
    `  consecutive identical AI turns: ${count}`,
    `  surface cues: ${cues}`,
    '  full report: MEMORY/STATE/goal-deadlocks.jsonl',
    '  escape: operator runs `/goal clear` to release the session-scoped Stop hook.',
  ].join('\n');
}

async function main(): Promise<void> {
  const timer = startTimer('GoalDeadlockDetect');
  let event = 'no-op';
  try {
    const input = await readHookInput();
    if (!input || !input.session_id) {
      event = 'skip-no-session-id';
      return;
    }
    const { code, report } = runDetector(input.session_id);
    if (code === null) {
      event = 'skip-detector-unavailable';
      return;
    }
    if (code !== 1) {
      event = 'no-deadlock';
      return;
    }
    // Deadlock detected — the detector already wrote to goal-deadlocks.jsonl
    // (see Tools/goal-deadlock-detector.ts:113-117,178). We surface the
    // operator-actionable directive via the universal `systemMessage` field.
    // NOT `stopReason`: the runtime only honors stopReason alongside
    // continue:false (hooks-docs-reference.md §"Output JSON"), so a
    // {continue:true, stopReason} pair was a silent no-op. This hook must NOT
    // prevent stop (it does not clear harness /goal state — the operator does,
    // via `/goal clear`), so continue stays true and the directive rides on
    // systemMessage, which surfaces to the operator regardless of continue.
    emitStopMessage(buildDeadlockMessage(report));
    event = 'deadlock-surfaced';
  } catch {
    event = 'error-unhandled';
  } finally {
    stopTimer(timer, event);
  }
}

if (import.meta.main) {
  await main();
}

export { runDetector, buildDeadlockMessage, main };
