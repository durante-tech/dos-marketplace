#!/usr/bin/env bun
/**
 * VerifierFeedback.hook.ts — RFC-0069 ISC-6.4
 *
 * UserPromptSubmit hook that closes the auto-feedback loop. Reads the most
 * recent verifier report for the current session and surfaces its
 * `feedback_for_next_run` + summary of `failed` claims as `additionalContext`
 * so the model sees what went wrong on the previous turn before responding
 * to the new prompt.
 *
 * SCOPE (per RFC-0069 §3):
 *   • Reads only THIS session's reports (filename prefix match on session_id).
 *     Cross-session continuity is out of scope for v1.
 *   • Surfaces only the most recent report (latest by filename timestamp suffix).
 *
 * HOOK OUTPUT SHAPE (per binary's UserPromptSubmit response Zod):
 *   {
 *     "hookSpecificOutput": {
 *       "hookEventName": "UserPromptSubmit",
 *       "additionalContext": "<feedback text>"
 *     }
 *   }
 *
 * NO-OP CASES (silent continue:true, no log):
 *   • No reports directory yet
 *   • No reports for this session_id
 *   • Most recent report is corrupt (parse error logged + silent skip)
 *   • Report has empty failed[] AND empty feedback_for_next_run[]
 *
 * MODES (env: DOS_LIFT_VERIFIER_FEEDBACK_DISABLED):
 *   • Default (no env) — surface feedback as additionalContext.
 *   • DOS_LIFT_VERIFIER_FEEDBACK_DISABLED=1 — full bypass.
 *
 *   Two-mode (not three) by design: the hook EITHER surfaces feedback OR
 *   doesn't. A "shadow that hides the surfacing" defeats the loop's purpose.
 *   Operator can review what's being surfaced via the shadow log.
 *
 * SHADOW LOG: every fire writes a one-line entry to
 *   MEMORY/STATE/verifier-feedback-shadow.jsonl
 *   carrying report_path + feedback line count + chars surfaced.
 *
 * Coupling:
 *   • Spec: RFC-0069
 *   • Producer: ~/.claude/hooks/VerifierAgent.hook.ts (ISC-6.3, shipped)
 *   • Agent: ~/.claude/agents/Verifier.md (ISC-6.2, shipped)
 *   • Closes RFC-0069 §9 FeedbackLoop feature
 */

import { existsSync, mkdirSync, appendFileSync, readdirSync, readFileSync } from 'node:fs';
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

// ─── 1. Disabled flag ─────────────────────────────────────────────────────
if (process.env.DOS_LIFT_VERIFIER_FEEDBACK_DISABLED === '1') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 2. Locate reports directory ──────────────────────────────────────────
const stateDir = join(homedir(), '.claude', 'MEMORY', 'STATE');
const reportsDir = join(stateDir, 'verifier-reports');

if (!existsSync(reportsDir)) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 3. Find most recent report for THIS session ──────────────────────────
let reportFiles: string[];
try {
  reportFiles = readdirSync(reportsDir)
    .filter((f) => f.startsWith(`${sessionId}-`) && f.endsWith('.json'))
    .sort()
    .reverse();
} catch {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

if (reportFiles.length === 0) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const latestFile = reportFiles[0];
const latestPath = join(reportsDir, latestFile);

// ─── 4. Parse the report ──────────────────────────────────────────────────
interface ReportShape {
  schema_version?: string;
  failed?: Array<{ claim_text?: string; expected?: string; actual?: string }>;
  feedback_for_next_run?: string[];
  unverified?: Array<{ claim_text?: string }>;
}

let report: ReportShape;
try {
  report = JSON.parse(readFileSync(latestPath, 'utf-8')) as ReportShape;
} catch (err) {
  logShadow({ reason: 'parse-failed', error: String(err), file: latestFile });
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const failed = report.failed ?? [];
const feedback = report.feedback_for_next_run ?? [];

// ─── 5. No-op if nothing to surface ───────────────────────────────────────
if (failed.length === 0 && feedback.length === 0) {
  logShadow({ source_report: latestFile, surfaced: false, reason: 'no-failed-no-feedback', session_id: sessionId });
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 6. Compose additionalContext ─────────────────────────────────────────
const lines: string[] = [];
lines.push(`🔍 Verifier feedback (from ${latestFile}):`);

if (failed.length > 0) {
  lines.push(`Failed claims (${failed.length}):`);
  for (const claim of failed.slice(0, 5)) {
    const text = (claim.claim_text || '').slice(0, 120);
    const expected = (claim.expected || '').slice(0, 80);
    const actual = (claim.actual || '').slice(0, 80);
    lines.push(`  • ${text}`);
    if (expected) lines.push(`      expected: ${expected}`);
    if (actual) lines.push(`      actual:   ${actual}`);
  }
  if (failed.length > 5) lines.push(`  ... +${failed.length - 5} more failed claims`);
}

if (feedback.length > 0) {
  lines.push(`Suggested next-turn corrections:`);
  for (const item of feedback.slice(0, 5)) {
    lines.push(`  • ${item.slice(0, 200)}`);
  }
  if (feedback.length > 5) lines.push(`  ... +${feedback.length - 5} more suggestions`);
}

const additionalContext = lines.join('\n');

// ─── 7. Log + emit ────────────────────────────────────────────────────────
logShadow({
  source_report: latestFile,
  surfaced: true,
  failed_count: failed.length,
  feedback_count: feedback.length,
  context_chars: additionalContext.length,
  session_id: sessionId,
});

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  }),
);
process.exit(0);

// ────────────────────────── helpers ───────────────────────────

function logShadow(entry: Record<string, unknown>): void {
  try {
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    const path = join(stateDir, 'verifier-feedback-shadow.jsonl');
    appendFileSync(path, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // Best-effort
  }
}
