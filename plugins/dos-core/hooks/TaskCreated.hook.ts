#!/usr/bin/env bun
/**
 * TaskCreated.hook.ts — Audit + KG injection on TaskCreate
 *
 * PURPOSE:
 * Fires when a task is created via the TaskCreate tool. Records an audit entry
 * in MEMORY/STATE for the lifecycle log and, when the MemPalace bridge is
 * reachable, adds a Task entity to the knowledge graph immediately instead of
 * waiting for the SessionEnd harvest. Non-blocking and fire-and-forget.
 *
 * TRIGGER: TaskCreated (Claude Code v2.1.89+)
 *
 * INPUT (from stdin, JSON):
 * - session_id: Current session identifier
 * - task:       Task object (id, title/description/status — shape varies)
 * - (any other fields the event carries — preserved in audit log)
 *
 * OUTPUT (stdout, JSON):
 * - {} → always; never blocks
 * - exit(0) always — fire-and-forget
 *
 * SIDE EFFECTS:
 * - Appends to: MEMORY/STATE/tasks-created.jsonl (global, not project-scoped)
 * - Optional:   Invokes mempalace_bridge.py add_kg_fact if bridge script exists
 *
 * INTER-HOOK RELATIONSHIPS:
 * - INDEPENDENT: no coordination with other hooks
 * - COMPLEMENTS: MemPalaceLearn.hook.ts (SessionEnd) which also harvests tasks
 *
 * ERROR HANDLING:
 * - Malformed stdin     → log skipped, emit {} and exit 0
 * - Missing bridge      → skip KG add silently
 * - Bridge call failure → silent; hook must not block
 *
 * PERFORMANCE:
 * - Blocking: No
 * - Typical execution: <20ms when bridge absent, <200ms when bridge called
 *   (bridge is spawned detached; we do not await its exit)
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { dosPath, getMemoryDir } from './lib/paths';
import { startTimer, stopTimer } from './lib/hook-io';

// ========================================
// Types
// ========================================

interface TaskCreatedInput {
  session_id?: string;
  task?: Record<string, unknown>;
  tool_input?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AuditEntry {
  timestamp: string;
  session_id: string;
  task_id: string;
  title: string;
  status: string;
  raw: Record<string, unknown>;
}

// ========================================
// Audit logging (global MEMORY/STATE — always global per paths.ts docs)
// ========================================

function getAuditLogPath(): string {
  return join(getMemoryDir(), 'STATE', 'tasks-created.jsonl');
}

function logAudit(entry: AuditEntry): void {
  try {
    const logPath = getAuditLogPath();
    const dir = logPath.substring(0, logPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Logging failure must not break the hook
  }
}

// ========================================
// Optional MemPalace KG injection (detached, fire-and-forget)
// ========================================

function getBridgePath(): string | null {
  // Canonical bridge name under DOS/Tools (see CLAUDE.md "Known naming differences")
  const candidates = [
    dosPath('DOS', 'Tools', 'mempalace_bridge.py'),
    join(homedir(), '.claude', 'DOS', 'Tools', 'mempalace_bridge.py'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function tryKgAdd(entry: AuditEntry): void {
  try {
    // 'created_in_session' is deprecated per Council ratification 2026-05-17
    // (_bridge_kg.py _TRIPWIRE_DOOMED_PREDICATES — zero KG consumers). add_kg_fact
    // denies it by design (error_type "telemetry-deprecated"), so firing it just
    // produced guaranteed-failed writes that polluted bridge-write-success. Gated
    // OFF by default; re-enable behind a telemetry-log sink with DOS_KG_WRITEBACK=on.
    if ((process.env.DOS_KG_WRITEBACK || 'off').toLowerCase() !== 'on') return;

    const bridge = getBridgePath();
    if (!bridge) return; // Bridge not installed — skip silently

    // add_kg_fact is triple-based: {subject, predicate, object, valid_from?, confidence?}
    const subject = entry.task_id !== 'unknown'
      ? entry.task_id
      : (entry.title || 'untitled-task');
    const validFrom = entry.timestamp.slice(0, 10); // YYYY-MM-DD
    const payload = JSON.stringify({
      subject,
      predicate: 'created_in_session',
      object: entry.session_id,
      valid_from: validFrom,
    });

    // Detached child process — do not await; hook returns immediately.
    const child = spawn('python3', [bridge, 'add_kg_fact', payload], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // Never throw
  }
}

// ========================================
// Main
// ========================================

async function readStdin(): Promise<string> {
  try {
    const reader = Bun.stdin.stream().getReader();
    const decoder = new TextDecoder();
    let raw = '';
    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
      }
    })();
    await Promise.race([
      readLoop,
      new Promise<void>((resolve) => setTimeout(resolve, 300)),
    ]);
    // Promise.race does NOT abort the losing promise: a still-pending
    // reader.read() on held-open stdin keeps the event loop alive, and this file
    // has no process.exit() on any path, so the hook hangs to stdin-EOF (H-097,
    // the H-034 class in its worst form). Cancel releases stdin. The sibling on
    // this same TaskCreated event, SuggestParentOnTaskCreate, took this fix as
    // H-078; this hook was missed.
    reader.cancel().catch(() => {});
    return raw;
  } catch {
    return '';
  }
}

function extractTaskShape(input: TaskCreatedInput): {
  task_id: string;
  title: string;
  status: string;
  raw: Record<string, unknown>;
} {
  // The event shape isn't fully documented; probe common field locations.
  const task = (input.task || input.tool_input || {}) as Record<string, unknown>;

  const task_id =
    (task.id as string) ||
    (task.task_id as string) ||
    (input.id as string) ||
    'unknown';

  const title =
    (task.title as string) ||
    (task.description as string) ||
    (task.name as string) ||
    (task.content as string) ||
    '';

  const status =
    (task.status as string) ||
    (task.state as string) ||
    'created';

  return { task_id, title, status, raw: task };
}

async function main(): Promise<void> {
  let input: TaskCreatedInput = {};

  try {
    const raw = await readStdin();
    if (raw.trim()) {
      input = JSON.parse(raw);
    }
  } catch {
    console.log(JSON.stringify({}));
    return;
  }

  const sessionId = (input.session_id || 'unknown').toString();
  const shape = extractTaskShape(input);

  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    task_id: shape.task_id,
    title: shape.title,
    status: shape.status,
    raw: shape.raw,
  };

  // Always log audit
  logAudit(entry);

  // Optional KG injection (non-blocking)
  tryKgAdd(entry);

  // Non-blocking response
  console.log(JSON.stringify({}));
}

// Run main with timing, fail open on any error.
// Force-exit belt-and-braces alongside the reader.cancel() above: this hook is
// fire-and-forget and must never outlive its turn, whatever stdin does. The
// header has always promised "exit(0) always" — until now nothing delivered it.
// process.exit still runs the 'exit' handler below, so timing is not lost (H-097).
const _t = startTimer('TaskCreated');
process.on('exit', () => stopTimer(_t, 'TaskCreated'));
main()
  .catch(() => {
    console.log(JSON.stringify({}));
  })
  .finally(() => process.exit(0));
