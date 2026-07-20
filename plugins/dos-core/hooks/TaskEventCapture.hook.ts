#!/usr/bin/env bun
/**
 * TaskEventCapture.hook.ts — PostToolUse capture for TaskCreate / TaskUpdate
 *
 * PURPOSE:
 * The TaskCreated harness event delivers an EMPTY payload on this install
 * (RFC-0149 RT-1: 652/652 audit entries with task_id "unknown"). PostToolUse
 * is the only registration that receives the real tool_input — including the
 * RFC-0149 metadata contract {prd, iscs, phase, stream}. This hook appends
 * one JSON line per TaskCreate/TaskUpdate to MEMORY/STATE/task-events.jsonl,
 * the data source for the advisory parity lint (task-projection-check.ts).
 *
 * TRIGGER: PostToolUse, matcher "TaskCreate|TaskUpdate" (settings.json)
 *
 * INPUT (stdin, JSON — PostToolUse shape):
 * - session_id, tool_name, tool_input, tool_response
 *
 * OUTPUT: {} always; exit 0 always — observation-only, fail-open,
 * never blocks a task tool call (RFC-0149 hard constraint).
 *
 * SIDE EFFECTS:
 * - Appends to ~/.claude/MEMORY/STATE/task-events.jsonl (global STATE —
 *   session infrastructure, same placement rationale as tasks-created.jsonl),
 *   with size-based rotation at 5 MB.
 *
 * INTER-HOOK RELATIONSHIPS:
 * - COMPLEMENTS TaskCreated.hook.ts (legacy event log, untouched per D8)
 * - FEEDS Tools/task-projection-check.ts (RFC-0149 §5 Tier 1)
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { getMemoryDir } from './lib/paths';
import { startTimer, stopTimer, readHookInput } from './lib/hook-io';
import { rotateIfNeeded } from './lib/rotate';

// ========================================
// Types
// ========================================

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  [key: string]: unknown;
}

interface TaskEvent {
  timestamp: string;
  session_id: string;
  event: 'created' | 'updated';
  task_id: string;
  subject: string;
  status: string;
  owner: string;
  metadata: Record<string, unknown>;
  addBlockedBy: string[];
  description_head: string;
}

const CAPTURED_TOOLS = new Set(['TaskCreate', 'TaskUpdate']);
const DESCRIPTION_HEAD_CHARS = 300;

// ========================================
// Extraction
// ========================================

/** TaskCreate has no id in tool_input; the harness confirms it in the
 *  tool_response text ("Task #7 created successfully" / "Updated task #7 …").
 *  Anchored at start so a subject echoing "Task #99" cannot shadow the real
 *  id; non-string responses yield 'unknown' rather than a serialized guess. */
function extractTaskId(input: HookInput): string {
  const ti = (input.tool_input || {}) as Record<string, unknown>;
  if (ti.taskId !== undefined && ti.taskId !== null) return String(ti.taskId);
  if (typeof input.tool_response !== 'string') return 'unknown';
  const m = input.tool_response.match(/^(?:Updated\s+)?[Tt]ask\s+#(\d+)/);
  return m ? m[1] : 'unknown';
}

function toEvent(input: HookInput): TaskEvent {
  const ti = (input.tool_input || {}) as Record<string, unknown>;
  return {
    timestamp: new Date().toISOString(),
    session_id: String(input.session_id || 'unknown'),
    event: input.tool_name === 'TaskCreate' ? 'created' : 'updated',
    task_id: extractTaskId(input),
    subject: String(ti.subject || ''),
    status: String(ti.status || (input.tool_name === 'TaskCreate' ? 'pending' : '')),
    owner: String(ti.owner || ''),
    metadata: (ti.metadata as Record<string, unknown>) || {},
    addBlockedBy: Array.isArray(ti.addBlockedBy) ? ti.addBlockedBy.map(String) : [],
    description_head: String(ti.description || '').slice(0, DESCRIPTION_HEAD_CHARS),
  };
}

// ========================================
// Append (rotation-guarded; every error path silent)
// ========================================

function logEvent(event: TaskEvent): void {
  try {
    const dir = join(getMemoryDir(), 'STATE');
    const logPath = join(dir, 'task-events.jsonl');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    rotateIfNeeded(logPath);
    appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf-8');
  } catch {
    // Observation must never break the task tool call.
  }
}

// ========================================
// Main
// ========================================

async function main(): Promise<void> {
  // Shared 500ms reader (hook-io) — returns null on empty/malformed stdin.
  const input = (await readHookInput()) as unknown as HookInput | null;

  // Defensive tool filter — the settings.json matcher already scopes us,
  // but a mis-registration must not turn this into a firehose.
  if (input?.tool_name && CAPTURED_TOOLS.has(input.tool_name)) {
    logEvent(toEvent(input));
  }

  console.log(JSON.stringify({}));
}

const _t = startTimer('TaskEventCapture');
process.on('exit', () => stopTimer(_t, 'TaskEventCapture'));
main().catch(() => {
  console.log(JSON.stringify({}));
});
