// ─────────────────────────────────────────────────────────────────────────
// dos-upgrade-scan — native dynamic workflow  (RFC-0121 first distributable instance)
// fixture-version: golden-fixture-v1   (lineage: RFC-0120 §2.1 golden fixture)
// owner: DOSUpgrade (Packs/Utilities)
// purpose: gather (fan-out) → merge-score-tier (deterministic JS, ZERO agents) → emit.
//          The "deterministic shell around a non-deterministic core" — the scoring formula that
//          lived as fragile prose in DOSUpgrade/Workflows/Upgrade.md is reproducible CODE here.
//
// DISTRIBUTION (RFC-0121): this is the SoT, pack-owned, `.workflow.js`-suffixed (the sole
//   disambiguator from the legacy *.md procedures in this SAME dir — APFS case-safe). It installs
//   IMMUTABLY to ~/.claude/workflows/dos-upgrade-scan.js (install.sh; pack-source wins on upgrade;
//   operator escape hatch = ~/.claude/workflows/local-override/dos-upgrade-scan.js). The manifest
//   `native_workflows` pair-class + sync-check `compareNativeWorkflows()` guard drift + the §2.7
//   project-local collision. Acceptance gate: `bun Tools/workflow-acceptance.ts <this file>`.
//   Promoted 2026-05-29 from the gitignored project-local .claude/workflows/dos-upgrade-scan.js
//   (the project-local copy was REMOVED to clear the §2.7 collision / silent shadow).
//
// run:  Workflow({ name: "dos-upgrade-scan", args: { date: "YYYY-MM-DD" } })   // resolves from ~/.claude/workflows/
// ratification conditions honored: result-disposition surfaced (Pragmatic, no-silent-stalls);
//   version-pinned header (Feathers); MAX_UNITS cost ceiling (Cato C1 / RFC-0117 §J.3);
//   args-JSON-parse defensive contract (RFC-0117 §J.4 — probe wf_c453af90-343);
//   declared permissions (RFC-0121 §2.4 leg-c — AUDIT surface, not runtime enforcement).
// Date.now()/Math.random() are unavailable in workflow scripts — date arrives via args.
// ─────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'dos-upgrade-scan',
  description: 'Fan out independent gather-agents over disjoint context+source inputs, then deterministically merge/relevance-score/tier into a prioritized DOS upgrade report — agent→code→report, payloads never re-enter the orchestrator context window.',
  phases: [
    { title: 'gather', detail: 'parallel agents over disjoint sources (config-driven width)' },
    { title: 'merge-score-tier', detail: 'pure deterministic JS, zero agents — the scoring formula lives here as code, not prose' },
    { title: 'emit', detail: 'render report markdown; primary writes the file (return-content-then-primary-writes, RFC-0117 §2.3)' },
  ],
}

// RFC-0121 §2.4 leg-c — DECLARED PERMISSIONS. This is an AUDIT surface (declared, legible,
// reviewable), NOT a runtime enforcement: the Workflow tool does not yet constrain spawned agents
// to these tools, so a PR that widens this block is the review signal, not a runtime gate (Cato
// D6). The gather agents only READ repo files (telos-context reads CLAUDE.md); they use their own
// knowledge otherwise, write nothing (return-content-then-primary-writes), and never reach the
// network. max_units mirrors the MAX_UNITS cost ceiling below (RFC-0117 §J.3).
// NOTE: a plain `const` (NOT `export const`) — the Workflow runtime allows exactly ONE top-level
// export (`export const meta`); a second `export` throws SyntaxError "Unexpected keyword 'export'"
// (surfaced live on the walking-skeleton run, RFC-0056 first-live-run class). The acceptance
// harness leg-a now asserts the single-export invariant so this can never ship again.
const permissions = {
  agent_tools: ['Read'],
  writes: [],
  network: false,
  max_units: 20,
}

const FIXTURE_VERSION = 'golden-fixture-v1'

