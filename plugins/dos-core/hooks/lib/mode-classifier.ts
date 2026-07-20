/**
 * mode-classifier.ts — THE single mode classifier for the UserPromptSubmit
 * stage (spec clause E). Pure, zero-I/O, synchronous (clause D); all repo
 * knowledge enters via an injected ScopeConsult so the corpus test runs
 * hermetically (clause F).
 *
 * Implements the EVIDENCE-CLASS EMISSION TABLE (spec A), evaluated in the
 * EVIDENCE_ORDER below, first-match-wins; every evaluation produces a
 * ClassEvaluation trace entry REGARDLESS of outcome (A-preamble).
 *
 * Ratified spec: MEMORY/RESEARCH/2026-06/classifier-ratified-spec-2026-06-12.md
 *
 * This module is built in S1 alongside the characterization corpus. The
 * banner-path rewire that makes IntentRetrieval CALL classifyPrompt is S3;
 * until then the legacy classifyMode remains the live authority (retired-in-
 * place, engineering rule 9).
 */

import { stripMachineText } from './machine-text';

// ─── 1. Evidence classes (one literal per spec A row 1-7) ──────────────────

export type EvidenceClass =
  | 'machine-text'      // A.1
  | 'greeting-rating'   // A.2
  | 'multi-step'        // A.3
  | 'single-step'       // A.4
  | 'repair-ambiguous'  // A.5
  | 'question-converse' // A.6
  | 'no-evidence';      // A.7

/** First-match-wins order pinned from the spec A preamble. */
export const EVIDENCE_ORDER: readonly EvidenceClass[] = [
  'machine-text',
  'greeting-rating',
  'multi-step',
  'single-step',
  'repair-ambiguous',
  'question-converse',
  'no-evidence',
] as const;

// ─── 2. Modes / verdicts / emissions ───────────────────────────────────────

export type Mode = 'MINIMAL' | 'NATIVE' | 'ALGORITHM';
export type Verdict = Mode | null;
/** Matches the B.1 trace `emission` field verbatim. */
export type Emission = 'banner' | 'hint' | 'neutral' | 'silent';

// ─── 3. Scope consult (the injected "cheap repo-scope consult", A.4(d)/A.5) ─

export interface RepoScopeFacts {
  /** Count of repo-resolvable component tokens named in the prompt. */
  resolvedTargets: number;
  /** >=2 components OR a known multi-site subsystem named. */
  multiComponent: boolean;
  /** Exactly one resolvable file/identifier AND no multi-site signal. */
  singleFileTarget: boolean;
  /** A.4 demotion data — non-null when bump/version/rename names multi-file work. */
  knownMultiSiteToken: string | null;
}

export type ScopeConsult = (humanText: string) => RepoScopeFacts;

// ─── 4. Per-class evaluation trace ──────────────────────────────────────────

export interface ClassEvaluation {
  cls: EvidenceClass;
  matched: boolean;
  /** Short human-readable reason for the match/non-match (logged, not asserted). */
  detail: string | null;
}

// ─── 5. Decision-trace return shape (B.1 schema minus impure fields) ────────

export interface ModeDecision {
  evidence_class: EvidenceClass;
  verdict: Verdict;
  emission: Emission;
  /** A.1 — true when leading machine block(s) were peeled. */
  stripped: boolean;
  /** A.1 — length of the human remainder after stripping. */
  remainder_len: number;
  /** een contract — 'explicit' when an /eN or standalone EN override fired. */
  effort_source: 'explicit' | null;
  explicit_level: 1 | 2 | 3 | 4 | 5 | null;
  /** Ratchet floor inferred from the trigger catalog (E4/E5), else null. */
  mode_floor: 'E4' | 'E5' | null;
  /** A.2 — the ack prefix stripped before evidence-scanning a trailing imperative. */
  ack_prefix_stripped: string | null;
  evaluations: ClassEvaluation[];
}

// ─── 10. Exported regexes (clause F content-anchored pinning) ───────────────

/**
 * Full-match ack family (A.2 / RT-A2): the ENTIRE prompt must be an ack token
 * with optional trailing punctuation. Adopts OrchestratorPrompt.hook.ts:63
 * '^(…)[.! ]*$' anchoring, extended to the rating forms (N/10, 'rating: N').
 * The len<24 gate is DELETED — full-match anchoring subsumes it (RT-A14).
 */
