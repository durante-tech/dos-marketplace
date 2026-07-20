/**
 * intent-classifier.ts — RFC-0037 Phase 1, Beck Tidy 1
 *
 * Pure intent-classification module extracted from IntentRetrieval.hook.ts
 * (lines 39-73 in the original). Extraction is byte-equivalent for the
 * legacy 4 intents (RESUME, RECALL, STATUS, SEARCH) — no behavior change
 * for existing dispatch. Tidy First per Beck (2023): the extraction makes
 * the EXPECT_RECALL/CANONICAL additions a one-line append, not surgery.
 *
 * Two new intents added per RFC-0037 §5.3:
 *   - EXPECT_RECALL — {PRINCIPAL.NAME} signals they expect DOS to remember prior context
 *     ("you should know already", "we worked on", "as I mentioned", etc.)
 *   - CANONICAL — prompt names a known primitive (Studio / MemPalace /
 *     gateway-env / RFC-XXXX / project-slug) → routes to {@link RecallAdapter}
 *
 * Precedence: EXPECT_RECALL fires BEFORE other classifications when a known
 * primitive is also detected. The hook treats EXPECT_RECALL as a signal
 * that elevates downstream dispatch (it does NOT bypass the legacy 4-intent
 * dispatch — it logs + warns + falls through). CANONICAL hits short-circuit
 * to {@link RecallAdapter} via {@link classifyAndRecall}.
 *
 * Mode-classifier intents (MINIMAL/NATIVE/ALGORITHM) are included in the
 * Intent union for callers that want a single classification surface, but
 * the hook calls classifyMode() separately. classifyIntent() never returns
 * a mode-tier intent.
 *
 * Pure: no I/O at module load. The CANONICAL lookup table is a frozen
 * literal seeded from RFC-0037 §5.4 RECALL_REGISTRY keys + RFC enumeration
 * + project-slug enumeration. Phase 2 may regenerate from real registries.
 *
 * The {@link RecallAdapter} value+type are imported here so the JSDoc
 * references are IDE-resolvable and rename-safe — rooted in the actual
 * runtime symbol rather than free-text. The pure {@link classifyIntent}
 * contract is preserved; the {@link classifyAndRecall} helper composes
 * classification with adapter dispatch into one call site so downstream
 * callers (hooks, tools) hit a single seam instead of duplicating the
 * CANONICAL → adapter wiring across files.
 */

import { RecallAdapter } from '../../skills/mem-palace/Recall/RecallAdapter';
import type { RecallResult } from '../../skills/mem-palace/Recall/RecallAdapter';
import {
  decideInjectionSkip,
  detectWingDrift,
  formatWingDriftBanner,
  loadDeclaredWings,
  recordInjectionLatency,
  recordWingDrift,
  type WingDriftEvent,
} from './injection-observe';

// ─── Intent taxonomy ─────────────────────────────────────────────────

/**
 * Full intent enumeration. classifyIntent() returns one of:
 *   - EXPECT_RECALL / CANONICAL (RFC-0037 additions)
 *   - RESUME / RECALL / STATUS / SEARCH (legacy 4)
 * Mode tier (MINIMAL / NATIVE / ALGORITHM) is in the union for downstream
 * callers but classifyIntent() does NOT emit them.
 */
export type Intent =
  | 'EXPECT_RECALL'
  | 'CANONICAL'
  | 'RESUME'
  | 'RECALL'
  | 'STATUS'
  | 'SEARCH'
  | 'MINIMAL'
  | 'NATIVE'
  | 'ALGORITHM';

export type ClassificationResult = {
  intent: Intent;
  /** Populated when CANONICAL detects a known primitive, OR when EXPECT_RECALL
   * also detects one (so the hook can route through {@link RecallAdapter}
   * while keeping the EXPECT_RECALL signal). */
  primitive?: string;
  /** 1.0 for regex match, lower for fallback. Reserved for Phase 2 fuzzy classifier. */
  confidence: number;
  /** The pattern name that fired ("EXPECT_RECALL_RE", "PRIMITIVE_LOOKUP",
   * "RESUME_RE", etc.) — used by signal logging to surface trends without
   * leaking raw prompt content. */
  matchedPattern: string;
};

