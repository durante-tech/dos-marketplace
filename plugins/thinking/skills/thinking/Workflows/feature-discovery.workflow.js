// ─────────────────────────────────────────────────────────────────────────
// feature-discovery — native dynamic workflow  (RFC-0124; RFC-0121 distributable instance #3)
// fixture-version: feature-discovery-v1
// owner: Thinking (Packs/Thinking)
// purpose: turn a vague business-feature input into a complete discovery brief that SEEDS
//          prd-isc-fanout (RFC-0123). scout → fan-out dimensions → completeness-critic
//          loop-until-dry ("nothing missed") → single-voice brief convergence + ISC seeds.
//          agent→code→report; overflow-heavy dimension research never re-enters the orchestrator.
// make-or-break (RFC-0124 §2): the completeness-LOOP — a critic re-fans gaps until two
//          consecutive passes find nothing new. Bounded by MAX_ROUNDS (§J.3: a looping workflow
//          MUST NOT run unbounded) and MAX_UNITS (fan-out width cap).
//
// DISTRIBUTION (RFC-0121): this is the SoT, pack-owned, `.workflow.js`-suffixed source. It installs
//   IMMUTABLY to ~/.claude/workflows/feature-discovery.js (install.sh; pack-source wins on upgrade;
//   operator escape hatch = ~/.claude/workflows/local-override/feature-discovery.js). The manifest
//   `native_workflows` pair-class + sync-check `compareNativeWorkflows()` guard drift + the §2.7
//   project-local collision. Acceptance gate: `bun Tools/workflow-acceptance.ts <this file>`.
//   Promoted 2026-05-29 from spikes/feature-discovery/feature-discovery.js (RFC-0120 C2:
//   distributable population reached 3 — dos-upgrade-scan + prd-isc-fanout + feature-discovery).
//
// run:  Workflow({ name: "feature-discovery", args: { input: "<vague business feature request>" } })
// conventions honored: RFC-0117 §J.4 args-JSON-parse; §J.3 cost ceiling; result-disposition /
//   no-silent-stalls; return-content-then-primary-writes; declared permissions (RFC-0121 §2.4
//   leg-c — AUDIT surface, not runtime enforcement). Dimensions grounded in altyaa-turbo/MEMORY.
// Date.now()/Math.random() are unavailable in workflow scripts.
// ─────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'feature-discovery',
  description: 'Pre-PRD discovery: scout the input, fan out research/spec across discovery dimensions, run a completeness-critic loop until dry, converge into a discovery brief + ISC seeds for prd-isc-fanout. agent→code→report; overflow-heavy dimension research never re-enters the orchestrator context.',
  phases: [
    { title: 'scout', detail: 'classify the input → the in-scope discovery-dimension work-list' },
    { title: 'fan-out', detail: 'one agent per dimension (composes DOS research/spec capability)' },
    { title: 'completeness-loop', detail: 'critic finds missed dimensions; re-fan until 2 dry passes (the nothing-missed guarantee)' },
    { title: 'converge', detail: 'single brief-editor → coherent discovery brief + ISC seeds' },
  ],
}

// RFC-0121 §2.4 leg-c — DECLARED PERMISSIONS (AUDIT surface, not runtime enforcement; Cato D6). The
// scout/dimension/critic/brief agents probe the in-tree codebase (the integration-matrix dimension
// reads existing systems + the domain map), so agent_tools includes Read; they write nothing
// (return-content-then-primary-writes) and never reach the network. max_units mirrors the fan-out
// WIDTH cap below (RFC-0117 §J.3). NOTE: plain `const` (NOT `export const`) — the Workflow runtime
// allows exactly ONE top-level export (`export const meta`); a 2nd `export` throws at load
// (RFC-0121 D12); the acceptance harness leg-a asserts the single-export invariant.
const permissions = {
  agent_tools: ['Read'],
  writes: [],
  network: false,
  max_units: 20,
}

