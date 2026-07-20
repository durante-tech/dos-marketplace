// ─────────────────────────────────────────────────────────────────────────
// spec-verify-in-loop — INSTALLED native dynamic workflow (RFC-0129 #15 spike promotion)
// origin spike: 2026-06-02_verifier-in-loop  ·  RFC-0069 composition  ·  receipt §E #15
//
// STATUS: PROMOTED spike → pack-distributed (RFC-0121). SoT is the pack source
//   Packs/sentinel/src/Workflows/spec-verify-in-loop.workflow.js; it INSTALLS to
//   ~/.claude/workflows/spec-verify-in-loop.js and IS registered in
//   .dos-sync-manifest.json native_workflows[] with a leg-b attestation sidecar
//   (spec-verify-in-loop.accepted.json). Structurally sound: single top-level export
//   `export const meta`; aux data is non-export const (a 2nd export throws at load).
//   Runtime note: invoke from the PRIMARY via Workflow({ name: "spec-verify-in-loop", ... });
//   it cannot be nested inside another workflow's subagent (the workflow→subagent limit).
//
// PURPOSE: the in-loop SPEC-ANCHORED VERIFIER step for delivery loops
//   (MakerkitTeam.DeliverFeature / FastAPIStarterTeam / forge). Distinct from:
//     • the /code-review gate  — reads the DIFF for correctness/reuse/efficiency
//     • RFC-0069 VerifierAgent — reads the TRANSCRIPT, verifies stated CLAIMS
//   This workflow takes {spec, artifact}, fans a SpecVerifier agent that
//   RE-DERIVES the spec's obligation set BEFORE reading the artifact's narrative
//   (anti-priming), checks each obligation, and the SCRIPT deterministically
//   rolls the obligations up into a gate verdict. agent→code→report: the heavy
//   obligation reasoning stays in the agent; only the compact obligation array
//   returns; the script applies the pure-JS roll-up; the primary writes the
//   receipt. The obligation payload never re-enters the orchestrator context.
//
// WHERE IT WOULD WIRE (NOT wired here):
//   MakerkitTeam.DeliverFeature Phase 4 → AFTER `Skill("code-review","high")`,
//   BEFORE operator gate G4. The diff-gate and the spec-gate run in series:
//   code-review catches diff-level bugs; spec-verify catches spec-drift.
//
// run (illustrative — DO NOT run from a subagent):
//   Workflow({ name: "spec-verify-in-loop",
//              args: { specPath: "MEMORY/WORK/active/<slug>/PRD.md",
//                      artifactRef: "git diff --staged", scope: "v1" } })
// conventions: RFC-0117 §J.4 args-JSON-parse; §J.3 cost ceiling; result-
//   disposition / no-silent-stalls; return-content-then-primary-writes; single
//   top-level export (DOS §2.7 / RFC-0121 D12). Date.now()/Math.random() N/A.
// ─────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'spec-verify-in-loop',
  description: 'In-loop SPEC-ANCHORED verifier for delivery loops (MakerkitTeam/FastAPIStarterTeam/forge): a SpecVerifier agent RE-DERIVES the spec obligation set BEFORE reading the artifact (anti-priming), checks each obligation, and the script deterministically rolls obligations up into a gate verdict (pass|drift|fail|inconclusive). Complementary to the /code-review diff-gate (reads the diff) and RFC-0069 VerifierAgent (reads the transcript/claims) — this re-derives correctness from the SPEC, catching spec-drift the diff-reader structurally misses. agent→code→report; the obligation payload never re-enters the orchestrator context.',
  phases: [
    { title: 'derive', detail: 'SpecVerifier agent reads the SPEC ONLY and writes the obligation set (MUST / MUST-NOT / BOUND) before seeing the artifact narrative' },
    { title: 'check', detail: 'same agent reads the artifact and checks each obligation → satisfied | violated | unmet | unverifiable, with RAW evidence' },
    { title: 'verdict', detail: 'deterministic script roll-up over the returned obligation array → pass | drift | fail | inconclusive (no agents)' },
  ],
}

// RFC-0121 §2.4 leg-c DECLARED PERMISSIONS (audit surface). The SpecVerifier reads
// the spec + artifact, greps, runs read-only git / a scoped test exit; writes NOTHING
// (the primary writes the receipt). NOTE: plain `const`, NOT `export const` — the
// Workflow runtime allows exactly ONE top-level export (`export const meta`); a 2nd
// export throws at load (DOS native-workflow single-export rule / RFC-0121 D12).
const permissions = {
  agent_tools: ['Read', 'Grep', 'Bash'],
  writes: [],
  network: false,
  max_units: 4,
}

