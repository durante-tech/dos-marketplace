#!/usr/bin/env bun
/**
 * PortBypass.hook.ts — RFC-0031 Phase 3 runtime port-bypass advisory.
 *
 * TRIGGER: PreToolUse on Bash
 *
 * Inspects the bash command for raw provider-API curl patterns
 * (api.openai.com, api.anthropic.com, api.replicate.com, api.elevenlabs.io,
 * openrouter.ai). When detected, emits an advisory <system-reminder>
 * suggesting the corresponding DOS Port (Tools/Inference.ts,
 * Tools/dos-image.ts, Tools/dos-video.ts, Tools/dos-audio.ts).
 *
 * Phase 3 (this version): ADVISORY ONLY — never blocks the Bash call.
 *   The reminder appears in stderr; the LLM sees it on next turn and can
 *   choose to re-route. Walking-skeleton: validate the routing signal
 *   before flipping to block per RFC-0006 §2D progression.
 *
 * Phase 4 (post-soak): may flip to BLOCK gated on `DOS_PORT_BYPASS_MODE=block`.
 *
 * Telemetry: every advisory fire writes a JSONL entry to
 *   `<project>/MEMORY/ARTIFACTS/port-bypass-telemetry.jsonl`. Schema mirrors
 *   web-fetch-router-telemetry; `operator_action` slot reserved for soak-
 *   window analysis (switched | ignored | wrong_target).
 *
 * OPT-OUT: `DOS_PORT_BYPASS_DISABLE=1` silences the hook entirely.
 *
 * NON-BLOCKING ON ERROR: any parse / probe / write error degrades to silent
 *   pass. The hook MUST NOT break a normal Bash invocation.
 */

import { startTimer, stopTimer } from './lib/hook-io';
import { getMemorySubdir, loadProjectEnv } from './lib/paths';

loadProjectEnv();
import { rotateIfNeeded } from './lib/rotate';
import {
  classifyBypassCommand,
  type PortBypassRoute,
} from './lib/portBypassRoutes';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

interface HookInput {
  tool_name?: string;
  tool_input?: {
    command?: string;
  };
}

async function readStdin(): Promise<HookInput | null> {
  try {
    const raw = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 200)),
    ]);
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emitReminder(command: string, route: PortBypassRoute): void {
  const lines = [
    '<system-reminder>',
    `Port-bypass advisory: raw curl to ${route.providerLabel}`,
    `Command: ${command.slice(0, 200)}${command.length > 200 ? '…' : ''}`,
    `Why: ${route.rationale}`,
    `Consider routing via: ${route.suggestedPort}`,
    '',
    'This is advisory — Bash will still execute. Re-route on the next turn if the call needs Studio metering.',
    'Disable: DOS_PORT_BYPASS_DISABLE=1',
    '</system-reminder>',
  ];
  process.stderr.write(lines.join('\n') + '\n');
}

interface TelemetryRecord {
  timestamp: string;
  port: 'port-bypass';
  provider: string;
  command_preview: string;
  suggested_port: string;
  session_id: string | null;
  source_hook: 'PortBypass';
  /** Phase 4 enrichment slot — operator action after the advisory. */
  operator_action: null;
}

const TELEMETRY_MAX_BYTES = Number(process.env.DOS_PORT_BYPASS_MAX_BYTES) || undefined;

function writeTelemetry(record: TelemetryRecord): void {
  try {
    const path = join(getMemorySubdir('ARTIFACTS'), 'port-bypass-telemetry.jsonl');
    rotateIfNeeded(path, TELEMETRY_MAX_BYTES ? { maxBytes: TELEMETRY_MAX_BYTES } : {});
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf-8');
  } catch {
    // Non-blocking — telemetry write failure must not break Bash.
  }
}

async function main(): Promise<void> {
  if (process.env.DOS_PORT_BYPASS_DISABLE === '1') {
    process.exit(0);
  }
  const input = await readStdin();
  if (!input || input.tool_name !== 'Bash') process.exit(0);
  const command = input.tool_input?.command;
  if (!command || typeof command !== 'string') process.exit(0);
  const route = classifyBypassCommand(command);
  if (route) {
    emitReminder(command, route);
    writeTelemetry({
      timestamp: new Date().toISOString(),
      port: 'port-bypass',
      provider: route.providerLabel,
      command_preview: command.slice(0, 200),
      suggested_port: route.suggestedPort,
      session_id: process.env.CLAUDE_SESSION_ID ?? process.env.DOS_SESSION_ID ?? null,
      source_hook: 'PortBypass',
      operator_action: null,
    });
  }
  process.exit(0);
}

const _t = startTimer('PortBypass');
process.on('exit', () => stopTimer(_t, 'PreToolUse'));
main().catch(() => process.exit(0));
