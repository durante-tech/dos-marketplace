#!/usr/bin/env bun
/**
 * WorktreeMemoryWriteGuard.hook.ts — PreToolUse guard against silent MEMORY
 * write-loss inside subagent temporary worktrees.
 *
 * THE SEAM: a `subagent_type:'claude'` agent in a TEMPORARY worktree that writes
 * to a gitignored path loses the write SILENTLY on teardown (Claude Code docs:
 * "Removing deletes the worktree directory… discarding any uncommitted changes,
 * untracked files, and commits"). DOS writes PRDs/reflections to gitignored
 * MEMORY/{WORK,LEARNING,…} by policy [R-memory-gitignore-council]. The write
 * vanishes with no error.
 *
 * BLOCKS (warn by default, exit-2 in enforce mode) when ALL hold:
 *   (1) tool is a write surface — Write / Edit / NotebookEdit, OR Bash with a
 *       redirect/move/copy target under a guarded MEMORY subtree
 *   (2) target resolves under a GITIGNORED MEMORY subtree
 *       (WORK/LEARNING/RESEARCH/ARTIFACTS/SECURITY/STATE/MEMPALACE).
 *       ARCHIVE/ + CANONICAL/ are git-tracked → survive teardown → NOT guarded.
 *   (3) execution context is a SUBAGENT (process.env.CLAUDE_AGENT_TYPE set).
 *       The primary DA carries no agent type → its writes are NEVER blocked.
 *   (4) cwd is inside a worktree (`.claude/worktrees/` or a temp-worktree path).
 *
 * The remedy on block: RETURN the content as the final message; the primary
 * agent persists it from the main checkout.
 *
 * Rollout: WARN-mode is the default (logs to stderr, lets the write through) so
 * the telemetry answers OQ-1/OQ-2 (RFC-0137 §9 — temp-vs-named worktree marker,
 * primary CLAUDE_AGENT_TYPE value) WITHOUT ever blocking real work. Promote to
 * block with DOS_ENFORCEMENT_MODE_WORKTREE_GUARD=block once those are pinned.
 *
 * Override: DOS_ALLOW_WORKTREE_MEMORY_WRITE=1 allows through with a stderr warning.
 *
 * Mirror pattern: RmGuard.hook.ts (PreToolUse, exit-2 block, fail-open on bad
 * input, env override, JSONL telemetry).
 *
 * Spec: RFC-0137. PRD: MEMORY/WORK/active/20260626-011756_worktree-memory-write-guard.
 * Sentinel: R84 (presence.worktree-memory-write-guard).
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';

// ─── Pure decision surface (table-tested in isolation — Feathers gate) ────────

/**
 * Gitignored MEMORY subtrees where a worktree-discarded write is unrecoverable.
 * ARCHIVE + CANONICAL are git-tracked → they commit inside the worktree and
 * survive teardown → deliberately excluded.
 */
export const GUARDED_MEMORY_SUBDIRS = [
  'WORK', 'LEARNING', 'RESEARCH', 'ARTIFACTS', 'SECURITY', 'STATE', 'MEMPALACE',
] as const;

const GUARDED_RE = new RegExp(`(?:^|/)MEMORY/(?:${GUARDED_MEMORY_SUBDIRS.join('|')})(?:/|$)`);
const TRACKED_MEMORY_RE = /(?:^|\/)MEMORY\/(?:ARCHIVE|CANONICAL)(?:\/|$)/;
// Bash redirect (> >>), tee, mv, cp, dd whose argument lands in a guarded subtree.
const BASH_WRITE_RE = new RegExp(
  `(?:>>?|\\btee\\b|\\bmv\\b|\\bcp\\b|\\bdd\\b)[^|;&]*?MEMORY/(?:${GUARDED_MEMORY_SUBDIRS.join('|')})`,
);

export interface WriteGuardCtx {
  toolName: string;
  toolInput: Record<string, unknown>;
  agentType: string | undefined; // process.env.CLAUDE_AGENT_TYPE
  cwd: string;                   // session cwd (payload.cwd ?? process.cwd())
}

export interface WriteGuardDecision {
  action: 'allow' | 'deny';
  target?: string;
  reason?: string;
}

/**
 * Primary DA carries no CLAUDE_AGENT_TYPE. Any non-empty value that is not a
 * known primary sentinel is treated as a subagent. WARN-mode telemetry reveals
 * the real primary value (OQ-2) before enforce-mode ever trusts this predicate.
 */
export function isSubagentContext(agentType: string | undefined): boolean {
  if (!agentType) return false;
  const v = agentType.trim().toLowerCase();
  return v.length > 0 && v !== 'primary' && v !== 'main' && v !== 'da';
}

export function isWorktreeCwd(cwd: string): boolean {
  return cwd.includes('/.claude/worktrees/') || /\/worktrees?\//.test(cwd);
}

const FILE_PATH_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

function writeTarget(toolName: string, ti: Record<string, unknown>): string | null {
  if (FILE_PATH_TOOLS.has(toolName)) {
    return typeof ti.file_path === 'string' ? ti.file_path : null;
  }
  if (toolName === 'NotebookEdit') {
    return typeof ti.notebook_path === 'string' ? ti.notebook_path : null;
  }
  return null;
}