const FIXTURE_VERSION = 'spec-verify-in-loop-v1'
const ARGS = (() => { if (typeof args === 'string') { try { return JSON.parse(args) } catch { if (typeof log === 'function') log('⚠ ARGS DEGRADED: args arrived as a non-JSON string — running skeleton defaults. Pass structured JSON args (RFC-0117 §J.4).'); return { __argsDegraded: true } } } return (args || {}) })()
const SPEC_PATH = ARGS.specPath || ''            // PRD/RFC/schema path — the ground-truth spec
const ARTIFACT_REF = ARGS.artifactRef || 'git diff --staged'  // diff / files / function under check
const SCOPE = ARGS.scope || 'v1'                 // v1 = obligation-conformance; perf/quality deferred to /code-review

// ── SpecVerifier return schema: the COMPACT obligation array (the script judges the roll-up) ──
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['obligations', 'drift_findings', 'what_could_not_verify'],
  properties: {
    obligations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'kind', 'text', 'spec_ref', 'status', 'evidence'],
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', description: 'MUST | MUST-NOT | BOUND' },
          text: { type: 'string', description: 'obligation derived FROM THE SPEC' },
          spec_ref: { type: 'string', description: 'section / ISC / line in the spec' },
          status: { type: 'string', description: 'satisfied | violated | unmet | unverifiable' },
          evidence: { type: 'string', description: 'RAW: file:line, grep hit, test exit — or why unverifiable' },
        },
      },
    },
    drift_findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['obligation_id', 'why_diff_reader_misses_it', 'spec_says', 'artifact_does'],
        properties: {
          obligation_id: { type: 'string' },
          why_diff_reader_misses_it: { type: 'string' },
          spec_says: { type: 'string' },
          artifact_does: { type: 'string' },
        },
      },
    },
    what_could_not_verify: { type: 'array', items: { type: 'string' } },
  },
}

// ── DETERMINISTIC ROLL-UP (pure JS over the returned obligations — the headline; no agents) ──
// Kept as plain consts (legible in one place; "logic DOWN, agent surface thin"). Cannot be
// unit-imported from a .js workflow (non-export); the test surface is the golden-fixture
// acceptance (a fixed obligation array → a reproducible verdict). Mirrors corpus-reconcile.
const VIOLATED = new Set(['violated'])
const UNMET = new Set(['unmet'])
const UNVERIFIABLE = new Set(['unverifiable'])

// verdict precedence (pure fn): any MUST-NOT violated OR any MUST silently unmet → drift;
// obligations broken a diff-reader would also catch → fail; too-many-unverifiable → inconclusive;
// else pass. NOTE: 'drift' is the spec-anchored verifier's signature output — the case the
// /code-review diff-gate structurally cannot produce because it is never handed the spec.
const rollUp = (obligations) => {
  if (!obligations.length) return { verdict: 'inconclusive', reason: 'no obligations derived from spec' }
  const mustNotViolated = obligations.filter(o => o.kind === 'MUST-NOT' && VIOLATED.has(o.status))
  const mustUnmet = obligations.filter(o => o.kind === 'MUST' && (UNMET.has(o.status) || VIOLATED.has(o.status)))
  const boundViolated = obligations.filter(o => o.kind === 'BOUND' && VIOLATED.has(o.status))
  const unverifiable = obligations.filter(o => UNVERIFIABLE.has(o.status))

  // spec-drift = a forbidden behavior shipped, or a required behavior silently dropped
  if (mustNotViolated.length || mustUnmet.length) {
    return { verdict: 'drift', reason: `${mustNotViolated.length} MUST-NOT violated, ${mustUnmet.length} MUST unmet`, mustNotViolated, mustUnmet, boundViolated }
  }
  if (boundViolated.length) return { verdict: 'fail', reason: `${boundViolated.length} BOUND violated`, boundViolated }
  // honest residual: if more than half the obligations are unverifiable, don't bless it
  if (unverifiable.length > obligations.length / 2) {
    return { verdict: 'inconclusive', reason: `${unverifiable.length}/${obligations.length} obligations unverifiable` }
  }
  return { verdict: 'pass', reason: 'all MUST satisfied, no MUST-NOT/BOUND violated' }
}

// ===== Phase 1+2: derive obligations FROM SPEC, then check artifact (ONE anti-priming agent) =====
// derive + check are a SINGLE agent run so the anti-priming ORDER (spec-first, artifact-second)
// is enforced inside one context — splitting them would let the artifact narrative leak into the
// derivation. The phase split is conceptual (logged); the agent does both in order.
phase('derive')
log(`spec-verify-in-loop ${FIXTURE_VERSION} — scope=${SCOPE}, spec=${SPEC_PATH || '(none)'}, artifact=${ARTIFACT_REF}`)
if (!SPEC_PATH) {
  // no-silent-stalls: surface the missing input rather than fan an empty agent
  return {
    fixture_version: FIXTURE_VERSION,
    verdict: 'inconclusive',
    reason: 'no specPath provided — a spec-anchored verifier requires a ground-truth spec',
    counts: { obligations: 0 },
    result_disposition: 'returned-to-primary; primary must supply specPath (PRD/RFC/schema)',
  }
}

