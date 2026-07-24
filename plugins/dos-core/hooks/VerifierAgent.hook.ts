#!/usr/bin/env bun
/**
 * VerifierAgent.hook.ts — RFC-0069 ISC-6.3
 *
 * Stop hook that fires the Verifier agent on the just-completed turn.
 * The hook itself does NO inference (latency budget ~100ms per RFC-0069 §10 D1).
 * It computes the report path and spawns a detached `claude --agent Verifier
 * --print --allowedTools <set>` subprocess (prompt fed on stdin), then returns
 * continue:true immediately so the user's next turn is not gated on verification.
 *
 * NOTE: we do NOT use `--bare`. It strips custom agents (`--agent Verifier` ->
 * "agent not found") AND auth ("Not logged in"), so the spawn could never run.
 * `--prompt` is also not a valid claude flag (the prompt goes on stdin). Recursion
 * — the spawned session's own Stop re-firing this hook — is prevented by the
 * DOS_VERIFIER_SPAWN=1 env guard near the top instead of by --bare. The Verifier
 * agent's system prompt (~/.claude/agents/Verifier.md) is the only context it needs.
 *
 * REPORT PATH: ~/.claude/MEMORY/STATE/verifier-reports/{session_id}-{timestamp_ms}.json
 *   timestamp_ms used as a per-turn discriminator (Stop hook input doesn't
 *   carry an explicit turn_n; clock millisecond resolution is sufficient).
 *
 * MODES (env: DOS_LIFT_VERIFIER_AGENT_MODE) — rollout knobs ONLY as of ADR-F001;
 * the spawn decision itself is the claim-risk predicate P(turn) below:
 *   shadow  (DEFAULT) — log P's true output to MEMORY/STATE/verifier-agent-shadow.jsonl
 *                       (would_spawn = P(turn)); do NOT spawn. Calibration data.
 *   enforce            — spawn the Verifier subprocess detached iff P(turn) AND budget.
 *   disabled           — full bypass (no log, no spawn).
 *
 * PREDICATE (ADR-F001, signed 2026-07-22): P = completion-claim AND mutating-tool-use.
 *   • claim: COMPLETION_CLAIM_RE mirrors CompletionEvidence.hook.ts COMPLETION_PATTERNS'
 *     primary class — keep the two in sync.
 *   • mutating-tool-use: Write/Edit/NotebookEdit/Bash tool_use blocks in the
 *     just-completed turn — bounded backward walk over a 256KB tail read.
 *     The turn window ends at the last MAIN-LANE user entry that is not purely
 *     tool_result rows (text, string-content, and image prompts all bound it);
 *     isSidechain (subagent) traffic neither bounds nor counts (JUDGE fold, Gen 175).
 *   • phase (PRD execute/verify): RESERVED input, recorded as null — no ambient
 *     phase source exists at Stop time. v1 is therefore strictly TIGHTER than the
 *     signed fire rule (the phase OR-branch is inert), per Article 2 tightening.
 *
 * BUDGET (enforce only — ADR-F001 ratified defaults): max 2 spawns/session and
 *   20/day; state in MEMORY/STATE/verifier-agent-budget.json; over-budget is a
 *   LOGGED skip (skipped: 'over-budget'), never silent. Soft rail: the
 *   read-modify-write is not lock-guarded — a concurrent-Stop race can overshoot
 *   by one, which is acceptable for a cost rail.
 *
 * Kill switch: DOS_LIFT_VERIFIER_AGENT_DISABLED=1.
 *
 * SPAWN LOG: every spawn writes a one-line entry to
 *   MEMORY/STATE/verifier-agent-spawn.log
 *   carrying PID + report_path + spawn timestamp for later debugging.
 *
 * Coupling:
 *   • Spec: RFC-0069 + ADR: ~/Durante/forge/ADR/ADR-F001-verifier-spawn-predicate.md
 *   • Agent: ~/.claude/agents/Verifier.md (ISC-6.2, shipped)
 *   • Consumer: UserPromptSubmit feedback-loop hook (ISC-6.4, deferred — ADR-F001 Q3)
 *   • Sentinel R-rule for report presence: deferred per RFC-0069 §10 D7
 *   • Test seam: DOS_VERIFIER_STATE_DIR overrides the state dir (telemetry isolation,
 *     DOS_HOOK_IO_STATE_DIR precedent — Forge H-128 lesson).
 */