// ─── Legacy regex (byte-equivalent extraction from IntentRetrieval) ───────

const RESUME_RE =
  /\b(continue|pick\s*up|where\s*(we|i)\s*(left|were|stopped)|resume|keep\s*going|carry\s*on|let'?s\s*(continue|go|proceed)|back\s*to\s*(it|work|where))\b/i;

const RECALL_RE =
  /\b(yesterday|last\s*(time|session|night)|previous\s*session|earlier\s*today|this\s*(morning|afternoon)|what\s*(did|have)\s*(we|i)\s*(do|done|work)|what\s*happened|since\s*(friday|monday|tuesday|wednesday|thursday|saturday|sunday)|last\s*week|recently)\b/i;

const STATUS_RE =
  /\b(what'?s\s*(pending|open|blocking|blocked|left|remaining|outstanding|deferred)|commit(ted|ment)|promis(e|ed)|what\s*(do|should)\s*(i|we)\s*(owe|need\s*to)|across\s*all\s*projects|what\s*needs\s*attention|prioriti[sz]e)\b/i;

// ─── New: RFC-0037 §5.3 EXPECT_RECALL ─────────────────────────────────

const EXPECT_RECALL_RE =
  /\b(you should (know|remember)|we (worked|talked|discussed)|as (i|we) (mentioned|said)|like (i|we) said|remember when|don'?t you remember|we (already|previously) (decided|talked about)|recall.*we|earlier (i|we) (said|decided))\b/i;

// ─── New: RFC-0037 §5.6 CANONICAL primitive lookup ────────────────────

/**
 * Known primitives that route to {@link RecallAdapter}. Lowercase keys; the
 * value is the canonical primitive name (case preserved for downstream display).
 * Three sources:
 *   1. RECALL_REGISTRY keys (Studio, MemPalace, gateway-env)
 *   2. RFC numbers (matched separately via RFC_RE since they're numeric)
 *   3. Project slugs from .dos-projects.json (frozen at module load)
 *
 * Synonym aliases ('mp' → 'mempalace', 'gw' → 'gateway-env') are NOT in
 * Phase 1 — Sandi's "duplication is cheaper than the wrong abstraction" —
 * they earn a place in Phase 2 only if real prompts demand them.
 */
// Pre-compiled at module load: each entry is [whole-word regex, canonical name].
// Avoids per-call regex compilation in the hot path (every UserPromptSubmit).
const PRIMITIVE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = (
  [
    // RECALL_REGISTRY keys
    ['studio', 'studio'],
    ['mempalace', 'mempalace'],
    ['mem palace', 'mempalace'],
    ['gateway-env', 'gateway-env'],
    ['gateway env', 'gateway-env'],
    // Project slugs from .dos-projects.json (snapshot 2026-05-02). Synonym
    // aliases ('mp', 'gw') deferred to Phase 2 — Sandi's discipline.
    ['durante', 'durante'],
    ['altyaa', 'altyaa'],
    ['donne', 'donne'],
    ['builders-compass', 'builders-compass'],
    ['road-to-next', 'road-to-next'],
    ['axready', 'axready'],
    ['exordiom-bdr', 'exordiom-bdr'],
    ['era-materna', 'era-materna'],
    ['adcore-turbo', 'adcore-turbo'],
  ] as const
).map(
  ([key, canonical]) =>
    [new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), canonical] as const,
);

const RFC_RE = /\bRFC-\d{4}\b/i;

/** Whole-word primitive detection. Avoids 'studio' matching 'studious'. */
function detectPrimitive(prompt: string): string | null {
  for (const [re, canonical] of PRIMITIVE_PATTERNS) {
    if (re.test(prompt)) return canonical;
  }
  const rfcMatch = prompt.match(RFC_RE);
  if (rfcMatch) return rfcMatch[0].toUpperCase();
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Classify a user prompt into one of the 6 intents (EXPECT_RECALL,
 * CANONICAL, RESUME, RECALL, STATUS, SEARCH). Pure function — no I/O,
 * no side effects, no allocation beyond the result.
 *
 * Precedence (RFC-0037 §5.6):
 *   1. EXPECT_RECALL — fires first when its phrasing is present (signal
 *      that {PRINCIPAL.NAME} expects prior context). primitive populated if a known
 *      primitive is ALSO named, so the hook can route through
 *      {@link RecallAdapter} while keeping the EXPECT_RECALL warning.
 *   2. CANONICAL — prompt names a known primitive AND no EXPECT_RECALL match
 *   3. RESUME / RECALL / STATUS — legacy 3 (existing behavior preserved)
 *   4. SEARCH — default fallback
 */
export function classifyIntent(prompt: string): ClassificationResult {
  // Precedence rule from RFC-0037 §5.6: EXPECT_RECALL fires BEFORE other
  // classifications when both match. The hook still falls through to the
  // legacy dispatch on EXPECT_RECALL, so this isn't a short-circuit — it's
  // an additive signal.
  if (EXPECT_RECALL_RE.test(prompt)) {
    const primitive = detectPrimitive(prompt);
    return {
      intent: 'EXPECT_RECALL',
      ...(primitive ? { primitive } : {}),
      confidence: 1.0,
      matchedPattern: 'EXPECT_RECALL_RE',
    };
  }

  // CANONICAL: prompt names a known primitive (no EXPECT_RECALL phrasing).
  const primitive = detectPrimitive(prompt);
  if (primitive) {
    return {
      intent: 'CANONICAL',
      primitive,
      confidence: 1.0,
      matchedPattern: 'PRIMITIVE_LOOKUP',
    };
  }

  return classifyLegacyOnly(prompt);
}

/**
 * Run only the legacy 4-intent dispatch (no EXPECT_RECALL / CANONICAL).
 * Used by the IntentRetrieval hook on the EXPECT_RECALL fall-through path,
 * where we want pre-RFC-0037 behavior — so the same prompt that triggered
 * the warning still routes through RESUME/RECALL/STATUS/SEARCH for memory.
 *
 * Byte-equivalent to the original IntentRetrieval.hook.ts:39-48.
 */
export function classifyLegacyOnly(prompt: string): ClassificationResult {
  if (RESUME_RE.test(prompt))
    return { intent: 'RESUME', confidence: 1.0, matchedPattern: 'RESUME_RE' };
  if (RECALL_RE.test(prompt))
    return { intent: 'RECALL', confidence: 1.0, matchedPattern: 'RECALL_RE' };
  if (STATUS_RE.test(prompt))
    return { intent: 'STATUS', confidence: 1.0, matchedPattern: 'STATUS_RE' };
  return { intent: 'SEARCH', confidence: 0.5, matchedPattern: 'SEARCH_DEFAULT' };
}

// ─── Composed dispatch ────────────────────────────────────────────────

/**
 * Combined classification + adapter result. The `recall` field is non-null
 * only when the classifier emitted CANONICAL (or EXPECT_RECALL with a
 * primitive) AND the adapter resolved that primitive to a registered
 * handler. Unknown primitives or adapter failures leave `recall` null —
 * callers fall through to legacy dispatch (RFC-0037 §5.6 contract).
 */
export type ClassifyAndRecallResult = {
  classification: ClassificationResult;
  recall: RecallResult | null;
};

/**
 * Compose {@link classifyIntent} with a {@link RecallAdapter} dispatch into
 * one call site. The pure classifier stays pure — this helper is the one
 * named seam where I/O happens.
 *
 * The adapter is injectable so tests can pass a stub and production callers
 * can share a single instance. Defaults to a freshly-constructed adapter.
 *
 * Never throws. Adapter failures collapse to `recall: null`.
 */
export async function classifyAndRecall(
  prompt: string,
  adapter: RecallAdapter = new RecallAdapter(),
): Promise<ClassifyAndRecallResult> {
  const classification = classifyIntent(prompt);
  if (
    (classification.intent === 'CANONICAL' || classification.intent === 'EXPECT_RECALL') &&
    classification.primitive
  ) {
    try {
      const recall = await adapter.recall(classification.primitive);
      return { classification, recall };
    } catch {
      // Swallow adapter failures — RFC-0037 §5.6 fall-through contract.
      return { classification, recall: null };
    }
  }
  return { classification, recall: null };
}

// ─── V11.5 / V11.6 — memory-injection observability ───────────────────────
//
// The two helpers below wire the new `injection-observe.ts` library to the
// IntentRetrieval hook flow without modifying mempalace.ts or
// mempalace-client.ts (V11.7 / V11.12 territory). They are pure wrappers
// around the library's public surface so the hook adopts them in a single
// import. Tests pin the library directly; the wrappers stay thin.

/** Bridge-status surface a wing-drift caller passes in. Mirrors
 *  `mempalaceClient.status()`'s `wings` field shape. The function accepts
 *  any compatible shape so it stays trivially mockable. */
export type WingDrawerCounts = Record<string, { total: number } | number>;

export interface WingDriftPreflightResult {
  /** Drift events that fired this session (post-dedupe). */
  events: WingDriftEvent[];
  /** Banner string for the additionalContext / stdout surface, or null. */
  banner: string | null;
}

/**
 * V11.5 — Project wing pre-flight.
 *
 * Compose `loadDeclaredWings`, `detectWingDrift`, and `recordWingDrift` into
 * a single call site for the IntentRetrieval hook. Bridge-status retrieval
 * is delegated to the caller so this function stays pure (and so we don't
 * import `mempalace-client.ts` from inside the classifier — keeping the
 * import graph one-directional).
 *
 * Caller pattern:
 *   const status = mempalaceClient.status({ skip_wings: false });
 *   const wings = status.ok ? status.data.wings : {};
 *   const preflight = runWingDriftPreflight(wings, sessionId);
 *   if (preflight.banner) console.log(preflight.banner);
 *
 * Never throws. Returns `{ events: [], banner: null }` on any read or
 * filesystem error from the underlying library.
 */
export function runWingDriftPreflight(
  wingDrawerCounts: WingDrawerCounts,
  sessionId: string | null,
): WingDriftPreflightResult {
  try {
    const declared = loadDeclaredWings();
    if (declared.length === 0) {
      return { events: [], banner: null };
    }
    const drift = detectWingDrift(declared, wingDrawerCounts, sessionId);
    if (drift.length === 0) {
      return { events: [], banner: null };
    }
    // recordWingDrift returns only the events newly persisted (deduped on
    // session+wing). If everything was already logged this session, the
    // banner stays silent so the operator isn't re-warned every recall.
    const written = recordWingDrift(drift);
    if (written.length === 0) return { events: [], banner: null };
    return { events: written, banner: formatWingDriftBanner(written) };
  } catch {
    return { events: [], banner: null };
  }
}

export interface InjectionGate {
  /** True when the breaker is tripped and the injection should be skipped. */
  skip: boolean;
  /** Warning text to emit to console exactly once (transition fire). */
  warning: string | null;
}

/**
 * V11.6 — Pre-injection circuit-breaker check.
 *
 * Call BEFORE running the bridge call(s) that build the injection. Returns
 * `{ skip: true, warning }` on the first call after the breaker trips
 * (warning is the one-shot `mempalace.inject.degraded` line). Subsequent
 * calls in the same session return `{ skip: true, warning: null }`. Window
 * resets across sessions because state is keyed by `session_id`.
 */
export function checkInjectionCircuit(sessionId: string): InjectionGate {
  try {
    const decision = decideInjectionSkip(sessionId);
    return { skip: decision.skip, warning: decision.warning };
  } catch {
    return { skip: false, warning: null };
  }
}

/**
 * V11.6 — Post-injection latency record.
 *
 * Call AFTER injection completes (or fails) with the wall-clock latency in
 * ms. Pushes one sample into the rolling 5-call window; trips the breaker
 * when avg > 2000ms. Never throws.
 */
export function trackInjectionLatency(sessionId: string, latencyMs: number): void {
  try {
    recordInjectionLatency(sessionId, latencyMs);
  } catch {
    // Tracking is advisory — never break the host hook.
  }
}
