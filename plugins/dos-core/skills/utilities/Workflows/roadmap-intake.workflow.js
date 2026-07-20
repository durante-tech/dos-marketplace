// ─────────────────────────────────────────────────────────────────────────
// roadmap-intake — native dynamic workflow  (/team-lead INTAKE; RFC-0121 distributable)
// fixture-version: roadmap-intake-v1
// owner: Utilities (Packs/Utilities)
// purpose: turn a FREEFORM roadmap + the live repo into a classified, reality-reconciled
//          slice list for /team-lead. A scout agent reads the roadmap markdown and emits
//          structured rows under a STRICT schema (the schema is the determinism, NOT a
//          parser); a reconcile agent per row returns RAW evidence (commit SHAs, grep hits,
//          a scoped test exit) — never a verdict; the SCRIPT's deterministic rules bucket
//          each row done-in-fact|in-progress|blocked|not-started|deferred and SURFACE any
//          roadmap-vs-code disagreement. agent→code→report (the script has no fs/git access).
//
// make-or-break: classification is corroborated-or-contradicted by a CODE signal, not the
//          roadmap's own prose — a roadmap that lies ("done") must not pass intake as done.
//          The reconcile agent returns evidence; the SCRIPT decides; disagreements are
//          surfaced, never silently resolved.
//
// DISTRIBUTION (RFC-0121): SoT pack-owned `.workflow.js`. Installs IMMUTABLY to
//   ~/.claude/workflows/roadmap-intake.js. Manifest native_workflows pair + sync-check
//   compareNativeWorkflows() guard drift + §2.7 collision. Acceptance: workflow-acceptance.ts.
//
// run:  Workflow({ name: "roadmap-intake", args: { roadmapPath: "Plans/roadmap.md", recentDays: 21 } })
// conventions: RFC-0117 §J.4 args-JSON-parse; §J.3 cost ceiling + loop bound; result-disposition /
//   no-silent-stalls; return-content-then-primary-writes; declared permissions (leg-c, audit surface).
// Date.now()/Math.random() are unavailable in workflow scripts.
// ─────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'roadmap-intake',
  description: 'INTAKE for /team-lead: a scout agent reads a freeform roadmap and emits structured rows under a strict schema; a reconcile agent per row returns RAW evidence (commit SHAs / grep hits / scoped-test exit) against the live repo; the script deterministically classifies each row done-in-fact|in-progress|blocked|not-started|deferred and surfaces roadmap-vs-code disagreements. Each slice carries its (repo, path-prefix) target. agent→code→report; the script has no fs access, so all reading is via agents.',
  phases: [
    { title: 'intake', detail: 'scout agent reads the freeform roadmap → structured rows {id,title,claimed_status,target,evidence_hint} under a strict schema' },
    { title: 'reconcile', detail: 'one reconcile agent per row (batched ≤ MAX_UNITS) returns RAW evidence vs the live repo — never a verdict' },
    { title: 'classify', detail: 'deterministic script rules bucket each row from evidence + surface roadmap-vs-code disagreements' },
  ],
}

// RFC-0121 §2.4 leg-c — DECLARED PERMISSIONS (AUDIT surface; Cato D6). The scout reads the roadmap
// (Read); the reconcile agents run read-only git + grep + at most a single SCOPED test (Read/Grep/Bash);
// they write NOTHING (return-content-then-primary-writes) and never reach the network. Plain `const`
// (NOT `export const`) — single-export invariant (acceptance leg-a).
const permissions = {
  agent_tools: ['Read', 'Grep', 'Bash'],
  writes: [],
  network: false,
  max_units: 20,
}

const FIXTURE_VERSION = 'roadmap-intake-v1'
const ARGS = (() => { if (typeof args === 'string') { try { return JSON.parse(args) } catch { if (typeof log === 'function') log('⚠ ARGS DEGRADED: args arrived as a non-JSON string — running skeleton defaults. Pass structured JSON args (RFC-0117 §J.4).'); return { __argsDegraded: true } } } return (args || {}) })()
const ROADMAP_PATH = ARGS.roadmapPath || ''
const RECENT_DAYS = ARGS.recentDays || 21
const MAX_UNITS = ARGS.maxUnits || 20   // §J.3 fan-out WIDTH cap (reconcile agent COUNT per wave)

