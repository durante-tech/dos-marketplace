#!/usr/bin/env bun
/**
 * CheckpointPerISC.hook.ts — PostToolUse (Edit / MultiEdit / Write)
 *
 * Auto-commits the whole repository on every ISA criterion transition
 * (`- [ ] ISC-N` → `- [x] ISC-N`). Exists to mechanize the per-criterion
 * checkpoint discipline that text rules cannot enforce mechanically.
 *
 * Spec: Plans/Specs/RFC-0063-checkpoint-per-isc.md
 * Sprint: v0.0.8 W-T1 (Bucket A1 of RFC-0064 master DAG)
 *
 * Behavior contract:
 *   - Detects [ ]→[x] transitions (NEVER [x]→[ ] — un-tick is not a checkpoint event)
 *   - Scoped to ISA-shaped paths (RFC specs / WORK PRDs+ISAs / ad-hoc ISA.md)
 *   - Honors `~/.claude/checkpoint-repos.txt` allowlist (default: only ~/.claude)
 *   - Scoped commit: only the ISA file that triggered the hook is staged.
 *     This supersedes D1 (PAI-council 2026-05-05 "whole-repo via git add -A")
 *     per RFC-0063 §54 — the council explicitly named "commit-noise becomes
 *     operator pain" as the v0.0.9 reconsideration trigger. The trigger fired:
 *     `git add -A` was sweeping unrelated dirty files into auto-checkpoint
 *     commits, hijacking user-initiated commits that ran in the same window
 *     (memory note: dos-checkpoint-hook-commit-hijack, 2026-05-21).
 *   - Subject: `checkpoint({slug}/{ISC-N}): {task}` when PRD frontmatter
 *     `task:` is available; falls back to `ISC-{N} ({slug}): {description}`
 *     when frontmatter is missing (RFC specs, ISA.md, etc.)
 *   - Multiple transitions in one Edit → primary in subject, all listed in body
 *   - Failure (gates / commit error) → log JSONL, exit 0 (NEVER block operator)
 *   - No remote push, no Studio sync, no voice (silent until inspected)
 *
 * Inspection: `bun ~/Durante/Tools/Checkpoint.ts list <slug>`
 * Rollback (preview only): `bun ~/Durante/Tools/Checkpoint.ts rollback <slug> <isc-id>`
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, basename, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { startTimer, stopTimer } from './lib/hook-io';

// ─── Types ────────────────────────────────────────

interface HookInput {
  session_id?: string;
  hook_event_name?: string;
  tool_name: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  cwd?: string;
}

interface Transition {
  iscId: string; // e.g., "ISC-7" or "ISC-7.2"
  description: string; // criterion text up to first ":" or ".", max 60 chars
}

// ─── Constants ────────────────────────────────────

const ISA_PATH_PATTERNS: RegExp[] = [
  /Plans\/Specs\/RFC-\d{4}[^/]*\.md$/,
  // Matches both legacy flat layout (MEMORY/WORK/<slug>/PRD.md) and the
  // RFC-0037 Phase 0a structural split (MEMORY/WORK/active/<slug>/PRD.md
  // and MEMORY/WORK/archived/<slug>/PRD.md). Without the optional bucket
  // segment, vNext PRDs under active/ silently fall through and the
  // auto-commit-on-ISC-flip never fires.
  /MEMORY\/WORK\/(?:active\/|archived\/)?[^/]+\/(PRD|ISA)\.md$/,
  /(^|\/)ISA\.md$/,
];

// Optional `**` around the ISC ID handles DOS spec format (`- [ ] **ISC-N**: ...`)
// while still matching the plain form (`- [ ] ISC-N: ...`) used in light fixtures.
const TICK_PATTERN = /^- \[ \] (?:\*\*)?(ISC-[\w.-]+)(?:\*\*)?\s*[:\-—]?\s*(.*)$/;
const TICKED_PATTERN = /^- \[x\] (?:\*\*)?(ISC-[\w.-]+)(?:\*\*)?\s*[:\-—]?\s*(.*)$/i;

const ALLOWLIST_PATH = join(homedir(), '.claude', 'checkpoint-repos.txt');
const ERROR_LOG_DIR = join(homedir(), '.claude', 'MEMORY', 'STATE');
const ERROR_LOG_FILE = join(ERROR_LOG_DIR, 'checkpoint-errors.jsonl');

// Minimum age before an orphan `.git/index.lock` is considered stale and
// unlinked. 15× the typical commit duration (50ms-2s) — large enough to
// never clobber a live operation, small enough to recover within one retry
// loop. Tools/git-unstick.ts uses a higher threshold (120s) because operator
// triage tolerates a longer wait than the automated hot path.
const STALE_LOCK_MIN_AGE_S = 30;

// ─── Allowlist ────────────────────────────────────

function loadAllowlist(): string[] {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  const lines = readFileSync(ALLOWLIST_PATH, 'utf-8').split('\n');
  return lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/^~\//, `${homedir()}/`).replace(/^\$HOME\//, `${homedir()}/`))
    .map((l) => resolve(l));
}

function findRepoRoot(filePath: string): string | null {
  let dir = dirname(resolve(filePath));
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// ─── Detection ────────────────────────────────────

function isIsaPath(filePath: string): boolean {
  return ISA_PATH_PATTERNS.some((rx) => rx.test(filePath));
}

/**
 * Diff "before" and "after" text to find lines that flipped from `[ ] ISC-N`
 * to `[x] ISC-N`. Position-independent: matches by ISC id, not line number.
 *
 * Ignores [x]→[ ] reversals (anti-criterion ISC-20).
 */
