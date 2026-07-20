#!/usr/bin/env bun
/**
 * RedTeamPendingGate.hook.ts — PreToolUse (all tools)
 *
 * Sibling gate for CouncilUnanimousRedTeam.hook.ts (Amendment I-1).
 *
 * When the main hook detects a unanimous E4+ Council cluster, it writes a
 * flag-file at MEMORY/STATE/redteam-pending-{session_id}-{cluster_id}.json.
 * This gate fires on EVERY subsequent tool-use and:
 *
 *   1. Receipt-clear (per Council D3 — METHOD inside this file, NOT separate
 *      hook): if the incoming tool-use is a `Task` spawning a RedTeam-style
 *      subagent referencing a pending cluster, delete the matching flag file
 *      and allow the tool-use to proceed.
 *
 *   2. Override-clear: scan the active PRD's `## Decisions` section for
 *      `Override RedTeam-pending <cluster_id> reason: <text>` lines per
 *      Amendment H §H.3 / Cato F4 unified-override convention; delete the
 *      matching flag file(s) and allow.
 *
 *   3. Block: if any active flag remains after receipt + override sweeps,
 *      emit a denial with the cluster id, the spawning instructions, and the
 *      override syntax. Returns {continue: false, decision: "block"}.
 *
 * Surface (c) decision rationale (Council D2, 4-of-5 seats): mirrors
 * Amendment H QATesterGate Path B Day-1 pattern. The flag file is the
 * "pending" state; the gate is the forcing function; the receipt + override
 * are the two clear paths. Young dissented for (a) stderr directive — preserved
 * as fallback if (c) surfaces a hook-orchestration limit.
 *
 * Anti-criterion ISC-ANTI-5: this gate does NOT block while RedTeam itself
 * is running — RedTeam Tasks (matching the receipt heuristic) pass through.
 * It blocks ONLY the next non-RedTeam-spawning tool-use that hasn't acked.
 */

import {
  readFileSync, readdirSync, unlinkSync, existsSync, statSync,
} from 'node:fs';
import { join } from 'node:path';
import { getMemorySubdir } from './lib/paths';
import { resolveActivePrdSlug } from './lib/spawn-attribution';
import { readHookInput } from './lib/hook-io';

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

interface RedTeamPendingFlag {
  schema_version: number;
  timestamp: string;
  session_id: string;
  prd_slug: string;
  cluster_id: string;
  reason: string;
  council_seats: string[];
  verdict_summary: string;
}

/**
 * Heuristic: does this tool-use look like a RedTeam spawn?
 *
 *   - tool_name === 'Task'
 *   - AND (subagent_type matches /redteam/i OR description matches /red[\s-]?team/i
 *          OR prompt matches /red[\s-]?team/i for the first 256 chars)
 *
 * The Council skill spawns RedTeam via Task(subagent_type='general-purpose',
 * prompt=REDTEAM_INSTRUCTIONS + transcript) per CouncilMembers.md — so the
 * prompt-scan is necessary; subagent_type alone is insufficient.
 */
export function looksLikeRedTeamSpawn(tool: string, input: Record<string, unknown>): boolean {
  if (tool !== 'Task') return false;
  const subagentType = String(input.subagent_type ?? '').toLowerCase();
  if (/red[\s-]?team/.test(subagentType)) return true;
  const description = String(input.description ?? '').toLowerCase();
  if (/red[\s-]?team/.test(description)) return true;
  const prompt = String(input.prompt ?? '').slice(0, 512).toLowerCase();
  if (/red[\s-]?team/.test(prompt)) return true;
  return false;
}

/**
 * Extract the cluster_id (if any) the RedTeam spawn is addressing. Looks for
 * `cluster_id=<id>` or `cluster <id>` in the prompt's first 1024 chars.
 * Returns null if no cluster reference found — in which case ALL pending
 * flags for this session are cleared (the operator/agent is acknowledging
 * the pending state with a RedTeam spawn).
 */
