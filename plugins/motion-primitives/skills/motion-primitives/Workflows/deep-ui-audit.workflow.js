// ─────────────────────────────────────────────────────────────────────────
// deep-ui-audit — reusable design-system migration AUDIT engine
//   Pack: MotionPrimitives (Packs/MotionPrimitives)  ·  RFC-0121 native workflow
//
// WHAT: point it at a component subtree; it runs a 4-lens design-system audit
//   (Tailwind→kit · tokens · motion · a11y) one fan-out agent per component,
//   then deterministically converges + tiers the findings into a migration plan.
//   READ-ONLY — it writes nothing. agent→code→report: the per-file finding
//   payloads converge in the script; only the compact plan returns.
//
// WHY audit-only: the MIGRATION is operator-gated (you approve batches before
//   any code is placed) and a workflow runs autonomously to completion with no
//   pause point. So this engine produces the PLAN; the gated batched migration
//   is the follow-up — see DEEP-UI-MIGRATE.md for the full loop.
//
// COMPOSES: reference/CATALOG.json (this pack's structured motion catalog —
//   props + shadcn/kit pairing + migration-use + reduced-motion guard).
//
// ARGS (pass via Workflow({ name:"deep-ui-audit", args:{...} })):
//   componentPaths : string[]   ABSOLUTE paths of the components to audit (required)
//   kitInventory?  : string     space-separated @kit/ui (or shadcn) primitive names
//                               importable in the target repo. If omitted, agents
//                               grep the repo themselves (slower, less grounded).
//   catalogPath?   : string     override CATALOG.json path
//                               (default: ~/.claude/skills/motion-primitives/reference/CATALOG.json)
//
// RETURNS: { totals, plan } — plan is per-component findings tagged by
//   lens / tier / effort / risk, ready to present at the operator gate.
//
// run (top-level only — a subagent cannot spawn a workflow):
//   Workflow({ name: "deep-ui-audit", args: {
//     componentPaths: ["/abs/app/.../card.tsx", "/abs/app/.../roster.tsx"],
//     kitInventory: "card button badge avatar empty tabs skeleton ..." } })
// ─────────────────────────────────────────────────────────────────────────

export const meta = {
  name: 'deep-ui-audit',
  description: '4-lens design-system migration audit (Tailwind→kit · tokens · motion · a11y) over a component subtree → tiered plan',
  whenToUse: 'Before a design-system migration: point at a component subtree to get a grounded, tiered Tailwind→kit + tokens + motion + a11y plan. Read-only.',
  phases: [
    { title: 'Audit', detail: 'one read-only agent per component × 4 lenses, grounded in CATALOG.json + kit inventory' },
  ],
}

// RFC-0121 §2.4 leg-c — declared permissions (audit surface, not runtime enforcement).
// Non-exported const: the runtime allows only `meta` as the single export.
const permissions = {
  agent_tools: ['Read', 'Grep', 'Glob'], // read-only audit; agents never Edit/Write
  writes: [],                            // this workflow places NO code (audit-only)
  network: false,                        // all reads are local files
  max_units: 16,                         // one fan-out agent per component, concurrency-capped
}

// MOTION-01: no hardcoded operator-absolute home. The Workflow sandbox exposes no
// process / env / homedir (verified — only globalThis), so this script CANNOT compute an
// absolute home path. It uses a portable ~-relative default that every host's agent expands
// to its own home; an explicit args.catalogPath overrides it; and the fan-out agents flag
// DEGRADED when the catalog is unreadable so grounding-loss is loud, never silent.
const DEFAULT_CATALOG = '~/.claude/skills/motion-primitives/reference/CATALOG.json'

// RFC-0117 §2.6 — defensive args parse (args may arrive as a JSON string or an object).
const ARGS = (() => { if (typeof args === 'string') { try { return JSON.parse(args) } catch { if (typeof log === 'function') log('⚠ ARGS DEGRADED: args arrived as a non-JSON string — running skeleton defaults. Pass structured JSON args (RFC-0117 §J.4).'); return { __argsDegraded: true } } } return (args || {}) })()

const paths = Array.isArray(ARGS.componentPaths) ? ARGS.componentPaths : []
const catalogPath = ARGS.catalogPath || DEFAULT_CATALOG
const catalogFromDefault = !ARGS.catalogPath
const kitInventory = ARGS.kitInventory || '(not supplied — grep the repo for @kit/ui/<name> imports yourself to ground the tailwind-to-kit lens)'

if (!paths.length) {
  log('deep-ui-audit: no componentPaths in args — nothing to audit.')
  return { totals: { components: 0, findings: 0 }, plan: [] }
}

// MOTION-01: no args.catalogPath — using the portable ~-relative default. The sandbox can't
// probe the filesystem, so agents expand ~ and flag DEGRADED if the catalog is unreadable on
// this host; pass args.catalogPath to ground the motion lens deterministically.
if (catalogFromDefault) {
  log(`⚠ deep-ui-audit: no args.catalogPath — falling back to portable default ${catalogPath}. Agents expand ~ to their home and will flag DEGRADED if the motion catalog is unreadable here.`)
}

