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
 * MODES (env: DOS_LIFT_VERIFIER_AGENT_MODE):
 *   shadow  (DEFAULT) — log spawn-intent to MEMORY/STATE/verifier-agent-shadow.jsonl,
 *                       do NOT actually spawn. Operator reviews log to
 *                       confirm the hook would fire on right turns before
 *                       paying the per-turn LLM cost.
 *   enforce            — spawn the Verifier subprocess detached.
 *   disabled           — full bypass (no log, no spawn).
 *
 * Kill switch: DOS_LIFT_VERIFIER_AGENT_DISABLED=1.
 *
 * SPAWN LOG: every spawn writes a one-line entry to
 *   MEMORY/STATE/verifier-agent-spawn.log
 *   carrying PID + report_path + spawn timestamp for later debugging.
 *
 * Coupling:
 *   • Spec: RFC-0069
 *   • Agent: ~/.claude/agents/Verifier.md (ISC-6.2, shipped)
 *   • Consumer: UserPromptSubmit feedback-loop hook (ISC-6.4, deferred)
 *   • Sentinel R-rule for report presence: deferred per RFC-0069 §10 D7
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
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
const stateDir = join(homedir(), '.claude', 'MEMORY', 'STATE');

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
const summary = {
  timestamp: new Date().toISOString(),
  session_id: sessionId,
  transcript_path: transcriptPath,
  stop_hook_active: stopHookActive,
  message_chars: lastMessage.length,
  report_path: reportPath,
  mode,
  would_spawn: mode === 'enforce',
};
logShadow(summary);

// ─── 6. shadow mode — return without spawning ─────────────────────────────
if (mode !== 'enforce') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 7. enforce mode — spawn detached subprocess ──────────────────────────
try {
  // No `--bare` (it strips custom agents + auth). `--prompt` is invalid — the
  // prompt goes on stdin. Grant Verifier its toolset via --allowedTools (it runs
  // git/jq verification and writes its own JSON report). Recursion is held by the
  // DOS_VERIFIER_SPAWN env guard above, not --bare.
  const child = spawn(
    'claude',
    ['--agent', 'Verifier', '--print', '--allowedTools', 'Bash', 'Read', 'Write', 'Grep', 'Glob'],
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