// review #1 ROOT CAUSE (probe wf_c453af90-343): the Workflow tool delivers `args` as a JSON
// STRING, not a parsed object. Every DOS native workflow MUST defensively JSON.parse it.
const ARGS = (() => { if (typeof args === 'string') { try { return JSON.parse(args) } catch { if (typeof log === 'function') log('⚠ ARGS DEGRADED: args arrived as a non-JSON string — running skeleton defaults. Pass structured JSON args (RFC-0117 §J.4).'); return { __argsDegraded: true } } } return (args || {}) })()
const RUN_DATE = ARGS.date || 'unknown-date'

// Cost ceiling (RFC-0117 §2.5 / §J.3, Cato C1): hard cap on fan-out width.
const MAX_UNITS = ARGS.maxUnits || 20

// Config-driven fan-out. SKELETON default = 2 bounded units (cheap walking-skeleton run).
// Production widens this to the ~9 DOSUpgrade sources (4 context + 4 source + 1 reflection)
// by passing args.sources — the merge/score/tier code below does NOT change when N grows.
const DEFAULT_SOURCES = [
  {
    id: 'telos-context',
    family: 'context',
    prompt: `You are the CONTEXT gather-unit of a DOS upgrade scan. Read ~/Durante/CLAUDE.md (top sections only) and return 2-3 of DOS's current focus areas/goals as "discoveries" — but for a CONTEXT unit, set technique_name to the focus area, relevance=how central it is to DOS now (1-10), impact and effort = 5 (context units are neutral on those). Keep it bounded; do not read the whole repo.`,
  },
  {
    id: 'anthropic-source',
    family: 'source',
    prompt: `You are a SOURCE gather-unit of a DOS upgrade scan. From your own knowledge of recent Claude Code / Anthropic capabilities relevant to AI-agent ORCHESTRATION (native workflows, forked subagents, background agents, effort levels), return 2-3 discoveries. For EACH: technique_name, a one-line exact_content description, pai_gap (what DOS lacks), relevance(1-10 vs an orchestration-focused OS), impact(1-10), effort(1-10 EASE of adoption — 10 = easy to adopt, 1 = hard; higher effort score raises priority). Be concrete; no web access needed.`,
  },
]

const SOURCES = (ARGS.sources || DEFAULT_SOURCES).slice(0, MAX_UNITS)

const GATHER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['source_id', 'family', 'discoveries', 'skipped'],
  properties: {
    source_id: { type: 'string' },
    family: { type: 'string', enum: ['context', 'source', 'reflection'] },
    discoveries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['technique_name', 'exact_content', 'relevance', 'impact', 'effort'],
        properties: {
          technique_name: { type: 'string' },
          exact_content: { type: 'string' },
          pai_gap: { type: 'string' },
          relevance: { type: 'number' },
          impact: { type: 'number' },
          effort: { type: 'number' },
        },
      },
    },
    skipped: { type: 'array', items: { type: 'string' }, description: 'result-disposition: anything deliberately not returned, with reason' },
  },
}

// ===== Phase 1: gather — parallel barrier (need all payloads before cross-source scoring) =====
phase('gather')
log(`dos-upgrade-scan ${FIXTURE_VERSION} — gather over ${SOURCES.length} unit(s) (cap ${MAX_UNITS})`)
if (!ARGS.date) log('WARN: args.date absent after parse (using fallback) — caller did not pass {date} [review #1]')
// Cost routing (H6, dos-upgrade-scan-2026-07-19). Pure-EXTRACTION gather families read input and
// emit structured facts with no multi-step judgment, so they run on Haiku (near-frontier quality at
// Haiku-tier price/latency — Haiku 4.5 is $1/$5 MTok vs Sonnet 5's $3/$15). Judgment families keep
// Sonnet: `source` (own-knowledge synthesis + pai_gap + relevance-to-OS scoring) and `reflection`
// (cross-corpus theme clustering + sentiment). A source may override per-unit with its own `model`.
const EXTRACTION_FAMILIES = new Set(['context'])
const modelFor = s => s.model || (EXTRACTION_FAMILIES.has(s.family) ? 'haiku' : 'sonnet')
const payloads = await parallel(
  SOURCES.map(s => () => agent(s.prompt, { label: `gather:${s.id}`, phase: 'gather', model: modelFor(s), schema: GATHER_SCHEMA }))
)

