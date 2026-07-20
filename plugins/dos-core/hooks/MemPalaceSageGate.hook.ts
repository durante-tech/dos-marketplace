#!/usr/bin/env bun
/**
 * MemPalaceSageGate.hook.ts — auto-fire MemPalaceSage on a PalaceAudit critical-FAIL.
 *
 * PostToolUse(Bash) hook. Watches for `dos-memory-audit.ts` (PalaceAudit) runs
 * and, when the audit rolls up to a CRITICAL verdict, spawns the MemPalaceSage
 * diagnostician to root-cause the signal and PRESCRIBE the recovery rung. The
 * hook itself does NO inference (fast early-exit on any non-audit Bash call).
 *
 * "PalaceAudit CRITICAL" — the audit's verdict enum is PASS/WARN/FAIL (exit
 * 0/1/2); "critical" is a gate SEVERITY, not a verdict. The operator's
 * "auto-fire on CRITICAL" maps to: verdict === "FAIL" driven by a
 * critical-severity gate (rollup() exit 2, criticalFails.length > 0). We detect
 * that from the audit's --json AuditReport when present, else from the human
 * "🔴 VERDICT: FAIL" marker. See dos-memory-audit.ts rollup().
 *
 * SPAWN: detached `claude --agent MemPalaceSage --print --allowedTools
 * <read-only set>` with the prompt on stdin, and stdout redirected at the OS
 * level into the report file — so the Sage stays strictly READ-ONLY (it owns no
 * Write tool; --allowedTools grants only read tools; its printed prescription is
 * captured by the OS redirect, not by a tool write). NOTE: we do NOT use
 * `--bare` — it strips custom agents from ~/.claude/agents/, so `--agent
 * MemPalaceSage` would resolve to "agent not found". Recursion (the Sage runs
 * the audit, which re-enters this gate) is instead prevented by the
 * DOS_MEMPALACE_SAGE_SPAWN=1 env guard at the top of this hook.
 *
 * MODES (env DOS_MEMPALACE_SAGE_GATE_MODE):
 *   shadow  (DEFAULT) — log would-fire intent to
 *                       MEMORY/STATE/mempalace-sage-gate-shadow.jsonl; do NOT
 *                       spawn. Lets the operator confirm the gate fires on the
 *                       right verdicts (and that dos-memory-audit.ts's contract
 *                       is stable — it shipped 2026-06-29) before paying the
 *                       per-fire LLM cost or coupling a reasoning agent to a
 *                       deterministic freeze gate.
 *   enforce            — spawn the MemPalaceSage subprocess detached.
 *   disabled           — full bypass (no log, no spawn).
 * Kill switch: DOS_MEMPALACE_SAGE_GATE_DISABLED=1.
 *
 * REPORT: MEMORY/STATE/mempalace-sage-reports/{session_id}-{ts}.txt
 * SPAWN LOG: MEMORY/STATE/mempalace-sage-gate-spawn.log
 *
 * Coupling:
 *   • Agent: ~/.claude/agents/MemPalaceSage.md
 *   • Source verdict: ~/Durante/Packs/mem-palace/src/Tools/dos-memory-audit.ts (PalaceAudit v1)
 *   • Precedent: VerifierAgent.hook.ts (Stop-hook spawn pattern, shadow-default)
 */

import { existsSync, mkdirSync, appendFileSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput } from './lib/hook-io.ts';
import { loadProjectEnv } from './lib/paths.ts';

loadProjectEnv();

const cont = () => {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
};

// ─── 0. Read input — fail open ────────────────────────────────────────────
const input = await readHookInput();
if (!input) cont();

// Defense in depth: a Sage spawn runs --bare (hooks skipped) but never re-fire.
if (process.env.DOS_MEMPALACE_SAGE_SPAWN === '1') cont();

const i = input as {
  session_id?: string;
  tool_name?: string;
  tool_input?: { command?: string };
  tool_response?: unknown;
};

// ─── 1. Fast guard — only act on a PalaceAudit Bash run ───────────────────
const command = i.tool_input?.command ?? '';
if (i.tool_name !== 'Bash' || !command.includes('dos-memory-audit')) cont();