export function extractClusterFromRedTeamPrompt(input: Record<string, unknown>): string | null {
  const prompt = String(input.prompt ?? '').slice(0, 1024);
  const m1 = prompt.match(/cluster[_\s-]?id\s*[=:]\s*([A-Za-z0-9_-]+)/i);
  if (m1) return m1[1];
  const m2 = prompt.match(/\bcluster\s+([A-Za-z0-9_-]+)/i);
  if (m2) return m2[1];
  const m3 = prompt.match(/\bcand(?:idate)?\s+([A-Za-z0-9_-]+)/i);
  if (m3) return m3[1];
  return null;
}

/**
 * Stale-flag TTL — bypass flag files whose mtime is older than this many
 * milliseconds. A crashed RedTeam Agent or a session-close without receipt
 * would otherwise leave the flag in place forever, wedging the NEXT session
 * that happens to inherit the same session_id (Cato F3 ship-blocker fix
 * 2026-05-26).
 *
 * Semantics:
 *   - The flag is skipped (treated as if it did not exist) when
 *     `Date.now() - statSync(path).mtimeMs > FLAG_MAX_AGE_MS`.
 *   - One stderr warning is emitted PER SESSION listing the bypassed flag
 *     paths — enough operator signal that a flag was stale, without spamming
 *     every tool-use.
 *   - The stale flag file is NOT deleted inline. A SessionEnd cleanup task
 *     in SYNC_TOOLS registry is the recommended longer-term path; that is a
 *     separate child-PRD scope. Leaving the file lets a subsequent
 *     post-mortem inspect what wedged.
 *
 * 4 hours is the chosen TTL: comfortably longer than the longest RedTeam
 * round trip (parent PRD 20260526-191054 RedTeam ran in ~6min wall time),
 * shorter than the gap between two work sessions where session_id reuse is
 * plausible.
 */
const FLAG_MAX_AGE_MS = 4 * 60 * 60 * 1000;

/** Per-session sentinel — emit the "bypassed stale flags" warning at most once. */
let staleWarningEmitted = false;

/**
 * List all active flag files for this session. Returns array of {path, flag}.
 * Files that fail to parse OR whose mtime exceeds FLAG_MAX_AGE_MS are
 * silently skipped (fail-open + stale-bypass per Cato F3 fix).
 */
export function listPendingFlags(sessionId: string): Array<{ path: string; flag: RedTeamPendingFlag }> {
  const stateDir = getMemorySubdir('STATE');
  if (!existsSync(stateDir)) return [];
  const prefix = `redteam-pending-${sessionId}-`;
  const out: Array<{ path: string; flag: RedTeamPendingFlag }> = [];
  const bypassed: string[] = [];
  const now = Date.now();
  try {
    for (const name of readdirSync(stateDir)) {
      if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
      const p = join(stateDir, name);
      try {
        // Stale check FIRST — cheaper than JSON parse, and a stale flag
        // shouldn't influence the gate even if it parses cleanly.
        const ageMs = now - statSync(p).mtimeMs;
        if (ageMs > FLAG_MAX_AGE_MS) {
          bypassed.push(name);
          continue;
        }
        const flag = JSON.parse(readFileSync(p, 'utf-8')) as RedTeamPendingFlag;
        out.push({ path: p, flag });
      } catch { /* skip malformed or unstatable */ }
    }
  } catch { /* stateDir gone — no pending */ }
  if (bypassed.length > 0 && !staleWarningEmitted) {
    staleWarningEmitted = true;
    process.stderr.write(
      `[RedTeamPendingGate] bypassed ${bypassed.length} stale flag(s) ` +
      `(>${FLAG_MAX_AGE_MS / (60 * 60 * 1000)}h old): ${bypassed.join(', ')} ` +
      `— follow-up: SessionEnd cleanup task in SYNC_TOOLS recommended\n`
    );
  }
  return out;
}

/**
 * Bounded-head PRD frontmatter + section reader. Reads first 16KB of PRD to
 * find `## Decisions` section and scan it for override lines. The full body
 * read is bounded so this PreToolUse hot path stays fast.
 *
 * Override syntax (matches Amendment H §H.3 / Cato F4):
 *   Override RedTeam-pending <cluster_id> reason: <≤32-word reason>
 *
 * Returns the set of cluster_ids whose override line was found.
 */
