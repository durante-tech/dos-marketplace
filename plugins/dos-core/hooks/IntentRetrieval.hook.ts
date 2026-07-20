#!/usr/bin/env bun
/**
 * IntentRetrieval.hook.ts - Intent-Driven Memory Retrieval (UserPromptSubmit)
 *
 * PURPOSE:
 * On user messages, classify intent and route to the best retrieval strategy.
 * Different intents use different backends — RESUME reads live PRDs, RECALL
 * reads the pre-computed snapshot, SEARCH queries MemPalace.
 *
 * COUNCIL DESIGN (2026-04-14):
 * "Continue and yesterday are structurally different views. RESUME reads live
 * PRD state. RECALL reads the snapshot. Everything else gets hybrid search."
 *
 * TRIGGER: UserPromptSubmit
 *
 * CHANGES (v2 — council-driven):
 * - Fire-once guard → 3-minute cooldown with resume-mode bypass
 * - Regex intent router: RESUME, RECALL, SEARCH (default)
 * - RESUME handler reads most recent non-complete PRD
 * - RECALL handler reads pre-computed snapshot directly
 * - SEARCH handler uses keyword extraction + MemPalace (existing path)
 */

import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs'; // existsSync still used by cooldown reader
import { createHash } from 'node:crypto';
import { join } from 'path';
import { homedir } from 'os';
import { resolveProjectWingFromEnv } from './lib/project-resolver';
import { queryMemory } from './lib/mempalace';
import { atomicWriteSync } from './lib/atomic-write';
import { startTimer, stopTimer } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';
import {
  classifyIntent as classifyPromptIntent,
  classifyLegacyOnly,
  checkInjectionCircuit,
  runWingDriftPreflight,
  trackInjectionLatency,
  type WingDrawerCounts,
} from './lib/intent-classifier';
import type { Intent as ClassifierIntent } from './lib/intent-classifier';
import { RecallAdapter } from '../skills/mem-palace/Recall/RecallAdapter';
import { formatRecallResult } from '../skills/mem-palace/Recall/recallFormat';
import { decideCanonicalInjection } from './lib/canonical-dedupe';
import { mempalaceClient } from './lib/mempalace-client';
import { getPrincipalName } from './lib/identity';
import { isMachineGeneratedPrompt } from './lib/machine-text';
import { classifyPrompt, renderModeLine } from './lib/mode-classifier';
import { defaultScopeConsult } from './lib/scope-consult';
import {
  appendRouterTrace,
  writeTurnState,
  isOptionPickContinuation,
  type TraceReason,
} from './lib/router-trace';
import { randomUUID } from 'node:crypto';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const STATE_DIR = join(DOS_DIR, 'MEMORY', 'STATE');
const SIGNALS_DIR = join(DOS_DIR, 'MEMORY', 'LEARNING', 'SIGNALS');

// SEARCH relevance gate. Default 0.6 separates the measured bimodal distance
// distribution (on-topic 0.357-0.44, junk 0.72-0.83). 0 (or any garbage → NaN
// → 0) disables filtering and reproduces today's behavior exactly — the
// operator escape hatch; no gate removed, fail-open. Read from process.env at
// hook start; supported set-points are settings.json env or shell env. NOT
// .gateway.env — loadProjectEnv runs only in the CANONICAL branch, never on the
// SEARCH path.
const SEARCH_MAX_DISTANCE = (() => {
  const v = Number(process.env.DOS_SEARCH_MAX_DISTANCE ?? '0.6');
  return Number.isFinite(v) && v > 0 ? v : 0;
})();

// ─── Router emission rollout flags (spec clause C / A.7) ─────────────────────
//
// DOS_ROUTER_SILENT_DEFAULT (clause C): when '1', the NEW classifyPrompt +
// renderModeLine emission path is the live mode-line authority and
// OrchestratorPrompt suppresses its banner (S4). When unset/'0' (SHADOW), the
// legacy banner emits exactly as today while classifyPrompt + the B.1 trace run
// UNCONDITIONALLY (classify + log per A/B, current emission behavior unchanged).
// Revert is the same single env var — config write, not code revert.
//
// Read once at hook start (both this hook and OrchestratorPrompt read the
// IDENTICAL env name with the IDENTICAL default so no turn ever carries two
// banners or zero — partial-flip risk #2). NOT .gateway.env: settings.json env
// or shell env, same set-point surface as SEARCH_MAX_DISTANCE.
const ROUTER_SILENT_DEFAULT = process.env.DOS_ROUTER_SILENT_DEFAULT === '1';

