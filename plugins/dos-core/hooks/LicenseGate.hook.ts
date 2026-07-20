#!/usr/bin/env bun
/**
 * LicenseGate.hook.ts — SessionStart license-gate (RFC-0158, Gate 3 SOFT).
 *
 * v0.0.23 W3-S2 (hardened 2026-07-19, upgrade-scan CRITICAL-1). Asks Studio's
 * net-new POST /api/v1/license/validate what tier + metered capabilities this
 * install's StudioApiKey has, and records the verdict at
 * MEMORY/STATE/license-gate.json for UI/pack surfaces to soft-degrade on.
 *
 * SOFTNESS IS THE CONTRACT — this hook NEVER blocks a session. It exits 0 on
 * EVERY path (RFC-0158 §3, RedTeam S4: the client hook is user-editable by
 * construction, so it is DEFINED as UX-only; no server behavior may trust it).
 * The `posture` knob below therefore does NOT gate the session — it only tilts
 * the STATE FILE that downstream surfaces read.
 *
 *   - missing STUDIO_API_URL / STUDIO_API_KEY  → exit 0, silent
 *   - network failure / timeout (2s budget)    → degrade(), exit 0
 *   - malformed / shape-drifted response       → degrade(), exit 0 — RedTeam
 *     S2: a machine-seat shape (bare valid:true) is never coerced into an
 *     entitlement verdict
 *   - lapsed (tier 'none')                     → one-line soft banner + state
 *     file, exit 0 — metered packs degrade in UX, nothing hard-fails
 *
 * HARDENING (upgrade-scan CRITICAL-1, 2026-07-19) — a command hook's DEFAULT
 * timeout is 600s, so a license-gate network call to a slow/unreachable Studio
 * could stall session start for up to ten minutes. The gate must carry:
 *   (a) an explicit HARD TIMEOUT on the network call — FETCH_BUDGET_MS (2s),
 *       far below the 600s default, applied to fetch AND (verified empirically)
 *       to a hung body read via the same AbortSignal, so a slowloris body can't
 *       outlast the budget.
 *   (b) an explicit FAIL-OPEN-vs-FAIL-CLOSED posture behind ONE named switch
 *       (DOS_LICENSE_GATE_POSTURE) — default fail-open. The decision is the
 *       operator's; flipping it is one env var.
 *   (c) PERSISTENT last-known-good gate state kept OUT of CLAUDE_PLUGIN_ROOT —
 *       the plugin's install/cache dir (~/.claude/plugins/cache/...) is
 *       EPHEMERAL: replaced on plugin update, old versions cleaned up ~7d later.
 *       State lives in the DOS MEMORY/STATE convention this hook already uses
 *       (doc-sanctioned persistent alternative: $CLAUDE_PLUGIN_DATA). On a
 *       failure the gate reads its own prior VERIFIED verdict and, if fresh
 *       (<= MAX_CACHE_AGE_MS), carries it forward — a 2s blip never flips a
 *       paying customer's UX.
 *   (d) tolerance for marketplace semantics where installed plugins stay pinned:
 *       marketplace refresh/auto-update skips a plugin whose resolved version
 *       already matches the installed one, so clients stay pinned until an
 *       explicit reinstall. The staleness bound stops a long-offline pinned
 *       install from riding a stale entitlement forever; the `contract` stamp
 *       lets surfaces spot a pinned-stale gate; unknown tiers/extra fields are
 *       ignored, not mis-verdicted.
 *
 * Server-side enforcement (Gate 4) lives in the Studio gateway routes; this
 * hook is UX-only by design. Blocking the local session or hard-disabling packs
 * here would only punish offline use.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { getMemorySubdir } from './lib/paths';
import { getStudioConfig } from './lib/studioClient';

// (a) Hard network budget — the command-hook default timeout is 600s, so
// without an explicit short budget an unreachable Studio could stall session
// start for ten minutes. Bounds both the fetch and — verified against a
// headers-then-hang body fixture — the subsequent response.json() body read,
// because the same AbortSignal errors an in-flight body stream.
const FETCH_BUDGET_MS = 2_000;

// (c)/(d) Last-known-good staleness bound. A fresh verified verdict is carried
// forward across a transient Studio outage; older than this it is discarded so
// a marketplace-pinned, long-offline install cannot ride a dead subscription
// forever. Idiom matches KgMerge.hook.ts SOAK_MS (7d).
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// (d) Stamped into every state write so a downstream surface can detect a
// pinned-stale gate whose response contract has drifted from Studio's.
const GATE_CONTRACT = 'v1';

// Free-vs-paid boundary — the operator-ruled set of metered packs (2026-07-19).
// This is ADVISORY ONLY: computeBlockedPacks records which packs a caller is not
// entitled to into the state file for UI/pack surfaces to soft-degrade on. It
// NEVER enforces — the hook still exits 0 on every path (RFC-0158 Gate 3 SOFT).
// Server-side Gate 4 + the credit ledger remain the real economic controls.
const GATED_PACKS: readonly string[] = [
  'sales',
  'bdr',
  'pitch-deck',
  'startup-investor-docs',
  'contract-review',
  'compliance',
  'investigation',
  'growth-program',
  'dream-team',
  'brand',
  'design-bundle',
  'chief-of-staff',
  'stream-rig',
  'social-media',
  'us-metrics',
];

type Verdict = 'entitled' | 'lapsed' | 'inconclusive' | 'unreachable';
type DegradeReason = 'unreachable' | 'inconclusive';

// (b) fail-open (permissive default) vs fail-closed (degrade when unverifiable).
type Posture = 'open' | 'closed';

interface GateState {
  verdict: Verdict;
  tier?: string;
  entitlements?: string[];
  mode?: string;
  /** Advisory set of metered packs this caller is not entitled to (empty when
   *  entitled). NEVER enforced — a UX/soft-degrade signal only. */
  blockedPacks: string[];
  /** 'live' = this run reached Studio; 'cache' = carried forward last-known-good. */
  source?: 'live' | 'cache';
  /** On a degrade with no usable cache, records which way posture leaned. */
  degraded?: Posture;
  /** On a carry-forward, why the live check failed. */
  degradeReason?: DegradeReason;
  /** Wall-clock of the last LIVE verification — freshness is measured off this,
   *  never off a chain of cache rewrites. */
  lastVerifiedAt?: string;
}