const FIXTURE_VERSION = 'feature-discovery-v1'
const ARGS = (() => { if (typeof args === 'string') { try { return JSON.parse(args) } catch { if (typeof log === 'function') log('⚠ ARGS DEGRADED: args arrived as a non-JSON string — running skeleton defaults. Pass structured JSON args (RFC-0117 §J.4).'); return { __argsDegraded: true } } } return (args || {}) })()
const INPUT = ARGS.input || ''
const MAX_UNITS = ARGS.maxUnits || 20   // §J.3 fan-out WIDTH cap (agent COUNT, NOT tokens — a HUGE feature still burned ~1.16M tokens; a token/credit budget guard + tier-gate is RFC-0124 §5 follow-on) [review #5]
const MAX_ROUNDS = ARGS.maxRounds || 3  // §J.3 loop bound — completeness-loop MUST terminate

// Canonical discovery dimensions (grounded in altyaa-turbo/MEMORY social-stack corpus, RFC-0124 §1).
// The scout picks the in-scope subset + may add feature-specific ones.
const CANONICAL_DIMENSIONS = [
  'api-surface-research (external system auth/scopes/endpoints/rate-limits/deprecations)',
  'alternatives (build-vs-buy, competing approaches, tradeoffs)',
  'integration-matrix (how it wires to existing in-tree systems + the codebase domain map)',
  'architecture (components, boundaries, data flow)',
  'ux-user-journeys (personas, flows, states, error paths)',
  'data-schema (tables, fields, migrations)',
  'security-threat-model (attack surface, secrets, abuse)',
  'compliance (data transfers, retention, disclosure, LGPD/policy)',
  'scope-deferral (what is in vs explicitly out for v1)',
  'dependencies-dag (build-order, what blocks what — feeds implementation)',
  'rollout-ops (deploy, feature-flags, milestones)',
]

if (!INPUT) log('WARN: no args.input provided — scout will have nothing to classify')

const SCOUT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['feature_summary', 'external_systems', 'dimensions'],
  properties: {
    feature_summary: { type: 'string' },
    external_systems: { type: 'array', items: { type: 'string' } },
    dimensions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'label', 'rationale'],
        properties: { id: { type: 'string' }, label: { type: 'string' }, rationale: { type: 'string' } },
      },
    },
  },
}

const FINDING_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['dimension_id', 'findings', 'specs', 'risks', 'skipped'],
  properties: {
    dimension_id: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    specs: { type: 'array', items: { type: 'string' }, description: 'concrete spec lines (e.g. endpoints, schema fields, journey steps)' },
    risks: { type: 'array', items: { type: 'string' } },
    skipped: { type: 'boolean' },
    skip_reason: { type: 'string' },
  },
}

const CRITIC_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['missing', 'assessment'],
  properties: {
    missing: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'label', 'rationale'],
        properties: { id: { type: 'string' }, label: { type: 'string' }, rationale: { type: 'string' } },
      },
    },
    assessment: { type: 'string', description: 'why coverage is or is not complete' },
  },
}

const BRIEF_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['brief_markdown', 'user_journeys', 'isc_seeds', 'open_decisions'],
  properties: {
    brief_markdown: { type: 'string' },
    user_journeys: { type: 'array', items: { type: 'string' } },
    isc_seeds: { type: 'array', items: { type: 'string' }, description: 'seed ISCs handed to prd-isc-fanout (RFC-0123) — the altyaa "ISC Seeds (55)" pattern' },
    open_decisions: { type: 'array', items: { type: 'string' } },
  },
}

const dimPrompt = (id, label, rationale) => `You are the "${label}" discovery unit for a pre-PRD feature exploration.

FEATURE INPUT: "${INPUT}"
YOUR DIMENSION: ${label} — ${rationale}

Research/specify ONLY this dimension. Return concrete findings, concrete spec lines (endpoints,
schema fields, journey steps, config keys — whatever this dimension produces), and risks. Be
specific and bounded; do not dump raw research. If this dimension is genuinely not applicable to
this feature, set skipped=true with a skip_reason. dimension_id MUST equal "${id}".`