// DOS_ROUTER_NEUTRAL_REMINDER (A.7/RT-A18): the class-7 mode-neutral reminder.
// Default OFF and PINNED OFF during all clause-C measurement windows — the
// silent stratum must be a single treatment. Only ever emits the EXACT CLAUDE.md
// quote (never an assertion of a mode for the current turn).
const ROUTER_NEUTRAL_REMINDER = process.env.DOS_ROUTER_NEUTRAL_REMINDER === '1';

// ─── Intent Classification ──────────────────────────────
// The classifier in lib/intent-classifier.ts emits a 6-intent taxonomy
// (adds EXPECT_RECALL, CANONICAL); we narrow back to the legacy 4 before
// the existing handleResume/Recall/Status/Search dispatch.

type Intent = 'RESUME' | 'RECALL' | 'STATUS' | 'SEARCH';

/**
 * Map a 6-intent classification down to the legacy 4. CANONICAL falls back
 * to SEARCH because by the time we narrow, the CANONICAL → RecallAdapter
 * branch has already failed (process.exit(0) on success). EXPECT_RECALL
 * gets re-classified upstream via classifyLegacyOnly to honour the user's
 * actual phrasing, never reaches this function.
 */
function narrowToLegacyIntent(intent: ClassifierIntent): Intent {
  switch (intent) {
    case 'RESUME':
    case 'RECALL':
    case 'STATUS':
    case 'SEARCH':
      return intent;
    default:
      return 'SEARCH';
  }
}

// ─── RFC-0037 §5.6 signal logging ──────────────────────────
// Security: never log raw prompt content — only matchedPattern, primitive,
// and ts. Per brief WS-F directive.

function appendSignal(filename: string, payload: Record<string, unknown>): void {
  try {
    // mkdirSync({recursive:true}) is idempotent — no existsSync guard needed.
    mkdirSync(SIGNALS_DIR, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...payload }) + '\n';
    appendFileSync(join(SIGNALS_DIR, filename), line);
  } catch (err) {
    // Logging is best-effort; never block dispatch on a write failure.
    console.error(`[IntentRetrieval] signal log failed for ${filename}: ${err}`);
  }
}

// Mode classifier — proactive nudge counterpart to ModeHeaderGuard's Stop-hook
// logging. Emits a 💡 MODE HINT alongside intent-driven memory retrieval.

export type Mode = 'MINIMAL' | 'NATIVE' | 'ALGORITHM';

// S1 (clause F): exported for the characterization corpus to pin CURRENT
// behavior by content (RT-A22) before S3 deletes the length buckets. The
// `export` keyword is the only change to these three regexes in this slice.
export const MINIMAL_RE = /^(\s*\d+\s*(\/\s*10)?\s*)?$|^(hi|hey|hello|thanks|thx|ty|ok|okay|yes|no|lgtm|nice|cool|sure|rating:|rate:|\d+\/10)\b/i;
export const NATIVE_RE = /\b(typo|rename|bump|version|one-?liner|quick\s*(fix|change|edit)|single\s*line|just\s*(add|change|fix)|small\s*(fix|edit)|lint|format|comment)\b/i;
export const ALGORITHM_RE = /\b(investigate|design|refactor|build|ship|audit|migrate|architect|plan|analy[sz]e|strateg|review|implement|rewrite|consolidate|propose|deliver|rfc|prd|deep\s*dive|end\s*to\s*end|multi-?(file|step|phase)|council|ultrathink)\b/i;

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  MINIMAL: 'acknowledgment / rating → MINIMAL format',
  NATIVE: 'single-step task → NATIVE mode header',
  ALGORITHM: 'multi-step work -> ALGORITHM mode (RFC-0001 orchestrator runtime)',
};

// RETIRED-IN-PLACE for the BANNER PATH (S3, engineering rule 9): classifyMode
// is no longer the banner-path authority — the live mode line comes from
// classifyPrompt + renderModeLine (lib/mode-classifier.ts), the single
// classifier per spec clause E. The characterization corpus
// (mode-classifier.characterization.test.ts, S1) still pins the length-bucket
// behavior below as the documented Feathers baseline.
// ⚠ NO LONGER FULLY DEAD (R13, Amendment R companion, 2026-07-08): handleSearch
// now consults classifyMode to size memory-INJECTION volume (ALGORITHM-shaped
// prompts inject the full compact list; others inject the top line). Editing
// the length buckets therefore changes production injection volume, not just
// the frozen test corpus — re-characterize deliberately if you touch them.
export function classifyMode(prompt: string): Mode {
  const trimmed = prompt.trim();
  if (MINIMAL_RE.test(trimmed) && trimmed.length < 24) return 'MINIMAL';
  if (ALGORITHM_RE.test(trimmed)) return 'ALGORITHM';
  if (NATIVE_RE.test(trimmed) && trimmed.length < 160) return 'NATIVE';
  if (trimmed.length > 280) return 'ALGORITHM';
  if (trimmed.length < 80) return 'NATIVE';
  return 'ALGORITHM';
}

