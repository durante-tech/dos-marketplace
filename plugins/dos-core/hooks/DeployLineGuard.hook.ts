#!/usr/bin/env bun
/**
 * DeployLineGuard.hook.ts — PreToolUse guard that fences DELIVERY MUTATIONS
 * (PR merges + pushes to main) on holding the deploy-line lock.
 *
 * THE SEAM: only the session named in `deployline/.driver.lock` is the deploy
 * line this cycle (DOS/FLEETPROTOCOL.md §3). A producer session that runs
 * `gh pr merge` or `git push … main` without the lock bumps a pointer another
 * session owns — the concurrent-deploy-line collision. Incident I-006 proved
 * the loop cannot merge autonomously without a permission rule; this guard is
 * the mechanical mirror: it flags the mutation when no lock exists or the lock
 * names another session.
 *
 * FLAGS (warn by default, exit-2 in enforce mode) when ALL hold:
 *   (1) tool is Bash
 *   (2) the command is a delivery mutation — `gh pr merge`, or `git push` whose
 *       refspec targets main (two conservative patterns; over-flagging a quoted
 *       "gh pr merge" or a branch containing the token `main` is acceptable —
 *       warn-mode makes an over-flag free).
 *   (3) the mutation targets a FLEET repo (durante-tech/dos or
 *       durante-tech/cc-durante-studio — the two repos FLEETPROTOCOL.md fences).
 *       Repo identity resolves from the `--repo owner/name` flag (or a gh PR
 *       URL argument) when present, else the target directory's git remote
 *       (ssh + https forms). A RESOLVED foreign repo passes untouched — the
 *       guard's business is fleet integrity, not global lockdown (field
 *       incident 2026-07-10: enforce mode blocked push+merge in the Ring-0
 *       scratch repo [REDACTED:operator-username]/dos-ring0-skeleton-20260710, entirely outside the
 *       fleet). When identity CANNOT be resolved: a command that names a fleet
 *       path is fenced (conservative); otherwise it is allowed with a logged
 *       warning — see the trade-off note on classifyRepoScope().
 *   (4) the deploy-line lock is absent, OR names a session other than this one.
 *       A dead holder PID is annotated "stale lock (dead pid)" in the log line
 *       (the takeover is a protocol act the owner ledgers — §3 — not the guard's).
 *
 * The remedy on flag: file a PR on your named branch and QUEUE the merge to the
 * deploy-line owner per DOS/FLEETPROTOCOL.md §3 (incident I-006).
 *
 * Rollout: WARN-mode is the default (logs to stderr, lets the command through).
 * Promote to block with DOS_ENFORCEMENT_MODE_DEPLOYLINE_GUARD=block.
 *
 * Read-only on the lock. Never writes outside MEMORY/STATE telemetry.
 *
 * Mirror pattern: WorktreeMemoryWriteGuard.hook.ts (PreToolUse, pure decision
 * surface, exit-2 block, env-gated enforce mode, fail-open, JSONL telemetry).
 *
 * Spec: DOS/FLEETPROTOCOL.md §3. Incident: deployline/INCIDENTS.md I-006.
 */

import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput } from './lib/hook-io';
import { loadProjectEnv, resolveSessionId, getMemorySubdir } from './lib/paths';

// ─── Pure decision surface (table-tested in isolation — Feathers gate) ────────