import {
  existsSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
  writeFileSync,
  openSync,
  fstatSync,
  readSync,
  closeSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput } from './lib/hook-io.ts';
import { loadProjectEnv } from './lib/paths.ts';

loadProjectEnv();

// ─── 0. Read input — fail open on bad pipe ────────────────────────────────
const input = await readHookInput();
if (!input) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const sessionId = input.session_id || 'unknown';
const transcriptPath = (input as { transcript_path?: string }).transcript_path || '';
const stopHookActive = (input as { stop_hook_active?: boolean }).stop_hook_active === true;
const lastMessage = (input as { last_assistant_message?: string }).last_assistant_message || '';

// ─── 1. Mode + disabled flag ──────────────────────────────────────────────
const mode = (process.env.DOS_LIFT_VERIFIER_AGENT_MODE || 'shadow').toLowerCase();
const disabled = process.env.DOS_LIFT_VERIFIER_AGENT_DISABLED === '1';

if (disabled || mode === 'disabled') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 1b. Recursion guard ──────────────────────────────────────────────────
// A spawned Verifier session inherits DOS_VERIFIER_SPAWN=1. We no longer use
// `--bare` (it strips custom agents + auth), so the spawned session's own Stop
// would re-fire this hook — break the loop here instead of via --bare.
// stop_hook_active is the Claude Code built-in re-entrancy signal; belt-and-suspenders.
if (process.env.DOS_VERIFIER_SPAWN === '1' || stopHookActive) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// Declared before the triviality guard so that guard can log its own skip:
// logShadow() closes over stateDir, and reading it earlier would hit the TDZ.
// DOS_VERIFIER_STATE_DIR is the test-isolation seam (never set in production).
const stateDir = process.env.DOS_VERIFIER_STATE_DIR || join(homedir(), '.claude', 'MEMORY', 'STATE');

// ─── 2. Triviality guard — skip if no message text or it's tiny ───────────
// Trivial turns (one-line acknowledgments, MINIMAL mode responses) don't
// produce enough atomic claims to warrant verification cost. Threshold of
// 200 chars roughly matches MINIMAL-mode upper bound.
//
// The skip is LOGGED, not silent. This hook's shadow pilot exists so the
// operator can "review the log to confirm the hook would fire on the right
// turns" — but a skip that leaves no line makes the fire *rate* unknowable,
// and makes an absent `last_assistant_message` (nothing to judge) look exactly
// like a genuinely trivial turn. Both were invisible: 1022 shadow lines on
// disk, every one a fire. (Forge H-094.)
const MIN_MESSAGE_CHARS = 200;
if (!lastMessage || lastMessage.length < MIN_MESSAGE_CHARS) {
  logShadow({
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    transcript_path: transcriptPath,
    stop_hook_active: stopHookActive,
    message_chars: lastMessage.length,
    mode,
    would_spawn: false,
    skipped: lastMessage ? 'trivial' : 'no-message',
  });
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 2b. Claim-risk predicate P(turn) — ADR-F001 ──────────────────────────
// Constants live HERE, before the top-level call below — a bottom-of-file const
// would TDZ inside countMutatingToolUses (the H-124 class).
// COMPLETION_CLAIM_RE mirrors CompletionEvidence.hook.ts COMPLETION_PATTERNS[0].
const COMPLETION_CLAIM_RE =
  /\b(done|complete|completed|verified|shipped|fixed|merged|deployed|landed|ready|working|passing|implemented|refactored|migrated|wired up|ship it|LGTM|all green)\b/i;
const MUTATING_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'Bash']);

// Budget-rail constants must initialize BEFORE the top-level enforce path calls
// consumeBudget below — consts do not hoist past process.exit (the H-124 class).
type BudgetState = { day: string; day_count: number; sessions: Record<string, number> };
const SESSION_SPAWN_CAP = 2; // ADR-F001 ratified defaults ("signed defaults accepted")
const DAILY_SPAWN_CAP = 20; // day boundary is UTC — acceptable skew for a soft cost rail
const TAIL_BYTES = 256 * 1024; // bounded transcript tail — shadow pays this read on every non-trivial Stop