export const ACK_FULL_RE =
  /^(hi|hey|hello|thanks|thank you|thx|ty|ok|okay|yes|no|yep|nope|lgtm|nice|cool|sure|sounds good|got it|done|\d{1,3}\s*\/\s*10|rating:\s*\d{1,3}|rate:\s*\d{1,3}|\d{1,3})[.! ]*$/i;

/**
 * Multi-step keyword family (A.3). Mirrors the legacy ALGORITHM_RE content so
 * the characterization corpus pins identical keyword coverage, then carries
 * forward as the class-3 keyword detector.
 */
export const ALGORITHM_RE =
  /\b(investigate|design|refactor|build|ship|audit|migrate|architect|plan|analy[sz]e|strateg|review|implement|rewrite|consolidate|propose|deliver|rfc|prd|deep\s*dive|end\s*to\s*end|multi-?(file|step|phase)|council|ultrathink)\b/i;

/**
 * Single-step archetype family (A.4) — typo/rename/bump/version/lint/format/
 * one-liner. NOTE: bump/version/rename are CANDIDATE evidence only; the scope
 * consult demotes them (A.4(d)).
 */
export const NATIVE_ARCHETYPE_RE =
  /\b(typo|rename|bump|version|one-?liner|single\s*line|lint|format|comment|reword|tweak)\b/i;

/** Repair verbs (A.5) — also VETO class 4 when present (A.4(b)). */
export const REPAIR_VERB_RE = /\b(fix|debug|troubleshoot|repair|resolve|diagnose|optimize)\b/i;

/** Scope-broadening tokens (A.4(c) veto). */
export const SCOPE_BROADENING_RE = /\b(everywhere|all|across|entire|every|throughout)\b/i;

/** Question / converse phrasing (A.6). */
export const QUESTION_RE =
  /(\?|^(what|why|how|when|where|who|which|should we|could we|can we|do you|what can you|what do you)\b)/i;

/**
 * Effort override (een contract): '/e[1-5]' OR standalone 'E[1-5]'
 * (case-insensitive). The /eN form mirrors EscalationGate's OPERATOR_OVERRIDE_RE
 * shape; the bare EN form is the mode-detection.md "standalone token" form.
 */
export const EFFORT_OVERRIDE_RE = /(?:^|\s)(?:\/e([1-5])\b|e([1-5])\b)/i;

// "Modifier-phrases STRUCK as evidence" (A.4): quick fix / just fix / small fix
// — operator phrasing about effort is not task scope. We detect them ONLY to
// document the strike in evaluations; they never count as evidence.
const STRUCK_MODIFIER_RE = /\b(quick\s*fix|just\s*fix|small\s*fix)\b/i;

// ─── 8. Effort override detection (een contract) ────────────────────────────

export function detectEffortOverride(
  humanText: string,
): { level: 1 | 2 | 3 | 4 | 5; token: string } | null {
  const m = EFFORT_OVERRIDE_RE.exec(humanText);
  if (!m) return null;
  const digit = m[1] ?? m[2];
  if (!digit) return null;
  const level = Number(digit) as 1 | 2 | 3 | 4 | 5;
  return { level, token: m[0].trim() };
}

// ─── 7. Mode-floor inference (EscalationGate trigger catalog, RFC-0066 §5) ──
//
// Extracted VERBATIM from EscalationGate.hook.ts so the gate and the classifier
// can never disagree about the floor (mode_floor_mechanism). EscalationGate
// becomes a thin consumer of this export in S4.

interface FloorTrigger {
  family: string;
  pattern: RegExp;
  floor: 'E4' | 'E5';
}

const FLOOR_TRIGGERS: FloorTrigger[] = [
  {
    family: 'doctrine-affecting',
    pattern: /\b(RFC-\d{4}|Algorithm|doctrine|policy|principle|convention|[Ss]entinel|R-rule|R-DLQ|R-PAI)\b/,
    floor: 'E4',
  },
  {
    family: 'architectural-locator',
    pattern: /\b(four-copy|submodule|release|version freeze|lift-verb|Containment|gateway|DLQ|stability DAG|sync-check|four copies)\b/i,
    floor: 'E4',
  },
  {
    family: 'hard-to-vary',
    pattern: /(hard[- ]to[- ]vary|hard-to-vary explanation|\bDeutsch(ian)?\b)/i,
    floor: 'E5',
  },
];

