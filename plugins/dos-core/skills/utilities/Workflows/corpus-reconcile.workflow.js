// ─────────────────────────────────────────────────────────────────────────
// corpus-reconcile — native dynamic workflow  (/team-lead headline; RFC-0121 distributable)
// fixture-version: corpus-reconcile-v1
// owner: Utilities (Packs/Utilities)
// purpose: the "nothing dangles" cross-corpus sweep. Audit the PRD corpus + cited
//          paths/versions for STALENESS, and give every finding a disposition
//          (done | prd | RFC | deferred | backlog). Corpus-level SIBLING of the
//          per-PRD PhaseCompleteGate hook — it SURFACES + dispositions, it NEVER
//          writes `phase: complete` itself (the gate owns closure). agent→code→report:
//          agents gather raw facts (the Workflow script has NO fs/git access), the
//          script applies deterministic bucketing + disposition rules, the primary
//          writes the receipt to MEMORY/ARCHIVE.
//
// make-or-break: the DETERMINISTIC-FIRST triage. ~220 PRDs cannot each get an agent
//          (11x the width cap; a credit incident). A single gatherer agent returns
//          compact per-PRD frontmatter+git facts; the SCRIPT'S pure-JS rules bucket
//          agree-vs-disagree; only the disagreement set (status ⊻ git) gets a verifier
//          agent. A no-disagreement fixture corpus fans ZERO agents (pure-deterministic).
//
// DISTRIBUTION (RFC-0121): SoT pack-owned `.workflow.js`. Installs IMMUTABLY to
//   ~/.claude/workflows/corpus-reconcile.js (install.sh; pack-source wins on upgrade;
//   operator escape hatch = ~/.claude/workflows/local-override/corpus-reconcile.js).
//   Manifest `native_workflows` pair + sync-check compareNativeWorkflows() guard drift +
//   the §2.7 project-local collision. Acceptance gate: `bun Tools/workflow-acceptance.ts`.
//
// run:  Workflow({ name: "corpus-reconcile", args: { workRoot: "MEMORY/WORK", recentDays: 14 } })
// conventions: RFC-0117 §J.4 args-JSON-parse; §J.3 cost ceiling (MAX_UNITS fan-out width);
//   result-disposition / no-silent-stalls; return-content-then-primary-writes; declared
//   permissions (RFC-0121 §2.4 leg-c — AUDIT surface, not runtime enforcement).
// Date.now()/Math.random() are unavailable in workflow scripts.
// ─────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'corpus-reconcile',
  description: 'Cross-corpus staleness sweep for /team-lead: a gatherer agent returns raw PRD-frontmatter + git + cited-path facts (the script has no fs access); deterministic script rules bucket agree-vs-disagree; only status-vs-git disagreements get a verifier agent; every finding gets a disposition (done|prd|deferred|backlog; RFC = operator promotion of a decision-grade PRD finding). Surfaces + dispositions only — never writes phase:complete (PhaseCompleteGate owns closure). agent→code→report; the corpus payload never re-enters the orchestrator context.',
  phases: [
    { title: 'gather', detail: 'one gatherer agent returns compact PRD-frontmatter + git-recency + cited-path facts across all WORK buckets' },
    { title: 'triage', detail: 'deterministic script rules bucket each PRD agree-vs-disagree (status XOR git) + flag unresolved citations — no agents' },
    { title: 'disposition', detail: 'verifier agents ONLY on the disagreement set (capped/batched); deterministic mapping → done|prd|RFC|deferred|backlog' },
  ],
}

// RFC-0121 §2.4 leg-c — DECLARED PERMISSIONS (AUDIT surface; Cato D6). The gatherer + verifier
// agents read PRD files, grep cited paths/symbols, and run read-only git (`git log`); they write
// NOTHING (return-content-then-primary-writes — the primary writes the receipt to MEMORY/ARCHIVE)
// and never reach the network. NOTE: plain `const` (NOT `export const`) — the Workflow runtime
// allows exactly ONE top-level export (`export const meta`); a 2nd export throws at load
// (RFC-0121 D12); acceptance leg-a asserts the single-export invariant.
const permissions = {
  agent_tools: ['Read', 'Grep', 'Bash'],
  writes: [],
  network: false,
  max_units: 20,
}