// ─── Cooldown Guard (replaces fire-once) ──────────────────

const COOLDOWN_MS = 60 * 1000;     // 1 minute between fires
const MAX_FIRES_PER_SESSION = 10;  // Cap total fires per session

interface CooldownState {
  lastFired: number;
  fireCount: number;
}

function getCooldownPath(sessionId: string): string {
  return join(STATE_DIR, `intent-cooldown-${sessionId}.json`);
}

function readCooldown(sessionId: string): CooldownState {
  const path = getCooldownPath(sessionId);
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch { /* corrupt or missing */ }
  return { lastFired: 0, fireCount: 0 };
}

function writeCooldown(sessionId: string, state: CooldownState): void {
  // RFC-0005 §13.1 R2: atomic write — crash-safe, tmp+fsync+rename.
  atomicWriteSync(getCooldownPath(sessionId), JSON.stringify(state));
}

type FireDecision =
  | { fire: true }
  | { fire: false; reason: 'max-fires' | 'cooldown'; remainingMs?: number };

function shouldFire(sessionId: string, intent: Intent): FireDecision {
  const state = readCooldown(sessionId);

  // RESUME intent always bypasses cooldown (user explicitly asking to continue)
  if (intent === 'RESUME' && state.fireCount < MAX_FIRES_PER_SESSION) {
    return { fire: true };
  }

  // Max fires reached — stop
  if (state.fireCount >= MAX_FIRES_PER_SESSION) {
    return { fire: false, reason: 'max-fires' };
  }

  // Cooldown check
  const elapsed = Date.now() - state.lastFired;
  if (elapsed < COOLDOWN_MS) {
    return { fire: false, reason: 'cooldown', remainingMs: COOLDOWN_MS - elapsed };
  }

  return { fire: true };
}

function recordFire(sessionId: string): void {
  const state = readCooldown(sessionId);
  state.lastFired = Date.now();
  state.fireCount += 1;
  writeCooldown(sessionId, state);
}

// ─── RESUME Handler ──────────────────────────────
// RFC-0005 §14.9: retrieval goes through lib/mempalace.queryMemory; this
// handler formats the structured result into the user-facing briefing.

function handleResume(): string | null {
  const result = queryMemory({ intent: 'RESUME' });
  if (!result.content) return null;

  const meta = (result.metadata || {}) as {
    phase?: string;
    progress?: string;
    uncheckedCriteria?: string[];
    recentDecisions?: string[];
    context?: string;
  };

  const task = result.content;
  const phase = meta.phase || 'unknown';
  const progress = meta.progress || '0/0';
  const context = meta.context || '';
  const uncheckedList = meta.uncheckedCriteria || [];
  const recentDecisions = meta.recentDecisions || [];

  const parts: string[] = [];
  parts.push(`## Resume Briefing`);
  parts.push(`**Task:** ${task}`);
  parts.push(`**Phase:** ${phase} | **Progress:** ${progress}`);
  if (context) {
    parts.push(`\n**Context:** ${context}`);
  }
  if (uncheckedList.length > 0) {
    parts.push(`\n**Remaining criteria (${uncheckedList.length}):**`);
    uncheckedList.forEach(c => parts.push(`- [ ] ${c}`));
  }
  if (recentDecisions.length > 0) {
    parts.push(`\n**Recent decisions:**`);
    recentDecisions.forEach(d => parts.push(`- ${d}`));
  }
  return parts.join('\n');
}

// ─── RECALL Handler ──────────────────────────────

function handleRecall(projectWing: string | null): string | null {
  const result = queryMemory({ intent: 'RECALL', wing: projectWing || undefined });
  if (!result.content) return null;

  const ageLabel = (result.metadata as { ageLabel?: string } | undefined)?.ageLabel || 'recently';
  return `## Session Recall (snapshot from ${ageLabel})\n\n${result.content}`;
}

// ─── STATUS Handler ──────────────────────────────
// RFC-0005 §14.9: data retrieval lives in lib/mempalace.queryMemory —
// the hook just formats the structured MemoryResult into markdown.