const MULTI_PROJECT_STUDIO_RE = /(Platform\/studio|apps\/web|packages\/database|packages\/db)/;
const MULTI_PROJECT_DOS_RE = /(~\/.claude|\/Durante|Releases\/v[0-9]|Plans\/Specs|Packs\/)/;

export function inferModeFloor(
  humanText: string,
): { floor: 'E4' | 'E5' | null; fires: Array<{ family: string; matched: string }> } {
  const fires: Array<{ family: string; matched: string }> = [];
  for (const t of FLOOR_TRIGGERS) {
    const m = humanText.match(t.pattern);
    if (m) fires.push({ family: t.family, matched: m[0] });
  }
  if (MULTI_PROJECT_STUDIO_RE.test(humanText) && MULTI_PROJECT_DOS_RE.test(humanText)) {
    fires.push({ family: 'multi-project', matched: 'studio+dos' });
  }
  if (fires.length === 0) return { floor: null, fires };
  const hasE5 = fires.some((f) => f.family === 'hard-to-vary');
  return { floor: hasE5 ? 'E5' : 'E4', fires };
}

// ─── 6. classifyPrompt — THE single classifier (clause E) ───────────────────

export interface ClassifyOpts {
  /** Class-3 positive evidence carrier so OrchestratorPrompt's F3 option-pick
   *  up-route survives the single-authority consolidation (silence-degrading
   *  otherwise per A.6 honest-residual). */
  continuationEvidence?: boolean;
}

/** Internal helper — strip a leading ack token for evidence-scanning (A.2 fall-through). */
function stripAckPrefix(text: string): { remainder: string; prefix: string | null } {
  // Match a leading ack token followed by a separator (comma/period/space) and
  // MORE text. Only strips when there IS a trailing imperative.
  const m = /^(hi|hey|hello|thanks|thank you|thx|ty|ok|okay|yes|no|yep|nope|sure|lgtm|got it|sounds good)\b[\s,.:;!-]+(?=\S)/i.exec(text);
  if (!m) return { remainder: text, prefix: null };
  return { remainder: text.slice(m[0].length).trim(), prefix: m[1] };
}

