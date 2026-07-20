#!/usr/bin/env bun
/**
 * PreDelegationBundle.hook.ts — V21-W1-S2 enforcement wiring (v0.0.21
 * roadmap, "Enforcement Wiring" wave).
 *
 * PreToolUse hook (matcher: Agent|Task) that checks each subagent spawn's
 * prompt for (a) an inline context bundle and (b) a declared output
 * schema/return contract. Bare spawns — short prompt, no context, no
 * contract (lib/delegation-bundle.ts, conservative all-three rule) — get:
 *
 *   warn mode (DEFAULT — never blocks): an advisory via the canonical
 *   PreToolUse allow+additionalContext shape (IntelFirstGuard precedent) +
 *   one JSONL line to <DOS_DIR>/MEMORY/STATE/delegation-bundle-events.jsonl.
 *
 *   block mode (DOS_ENFORCEMENT_MODE_DELEGATION=block): exit 2 with the
 *   advisory on stderr — the spawn is denied with remediation text.
 *
 * The roadmap's auto-attach-StructuredOutput leg is deliberately NOT here:
 * PreToolUse cannot rewrite tool input non-destructively on this harness;
 * warn/telemetry first (Fowler C3), attach as a follow-up.
 *
 * Config (env):
 *   DOS_ENFORCEMENT_MODE_DELEGATION      warn (default) | block
 *   DOS_DELEGATION_BARE_MAX_CHARS        "short prompt" ceiling (default 300)
 *   DOS_DISABLE_DELEGATION_BUNDLE_GATE=1 hook disabled entirely
 *
 * Fail-open: every internal error path allows the spawn (exit 0).
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { startTimer, stopTimer } from './lib/hook-io';
import { getDosDir, resolveSessionId } from './lib/paths';
import { rotateIfNeeded } from './lib/rotate';
import { readStdinBounded } from './lib/stdin-bounded';
import {
  classifySpawn,
  DEFAULT_MAX_BARE_CHARS,
  type SpawnClassification,
} from './lib/delegation-bundle';

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export interface DelegationBundleEvent {
  timestamp: string;
  session_id: string;
  tool_name: string;
  subagent_type: string;
  prompt_chars: number;
  has_context_bundle: boolean;
  has_output_contract: boolean;
  mode: 'warn' | 'block';
  fired: true;
}

function eventsPath(): string {
  return join(getDosDir(), 'MEMORY', 'STATE', 'delegation-bundle-events.jsonl');
}

export function appendEvent(event: DelegationBundleEvent): void {
  try {
    const file = eventsPath();
    const dir = join(file, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    rotateIfNeeded(file);
    appendFileSync(file, JSON.stringify(event) + '\n');
  } catch {
    // Telemetry failure must never affect the spawn.
  }
}

export function advisoryText(event: DelegationBundleEvent, c: SpawnClassification): string {
  const missing: string[] = [];
  if (!c.hasContextBundle) missing.push('inline context bundle (ground-truth file content or an explicit CONTEXT section)');
  if (!c.hasOutputContract) missing.push('declared output schema / return contract (e.g. "Return: JSON {…}" or a Report section)');
  return (
    `BARE DELEGATION [${event.mode.toUpperCase()}] — ${event.tool_name}(${event.subagent_type || 'unknown'}) ` +
    `spawned with a ${c.promptChars}-char prompt missing: ${missing.join(' AND ')}.\n` +
    `Doctrine: subagents get a context bundle + an output contract, or their output drifts ` +
    `(V21-W1-S2; schema-valid subagent output was 0% on replayed multi-angle reviews).\n` +
    `Telemetry: MEMORY/STATE/delegation-bundle-events.jsonl.` +
    (event.mode === 'warn'
      ? ' This is a warn-mode advisory — the spawn proceeds.'
      : ' Blocked (DOS_ENFORCEMENT_MODE_DELEGATION=block) — rewrite the prompt with context + contract and retry.')
  );
}

async function main(): Promise<void> {
  const timer = startTimer('PreDelegationBundle');
  let event = 'no-op';

  try {
    if (process.env.DOS_DISABLE_DELEGATION_BUNDLE_GATE === '1') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const raw = await readStdinBounded(500, () => {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    });
    if (raw === null) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    let input: HookInput;
    try {
      input = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const toolName = input.tool_name ?? '';
    if (toolName && toolName !== 'Agent' && toolName !== 'Task') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const toolInput = input.tool_input ?? {};
    const prompt = typeof toolInput.prompt === 'string' ? toolInput.prompt : '';
    if (!prompt) {
      // No prompt surface to judge — fail open.
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const maxBare = clampInt(process.env.DOS_DELEGATION_BARE_MAX_CHARS, DEFAULT_MAX_BARE_CHARS);
    const classification = classifySpawn(prompt, maxBare);
    if (!classification.bare) {
      event = 'bundled';
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const mode =
      (process.env.DOS_ENFORCEMENT_MODE_DELEGATION ?? 'warn').toLowerCase() === 'block'
        ? 'block'
        : 'warn';
    const record: DelegationBundleEvent = {
      timestamp: new Date().toISOString(),
      session_id: resolveSessionId(input),
      tool_name: toolName || 'Agent',
      subagent_type:
        typeof toolInput.subagent_type === 'string' ? toolInput.subagent_type : '',
      prompt_chars: classification.promptChars,
      has_context_bundle: classification.hasContextBundle,
      has_output_contract: classification.hasOutputContract,
      mode,
      fired: true,
    };
    appendEvent(record);
    event = `fired-${mode}`;

    if (mode === 'block') {
      process.stderr.write(advisoryText(record, classification) + '\n');
      stopTimer(timer, event);
      process.exit(2);
    }

    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          additionalContext: advisoryText(record, classification),
        },
      }),
    );
  } catch {
    event = 'error';
    try {
      console.log(JSON.stringify({ continue: true }));
    } catch {
      /* nothing left to fail open with */
    }
  } finally {
    stopTimer(timer, event);
  }
}

function clampInt(rawValue: string | undefined, fallback: number): number {
  const n = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

if (import.meta.main) {
  main();
}
