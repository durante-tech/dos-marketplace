// ─────────────────────────────────────────────────────────────────────────
// version-council-review — native dynamic workflow (SPIKE; PRD 20260530-223000)
// fixture-version: version-council-review-v1
// owner: Sentinel (Packs/Sentinel) — composes Sentinel artifacts + named specialists + PRD
// purpose: "I'm about to tie a version" review. A THIN COMPOSER (4-seat council ratified:
//          Fowler/Metz/Cockburn/Pragmatic) over existing capability + ONE net-new asset:
//          the intended-vs-actual RECONCILER. Read-only on the target's code; surfaces
//          enhancement OPPORTUNITIES (not bug fixes) from an adaptive specialist council,
//          adversarially verified, folded with reconciliation drift into a version-readiness
//          verdict. Output is returned for the primary to write (no fs in workflow scripts).
//
//   P0 scout → {projectMap, versionFrame, prds[], routing[]}  (reads Sentinel artifacts off disk)
//   P1 reconcile (per PRD)  ∥  P2 council (per subsystem, agentType=specialist) → P3 verify (per opp)
//   P4 converge → version-readiness verdict + ranked opportunities + PRD stubs
//
// run: Workflow({ scriptPath: ".../version-council-review.js", args: {
//        target: "/abs/repo", versionLabel: "v1.6.0", maxPRDs: 8, maxSubsystems: 6, scaffoldPRDs: true } })
// Cost levers (council): read Sentinel artifacts off disk (A2 no re-walk); agent→code→report
//   (payloads never re-enter orchestrator); width caps; adversarial verify only on surfaced opps.
// Date.now()/Math.random() unavailable in workflow scripts.
// ─────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'version-council-review',
  description: 'Version-cut council review: scout Sentinel artifacts + PRD corpus, reconcile PRD-claimed status against actual code (the net-new), run an adaptive specialist council per subsystem for enhancement opportunities, adversarially verify each, and converge into a version-readiness verdict + ranked opportunities + PRD stubs. Read-only on target code; agent→code→report.',
  phases: [
    { title: 'scout', detail: 'one agent reads Sentinel artifacts + durante block → projectMap, versionFrame, prds, adaptive routing' },
    { title: 'reconcile', detail: 'per-PRD intended-vs-actual verification (the net-new real-status engine)' },
    { title: 'review', detail: 'per-subsystem specialist council (agentType=routed specialist) → opportunities' },
    { title: 'verify', detail: 'adversarial refutation per opportunity; only survivors rank' },
    { title: 'converge', detail: 'fold reconciliation + survivors → version-readiness verdict + ranked opps + PRD stubs' },
  ],
}

// RFC-0121 §2.4 leg-c — DECLARED PERMISSIONS (audit surface, not runtime enforcement).
// Agents READ the target's code + Sentinel artifacts + PRDs. NO Bash: running a target
// repo's tests is arbitrary code execution and breaks the read-only guarantee (pre-run
// review blocker). The reconciler verifies by reading code (file/symbol existence), not
// by executing. NOTHING writes the target (read-only, A1).
const permissions = {
  agent_tools: ['Read', 'Grep', 'Glob'],
  writes: [],
  network: false,
  max_units: 40,
}

const ARGS = (() => { if (typeof args === 'string') { try { return JSON.parse(args) } catch { if (typeof log === 'function') log('⚠ ARGS DEGRADED: args arrived as a non-JSON string — running skeleton defaults. Pass structured JSON args (RFC-0117 §J.4).'); return { __argsDegraded: true } } } return (args || {}) })()
const TARGET = ARGS.target || '.'
const VERSION_LABEL = ARGS.versionLabel || '(version from package.json / whole tree)'
const MAX_PRDS = ARGS.maxPRDs || 8
const MAX_SUBSYSTEMS = ARGS.maxSubsystems || 6
const MAX_OPPS_PER_ROUTE = ARGS.maxOppsPerRoute || 5

// agentType roster the scout may route to (must be real registered agent types).
const ALLOWED_SPECIALISTS = [
  'EricEvans', 'Fowler', 'UncleBob', 'Cockburn', 'Feathers', 'KentBeck',
  'SandiMetz', 'GregYoung', 'Pragmatic', 'Architect', 'Engineer', 'Designer', 'QATester',
]

