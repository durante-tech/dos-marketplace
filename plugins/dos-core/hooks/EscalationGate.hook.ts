#!/usr/bin/env bun
/**
 * EscalationGate.hook.ts — RFC-0066 (W-T11)
 *
 * UserPromptSubmit hook that ratchets MODE_FLOOR upward when doctrine-affecting,
 * architectural-locator, multi-project, or hard-to-vary triggers fire in the
 * operator's prompt. Open-loop counterpart to the closed-loop Mode Classifier
 * (RFC-0001-amendment-mode-classifier, W-T2).
 *
 * Spec: Plans/Specs/RFC-0066-escalation-gate.md
 * Sprint: v0.0.8 W-T11 (Bucket E pick 3 of 4 of RFC-0064 master DAG)
 *
 * Behavior contract:
 *   - Reads UserPromptSubmit JSON from stdin
 *   - Scans prompt against 5 trigger families (regex catalog)
 *   - Writes MODE_FLOOR=E4 or MODE_FLOOR=E5 (compound takes highest) via
 *     additionalContext in stdout JSON
 *   - Operator explicit /e1.../e5 wins — gate stays silent
 *   - Logs every trigger fire to MEMORY/STATE/escalation-gate.jsonl
 *   - Pure regex; NO inference / Haiku / Sonnet calls
 *   - Never blocks operator (try/catch + always exit 0 + emit valid JSON)
 *
 * Triggers (per RFC-0066 §5):
 *   - doctrine-affecting    → E4
 *   - architectural-locator → E4
 *   - multi-project         → E4
 *   - hard-to-vary          → E5 (compound takes highest)
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { startTimer, stopTimer } from './lib/hook-io';
import { readStdinBounded } from './lib/stdin-bounded';
import { stripMachineText } from './lib/machine-text';
import { inferModeFloor } from './lib/mode-classifier';
import { emitUserPromptSubmitContext } from './lib/hook-output';

// ─── Types ────────────────────────────────────────

interface HookInput {
  session_id?: string;
  prompt?: string;
}

type ModeFloor = 'E4' | 'E5';

// ─── Constants ────────────────────────────────────

const STATE_DIR = join(homedir(), '.claude', 'MEMORY', 'STATE');
const TELEMETRY_FILE = join(STATE_DIR, 'escalation-gate.jsonl');

// Operator explicit override — if any /eN shortcut, gate stays silent.
// (Operator explicit wins per RFC-0066; the explicit LEVEL is consumed by the
// classifier in IntentRetrieval, not here — the gate only stays silent.)
const OPERATOR_OVERRIDE_RE = /(?:^|\s)\/(e[1-5])\b/i;

// S4 (silence-the-siblings): the RFC-0066 §5 trigger catalog + multi-project
// compound + highest-floor logic moved VERBATIM into lib/mode-classifier.ts as
// the shared inferModeFloor(). One catalog, two consumers (this gate +
// IntentRetrieval's classifyPrompt), zero drift — the gate can never disagree
// with the classifier about the floor (mode_floor_mechanism). EscalationGate is
// now a thin shell: stdin → stripMachineText → inferModeFloor(remainder) →
// telemetry + MODE_FLOOR additionalContext (RFC-0066 contract unchanged).

// ─── Telemetry ────────────────────────────────────

function logTriggerFire(
  sessionId: string,
  prompt: string,
  fires: Array<{ family: string; matched: string }>,
  modeFloorSet: ModeFloor | null,
): void {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    const record = {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      prompt_first_120: prompt.slice(0, 120).replace(/\n/g, ' '),
      triggers_fired: fires.map((f) => f.family),
      mode_floor_set: modeFloorSet,
    };
    appendFileSync(TELEMETRY_FILE, JSON.stringify(record) + '\n');
  } catch {
    // Telemetry failure must never block the hook.
  }
}

// ─── Main ─────────────────────────────────────────

async function main(): Promise<void> {
  const timer = startTimer('EscalationGate');
  let event = 'no-trigger';

  try {
    // Bound the stdin read via the shared helper (lib/stdin-bounded.ts,
    // RFC-0156 P1): `await Bun.stdin.text()` alone waits for EOF forever, and
    // a bare Promise.race is NOT enough — the abandoned read keeps the process
    // alive until EOF anyway (Forge Gen 18/21). The previous hand-rolled copy
    // of this block skipped clearTimeout on the rejection path, so the 500ms
    // timer later emitted a SECOND {continue:true} and a delayed exit (the
    // uncancelled-timer defect — Forge H-126, Gen 109). The helper clears the
    // timer in a finally on every path; on timeout it force-exits fail-safe.
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
    const sessionId = input.session_id || 'unknown';

    if (!prompt) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // S4 / spec A.1 — STRIP-AND-RE-ENTER. Where the old gate skipped any prompt
    // whose PREFIX matched a machine envelope (isMachineGeneratedPrompt), it now
    // peels the leading machine block(s) and evaluates triggers on the HUMAN
    // REMAINDER. A hybrid paste-then-ask turn (a pasted <task-notification> with
    // 'refactor RFC-0044 doctrine' typed below it) now correctly gets floor
    // evaluation on the human text. HARD SILENCE (no MODE_FLOOR) ONLY when the
    // remainder is empty or <10 chars — the A.1 'no MODE_FLOOR across all three
    // UserPromptSubmit classifiers' rider on sub-threshold machine turns.
    const strip = stripMachineText(prompt);
    const human = strip.remainder;
    if (strip.stripped && human.length < 10) {
      event = 'machine-text-skip';
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Operator override wins — silent path (RFC-0066: "operator explicit
    // /e1.../e5 wins — gate stays silent"). Evaluated on the human remainder.
    if (OPERATOR_OVERRIDE_RE.test(human)) {
      event = 'operator-override';
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Shared single-source floor inference (lib/mode-classifier.ts) — the same
    // catalog IntentRetrieval's classifyPrompt ratchets on, so the gate and the
    // banner can never disagree about the floor.
    const { floor, fires } = inferModeFloor(human);

    if (!floor) {
      event = 'no-trigger';
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Trigger fired — log + emit MODE_FLOOR (RFC-0066 contract unchanged).
    event = `trigger-${floor}-${fires.length}`;
    logTriggerFire(sessionId, prompt, fires, floor);

    emitUserPromptSubmitContext(
      `MODE_FLOOR=${floor}\n(EscalationGate fired on: ${fires.map((f) => f.family).join(', ')})\n`,
    );
  } catch (err: any) {
    // Final safety: never block. Always emit valid JSON, exit 0.
    event = 'error';
    try {
      logTriggerFire('error', '', [], null);
    } catch {
      // pass
    }
    console.log(JSON.stringify({ continue: true }));
  } finally {
    stopTimer(timer, event);
  }
}

main();
