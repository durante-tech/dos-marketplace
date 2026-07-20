#!/usr/bin/env bun
/**
 * ReviewDebtGate.hook.ts — V21-W1-S1 enforcement wiring (v0.0.21 roadmap,
 * "Enforcement Wiring" wave; folds the stale skill-route-enforcer-2026-04
 * plan's doctrine→enforcement scope).
 *
 * PreToolUse hook on two decision surfaces:
 *   - Bash        → git-commit commands
 *   - Write/Edit/MultiEdit → PRD writes that set `phase: complete`
 *
 * At each surface it computes REVIEW DEBT — the number of edit waves since
 * the session's last /code-review invocation (see lib/review-debt.ts for the
 * documented wave definition) — and at debt > threshold (default 1 wave):
 *
 *   warn mode (DEFAULT — Fowler C3, a too-sharp gate gets disabled not
 *   obeyed): emits an advisory via the canonical PreToolUse
 *   allow+additionalContext shape (IntelFirstGuard precedent) and appends one
 *   JSONL line to <DOS_DIR>/MEMORY/STATE/review-debt-events.jsonl.
 *
 *   block mode (DOS_ENFORCEMENT_MODE_REVIEW_DEBT=block): exit 2 with the
 *   advisory on stderr (DeployLineGuard precedent) — the tool call is denied
 *   and the model sees the remediation text.
 *
 * Review-signal sources:
 *   1. session transcript Skill("code-review"|"simplify") calls (VerifyGate
 *      detection parity — its simplify_* surface is a stable contract), and
 *   2. skill-activations.jsonl rows for this session (RFC-0156 telemetry) —
 *      survives post-compact transcript truncation.
 *
 * Config (env):
 *   DOS_ENFORCEMENT_MODE_REVIEW_DEBT   warn (default) | block
 *   DOS_REVIEW_DEBT_THRESHOLD          fire at debt > N waves (default 1)
 *   DOS_REVIEW_DEBT_WAVE_GAP           non-edit calls that close a wave (default 5)
 *   DOS_DISABLE_REVIEW_DEBT_GATE=1     hook disabled entirely
 *
 * Fail-open: every internal error path allows the tool call (exit 0,
 * {continue:true}) — an enforcement hook must never break the operator's
 * loop on its own defect.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startTimer, stopTimer } from './lib/hook-io';
import { getDosDir, resolveSessionId } from './lib/paths';
import { rotateIfNeeded } from './lib/rotate';
import { readStdinBounded } from './lib/stdin-bounded';
import {
  extractToolUses,
  computeReviewDebt,
  isGitCommitCommand,
  isPhaseCompleteWrite,
  REVIEW_SKILL_RE,
} from './lib/review-debt';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export type Trigger = 'git-commit' | 'phase-complete';

export interface ReviewDebtEvent {
  timestamp: string;
  session_id: string;
  trigger: Trigger;
  debt_waves: number;
  edits_since_review: number;
  review_seen: boolean;
  threshold: number;
  mode: 'warn' | 'block';
  fired: boolean;
}

function eventsPath(): string {
  return join(getDosDir(), 'MEMORY', 'STATE', 'review-debt-events.jsonl');
}

export function appendEvent(event: ReviewDebtEvent): void {
  try {
    const file = eventsPath();
    const dir = join(file, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    rotateIfNeeded(file);
    appendFileSync(file, JSON.stringify(event) + '\n');
  } catch {
    // Telemetry failure must never affect the gate outcome.
  }
}

/** Trigger classification for this tool call, or null → not a gate surface. */
export function detectTrigger(
  toolName: string,
  toolInput: Record<string, unknown>,
): Trigger | null {
  if (toolName === 'Bash') {
    const cmd = typeof toolInput.command === 'string' ? toolInput.command : '';
    return isGitCommitCommand(cmd) ? 'git-commit' : null;
  }
  return isPhaseCompleteWrite(toolName, toolInput) ? 'phase-complete' : null;
}