/**
 * Which gated packs to surface as blocked. Mechanism only: an entitled caller
 * blocks nothing; a non-entitled caller blocks the whole gated set. No
 * pack→capability policy is baked in beyond the operator-ruled GATED_PACKS
 * list, and the result is advisory state — never an enforcement decision.
 */
function computeBlockedPacks(entitled: boolean): string[] {
  if (GATED_PACKS.length === 0) return [];
  return entitled ? [] : [...GATED_PACKS];
}

type StoredState = GateState & { checkedAt?: string; contract?: string };

/**
 * (b) The single operator switch. Default fail-open; only the exact string
 * 'closed' selects fail-closed, so an unknown/typo'd value can never
 * accidentally degrade every session (mirrors RFC-0158 §4.4 mode-ladder tilt).
 */
function resolvePosture(): Posture {
  return process.env.DOS_LICENSE_GATE_POSTURE === 'closed' ? 'closed' : 'open';
}

/** True when `child` is `parent` or lives beneath it. */
function isUnder(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * (c) Resolve where gate state lives. Test seam first; otherwise the DOS
 * MEMORY/STATE convention (project-first) that this hook's downstream surfaces
 * read. That must never resolve INSIDE CLAUDE_PLUGIN_ROOT — a plugin's
 * install/cache dir is ephemeral (replaced on update, old versions GC'd ~7d
 * later), so a cache written there would vanish exactly when a pinned/offline
 * install needs it. If resolution ever lands there, anchor to the
 * doc-sanctioned persistent $CLAUDE_PLUGIN_DATA dir, else a stable home path.
 */
function resolveStateDir(): string {
  const override = process.env.DOS_LICENSE_GATE_STATE_DIR;
  if (override) return override;

  const resolved = getMemorySubdir('STATE');
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot && isUnder(resolved, pluginRoot)) {
    return (
      process.env.CLAUDE_PLUGIN_DATA ??
      join(homedir(), '.claude', 'MEMORY', 'STATE')
    );
  }
  return resolved;
}

function statePath(): string {
  return join(resolveStateDir(), 'license-gate.json');
}

function writeState(state: GateState): void {
  try {
    const dir = resolveStateDir();
    mkdirSync(dir, { recursive: true });
    const checkedAt = new Date().toISOString();
    // A live-verified verdict stamps lastVerifiedAt=now; a carry-forward keeps
    // the original so freshness ages against the real last contact.
    const lastVerifiedAt =
      state.lastVerifiedAt ?? (state.source === 'live' ? checkedAt : undefined);
    writeFileSync(
      statePath(),
      JSON.stringify(
        { ...state, lastVerifiedAt, checkedAt, contract: GATE_CONTRACT },
        null,
        2,
      ),
    );
  } catch {
    // State write is best-effort — soft gate stays soft.
  }
}