const FIXTURE_VERSION = 'corpus-reconcile-v1'
const ARGS = (() => { if (typeof args === 'string') { try { return JSON.parse(args) } catch { if (typeof log === 'function') log('⚠ ARGS DEGRADED: args arrived as a non-JSON string — running skeleton defaults. Pass structured JSON args (RFC-0117 §J.4).'); return { __argsDegraded: true } } } return (args || {}) })()
const WORK_ROOT = ARGS.workRoot || 'MEMORY/WORK'
const RECENT_DAYS = ARGS.recentDays || 14   // git-recency window: a slug touched within this window counts as "shipped recently"
const MAX_UNITS = ARGS.maxUnits || 20       // §J.3 fan-out WIDTH cap (verifier agent COUNT over the disagreement set)
const SCOPE = ARGS.scope || 'v1'            // v1 = stale-PRD-status + path/version-vs-code (ISC-36); broader doc-prose deferred

// ── Gatherer return schema: compact facts ONLY (the script does the judging) ──
const GATHER_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['prds', 'citations', 'recent_commit_slugs'],
  properties: {
    prds: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['slug', 'path', 'bucket', 'phase', 'progress_done', 'progress_total'],
        properties: {
          slug: { type: 'string' },
          path: { type: 'string' },
          bucket: { type: 'string', description: 'active | archived | flat' },
          phase: { type: 'string', description: 'observe|think|plan|build|execute|verify|complete|unknown' },
          progress_done: { type: 'number' },
          progress_total: { type: 'number' },
          last_commit_iso: { type: 'string', description: 'ISO date of last commit touching the PRD dir, or "" if never committed' },
        },
      },
    },
    // sweep-(b): cited paths/symbols/versions that DO NOT resolve (deterministic existsSync/grep miss — never prose mismatch)
    citations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['source_file', 'cited', 'kind', 'resolves'],
        properties: {
          source_file: { type: 'string' },
          cited: { type: 'string', description: 'the cited path / symbol / version string' },
          kind: { type: 'string', description: 'path | symbol | version' },
          resolves: { type: 'boolean', description: 'true if path exists / symbol greps / version matches' },
        },
      },
    },
    recent_commit_slugs: {
      type: 'array', items: { type: 'string' },
      description: `slugs (or distinctive tokens) appearing in commit subjects/bodies within the last ${RECENT_DAYS} days`,
    },
  },
}

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['slug', 'verdict', 'evidence', 'owed_gate_evidences'],
  properties: {
    slug: { type: 'string' },
    verdict: { type: 'string', description: 'shipped | in-progress | abandoned | blocked | needs-spec' },
    evidence: { type: 'array', items: { type: 'string' }, description: 'commit SHAs / test exit / grep hits — RAW, not a claim' },
    owed_gate_evidences: { type: 'array', items: { type: 'string' }, description: 'PhaseCompleteGate checks still owed before this PRD can legitimately close (KG learned fact, reflection JSONL, decision drawer, working-tree-clean)' },
  },
}

// ── DETERMINISTIC RULES (pure JS over gathered facts — the headline; no agents) ───────────────
// Kept as plain consts so the logic is legible + reviewable in one place (the three-layer
// "logic DOWN, agent surface thin" discipline). Cannot be unit-imported from a .js workflow
// (non-export); the test surface is the acceptance golden-fixture (leg-b), where a
// no-disagreement corpus fans ZERO agents and yields a reproducible return_digest.

const DONEISH_PHASES = new Set(['verify', 'complete'])

// A PRD is a DISAGREEMENT (status XOR git) when its frontmatter says done-ish but git shows no
// recent ship, OR it says mid-flight but git shows it shipped. Those are the only rows worth an
// agent; everything else is "agree" and skipped (cheap).
const isDoneish = (prd) =>
  DONEISH_PHASES.has((prd.phase || '').toLowerCase()) ||
  (prd.progress_total > 0 && prd.progress_done >= prd.progress_total)

const slugShippedRecently = (prd, recentSet) => {
  if (recentSet.has(prd.slug)) return true
  // tolerant: the gatherer may return a distinctive token rather than the full dated slug — match
  // it as a substring of the slug (≥6 chars to avoid spurious hits). Without this, dated slugs
  // like "20260531-093152_prd-isc-fanout-guard" never equal a commit-subject token and a
  // genuinely-shipped PRD is mis-flagged unverified-claim instead of stale-shipped.
  for (const tok of recentSet) { if (tok && tok.length >= 6 && prd.slug.includes(tok)) return true }
  return false
}