export function findOverriddenClusters(prdPath: string): Set<string> {
  const overridden = new Set<string>();
  try {
    if (!existsSync(prdPath)) return overridden;
    // Read the WHOLE PRD: ## Decisions (where override lines live) sits near the
    // END, past the prior 16KB bounded-head read — a late override was silently
    // missed → wrong-block until the 4h TTL (RFC-0125 follow-up). This runs only
    // when a flag is pending (rare), so a full read is acceptable.
    const body = readFileSync(prdPath, 'utf-8');
    // Cluster ids can contain spaces ("Cand 1", CouncilUnanimousRedTeam:107), so
    // capture non-greedily up to " reason:" rather than a [A-Za-z0-9_-]+ class
    // that truncates at the space and never matches flag.cluster_id.
    const re = /Override\s+RedTeam-pending\s+(.+?)\s+reason:\s*\S/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) overridden.add(m[1].trim());
  } catch { /* fail-open: no overrides detected */ }
  return overridden;
}

/**
 * Resolve active PRD path for this session — re-implements the slug→path
 * walk from CouncilUnanimousRedTeam.hook.ts (kept local to avoid cross-hook
 * import couplings on the PreToolUse hot path).
 */
export function resolveActivePrdPath(sessionId: string): string | null {
  // Delegate to the SHARED resolver (lib/spawn-attribution) so this gate uses
  // the same current-active resolution as the tally — and inherits its
  // phase:complete filter. The prior local mtime fallback did NOT skip
  // completed PRDs, so it could resolve a completed PRD and scan the wrong
  // ## Decisions for an override → miss it → wrong-block until the 4h TTL
  // (RFC-0125 finding-6/9 family follow-up). prdPathForSlug maps slug → path.
  const slug = resolveActivePrdSlug(sessionId);
  return slug !== 'unknown' ? prdPathForSlug(slug) : null;
}

/**
 * Receipt-clear method (per Council D3 — INSIDE this file, NOT separate hook).
 * Deletes flag file(s) corresponding to a RedTeam spawn. Returns count deleted.
 */
function receiptClear(
  _sessionId: string,
  input: Record<string, unknown>,
  pending: Array<{ path: string; flag: RedTeamPendingFlag }>
): number {
  const targetCluster = extractClusterFromRedTeamPrompt(input);
  let cleared = 0;
  for (const { path, flag } of pending) {
    if (targetCluster === null || flag.cluster_id === targetCluster) {
      try { unlinkSync(path); cleared++; }
      catch { /* best-effort */ }
    }
  }
  return cleared;
}

/** Resolve a PRD path from its slug — WORK/{slug}/PRD.md or WORK/active/{slug}/PRD.md. */
export function prdPathForSlug(slug: string): string | null {
  if (!slug) return null;
  const workDir = getMemorySubdir('WORK');
  for (const root of [workDir, join(workDir, 'active')]) {
    const prd = join(root, slug, 'PRD.md');
    if (existsSync(prd)) return prd;
  }
  return null;
}

/**
 * PURE: decide which pending flag paths should be override-cleared.
 *
 * A flag is cleared when its `cluster_id` is overridden in the UNION of two PRDs:
 *   (1) the flag's OWN `prd_slug` PRD — the authoritative slug CouncilUnanimousRedTeam
 *       stamps at flag-write (closes RFC-0125 finding 6/9: the old code scanned only a
 *       re-resolved "active" PRD, which drifts under multi-PRD/mtime change → missed the
 *       override → wrong-block until the 4h TTL); AND
 *   (2) the current active PRD (`activeOverrides`) — because the denial message tells the
 *       operator to author the override in "PRD ## Decisions" without naming which PRD, so
 *       the natural spot is the PRD they're currently in. Scanning only (1) would miss that,
 *       and would leave a flag stamped `prd_slug:"unknown"` (the writer's fallthrough value)
 *       permanently un-clearable.
 *
 * The union is safe: clearing a flag is a monotonic, operator-initiated waiver, so honoring
 * an explicit override in EITHER PRD cannot over-clear beyond operator intent.
 *
 * `readOverrides` (per-flag-slug) is injected for testability; its per-slug result is
 * memoized so N flags sharing a slug read once.
 */