const claimHit = COMPLETION_CLAIM_RE.test(lastMessage);
const mutatingTools = countMutatingToolUses(transcriptPath);
const phase: string | null = null; // reserved input — see header PREDICATE note
const predicateFires = claimHit && (mutatingTools > 0 || phase === 'execute' || phase === 'verify');

// ─── 3. Compute report path ───────────────────────────────────────────────
const reportsDir = join(stateDir, 'verifier-reports');
if (!existsSync(reportsDir)) {
  try {
    mkdirSync(reportsDir, { recursive: true });
  } catch {
    // Best-effort — if we can't create the dir, fall through to continue
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

const tsMs = Date.now();
const reportPath = join(reportsDir, `${sessionId}-${tsMs}.json`);

// ─── 4. Construct the Verifier prompt ─────────────────────────────────────
// The Verifier agent's system prompt (Verifier.md) handles the protocol;
// this prompt only conveys the run-specific inputs.
const verifierPrompt = [
  `Verify the last assistant turn.`,
  ``,
  `transcript_path: ${transcriptPath}`,
  `session_id: ${sessionId}`,
  `turn_n: ${tsMs}`,
  `report_path: ${reportPath}`,
  ``,
  `Read the transcript, find the last assistant message, decompose into atomic claims per the Atomic-Claim Protocol, verify each, and write the structured JSON report to ${reportPath}.`,
  ``,
  `Return when the report file exists and stdout summary is printed.`,
].join('\n');

// ─── 5. Log spawn intent (always — both shadow and enforce) ───────────────
// would_spawn is P(turn)'s TRUE output in BOTH modes (ADR-F001) — the shadow
// log is calibration data, not a mode echo.
const summary = {
  timestamp: new Date().toISOString(),
  session_id: sessionId,
  transcript_path: transcriptPath,
  stop_hook_active: stopHookActive,
  message_chars: lastMessage.length,
  report_path: reportPath,
  mode,
  would_spawn: predicateFires,
  predicate: { claim_hit: claimHit, mutating_tools: mutatingTools, phase },
};
logShadow(summary);

// ─── 6. shadow mode — return without spawning ─────────────────────────────
if (mode !== 'enforce') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 7. enforce mode — spawn iff P(turn) AND budget (ADR-F001) ────────────
if (!predicateFires) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const budget = consumeBudget(sessionId);
if (!budget.ok) {
  logShadow({
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    report_path: reportPath,
    mode,
    would_spawn: true,
    skipped: 'over-budget',
    budget: budget.state,
  });
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

try {
  // No `--bare` (it strips custom agents + auth). `--prompt` is invalid — the
  // prompt goes on stdin. Grant Verifier its toolset via --allowedTools (it runs
  // git/jq verification and writes its own JSON report). Recursion is held by the
  // DOS_VERIFIER_SPAWN env guard above, not --bare.
  // --model is EXPLICIT per MODEL_ROUTING (RFC-0166 §2): the Verifier is a JUDGE leg.
  const child = spawn(
    'claude',
    ['--agent', 'Verifier', '--print', '--model', 'claude-opus-4-8', '--allowedTools', 'Bash', 'Read', 'Write', 'Grep', 'Glob'],
    {
      detached: true,
      stdio: ['pipe', 'ignore', 'ignore'],
      env: { ...process.env, DOS_VERIFIER_SPAWN: '1' },
    },
  );
  child.stdin?.write(verifierPrompt);
  child.stdin?.end();
  child.unref();
  // Spawn log for post-hoc debugging
  appendSpawnLog({
    timestamp: new Date().toISOString(),
    pid: child.pid ?? -1,
    report_path: reportPath,
    session_id: sessionId,
  });
} catch (err) {
  logShadow({ reason: 'spawn-failed', error: String(err), session_id: sessionId, report_path: reportPath });
  // Spawn failure is non-blocking — return continue:true regardless
}

console.log(JSON.stringify({ continue: true }));
process.exit(0);

// ────────────────────────── helpers ───────────────────────────

/**
 * Bounded backward walk over the transcript tail: count mutating tool_use
 * blocks (MUTATING_TOOLS) in the just-completed turn.
 *
 * Boundary rule (JUDGE fold, Gen 175): the turn window ends at the last
 * MAIN-LANE user entry that is not purely tool_result rows — text blocks,
 * plain-string content, and image-only prompts all bound it. tool_result-only
 * user rows continue the walk. isSidechain (subagent) entries neither bound
 * nor count: a Task fan-out's synthetic prompts must not mask main-turn
 * mutations, and its own tool use is not this turn's.
 *
 * I/O is bounded: 256KB tail read (readTailLines), never the whole file.
 * Fail-quiet: unreadable/absent transcript counts 0, so P degrades to no-fire
 * (the tighter direction).
 */
function countMutatingToolUses(path: string): number {
  if (!path || !existsSync(path)) return 0;
  try {
    const tail = readTailLines(path, TAIL_BYTES).slice(-400);
    let count = 0;
    for (let i = tail.length - 1; i >= 0; i--) {
      const line = tail[i];
      if (!line || !line.trim()) continue;
      let entry: { type?: string; isSidechain?: boolean; message?: { content?: unknown } };
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry?.isSidechain === true) continue;
      const content = entry?.message?.content;
      if (entry?.type === 'user') {
        const isGenuinePrompt =
          typeof content === 'string'
            ? true
            : Array.isArray(content)
              ? content.some((b) => (b as { type?: string })?.type !== 'tool_result')
              : false;
        if (isGenuinePrompt) break;
        continue;
      }
      if (entry?.type !== 'assistant' || !Array.isArray(content)) continue;
      for (const block of content) {
        const b = block as { type?: string; name?: string };
        if (b?.type === 'tool_use' && MUTATING_TOOLS.has(String(b.name))) count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Read at most maxBytes from the END of the file and return its lines.
 * A partial first line (byte-offset landing mid-line / mid-multibyte-char)
 * is dropped. Keeps per-Stop I/O bounded regardless of transcript size.
 */
function readTailLines(path: string, maxBytes: number): string[] {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    if (size === 0) return [];
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    let text = buf.toString('utf8');
    if (len < size) {
      const nl = text.indexOf('\n');
      text = nl >= 0 ? text.slice(nl + 1) : '';
    }
    return text.split('\n');
  } finally {
    closeSync(fd);
  }
}

/**
 * Soft cost rail (ADR-F001): consume one spawn slot or refuse. Day rollover
 * resets state. A corrupt state file resets to a fresh day (worst case the
 * caps re-run once — acceptable for a soft rail; never blocks the hook).
 */
function consumeBudget(sid: string): { ok: boolean; state: BudgetState } {
  const path = join(stateDir, 'verifier-agent-budget.json');
  const today = new Date().toISOString().slice(0, 10);
  let state: BudgetState = { day: today, day_count: 0, sessions: {} };
  try {
    if (existsSync(path)) {
      const read = JSON.parse(readFileSync(path, 'utf8')) as BudgetState;
      if (read?.day === today) {
        state = { day: today, day_count: read.day_count || 0, sessions: read.sessions || {} };
      }
    }
  } catch {
    // corrupt state file → fresh day (documented fail direction)
  }
  const used = state.sessions[sid] || 0;
  if (used >= SESSION_SPAWN_CAP || state.day_count >= DAILY_SPAWN_CAP) {
    return { ok: false, state };
  }
  state.sessions[sid] = used + 1;
  state.day_count += 1;
  try {
    writeFileSync(path, JSON.stringify(state));
  } catch {
    // best-effort
  }
  return { ok: true, state };
}

function logShadow(entry: Record<string, unknown>): void {
  try {
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    const path = join(stateDir, 'verifier-agent-shadow.jsonl');
    appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Best-effort
  }
}

function appendSpawnLog(entry: Record<string, unknown>): void {
  try {
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    const path = join(stateDir, 'verifier-agent-spawn.log');
    appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Best-effort
  }
}
