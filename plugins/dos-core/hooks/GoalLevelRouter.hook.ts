#!/usr/bin/env bun
/**
 * GoalLevelRouter.hook.ts — RFC-0156 P1 goal-level router.
 *
 * UserPromptSubmit hook (registered AFTER EscalationGate in the same group)
 * that classifies each operator prompt's altitude — fish / sea / kite — and:
 *   - appends ONE audit line per classification to
 *     <DOS_DIR>/MEMORY/STATE/goal-router-audit.jsonl (ISC-11), and
 *   - for KITE ONLY, emits an inert "provision the board?" proposal via
 *     additionalContext (ISC-10 — proposes, never provisions).
 *
 * fish and sea stay silent on the context channel: the mode classifier
 * (IntentRetrieval/OrchestratorPrompt) already owns their banners; a second
 * banner would be noise. Their routing is still recorded in the audit line —
 * that persistence is the RFC-0156 §6 instrumentation requirement.
 *
 * Behavior contract (mirrors EscalationGate.hook.ts):
 *   - bounded stdin read (500ms hard-timer force-exit — the lingering-pipe
 *     failure the fail-open try/catch cannot otherwise cover)
 *   - stripMachineText → classify the HUMAN remainder only; hard-silence when
 *     the remainder is sub-threshold (<10 chars)
 *   - pure regex classification (lib/goal-level.ts); NO inference calls
 *   - never blocks the operator: always exit 0 with valid JSON
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { startTimer, stopTimer } from './lib/hook-io';
import { stripMachineText } from './lib/machine-text';
import { emitUserPromptSubmitContext } from './lib/hook-output';
import { getDosDir, resolveSessionId } from './lib/paths';
import { rotateIfNeeded } from './lib/rotate';
import { readStdinBounded } from './lib/stdin-bounded';
import { classifyAltitude, kiteProposalText, type AltitudeDecision } from './lib/goal-level';

interface HookInput {
  session_id?: string;
  prompt?: string;
}

function auditPath(): string {
  return join(getDosDir(), 'MEMORY', 'STATE', 'goal-router-audit.jsonl');
}

/** One line per classification — altitude + chosen route + evidence (RFC-0156 §6). */
export function appendAuditLine(
  sessionId: string,
  decision: AltitudeDecision,
  emitted: boolean,
): void {
  try {
    const file = auditPath();
    const dir = join(file, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // One line per prompt across every session — rotate like hook-timing.jsonl
    // does, or this becomes the next multi-MB STATE stray.
    rotateIfNeeded(file);
    appendFileSync(
      file,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        altitude: decision.altitude,
        route: decision.route,
        matched: decision.matched,
        emitted,
      }) + '\n',
    );
  } catch {
    // Telemetry failure must never block the hook.
  }
}

async function main(): Promise<void> {
  const timer = startTimer('GoalLevelRouter');
  let event = 'no-op';

  try {
    // Bounded stdin read via the shared helper (lib/stdin-bounded.ts) — the
    // timer is cancelled in its finally, so a read rejection can never leave
    // it armed to emit a second JSON object.
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

    const prompt = input.prompt || '';
    if (!prompt) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const strip = stripMachineText(prompt);
    const human = strip.remainder;
    if (strip.stripped && human.length < 10) {
      event = 'machine-text-skip';
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const decision = classifyAltitude(human);
    const emitKite = decision.altitude === 'kite';
    event = `altitude-${decision.altitude}`;

    appendAuditLine(resolveSessionId(input), decision, emitKite);

    if (emitKite) {
      emitUserPromptSubmitContext(kiteProposalText() + '\n');
    } else {
      console.log(JSON.stringify({ continue: true }));
    }
  } catch {
    event = 'error';
    console.log(JSON.stringify({ continue: true }));
  } finally {
    stopTimer(timer, event);
  }
}

if (import.meta.main) {
  main();
}