function findTransitions(before: string, after: string): Transition[] {
  const beforeUnticked = new Map<string, string>(); // iscId → description
  for (const line of before.split('\n')) {
    const m = line.match(TICK_PATTERN);
    if (m) beforeUnticked.set(m[1], (m[2] || '').trim());
  }

  const afterTicked = new Set<string>();
  for (const line of after.split('\n')) {
    const m = line.match(TICKED_PATTERN);
    if (m) afterTicked.add(m[1]);
  }

  const transitions: Transition[] = [];
  for (const iscId of afterTicked) {
    if (beforeUnticked.has(iscId)) {
      const fullDesc = beforeUnticked.get(iscId) || '';
      // Trim to first ":" or "." or 60 chars, whichever first.
      const cutMatch = fullDesc.match(/^(\*\*[^*]+\*\*[:\-—]?)?\s*([^.:]*)/);
      let desc = (cutMatch?.[2] || fullDesc).trim();
      if (desc.length > 60) desc = desc.slice(0, 57).trim() + '...';
      transitions.push({ iscId, description: desc || iscId });
    }
  }
  return transitions;
}

// ─── Slug derivation ──────────────────────────────

function deriveSlug(filePath: string): string {
  const abs = resolve(filePath);
  // Skip the RFC-0037 bucket dir (active/archived) so we capture the real PRD
  // slug, not the literal 'active'/'archived' segment. Without this every
  // bucketed PRD's checkpoints were committed as `checkpoint(active/ISC-N)` and
  // the slug-keyed list/rollback tooling silently couldn't find them (H-055).
  const workMatch = abs.match(/MEMORY\/WORK\/(?:active\/|archived\/)?([^/]+)\//);
  if (workMatch) return workMatch[1];
  const rfcMatch = abs.match(/(RFC-\d{4})/);
  if (rfcMatch) return rfcMatch[1];
  return basename(dirname(abs));
}

// ─── File content read (before + after) ───────────

function reconstructBeforeAfter(
  toolName: string,
  input: Record<string, unknown>,
  filePath: string
): { before: string; after: string } | null {
  let after = '';
  try {
    after = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  if (toolName === 'Edit') {
    const oldStr = (input.old_string as string) ?? '';
    const newStr = (input.new_string as string) ?? '';
    const before = after.replace(newStr, oldStr);
    return { before, after };
  }

  if (toolName === 'MultiEdit') {
    const edits = (input.edits as Array<{ old_string: string; new_string: string }>) ?? [];
    let before = after;
    for (let i = edits.length - 1; i >= 0; i--) {
      before = before.replace(edits[i].new_string, edits[i].old_string);
    }
    return { before, after };
  }

  if (toolName === 'Write') {
    return { before: '', after: (input.content as string) ?? after };
  }

  return null;
}

// ─── Commit ───────────────────────────────────────

/**
 * Extract the `task:` value from a PRD's YAML frontmatter.
 * Returns null when the file has no frontmatter (RFC specs, ad-hoc ISA.md)
 * or no `task:` field. Result is trimmed and capped at 80 chars to keep
 * commit subjects readable.
 */
function extractTaskFromFrontmatter(content: string): string | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 4);
  if (end < 0) return null;
  const frontmatter = content.slice(4, end);
  const m = frontmatter.match(/^task:\s*(.+?)\s*$/m);
  if (!m) return null;
  const raw = m[1].replace(/^["']|["']$/g, '').trim();
  return raw.length > 80 ? raw.slice(0, 77) + '...' : raw || null;
}

function buildCommitMessage(
  transitions: Transition[],
  slug: string,
  task: string | null
): { subject: string; body: string } {
  const primary = transitions[0];
  // Prefer `checkpoint({slug}/{iscId}): {task}` when frontmatter `task:` is
  // available — high-level intent reads clearly. Fall back to the legacy
  // `{iscId} ({slug}): {description}` shape for RFCs and ISA.md files which
  // do not carry a PRD-style `task:` field.
  const subject = task
    ? `checkpoint(${slug}/${primary.iscId}): ${task}`
    : `${primary.iscId} (${slug}): ${primary.description}`;

  let body = '';
  if (transitions.length > 1) {
    body =
      'Additional ISC transitions in this edit:\n' +
      transitions
        .slice(1)
        .map((t) => `  - ${t.iscId}: ${t.description}`)
        .join('\n') +
      '\n';
  }
  body += '\nCo-Authored-By: DuranteOS <tech@duranteos.com>';
  return { subject, body };
}

function logError(reason: string, detail: string): void {
  try {
    if (!existsSync(ERROR_LOG_DIR)) mkdirSync(ERROR_LOG_DIR, { recursive: true });
    appendFileSync(
      ERROR_LOG_FILE,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        hook: 'CheckpointPerISC',
        reason,
        detail,
      }) + '\n'
    );
  } catch {
    // Logging failure is silent. Hook never blocks.
  }
}