// ===== Phase 1: scout =====
phase('scout')
log(`feature-discovery ${FIXTURE_VERSION} — scouting input (cap ${MAX_UNITS} units, ${MAX_ROUNDS} rounds)`)
const scout = await agent(
  `You are the SCOUT for a pre-PRD feature-discovery workflow. Classify this feature input and decide
which discovery dimensions are IN SCOPE.

FEATURE INPUT: "${INPUT}"

Canonical dimensions to choose from (pick the applicable subset; you MAY add feature-specific ones):
${CANONICAL_DIMENSIONS.map(d => '- ' + d).join('\n')}

Return a feature_summary, the external_systems involved, and the in-scope dimensions (each with a
short kebab-case id, a label, and a rationale).`,
  { label: 'scout', phase: 'scout', model: 'sonnet', schema: SCOUT_SCHEMA }
)

// ===== Phases 2+3: fan-out + completeness-loop (bounded loop-until-dry) =====
const allFindings = []
const covered = new Set()      // dimensions successfully covered OR decided N/A
const failedIds = new Set()    // agent-failed dims — NOT covered; retried + surfaced [review #2]
let queue = (scout && scout.dimensions || []).slice(0, MAX_UNITS)  // scout null-guard [review #6]
let dryPasses = 0
let round = 0
let lastFresh = []             // critic gaps identified in the final round (for cap-honesty) [review #3]
const skips = []               // genuine N/A
const failures = []            // hard agent failures, distinct from N/A [review #7]

while (dryPasses < 2 && round < MAX_ROUNDS) {
  round++
  const toFan = queue.filter(d => d && d.id && !covered.has(d.id)).slice(0, Math.max(0, MAX_UNITS - covered.size))
  if (toFan.length === 0) { dryPasses++; continue }

  phase('fan-out')
  log(`round ${round}: fanning ${toFan.length} dimension(s) [${toFan.map(d => d.id).join(', ')}]`)
  const found = await parallel(toFan.map(d => () =>
    agent(dimPrompt(d.id, d.label, d.rationale), { label: `dim:${d.id}`.slice(0, 48), phase: 'fan-out', model: 'sonnet', schema: FINDING_SCHEMA })
  ))
  const retry = []
  toFan.forEach((d, i) => {
    const f = found[i] // parallel preserves order
    if (f && f.skipped) { covered.add(d.id); failedIds.delete(d.id); skips.push(`${d.id}: ${f.skip_reason || 'not applicable'}`) }
    else if (f) { covered.add(d.id); failedIds.delete(d.id); allFindings.push(f) }
    else { failedIds.add(d.id); retry.push(d) } // failed → NOT covered; retry next round, never laundered [review #2]
  })

  // completeness-critic — receives a COMPACT, COMPLETE per-dimension digest (NOT a truncated raw slice) [review #1].
  // The prior `JSON.stringify(allFindings).slice(0,12000)` showed the critic only ~43% of findings, so it
  // re-flagged unseen-but-covered dimensions as "missing" → phantom gaps → never went dry → hit MAX_ROUNDS.
  phase('completeness-loop')
  const digest = allFindings.map(f => ({ id: f.dimension_id, n_findings: (f.findings || []).length, n_specs: (f.specs || []).length, gist: (f.findings && f.findings[0] || '').slice(0, 140) }))
  const critic = await agent(
    `You are the COMPLETENESS CRITIC for a pre-PRD discovery. The feature is: "${INPUT}".
Dimensions already covered (do NOT re-request these OR semantic duplicates of them): ${[...covered].join(', ')}.
Coverage digest (one line per covered dimension): ${JSON.stringify(digest)}

Ask: what discovery dimension, external system, user journey, edge case, or risk is STILL MISSING
that a thorough team would cover before writing the PRD? Return only GENUINELY missing items in the
missing array (each a NEW dimension with a kebab-case id distinct IN MEANING from every covered id).
If coverage is complete, return an empty missing array. Do not invent work to look thorough.`,
    { label: `critic:r${round}`, phase: 'completeness-loop', model: 'sonnet', schema: CRITIC_SCHEMA }
  )
  const fresh = (critic.missing || []).filter(d => d && d.id && !covered.has(d.id) && !failedIds.has(d.id))
  lastFresh = fresh
  queue = [...fresh, ...retry] // pursue fresh gaps + retry failed dims [review #2]
  if (fresh.length === 0 && retry.length === 0) dryPasses++; else dryPasses = 0
  log(`round ${round}: critic ${fresh.length} new gap(s), ${retry.length} retry; dryPasses=${dryPasses}`)
}
const loopTerminatedBy = dryPasses >= 2 ? 'dry (2 consecutive clean passes)' : `MAX_ROUNDS=${MAX_ROUNDS} cap`
// cap-honesty: gaps the critic identified but the loop never fanned — the brief is bounded, NOT exhaustive [review #3]
const uncoveredGaps = loopTerminatedBy.startsWith('MAX_ROUNDS') ? lastFresh.map(d => d.id || d.label) : []
if (uncoveredGaps.length) log(`WARN: hit MAX_ROUNDS with ${uncoveredGaps.length} un-fanned gap(s) — brief is BOUNDED, not exhaustively complete: ${uncoveredGaps.join(', ')}`)
if (failedIds.size) failures.push(`${failedIds.size} dimension(s) failed all retries: ${[...failedIds].join(', ')}`)