/** (c) Read the prior verdict this gate wrote for itself. Best-effort. */
function readPriorState(): StoredState | null {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8')) as StoredState;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** (c)/(d) Fresh iff the last LIVE verification is within the staleness bound. */
function isFresh(state: StoredState): boolean {
  const stamp = state.lastVerifiedAt ?? state.checkedAt;
  if (!stamp) return false;
  const age = Date.now() - new Date(stamp).getTime();
  return Number.isFinite(age) && age >= 0 && age < MAX_CACHE_AGE_MS;
}

/**
 * (b)/(c) The failure path — Studio was unreachable or its response was
 * unusable. Never coerces the FAILED response into a verdict (RedTeam S2);
 * instead it carries forward the gate's own prior VERIFIED state, or falls to
 * the operator's posture default. Always writes state, always returns (exit 0
 * is owned by main().finally).
 *
 * PRECEDENCE (operator decision, filed to the decision stream): a FRESH,
 * definitively-verified prior verdict is honored FIRST — carried forward even
 * under fail-CLOSED, because it is real recent data, not a guess. Posture
 * governs only the NO-fresh-evidence case. The alternative reading —
 * fail-closed should distrust ALL cached state and degrade on any live-check
 * miss — is a legitimate operator choice; flipping precedence would move the
 * posture check above this block. Shipped default = honor fresh cache.
 */
function degrade(reason: DegradeReason): void {
  const prior = readPriorState();

  // Transient-resilience: a fresh, definitively-verified prior verdict is real
  // data (from a real tier+mode response), not a guess — carry it forward
  // across a blip regardless of posture. Bounded by MAX_CACHE_AGE_MS so a
  // pinned/offline install cannot ride it indefinitely (the marketplace case).
  // Shape-guard the cached fields (S2): a corrupted state file must not
  // propagate a malformed entitlement — require a string tier before trusting.
  if (
    prior &&
    (prior.verdict === 'entitled' || prior.verdict === 'lapsed') &&
    typeof prior.tier === 'string' &&
    isFresh(prior)
  ) {
    writeState({
      verdict: prior.verdict,
      tier: prior.tier,
      entitlements: Array.isArray(prior.entitlements) ? prior.entitlements : [],
      mode: typeof prior.mode === 'string' ? prior.mode : undefined,
      // Advisory blockedPacks derived from the carried verdict (recomputed, not
      // trusted from the possibly-stale prior.blockedPacks field).
      blockedPacks: computeBlockedPacks(prior.verdict === 'entitled'),
      source: 'cache',
      degradeReason: reason,
      lastVerifiedAt: prior.lastVerifiedAt ?? prior.checkedAt,
    });
    return;
  }

  // No usable cache → posture decides the lean. The session still starts
  // (exit 0); posture only tilts the state file (and, fail-closed, surfaces a
  // banner so the operator's choice is observable). No `source` (S1): this run
  // produced NO verified data, so writeState must NOT stamp a fresh
  // lastVerifiedAt — a failed check can never masquerade as a live verification.
  // Advisory blockedPacks: fail-open surfaces nothing; fail-closed surfaces the
  // gated set (still advisory — no enforcement, the session is unaffected).
  const posture = resolvePosture();
  writeState({
    verdict: reason,
    degraded: posture,
    blockedPacks: posture === 'closed' ? [...GATED_PACKS] : [],
  });
  if (posture === 'closed') {
    console.log(
      '⚠ License gate: entitlement unverifiable and posture is fail-closed — metered packs run degraded (soft gate; session unaffected).',
    );
  }
}

async function main(): Promise<void> {
  // Canonical env resolution (studioClient owns the preamble — this hook must
  // not become another hand-rolled copy of it).
  const config = getStudioConfig();
  if (!config) return; // Unconfigured install — nothing to validate.

  let response: Response;
  try {
    response = await fetch(`${config.url}/api/v1/license/validate`, {
      method: 'POST',
      headers: config.authHeader,
      signal: AbortSignal.timeout(FETCH_BUDGET_MS), // (a) hard budget
    });
  } catch {
    degrade('unreachable'); // (c) carry forward last-known-good, else posture
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    degrade('inconclusive');
    return;
  }

  // RedTeam S2 shape assertion: the entitlement endpoint ALWAYS carries
  // tier + mode. Anything else (machine-seat shape, error page, proxy rewrite,
  // a pinned hook vs a drifted Studio) is a failed check — degrade, never a
  // verdict fabricated from the current response.
  if (
    !response.ok ||
    typeof body.tier !== 'string' ||
    typeof body.mode !== 'string'
  ) {
    degrade('inconclusive');
    return;
  }

  const tier = body.tier;
  const entitlements = Array.isArray(body.entitlements)
    ? (body.entitlements as string[])
    : [];

  if (tier === 'none') {
    writeState({
      verdict: 'lapsed',
      tier,
      entitlements,
      mode: body.mode,
      blockedPacks: computeBlockedPacks(false), // no tier → all gated packs advisory-degraded
      source: 'live',
    });
    // One soft banner line into session context — UX signal only.
    console.log(
      '⚠ License gate: no active subscription tier — metered packs run degraded (soft gate; see Studio billing settings).',
    );
    return;
  }

  writeState({
    verdict: 'entitled',
    tier,
    entitlements,
    mode: body.mode,
    blockedPacks: computeBlockedPacks(true), // entitled → nothing blocked
    source: 'live',
  });
}

main()
  .catch(() => {
    // Soft gate: even an unexpected throw must not block SessionStart.
  })
  .finally(() => {
    process.exit(0);
  });