if (!ROADMAP_PATH) log('WARN: no args.roadmapPath provided — scout will have nothing to read')

// scout emits rows under a STRICT schema — the determinism is the schema, not a markdown parser.
const ROWS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['roadmap_summary', 'rows'],
  properties: {
    roadmap_summary: { type: 'string' },
    rows: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'title', 'claimed_status', 'target_repo', 'target_path_prefix', 'evidence_hint'],
        properties: {
          id: { type: 'string', description: 'kebab-case stable id for the roadmap row' },
          title: { type: 'string' },
          claimed_status: { type: 'string', description: 'what the roadmap CLAIMS: done | in-progress | blocked | not-started | deferred | unknown' },
          target_repo: { type: 'string', description: 'repo this slice targets (cwd-relative or named); "" if unstated' },
          target_path_prefix: { type: 'string', description: 'the (repo,path-prefix) target — the surface the slice touches; "" if unstated' },
          evidence_hint: { type: 'string', description: 'a symbol / path / feature name to grep for to corroborate status' },
        },
      },
    },
  },
}

// reconcile agent returns RAW evidence ONLY — never a verdict. The script judges.
const EVIDENCE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['row_id', 'recent_shas', 'grep_present', 'test_exit', 'blocker_signal'],
  properties: {
    row_id: { type: 'string' },
    recent_shas: { type: 'array', items: { type: 'string' }, description: `commit SHAs within ${RECENT_DAYS}d touching the target/evidence_hint` },
    grep_present: { type: 'boolean', description: 'does the evidence_hint symbol/path exist in the code now?' },
    test_exit: { type: 'number', description: 'exit code of a SINGLE scoped test if run when ambiguous; -1 if not run' },
    blocker_signal: { type: 'boolean', description: 'is there an explicit blocker (missing dep, failing gate, TODO-blocked)?' },
    notes: { type: 'string' },
  },
}

// ── DETERMINISTIC CLASSIFICATION (pure JS over raw evidence — the make-or-break; no agents) ────────
// Cannot be unit-imported from a .js workflow (non-export); test surface = acceptance golden-fixture.
const CLAIMED_DONE = new Set(['done', 'complete', 'shipped'])

const classifyRow = (row, ev) => {
  if (!ev) return { classification: 'not-started', disagreement: false, why: 'no evidence returned (reconcile failed) — conservative default' }
  if (ev.blocker_signal) return { classification: 'blocked', disagreement: false, why: 'explicit blocker signal' }
  // test_exit===0 means the agent ran the SCOPED test (only done when git+grep were ambiguous) and it
  // PASSED — that is a positive code-present signal, so a renamed/refactored symbol (grep_present=false)
  // whose test still passes is NOT mislabeled not-started. test_exit===-1 = not run (no signal).
  const testPassed = ev.test_exit === 0
  const codePresent = !!ev.grep_present || testPassed
  const shipped = (ev.recent_shas || []).length > 0 && codePresent
  const present = codePresent
  const claimedDone = CLAIMED_DONE.has((row.claimed_status || '').toLowerCase())

  let classification
  if (shipped) classification = 'done-in-fact'
  else if (present) classification = 'in-progress'
  else classification = 'not-started'

  // disagreement = the roadmap CLAIMS done but the code does NOT corroborate it (the headline failure mode)
  const disagreement = claimedDone && classification !== 'done-in-fact'
  const why = disagreement
    ? `roadmap claims "${row.claimed_status}" but code signal says "${classification}" — SURFACED, not silently resolved`
    : `classified ${classification} from code signal (claimed: ${row.claimed_status})`
  return { classification, disagreement, why }
}

// ===== Phase 1: intake (scout reads the freeform roadmap) =====
phase('intake')
log(`roadmap-intake ${FIXTURE_VERSION} — roadmap=${ROADMAP_PATH || '(none)'}, recentDays=${RECENT_DAYS}`)
const scout = await agent(
  `You are the SCOUT for /team-lead intake. Read the roadmap markdown at "${ROADMAP_PATH}" (use Read).
It is FREEFORM (phase ladders, tables, prose) — do NOT assume a rigid format. Extract every actionable
ROW (a deliverable / slice / phase item). For each row return: a stable kebab-case id, the title, the
status the roadmap CLAIMS (done|in-progress|blocked|not-started|deferred|unknown), the (target_repo,
target_path_prefix) the slice touches if stated (else ""), and an evidence_hint (a symbol/path/feature
name that, if present in code, corroborates "done"). Return roadmap_summary + rows[] strictly per schema.
Extract facts; do NOT judge whether the claim is true — that is the reconcile step.`,
  { label: 'intake:scout', phase: 'intake', model: 'sonnet', schema: ROWS_SCHEMA }
)

