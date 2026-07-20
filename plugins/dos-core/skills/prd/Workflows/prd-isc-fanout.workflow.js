// ─────────────────────────────────────────────────────────────────────────
// prd-isc-fanout — native dynamic workflow  (RFC-0123; RFC-0121 distributable instance #2)
// fixture-version: prd-isc-fanout-v1
// owner: PRD (Packs/PRD)
// purpose: parallel per-domain ISC decomposition → single-voice convergence → deterministic
//          dedup/splitting-test/count. The agent→code→report contract for the highest-leverage
//          workflow shape (PRD quality compounds across every implementation); the 200+-ISC
//          payload never re-enters the orchestrator context window.
// RFC-0123 §5 Q1 RESOLVED here: convergence = a SINGLE "ISC editor" agent (preserves authorial
//          coherence — the conceptual-integrity make-or-break; a deterministic-only normalize
//          cannot resolve cross-domain vocabulary/granularity drift).
//
// DISTRIBUTION (RFC-0121): this is the SoT, pack-owned, `.workflow.js`-suffixed source. It installs
//   IMMUTABLY to ~/.claude/workflows/prd-isc-fanout.js (install.sh; pack-source wins on upgrade;
//   operator escape hatch = ~/.claude/workflows/local-override/prd-isc-fanout.js). The manifest
//   `native_workflows` pair-class + sync-check `compareNativeWorkflows()` guard drift + the §2.7
//   project-local collision. Acceptance gate: `bun Tools/workflow-acceptance.ts <this file>`.
//   Promoted 2026-05-29 from spikes/prd-isc-fanout/prd-isc-fanout.js (RFC-0120 C2: distributable
//   population reached 3 — dos-upgrade-scan + prd-isc-fanout + feature-discovery).
//
// run:  Workflow({ name: "prd-isc-fanout", args: { task: "<task to decompose into ISCs>" } })
// conventions honored: RFC-0117 §J.4 args-JSON-parse; §J.3 cost ceiling (MAX_UNITS); result-
//   disposition / no-silent-stalls; return-content-then-primary-writes; declared permissions
//   (RFC-0121 §2.4 leg-c — AUDIT surface, not runtime enforcement).
// Date.now()/Math.random() are unavailable in workflow scripts.
// ─────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'prd-isc-fanout',
  description: 'Fan out per-domain ISC decomposition, converge under a single conceptual-integrity voice, then deterministically dedup/splitting-test/count — agent→code→report; the 200+-ISC payload never re-enters the orchestrator context.',
  phases: [
    { title: 'decompose', detail: 'one agent per ISC domain decomposes the task into atomic ISCs (§3.1 Splitting Test)' },
    { title: 'converge', detail: 'single ISC-editor agent harmonizes vocabulary/granularity, resolves cross-domain overlap (the make-or-break)' },
    { title: 'merge-count', detail: 'deterministic JS: final dedup, splitting-test flags, progress denominator, coverage map' },
  ],
}

// RFC-0121 §2.4 leg-c — DECLARED PERMISSIONS (AUDIT surface, not runtime enforcement: the Workflow
// runtime does not yet constrain spawned agents to these tools — a PR widening this block is the
// review signal, not a runtime gate; Cato D6). The decompose + converge agents work entirely from
// the inline TASK string — they read no files, write nothing (return-content-then-primary-writes),
// and never reach the network. max_units mirrors the MAX_UNITS cost ceiling below (RFC-0117 §J.3).
// NOTE: plain `const` (NOT `export const`) — the Workflow runtime allows exactly ONE top-level
// export (`export const meta`); a 2nd `export` throws SyntaxError at load (RFC-0121 D12). The
// acceptance harness leg-a asserts the single-export invariant.
const permissions = {
  agent_tools: [],
  writes: [],
  network: false,
  max_units: 20,
}

const FIXTURE_VERSION = 'prd-isc-fanout-v1'
// RFC-0117 §J.4: the Workflow tool delivers args as a JSON STRING — parse defensively.
const ARGS = (() => { if (typeof args === 'string') { try { return JSON.parse(args) } catch { if (typeof log === 'function') log('⚠ ARGS DEGRADED: args arrived as a non-JSON string — running skeleton defaults. Pass structured JSON args (RFC-0117 §J.4).'); return { __argsDegraded: true } } } return (args || {}) })()
const TASK = ARGS.task || ''
// RFC-0117 §J.3 cost ceiling.
const MAX_UNITS = ARGS.maxUnits || 20

