#!/usr/bin/env bun
/**
 * SuggestParentOnTaskCreate.hook.ts — RFC-0010 §9 LINEAGE SUGGESTION HOOK
 *
 * PURPOSE:
 * Fires when a task is created via TaskCreate. Invokes the MemPalace
 * `suggest_parent` bridge action to rank candidate parent artifacts for the
 * new task description, then surfaces the top-3 results as a single italic
 * console line for operator awareness.
 *
 * NON-BLOCKING INVARIANTS (RFC-0010 §9.2 — load-bearing):
 * - MUST NOT prompt for confirmation
 * - MUST NOT block phase transition
 * - MUST NOT write `parent:` to any PRD or file
 * - MUST silently skip on gated=true, count=0, or any bridge error
 * - MUST emit AT MOST ONE italic line per invocation
 *
 * TRIGGER: TaskCreated (Claude Code v2.1.89+)
 *
 * INPUT (stdin, JSON):
 * - session_id: Current session identifier
 * - task:       Task object (id, title/description/status — shape varies)
 *
 * OUTPUT:
 * - stdout: {} (always — non-blocking acknowledgment to harness)
 * - stderr: Single italic line with top-3 candidates (when found and bridge up)
 *
 * SIDE EFFECTS:
 * - Read-only: invokes bridge `suggest_parent` (chromadb_read, no writes)
 * - Does NOT write `parent:` anywhere — that path requires explicit `dos lineage link`
 *
 * REFERENCES:
 * - RFC-0010 §9   — LINEAGE SUGGESTION HOOK pattern
 * - RFC-0010 §9.2 — non-blocking invariants (load-bearing contract)
 * - RFC-0010 §9.3 — confidence threshold calibration note (0.15 vs aspirational 0.8)
 * - ISC-19: typed-client suggestParent method in mempalace-client.ts
 * - ISC-20: this file (first DOS call site for `suggest_parent` — was 0)
 * - PRD: MEMORY/WORK/active/20260512_mempalace-findings-delivery/PRD.md §A4
 *
 * PERFORMANCE:
 * - Blocking: No — SUGGEST_TIMEOUT_MS hard gate via Promise.race; silent skip on overrun
 * - Typical execution: <300ms when daemon warm; up to 3s on cold Python spawn
 *
 * 2026-05-12: Initial wiring — Stream A4 of Phase 1 parallel delivery.
 *             Activates dormant `suggest_parent` bridge action (was 0 DOS call sites).
 */

import { existsSync } from 'fs';
import { BRIDGE_PATH } from './lib/mempalace';
import { mempalaceClientAsync } from './lib/mempalace-client';
import { startTimer, stopTimer } from './lib/hook-io';

// ─── Hook timeout ─────────────────────────────────────────────────────────────
//
// 3s is well within the harness-allowed window for TaskCreated hooks and
// comfortably above the bridge cold-start latency (~1s without daemon, <50ms
// with RFC-0075 persistent daemon). Exceeding the timeout returns {} silently.

const SUGGEST_TIMEOUT_MS = 3000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskCreatedInput {
  session_id?: string;
  task?: Record<string, unknown>;
  tool_input?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Stdin reader ─────────────────────────────────────────────────────────────

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
    // 300ms cap — hook must not block waiting for a slow pipe.
    await Promise.race([
      readLoop,
      new Promise<void>((resolve) => setTimeout(resolve, 300)),
    ]);
    // Promise.race does NOT abort the losing promise: a still-pending
    // reader.read() on held-open stdin keeps the event loop alive, and this file
    // has no process.exit() on any path, so the hook hangs to stdin-EOF (H-078,
    // the H-034 class in its worst form). Cancel releases stdin.
    reader.cancel().catch(() => {});
    return raw;
  } catch {
    return '';
  }
}

// ─── Task description extractor ───────────────────────────────────────────────

function extractDescription(input: TaskCreatedInput): string {
  // Probe common field locations — TaskCreate event shape varies across versions.
  const task = (input.task || input.tool_input || {}) as Record<string, unknown>;
  return (
    (task.description as string) ||
    (task.subject as string) ||
    (task.title as string) ||
    (task.name as string) ||
    (task.content as string) ||
    ''
  ).trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Non-blocking acknowledgment — written to stdout regardless of analysis path.
  const ack = (): void => {
    process.stdout.write(JSON.stringify({}) + '\n');
  };

  // Guard: bridge script must exist. Without it every async call fails loudly.
  if (!existsSync(BRIDGE_PATH)) {
    ack();
    return;
  }

  // Parse stdin with a short deadline to avoid hanging on empty pipes.
  let input: TaskCreatedInput = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) {
      input = JSON.parse(raw);
    }
  } catch {
    ack();
    return;
  }

  // Extract task description — nothing to match against when empty.
  const task = extractDescription(input);
  if (!task) {
    ack();
    return;
  }

  try {
    // Hard-timeout the bridge call: task creation must not stall.
    // The +100ms gives the typed client its own deadline before our sentinel fires.
    const result = await Promise.race([
      mempalaceClientAsync.suggestParent(
        { task, limit: 3, min_confidence: 0.15 },
        SUGGEST_TIMEOUT_MS,
      ),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), SUGGEST_TIMEOUT_MS + 100),
      ),
    ]);

    // Silently skip: timeout, bridge error, gated corpus, or no candidates.
    if (!result || !result.ok) {
      ack();
      return;
    }

    const { candidates, gated, count } = result.data;
    if (gated || count === 0 || !Array.isArray(candidates) || candidates.length === 0) {
      ack();
      return;
    }

    // Emit AT MOST ONE italic line — RFC-0010 §9.2 invariant.
    const parts = candidates
      .slice(0, 3)
      .map((c) => `${c.title} (${Math.round(c.confidence * 100)}%)`)
      .join(' · ');
    process.stderr.write(`_Suggested parent PRDs: ${parts}_\n`);
  } catch {
    // Any unexpected error → silent skip. Hook MUST NOT surface errors to operator.
  }

  ack();
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const _t = startTimer('SuggestParentOnTaskCreate');
process.on('exit', () => stopTimer(_t, 'TaskCreated'));
// Force-exit belt-and-braces alongside the reader.cancel() above: this hook is
// observation-only and must never outlive its turn, whatever stdin does (H-078).
main()
  .catch((): void => {
    process.stdout.write(JSON.stringify({}) + '\n');
  })
  .finally(() => process.exit(0));