phase('check')
const result = await agent(
  `You are the SPEC-ANCHORED VERIFIER (see SpecAnchoredVerifier.agent.md). Verify whether the ARTIFACT
satisfies the SPEC by INDEPENDENTLY RE-DERIVING the spec's obligations — you are NOT a diff reviewer.

ORDER IS LOAD-BEARING (anti-priming):
1. DERIVE: Read ONLY the spec at "${SPEC_PATH}". Do NOT read the artifact's commit message / PR body /
   implementer narrative yet. Decompose the spec into an OBLIGATION SET — each obligation is exactly one
   of MUST | MUST-NOT | BOUND, atomic and independently checkable. Write them down (obligations[]) FIRST.
2. CHECK: NOW inspect the artifact ("${ARTIFACT_REF}") with Read/Grep/read-only Bash (a scoped test exit
   is fine; NEVER a mutating command, NEVER the full suite). For each obligation decide status:
   satisfied | violated | unmet | unverifiable — by reading the artifact's ACTUAL behavior, never by
   trusting a narrative. Cite RAW evidence (file:line / grep hit / test exit), or say why unverifiable.
3. DRIFT: For every MUST-NOT you marked violated, or MUST you marked unmet, add a drift_findings[] entry
   explaining WHY a diff-reader would have waved it through (what frame makes the change look fine) vs
   what the spec says vs what the artifact does. This is the net-new value over /code-review.

Honest residual: obligations you cannot mechanically verify go in what_could_not_verify — NEVER into
satisfied. Return STRICTLY per schema; the heavy reasoning stays with you, only the obligation array returns.`,
  { label: 'spec-verify:obligations', phase: 'check', model: 'opus', schema: VERIFY_SCHEMA }
)

// ===== Phase 3: verdict (DETERMINISTIC roll-up — no agents) =====
phase('verdict')
const obligations = (result && result.obligations) || []
const driftFindings = (result && result.drift_findings) || []
const couldNotVerify = (result && result.what_could_not_verify) || []
const verdict = rollUp(obligations)
log(`verdict: ${verdict.verdict} — ${verdict.reason} (${obligations.length} obligations, ${driftFindings.length} drift findings)`)

const byStatus = obligations.reduce((m, o) => { m[o.status] = (m[o.status] || 0) + 1; return m }, {})
const receiptLines = [
  `# spec-verify-in-loop receipt — ${FIXTURE_VERSION}`,
  '',
  `Spec: ${SPEC_PATH} · Artifact: ${ARTIFACT_REF} · Scope: ${SCOPE}`,
  `Verdict: ${verdict.verdict.toUpperCase()} — ${verdict.reason}`,
  `Obligations: ${obligations.length} ${JSON.stringify(byStatus)}`,
  '',
  '## Obligations (each independently checked against the spec)',
  ...obligations.map(o => `- [${o.status}] ${o.id} (${o.kind}) ${o.text} — spec:${o.spec_ref} · ${o.evidence}`),
  '',
  '## Spec-drift findings (what the diff-reader would miss)',
  ...(driftFindings.length
    ? driftFindings.map(d => `- ${d.obligation_id}: spec says "${d.spec_says}" but artifact "${d.artifact_does}" — diff-reader misses it because ${d.why_diff_reader_misses_it}`)
    : ['- (none)']),
  '',
  '## Honest residual (left to trust)',
  ...(couldNotVerify.length ? couldNotVerify.map(s => `- ${s}`) : ['- (none)']),
]

return {
  fixture_version: FIXTURE_VERSION,
  scope: SCOPE,
  spec_path: SPEC_PATH,
  artifact_ref: ARTIFACT_REF,
  verdict: verdict.verdict,
  reason: verdict.reason,
  counts: {
    obligations: obligations.length,
    by_status: byStatus,
    drift_findings: driftFindings.length,
    could_not_verify: couldNotVerify.length,
  },
  obligations,
  drift_findings: driftFindings,
  receipt_markdown: receiptLines.join('\n'),
  // GATE SEMANTICS (illustrative for the delivery loop, NOT enforced here): a `drift` or `fail`
  // verdict routes back to the original implementer with the obligation evidence, BEFORE the
  // operator gate (e.g. MakerkitTeam G4). `pass`/`inconclusive` surface to the operator.
  result_disposition: 'returned-to-primary; primary writes receipt_markdown to MEMORY/ARCHIVE and, in a real loop, routes drift|fail back to the implementer before the operator gate',
}
