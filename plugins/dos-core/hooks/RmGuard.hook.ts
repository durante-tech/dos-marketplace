#!/usr/bin/env bun
/**
 * RmGuard.hook.ts — PreToolUse hard-block for destructive rm/git-clean
 * commands targeting protected MEMORY paths.
 *
 * HARD BLOCKS (exit 2) when ALL of:
 *   (a) tool is Bash
 *   (b) command matches rm -r?f? or git clean -fd pattern
 *   (c) command targets a protected path:
 *       MEMORY/MEMPALACE, MEMORY/**\/.pending, knowledge_graph.sqlite3, chroma.sqlite3,
 *       Releases/vX.Y.Z/.claude (active or frozen release tree),
 *       ~/.claude (the symlink itself or the resolved target),
 *       Packs/, Plans/, Platform/studio (load-bearing source trees)
 *
 * Override: DOS_ALLOW_MEMORY_RM=1 allows through with a stderr warning.
 *
 * Mirror pattern: IntelFirstGuard.hook.ts (PreToolUse, exit-2 block, env override)
 *
 * Trigger: PreToolUse Bash
 * ISCs: A2.1–A2.4
 */

import { existsSync, statSync, readdirSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';

/**
 * 28D sprint D18 — destructive_attempts_blocked counter.
 * Per indydevdan "DELETE the BASH Tool" video: risk compounds with runtime.
 * Track every blocked destructive command as a leading indicator that
 * SessionAutopsy + dos-memory-status.ts surface. Append to JSONL via
 * O_APPEND atomic write — safe against concurrent hook spawns under the
 * PIPE_BUF size cap (each entry is well under 4KB).
 */
function recordBlockedDestructiveAttempt(cmd: string, reason: string): void {
  try {
    const memHome = process.env.CLAUDE_PROJECT_DIR
      ? join(process.env.CLAUDE_PROJECT_DIR, 'MEMORY')
      : join(homedir(), '.claude', 'MEMORY');
    const path = join(memHome, 'STATE', 'destructive-attempts-blocked.jsonl');
    mkdirSync(dirname(path), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      session_id: process.env.CLAUDE_SESSION_ID ?? 'session-unknown',
      cmd: cmd.slice(0, 500),
      reason: reason.split('\n')[0].slice(0, 200),
    };
    appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Telemetry is best-effort; never fail the block itself.
  }
}

loadProjectEnv();

const input = await readHookInput();

// Fail open on malformed input — never block real work over a bad pipe
if (!input) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const toolName = (input as { tool_name?: string }).tool_name || '';
const toolInput = (input as { tool_input?: Record<string, unknown> }).tool_input || {};

// ISC-A2.1: only guard Bash calls
if (toolName !== 'Bash') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const cmd = String(toolInput.command || '');

// ISC-A2.1: match recursive rm / forced git clean. Both short and long flag
// forms, and flags split across clusters: `rm --recursive --force`,
// `rm -r --force`, `git clean -d --force` all dispatch (Forge H-038 — the
// short-single-cluster-only pattern let every long-form spelling bypass the
// guard). Dispatch-widening is safe: blocking still requires a protected-path
// match below.
const DESTRUCTIVE_PATTERN =
  /\b(rm\s+(?:(?:-[a-zA-Z]+|--[a-z-]+)\s+)*(?:-[a-z]*r|--recursive)|git\s+clean\s+(?:(?:-[a-zA-Z]+|--[a-z-]+)\s+)*(?:-[a-z]*f|--force))/i;

if (!DESTRUCTIVE_PATTERN.test(cmd)) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ISC-A2.2: check if command targets a protected path
const PROTECTED_PATTERNS = [
  // ── MEMORY substrate (original guards) ──
  /MEMORY[\\/]MEMPALACE/i,
  /MEMORY[\\/][^/\s]*[\\/]?\.pending/i,
  /knowledge_graph\.sqlite3/i,
  /chroma\.sqlite3/i,
  /MEMORY[\\/]?\s*$/,
  /MEMORY[\\/]?\*/,
  /git\s+clean\s+-[a-z]*f[a-z]*d[a-z]*X?/i,
  // ── Release trees (added 2026-05-04 after AI-driven release-wipe incident) ──
  // Active or frozen release: Releases/v0.0.5/.claude, Releases/v0.0.6/.claude, etc.
  /Releases[\\/]v\d+\.\d+\.\d+[\\/]?/i,
  // The whole Releases/ tree
  /(?:^|[\s'"])Releases[\\/]?(?:\s|$|['"])/,
  // ── Live Claude Code root (symlink target or direct) ──
  // ~/.claude, $HOME/.claude or /Users/<name>/.claude — the root itself OR any
  // subpath under it. The old boundary (`[\\/]?` then whitespace/EOL/quote)
  // only matched a bare wipe of the root; `rm -rf ~/.claude/hooks` slipped
  // through untouched (Forge H-039).
  /(?:^|[\s'"])(?:~|\$HOME|\/Users\/[^/\s]+)[\\/]\.claude(?:[\\/]|\s|$|['"])/,
  // ── Load-bearing source trees in the parent repo ──
  /(?:^|[\s'"])Packs[\\/]?(?:\s|$|['"])/,
  /(?:^|[\s'"])Plans[\\/]?(?:\s|$|['"])/,
  /(?:^|[\s'"])Platform[\\/]studio[\\/]?/i,
  // ── Whole-repo wipe at the Durante root ──
  /(?:^|[\s'"])(?:~|\$HOME|\/Users\/[^/\s]+)[\\/]Durante[\\/]?(?:\s|$|['"])/,
  // ── Absolute subdirectory paths under the Durante monorepo root ──
  // The bare-relative Packs/ and Plans/ patterns above match only cwd-relative
  // args; an absolute path like ~/Durante/Packs slips between them and the
  // exact-root pattern. This catches rm against anything under ~/Durante/.
  /(?:^|[\s'"])(?:~|\$HOME|\/Users\/[^/\s]+)[\\/]Durante[\\/]\S/,
];

const matched = PROTECTED_PATTERNS.some(p => p.test(cmd));

if (!matched) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ISC-A2.4: operator override — allow with warning
if (process.env.DOS_ALLOW_MEMORY_RM === '1') {
  console.error(
    `[RmGuard] WARNING: DOS_ALLOW_MEMORY_RM=1 override active. ` +
    `Allowing destructive command against protected MEMORY path.\n` +
    `Command: ${cmd}`,
  );
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── ISC-A2.3: Block with explanation ─────────────────────────────────────

function lastBackupAge(): string {
  try {
    const backupRoot = join(
      homedir(),
      'Library',
      'Application Support',
      'DOS',
      'backups',
    );
    if (!existsSync(backupRoot)) return 'never (no backups found)';
    const dirs = readdirSync(backupRoot)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse();
    if (dirs.length === 0) return 'never (no backups found)';
    const manifestPath = join(backupRoot, dirs[0], 'MANIFEST.json');
    if (!existsSync(manifestPath)) return `last dir: ${dirs[0]} (no manifest)`;
    const stat = statSync(manifestPath);
    const ageMs = Date.now() - stat.mtime.getTime();
    const ageHours = Math.round(ageMs / (1000 * 60 * 60));
    const age = ageHours < 24
      ? `${ageHours}h ago`
      : `${Math.round(ageHours / 24)}d ago`;

    // Age alone is a dishonest safety signal. dos-backup.ts writes MANIFEST.json
    // even when a SQLite VACUUM INTO fails — it records the casualties in
    // `failed[]` and only THEN exits 1 — and MemoryBackup.hook.ts spawns it
    // detached with stdio:'ignore', so that exit code is never observed by
    // anyone. Reporting only mtime tells the operator "backed up 0h ago" while
    // the knowledge graph and embeddings, exactly the assets this guard exists
    // to protect, may be absent from that backup. The operator reads this line
    // immediately before deciding whether to set DOS_ALLOW_MEMORY_RM=1.
    let failedCount = 0;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { failed?: unknown[] };
      if (Array.isArray(manifest.failed)) failedCount = manifest.failed.length;
    } catch {
      // Unreadable/torn manifest: fall back to the age-only report rather than
      // failing the guard's message. Never throw from inside a block path.
    }

    return failedCount > 0
      ? `${dirs[0]} (${age}) — INCOMPLETE: ${failedCount} critical file(s) NOT backed up`
      : `${dirs[0]} (${age})`;
  } catch {
    return 'unknown';
  }
}

const backupAge = lastBackupAge();

const reason = `🛑 RmGuard: command targets a protected DOS path.

Command:  ${cmd}

Protected paths (no-delete without override):
  MEMORY substrate:
  • MEMORY/MEMPALACE/       — knowledge graph + ChromaDB (not git-tracked)
  • MEMORY/**/.pending/     — in-flight Studio sync queue
  • knowledge_graph.sqlite3 — all KG triples
  • chroma.sqlite3          — semantic embeddings

  Release trees (added after AI-driven release-wipe incident):
  • Releases/vX.Y.Z/.claude — active OR frozen DOS release snapshot
  • Releases/                — entire frozen-version archive
  • ~/.claude               — live Claude Code root (symlinked to active release)

  Load-bearing source trees:
  • Packs/                  — Pack source (Copy 3 of Four-Copy Rule)
  • Plans/                  — RFCs and implementation plans
  • Platform/studio         — Studio submodule (Next.js + Postgres SoT)
  • ~/Durante               — entire monorepo

Last local backup: ${backupAge}

If this is intentional:
  1. Ensure a fresh backup exists: bun ~/Durante/Tools/dos-backup.ts
  2. Set override and retry:  DOS_ALLOW_MEMORY_RM=1 <your command>

This is a hard block. Releases are NOT recoverable from Studio (Studio holds
session telemetry, not source). Removing a release tree wipes the active or
frozen DOS substrate. The override is a one-shot env var — make it deliberate.`;

// ISC-A2.5: exit 2 = hard block in Claude Code PreToolUse hooks
recordBlockedDestructiveAttempt(cmd, reason);
console.error(reason);
process.exit(2);