// ===== Schemas =====
const SCOUT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    projectMap: {
      type: 'object', additionalProperties: true,
      properties: {
        stack: { type: 'string' },
        architecture: { type: 'string' },
        subsystems: { type: 'array', items: { type: 'object', additionalProperties: true, properties: { name: { type: 'string' }, path: { type: 'string' }, summary: { type: 'string' } }, required: ['name'] } },
      },
      required: ['stack', 'subsystems'],
    },
    versionFrame: { type: 'string' },
    prds: { type: 'array', items: { type: 'object', additionalProperties: true, properties: { slug: { type: 'string' }, file: { type: 'string' }, task: { type: 'string' }, effort: { type: 'string' }, phase: { type: 'string' }, progress: { type: 'string' } }, required: ['slug', 'file'] } },
    routing: { type: 'array', items: { type: 'object', additionalProperties: true, properties: { subsystem: { type: 'string' }, path: { type: 'string' }, specialist: { type: 'string' }, rationale: { type: 'string' } }, required: ['subsystem', 'specialist'] } },
  },
  required: ['projectMap', 'versionFrame', 'prds', 'routing'],
}

const RECON_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    slug: { type: 'string' },
    claimed_progress: { type: 'string' },
    real_status: { type: 'string', enum: ['confirmed', 'partial', 'overstated', 'cannot-verify'] },
    drifts: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { isc: { type: 'string' }, claim: { type: 'string' }, actual: { type: 'string' }, verdict: { type: 'string', enum: ['confirmed', 'drift', 'unverifiable'] } }, required: ['isc', 'verdict'] } },
    confidence: { type: 'number' },
    summary: { type: 'string' },
  },
  required: ['real_status', 'drifts', 'summary'],
}

const OPP_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    opportunities: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' },
          rationale: { type: 'string' },
          impact: { type: 'string', enum: ['low', 'medium', 'high'] },
          effort: { type: 'string', enum: ['low', 'medium', 'high'] },
          prd_relation: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['title', 'rationale', 'impact', 'effort'],
      },
    },
  },
  required: ['opportunities'],
}

const OPP_VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' },
    real: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['real', 'reason'],
}

const CONVERGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    version_readiness: { type: 'string', enum: ['ship', 'ship-with-caveats', 'not-ready'] },
    rationale: { type: 'string' },
    reconciliation_summary: { type: 'string' },
    ranked_opportunities: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, subsystem: { type: 'string' }, specialist: { type: 'string' }, impact: { type: 'string' }, effort: { type: 'string' }, rationale: { type: 'string' }, disposition: { type: 'string', enum: ['do-now', 'prd', 'rfc', 'defer'] } }, required: ['title', 'disposition'] },
    },
    prd_stubs: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { task: { type: 'string' }, effort: { type: 'string' }, rationale: { type: 'string' } }, required: ['task'] } },
  },
  required: ['version_readiness', 'rationale', 'reconciliation_summary', 'ranked_opportunities'],
}

// ===== Prompts =====
const scoutPrompt = `You are the SCOUT for a version-cut council review of the repository at ${TARGET} (version ${VERSION_LABEL}).
Read these (they already exist — do NOT re-walk the whole codebase):
- ${TARGET}/.sentinel/scan-report.json  (use the "durante" block: prds, workflows, rfcs; and stack/structure)
- ${TARGET}/Docs/Sentinel/MODULE-MAP.md, SNAPSHOT.md, TECH-DEBT.md  (if present)
Produce:
1. projectMap: stack, architecture, and the notable subsystems (name, path, 1-line summary) from MODULE-MAP + dir structure.
2. versionFrame: what "this version" means (package.json version, git tags, or whole tree).
3. prds: the Durante PRD corpus from the durante block (slug, file path relative to ${TARGET}, task, effort, phase, progress). These are the intended-status ledger.
4. routing: an ADAPTIVE table mapping each notable subsystem to the ONE specialist whose lens bites hardest. Allowed specialists ONLY: ${ALLOWED_SPECIALISTS.join(', ')}.
   Guidance: EricEvans=domain model; Fowler=coupling/refactoring; UncleBob=SOLID/clean; Cockburn=boundaries/use-cases; Feathers=legacy/seams; KentBeck=test design; SandiMetz=OO/duplication; GregYoung=events/CQRS; Pragmatic=general pragmatic; Architect=overall structure; Engineer=impl quality; Designer=UI/UX; QATester=testability. Route to fit the ACTUAL subsystem (a marketing/design site leans Designer/Fowler/SandiMetz; an event backend leans GregYoung/Evans). Cap at ${MAX_SUBSYSTEMS} routes.
Read-only. Be concrete and grounded in what you actually read.`