function handleStatus(projectWing: string | null): string | null {
  const result = queryMemory({
    intent: 'STATUS',
    wing: projectWing || undefined,
    includeCrossWing: !!projectWing,
  });
  if (!result.content) return null;

  const meta = (result.metadata || {}) as {
    commitments?: any[];
    crossProjectCommitments?: any[];
    deferrals?: any[];
    blockers?: any[];
    pendingWork?: Array<{ task: string; phase: string; progress: string }>;
  };

  const parts: string[] = [];
  parts.push('## Project Status');

  const commitments = meta.commitments || [];
  if (commitments.length > 0) {
    parts.push(`\n**${commitments.length} open commitment(s)${projectWing ? ` (${projectWing})` : ''}:**`);
    for (const c of commitments) {
      const who = c.subject || 'unknown';
      parts.push(`- ${c.object} _(${who}, since ${c.valid_from})_`);
    }
  }

  const crossProject = meta.crossProjectCommitments || [];
  if (crossProject.length > 0) {
    parts.push(`\n**${crossProject.length} commitment(s) in other projects:**`);
    for (const c of crossProject) {
      parts.push(`- ${c.object} _(${c.subject})_`);
    }
  }

  const deferrals = meta.deferrals || [];
  if (deferrals.length > 0) {
    parts.push(`\n**${deferrals.length} deferred item(s):**`);
    for (const d of deferrals) {
      parts.push(`- ${d.object} _(deferred ${d.valid_from})_`);
    }
  }

  const blockers = meta.blockers || [];
  if (blockers.length > 0) {
    parts.push(`\n**${blockers.length} blocker(s):**`);
    for (const b of blockers) {
      parts.push(`- ${b.subject}: blocked by ${b.object}`);
    }
  }

  const pendingWork = meta.pendingWork || [];
  if (pendingWork.length > 0) {
    parts.push(`\n**${pendingWork.length} pending work item(s):**`);
    for (const w of pendingWork.slice(0, 8)) {
      parts.push(`- ${w.task} _(${w.phase}, ${w.progress || '?'})_`);
    }
  }

  if (parts.length <= 1) return null;
  return parts.join('\n');
}

// ─── SEARCH Handler ──────────────────────────────
// RFC-0005 §14.9: keyword extraction + compact formatting both live in
// lib/mempalace now (extractKeywords + query.format='compact'), so the
// hook body is just a thin adapter.
//
// RFC-0037 follow-up — topical-coherence enrichment: when SEARCH falls
// through (or EXPECT_RECALL routes here), the literal prompt is often
// lexically lossy (a turn like "show me something nice and audit payload"
// has no primitive name even though the surrounding session is about
// MemPalace). Read the last N CANONICAL fires for this session from
// recall-coverage.jsonl and prepend their primitives to the query so
// hybrid BM25+cosine biases toward conversation-current drawers. Uses
// existing MemPalace primitives only — no new bridge actions.

function readRecentCanonicalPrimitives(sessionId: string, max: number = 3): string[] {
  const path = join(SIGNALS_DIR, 'recall-coverage.jsonl');
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, 'utf-8').trim().split('\n').reverse();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of lines) {
      if (out.length >= max) break;
      try {
        const entry = JSON.parse(line);
        if (entry?.session_id !== sessionId) continue;
        if (entry?.op_kind !== 'canonical') continue;
        const primitive = typeof entry?.primitive === 'string' ? entry.primitive : null;
        if (!primitive || seen.has(primitive)) continue;
        seen.add(primitive);
        out.push(primitive);
      } catch { /* skip malformed line */ }
    }
    return out;
  } catch {
    return [];
  }
}

function handleSearch(prompt: string, projectWing: string | null, sessionId?: string): string | null {
  const recent = sessionId ? readRecentCanonicalPrimitives(sessionId) : [];
  const enriched = recent.length > 0 ? `${recent.join(' ')} ${prompt}` : prompt;

  // R13 (Amendment R companion, 2026-07-08): proportional recall — INJECTION
  // volume scales with task shape, retrieval quality does not. The query keeps
  // limit:3 so the bridge's n_results*3 hybrid-rerank pool is unchanged
  // (/code-review finding: limit:1 would shrink the pool 9→3 and degrade the
  // one result shown); NATIVE-shaped prompts then inject only the top line of
  // the compact output. MINIMAL-shaped prompts never reach here.
  const injectAll = classifyMode(prompt) === 'ALGORITHM';

  // Try wing-scoped first; fall back to unfiltered if the wing-scope is empty
  // (common when drawer metadata doesn't match the resolved wing — see Slice D).
  let result = queryMemory({
    intent: 'SEARCH',
    query: enriched,
    wing: projectWing || undefined,
    limit: 3,
    format: 'compact',
    maxDistance: SEARCH_MAX_DISTANCE,
  });

  // Folded major #2: the cross-project fallback fires ONLY when the wing pool
  // was empty BEFORE filtering (filteredOut absent). When the wing HAD matches
  // that the relevance gate dropped (filteredOut:true), suppress the fallback —
  // threshold tightening must never convert 'wing had mediocre matches' into
  // 'inject another project's content'. Identical trigger semantics to today.
  let crossProjectFallback = false;
  const filteredOut = (result.metadata as { filteredOut?: boolean } | undefined)?.filteredOut;
  if (!result.content && projectWing && !filteredOut) {
    result = queryMemory({
      intent: 'SEARCH',
      query: enriched,
      limit: 3,
      format: 'compact',
      maxDistance: SEARCH_MAX_DISTANCE,
    });
    if (result.content) crossProjectFallback = true;
  }

  if (!result.content) return null;
  // R13: compact format is one line per result — NATIVE-shaped prompts inject
  // only the top-ranked line; the full pool still informed the ranking.
  const content = injectAll ? result.content : result.content.split('\n')[0];
  if (crossProjectFallback) {
    return `⚠ CROSS-PROJECT FALLBACK — wing "${projectWing}" had no matches; results below come from the global palace and may belong to a different project. Verify before acting.\n\n${content}`;
  }
  return content;
}