// §3.2 by-domain decomposition surface + anti-criteria. Width is data-driven; absent domains self-skip.
const DEFAULT_DOMAINS = [
  { id: 'ui',       label: 'UI/Visual',      guide: 'elements, states, breakpoints, accessibility' },
  { id: 'data-api', label: 'Data/API',       guide: 'fields, validation rules, error cases, edge inputs' },
  { id: 'logic',    label: 'Logic/Flow',     guide: 'branches, state transitions, boundaries, idempotency' },
  { id: 'content',  label: 'Content',        guide: 'sections, format, tone, length limits' },
  { id: 'infra',    label: 'Infrastructure', guide: 'services, config, permissions, rate limits, env' },
  { id: 'anti',     label: 'Anti-criteria',  guide: 'out-of-scope-but-tempting work that must NOT happen' },
]
const DOMAINS = (ARGS.domains || DEFAULT_DOMAINS).slice(0, MAX_UNITS)

const DECOMPOSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['domain', 'iscs', 'skipped'],
  properties: {
    domain: { type: 'string' },
    iscs: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['text', 'anti', 'verification_method'],
        properties: {
          text: { type: 'string', description: 'one atomic verifiable criterion, 8-14 words, passes the Splitting Test' },
          anti: { type: 'boolean', description: 'true if this is an anti-criterion (must NOT happen)' },
          verification_method: { type: 'string', description: 'the command/file/artifact that proves it' },
        },
      },
    },
    skipped: { type: 'array', items: { type: 'string' }, description: 'no-silent-stalls: domain not applicable, with reason' },
  },
}

const CONVERGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['iscs', 'normalization_notes'],
  properties: {
    iscs: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['domain', 'text', 'anti', 'verification_method'],
        properties: {
          domain: { type: 'string' },
          text: { type: 'string' },
          anti: { type: 'boolean' },
          verification_method: { type: 'string' },
        },
      },
    },
    normalization_notes: { type: 'array', items: { type: 'string' }, description: 'what was harmonized/merged/regrained across domains' },
  },
}

// SEAM-GUARD-START — constraint-first pre-flight (PRD 20260531-093152 / D6). PARITY with
// Packs/discover/src/Tools/task-string-validator.ts guardTaskString (conformance: seam-guard-parity.test.ts).
// A STRUCTURED-but-malformed task string (slot labels present, constraint missing / not first /
// bare stack-shape) fails CLOSED before any decompose agent spawns; a fully UNSTRUCTURED free-form
// task (no slot labels) is a legacy direct call and passes. Non-export const (single-export invariant).
const seamGuard = (input) => {
  const text = input || ''
  const SLOT_ANY = /^[ \t]*(?:(?:LOAD[-\s]?BEARING\s+)?CONSTRAINT|ACTOR|BOUNDARY|STACK)\b[^\n:]*:/im
  if (!SLOT_ANY.test(text)) return { ok: true, legacy: true, reason: 'unstructured free-form task — seam guard not applicable' }
  const LABELS = [['constraint', /^[ \t]*(?:LOAD[-\s]?BEARING\s+)?CONSTRAINT\b[^\n:]*:/im], ['actor', /^[ \t]*ACTOR\b[^\n:]*:/im], ['boundary', /^[ \t]*BOUNDARY\b[^\n:]*:/im], ['stack', /^[ \t]*STACK\b[^\n:]*:/im]]
  const RANK = { constraint: 0, actor: 1, boundary: 2, stack: 3 }
  const STACK_SHAPE = /^\W*(?:the\s+|a\s+|an\s+)?[\w./@-]+(?:\s+[\w./@-]+){0,2}\s+(?:tables?|endpoints?|routes?|apis?|librar(?:y|ies)|packages?|modules?|models?|columns?|fields?|components?|hooks?)\W*$/i
  const ACCEPT_VOCAB = /\b(invariant|aggregate|bounded[-\s]context|boundar(?:y|ies)|consistency|must\s+hold|at\s+(?:every\s+)?commit|must\s+not|guarantee|rule|never\b)/i
  const found = LABELS.map(([slot, re]) => { const m = text.match(re); return { slot, idx: m && m.index !== undefined ? m.index : -1, len: m ? m[0].length : 0 } }).filter(s => s.idx >= 0).sort((a, b) => a.idx - b.idx)
  const c = found.find(s => s.slot === 'constraint')
  if (!c) return { ok: false, reason: 'fail-closed: structured task missing a named constraint section' }
  if (found[0].slot !== 'constraint') return { ok: false, reason: `constraint not in first slot (found ${found[0].slot})` }
  for (let i = 1; i < found.length; i++) if (RANK[found[i].slot] < RANK[found[i - 1].slot]) return { ok: false, reason: `slots out of order: ${found[i].slot} after ${found[i - 1].slot}` }
  const nextIdx = found.filter(s => s.idx > c.idx).reduce((m, s) => Math.min(m, s.idx), text.length)
  const body = text.slice(c.idx + c.len, nextIdx).replace(/^[\s:().,-]+/, '').trim()
  if (!body) return { ok: false, reason: 'fail-closed: empty constraint' }
  const firstSentence = body.split(/(?<=[.\n])/)[0].trim()
  if (STACK_SHAPE.test(firstSentence) && !ACCEPT_VOCAB.test(body)) return { ok: false, reason: 'pure stack-shape constraint — re-derive a domain invariant/aggregate/boundary' }
  if (!ACCEPT_VOCAB.test(body)) return { ok: false, reason: 'constraint names no domain invariant/aggregate/boundary' }
  return { ok: true, reason: 'ok' }
}
// SEAM-GUARD-END
const _seam = seamGuard(TASK)
if (!_seam.ok) return { fixture_version: FIXTURE_VERSION, task: TASK, error: `prd-isc-fanout SEAM GUARD rejected the task string: ${_seam.reason}`, preflight: _seam, result_disposition: 'rejected-at-seam-guard' }