/**
 * Pure predicate: (tool, target, agent_type, cwd) → allow | deny.
 * No I/O, no env reads, no process exit — so the characterization table can
 * exercise every branch without a worktree or a teardown.
 */
export function decideWorktreeMemoryWrite(ctx: WriteGuardCtx): WriteGuardDecision {
  // (3) primary writes are never blocked — the named-worktree carve-out
  if (!isSubagentContext(ctx.agentType)) return { action: 'allow' };
  // (4) only writes from inside a worktree are at risk of discard
  if (!isWorktreeCwd(ctx.cwd)) return { action: 'allow' };

  if (FILE_PATH_TOOLS.has(ctx.toolName) || ctx.toolName === 'NotebookEdit') {
    const target = writeTarget(ctx.toolName, ctx.toolInput);
    if (!target) return { action: 'allow' };
    if (TRACKED_MEMORY_RE.test(target)) return { action: 'allow' }; // ARCHIVE/CANONICAL carve-out
    if (!GUARDED_RE.test(target)) return { action: 'allow' };
    return { action: 'deny', target, reason: `subagent '${ctx.agentType}' ${ctx.toolName} to gitignored MEMORY in worktree` };
  }

  if (ctx.toolName === 'Bash') {
    const cmd = typeof ctx.toolInput.command === 'string' ? ctx.toolInput.command : '';
    if (TRACKED_MEMORY_RE.test(cmd)) return { action: 'allow' };
    if (!BASH_WRITE_RE.test(cmd)) return { action: 'allow' };
    return { action: 'deny', target: cmd, reason: `subagent '${ctx.agentType}' Bash-redirect to gitignored MEMORY in worktree` };
  }

  return { action: 'allow' };
}

export function buildBlockReason(d: WriteGuardDecision): string {
  return `🛑 WorktreeMemoryWriteGuard: a write to a gitignored MEMORY path from inside a
subagent worktree will be SILENTLY DISCARDED when the worktree is torn down.

Target:  ${d.target ?? '(unknown)'}
Why:     ${d.reason ?? ''}

MEMORY/{WORK,LEARNING,RESEARCH,ARTIFACTS,SECURITY,STATE,MEMPALACE} are gitignored.
A temporary subagent worktree is removed on completion — "discarding any
uncommitted changes, untracked files, and commits" (Claude Code docs). Your PRD
or reflection would vanish with no error.

REMEDY: do NOT write this file here. RETURN its full content as your final
message; the primary agent will persist it from the main checkout.

Override (only when you have verified this worktree persists):
  DOS_ALLOW_WORKTREE_MEMORY_WRITE=1

Spec: RFC-0137. This is a hard block in enforce mode; a warning otherwise.`;
}

// ─── Telemetry (mirrors RmGuard.recordBlockedDestructiveAttempt) ──────────────

function recordBlock(target: string | undefined, toolName: string, agentType: string | undefined, mode: 'warn' | 'block'): void {
  try {
    const memHome = process.env.CLAUDE_PROJECT_DIR
      ? join(process.env.CLAUDE_PROJECT_DIR, 'MEMORY')
      : join(homedir(), '.claude', 'MEMORY');
    const path = join(memHome, 'STATE', 'worktree-write-blocks.jsonl');
    mkdirSync(dirname(path), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      session_id: process.env.CLAUDE_SESSION_ID ?? 'session-unknown',
      agent_type: agentType ?? null,
      tool: toolName,
      target: (target ?? '').slice(0, 500),
      mode,
    };
    appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Telemetry is best-effort; never fail the guard over it.
  }
}

// ─── Runtime (guarded so the module is import-safe for the test harness) ──────

if (import.meta.main) {
  try {
    loadProjectEnv();

    const input = await readHookInput();

    // Fail open on malformed input — never block real work over a bad pipe.
    if (!input) {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const toolName = (input as { tool_name?: string }).tool_name || '';
    const toolInput = (input as { tool_input?: Record<string, unknown> }).tool_input || {};
    const cwd = (input as { cwd?: string }).cwd || process.cwd();
    const agentType = process.env.CLAUDE_AGENT_TYPE;

    const decision = decideWorktreeMemoryWrite({ toolName, toolInput, agentType, cwd });

    if (decision.action === 'allow') {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    // Operator override — allow through with a warning.
    if (process.env.DOS_ALLOW_WORKTREE_MEMORY_WRITE === '1') {
      console.error(`[WorktreeMemoryWriteGuard] override active — allowing worktree MEMORY write to ${decision.target}`);
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const enforce = process.env.DOS_ENFORCEMENT_MODE_WORKTREE_GUARD === 'block';
    recordBlock(decision.target, toolName, agentType, enforce ? 'block' : 'warn');

    if (enforce) {
      console.error(buildBlockReason(decision));
      process.exit(2);
    }

    // WARN-mode default: log, but let the write through (instrument OQ-1/OQ-2).
    console.error(`[WorktreeMemoryWriteGuard] WARN (would block in enforce mode): ${decision.reason} → ${decision.target}`);
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  } catch (err) {
    // A guard must never take down a real tool call. Fail open on any error.
    console.error('[WorktreeMemoryWriteGuard] internal error — failing open:', err);
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}