// ─── Skip Logic ──────────────────────────────

// een contract (mode-detection.md Effort Override Detection): a leading '/e[1-5]'
// is an OPERATOR EFFORT OVERRIDE, not a slash command — GATE-0 must not swallow
// it. A standalone 'E[1-5]' token is exempt from the <10-char skip. Both forms
// are then classified normally (the classifier consumes the level, ratchet-only).
const EFFORT_OVERRIDE_SLASH_RE = /^\/e[1-5]\b/i;
const EFFORT_OVERRIDE_BARE_RE = /^e[1-5]$/i;

function isSkippablePrompt(prompt: string): boolean {
  const trimmed = prompt.trim();
  // een exemptions FIRST — they override the <10-char and slash skips.
  if (EFFORT_OVERRIDE_SLASH_RE.test(trimmed)) return false;
  if (EFFORT_OVERRIDE_BARE_RE.test(trimmed)) return false;
  if (trimmed.length < 10) return true;
  if (/^\d{1,2}$/.test(trimmed)) return true;
  if (trimmed.startsWith('/')) return true;
  // Harness-generated text — no banner, no injection, no fire-budget burn.
  if (isMachineGeneratedPrompt(prompt)) return true;
  return false;
}

// ─── Main ──────────────────────────────

interface HookInput {
  session_id: string;
  prompt?: string;
  transcript_path?: string;
}

async function readHookInput(): Promise<HookInput | null> {
  try {
    const input = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
    ]);
    return input.trim() ? JSON.parse(input) : null;
  } catch {
    return null;
  }
}