// ===== Phase 2: merge-score-tier — PURE DETERMINISTIC JS, ZERO agents =====
// This is the load-bearing "deterministic shell" the fixture exists to prove: the scoring
// that lived as fragile prose in DOSUpgrade/Workflows/Upgrade.md is reproducible code here.
phase('merge-score-tier')
const live = payloads.filter(Boolean)
const failedUnits = payloads.length - live.length // review #5: null thunks (agent error / schema drop) must be dispositioned, not silently lost
const skippedAll = live.flatMap(p => (p.skipped || []).map(r => `${p.source_id}: ${r}`))
if (failedUnits > 0) skippedAll.push(`${failedUnits} gather unit(s) FAILED (agent error or schema-validation drop) — no payload returned [no-silent-stalls, review #5]`)
const discoveries = live.flatMap(p =>
  (p.discoveries || []).map(d => ({ ...d, source_id: p.source_id, family: p.family }))
)

// priority = (relevance * 2) + impact + effort   ·   drop relevance < 3   ·   4-tier banding
const scored = discoveries
  .map(d => ({ ...d, priority: d.relevance * 2 + d.impact + d.effort }))
  .filter(d => d.relevance >= 3)
  .sort((a, b) => b.priority - a.priority)

const tiers = { critical: [], high: [], medium: [], low: [] }
for (const d of scored) {
  // review #4: relevance gates use >= (inclusive) so boundary values (8/6/4) land in the
  // intuitive tier rather than being silently demoted by strict >.
  if (d.priority > 30 && d.relevance >= 8) tiers.critical.push(d)
  else if (d.priority >= 22 && d.relevance >= 6) tiers.high.push(d)
  else if (d.priority >= 14 && d.relevance >= 4) tiers.medium.push(d)
  else tiers.low.push(d)
}
log(`scored ${scored.length} discoveries (dropped ${discoveries.length - scored.length} below relevance<3); tiers C${tiers.critical.length}/H${tiers.high.length}/M${tiers.medium.length}/L${tiers.low.length}`)

// ===== Phase 3: emit — return report STRING; primary writes the file (RFC-0117 §2.3) =====
phase('emit')
const line = d => `- **${d.technique_name}** (${d.source_id}) — priority ${d.priority} (rel ${d.relevance}/imp ${d.impact}/eff ${d.effort}) — ${d.exact_content}`
const section = (name, arr) => `### ${name} (${arr.length})\n${arr.length ? arr.map(line).join('\n') : '_none_'}`
const report_markdown = [
  `# DOS Upgrade Scan — ${RUN_DATE}`,
  ``,
  `**fixture:** ${FIXTURE_VERSION} · **units:** ${SOURCES.length} · **scored:** ${scored.length}`,
  ``,
  section('CRITICAL', tiers.critical),
  section('HIGH', tiers.high),
  section('MEDIUM', tiers.medium),
  section('LOW', tiers.low),
  ``,
  `## Result disposition`,
  skippedAll.length ? skippedAll.map(s => `- skipped: ${s}`).join('\n') : `- no skips reported`,
].join('\n')

return {
  fixture_version: FIXTURE_VERSION,
  run_date: RUN_DATE,
  counts: { units: SOURCES.length, failed_units: failedUnits, discoveries: discoveries.length, scored: scored.length, dropped: discoveries.length - scored.length },
  tiers: { critical: tiers.critical.length, high: tiers.high.length, medium: tiers.medium.length, low: tiers.low.length },
  report_markdown,
  result_disposition: 'returned-to-primary-for-write', // primary writes report_markdown to MEMORY/ARTIFACTS/ (gitignored path; RFC-0117 §2.3)
}