const classifyPrd = (prd, recentSet) => {
  const doneish = isDoneish(prd)
  const shipped = slugShippedRecently(prd, recentSet)
  if (doneish && shipped) return { state: 'disagree', why: 'done-ish + shipped → likely closable but unclosed', kind: 'stale-shipped' }
  if (doneish && !shipped) return { state: 'disagree', why: 'done-ish but git shows no recent ship → claim unverified', kind: 'unverified-claim' }
  if (!doneish && shipped) return { state: 'disagree', why: 'mid-flight phase but git shows it shipped → status lags reality', kind: 'status-lags-git' }
  return { state: 'agree', why: 'status and git agree (mid-flight, not shipped)', kind: 'agree' }
}

// Deterministic disposition mapping (pure fn): a verified finding → done | prd | deferred | backlog.
// NOTE: 'RFC' is intentionally NOT a deterministic output — decision-grade is a human judgement; the
// operator PROMOTES a PRD-disposition finding to an RFC per the repo promotion-paths doctrine. The
// workflow surfaces PRD; the conductor/operator elevates. (Reconciled after code-review B#1.)
const disposition = (kind, verdict) => {
  if (kind === 'citation-unresolved') return 'PRD'        // a broken citation is fixable WORK → a PRD line item
  if (verdict === 'shipped') return 'done'                // route close through PhaseCompleteGate (never auto-closed here)
  if (verdict === 'in-progress') return 'deferred'        // legitimately open; leave it
  if (verdict === 'abandoned') return 'backlog'           // dead claim → backlog for a decision
  if (verdict === 'blocked') return 'deferred'
  if (verdict === 'needs-spec') return 'PRD'
  return 'backlog'
}

// ===== Phase 1: gather (ONE agent — the script has no fs/git access) =====
phase('gather')
log(`corpus-reconcile ${FIXTURE_VERSION} — scope=${SCOPE}, workRoot=${WORK_ROOT}, recentDays=${RECENT_DAYS}`)
const gathered = await agent(
  `You are the GATHERER for a cross-corpus staleness sweep. Use Bash/Grep/Read to collect COMPACT FACTS
ONLY — do NOT judge staleness, do NOT propose dispositions. The orchestrator applies the rules.

1. Enumerate every PRD across ALL THREE WORK buckets (do NOT miss archived/ or legacy flat — a
   directory glob that skips them yields a falsely-clean sweep):
     - ${WORK_ROOT}/active/*/PRD.md
     - ${WORK_ROOT}/archived/*/PRD.md
     - ${WORK_ROOT}/*/PRD.md        (legacy flat — exclude the active/ and archived/ dirs themselves)
   For each, read ONLY the YAML frontmatter and return: slug, path, bucket (active|archived|flat),
   phase, and progress parsed into progress_done + progress_total (from "progress: N/M"; if absent use 0/0).

2. git recency: run \`git -C <repo> log --since="${RECENT_DAYS} days ago" --pretty=%s%n%b\` and return
   recent_commit_slugs = for any PRD whose work appears in a recent commit subject/body, the FULL PRD
   slug when determinable (PREFERRED — the orchestrator matches it exactly); a distinctive >=6-char
   token is an acceptable fallback (the orchestrator substring-matches it). This is how we tell
   "shipped recently" from frontmatter claims.

3. sweep-(b) citations (SCOPE=v1: deterministic resolve ONLY, never prose mismatch): scan committed
   docs/specs/READMEs for cited file PATHS and code SYMBOLS/versions; for each, test resolution with
   Bash (\`test -e <path>\`; \`grep -rln <symbol>\`). Return citations[] with resolves=true/false.
   Keep this BOUNDED — sample the most-cited surfaces; if you cap, say so. Return only the UNRESOLVED
   ones plus a representative sample of resolved ones.

Return strictly per schema. Compact facts; the heavy corpus stays with you, not the orchestrator.`,
  { label: 'gather:corpus-facts', phase: 'gather', model: 'sonnet', schema: GATHER_SCHEMA }
)

const prds = (gathered && gathered.prds) || []
const citations = (gathered && gathered.citations) || []
const recentSet = new Set((gathered && gathered.recent_commit_slugs) || [])

// ===== Phase 2: triage (DETERMINISTIC — no agents) =====
phase('triage')
const classified = prds.map(p => ({ prd: p, ...classifyPrd(p, recentSet) }))
const disagreements = classified.filter(c => c.state === 'disagree')
const agrees = classified.filter(c => c.state === 'agree')
const unresolvedCitations = citations.filter(c => c && (c.resolves === false || c.resolves === 'false'))
log(`triage: ${prds.length} PRDs → ${disagreements.length} disagreement(s), ${agrees.length} agree (skipped); ${unresolvedCitations.length} unresolved citation(s)`)

// ===== Phase 3: disposition (verifier agents ONLY on the disagreement set, batched ≤ MAX_UNITS) =====
phase('disposition')
const findings = []