export function flagsToClear(
  pending: Array<{ path: string; flag: RedTeamPendingFlag }>,
  readOverrides: (prdSlug: string) => Set<string>,
  activeOverrides: Set<string> = new Set<string>(),
): string[] {
  const cache = new Map<string, Set<string>>();
  const out: string[] = [];
  for (const { path, flag } of pending) {
    let ov = cache.get(flag.prd_slug);
    if (!ov) { ov = readOverrides(flag.prd_slug); cache.set(flag.prd_slug, ov); }
    if (ov.has(flag.cluster_id) || activeOverrides.has(flag.cluster_id)) out.push(path);
  }
  return out;
}

function buildDenialMessage(pending: Array<{ flag: RedTeamPendingFlag }>): string {
  const lines: string[] = [
    'BLOCKED — RedTeam pending on Council-unanimous cluster(s)',
    '',
  ];
  for (const { flag } of pending) {
    lines.push(`  cluster: ${flag.cluster_id}`);
    lines.push(`  seats:   ${flag.council_seats.join(', ')} (${flag.verdict_summary})`);
    lines.push(`  reason:  Amendment I-1 — N-of-N unanimous at tier >= E4 requires RedTeam pass`);
    lines.push('');
  }
  lines.push('  resolve via either:');
  lines.push('    1. Spawn a RedTeam Agent — e.g.');
  lines.push('         Task(subagent_type=\'general-purpose\',');
  lines.push('              description=\'RedTeam adversarial review\',');
  lines.push('              prompt=\'... cluster_id=<id> ...\')');
  lines.push('    2. Operator override in PRD ## Decisions:');
  lines.push('         Override RedTeam-pending <cluster_id> reason: <reason>');
  return lines.join('\n');
}

async function main(): Promise<void> {
  // Shared async reader (H-034: cancels the pending stdin read) rather than a
  // bare synchronous readFileSync(0). readFileSync(0) blocks the process to
  // stdin-EOF and NO timer can interrupt a blocking syscall — a hang here
  // stalls the very next tool-use because this gate fires on EVERY PreToolUse
  // (Forge H-048, the broadest-surface instance of the sync-read hang class).
  const input = (await readHookInput()) as unknown as HookInput | null;
  if (!input) { allow(); return; }

  const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || 'unknown';
  const pending = listPendingFlags(sessionId);
  if (pending.length === 0) { allow(); return; }

  const tool = input.tool_name ?? '';
  const toolInput = input.tool_input ?? {};

  // Path 1 — Receipt-clear. RedTeam-style Task spawn → delete matching flags
  // and ALLOW the tool-use to proceed (RedTeam is itself the resolution).
  if (looksLikeRedTeamSpawn(tool, toolInput)) {
    receiptClear(sessionId, toolInput, pending);
    allow();
    return;
  }

  // Path 2 — Override-clear. A flag clears when its cluster is overridden in the
  // UNION of (a) the flag's OWN prd_slug PRD (authoritative, stamped at flag-write —
  // closes RFC-0125 finding 6/9) and (b) the current active PRD (where the operator
  // naturally authors the override per the denial message). Union is safe: clearing
  // is a monotonic operator waiver. resolveActivePrdPath supplies leg (b) — and covers
  // the prd_slug:"unknown" fallthrough case that leg (a) alone cannot resolve.
  const activePrd = resolveActivePrdPath(sessionId);
  const activeOverrides = activePrd ? findOverriddenClusters(activePrd) : new Set<string>();
  const toClear = flagsToClear(pending, (slug) => {
    const p = prdPathForSlug(slug);
    return p ? findOverriddenClusters(p) : new Set<string>();
  }, activeOverrides);
  if (toClear.length > 0) {
    for (const p of toClear) { try { unlinkSync(p); } catch { /* best-effort */ } }
    // Re-check after override-clear.
    const stillPending = listPendingFlags(sessionId);
    if (stillPending.length === 0) { allow(); return; }
    pending.length = 0;
    pending.push(...stillPending);
  }

  // Path 3 — Block.
  const reason = buildDenialMessage(pending);
  console.log(JSON.stringify({
    continue: false,
    decision: 'block',
    reason,
    stopReason: 'RedTeam-pending: Amendment I-1 unanimous Council at tier >= E4',
  }));
  process.exit(0);
}

function allow(): void {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

if (import.meta.main) {
  main().catch(() => {
    // Fail open — never block on internal error.
    allow();
  });
}
