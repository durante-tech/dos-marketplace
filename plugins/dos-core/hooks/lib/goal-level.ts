/**
 * goal-level.ts — pure altitude classifier for the RFC-0156 goal-level router.
 *
 * Classifies an operator prompt's GOAL LEVEL (Cockburn altitude) so the entry
 * point can pick machinery, not effort (effort/mode stays owned by
 * lib/mode-classifier.ts — this module is orthogonal to it):
 *
 *   fish — sub-feature ("fix this bug", "rename X")   → Algorithm NATIVE/fast-path
 *   sea  — one feature ("deliver invoice export")     → one delivery loop (Ring 0)
 *   kite — multi-feature campaign                     → board PROPOSAL (never provision)
 *
 * Kite requires a DUAL SIGNAL (RFC-0156 build D8 — council/Skeptic): campaign
 * vocabulary or concurrency phrasing alone is not enough; it must co-occur with
 * delivery-verb or enumeration evidence. Known accepted false negatives are
 * documented in GoalLevelRouter.test.ts — misses degrade to sea/fish, which is
 * the safe direction (a proposal not shown, never a fleet provisioned by error).
 *
 * Pure, zero-I/O, synchronous. Regex-only — no inference calls (the same
 * discipline as lib/mode-classifier.ts, which this module borrows constants from).
 */

import {
  ALGORITHM_RE,
  NATIVE_ARCHETYPE_RE,
  REPAIR_VERB_RE,
} from './mode-classifier';

/** Kite's delivery-evidence half is HEAVY delivery verbs only — deliberately
 *  narrower than ALGORITHM_RE, whose review/analyze/plan/propose members are
 *  routine single-feature vocabulary on this host (2026-07-10 review: 'review
 *  the roadmap' must never satisfy the kite dual signal). */
export const KITE_DELIVERY_RE = /\b(ship|build|deliver|implement|refactor|migrate|launch)\b/i;

export type Altitude = 'fish' | 'sea' | 'kite';

/** Route names are the RFC-0156 §3 table's machinery column, as stable tokens. */
export const ROUTE_BY_ALTITUDE: Record<Altitude, string> = {
  fish: 'native-or-fast-path',
  sea: 'single-delivery-loop',
  kite: 'board-proposal',
};

export interface AltitudeDecision {
  altitude: Altitude;
  route: string;
  /** Which signals matched — the audit line's evidence field. */
  matched: string[];
}

// ─── Kite signals (dual-signal contract) ────────────────────────────────────

/** Concurrency phrasing bound to a HEAVY delivery verb — "while I also grab
 *  coffee" and "while I also update the README" deliberately do NOT match. */
export const KITE_CONCURRENT_RE =
  /\bwhile (i|we) (also )?(ship|build|deliver|implement|refactor)\b|\bin parallel with (the )?\w+ (feature|epic|work)\b/i;

/** Campaign vocabulary — multi-feature container nouns. */
export const KITE_CAMPAIGN_RE =
  /\b(epic|campaign|roadmap|multiple features|all (of )?the features|a fleet of|second loop)\b/i;

/** Enumeration evidence: a list-introducing colon (colon + whitespace)
 *  followed by 3+ comma-separated items. The mandatory whitespace excludes
 *  URL colons (https://…) and clock times (14:30) — both confirmed kite
 *  false-positive vectors in the 2026-07-10 review. */
export const ENUMERATION_RE = /:\s+[^,\n]+(,\s*[^,\n]+){2,}/;

// ─── Classifier ─────────────────────────────────────────────────────────────

export function classifyAltitude(humanText: string): AltitudeDecision {
  const text = humanText.trim();
  const matched: string[] = [];

  const hasHeavyDelivery = KITE_DELIVERY_RE.test(text);
  const hasEnumeration = ENUMERATION_RE.test(text);

  // kite — dual signal only, and only HEAVY delivery verbs count.
  if (KITE_CONCURRENT_RE.test(text)) matched.push('concurrent-delivery-phrasing');
  if (KITE_CAMPAIGN_RE.test(text)) matched.push('campaign-vocabulary');
  if (matched.length > 0 && (hasHeavyDelivery || hasEnumeration)) {
    if (hasHeavyDelivery) matched.push('delivery-keyword');
    if (hasEnumeration) matched.push('enumeration');
    return { altitude: 'kite', route: ROUTE_BY_ALTITUDE.kite, matched };
  }
  matched.length = 0; // single-signal kite evidence does not carry down

  // sea — one-feature delivery evidence (the broad work-keyword family).
  if (ALGORITHM_RE.test(text)) {
    matched.push('delivery-keyword');
    return { altitude: 'sea', route: ROUTE_BY_ALTITUDE.sea, matched };
  }

  // fish — sub-feature archetypes, repair verbs, and the no-evidence residual.
  if (NATIVE_ARCHETYPE_RE.test(text)) matched.push('native-archetype');
  if (REPAIR_VERB_RE.test(text)) matched.push('repair-verb');
  if (matched.length === 0) matched.push('no-evidence-residual');
  return { altitude: 'fish', route: ROUTE_BY_ALTITUDE.fish, matched };
}

// ─── Kite proposal text (inert — RFC-0156 ISC-10) ───────────────────────────

/** The proposal NEVER provisions anything; it names the opt-in. Board substrate
 *  is a local file first (RFC-0156 OQ-1 operator resolution). */
export function kiteProposalText(): string {
  return (
    'GOAL-LEVEL ROUTER: this request reads as a multi-feature campaign (kite altitude). ' +
    'Proposal: provision a coordination board (a local fleet-board-style file) and run one ' +
    'delivery loop per feature — claims become mandatory once a second concurrent producer ' +
    'exists (RFC-0156 §4). Nothing has been provisioned; this is a proposal only. ' +
    'Say "provision the board" to opt in, or continue as a single delivery loop.'
  );
}