// (a) any `gh pr merge`. (b) any `git … push … main` on one logical line —
// options between `git` and `push` (`-C <path>`, `-c k=v`, `--git-dir=…`) are
// covered because `git -C` is the house style for shared-tree-safe commands.
// Backslash-newline continuations are collapsed by normalizeCommand() before
// matching, so a refspec split across a continuation cannot evade detection.
// Deliberately conservative-broad: they flag more, never less. Warn-mode
// telemetry makes an over-flag costless before enforce mode ever blocks.
//
// KNOWN RESIDUAL GAP (documented, accepted for v1): a bare `git push` with no
// refspec is NOT flagged, although this host's `push.default=current` makes it
// a push to main when the checkout sits on main. Detecting that requires a
// git subprocess against input.cwd per command — deferred; the fleet branch
// rule (never work on a main checkout) is the compensating control.
// Position-anchored: the verb must start a command segment (line start or after
// ; && || | ( then/do), optionally preceded by VAR=val assignments. Quoted spans
// are BLANKED before matching (field incident 2026-07-10, third false-positive
// shape: a `gh pr comment --body "... gh pr merge ..."` was flagged in enforce
// mode — the matcher must never read prose inside quotes as a command).
// Residual accepted gap: a real merge hidden inside quotes (`bash -c "gh pr
// merge 1"`) is missed — defense-in-depth; the permission layer still sees it.
const CMD_START = String.raw`(?:^|[;&|(]\s*|\bthen\s+|\bdo\s+)(?:\w+=\S+\s+)*`;
const GH_PR_MERGE_RE = new RegExp(CMD_START + String.raw`gh\s+pr\s+merge\b`, 'm');
// push→main confined to one command segment (no crossing ; & | boundaries).
// `main` must be a STANDALONE ref token (preceded by whitespace or `:`), not a
// substring of a branch path — `feat/main-nav` is not a push to main.
const GIT_PUSH_MAIN_RE = new RegExp(
  CMD_START + String.raw`git\b[^\n;&|]*?\bpush\b[^\n;&|]*(?:\s|:)main(?=$|\s|[;&|])`, 'm');

/** Collapse continuations, then blank quoted spans so prose never matches. */
export function normalizeCommand(command: string): string {
  return command
    .replace(/\\\r?\n/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'[^']*'/g, "''");
}

// ─── Repo scoping (fix 2026-07-11: fence FLEET repos only) ────────────────────
// FLEETPROTOCOL.md fences PR merges + gitlink bumps in exactly two repos. A
// delivery mutation targeting any other repo is none of this guard's business.
// dos-marketplace is deliberately NOT in this set — the law (§KERNEL/§DIALECT)
// does not name it; widen only via FLEETPROTOCOL amendment (its §6).
export const FLEET_REPOS: ReadonlySet<string> = new Set([
  'durante-tech/dos',
  'durante-tech/cc-durante-studio',
]);

export type RepoScope = 'fleet' | 'foreign' | 'unknown';

/**
 * Normalize a repo reference to lowercase `owner/name` (github.com) or
 * `host/owner/name` (any other host — definitionally foreign). Handles:
 *   owner/name · https://github.com/owner/name(.git)(/pull/…) ·
 *   git@github.com:owner/name(.git) · ssh://git@github.com/owner/name(.git)
 * Returns null when the input is not recognizably a repo reference.
 */
export function normalizeRepoTarget(target: string): string | null {
  if (!target) return null;
  let t = target.trim().replace(/^['"]|['"]$/g, '');
  let host = '';
  let path = '';
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(?:https?|ssh|git):\/\/(?:[^@/\s]+@)?([^/:\s]+)(?::\d+)?\/(.+)$/))) {
    host = m[1]; path = m[2];
  } else if ((m = t.match(/^(?:[\w.-]+@)([^:\s]+):(.+)$/))) {
    host = m[1]; path = m[2]; // scp-like: git@host:owner/name.git
  } else if (/^[\w.-]+\/[\w.-]+$/.test(t)) {
    host = 'github.com'; path = t; // bare owner/name (gh --repo shorthand)
  } else {
    return null;
  }
  const segs = path.replace(/^\/+/, '').split('/');
  if (segs.length < 2 || !segs[0] || !segs[1]) return null;
  const slug = `${segs[0]}/${segs[1].replace(/\.git$/i, '')}`.toLowerCase();
  return host.toLowerCase() === 'github.com' ? slug : `${host.toLowerCase()}/${slug}`;
}

/**
 * `--repo <val>` / `--repo=<val>` / `-R <val>` value. Matches on the
 * NORMALIZED command (quoted spans blanked) — a decoy `--repo [REDACTED:operator-username]/x`
 * inside a quoted --body/-m string must never flip a fleet merge to foreign
 * (same rule as the mutation detector; field incident 2026-07-10, third
 * false-positive shape, inverted). A quoted flag VALUE is blanked too and
 * falls through to remote resolution — conservative, never a bypass.
 */