async function main() {
  const input = await readHookInput();
  if (!input || !input.prompt || !input.session_id) {
    // Never-blocks contract (engineering rule 3): malformed/empty stdin → exit 0.
    // No prompt → nothing to classify, nothing to trace.
    process.exit(0);
  }

  // Auto-derive active Algorithm version from LATEST (single source of truth).
  // Hard-coded version literals would drift from `algorithm-flip` outputs;
  // upstream's v6.2.0 lesson — "when synced fields drift, remove the duplicated
  // field, not add a synchronizer" — applies here. Resolved BEFORE classification
  // because renderModeLine needs it for the ALGORITHM banner.
  let algorithmVersion = 'v0.0.6';
  try {
    algorithmVersion = readFileSync(join(DOS_DIR, 'DOS', 'Algorithm', 'LATEST'), 'utf8').trim() || 'v0.0.6';
  } catch {
    /* LATEST missing or unreadable — fall back to baseline version */
  }

  // ── ROUTER CLASSIFICATION + TRACE (spec B.1 / clause D) ────────────────────
  //
  // BINDING PLACEMENT (B.1/RT-A16): classify and trace BEFORE every gate — the
  // machine-text exit, the cooldown/max-fires exit, and the GATE-0 skip gates —
  // so the denominator is UserPromptSubmit EVENTS, not survivors. classifyPrompt
  // is synchronous and bridge-free (clause D); the cooldown gates ONLY the
  // memory-injection work below, never classification, emission, or logging.
  //
  // F3 survives the single-authority consolidation: IntentRetrieval computes the
  // option-pick continuation (it already receives transcript_path) and passes it
  // as positive class-3 evidence so the up-route is preserved inside the one
  // classifier (clause E).
  const continuationEvidence = isOptionPickContinuation(input.prompt, input.transcript_path);
  const modeDecision = classifyPrompt(input.prompt, defaultScopeConsult(), { continuationEvidence });
  const turnId = randomUUID();

  // The trace reason reflects what WILL happen to this turn's emission. We
  // evaluate the (cheap, read-only) gate predicates up front to label the row,
  // then append exactly once before any gate runs.
  const willSkip = isSkippablePrompt(input.prompt);
  const traceReason: TraceReason =
    modeDecision.evidence_class === 'machine-text' && modeDecision.emission === 'silent'
      ? 'machine-text'
      : willSkip
        ? 'skip-gate'
        : 'matched-class';

  appendRouterTrace({ sessionId: input.session_id, turnId, decision: modeDecision, reason: traceReason });
  // B.2 turn-state handshake: ModeHeaderGuard (S5) joins the Stop row on this
  // turn_id via sha256 of the operator text — never "latest trace before Stop".
  writeTurnState(input.session_id, turnId, input.prompt, modeDecision.verdict);

  // ── MODE-LINE EMISSION (decoupled from cooldown — clause D) ─────────────────
  //
  // The mode line is a synchronous classifier output, NOT memory injection: it
  // emits regardless of cooldown/max-fires. Flip-gated by DOS_ROUTER_SILENT_DEFAULT
  // (clause C): when SET, the NEW renderModeLine path is the live authority here
  // (and OrchestratorPrompt suppresses its banner — S4). When UNSET (shadow), the
  // legacy banner emits below exactly as today while this classify+trace runs
  // unconditionally. renderModeLine returns null on silent classes (1 hard-silence
  // and 7 unless the neutral-reminder flag is on) — no line, by design.
  if (ROUTER_SILENT_DEFAULT) {
    const line = renderModeLine(modeDecision, algorithmVersion, {
      neutralReminder: ROUTER_NEUTRAL_REMINDER,
    });
    if (line) console.log(line);
  }

  // Skip short prompts, ratings, commands — GATES ONLY the memory-injection work
  // below (clause D). Classification, emission, and the B.1 trace already ran.
  if (willSkip) {
    process.exit(0);
  }

  // RFC-0037 §5.6 PREPENDED branches (both run BEFORE cooldown check):
  //   - CANONICAL → invoke RecallAdapter → emit markdown → exit 0
  //   - EXPECT_RECALL → log signal + inject warning → fall through
  // The legacy 4-intent dispatch is UNCHANGED. queryMemory() is UNTOUCHED.
  const classified = classifyPromptIntent(input.prompt);

  if (classified.intent === 'CANONICAL' && classified.primitive) {
    try {
      // RecallAdapter queries the Studio mirror; load .gateway.env so
      // STUDIO_API_URL + STUDIO_API_KEY are in process.env before the call.
      // Sibling hooks (StudioSync, DrainPending) call loadProjectEnv too;
      // scoped here so the ~10 file stats don't tax non-CANONICAL prompts.
      loadProjectEnv();
      // adapter.recall() returns null on unknown primitive — no pre-check needed.
      const result = await new RecallAdapter().recall(classified.primitive);
      if (result) {
        // B-2 dedupe/demotion: compute the formatted payload + hash ONCE, then
        // ask the pure decider whether to inject full, inject a demoted
        // placeholder (Studio-only stale/orphaned), or suppress to a pointer.
        // Per-session state lives at intent-canonical-<sid>.json; a corrupt or
        // missing file fails OPEN (inject-full) inside the decider.
        const payload = formatRecallResult(result);
        const status = (result as any).current?.status ?? null;
        const payloadSha256 = createHash('sha256').update(payload).digest('hex');

        const statePath = join(STATE_DIR, `intent-canonical-${input.session_id}.json`);
        let stateJson: string | null = null;
        try {
          if (existsSync(statePath)) stateJson = readFileSync(statePath, 'utf-8');
        } catch { /* unreadable → decider fail-opens on null */ }

        const decision = decideCanonicalInjection(
          stateJson,
          classified.primitive,
          payloadSha256,
          result.primitive,
          status,
        );
        atomicWriteSync(statePath, decision.nextState);

        // Coverage metric is unchanged: exactly one row per fire on ALL three
        // actions (readRecentCanonicalPrimitives filters only session_id/
        // op_kind/primitive, so the additive fields don't perturb it).
        appendSignal('recall-coverage.jsonl', {
          op_kind: 'canonical',
          session_id: input.session_id,
          primitive: classified.primitive,
          matchedPattern: classified.matchedPattern,
          ...(decision.action === 'suppress' ? { deduped: true } : {}),
          ...(decision.action === 'inject-demoted' ? { demoted: status } : {}),
        });

        if (decision.action === 'suppress') {
          console.log(
            `📎 CANONICAL ${classified.primitive} unchanged — already in context (suppressed; run: bun ~/Durante/Tools/recall.ts ${classified.primitive})`,
          );
        } else if (decision.action === 'inject-demoted') {
          // No timestamp parenthetical: valid_from is recall-invocation time,
          // not data age — fabricating a 'latest <now>' label is forbidden.
          console.log('\n--- Intent-Driven Memory (CANONICAL → RecallAdapter) ---');
          console.log(`## Canonical Recall — ${result.primitive}`);
          console.log(
            `**Status:** ${status} — snapshot not current; payload withheld. Run \`bun ~/Durante/Tools/recall.ts studio\` to view/refresh.`,
          );
          console.log('--- End Intent Memory ---\n');
        } else {
          console.log('\n--- Intent-Driven Memory (CANONICAL → RecallAdapter) ---');
          console.log(payload);
          console.log('--- End Intent Memory ---\n');
        }
        process.exit(0);
      }
    } catch (err) {
      // Fall through to legacy dispatch on RecallAdapter failure.
      console.error(
        `[IntentRetrieval] CANONICAL dispatch failed for primitive=${classified.primitive}: ${err}`,
      );
    }
  }

  let expectRecallWarningLine: string | null = null;
  if (classified.intent === 'EXPECT_RECALL') {
    appendSignal('expect-recall.jsonl', {
      op_kind: 'expect_recall',
      session_id: input.session_id,
      matchedPattern: classified.matchedPattern,
      primitive: classified.primitive ?? null,
    });
    expectRecallWarningLine =
      `⚠ EXPECT_RECALL detected; ${getPrincipalName()} signaled prior context. Consult memory thoroughly before answering.`;
  }

  // EXPECT_RECALL re-classifies through the legacy regex so the existing
  // RESUME/RECALL/STATUS/SEARCH dispatch handles the prompt's actual phrasing
  // (e.g. "you should know already we worked on Studio yesterday" → RECALL).
  const intent: Intent =
    classified.intent === 'EXPECT_RECALL'
      ? narrowToLegacyIntent(classifyLegacyOnly(input.prompt).intent)
      : narrowToLegacyIntent(classified.intent);

  // Cooldown guard (replaces fire-once)
  const decision = shouldFire(input.session_id, intent);
  if (!decision.fire) {
    if (decision.reason === 'cooldown') {
      const remainingMin = Math.max(1, Math.ceil((decision.remainingMs ?? 0) / 60000));
      console.log(`--- Memory: cooldown active (next fire in ${remainingMin}m) ---\n`);
    } else if (decision.reason === 'max-fires') {
      console.log('--- Memory: max fires reached for session ---\n');
    }
    process.exit(0);
  }

  // Record fire before doing work (prevents concurrent double-fire)
  recordFire(input.session_id);

  const { wing: projectWing } = resolveProjectWingFromEnv();
  console.error(`[IntentRetrieval] Intent: ${intent} | Session fire #${readCooldown(input.session_id).fireCount}`);

  // V11.6 — circuit-breaker check BEFORE bridge calls. If the rolling-5
  // injection-latency window averaged > 2000ms we skip injection for the
  // rest of this session and emit a one-time mempalace.inject.degraded
  // warning (per RFC-0076 ISC-V11.6). The mode-hint banner still emits
  // because that's not memory-injection — it's a synchronous classifier.
  const circuit = checkInjectionCircuit(input.session_id);
  if (circuit.warning) {
    console.error(circuit.warning);
    console.error('[IntentRetrieval] Circuit breaker tripped — skipping injection for the rest of this session.');
  }

  // V11.5 — Project wing pre-flight. Runs only on the first session-fire
  // (cooldown has already advanced state.fireCount above; we read it back
  // and gate on fireCount === 1). Cheap status() bridge call is not on the
  // hot path of every prompt — only the first qualifying one per session.
  let wingDriftBanner: string | null = null;
  const fireCount = readCooldown(input.session_id).fireCount;
  if (!circuit.skip && fireCount === 1) {
    try {
      const statusStart = Date.now();
      // Bounded: the wing-drift preflight is best-effort cosmetic; never let it
      // dominate the UserPromptSubmit deadline when MemPalace is slow/lock-contended.
      const statusResp = mempalaceClient.status({}, { callerHook: 'IntentRetrieval', timeoutMs: 3000 });
      const statusElapsed = Date.now() - statusStart;
      let wings: WingDrawerCounts = {};
      if (statusResp.ok && statusResp.data?.wings) {
        wings = statusResp.data.wings;
      }
      const preflight = runWingDriftPreflight(wings, input.session_id);
      wingDriftBanner = preflight.banner;
      if (preflight.events.length > 0) {
        console.error(
          `[IntentRetrieval] Wing-drift detected (${preflight.events.length} unprovisioned): ${preflight.events.map((e) => e.wing).join(', ')} (status() ${statusElapsed}ms)`,
        );
      }
    } catch (err) {
      console.error(`[IntentRetrieval] Wing-drift preflight failed (non-fatal): ${err}`);
    }
  }

  // Route to appropriate handler. V11.6 — circuit.skip short-circuits the
  // bridge calls entirely; we still emit the mode hint and (if any) the
  // wing-drift banner because those are local computations, not bridge
  // calls. trackInjectionLatency is wrapped around the switch so the
  // rolling window measures end-to-end injection time including fallbacks.
  let results: string | null = null;
  if (!circuit.skip) {
    const injectStart = Date.now();
    try {
      switch (intent) {
        case 'RESUME':
          results = handleResume();
          if (!results) {
            // No unfinished PRD — fall back to search
            console.error('[IntentRetrieval] No unfinished PRD for RESUME, falling back to SEARCH');
            results = handleSearch(input.prompt, projectWing, input.session_id);
          }
          break;

        case 'RECALL':
          results = handleRecall(projectWing);
          if (!results) {
            console.error('[IntentRetrieval] No snapshot for RECALL, falling back to SEARCH');
            results = handleSearch(input.prompt, projectWing, input.session_id);
          }
          break;

        case 'STATUS':
          results = handleStatus(projectWing);
          if (!results) {
            console.error('[IntentRetrieval] No status data, falling back to SEARCH');
            results = handleSearch(input.prompt, projectWing, input.session_id);
          }
          break;

        case 'SEARCH':
        default:
          results = handleSearch(input.prompt, projectWing, input.session_id);
          break;
      }
    } finally {
      trackInjectionLatency(input.session_id, Date.now() - injectStart);
    }
  }

  // LEGACY SHADOW BANNER (clause C): emitted ONLY when DOS_ROUTER_SILENT_DEFAULT
  // is UNSET. In shadow the legacy classifyMode verdict drives this banner so
  // "current emission behavior unchanged" — but the fossilized 1.7% conformance
  // figure is DELETED by content (A.3/RT-A21: banners cite NO conformance
  // figures of any kind). When the flag is SET (flip), renderModeLine already
  // emitted the single mode line at the top of main(); emitting here too would
  // double-banner, so this block is suppressed.
  const modeHint = classifyMode(input.prompt);
  const modeHintLine =
    modeHint === 'ALGORITHM'
      ? [
          `🚨 MODE: ALGORITHM REQUIRED — ${MODE_DESCRIPTIONS[modeHint]}`,
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
        ].join('\n')
      : modeHint === 'NATIVE'
      ? `💡 MODE HINT: NATIVE — ${MODE_DESCRIPTIONS[modeHint]}\n\nFIRST output line must be \`════ DOS | NATIVE MODE ═══════════════════════\`.`
      : `💡 MODE HINT: MINIMAL — ${MODE_DESCRIPTIONS[modeHint]}\n\nFIRST output line must be \`═══ DOS ═══════════════════════════\`.`;
  const capped = results ? results.substring(0, 5000) : null;

  console.log(`\n--- Intent-Driven Memory (${intent} from message) ---`);
  if (expectRecallWarningLine) console.log(expectRecallWarningLine);
  // V11.5 — surface wing-drift findings inline with memory output so the
  // operator sees declared-but-unprovisioned wings in the same context that
  // a misroute would silently land in general/.
  if (wingDriftBanner) console.log(wingDriftBanner);
  // V11.6 — when circuit breaker fired its one-shot warning, surface it
  // model-side too so the operator sees why injection went silent.
  if (circuit.warning) console.log(circuit.warning);
  if (capped) console.log(capped);
  if (!ROUTER_SILENT_DEFAULT) console.log(modeHintLine);
  console.log(`--- End Intent Memory ---\n`);
  console.error(
    circuit.skip
      ? `[IntentRetrieval] Injection skipped (circuit breaker tripped) — emitted mode hint only (legacy=${modeHint}, router=${modeDecision.evidence_class}/${modeDecision.verdict ?? 'silent'})`
      : capped
      ? `[IntentRetrieval] Injected ${capped.length} chars via ${intent} handler (legacy=${modeHint}, router=${modeDecision.evidence_class}/${modeDecision.verdict ?? 'silent'})`
      : `[IntentRetrieval] No memory results for ${intent} intent — emitted mode hint only (legacy=${modeHint}, router=${modeDecision.evidence_class}/${modeDecision.verdict ?? 'silent'})`,
  );

  process.exit(0);
}

// import.meta.main guard (matches the other hooks — ArtifactAutoLogger,
// CapabilityInvocationLedger) so this module can be imported by the S1
// characterization corpus to pin classifyMode without spawning the hook's
// stdin-reading main(). Runtime behavior under `bun IntentRetrieval.hook.ts`
// is unchanged: import.meta.main is true only for the entrypoint.
if (import.meta.main) {
  const _t = startTimer('IntentRetrieval');
  process.on('exit', () => stopTimer(_t, 'UserPromptSubmit'));
  main().catch((err) => {
    console.error(`[IntentRetrieval] Fatal: ${err}`);
    process.exit(0);
  });
}
