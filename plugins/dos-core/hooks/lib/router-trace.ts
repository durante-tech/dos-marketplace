/**
 * router-trace.ts — UserPromptSubmit router trace writer + turn-state handshake.
 *
 * Spec: MEMORY/RESEARCH/2026-06/classifier-ratified-spec-2026-06-12.md §B.1/B.2.
 *
 * Two responsibilities, both impure (this is the I/O boundary the pure
 * mode-classifier.ts deliberately does NOT cross — clause D):
 *
 *   1. appendRouterTrace() — one JSONL line per UserPromptSubmit event to
 *      getMemorySubdir('LEARNING')/SIGNALS/router-trace.jsonl. Logged BEFORE
 *      ALL gates (B.1/RT-A16): the denominator is UserPromptSubmit events, not
 *      survivors. Core fields are exactly the B.1 schema; effort_source /
 *      explicit_level / mode_floor are ADDITIVE (readers filter known fields —
 *      the same convention that protected recall-coverage.jsonl).
 *
 *   2. writeTurnState() / readTurnState() — the turn-id join handshake (B.2,
 *      RT-A16 "never 'latest trace before Stop'"). At trace time the router
 *      atomically writes MEMORY/STATE/router-turn-{session_id}.json carrying
 *      {turn_id, ts, prompt_sha256, hint}. At Stop, ModeHeaderGuard reads it
 *      (S5), recomputes the sha256 of the operator text it already extracts,
 *      and writes a B.2 conformance row ONLY on hash match — a mismatch
 *      produces no row, never a phantom join.
 *
 * Fail-open: every write is try/catch and swallows errors. A broken trace log
 * must NEVER block prompt dispatch (never-blocks contract, engineering rule 3;
 * hot-path risk #1 in the architect plan — appendSignal precedent).
 *
 * The trace path resolves project-first via getMemorySubdir('LEARNING') —
 * beneath the active project it is MEMORY/LEARNING/SIGNALS/...; the global
 * fallback is ~/.claude/MEMORY/LEARNING/SIGNALS/.... Readers merge per-root
 * via the getAllDirs('LEARNING') pattern (B.1 — resolves the R63 asymmetry).
 * The legacy hardcoded SIGNALS_DIR in IntentRetrieval is NOT reused here.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDosDir, getMemorySubdir } from './paths';
import { atomicAppendSync, atomicWriteSync } from './atomic-write';
import type { ModeDecision } from './mode-classifier';

// ─── Paths ─────────────────────────────────────────────────────────────────

/** router-trace.jsonl under the project-first LEARNING/SIGNALS resolution. */
export function routerTracePath(): string {
  return join(getMemorySubdir('LEARNING'), 'SIGNALS', 'router-trace.jsonl');
}

/** Per-session turn-state handshake file under MEMORY/STATE (split-eligible). */
export function turnStatePath(sessionId: string): string {
  return join(getDosDir(), 'MEMORY', 'STATE', `router-turn-${sessionId}.json`);
}

// ─── B.1 trace row ───────────────────────────────────────────────────────────

/** reason semantics per trace_log: why this row's emission stands. */
export type TraceReason = 'matched-class' | 'machine-text' | 'cooldown' | 'skip-gate';

/**
 * The B.1 JSONL schema. Core fields {ts, session_id, turn_id, evidence_class,
 * verdict, emission, reason} are exactly the spec's; effort_source /
 * explicit_level / mode_floor / stripped / remainder_len are additive.
 */
export interface RouterTraceRow {
  ts: string;
  session_id: string;
  turn_id: string;
  evidence_class: ModeDecision['evidence_class'];
  verdict: ModeDecision['verdict'];
  emission: ModeDecision['emission'];
  reason: TraceReason;
  /** present (true) only when A.1 stripping fired. */
  stripped?: boolean;
  /** present only when stripped — length of the human remainder (A.1). */
  remainder_len?: number;
  effort_source: 'explicit' | null;
  explicit_level: 1 | 2 | 3 | 4 | 5 | null;
  mode_floor: 'E4' | 'E5' | null;
}