// ─── 2. Mode + kill switch ────────────────────────────────────────────────
const mode = (process.env.DOS_MEMPALACE_SAGE_GATE_MODE || 'shadow').toLowerCase();
const disabled = process.env.DOS_MEMPALACE_SAGE_GATE_DISABLED === '1';
if (disabled || mode === 'disabled') cont();

// ─── 3. Extract the audit output text ─────────────────────────────────────
const resp = i.tool_response;
const outText =
  typeof resp === 'string'
    ? resp
    : resp && typeof resp === 'object'
      ? [(resp as { stdout?: string }).stdout, (resp as { stderr?: string }).stderr]
          .filter(Boolean)
          .join('\n') || JSON.stringify(resp)
      : '';

// ─── 4. Detect a critical-FAIL verdict (the stable contract) ──────────────
const verdict = detectCriticalFail(outText, command);
if (!verdict.critical) cont();

// ─── 5. Paths ─────────────────────────────────────────────────────────────
const sessionId = i.session_id || 'unknown';
const stateDir = join(homedir(), '.claude', 'MEMORY', 'STATE');
const reportsDir = join(stateDir, 'mempalace-sage-reports');
try {
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
} catch {
  cont();
}
const tsMs = Date.now();
const reportPath = join(reportsDir, `${sessionId}-${tsMs}.txt`);

// ─── 6. Log intent (both shadow and enforce) ──────────────────────────────
logShadow({
  timestamp: new Date().toISOString(),
  session_id: sessionId,
  verdict: verdict.verdict,
  detector: verdict.via,
  report_path: reportPath,
  mode,
  would_spawn: mode === 'enforce',
});

// ─── 7. shadow mode — log only ────────────────────────────────────────────
if (mode !== 'enforce') cont();

// ─── 8. enforce mode — spawn the Sage, OS-redirect stdout → report ────────
const sagePrompt = [
  `trigger: palace-audit-critical`,
  `signal: A PalaceAudit run rolled up to a critical-FAIL verdict (${verdict.verdict}, detected via ${verdict.via}).`,
  `audit_command: ${command}`,
  ``,
  `Do NOT trust this one signal. Run a fresh \`bun ~/Durante/Packs/mem-palace/src/Tools/dos-memory-audit.ts --json\`,`,
  `cross-check the radiator (\`dos-memory-status.ts --json\`), \`lsof\` the daemon socket, and a live read before any verdict.`,
  `Root-cause whether this is real HNSW divergence / active corruption or a benign probe-timeout false-green.`,
  `Then PRINT (to stdout — you have no Write tool, the gate captures your stdout) your VERDICT / EVIDENCE / ROOT CAUSE / PRESCRIPTION / DO-NOT block.`,
  `Prescribe the specific Doctor rung + the don't-make-it-worse constraint. Do NOT execute any repair.`,
].join('\n');

// Least-privilege grant for the detached headless Sage: it has no TTY to
// answer prompts, so without an explicit allowlist every tool is denied and it
// can do nothing. Grant ONLY its read-only diagnosis tools — NOT
// --dangerously-skip-permissions / bypassPermissions, which would dissolve the
// read-only fence at runtime. Under --bare MCP is not loaded, so the working
// read-only surface is the Bash-based readers (radiator / audit / lsof) +
// Read/Grep/Glob; that is sufficient to root-cause a PalaceAudit critical-FAIL.
// Everything else (Write/Edit/rm/bridge-write) stays denied by omission.
const SAGE_ALLOWED_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'Bash(lsof:*)',
  'Bash(bun ~/Durante/Packs/mem-palace/src/Tools/dos-memory-status.ts:*)',
  'Bash(bun ~/Durante/Packs/mem-palace/src/Tools/dos-memory-audit.ts:*)',
  // Scoped READ-ONLY bridge actions for cross-process confirmation (the smoke
  // test leaned on these): a ranked live `search` and a `status` drawer-count
  // that agree across processes are what distinguish a real outage from a
  // probe-timeout false-green. Subcommand-scoped so write actions
  // (add_drawer/delete/kg_add/...) stay denied by omission.
  'Bash(python3 ~/.claude/DOS/Tools/mempalace_bridge.py status:*)',
  'Bash(python3 ~/.claude/DOS/Tools/mempalace_bridge.py search:*)',
  'Bash(python3 ~/.claude/DOS/Tools/mempalace_bridge.py kg_stats:*)',
];