export function parseRepoFlag(command: string): string | null {
  const m = normalizeCommand(command).match(/(?:^|\s)(?:--repo[=\s]|-R\s+)(\S+)/);
  if (!m) return null;
  const v = m[1].replace(/^['"]+|['"]+$/g, '');
  return v || null;
}

/**
 * Repo from a gh PR URL argument (`gh pr merge https://github.com/o/r/pull/5`).
 * NORMALIZED command for the same anti-decoy reason as parseRepoFlag.
 */
export function extractGhPrUrlRepo(command: string): string | null {
  const m = normalizeCommand(command).match(/https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/\d+/);
  return m ? m[1] : null;
}

/** Expand a leading `~` and resolve a relative path against `cwd`. */
function expandDirToken(raw: string, cwd: string): string {
  const p = raw.replace(/^['"]+|['"]+$/g, '');
  if (p.startsWith('~')) return join(homedir(), p.slice(1));
  if (!p.startsWith('/')) return join(cwd, p);
  return p;
}

/** `-C <path>` argument of the git invocation (house style for shared-tree ops). */
export function parseGitDashCPath(command: string, cwd = '/'): string | null {
  const m = command.match(/\bgit\b[^\n;&|]*?\s-C\s+("[^"]+"|'[^']+'|\S+)/);
  return m ? expandDirToken(m[1], cwd) : null;
}

/**
 * Effective directory of the mutation: `-C <path>` wins, else the LAST
 * `cd <path>` preceding the command segment (`cd /x && git push …` is the
 * standard compound shape — the session cwd is NOT where the push runs),
 * else the session cwd.
 */
export function resolveEffectiveDir(command: string, cwd: string): string {
  const dashC = parseGitDashCPath(command, cwd);
  if (dashC) return dashC;
  let dir = cwd;
  const cdRe = /(?:^|[;&|(]\s*)cd\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g;
  let m: RegExpExecArray | null;
  while ((m = cdRe.exec(command)) !== null) {
    dir = expandDirToken(m[1], dir);
  }
  return dir;
}

// Separate-argument push flags whose VALUE must not be read as the remote.
const PUSH_VALUE_FLAGS = new Set(['-o', '--push-option', '--receive-pack', '--exec', '--repo']);

/**
 * First non-flag token after `push` in the (normalized) command segment — the
 * remote name or remote URL. Null when the push has no positional args.
 */
export function extractPushRemoteToken(command: string): string | null {
  const m = normalizeCommand(command).match(/\bpush\b([^\n;&|]*)/);
  if (!m) return null;
  const toks = m[1].trim().split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (!tok) continue;
    if (tok.startsWith('-')) {
      if (PUSH_VALUE_FLAGS.has(tok)) i++; // skip the flag's value too
      continue;
    }
    return tok;
  }
  return null;
}

/**
 * True when the command text itself names a fleet repo or the shared tree.
 * NORMALIZED text — quoted prose ("port of durante-tech/dos") must not
 * re-fence a foreign mutation (the Ring-0 over-block class).
 */
export function commandNamesFleetPath(command: string): boolean {
  const c = normalizeCommand(command).toLowerCase();
  return (
    c.includes('durante-tech/dos') ||
    c.includes('cc-durante-studio') ||
    /\/durante(\/|\s|['"]|$)/.test(c) // the ~/Durante shared checkout path
  );
}

/**
 * (resolvedRepo, command) → scope. TRADE-OFF (explicit, for review): when repo
 * identity cannot be determined AND the command names no fleet path, the guard
 * ALLOWS with a logged warning rather than blocking. The guard exists to protect
 * fleet integrity (the two-repo deploy line), not to impose a global lockdown —
 * an unresolvable target is overwhelmingly a scratch/foreign clone (the Ring-0
 * incident class), and the compensating controls (permission layer, fleet
 * branch rule, warn telemetry) still see the command. A command that DOES name
 * a fleet path stays fenced even when resolution fails (conservative).
 */
export function classifyRepoScope(resolvedRepo: string | null, command: string): RepoScope {
  if (resolvedRepo) return isFleetRepo(resolvedRepo) ? 'fleet' : 'foreign';
  return commandNamesFleetPath(command) ? 'fleet' : 'unknown';
}

/**
 * Fleet membership by slug, host-insensitive: an ssh-config alias host
 * (`git@gh-fleet:durante-tech/dos.git` → `gh-fleet/durante-tech/dos`) is the
 * SAME fleet repo — match the trailing owner/name too. Over-fencing a
 * hypothetical same-slug repo on another host is the acceptable conservative
 * direction; under-fencing the real fleet remote behind an alias is not.
 */
export function isFleetRepo(repo: string): boolean {
  if (FLEET_REPOS.has(repo)) return true;
  const segs = repo.split('/');
  return segs.length > 2 && FLEET_REPOS.has(segs.slice(-2).join('/'));
}

export interface DeployLineLock {
  pid: number;
  epoch_boot?: number;
  session: string;
  acquired?: string;
}

export interface DeployGuardCtx {
  toolName: string;
  command: string;
  lock: DeployLineLock | null; // null = lock file absent/unparseable
  currentSession: string;
  holderPidAlive: boolean;     // injected; runtime computes via isPidAlive
  repoScope: RepoScope;        // injected; runtime resolves via resolveTargetRepo
}

export interface DeployGuardDecision {
  action: 'allow' | 'violation';
  reason?: string;
  stale?: boolean; // lock held by another session whose PID is dead
}

/** True when the command is a delivery mutation (merge, or push to main). */
export function isDeliveryMutation(command: string): boolean {
  if (typeof command !== 'string') return false;
  const c = normalizeCommand(command);
  return GH_PR_MERGE_RE.test(c) || GIT_PUSH_MAIN_RE.test(c);
}

/** Parse the `key=value`-per-line lease file. Requires pid + session to be a lock. */
export function parseDriverLock(text: string): DeployLineLock | null {
  if (!text) return null;
  const kv: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_]+)\s*=\s*(.+?)\s*$/);
    if (m) kv[m[1]] = m[2];
  }
  if (!kv.session || !kv.pid) return null;
  const pid = Number(kv.pid);
  if (!Number.isFinite(pid)) return null;
  return {
    pid,
    epoch_boot: kv.epoch_boot ? Number(kv.epoch_boot) : undefined,
    session: kv.session,
    acquired: kv.acquired,
  };
}

/**
 * Liveness probe via signal 0. ESRCH → dead. EPERM → the process exists but is
 * not ours to signal → treat as alive (conservative: do not call it stale).
 */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === 'EPERM';
  }
}

/**
 * Pure predicate: (tool, command, lock, session, liveness) → allow | violation.
 * No I/O, no env reads, no process exit — the characterization table exercises
 * every branch without a lock file or a subprocess.
 */
export function decideDeployLineGuard(ctx: DeployGuardCtx): DeployGuardDecision {
  if (ctx.toolName !== 'Bash') return { action: 'allow' };
  if (!isDeliveryMutation(ctx.command)) return { action: 'allow' };

  // Scope gate: only mutations targeting a FLEET repo are the guard's business.
  if (ctx.repoScope === 'foreign') return { action: 'allow' };
  if (ctx.repoScope === 'unknown') {
    // Allow-with-logged-warning (see classifyRepoScope trade-off note).
    return {
      action: 'allow',
      reason: 'repo identity indeterminate, no fleet path named — allowed (guard scopes to fleet repos)',
    };
  }

  // From here the command IS a delivery mutation against a FLEET repo — fence
  // it on the lock.
  if (!ctx.lock) {
    return { action: 'violation', reason: 'no deploy-line lock exists' };
  }
  if (ctx.lock.session !== ctx.currentSession) {
    const stale = !ctx.holderPidAlive;
    return {
      action: 'violation',
      reason: `lock held by another session (fencing)${stale ? ' — stale lock (dead pid)' : ''}`,
      stale,
    };
  }
  // This session holds the lock — it is the deploy-line owner this cycle.
  return { action: 'allow' };
}

export function buildBlockReason(d: DeployGuardDecision, command: string): string {
  return `🛑 DeployLineGuard: this session is not the deploy-line owner.

Command: ${command.slice(0, 200)}
Why:     ${d.reason ?? ''}

Merges and gitlink-bump pushes to main are fenced on holding the deploy-line
lock (deployline/.driver.lock). Per DOS/FLEETPROTOCOL.md §3, only the session
named in that lock may merge PRs or push to main.

REMEDY: file a PR on your named branch and QUEUE the merge to the deploy-line
owner. Do not merge or push to main yourself. (Incident I-006.)

Override: acquire the deploy-line lock, or leave the guard in warn mode.
This is a hard block in enforce mode; a warning otherwise.`;
}

// ─── Repo resolution (runtime I/O half of the scoping fix) ────────────────────

/** `git -C <dir> remote get-url <name>` — null on any failure. Read-only. */
function gitRemoteUrl(dir: string, remote: string): string | null {
  try {
    const out = execFileSync('git', ['-C', dir, 'remote', 'get-url', remote], {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Resolve WHICH repo the delivery mutation targets, best-effort, in priority:
 *   1. explicit `--repo`/`-R` flag (gh) → 2. gh PR URL argument →
 *   3. explicit remote URL in the push segment →
 *   4. the named push remote's URL at the effective dir (`-C <path>`, else the
 *      last `cd <path>` prefix, else cwd) → 5. `origin` at the effective dir
 *      → 6. for a gh merge whose origin is NOT fleet, `upstream` (a fork
 *      checkout merges the PR's BASE repo — commonly the upstream remote).
 * Runs at most a few short git config reads, and only after the command
 * already matched a delivery mutation (the rare path).
 */
export function resolveTargetRepo(
  command: string,
  cwd: string,
  remoteUrlFn: (dir: string, remote: string) => string | null = gitRemoteUrl,
): string | null {
  const flag = parseRepoFlag(command);
  if (flag) {
    const r = normalizeRepoTarget(flag);
    if (r) return r;
  }
  const urlRepo = extractGhPrUrlRepo(command);
  if (urlRepo) {
    const r = normalizeRepoTarget(urlRepo);
    if (r) return r;
  }
  const dir = resolveEffectiveDir(command, cwd);
  if (!dir) return null;
  const isPush = /\bpush\b/.test(normalizeCommand(command));
  let remote = 'origin';
  if (isPush) {
    const token = extractPushRemoteToken(command);
    if (token) {
      const asUrl = normalizeRepoTarget(token);
      // A URL-shaped token names the repo directly; a plain word is a remote name.
      if (asUrl && /[:@/]/.test(token)) return asUrl;
      if (/^[\w.-]+$/.test(token)) remote = token;
    }
  }
  const url = remoteUrlFn(dir, remote);
  let resolved = url ? normalizeRepoTarget(url) : null;
  // Named remote missing (e.g. `git push main` parsed `main` as the remote) —
  // fall back to origin so a fleet checkout still resolves as fleet.
  if (!resolved && remote !== 'origin') {
    const originUrl = remoteUrlFn(dir, 'origin');
    resolved = originUrl ? normalizeRepoTarget(originUrl) : null;
  }
  // Fork-checkout gh merge: gh targets the PR's BASE repo. When origin is a
  // personal fork (foreign) but `upstream` is a fleet repo, the merge lands on
  // the fleet — prefer the fleet hit (conservative-toward-fleet).
  if (!isPush && (!resolved || !isFleetRepo(resolved))) {
    const upUrl = remoteUrlFn(dir, 'upstream');
    const up = upUrl ? normalizeRepoTarget(upUrl) : null;
    if (up && isFleetRepo(up)) return up;
  }
  return resolved;
}

// ─── Lock read (read-only) + telemetry (mirrors WorktreeMemoryWriteGuard) ─────

/** Lock path: DOS_DEPLOYLINE_LOCK override (tests) → ~/Durante/deployline/.driver.lock. */
function deployLineLockPath(): string {
  return process.env.DOS_DEPLOYLINE_LOCK || join(homedir(), 'Durante', 'deployline', '.driver.lock');
}

function readLock(): DeployLineLock | null {
  try {
    const p = deployLineLockPath();
    if (!existsSync(p)) return null;
    return parseDriverLock(readFileSync(p, 'utf-8'));
  } catch {
    return null; // absent/unreadable lock reads as "no lock" — fail toward flagging
  }
}

function recordEvent(
  command: string,
  decision: DeployGuardDecision,
  currentSession: string,
  lock: DeployLineLock | null,
  mode: 'warn' | 'block',
): void {
  try {
    // Canonical project-first STATE resolution (lib/paths.ts) — do not hand-roll
    // the CLAUDE_PROJECT_DIR/MEMORY cascade here (RFC-0125 finding-4 bug class).
    const stateDir = getMemorySubdir('STATE');
    mkdirSync(stateDir, { recursive: true });
    const path = join(stateDir, 'deployline-guard-events.jsonl');
    const entry = {
      timestamp: new Date().toISOString(),
      session_id: currentSession || 'session-unknown',
      command: command.slice(0, 500),
      action: decision.action,
      reason: decision.reason ?? null,
      stale: decision.stale ?? false,
      lock_session: lock?.session ?? null,
      lock_pid: lock?.pid ?? null,
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
    const command = typeof toolInput.command === 'string' ? toolInput.command : '';

    // Fast path: only Bash delivery mutations are ever fenced.
    if (toolName !== 'Bash' || !isDeliveryMutation(command)) {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const lock = readLock();
    // Canonical session sourcing: payload session_id first, env fallback
    // (lib/paths.ts resolveSessionId, RFC-0125 finding 5). Env-only sourcing
    // false-flags the legitimate lock owner when hook env lacks the var.
    const currentSession = resolveSessionId(input as { session_id?: string });
    // Liveness probe only when the decision will read it (non-owner path).
    const holderPidAlive = lock && lock.session !== currentSession ? isPidAlive(lock.pid) : true;

    // Repo-scope resolution (Ring-0 incident 2026-07-10): a mutation targeting
    // a foreign repo is none of the guard's business. Skipped on the owner
    // fast-path — the deploy-line owner is allowed in every scope, so the git
    // config reads would be pure waste on the hot autonomous-merge path.
    const isOwner = !!lock && lock.session === currentSession;
    const cwd = typeof (input as { cwd?: string }).cwd === 'string' ? (input as { cwd?: string }).cwd! : process.cwd();
    const repoScope = isOwner ? 'fleet' : classifyRepoScope(resolveTargetRepo(command, cwd), command);

    const decision = decideDeployLineGuard({ toolName, command, lock, currentSession, holderPidAlive, repoScope });

    if (decision.action === 'allow') {
      if (decision.reason) {
        // Unknown-scope pass-through: logged warning, never a block (see
        // classifyRepoScope trade-off note).
        console.error(`[DeployLineGuard] NOTE (allowed): ${decision.reason} → ${command.slice(0, 200)}`);
      }
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const enforce = process.env.DOS_ENFORCEMENT_MODE_DEPLOYLINE_GUARD === 'block';
    recordEvent(command, decision, currentSession, lock, enforce ? 'block' : 'warn');

    if (enforce) {
      console.error(buildBlockReason(decision, command));
      process.exit(2);
    }

    // WARN-mode default: log, but let the command through.
    console.error(`[DeployLineGuard] WARN (would block in enforce mode): ${decision.reason} → ${command.slice(0, 200)}`);
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  } catch (err) {
    // A guard must never take down a real tool call. Fail open on any error.
    console.error('[DeployLineGuard] internal error — failing open:', err);
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}