export interface AppendTraceArgs {
  sessionId: string;
  turnId: string;
  decision: ModeDecision;
  reason: TraceReason;
}

/**
 * Build the B.1 row from a ModeDecision. `stripped`/`remainder_len` are emitted
 * ONLY when stripping fired (A.1: "present when stripped"), keeping the row
 * shape honest for non-machine turns.
 */
export function buildTraceRow(args: AppendTraceArgs): RouterTraceRow {
  const { sessionId, turnId, decision, reason } = args;
  const row: RouterTraceRow = {
    ts: new Date().toISOString(),
    session_id: sessionId,
    turn_id: turnId,
    evidence_class: decision.evidence_class,
    verdict: decision.verdict,
    emission: decision.emission,
    reason,
    effort_source: decision.effort_source,
    explicit_level: decision.explicit_level,
    mode_floor: decision.mode_floor,
  };
  if (decision.stripped) {
    row.stripped = true;
    row.remainder_len = decision.remainder_len;
  }
  return row;
}

/**
 * Append one B.1 trace row. Fail-open — a write failure NEVER throws (the
 * caller is on the UserPromptSubmit hot path and must not block dispatch).
 * Returns the row written (or that would have been written) for test/inspection.
 */
export function appendRouterTrace(args: AppendTraceArgs): RouterTraceRow {
  const row = buildTraceRow(args);
  try {
    atomicAppendSync(routerTracePath(), JSON.stringify(row));
  } catch {
    /* best-effort — never block dispatch on a trace write failure */
  }
  return row;
}

// ─── B.2 turn-state handshake ────────────────────────────────────────────────

export interface TurnState {
  turn_id: string;
  ts: string;
  /** sha256 of the operator prompt text the router classified. */
  prompt_sha256: string;
  /** the router verdict (null on silent turns — agreed=null is DEFINED, RT-A5). */
  hint: ModeDecision['verdict'];
}

/** Canonical sha256 of the operator text — the B.2 join discriminator. */
export function promptSha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Atomically write the per-session turn-state file. Same fail-open contract as
 * the trace append. The prompt text is hashed, never stored verbatim (the trace
 * never logs raw prompt content — RFC-0037 §5.6).
 */
export function writeTurnState(
  sessionId: string,
  turnId: string,
  promptText: string,
  hint: ModeDecision['verdict'],
): TurnState {
  const state: TurnState = {
    turn_id: turnId,
    ts: new Date().toISOString(),
    prompt_sha256: promptSha256(promptText),
    hint,
  };
  try {
    atomicWriteSync(turnStatePath(sessionId), JSON.stringify(state));
  } catch {
    /* best-effort */
  }
  return state;
}

/**
 * Read the per-session turn-state file (S5 ModeHeaderGuard Stop path consumer).
 * Returns null when absent or corrupt — a missing handshake yields no B.2 row,
 * never a phantom join (RT-A16).
 */