// ===== Phase 4: converge — single brief-editor voice =====
phase('converge')
let brief
if (allFindings.length === 0) {
  brief = { brief_markdown: '_no findings produced_', user_journeys: [], isc_seeds: [], open_decisions: [] }
} else {
  // Pass the FULL findings — never silently truncate. The prior .slice(0,24000) cut trailing
  // dimensions mid-JSON, breaking the "lose nothing" promise [review #1]. If very large, warn;
  // the true fix is a sharded multi-pass converge (RFC-0124 §5 follow-on), not a silent cut.
  const findingsJson = JSON.stringify(allFindings)
  if (findingsJson.length > 60000) log(`WARN: ${findingsJson.length} chars of findings into one converge agent — near context limit; shard the converge for larger runs (RFC-0124 §5 follow-on) [review #1]`)
  brief = await agent(
    `You are the SINGLE brief-editor for a pre-PRD discovery. Synthesize the per-dimension findings below
into ONE coherent discovery brief for the feature: "${INPUT}". Harmonize vocabulary, resolve cross-
dimension conflicts, and produce: (a) brief_markdown (the discovery brief), (b) user_journeys, (c)
isc_seeds — atomic ISC seed criteria to hand to the prd-isc-fanout workflow (the altyaa "ISC Seeds"
pattern), (d) open_decisions the operator must make. Preserve coverage; lose nothing.

PER-DIMENSION FINDINGS (JSON): ${findingsJson}`,
    { label: 'converge:brief-editor', phase: 'converge', model: 'opus', schema: BRIEF_SCHEMA }
  )
}
if (!brief || typeof brief.brief_markdown !== 'string') {
  brief = { brief_markdown: 'converge agent produced no usable result — FAILED [no-silent-stalls]', user_journeys: [], isc_seeds: [], open_decisions: [] }
}

log(`converged: ${allFindings.length} dimensions → ${(brief.isc_seeds || []).length} ISC seeds, ${(brief.user_journeys || []).length} journeys; loop ended by ${loopTerminatedBy}`)

return {
  fixture_version: FIXTURE_VERSION,
  input: INPUT,
  external_systems: (scout && scout.external_systems) || [], // scout null-guard [review #6]
  counts: {
    dimensions_covered: allFindings.length,
    rounds: round,
    isc_seeds: (brief.isc_seeds || []).length,
    user_journeys: (brief.user_journeys || []).length,
    skipped: skips.length,        // genuine N/A [review #7]
    failed: failedIds.size,       // hard agent failures — distinct from N/A [review #7]
    uncovered_gaps: uncoveredGaps.length,
  },
  loop_terminated_by: loopTerminatedBy,
  uncovered_gaps: uncoveredGaps,  // identified by critic but not fanned (cap-bounded) [review #3]
  failures,                        // dimensions that failed all retries [review #2]
  dimensions_covered: allFindings.map(f => f.dimension_id),
  skips,
  brief_markdown: brief.brief_markdown,
  user_journeys: brief.user_journeys || [],
  isc_seeds: brief.isc_seeds || [],          // → handed to prd-isc-fanout (RFC-0123)
  open_decisions: brief.open_decisions || [],
  result_disposition: 'returned-to-primary; isc_seeds feed prd-isc-fanout (RFC-0123)',
}
