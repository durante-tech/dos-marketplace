#!/usr/bin/env bun
/**
 * BashAllowlistGuard.hook.ts — RFC-0068 ISC-3
 *
 * PreToolUse PER-SUBAGENT Bash command gating.
 *
 * Closes the highest-severity gap in agent infrastructure (per RFC-0068):
 * subagents spawned via Task / Agent tool inherit the parent session's full
 * Bash capability. There's no mechanism to restrict a research agent (like
 * Explore) from running mutating commands or destructive operations. This
 * hook fills that gap with a per-agent-type allowlist/denylist.
 *
 * SCOPE:
 *   • Fires only on tool_name === 'Bash'
 *   • Fires only when agent_id is present (subagent context). Main thread
 *     keeps full Bash access — backward compatible.
 *   • Reads ~/.claude/agent-bash-policy.json. Missing file = permit-all.
 *   • Per-agent-type policy lookup, falls back to default, falls back to
 *     permit-all if neither defined.
 *
 * MODES (env: DOS_LIFT_BASH_ALLOWLIST_GUARD_MODE):
 *   shadow  (DEFAULT) — log every decision (allow + deny) to
 *                       MEMORY/STATE/bash-allowlist-guard-shadow.jsonl,
 *                       always continue:true. Operator reviews before
 *                       promoting to enforce.
 *   enforce            — log + emit permissionDecision: "deny" with a
 *                        clear reason when policy denies the command.
 *   disabled           — full bypass.
 *
 * Kill switch: DOS_LIFT_BASH_ALLOWLIST_GUARD_DISABLED=1.
 *
 * POLICY SCHEMA (agent-bash-policy.json):
 *   {
 *     "version": "1.0",
 *     "default": { "mode": "permit-all" },
 *     "agents": {
 *       "<agent-type>": {
 *         "mode": "permit-all" | "deny-all" | "allowlist" | "denylist",
 *         "allow": [ "<regex>", ... ],   // for allowlist mode
 *         "deny":  [ "<regex>", ... ]    // for denylist mode
 *       }
 *     }
 *   }
 *
 *   Patterns are JS regex literals (without delimiters) tested against the
 *   raw command string. Lookup order: agents[agent_type] → default →
 *   permit-all. agent_id can also key agents[] for one-off overrides.
 *
 * Anti-criteria preserved (RFC-0068 ISC-22):
 *   - No inference / LLM calls — regex catalog only
 *   - No modifications to existing PreToolUse hooks (additive matcher)
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'node:fs';
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

const toolName = (input as { tool_name?: string }).tool_name || '';
const toolInput = (input as { tool_input?: Record<string, unknown> }).tool_input || {};
const agentId = (input as { agent_id?: string }).agent_id;
const agentType = (input as { agent_type?: string }).agent_type;
const sessionId = input.session_id || 'unknown';

// ─── 1. Tool guard — Bash only ────────────────────────────────────────────
if (toolName !== 'Bash') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 2. Subagent guard — main thread bypasses ─────────────────────────────
// agent_id present iff this hook fires from within a subagent (per binary's
// bY schema: "Subagent identifier. Present only when the hook fires from
// within a subagent... Absent for the main thread, even in --agent sessions").
if (!agentId) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 3. Mode + disabled flag ──────────────────────────────────────────────
const mode = (process.env.DOS_LIFT_BASH_ALLOWLIST_GUARD_MODE || 'shadow').toLowerCase();
const disabled = process.env.DOS_LIFT_BASH_ALLOWLIST_GUARD_DISABLED === '1';

if (disabled || mode === 'disabled') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 4. Load policy file (missing = permit-all) ───────────────────────────
const policyPath = join(homedir(), '.claude', 'agent-bash-policy.json');
let policy: PolicyShape | null = null;

if (existsSync(policyPath)) {
  try {
    policy = JSON.parse(readFileSync(policyPath, 'utf-8')) as PolicyShape;
  } catch (err) {
    logShadow({ reason: 'policy-parse-failed', error: String(err), agent_id: agentId, agent_type: agentType });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

// ─── 5. Resolve agent policy (lookup chain) ───────────────────────────────
const agentPolicy: AgentPolicy = (() => {
  if (!policy) return { mode: 'permit-all' };
  const byType = agentType ? policy.agents?.[agentType] : undefined;
  const byId = policy.agents?.[agentId];
  return byType || byId || policy.default || { mode: 'permit-all' };
})();

// ─── 6. Apply mode logic ──────────────────────────────────────────────────
const command = String(toolInput.command || '');
let decision: 'allow' | 'deny' = 'allow';
let matchedPattern: string | null = null;

switch (agentPolicy.mode) {
  case 'permit-all':
    decision = 'allow';
    break;
  case 'deny-all':
    decision = 'deny';
    matchedPattern = '<deny-all mode>';
    break;
  case 'allowlist': {
    const matched = (agentPolicy.allow || []).find((p) => safeRegexTest(p, command));
    decision = matched ? 'allow' : 'deny';
    matchedPattern = matched ?? '<no allowlist match>';
    break;
  }
  case 'denylist': {
    const matched = (agentPolicy.deny || []).find((p) => safeRegexTest(p, command));
    decision = matched ? 'deny' : 'allow';
    matchedPattern = matched ?? null;
    break;
  }
  default:
    // Unknown mode → permit-all + log
    decision = 'allow';
    matchedPattern = `<unknown mode: ${agentPolicy.mode}>`;
}

// ─── 7. Log + decision emit ───────────────────────────────────────────────
const summary = {
  timestamp: new Date().toISOString(),
  session_id: sessionId,
  agent_id: agentId,
  agent_type: agentType ?? null,
  command: command.slice(0, 200),
  policy_mode: agentPolicy.mode,
  decision,
  matched_pattern: matchedPattern,
  mode,
  would_block: mode === 'enforce' && decision === 'deny',
};
logShadow(summary);

if (mode === 'enforce' && decision === 'deny') {
  const subject = agentType ? `agent type '${agentType}'` : `agent id '${agentId}'`;
  const reason = `BashAllowlistGuard: ${subject} policy mode '${agentPolicy.mode}' denies this command.`
    + (matchedPattern && agentPolicy.mode === 'denylist' ? ` Matched pattern: ${matchedPattern}.` : '')
    + ` Override: edit ~/.claude/agent-bash-policy.json or set DOS_LIFT_BASH_ALLOWLIST_GUARD_DISABLED=1 (operator escape hatch).`;
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

// shadow OR allow
console.log(JSON.stringify({ continue: true }));
process.exit(0);

// ────────────────────────── helpers ───────────────────────────

interface AgentPolicy {
  mode: 'permit-all' | 'deny-all' | 'allowlist' | 'denylist' | string;
  allow?: string[];
  deny?: string[];
}

interface PolicyShape {
  version?: string;
  default?: AgentPolicy;
  agents?: Record<string, AgentPolicy>;
}

function safeRegexTest(pattern: string, target: string): boolean {
  try {
    return new RegExp(pattern).test(target);
  } catch {
    return false;
  }
}

function logShadow(entry: Record<string, unknown>): void {
  try {
    const stateDir = join(homedir(), '.claude', 'MEMORY', 'STATE');
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    const path = join(stateDir, 'bash-allowlist-guard-shadow.jsonl');
    appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Best-effort
  }
}