try {
  const outFd = openSync(reportPath, 'w');
  const child = spawn(
    'claude',
    ['--agent', 'MemPalaceSage', '--print', '--allowedTools', ...SAGE_ALLOWED_TOOLS],
    {
      detached: true,
      stdio: ['pipe', outFd, outFd],
      env: { ...process.env, DOS_MEMPALACE_SAGE_SPAWN: '1' },
    },
  );
  // `claude --print` reads the prompt from stdin. `--prompt` is NOT a valid flag
  // (the CLI rejects it), and a positional prompt would be swallowed by the
  // `--allowedTools` variadic — so feed it via stdin, then detach.
  child.stdin?.write(sagePrompt);
  child.stdin?.end();
  child.unref();
  appendSpawnLog({
    timestamp: new Date().toISOString(),
    pid: child.pid ?? -1,
    report_path: reportPath,
    session_id: sessionId,
    verdict: verdict.verdict,
  });
} catch (err) {
  logShadow({ reason: 'spawn-failed', error: String(err), session_id: sessionId, report_path: reportPath });
}

cont();

// ────────────────────────── helpers ───────────────────────────

function detectCriticalFail(
  text: string,
  cmd: string,
): { critical: boolean; verdict: string; via: string } {
  // Preferred: parse the --json AuditReport — authoritative + severity-aware.
  if (cmd.includes('--json')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const r = JSON.parse(text.slice(start, end + 1)) as {
          verdict?: string;
          gates?: Array<{ severity?: string; status?: string }>;
        };
        // Mirror dos-memory-audit rollup()'s FAIL contract exactly. The audit emits
        // verdict FAIL when a FAILED gate is critical-severity, OR high-severity, OR in
        // status 'error' (a host-induced error is reclassified critical — RedTeam R7):
        //   if (criticalFails.length || failed.some(g => g.severity === 'high')) => FAIL
        //   where criticalFails = failed.filter(g => g.severity === 'critical' || g.status === 'error')
        // The prior predicate required g.severity === 'critical' specifically, so a
        // high-only or error-only FAIL — a genuine FAIL the audit treats as critical-grade,
        // and one the text-marker fallback below WOULD fire on — returned critical:false and
        // skipped even the shadow-mode log, undercounting the exact validation data the
        // operator needs before flipping this gate to enforce mode. (Forge H-123.)
        const criticalGate = (r.gates ?? []).some((g) => {
          const gateFailed = g.status === 'fail' || g.status === 'error';
          return gateFailed && (g.severity === 'critical' || g.severity === 'high' || g.status === 'error');
        });
        if (r.verdict === 'FAIL' && criticalGate) {
          return { critical: true, verdict: 'FAIL', via: 'json:critical-gate' };
        }
        return { critical: false, verdict: r.verdict ?? 'unknown', via: 'json' };
      } catch {
        /* fall through to text scan */
      }
    }
  }
  // Fallback: human radiator marker. A FAIL verdict is only emitted when
  // rollup() saw a critical (or high) failing gate, so FAIL is the trigger.
  if (/(?:🔴\s*)?VERDICT:\s*FAIL/i.test(text)) {
    return { critical: true, verdict: 'FAIL', via: 'text:verdict-marker' };
  }
  return { critical: false, verdict: 'none', via: 'no-match' };
}

function logShadow(entry: Record<string, unknown>): void {
  try {
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    appendFileSync(join(stateDir, 'mempalace-sage-gate-shadow.jsonl'), JSON.stringify(entry) + '\n');
  } catch {
    /* best-effort */
  }
}

function appendSpawnLog(entry: Record<string, unknown>): void {
  try {
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    appendFileSync(join(stateDir, 'mempalace-sage-gate-spawn.log'), JSON.stringify(entry) + '\n');
  } catch {
    /* best-effort */
  }
}