/**
 * Run git command with bounded retry on `.git/index.lock` contention. Other
 * PostToolUse hooks in the chain (PRDSync, PRDSigner, ArtifactAutoLogger)
 * may hold the lock briefly; we wait it out rather than fail the checkpoint.
 *
 * Backoff: 100ms / 250ms / 500ms / 1500ms / 3000ms (5 attempts, ~5.35s total).
 * If still locked after all retries, run a stale-lock diagnosis and retry
 * once after auto-clear. Telemetry to MEMORY/STATE/lock-clears.jsonl.
 *
 * The retry sleep is a synchronous busy-loop; signal-handler cleanup is not
 * effective here. Orphans left by killed runs are recovered on the NEXT hook
 * invocation via the entry-clear in `commitWholeRepo`.
 */
function gitWithRetry(args: string[], repoRoot: string): void {
  const backoffsMs = [100, 250, 500, 1500, 3000];
  let lastErr: any = null;
  for (let i = 0; i <= backoffsMs.length; i++) {
    const result = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!result.error && result.status === 0) {
      return;
    }
    const err = result.error ?? new Error(result.stderr || `git ${args.join(' ')} failed`);
    (err as Error & { stderr?: string }).stderr =
      typeof result.stderr === 'string' ? result.stderr : '';
    lastErr = err;
    const stderr = (err as Error & { stderr?: string }).stderr ?? '';
    const isLockContention = stderr.includes('index.lock') && stderr.includes('File exists');
    if (!isLockContention) throw err;
    if (i === backoffsMs.length) {
      // Final attempt exhausted on lock contention — try stale-clear protocol.
      if (tryStaleClear(repoRoot)) {
        const retryAfterClear = spawnSync('git', args, {
          cwd: repoRoot,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (!retryAfterClear.error && retryAfterClear.status === 0) return;
      }
      throw err;
    }
    // Synchronous sleep — tiny, bounded; we're already in a sequential hook chain.
    const until = Date.now() + backoffsMs[i];
    while (Date.now() < until) { /* spin */ }
  }
  throw lastErr;
}

/**
 * Best-effort stale-lock detection + clear. Three-gate safety protocol:
 *
 *   1. Lock file must exist + mtime age must be >= STALE_LOCK_MIN_AGE_S.
 *   2. `lsof <lock>` must show no open holder.
 *   3. `ps -ef | grep '[g]it '` must show no active git process system-wide.
 *
 * Only when ALL THREE hold is the lock considered stale and unlinked.
 *
 * Returns true iff a stale lock existed AND was successfully removed (so the
 * caller can retry once after the clear).
 */
function tryStaleClear(repoRoot: string): boolean {
  const lockPath = join(repoRoot, '.git', 'index.lock');
  if (!existsSync(lockPath)) return false;
  let ageS = 0;
  try {
    ageS = Math.floor((Date.now() - statSync(lockPath).mtimeMs) / 1000);
  } catch {
    return false;
  }
  if (ageS < STALE_LOCK_MIN_AGE_S) return false;

  const lsofProbe = spawnSync('lsof', [lockPath], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const lsofOut = typeof lsofProbe.stdout === 'string' ? lsofProbe.stdout.trim() : '';
  const hasLsofHolder =
    lsofOut.split('\n').filter((l) => l && !l.startsWith('COMMAND')).length > 0;
  if (hasLsofHolder) return false;

  const psProbe = spawnSync('sh', ['-c', "ps -ef | grep '[g]it ' | grep -v unstick"], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const psOut = typeof psProbe.stdout === 'string' ? psProbe.stdout.trim() : '';
  if (psOut.length > 0) return false;

  try {
    unlinkSync(lockPath);
  } catch {
    return false;
  }

  try {
    const stateDir = join(homedir(), '.claude', 'MEMORY', 'STATE');
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    appendFileSync(
      join(stateDir, 'lock-clears.jsonl'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        hook: 'CheckpointPerISC',
        lock_path: lockPath,
        age_seconds: ageS,
        auto_cleared: true,
      }) + '\n'
    );
  } catch {
    /* telemetry failure non-blocking */
  }

  return true;
}

/**
 * Detect whether OUR repo's `.git/index.lock` is fresh — i.e. an active git
 * operation is in flight in THIS specific repo right now. Distinct from
 * tryStaleClear's "stale orphan" case (≥30s old + lsof empty + ps clean):
 * here we want to detect the FRESH lock that signals "operator's commit is
 * actively running in this repo," and yield rather than compete.
 *
 * Why scope to OUR repo (not system-wide ps): operators routinely run
 * parallel sessions with concurrent `git commit` in other repositories.
 * A system-wide probe would always see those and unconditionally skip every
 * auto-checkpoint. Lock contention only matters when it's contention for
 * OUR index — the operator's commit elsewhere doesn't touch our lock.
 *
 * The lock-existence check is also robust against `ps` aliasing (some
 * operator setups shadow `ps` with `procs` or similar), which would have
 * silently failed a process-grep approach.
 *
 * Fail-open: any stat/path error returns false, preserving the prior
 * gitWithRetry behavior on broken probes.
 */
function isOurRepoLockFresh(repoRoot: string): boolean {
  const lockPath = join(repoRoot, '.git', 'index.lock');
  if (!existsSync(lockPath)) return false;
  try {
    const ageMs = Date.now() - statSync(lockPath).mtimeMs;
    return ageMs < STALE_LOCK_MIN_AGE_S * 1000;
  } catch {
    return false;
  }
}

function commitWholeRepo(
  repoRoot: string,
  subject: string,
  body: string,
  filePath: string
): boolean {
  try {
    // Pre-clear any orphan lock left by a prior killed run; saves the 5.35s
    // retry spin-wait. Short-circuits via existsSync when no lock is present.
    void tryStaleClear(repoRoot);

    // Yield when OUR repo's index.lock is fresh — that signals an active
    // operator-initiated git operation in THIS repo. tryStaleClear above
    // already removed any stale orphan (>=30s + no lsof/ps holder), so if
    // a lock survives this point and is <30s old, it's a live foreground
    // operation. Operator commits hold the lock for 1-10s (longer with
    // pre-commit hooks); our gitWithRetry budget (~5.35s) is too small to
    // outlast that, and when the hook is SIGKILL'd by the PostToolUse
    // timeout mid-retry we leave orphans that block subsequent commands.
    // Better to miss this checkpoint and let the next PRD edit re-fire the
    // hook than to compete with foreground for the lock.
    if (isOurRepoLockFresh(repoRoot)) {
      logError(
        'skip-active-lock',
        `${filePath}: deferred — repo index.lock is fresh (active foreground git in this repo)`
      );
      return false;
    }

    // Stage ONLY the ISA file that triggered this hook. Replaces D1's
    // `git add -A` whole-repo sweep — see header comment for the RFC-0063 §54
    // reconsideration trigger. `--` separator guards against pathological
    // file paths that could be mistaken for git flags.
    const relPath = relative(repoRoot, filePath);
    gitWithRetry(['add', '--', relPath], repoRoot);

    const status = spawnSync('git', ['status', '--porcelain', '--', relPath], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (status.error || status.status !== 0 || typeof status.stdout !== 'string') {
      throw status.error ?? new Error(status.stderr || 'git status failed');
    }
    if (!status.stdout.trim()) return false;

    // Pathspec on commit (with the `--` separator) commits ONLY changes for
    // <relPath>, bypassing any other content the operator has pre-staged for
    // their own commit. Without this, our `git add` would join operator's
    // staged work into the checkpoint commit — the original hijack mechanism.
    gitWithRetry(['commit', '-m', subject, '-m', body, '--', relPath], repoRoot);
    return true;
  } catch (err: any) {
    const detail = err?.stderr?.toString?.() || err?.message || String(err);
    logError('commit-failed', `${filePath}: ${detail.slice(0, 500)}`);
    return false;
  }
}

// ─── Main ─────────────────────────────────────────

function main(): void {
  const timer = startTimer('CheckpointPerISC');
  let event = 'no-op';

  try {
    let input: HookInput;
    try {
      input = JSON.parse(readFileSync(0, 'utf-8'));
    } catch {
      return;
    }

    const { tool_name, tool_input } = input;
    if (!tool_name || !tool_input) return;
    if (!['Edit', 'MultiEdit', 'Write'].includes(tool_name)) return;

    const filePath = (tool_input.file_path as string) ?? (tool_input.path as string);
    if (!filePath || typeof filePath !== 'string') return;

    if (!isIsaPath(filePath)) {
      event = 'skip-path-out-of-scope';
      return;
    }

    const repoRoot = findRepoRoot(filePath);
    if (!repoRoot) {
      event = 'skip-no-repo';
      return;
    }
    const allowlist = loadAllowlist();
    if (!allowlist.includes(resolve(repoRoot))) {
      event = 'skip-not-allowlisted';
      return;
    }

    const reconstructed = reconstructBeforeAfter(tool_name, tool_input, filePath);
    if (!reconstructed) {
      event = 'skip-reconstruct-failed';
      return;
    }

    const transitions = findTransitions(reconstructed.before, reconstructed.after);
    if (transitions.length === 0) {
      event = 'no-op-no-transition';
      return;
    }

    const slug = deriveSlug(filePath);
    const task = extractTaskFromFrontmatter(reconstructed.after);
    const { subject, body } = buildCommitMessage(transitions, slug, task);
    const ok = commitWholeRepo(repoRoot, subject, body, filePath);
    event = ok ? `commit-${transitions.length}` : 'commit-failed';
  } catch (err: any) {
    logError('unhandled', err?.message || String(err));
    event = 'error-unhandled';
  } finally {
    stopTimer(timer, event);
  }
}

main();