// 3a. unresolved citations → deterministic finding, NO agent (binary resolve)
for (const c of unresolvedCitations) {
  findings.push({
    type: 'stale-citation',
    source: c.source_file,
    detail: `cited ${c.kind} does not resolve: ${c.cited}`,
    disposition: disposition('citation-unresolved'),
    owed: [],
  })
}

// 3b. status-vs-git disagreements → verifier agents, batched in waves of MAX_UNITS [review: wave-batch]
let verifyResults = []
for (let i = 0; i < disagreements.length; i += MAX_UNITS) {
  const batch = disagreements.slice(i, i + MAX_UNITS)
  if (batch.length === 0) break
  log(`disposition: verifying batch ${Math.floor(i / MAX_UNITS) + 1} (${batch.length} of ${disagreements.length})`)
  const res = await parallel(batch.map(c => () =>
    agent(
      `You are a STATUS VERIFIER for one PRD. Use Read/Grep/Bash (read-only git only — NEVER a mutating
command, NEVER the full test suite). PRD: ${c.prd.slug} (path: ${c.prd.path}).
Frontmatter says: phase=${c.prd.phase}, progress=${c.prd.progress_done}/${c.prd.progress_total}.
Triage flagged: ${c.kind} — "${c.why}".

Determine the TRUE state from git + the PRD's own claimed deliverables (cite RAW evidence: commit SHAs,
grep hits, a single SCOPED test exit if cheap). Pick verdict: shipped | in-progress | abandoned | blocked
| needs-spec. If shipped-but-unclosed, list owed_gate_evidences (what PhaseCompleteGate still needs:
KG learned fact, reflection JSONL line, decision drawer, working-tree-clean) — we NEVER auto-close here.`,
      { label: `verify:${c.prd.slug}`.slice(0, 48), phase: 'disposition', model: 'opus', schema: VERIFY_SCHEMA }
    )
  ))
  verifyResults = verifyResults.concat(res)
}

// deterministic disposition mapping over the verifier returns (pure fn; agents returned raw verdicts)
disagreements.forEach((c, idx) => {
  const v = verifyResults[idx]
  if (!v) {  // agent failed — surface, never launder [no-silent-stalls]
    findings.push({ type: c.kind, slug: c.prd.slug, detail: `verifier failed; manual review needed (${c.why})`, disposition: 'backlog', owed: [] })
    return
  }
  findings.push({
    type: c.kind,
    slug: c.prd.slug,
    detail: `${c.why} — verdict: ${v.verdict}`,
    evidence: v.evidence || [],
    disposition: disposition(c.kind, v.verdict),
    owed: v.owed_gate_evidences || [],
  })
})

// ── tally + receipt content (the PRIMARY writes this to MEMORY/ARCHIVE — workflow returns content) ──
const byDisposition = findings.reduce((m, f) => { m[f.disposition] = (m[f.disposition] || 0) + 1; return m }, {})
const receiptLines = [
  `# corpus-reconcile receipt — ${FIXTURE_VERSION}`,
  '',
  `Scope: ${SCOPE} · workRoot: ${WORK_ROOT} · recentDays: ${RECENT_DAYS}`,
  `PRDs scanned: ${prds.length} (${agrees.length} agree/skipped, ${disagreements.length} verified) · unresolved citations: ${unresolvedCitations.length}`,
  `Dispositions: ${JSON.stringify(byDisposition)}`,
  '',
  '## Findings (every one dispositioned — nothing dangles)',
  ...findings.map(f => `- [${f.disposition}] ${f.type}${f.slug ? ' · ' + f.slug : ''} — ${f.detail}${f.owed && f.owed.length ? ' · owes: ' + f.owed.join(', ') : ''}`),
]

return {
  fixture_version: FIXTURE_VERSION,
  scope: SCOPE,
  counts: {
    prds_scanned: prds.length,
    agree_skipped: agrees.length,
    disagreements: disagreements.length,
    unresolved_citations: unresolvedCitations.length,
    findings: findings.length,
  },
  by_disposition: byDisposition,
  findings,
  receipt_markdown: receiptLines.join('\n'),
  // NB: this workflow NEVER writes phase:complete and NEVER edits PRDs (ISC-40/A5). Closure routes
  // through PhaseCompleteGate; a `done` disposition for an unclosed PRD carries its owed evidences.
  result_disposition: 'returned-to-primary; primary writes receipt_markdown to MEMORY/ARCHIVE and routes any close through PhaseCompleteGate',
}