if (!TASK) log('WARN: no args.task provided — decompose agents will have nothing to decompose')

// ===== Phase 1: decompose — parallel fan-out, one agent per domain =====
phase('decompose')
log(`prd-isc-fanout ${FIXTURE_VERSION} — decompose over ${DOMAINS.length} domain(s) (cap ${MAX_UNITS})`)
const domainPayloads = await parallel(DOMAINS.map(d => () =>
  agent(
    `You are the ${d.label} decomposition unit of a PRD ISC generator. TASK to decompose:

"${TASK}"

Decompose ONLY the ${d.label} slice (${d.guide}) into ATOMIC, verifiable ISC criteria. Apply the
Splitting Test: if a criterion contains "and"/"with"/"including" joining verifiable things, or a
scope word ("all"/"every"/"complete"), split it. Each criterion: 8-14 words, one verifiable end-state,
with a concrete verification_method. For ${d.label === 'Anti-criteria' ? 'anti-criteria set anti=true' : 'normal criteria set anti=false'}.
If the ${d.label} domain is NOT relevant to this task, return empty iscs and one skipped[] reason.`,
    { label: `decompose:${d.id}`, phase: 'decompose', model: 'sonnet', schema: DECOMPOSE_SCHEMA }
  )
))

// ===== Phase 2: converge — SINGLE voice (the make-or-break, RFC-0123 §2.2) =====
phase('converge')
const live = domainPayloads.filter(Boolean)
const failedUnits = domainPayloads.length - live.length
// Tag each ISC with the CANONICAL domain id by position (parallel preserves order) — never trust the
// agent-returned free-text domain for the coverage key [review #6]. p?.iscs handles null (failed) units.
const rawIscs = domainPayloads.flatMap((p, idx) => (p?.iscs || []).map(i => ({ ...i, domain: DOMAINS[idx].id })))
const decomposeSkips = domainPayloads.flatMap((p, idx) => (p?.skipped || []).map(r => `${DOMAINS[idx].id}: ${r}`))
if (failedUnits > 0) decomposeSkips.push(`${failedUnits} decompose unit(s) FAILED — no payload [no-silent-stalls]`)