/** Latest code-review activation ts for this session from
 *  skill-activations.jsonl (RFC-0156 writer), '' when none. */
export function latestReviewActivationTs(sessionId: string, filePath?: string): string {
  try {
    const p = filePath ?? join(getDosDir(), 'MEMORY', 'STATE', 'skill-activations.jsonl');
    if (!existsSync(p)) return '';
    let latest = '';
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as {
          timestamp?: string;
          skill_name?: string;
          session_id?: string;
        };
        if (row.session_id !== sessionId || typeof row.skill_name !== 'string') continue;
        const last = row.skill_name.split(':').pop() ?? row.skill_name;
        if (!REVIEW_SKILL_RE.test(last.trim())) continue;
        const ts = row.timestamp ?? '';
        if (ts > latest) latest = ts;
      } catch {
        /* skip malformed */
      }
    }
    return latest;
  } catch {
    return '';
  }
}

export function advisoryText(event: ReviewDebtEvent): string {
  const surface = event.trigger === 'git-commit' ? 'git commit' : 'phase: complete';
  return (
    `REVIEW DEBT [${event.mode.toUpperCase()}] — ${event.debt_waves} edit wave(s) ` +
    `(${event.edits_since_review} code edit(s)) since ` +
    (event.review_seen ? 'the last /code-review' : 'session start (no /code-review yet)') +
    `, at the ${surface} gate (threshold: >${event.threshold} wave).\n` +
    `Doctrine: code-producing work is reviewed before it is committed or closed ` +
    `(V21-W1-S1; the 2-reviews-vs-3,773-edits phantom-gate finding).\n` +
    `Resolve: invoke Skill("code-review") on the working diff, then retry. ` +
    `Telemetry: MEMORY/STATE/review-debt-events.jsonl.` +
    (event.mode === 'warn'
      ? ` This is a warn-mode advisory — the ${surface} proceeds.`
      : ` Blocked (DOS_ENFORCEMENT_MODE_REVIEW_DEBT=block).`)
  );
}

async function main(): Promise<void> {
  const timer = startTimer('ReviewDebtGate');
  let event = 'no-op';

  try {
    if (process.env.DOS_DISABLE_REVIEW_DEBT_GATE === '1') {
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

    // Cheap guards FIRST — no transcript I/O unless this is a gate surface.
    const trigger = detectTrigger(input.tool_name ?? '', input.tool_input ?? {});
    if (!trigger) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const transcriptPath = input.transcript_path ?? '';
    if (!transcriptPath || !existsSync(transcriptPath)) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const mode =
      (process.env.DOS_ENFORCEMENT_MODE_REVIEW_DEBT ?? 'warn').toLowerCase() === 'block'
        ? 'block'
        : 'warn';
    const threshold = clampInt(process.env.DOS_REVIEW_DEBT_THRESHOLD, 1);
    const waveGap = clampInt(process.env.DOS_REVIEW_DEBT_WAVE_GAP, 5);

    const sessionId = resolveSessionId(input);
    const uses = extractToolUses(readFileSync(transcriptPath, 'utf-8'));
    const externalReviewTs = latestReviewActivationTs(sessionId);
    const debt = computeReviewDebt(uses, waveGap, externalReviewTs);

    const fired = debt.debtWaves > threshold;
    const record: ReviewDebtEvent = {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      trigger,
      debt_waves: debt.debtWaves,
      edits_since_review: debt.editsSinceReview,
      review_seen: debt.reviewSeen,
      threshold,
      mode,
      fired,
    };
    appendEvent(record);
    event = fired ? `fired-${mode}-${trigger}` : `pass-${trigger}`;

    if (!fired) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    if (mode === 'block') {
      process.stderr.write(advisoryText(record) + '\n');
      stopTimer(timer, event);
      process.exit(2);
    }

    // Warn mode: canonical PreToolUse allow + additionalContext shape
    // (IntelFirstGuard precedent) so the model actually sees the advisory.
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          additionalContext: advisoryText(record),
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
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

if (import.meta.main) {
  main();
}