const rows = (scout && scout.rows) || []
log(`intake: ${rows.length} row(s) extracted`)

// ===== Phase 2: reconcile (one agent per row, batched ≤ MAX_UNITS) =====
phase('reconcile')
let evidence = []
for (let i = 0; i < rows.length; i += MAX_UNITS) {
  const batch = rows.slice(i, i + MAX_UNITS)
  if (batch.length === 0) break
  log(`reconcile: batch ${Math.floor(i / MAX_UNITS) + 1} (${batch.length} of ${rows.length})`)
  const res = await parallel(batch.map(r => () =>
    agent(
      `You are a RECONCILE unit for ONE roadmap row. Gather RAW evidence ONLY (no verdict — the
orchestrator judges). Use read-only git + grep + at most ONE SCOPED test, and NEVER a mutating
command, NEVER the full suite.
ROW: ${r.id} — "${r.title}" (roadmap claims: ${r.claimed_status})
TARGET: ${r.target_repo || '(cwd)'} / ${r.target_path_prefix || '(unstated)'}
EVIDENCE HINT: ${r.evidence_hint || '(none)'}

Return: recent_shas (commits within ${RECENT_DAYS}d touching the target/hint), grep_present (does the
hint symbol/path exist in code now?), test_exit (run a SINGLE scoped test ONLY if git+grep are
ambiguous, else -1), blocker_signal (explicit blocker?). row_id MUST equal "${r.id}".`,
      { label: `reconcile:${r.id}`.slice(0, 48), phase: 'reconcile', model: 'sonnet', schema: EVIDENCE_SCHEMA }
    )
  ))
  evidence = evidence.concat(res)
}

// ===== Phase 3: classify (DETERMINISTIC — no agents) =====
phase('classify')
const evById = new Map(evidence.filter(Boolean).map(e => [e.row_id, e]))
const slices = rows.map(r => {
  const ev = evById.get(r.id)
  const c = classifyRow(r, ev)
  return {
    id: r.id,
    title: r.title,
    target: { repo: r.target_repo || '', path_prefix: r.target_path_prefix || '' },
    claimed_status: r.claimed_status,
    classification: c.classification,
    disagreement: c.disagreement,
    why: c.why,
    evidence: ev ? { recent_shas: ev.recent_shas || [], grep_present: !!ev.grep_present, test_exit: ev.test_exit, blocker: !!ev.blocker_signal } : null,
  }
})

const byClass = slices.reduce((m, s) => { m[s.classification] = (m[s.classification] || 0) + 1; return m }, {})
const disagreements = slices.filter(s => s.disagreement)
const failedReconcile = rows.filter(r => !evById.has(r.id)).length  // accurate even if agents return duplicate/wrong row_id (size-diff undercounts)
if (failedReconcile > 0) log(`WARN: ${failedReconcile} row(s) had no reconcile evidence — defaulted conservatively [no-silent-stalls]`)
log(`classify: ${JSON.stringify(byClass)}; ${disagreements.length} roadmap-vs-code disagreement(s)`)

// next-deliverable selection: not-started + in-progress are the candidates; done-in-fact is skipped (idempotent re-run)
const next_candidates = slices.filter(s => s.classification === 'in-progress' || s.classification === 'not-started')

return {
  fixture_version: FIXTURE_VERSION,
  roadmap_path: ROADMAP_PATH,
  roadmap_summary: (scout && scout.roadmap_summary) || '',
  counts: {
    rows: rows.length,
    by_classification: byClass,
    disagreements: disagreements.length,
    failed_reconcile: failedReconcile,
    next_candidates: next_candidates.length,
  },
  slices,                       // every row, classified + reconciled, carrying its (repo,path-prefix) target
  disagreements,                // roadmap claims done but code disagrees — surfaced for the operator
  next_candidates,              // what /team-lead would deliver next (already-done slices skipped → idempotent)
  result_disposition: 'returned-to-primary; /team-lead conductor verifies stack per target then routes next_candidates to the delivery backbone',
}
