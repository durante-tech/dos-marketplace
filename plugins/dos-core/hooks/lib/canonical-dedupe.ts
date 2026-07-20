/**
 * canonical-dedupe.ts — CANONICAL injection dedupe + staleness demotion (B-2).
 *
 * PURE decision module (no I/O): the IntentRetrieval hook's CANONICAL branch
 * (IntentRetrieval.hook.ts) fires BEFORE the shouldFire cooldown gate and
 * process.exit(0)s on success, so every prompt naming a known primitive
 * re-injects the full RecallAdapter payload with no dedupe and no cooldown
 * accounting. The audited worst case fired the 990B 'Degraded Mode' brief 9x
 * byte-identical in one session. This module decides — given prior per-session
 * state, the primitive, the payload hash, the result's primitive literal, and
 * its claim status — whether to inject the full payload, inject a demoted
 * placeholder, or suppress to a one-line pointer.
 *
 * DEMOTION GATE (folded RedTeam major — do NOT conflate per-primitive status
 * semantics): demote ONLY when resultPrimitive === 'Studio' AND status is
 * 'stale' or 'orphaned'. Studio's ClaimStatus is TIME-based (recallStudio.ts
 * STALE_THRESHOLD_MS = 7 days) so a stale/orphaned Studio claim is a genuinely
 * out-of-date snapshot whose payload should be withheld. The SAME ClaimStatus
 * values from recallGatewayEnv.ts are STRUCTURAL diagnoses (orphaned = neither
 * gateway-env file exists; stale = migration incomplete) where the value block
 * IS the diagnostic, and recallMemPalace's 'stale' is a harvest-age heuristic
 * over live-accurate counts — those primitives NEVER demote.
 *
 * State shape (per session): { [primitive]: { hash: string, count: number } }.
 */

export type CanonicalAction = 'inject-full' | 'inject-demoted' | 'suppress';

export interface CanonicalDecision {
  action: CanonicalAction;
  /** Serialized next state to persist for this session. */
  nextState: string;
}

interface PrimitiveEntry {
  hash: string;
  count: number;
}

type CanonicalState = Record<string, PrimitiveEntry>;

/**
 * Number of consecutive byte-identical suppressions before we re-inject the
 * full payload (folded judge-2 LONG-SESSION ESCAPE). Bounds the
 * context-retention assumption across compactions: after enough turns the
 * earlier injection may have scrolled out of the model's window, so a fresh
 * full inject re-grounds it. Counter resets on the escape fire.
 */
const SUPPRESS_ESCAPE_THRESHOLD = 3;

function parseState(stateJson: string | null): CanonicalState | null {
  if (!stateJson) return null;
  try {
    const parsed = JSON.parse(stateJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CanonicalState;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Decide how to handle a CANONICAL injection for `primitive` whose formatted
 * payload hashes to `payloadSha256`. `resultPrimitive` is the RecallResult's
 * literal primitive ('Studio' | 'MemPalace' | 'gateway-env') and `status` is
 * the current claim's status (null when there is no current claim).
 *
 * Decision table:
 *   (a) malformed/null state          → inject-full (fail-open), fresh state
 *   (b) Studio + stale|orphaned       → inject-demoted (hashed so repeats
 *                                        suppress to the pointer line)
 *   (c) same primitive + same hash    → suppress, increment suppress counter
 *   (d) suppress counter reaches 3    → inject-full, reset counter (escape)
 *   (e) changed hash (or first time)  → inject-full, reset counter
 *
 * Pure: never reads or writes the filesystem. Never throws.
 */
export function decideCanonicalInjection(
  stateJson: string | null,
  primitive: string,
  payloadSha256: string,
  resultPrimitive: string,
  status: string | null,
): CanonicalDecision {
  const state = parseState(stateJson);

  // (a) Fail-open on malformed/null state — emit the full payload and seed
  // fresh state so subsequent same-session repeats can dedupe.
  if (state === null) {
    const fresh: CanonicalState = { [primitive]: { hash: payloadSha256, count: 0 } };
    return { action: 'inject-full', nextState: JSON.stringify(fresh) };
  }

  const prior = state[primitive];

  // (b) DEMOTION GATE — Studio-only, time-based staleness/orphaning. The
  // demoted payload is ALSO hashed into state so its own repeats suppress.
  const demote =
    resultPrimitive === 'Studio' && (status === 'stale' || status === 'orphaned');

  if (demote) {
    if (prior && prior.hash === payloadSha256) {
      // Same demoted snapshot already surfaced this session → suppress with
      // escape after SUPPRESS_ESCAPE_THRESHOLD consecutive suppressions.
      const nextCount = prior.count + 1;
      if (nextCount >= SUPPRESS_ESCAPE_THRESHOLD) {
        const next: CanonicalState = { ...state, [primitive]: { hash: payloadSha256, count: 0 } };
        return { action: 'inject-demoted', nextState: JSON.stringify(next) };
      }
      const next: CanonicalState = { ...state, [primitive]: { hash: payloadSha256, count: nextCount } };
      return { action: 'suppress', nextState: JSON.stringify(next) };
    }
    const next: CanonicalState = { ...state, [primitive]: { hash: payloadSha256, count: 0 } };
    return { action: 'inject-demoted', nextState: JSON.stringify(next) };
  }

  // (c)/(d) same primitive + same hash → suppress, with long-session escape.
  if (prior && prior.hash === payloadSha256) {
    const nextCount = prior.count + 1;
    if (nextCount >= SUPPRESS_ESCAPE_THRESHOLD) {
      const next: CanonicalState = { ...state, [primitive]: { hash: payloadSha256, count: 0 } };
      return { action: 'inject-full', nextState: JSON.stringify(next) };
    }
    const next: CanonicalState = { ...state, [primitive]: { hash: payloadSha256, count: nextCount } };
    return { action: 'suppress', nextState: JSON.stringify(next) };
  }

  // (e) changed hash (new information) or first injection → inject-full, reset.
  const next: CanonicalState = { ...state, [primitive]: { hash: payloadSha256, count: 0 } };
  return { action: 'inject-full', nextState: JSON.stringify(next) };
}