export function classifyPrompt(
  prompt: string,
  consult: ScopeConsult,
  opts: ClassifyOpts = {},
): ModeDecision {
  const evaluations: ClassEvaluation[] = [];
  const record = (cls: EvidenceClass, matched: boolean, detail: string | null) =>
    evaluations.push({ cls, matched, detail });

  // ── A.1: strip-and-re-enter ──────────────────────────────────────────────
  const strip = stripMachineText(prompt);
  const remainder = strip.remainder;
  const remainder_len = remainder.length;

  if (strip.stripped && remainder_len < 10) {
    // HARD SILENCE — empty or sub-threshold remainder.
    record('machine-text', true, `hard-silence remainder_len=${remainder_len}`);
    return {
      evidence_class: 'machine-text',
      verdict: null,
      emission: 'silent',
      stripped: true,
      remainder_len,
      effort_source: null,
      explicit_level: null,
      mode_floor: null,
      ack_prefix_stripped: null,
      evaluations,
    };
  }
  record('machine-text', false, strip.stripped ? `stripped ${strip.blocks} block(s), re-entering` : 'no machine prefix');

  const human = remainder; // classify on the human remainder
  const trimmed = human.trim();

  // ── Effort override (een contract) — detected after A.1, before classes 2-7 ─
  const override = detectEffortOverride(trimmed);
  const effort_source: 'explicit' | null = override ? 'explicit' : null;
  const explicit_level = override ? override.level : null;

  // ── Mode floor (ratchet-only positive evidence under A.3) ────────────────
  const floorResult = inferModeFloor(trimmed);
  const mode_floor = floorResult.floor;

  // Helper for terminal returns.
  const decide = (
    evidence_class: EvidenceClass,
    verdict: Verdict,
    emission: Emission,
    ack_prefix_stripped: string | null,
  ): ModeDecision => ({
    evidence_class,
    verdict,
    emission,
    stripped: strip.stripped,
    remainder_len,
    effort_source,
    explicit_level,
    mode_floor,
    ack_prefix_stripped,
    evaluations,
  });

  // ── Operator-explicit ratchet (een contract): /e2-/e5 + EN up-route to
  //    ALGORITHM-required banner regardless of evidence class. /e1 NEVER
  //    down-routes; it only suppresses a NATIVE-or-below to no-hint when the
  //    class would otherwise be 4/7 (operator effort phrasing is not scope).
  //    We resolve the class first, then apply the ratchet, so the trace still
  //    records the evidence class.

  // ── A.2: greeting-rating, FULL-MATCH ONLY ────────────────────────────────
  if (ACK_FULL_RE.test(trimmed)) {
    record('greeting-rating', true, 'full-match ack');
    // Operator ratchet still applies (e.g. 'ok /e3') — but a bare full-match
    // ack carries no override token by construction, so this is MINIMAL.
    if (override && override.level >= 2) {
      return decide('greeting-rating', 'ALGORITHM', 'banner', null);
    }
    return decide('greeting-rating', 'MINIMAL', 'hint', null);
  }
  record('greeting-rating', false, 'not a full-match ack');

  // A.2 fall-through: strip a leading ack prefix for evidence-scanning the
  // trailing imperative ('no, fix it everywhere', 'yes, do the freeze').
  const { remainder: afterAck, prefix: ackPrefix } = stripAckPrefix(trimmed);
  const scanText = afterAck;

  // ── A.3: multi-step — positive evidence only ─────────────────────────────
  const scope = consult(scanText);
  const hasAlgoKeyword = ALGORITHM_RE.test(scanText);
  const hasEnumeratedSteps = /(^|\n)\s*(\d+[.)]|[-*]\s)/.test(scanText) || /\bstep\s*\d/i.test(scanText);
  const hasMultiPhrasing = /\bmulti-?(file|step|phase|component)\b/i.test(scanText) || /\b(all (?:three|four|five|the)|across the)\b/i.test(scanText);
  const transitiveRepoVerb = REPAIR_VERB_RE.test(scanText) === false
    && /\b(add|wire|move|extract|consolidate|restructure|update|change)\b/i.test(scanText)
    && scope.multiComponent;
  const floorIsEvidence = mode_floor !== null; // ratchet-only up-route (F13)
  const continuationEvidence = opts.continuationEvidence === true;

  // A.3 widened (RT-A3): a multi-component subsystem named by the scope consult
  // is positive evidence on its own — this is the path that re-routes
  // 'bump the dos version for the v0.0.20 freeze' OFF class-4-NATIVE to class 3
  // (the six version-bump sites ARE a multi-component subsystem). Repair verbs
  // are excluded here so they stay owned by class 5 (A.5) per the veto hoist.
  const multiComponentSubsystem = scope.multiComponent && !REPAIR_VERB_RE.test(scanText);
  const class3Matched =
    hasAlgoKeyword ||
    hasEnumeratedSteps ||
    scope.resolvedTargets >= 2 ||
    hasMultiPhrasing ||
    transitiveRepoVerb ||
    multiComponentSubsystem ||
    floorIsEvidence ||
    continuationEvidence;

  if (class3Matched) {
    const why: string[] = [];
    if (hasAlgoKeyword) why.push('algo-keyword');
    if (hasEnumeratedSteps) why.push('enumerated-steps');
    if (scope.resolvedTargets >= 2) why.push(`>=2-components(${scope.resolvedTargets})`);
    if (hasMultiPhrasing) why.push('multi-phrasing');
    if (transitiveRepoVerb) why.push('transitive-verb+multi-component');
    if (multiComponentSubsystem && scope.knownMultiSiteToken) why.push(`multi-site(${scope.knownMultiSiteToken})`);
    else if (multiComponentSubsystem) why.push('multi-component-subsystem');
    if (floorIsEvidence) why.push(`floor-${mode_floor}`);
    if (continuationEvidence) why.push('option-pick-continuation');
    record('multi-step', true, why.join(','));
    return decide('multi-step', 'ALGORITHM', 'banner', ackPrefix);
  }
  record('multi-step', false, 'no positive multi-step evidence');

  // ── A.5 VETO HOIST: repair verb present? Then class 4 is vetoed (A.4(b)). ─
  const repairVerbPresent = REPAIR_VERB_RE.test(scanText);

  // ── A.4: single-step archetype, SCOPE-CONSULTED ──────────────────────────
  const archetypeToken = NATIVE_ARCHETYPE_RE.test(scanText);
  const scopeBroadening = SCOPE_BROADENING_RE.test(scanText);
  const struckModifier = STRUCK_MODIFIER_RE.test(scanText);
  if (struckModifier) {
    record('single-step', false, 'quick/just/small-fix STRUCK as evidence (A.4)');
  }
  // A.4 holds only when ALL of: (a) archetype token; (b) no repair verb;
  // (c) no scope-broadening token; (d) consult resolves to a single target
  // (bump/version/rename demoted via knownMultiSiteToken).
  const class4Matched =
    archetypeToken &&
    !repairVerbPresent &&
    !scopeBroadening &&
    scope.singleFileTarget &&
    scope.knownMultiSiteToken === null;

  if (class4Matched) {
    record('single-step', true, 'archetype + single-file consult, no repair-verb/broadening');
    // /e1 stands (NATIVE is already below ALGORITHM); /e2-/e5 up-route.
    if (override && override.level >= 2) {
      return decide('single-step', 'ALGORITHM', 'banner', ackPrefix);
    }
    return decide('single-step', 'NATIVE', 'hint', ackPrefix);
  }
  record(
    'single-step',
    false,
    !archetypeToken
      ? 'no archetype token'
      : repairVerbPresent
        ? 'repair-verb VETO (A.4(b))'
        : scopeBroadening
          ? 'scope-broadening VETO (A.4(c))'
          : scope.knownMultiSiteToken !== null
            ? `multi-site demotion: ${scope.knownMultiSiteToken}`
            : 'consult did not resolve single file (A.4(d))',
  );

  // ── A.5: repair-verb-ambiguous ───────────────────────────────────────────
  // A repair verb whose scope is BROADENED ('fix it everywhere') is multi-file
  // work by construction — the same token that vetoes class-4-NATIVE (A.4(c))
  // is positive scope evidence for class 5. This routes 'no, fix it everywhere'
  // to ALGORITHM (and away from the F2 MINIMAL-starve) rather than to silence.
  if (repairVerbPresent) {
    if (scope.multiComponent || scope.resolvedTargets >= 1) {
      record('repair-ambiguous', true, 'repair-verb + repo-scope evidence → ALGORITHM');
      return decide('repair-ambiguous', 'ALGORITHM', 'banner', ackPrefix);
    }
    if (scopeBroadening) {
      record('repair-ambiguous', true, 'repair-verb + scope-broadening → ALGORITHM');
      return decide('repair-ambiguous', 'ALGORITHM', 'banner', ackPrefix);
    }
    // Verb without scope evidence: NO directional banner; fall through to class 7.
    record('repair-ambiguous', false, 'repair-verb without scope evidence → fall to class 7');
  } else {
    record('repair-ambiguous', false, 'no repair verb');
  }

  // ── A.6: question-form-CONVERSE ──────────────────────────────────────────
  // Work-evidence already failed (classes 3 and 5). Question phrasing alone is
  // NEVER an assertion — it degrades to class 7 silence (honest residual).
  if (QUESTION_RE.test(scanText)) {
    record('question-converse', true, 'question phrasing, zero work evidence → silence');
    return decide('question-converse', null, 'silent', ackPrefix);
  }
  record('question-converse', false, 'not question phrasing');

  // ── A.7: no-evidence — SILENCE ───────────────────────────────────────────
  // Operator /e2-/e5 is the strongest positive evidence — up-route. /e1 mints
  // no hint (effort phrasing is not scope; the A.4 category-error).
  if (override && override.level >= 2) {
    record('no-evidence', false, `operator /e${override.level} up-route`);
    return decide('no-evidence', 'ALGORITHM', 'banner', ackPrefix);
  }
  record('no-evidence', true, 'no evidence → silence on mode');
  return decide('no-evidence', null, 'silent', ackPrefix);
}