const reconcilePrompt = (prd) => `You are the INTENDED-VS-ACTUAL RECONCILER — the net-new heart of this review. Repository: ${TARGET}.
Read the PRD at ${TARGET}/${prd.file}. It claims progress "${prd.progress || '?'}", phase "${prd.phase || '?'}".
1. Extract its Ideal State Criteria (ISC) / acceptance items.
2. Sample up to 6 ISCs (prioritize load-bearing ones and any the claimed progress implies are done).
3. For EACH sampled ISC, VERIFY against the ACTUAL code in ${TARGET}: does the claimed file/symbol/behavior exist? Read the relevant files (Grep/Read). Do NOT execute anything — this is a read-only review; judge from the code itself.
Also return slug: "${prd.slug}".
4. Classify real_status: confirmed (code matches the claim) | partial (some ISCs unmet despite the claim) | overstated (claims done, code disagrees) | cannot-verify.
Report drifts {isc, claim, actual, verdict}. Be evidence-based — cite files. A PRD marked "${prd.progress || '?'}" may be more OR less done than it says; your job is the truth, not the claim.`

const reviewPrompt = (r) => `You are reviewing the "${r.subsystem}" subsystem (path: ${r.path || 'see MODULE-MAP'}) of ${TARGET} (version ${VERSION_LABEL}) for ENHANCEMENT OPPORTUNITIES from YOUR specific lens — NOT bug fixes, NOT style nits, NOT generic advice.
Read the relevant code under that path + ${TARGET}/Docs/Sentinel artifacts as needed. Propose the architecture/design-level opportunities you, specifically, would champion before this version is tied. For each: title, rationale (your opinionated WHY, in your voice), impact (low/medium/high), effort (low/medium/high), prd_relation (does it extend or contradict a PRD intent? else "none"), evidence (a file:area that proves the opportunity is real). Read-only. Generic advice is worthless — be concrete to THIS code.`

const verifyPrompt = (opp, r) => `Adversarially VERIFY this proposed enhancement opportunity for ${TARGET}. Try to REFUTE it.
Opportunity (subsystem ${r.subsystem}, from ${r.specialist}): "${opp.title}" — ${opp.rationale}
Evidence cited: ${opp.evidence || '(none)'}
Read the cited code. Refute if: the codebase ALREADY does this; the claim is vague/generic boilerplate; the impact is overstated; or you cannot confirm it from the code. DEFAULT real=false when uncertain. Return {title, real, reason} — reason must cite what you actually checked.`

const convergePrompt = (recon, survivors) => `You are the conceptual-integrity voice converging a version-cut council review of ${TARGET} (version ${VERSION_LABEL}).
RECONCILIATION (intended-vs-actual per PRD):
${JSON.stringify(recon, null, 2)}
VERIFIED OPPORTUNITIES (survived adversarial refutation):
${JSON.stringify(survivors.map(o => ({ title: o.title, subsystem: o.subsystem, specialist: o.specialist, impact: o.impact, effort: o.effort, rationale: o.rationale })), null, 2)}
Produce:
1. version_readiness: ship | ship-with-caveats | not-ready. Ground it in the reconciliation drift FIRST (a PRD that overstates "done" is a caveat or a block, depending on severity), then the opportunity weight.
2. rationale: decisive, 3-5 sentences.
3. reconciliation_summary: what is REALLY done vs claimed across the PRDs.
4. ranked_opportunities: dedup overlaps, rank by impact then (lower) effort; each gets a disposition (do-now | prd | rfc | defer).
5. prd_stubs: for the top opportunities that warrant a PRD, a {task (8-word), effort, rationale}.
Be decisive on the verdict — this is a go/no-go for tying the version.`

