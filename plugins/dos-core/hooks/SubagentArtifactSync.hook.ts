#!/usr/bin/env bun
/**
 * SubagentArtifactSync.hook.ts — SessionEnd sync (v0.0.10).
 *
 * Closes the gap traced 2026-05-07 (operator-flagged): subagent task
 * transcripts were leaking citation through `/private/tmp/claude-501/.../tasks/
 * {agent-id}.output` symlinks instead of landing in the project's
 * MEMORY/ARTIFACTS/ cascade. Those symlinks point to Claude Code's canonical
 * storage at ~/.claude/projects/{encoded}/{session_id}/subagents/agent-*.jsonl.
 *
 * This hook walks that source dir at SessionEnd and copies (idempotent) into
 * the project-eligible MEMORY/ARTIFACTS/agent-tasks/{session_id}/ via the
 * standard getMemorySubdir cascade (project → cwd → ~/.claude global).
 *
 * Why this matters:
 *   (a) /private/tmp/.../tasks/{id}.output is ephemeral — runtime cleanup
 *       can delete the symlinks
 *   (b) ~/.claude/projects/{encoded}/.../subagents/ is host-specific and
 *       under the maintainer symlink-mode pattern lives inside the active
 *       submodule worktree (subject to projects/ gitignore)
 *   (c) MEMORY/ARTIFACTS/agent-tasks/ is the right cascade home —
 *       project-eligible, Studio-syncable (SaveArtifactsToStudio /
 *       SaveInnerArtifactsToStudio pick it up), and outlives any single
 *       runtime install
 *
 * Trigger: SessionEnd. Idempotent (skips files already present at dest with
 * matching size). Best-effort (never blocks teardown).
 *
 * NOT a CC-runtime redirect — Claude Code still writes to its canonical path;
 * we just ensure the durable copy lands where DOS doctrine says it should.
 */

import { existsSync, readdirSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readHookInput, startTimer, stopTimer } from './lib/hook-io';
import { getMemorySubdir, loadProjectEnv } from './lib/paths';

loadProjectEnv();

function encodedPathFor(projectDir: string): string {
  // Claude Code path encoding: replace `/` AND `.` with `-`, drop leading slash.
  // Dots matter: a session rooted at the release submodule
  // (`.../Releases/v0.0.21/.claude` — the documented maintainer workflow) encodes
  // to `-Users-...-Releases-v0-0-21--claude`. Reproducing only the slash rule
  // yielded a directory that never exists, so the hook exited with zero copies
  // and no log — subagent transcripts were never durably archived (Forge H-088).
  return '-' + projectDir.replace(/^\//, '').replace(/[/.]/g, '-');
}

async function main(): Promise<void> {
  const input = await readHookInput();
  if (!input) {
    process.exit(0);
  }
  const sessionId = (input as { session_id?: string }).session_id;
  if (!sessionId) {
    process.exit(0);
  }

  const projectDir =
    process.env.CLAUDE_PROJECT_DIR ??
    (input as { project_dir?: string; cwd?: string }).project_dir ??
    (input as { cwd?: string }).cwd ??
    process.cwd();
  const encoded = encodedPathFor(projectDir);

  const sourceDir = join(homedir(), '.claude', 'projects', encoded, sessionId, 'subagents');
  if (!existsSync(sourceDir)) {
    process.exit(0);
  }

  const artifactsDir = getMemorySubdir('ARTIFACTS');
  const destDir = join(artifactsDir, 'agent-tasks', sessionId);
  try {
    mkdirSync(destDir, { recursive: true });
  } catch {
    process.exit(0);
  }

  let copied = 0;
  let skipped = 0;

  try {
    const entries = readdirSync(sourceDir);
    for (const entry of entries) {
      if (!entry.startsWith('agent-')) continue;
      if (!entry.endsWith('.jsonl') && !entry.endsWith('.meta.json')) continue;
      const src = join(sourceDir, entry);
      const dst = join(destDir, entry);
      try {
        if (existsSync(dst)) {
          const srcStat = statSync(src);
          const dstStat = statSync(dst);
          if (srcStat.size === dstStat.size) {
            skipped++;
            continue;
          }
        }
        copyFileSync(src, dst);
        copied++;
      } catch {
        // Best-effort per file; continue on individual errors.
      }
    }
  } catch {
    // Best-effort; SessionEnd hooks must not block teardown.
  }

  if (copied > 0 || skipped > 0) {
    console.error(
      `[SubagentArtifactSync] ${copied} new, ${skipped} skipped → ${destDir}`,
    );
  }

  process.exit(0);
}

const _t = startTimer('SubagentArtifactSync');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));
main().catch(() => process.exit(0));