// ─── 9. renderModeLine — pure banner/hint/neutral renderer ──────────────────
//
// Templates carry the existing ALGORITHM directive block + 🗒️ TASK scaffold
// (byte-identical to the live banner, rule 5) but the fossilized 1.7% literal
// and ALL conformance figures are DELETED by content (A.3/RT-A21). The class-7
// neutral reminder is the EXACT CLAUDE.md quote, emitted only when
// opts.neutralReminder (A.7/RT-A8/RT-A18 — flag default OFF).

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  MINIMAL: 'acknowledgment / rating → MINIMAL format',
  NATIVE: 'single-step task → NATIVE mode header',
  ALGORITHM: 'multi-step work -> ALGORITHM mode (RFC-0001 orchestrator runtime)',
};

/** The exact CLAUDE.md quote (verbatim, RT-A8). Do not reword. */
export const NEUTRAL_REMINDER_QUOTE =
  'Your first output MUST be the mode header. No freeform output. No skipping this step.';

export interface RenderOpts {
  /** A.7 neutral reminder — default OFF, pinned OFF during measurement (RT-A18). */
  neutralReminder?: boolean;
}

export function renderModeLine(
  d: ModeDecision,
  algorithmVersion: string,
  opts: RenderOpts = {},
): string | null {
  // effort_source surfacing (een contract): one extra line on a banker emit.
  const effortLine =
    d.effort_source === 'explicit'
      ? `\n\neffort_source: explicit (/e${d.explicit_level} operator override) — set effort_source: explicit in PRD frontmatter`
      : '';

  if (d.emission === 'silent') {
    if (d.evidence_class === 'no-evidence' && opts.neutralReminder) {
      return NEUTRAL_REMINDER_QUOTE;
    }
    return null;
  }

  if (d.verdict === 'ALGORITHM') {
    return (
      [
        `🚨 MODE: ALGORITHM REQUIRED — ${MODE_DESCRIPTIONS.ALGORITHM}`,
        ``,
        `MANDATORY: Your FIRST output line must be the banner below, BEFORE any other text or tool call.`,
        `Then read \`DOS/Algorithm/${algorithmVersion}.md\` and follow it from OBSERVE through LEARN.`,
        ``,
        `    ♻︎ Entering the DOS ALGORITHM… (${algorithmVersion}) ═════════════`,
        `    🗒️ TASK: [8 word description of this request]`,
        ``,
        `Skipping the banner is a CRITICAL FAILURE — this directive replaces self-discipline with mechanical instruction. If task is genuinely simple (single tool call, <2min), output \`════ DOS | NATIVE MODE\` instead and proceed in NATIVE.`,
        ``,
        `If effort >= advanced: PLAN phase MUST emit a \`📐 PARALLELISM:\` block answering the three questions from the active Algorithm doctrine PARALLELISM section (N≥3 mechanical-same? N≥2 independent workstreams? concurrent-with-blocking-IO?). Absence is graded by prd-section-presence.hook.ts at Stop.`,
        ``,
        `OBSERVE phase MUST emit \`📊 BRIEF INTEGRITY: X/Y claims verified\` (or \`n/a (no verifiable claims)\` if the input is pure prose). Explicit n/a is fine; missing line is the failure.`,
        ``,
        `If task touches Prisma table data, .mdoc frontmatter, i18n keys, or YAML config schema, the PRD MUST contain a \`### Schema Pre-Flight\` subsection with the matching SchemaCheck validator output (see Algorithm doctrine SCHEMA PRE-FLIGHT section). Skip silently only if read-only or none of these surfaces touched.`,
      ].join('\n') + effortLine
    );
  }

  if (d.verdict === 'NATIVE') {
    return (
      `💡 MODE HINT: NATIVE — ${MODE_DESCRIPTIONS.NATIVE}\n\nFIRST output line must be \`════ DOS | NATIVE MODE ═══════════════════════\`.` +
      effortLine
    );
  }

  // MINIMAL
  return (
    `💡 MODE HINT: MINIMAL — ${MODE_DESCRIPTIONS.MINIMAL}\n\nFIRST output line must be \`═══ DOS ═══════════════════════════\`.` +
    effortLine
  );
}