let converged
if (rawIscs.length === 0) {
  converged = { iscs: [], normalization_notes: ['no ISCs produced — nothing to converge'] }
} else {
  if (rawIscs.length > 80) log(`WARN: ${rawIscs.length} raw ISCs exceed single-converge-agent comfort (~80) — production must shard the converge pass (RFC-0123 §5 follow-on) [review #4]`)
  converged = await agent(
    `You are the SINGLE conceptual-integrity editor for a PRD's ISC set. ${rawIscs.length} atomic ISCs were
generated INDEPENDENTLY by per-domain units, so vocabulary, granularity, and verb tense will drift and
some criteria will overlap across domains. Your job: produce ONE coherent, consistent ISC set —
normalize vocabulary and verb tense, enforce a uniform atomic grain, merge/deduplicate cross-domain
overlaps, and keep every criterion verifiable. Do NOT drop coverage; if you merge two, the merged
criterion must cover both. Preserve the domain tag and anti flag. Record what you harmonized.

RAW ISCs (JSON): ${JSON.stringify(rawIscs)}`,
    { label: 'converge:isc-editor', phase: 'converge', model: 'opus', schema: CONVERGE_SCHEMA }
  )
}
// Null-guard: the lone converge agent has no .filter(Boolean) safety net like the fan-out [review #3].
if (!converged || !Array.isArray(converged.iscs)) {
  converged = { iscs: [], normalization_notes: ['converge agent produced no usable result — FAILED [no-silent-stalls]'] }
}

// ===== Phase 3: merge-count — deterministic JS, zero agents =====
phase('merge-count')
// Preserve DISCRIMINATING symbols: deleting them collapses semantically distinct
// criteria (e.g. 'p<0.05' vs 'p>0.05' both → 'p005'), dropping one as a false dup
// and undercounting the progress denominator (§3.3). Keep the symbols themselves
// (operators/thresholds/versions like < > = / . %) so they stay distinguishable;
// only lowercase and collapse whitespace runs, which is the safe normalization.
const norm = t => (t || '').toLowerCase().replace(/\s+/g, ' ').trim()
const seen = new Set()
const deduped = []
const dedupDropped = []
for (const isc of (converged.iscs || [])) {
  const n = norm(isc.text)
  if (!n) continue
  const k = `${isc.anti ? 'A' : 'N'}|${n}` // anti-aware: never collapse a normal + an anti criterion [review #2]
  if (!seen.has(k)) { seen.add(k); deduped.push(isc) }
  else dedupDropped.push(isc.text) // observable, not silent [review #2]
}
// Splitting-Test residual flag (§3.1) — ADVISORY. Narrowed to genuine conjunctions; the prior
// with/including/scope-word arm over-flagged atomic criteria 19/51 on the first run [review #1].
const SPLIT_RE = /\b(and|plus)\b/i
const splitCandidates = deduped.filter(i => SPLIT_RE.test(i.text)).map(i => i.text)
// progress denominator by body-count (closes §6.1.e6 / §3.3 undercount by construction).
const count = deduped.length
const antiCount = deduped.filter(i => i.anti).length
const coverage = {}
for (const i of deduped) coverage[i.domain] = (coverage[i.domain] || 0) + 1
log(`converged ${rawIscs.length}→${count} ISCs (${antiCount} anti); ${splitCandidates.length} split-candidates (advisory); ${dedupDropped.length} dups dropped; coverage ${JSON.stringify(coverage)}`)

// ===== emit — return ISC set; primary writes the PRD ## Criteria =====
let nNormal = 0, nAnti = 0 // independent dense counters per series [review #5]
const criteria_markdown = deduped
  .map(i => i.anti
    ? `- [ ] ISC-ANTI-${++nAnti}: ${i.text}  _(verify: ${i.verification_method})_`
    : `- [ ] ISC-${++nNormal}: ${i.text}  _(verify: ${i.verification_method})_`)
  .join('\n')

return {
  fixture_version: FIXTURE_VERSION,
  task: TASK,
  progress_denominator: count,
  counts: { domains: DOMAINS.length, failed_units: failedUnits, raw: rawIscs.length, converged: count, anti: antiCount, split_candidates: splitCandidates.length, dedup_dropped: dedupDropped.length },
  coverage,
  split_candidates: splitCandidates,
  dedup_dropped: dedupDropped,
  decompose_skips: decomposeSkips,
  normalization_notes: converged.normalization_notes || [],
  criteria_markdown,
  result_disposition: 'returned-to-primary-for-PRD-write',
}