// ===== Execute =====
phase('scout')
const scout = await agent(scoutPrompt, { label: 'scout', phase: 'scout', model: 'sonnet', schema: SCOUT_SCHEMA })
if (!scout) return { error: 'scout failed — cannot proceed', target: TARGET }

const allPrds = scout.prds || []
const allRoutes = scout.routing || []
const prds = allPrds.slice(0, MAX_PRDS)
const routes = allRoutes.slice(0, MAX_SUBSYSTEMS).map(r => ({
  ...r,
  specialist: ALLOWED_SPECIALISTS.includes(r.specialist) ? r.specialist : 'Engineer',
}))
log(`scout: ${scout.projectMap?.subsystems?.length || 0} subsystems · ${prds.length} PRDs to reconcile · ${routes.length} review routes`)
if (prds.length < allPrds.length) log(`NOTE: capped PRDs at ${MAX_PRDS} (dropped ${allPrds.length - prds.length})`)
if (routes.length < allRoutes.length) log(`NOTE: capped routes at ${MAX_SUBSYSTEMS} (dropped ${allRoutes.length - routes.length})`)
if (!prds.length) log('WARN: scout returned no PRDs — reconciliation will be empty (non-Durante target or no PRD corpus)')
if (!routes.length) log('WARN: scout returned no routing — no subsystem council will run')

// P1 reconcile  ∥  P2 review → P3 verify  (independent post-scout; converge barriers both).
// ONLY the proven `parallel` primitive (pipeline is unused by any shipped DOS workflow —
// pre-run review blocker). Council+verify is a nested parallel-of-thunks: each route resolves
// to its array of verified opportunities; `reviewed` is therefore array-of-arrays → .flat().
const [reconciliations, reviewed] = await parallel([
  () => parallel(prds.map(prd => () =>
    agent(reconcilePrompt(prd), { label: `recon:${(prd.slug || '').slice(0, 24)}`, phase: 'reconcile', model: 'sonnet', schema: RECON_SCHEMA })
      .then(r => (r ? { ...r, slug: r.slug || prd.slug } : null)))),
  () => parallel(routes.map(r => () =>
    agent(reviewPrompt(r), { label: `review:${r.subsystem}`, phase: 'review', agentType: r.specialist, schema: OPP_SCHEMA })
      .then(review => {
        const opps = ((review && review.opportunities) || []).slice(0, MAX_OPPS_PER_ROUTE)
        if (((review && review.opportunities) || []).length > MAX_OPPS_PER_ROUTE) {
          log(`NOTE: ${r.subsystem} capped opportunities at ${MAX_OPPS_PER_ROUTE}`)
        }
        if (!opps.length) return []
        return parallel(opps.map(opp => () =>
          agent(verifyPrompt(opp, r), { label: `verify:${(opp.title || '').slice(0, 20)}`, phase: 'verify', model: 'sonnet', schema: OPP_VERDICT_SCHEMA })
            .then(v => ({ ...opp, subsystem: r.subsystem, specialist: r.specialist, verdict: v }))
            .catch(() => ({ ...opp, subsystem: r.subsystem, specialist: r.specialist, verdict: null }))))
      })
      .catch(() => []))),
])

const recon = (reconciliations || []).filter(Boolean)
const reviewedFlat = (reviewed || []).flat().filter(Boolean)
const survivors = reviewedFlat.filter(o => o.verdict && o.verdict.real === true)
const refuted = reviewedFlat.filter(o => !(o.verdict && o.verdict.real === true))
log(`reconciled ${recon.length} PRDs · ${survivors.length} opportunities survived adversarial verify · ${refuted.length} refuted`)

phase('converge')
const convergePayload = convergePrompt(recon, survivors)
if (convergePayload.length > 120_000) log(`WARN: converge payload ~${Math.round(convergePayload.length / 1000)}k chars — near single-agent context limit; consider sharding`)
const verdict = await agent(convergePayload, { label: 'converge', phase: 'converge', model: 'opus', schema: CONVERGE_SCHEMA })

return {
  target: TARGET,
  versionFrame: scout.versionFrame,
  versionReadiness: verdict && verdict.version_readiness,
  verdict,
  reconciliation: recon,
  opportunities: survivors,
  refutedCount: refuted.length,
  prdStubs: (verdict && verdict.prd_stubs) || [],
}