const FINDING = {
  type: 'object', additionalProperties: false,
  required: ['lens', 'element', 'current', 'proposed', 'target', 'effort', 'tier', 'risk'],
  properties: {
    lens: { type: 'string', enum: ['tailwind-to-kit', 'tokens', 'motion', 'a11y'] },
    element: { type: 'string', description: 'specific element + line range' },
    current: { type: 'string', description: 'what the markup/code does today' },
    proposed: { type: 'string', description: 'concrete before→after migration' },
    target: { type: 'string', description: '@kit/ui/<x> component OR motion slug OR token name' },
    effort: { type: 'string', enum: ['S', 'M', 'L'] },
    tier: { type: 'string', enum: ['T1-quick-win', 'T2-signature', 'T3-ambitious'] },
    risk: { type: 'string', enum: ['low', 'med', 'high'] },
  },
}
const COMP_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['component', 'summary', 'findings'],
  properties: {
    component: { type: 'string' },
    summary: { type: 'string' },
    findings: { type: 'array', items: FINDING },
  },
}

phase('Audit')

const results = await parallel(paths.map((p) => () =>
  agent(
    `You are a principal design-system engineer auditing ONE React component for a MIGRATION across 4 lenses. Produce concrete, grounded findings.\n\n` +
    `READ (Read tool):\n` +
    `1. TARGET: ${p}  (read fully)\n` +
    `2. MOTION CATALOG: ${catalogPath}  (expand a leading ~ to your home directory; this file ships inside the motion-primitives skill). If it is unreadable, note DEGRADED (see below) — do NOT invent motion targets. Structured cards: per-component props, shadcn_pairing, migration_use, adapt_notes, reduced_motion — use to pick motion targets + how to wire them.\n\n` +
    `AVAILABLE kit/shadcn PRIMITIVES (tailwind-to-kit targets, import as @kit/ui/<name>):\n${kitInventory}\n\n` +
    `THE 4 LENSES (skip a lens if genuinely nothing):\n` +
    `- tailwind-to-kit: raw <div className="…"> markup that REIMPLEMENTS a primitive already in the kit (hand-rolled card→Card, custom pill→Badge, bespoke empty→Empty, manual skeleton→Skeleton). Cite the exact className.\n` +
    `- tokens: hardcoded colors/spacing/radii (hex, rgb, arbitrary [12px], raw gray-500) that should be design tokens (bg-card, text-muted-foreground, rounded-lg, gap-4).\n` +
    `- motion: static / hard-cut UI a motion component would improve — use CATALOG slugs + their migration_use. Tie each to a catalog card.\n` +
    `- a11y: missing roles/landmarks/focus/aria, non-button clickables, decorative icons missing aria-hidden, and a prefers-reduced-motion guard for any motion proposed.\n\n` +
    `For EACH finding: lens, element+lines, current, proposed before→after, target, effort S/M/L, tier (use EXACTLY one of the schema enum tokens: T1-quick-win / T2-signature / T3-ambitious), risk low/med/high. Ground every claim in real classNames + line numbers. Quality over quantity.\n\n` +
    `If (and ONLY if) the motion catalog above was unreadable, begin the component "summary" with "DEGRADED: motion catalog unavailable — " and still audit the other 3 lenses.\n\n` +
    `Return ONLY the structured object.`,
    { label: `audit:${p.split('/').pop()}`, phase: 'Audit', model: 'sonnet', schema: COMP_SCHEMA }
  )
))

// ── deterministic converge (agent→code→report: payloads stay out of orchestrator) ──
const comps = results.filter(Boolean)
const byLens = {}, byTier = {}, byRisk = {}
let total = 0
for (const c of comps) {
  for (const f of (c.findings || [])) {
    total++
    byLens[f.lens] = (byLens[f.lens] || 0) + 1
    byTier[f.tier] = (byTier[f.tier] || 0) + 1
    byRisk[f.risk] = (byRisk[f.risk] || 0) + 1
  }
}
log(`deep-ui-audit: ${comps.length} components · ${total} findings · lenses ${JSON.stringify(byLens)} · tiers ${JSON.stringify(byTier)}`)

// MOTION-01: surface catalog-grounding loss loudly — never let it pass silently.
const degraded = comps.filter((c) => typeof c.summary === 'string' && c.summary.startsWith('DEGRADED'))
if (degraded.length) {
  log(`⚠ deep-ui-audit DEGRADED: ${degraded.length}/${comps.length} component(s) audited WITHOUT motion-catalog grounding — catalog unreadable at ${catalogPath}. The motion lens is untrustworthy for those; pass args.catalogPath to fix.`)
}

return {
  totals: { components: comps.length, findings: total, byLens, byTier, byRisk, degraded: degraded.length },
  plan: comps,
}
