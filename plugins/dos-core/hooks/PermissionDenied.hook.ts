#!/usr/bin/env bun
/**
 * PermissionDenied.hook.ts — Deny-then-revise loop for auto-mode permission denials
 *
 * PURPOSE:
 * Fires after Claude Code's auto-mode classifier denies a tool call. Logs the
 * denial for audit, then classifies the reason. For recoverable denials (typos,
 * path/case mismatches) it returns {retry: true} so the model can revise and
 * retry instead of hitting a hard block. For real permission requirements it
 * lets the normal approval flow continue.
 *
 * TRIGGER: PermissionDenied (Claude Code v2.1.89+)
 *
 * INPUT (from stdin, JSON):
 * - session_id: Current session identifier
 * - tool_name:  Name of the denied tool (string)
 * - tool_input: Tool arguments (object or string)
 * - reason:     Denial reason string from the classifier
 *
 * OUTPUT (stdout, JSON):
 * - {retry: true, reason: "..."} → model may revise and retry
 * - {}                           → let normal flow continue
 * - exit(0) always — fire-and-forget, never blocks
 *
 * SIDE EFFECTS:
 * - Appends to: MEMORY/SECURITY/YYYY/MM/permission-denied.jsonl
 *
 * INTER-HOOK RELATIONSHIPS:
 * - INDEPENDENT: no coordination with other hooks
 * - Audit trail is readable by SaveSecurityEventsToStudio at SessionEnd
 *
 * ERROR HANDLING:
 * - Malformed stdin  → emit {} and exit 0
 * - Logging failure  → silent; never blocks the hook
 *
 * PERFORMANCE:
 * - Blocking: No (hook is post-classifier; model already received denial)
 * - Typical execution: <5ms
 *
 * CLASSIFICATION:
 * - Recoverable  : "typo", "path mismatch", "case mismatch", "not found", "no such file"
 * - Permission   : "permission required", "user must approve", "needs approval"
 * - Other        : pass-through (no retry hint)
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { getMemorySubdir } from './lib/paths';
import { startTimer, stopTimer } from './lib/hook-io';

// ========================================
// Types
// ========================================

interface PermissionDeniedInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown> | string;
  reason?: string;
  [key: string]: unknown;
}

interface DenialEvent {
  timestamp: string;
  session_id: string;
  tool: string;
  reason: string;
  category: 'recoverable' | 'permission' | 'other';
  tool_input_preview: string;
}

// ========================================
// Logging
// ========================================

function getDenialLogPath(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return join(getMemorySubdir('SECURITY'), year, month, 'permission-denied.jsonl');
}

function logDenial(event: DenialEvent): void {
  try {
    const logPath = getDenialLogPath();
    const dir = logPath.substring(0, logPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf-8');
  } catch {
    // Logging failure must not break the hook
  }
}

// ========================================
// Classification
// ========================================

const RECOVERABLE_PATTERNS = [
  /typo/i,
  /path\s*mismatch/i,
  /case\s*mismatch/i,
  /no\s*such\s*file/i,
  /not\s*found/i,
  /does\s*not\s*exist/i,
  /misspelled/i,
  /invalid\s*path/i,
];

const PERMISSION_PATTERNS = [
  /permission\s*required/i,
  /user\s*must\s*approve/i,
  /needs\s*approval/i,
  /requires\s*approval/i,
  /not\s*allowed/i,
  /denied\s*by\s*policy/i,
];

function classify(reason: string): 'recoverable' | 'permission' | 'other' {
  if (!reason) return 'other';
  for (const p of RECOVERABLE_PATTERNS) {
    if (p.test(reason)) return 'recoverable';
  }
  for (const p of PERMISSION_PATTERNS) {
    if (p.test(reason)) return 'permission';
  }
  return 'other';
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
    return raw;
  } catch {
    return '';
  }
}

async function main(): Promise<void> {
  let input: PermissionDeniedInput = {};

  try {
    const raw = await readStdin();
    if (raw.trim()) {
      input = JSON.parse(raw);
    }
  } catch {
    // Parse error — emit empty response and exit
    console.log(JSON.stringify({}));
    return;
  }

  const reason = (input.reason || '').toString();
  const toolName = (input.tool_name || 'unknown').toString();
  const sessionId = (input.session_id || 'unknown').toString();
  const category = classify(reason);

  // Build preview of tool_input (capped) for audit log
  let toolInputPreview = '';
  try {
    const serialized = typeof input.tool_input === 'string'
      ? input.tool_input
      : JSON.stringify(input.tool_input ?? {});
    toolInputPreview = serialized.slice(0, 500);
  } catch {
    toolInputPreview = '';
  }

  // Log denial for audit trail
  logDenial({
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    tool: toolName,
    reason,
    category,
    tool_input_preview: toolInputPreview,
  });

  // Emit response based on classification
  switch (category) {
    case 'recoverable':
      console.log(JSON.stringify({
        retry: true,
        reason: 'Recoverable — adjust path/case and retry',
      }));
      break;
    case 'permission':
    case 'other':
    default:
      console.log(JSON.stringify({}));
      break;
  }
}

// Run main with timing, fail open on any error. The explicit exits matter:
// readStdin never cancels its pending reader.read(), so without them a
// held-open stdin keeps the event loop alive past main() (Forge H-037).
const _t = startTimer('PermissionDenied');
process.on('exit', () => stopTimer(_t, 'PermissionDenied'));
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.log(JSON.stringify({}));
    process.exit(0);
  });