export function readTurnState(sessionId: string): TurnState | null {
  const path = turnStatePath(sessionId);
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    if (
      parsed &&
      typeof parsed.turn_id === 'string' &&
      typeof parsed.prompt_sha256 === 'string'
    ) {
      return parsed as TurnState;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── B.2 Stop-row join (S5 — shared between ModeHeaderGuard and tests) ────────
//
// The Stop consumer (ModeHeaderGuard) reads the turn-state, recomputes the
// sha256 of the operator text it independently extracts, and — ONLY on a hash
// match — emits the B.2 row {turn_id, hint, actual_mode, agreed}. A mismatch
// (compaction, PreCompact rewrite, harness reformatting) or a missing handshake
// yields NO join row, never a phantom join (RT-A16). The agreed/hash logic is
// centralized here so the hook and the lib tests share one tested authority.

/** The grader's verdict for the actual turn output. NONE = no banner emitted. */
export type ActualMode = 'MINIMAL' | 'NATIVE' | 'ALGORITHM' | 'NONE';

/** The B.2 join row attached to a conformance entry on a turn-state hash match. */
export interface StopJoinRow {
  turn_id: string;
  hint: ModeDecision['verdict'];
  actual_mode: ActualMode;
  agreed: boolean | null;
}

/**
 * agreed semantics (B.2 / RT-A5):
 *   - hint === null  → agreed = null  (silent turns produce no disagreement
 *     signal; null is the DEFINED value, analyzed via the C.2 mode-mix tripwire)
 *   - otherwise      → agreed = (hint === actual_mode)  (a NONE actual_mode
 *     under a non-null hint is a genuine disagreement → false)
 */
export function computeAgreed(
  hint: ModeDecision['verdict'],
  actualMode: ActualMode,
): boolean | null {
  if (hint === null) return null;
  return hint === actualMode;
}

/**
 * Build the B.2 join row IFF the recomputed prompt sha256 matches the handshake.
 * Returns null on absence, corruption, or hash mismatch — the phantom-row kill
 * (RT-A16): the join key (turn_id) is minted only when the two texts provably
 * refer to the same turn. The caller supplies the actual_mode from the live
 * (B.3-corrected) grader, so this primitive tracks the grader regardless of
 * which message it selects.
 */
export function buildStopJoinRow(
  sessionId: string,
  operatorText: string,
  actualMode: ActualMode,
): StopJoinRow | null {
  const state = readTurnState(sessionId);
  if (!state) return null;
  if (state.prompt_sha256 !== promptSha256(operatorText)) return null;
  return {
    turn_id: state.turn_id,
    hint: state.hint,
    actual_mode: actualMode,
    agreed: computeAgreed(state.hint, actualMode),
  };
}

// ─── Option-pick continuation evidence (F3, ported from OrchestratorPrompt) ──
//
// The single-authority consolidation (clause E) rehomes OrchestratorPrompt's
// isOptionPickContinuation as an INPUT to classifyPrompt: IntentRetrieval
// computes it (it already receives transcript_path) and passes it as
// opts.continuationEvidence so the F3 up-route survives — silence-degrading
// otherwise per A.6 honest-residual. Logic is ported verbatim from
// OrchestratorPrompt.hook.ts:124-157 (2026-05-07 retrospective, ROOT-CAUSE
// LAYER 3): a single-letter answer to a prior turn that offered (a)/(b)
// options is multi-step ALGORITHM-grade work the bare-prompt classifier
// cannot see.

/**
 * True when `prompt` is a single-letter option pick AND the last assistant
 * message in the transcript offered at least an (a) and (b) option. Read-only,
 * fast (last 30 jsonl lines). Returns false on any read/parse failure.
 */
export function isOptionPickContinuation(prompt: string, transcriptPath?: string): boolean {
  const trimmed = prompt.trim();
  // Single-letter, "letter.", "letter. <word>", or "(letter)" — option-pick patterns.
  const isOptionAnswer =
    /^[a-d](\.|\s|$)/i.test(trimmed) ||
    /^\([a-d]\)/i.test(trimmed) ||
    /^[a-d]\.\s+\w/i.test(trimmed);
  if (!isOptionAnswer) return false;
  if (!transcriptPath || !existsSync(transcriptPath)) return false;

  try {
    const tail = readFileSync(transcriptPath, 'utf-8').trim().split('\n').slice(-30);
    let lastAssistantText: string | null = null;
    for (let i = tail.length - 1; i >= 0; i--) {
      try {
        const msg = JSON.parse(tail[i]!);
        const role = msg.type ?? msg.role;
        if (role === 'assistant' || role === 'model') {
          lastAssistantText = JSON.stringify(msg);
          break;
        }
      } catch {
        /* ignore non-JSON lines */
      }
    }
    if (!lastAssistantText) return false;
    const hasA = /\(a\)/i.test(lastAssistantText);
    const hasB = /\(b\)/i.test(lastAssistantText);
    return hasA && hasB;
  } catch {
    return false;
  }
}
