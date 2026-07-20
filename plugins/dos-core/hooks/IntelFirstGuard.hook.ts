#!/usr/bin/env bun
/**
 * IntelFirstGuard.hook.ts — PreToolUse mechanical enforcement of the
 * Algorithm OBSERVE rule INTEL-FIRST (Sentinel R14).
 *
 * AUGMENTS Bash / Grep / WebFetch / WebSearch / mempalace MCP tool calls
 * with intel-context.ts output when:
 *   (a) tool args contain an entity-like pattern (proper-noun pair, email,
 *       or external domain), AND
 *   (b) `intel-context.ts` has NOT been invoked yet in this session.
 *
 * Auto-runs `intel-context.ts <matched-entity> --format json`, parses
 * the `summary_md` field, and returns `{hookSpecificOutput:
 * {hookEventName: "PreToolUse", permissionDecision: "allow",
 * additionalContext}}` so the model sees the intel pre-flight result
 * inline with its original tool call's context — no deny+retry round-trip.
 *
 * This is the canonical Anthropic PreToolUse + additionalContext pattern
 * (verified 2026-05-06 via claude-code-guide agent). Replaces the prior
 * deny+retry design which forced the AI to read the deny message, run
 * intel-context.ts, and recompose the original call (~5-10s of avoidable
 * round-trip latency per first-touch entity).
 *
 * State: MEMORY/STATE/intel-context-fired/{session_id}.json. Project-aware
 * via $CLAUDE_PROJECT_DIR convention; falls back to ~/.claude/. State is
 * recorded ONLY on successful intel-context run; transient failures
 * leave the session un-fired so the next entity-touching call re-attempts.
 *
 * Bypass paths (in order):
 *   1. tool not in guarded set → pass
 *   2. Bash command IS intel-context.ts → record fired + pass
 *   3. fired state exists for this session → pass
 *   4. env IGNORE_INTEL_FIRST=1 → pass (operator escape hatch)
 *   5. tool_input has no entity pattern → pass
 *   6. otherwise → AUTO-RUN intel-context + ALLOW with additionalContext
 *
 * Failure mode: fail-open. If intel-context.ts errors, the original tool
 * call still runs (additionalContext explains the failure so the AI knows
 * intel didn't fire). Better to let work proceed than to block on a
 * transient bridge/network failure.
 *
 * Output cap: additionalContext is truncated to ≤9500 chars (Anthropic
 * documented cap is 10K; 500-char safety margin).
 *
 * Coupling:
 *   - Algorithm v0.0.7-enhanced OBSERVE INTEL-FIRST rule (§6.1.a)
 *   - Sentinel R14 (rule presence)
 *   - Tools/intel-context.ts (the CLI being auto-fired)
 *
 * Why mechanical: three text-rule iterations failed to bind the agent
 * (audits 2026-04-29 + 2026-05-03 + 2026-05-03 fresh-session retest).
 * Each time the agent read the rule and did the equivalent ad-hoc
 * (Grep + mempalace MCP + filesystem walk). Tool-layer enforcement is
 * the binding intervention; auto-run+context is the friction-free form
 * of that enforcement.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { readHookInput } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';
import { getPrincipalName } from './lib/identity';

loadProjectEnv();

const input = await readHookInput();
if (!input) {
  // Malformed input — fail open (don't block real work over a bad pipe)
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const sessionId = input.session_id || 'unknown';
const toolName = (input as { tool_name?: string }).tool_name || '';
const toolInput = (input as { tool_input?: Record<string, unknown> }).tool_input || {};

// ─── 1. Tool not in guarded set → pass ───────────────────────────────────
const GUARDED_TOOLS = new Set(['Bash', 'Grep', 'WebFetch', 'WebSearch']);
const isGuarded =
  GUARDED_TOOLS.has(toolName) || toolName.startsWith('mcp__mempalace__');

if (!isGuarded) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// State file resolution (project-aware)
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR;
const STATE_DIR = (() => {
  if (PROJECT_DIR && existsSync(join(PROJECT_DIR, 'MEMORY'))) {
    return join(PROJECT_DIR, 'MEMORY', 'STATE', 'intel-context-fired');
  }
  return join(homedir(), '.claude', 'MEMORY', 'STATE', 'intel-context-fired');
})();
const stateFile = join(STATE_DIR, `${sessionId}.json`);

// ─── 2. Bash invokes intel-context.ts → record fired + pass ──────────────
if (toolName === 'Bash') {
  const cmd = String(toolInput.command || '');
  if (/\bintel-context\.(ts|js)\b/.test(cmd)) {
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(
        stateFile,
        JSON.stringify({ fired: true, at: new Date().toISOString(), cmd }),
      );
    } catch {
      // best-effort; do NOT block on state-write failures
    }
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

// ─── 3. Already fired this session → pass ────────────────────────────────
let fired = false;
try {
  if (existsSync(stateFile)) {
    const parsed = JSON.parse(readFileSync(stateFile, 'utf-8'));
    fired = parsed?.fired === true;
  }
} catch {
  // ignore parse errors — treat as not fired
}
if (fired) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 4. Operator escape hatch ────────────────────────────────────────────
if (process.env.IGNORE_INTEL_FIRST === '1') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 5. Entity pattern detection ─────────────────────────────────────────
// Exclude the agent-authored `description` field: it is Title-Case prose by
// convention ("Create PRD dir and snapshot memory health") and was the source
// of proper-pair false positives that fired a 2-10s intel spawn on benign Bash
// calls. Real entities live in the command/query/url fields, which stay scanned.
const { description: _desc, ...scannedInput } = (toolInput ?? {}) as Record<string, unknown>;
const argsBlob = JSON.stringify(scannedInput);

// Capitalized terms that match proper-noun heuristics but aren't external entities
const INTERNAL_DENYLIST = new Set([
  'DOS', 'Durante', 'Studio', 'MemPalace', 'Sentinel', 'Algorithm', 'Phase',
  'Bridge', 'Workflow', 'Pack', 'Skill', 'Hook', 'Tool', 'Agent', 'Session',
  'TypeScript', 'JavaScript', 'Python', 'Bun', 'Node',
  'README', 'PRD', 'RFC', 'MEMORY', 'USER', 'CLAUDE', 'OBSERVE', 'BUILD',
  'EXECUTE', 'VERIFY', 'LEARN', 'PLAN', 'THINK',
  'Anthropic', 'Claude', 'Code',
]);
// Suppress false positives on principal's own name (settings.principal.name).
INTERNAL_DENYLIST.add(getPrincipalName());

const EMAIL = /[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[A-Za-z.]+/;
const EXTERNAL_DOMAIN = /\b[a-z0-9-]+\.(com|io|ai|co|net|org|tech|app|dev)\b/i;
const PROPER_PAIR = /\b([A-Z][a-zA-Z]{1,}|[A-Z]{2,})\s+([A-Z][a-zA-Z]{1,}|[A-Z]{2,})\b/g;
const BENIGN_DOMAINS = /\b(localhost|example\.com|test\.com|claude\.com|anthropic\.com|github\.com|github\.io)\b/i;

let matched: string | null = null;

// Email is the highest signal of entity research
const emailMatch = argsBlob.match(EMAIL);
if (emailMatch) matched = emailMatch[0];

// External domain (excluding benign ones)
if (!matched) {
  const domainMatch = argsBlob.match(EXTERNAL_DOMAIN);
  if (domainMatch && !BENIGN_DOMAINS.test(domainMatch[0])) {
    matched = domainMatch[0];
  }
}

// Proper-noun pair, with at least one word NOT in the internal denylist
if (!matched) {
  let m: RegExpExecArray | null;
  PROPER_PAIR.lastIndex = 0;
  while ((m = PROPER_PAIR.exec(argsBlob)) !== null) {
    const [, w1, w2] = m;
    if (!INTERNAL_DENYLIST.has(w1) || !INTERNAL_DENYLIST.has(w2)) {
      matched = m[0];
      break;
    }
  }
}

if (!matched) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 6. AUTO-RUN intel-context + ALLOW with additionalContext ───────────
// Canonical Anthropic PreToolUse pattern (replaces prior deny+retry —
// 2026-05-06). additionalContext appears inline with the model's view of
// this turn; no round-trip required.

const ADDITIONAL_CONTEXT_CAP = 9500; // Anthropic doc cap is 10K; 500-char safety margin
const intelTool = join(homedir(), 'Durante', 'Tools', 'intel-context.ts');

let additionalContext: string;
let intelOk = false;

try {
  const result = spawnSync('bun', [intelTool, matched, '--format', 'json'], {
    encoding: 'utf-8',
    timeout: 10_000, // 10s — intel-context budget is 2-4s typical, 1500ms traverse cap
  });
  if (result.status === 0) {
    const stdoutText = typeof result.stdout === 'string'
      ? result.stdout
      : new TextDecoder().decode(result.stdout);
    const parsed = JSON.parse(stdoutText) as {
      summary_md?: string;
      total_hits?: number;
      first_touch?: boolean;
    };
    const summary = parsed.summary_md || `intel-context returned no summary_md for "${matched}"`;
    additionalContext =
      `🔍 INTEL PRE-FLIGHT (auto-fired by IntelFirstGuard for detected entity "${matched}"):\n\n` +
      `${summary}\n\n` +
      `(Source: bun ~/Durante/Tools/intel-context.ts "${matched}" --format json — ` +
      `${parsed.total_hits ?? 0} total hits across 7 surfaces. ` +
      `Subsequent ${toolName} calls in this session will pass through without re-firing intel.)`;
    intelOk = true;

    // Record fired state ONLY on success — transient failures leave session
    // un-fired so the next entity-touching call re-attempts.
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(
        stateFile,
        JSON.stringify({
          fired: true,
          at: new Date().toISOString(),
          cmd: `auto-fired by IntelFirstGuard for entity "${matched}"`,
          via: 'auto-run',
        }),
      );
    } catch {
      // best-effort; do NOT fail the tool call over state-write
    }
  } else {
    const stderrText = typeof result.stderr === 'string'
      ? result.stderr
      : new TextDecoder().decode(result.stderr ?? new Uint8Array());
    additionalContext =
      `⚠️ INTEL-FIRST guard auto-fired intel-context.ts for entity "${matched}" but it exited ${result.status}. ` +
      `Stderr (truncated): ${stderrText.slice(0, 500)}. ` +
      `Proceeding with original ${toolName} call anyway; consider re-running ` +
      `\`bun ~/Durante/Tools/intel-context.ts "${matched}" --format json\` manually if intel context matters.`;
  }
} catch (err) {
  additionalContext =
    `⚠️ INTEL-FIRST guard tried to auto-fire intel-context.ts for entity "${matched}" but spawn failed: ` +
    `${(err as Error).message}. Proceeding with original ${toolName} call anyway (fail-open). ` +
    `Override: set IGNORE_INTEL_FIRST=1 in .env / .gateway.env at project root to silence this guard entirely.`;
}

// Truncate under 10K cap
if (additionalContext.length > ADDITIONAL_CONTEXT_CAP) {
  additionalContext =
    additionalContext.slice(0, ADDITIONAL_CONTEXT_CAP - 100) +
    `\n\n[... truncated; full output exceeded ${ADDITIONAL_CONTEXT_CAP}-char additionalContext cap ...]`;
}

// Audit trail
console.error(
  `[IntelFirstGuard] auto-fired intel-context for "${matched}" — ` +
  `${intelOk ? 'ok' : 'failed (fail-open)'}; ` +
  `additionalContext ${additionalContext.length} chars; tool=${toolName}; session=${sessionId}`,
);

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow',
    additionalContext,
  },
}));
process.exit(0);
