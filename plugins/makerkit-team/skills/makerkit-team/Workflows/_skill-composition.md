---
name: MakerkitTeamSkillComposition
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Skill-composition substrate maps per-role authorized DOS skills, not CLI mode flags"
---

# Skill Composition (binding)

Shared substrate for every MakerkitTeam role that composes other DOS skills as tools. Mirrors the pattern shipped in `Packs/thinking/src/Council/Workflows/Debate.md` Step 1b (Round 0 — Evidence Gathering): **Conditional fire + Cost guard + Failure mode + Skip path**.

**Source of truth:**
- Each role's `composed_skills` field in `Data/Roster.json`
- The per-tie sections below define when the orchestrator (or the agent itself) fires `Skill("<Name>", "<workflow>")` from inside the role's phase

**Kit-specialist ties (v0.7.0 — un-gated; they shipped):** the four kit-framework specialist skills are now authorized composed skills, fired under the same Conditional-fire + Cost-guard + Failure-mode + Skip-path pattern: `frontend` → `react-form-builder` + `frontend-design`; `backend` → `server-actions-expert`; `database` → `prisma-expert`; `e2e` → `playwright-e2e-expert`. (Pre-v0.7.0 `BuildBrief.ts` forbade these as "aspirational" — that gate is removed now that the skills are installed.)

This partial is cited from `DeliverFeature.md`, `BugFix.md`, `Refactor.md`, `DocsRefresh.md`, `SecurityAudit.md`, `TestAndValidate.md`. Every change-producing workflow that runs the affected agents should reference back here.

## Intent-to-Flag Mapping

| Operator intent | Composition pattern | Notes |
|---|---|---|
| "make the UI agent draw a mockup" | UI Designer → `Skill("media", "generate image")` | Phase 2 Design — visual artifact instead of prose |
| "ground the PM agent in market evidence" | PM → `Skill("research", "QuickResearch")` | Phase 1 Discovery — Council-G2 pattern at per-agent scope |
| "let the UX agent inherit brand voice" | UX Designer → `Skill("brand", "research")` | Phase 2 Design — voice/microcopy/a11y |
| "render the UI tokens into shadcn/Tailwind" | UI Designer → `Skill("design-system", "apply")` | Phase 2 Design — token → component |
| "have the writer polish the changelog" | Writer → `Skill("dispatch", "Enhance")` | Phase 7 Ship — same pipeline that polishes blog posts |
| "let security recon real CVEs/threats" | Security → `Skill("security", "web assessment")` | Phase 5 Hardening — real recon, not pure inference |
| "harden the e2e specs like a Playwright expert" | E2E → `Skill("playwright-e2e-expert")` | Phase 6 Verification — spec quality + flake mitigation; execution stays `pnpm --filter web-e2e exec playwright test` |

## Universal Pattern (mirrors Council Round 0)

Every per-role composition follows this shape:

1. **Trigger** — fire ONLY when the role's deliverable benefits from the composed skill's specific output
2. **Skip path** — silent skip when not applicable (e.g., UI doesn't need Media for token-only changes)
3. **Cost guard** — `AskUserQuestion` triage when fan-out > N (per-tie limit below)
4. **Failure handling** — composed skill errors degrade to flagged-unverified, never block the parent phase

## Per-Role Composition

### UI Designer → Media + DesignSystem (Phase 2 Design)

**Composed skills:** `media` (artwork generation), `design-system` (token→component rendering)

**Trigger:**
- Fire `media` when the visual spec calls for new illustrations, hero imagery, brand-aware icons, or component mockups that don't already exist in `@kit/ui` (verify via `mcp__makerkit__components_search` first — duplication-prevention)
- Fire `design-system` when Tailwind token decisions land in PRD `## Design → ### UI Spec` and need to be rendered into shadcn-compatible component scaffolds

**Cost guard:** ≤2 Media calls per phase. Beyond that, `AskUserQuestion` with a "render all / render top 2 / skip Media" choice.

**Failure mode:** Media empty/error → ⚠️ flagged as `mockup-pending` in PRD; UI Designer reverts to prose visual spec, Frontend proceeds with placeholder.

**Skip path:** Token-only or copy-only changes that touch no new visual surface — UI Designer writes the token diff and skips both.

**Example invocation (single message, parallel):**

```ts
// Mockup generation
Skill("media", "generate header image for team-invite confirmation modal — brand-aware, soft gradient, accessible contrast")

// Token-to-component apply
Skill("design-system", "apply tokens from PRD Design section to a new shadcn InviteCard component")
```

### UX Designer → Brand (Phase 2 Design)

**Composed skill:** `brand` (verbal voice + brand tokens)

**Trigger:** Fire when the feature introduces new user-facing copy (form labels, error messages, empty-state copy, success toasts, onboarding microcopy) OR when accessibility patterns need brand-consistent ARIA labels.

**Cost guard:** 1 Brand call per feature — Brand returns a voice slice that the UX Designer applies to ALL new copy in one pass. Multiple Brand calls per phase = anti-pattern (`AskUserQuestion` if the temptation arises).

**Failure mode:** Brand empty/error → UX Designer falls back to kit's existing copy patterns in `apps/web/content/` for tone-matching; flags PRD `### A11y Notes → brand-voice-unverified`.

**Skip path:** Feature has no new user-facing copy (purely admin/DevOps surfaces, or refactors with identical UI).

### PM → Research (Phase 1 Discovery)

**Composed skill:** `research` (QuickResearch, StandardResearch, DocsLookup)

**Trigger:** Fire when the ISC list seed contains any of:
- Competitive references ("like Stripe Connect", "similar to Linear's invites") → `Research("QuickResearch")` for the named competitor's pattern
- Market sizing or adoption claims ("multi-tenant team invites are table-stakes") → `Research("StandardResearch")` for evidence
- Named library/SDK references ("use Resend webhooks", "rely on Better Auth org plugin") → `Research("DocsLookup")` via Ref

**Cost guard:** ≤3 Research calls per Phase 1. Beyond that, `AskUserQuestion` with the decomposed sub-claims and "research all / research top 3 / skip" choice. This is the exact G2 cost guard from Council Round 0.

**Failure mode:** Research empty/error → flag the claim as `⚠️ unverified` in the PRD `## Context` section and proceed; do NOT block ISC authoring.

**Skip path:** Internal-only features (devops/refactor/test-and-validate runs) with no external referents.

### Writer → Dispatch.Enhance + Research (Phase 7 Ship)

**Composed skills:** `dispatch` `Enhance` workflow (content polish), `research` (citation grounding)

**Trigger:**
- Fire `Dispatch("Enhance")` on the changelog mdoc + in-app help mdoc once the Writer has the first-draft text. The Enhance workflow runs Tier 1 polish (clarity, voice, link verification) — same pipeline that polishes blog posts.
- Fire `Research("DocsLookup")` when the docs cite an external framework version or SDK API surface (so the published docs reference verified, citation-grounded examples instead of training-data recall).

**Cost guard:** Dispatch Enhance is 1 call per feature (operates on the whole doc bundle). Research citations: ≤2 lookups per docs bundle; beyond that, escalate.

**Failure mode:** Dispatch Enhance unavailable → Writer ships unpolished first-draft + flags PRD `## Decisions → ### docs-enhance-deferred`. Research unavailable → unverified citations marked `⚠️ check-on-revisit`.

**Skip path:** Feature is operator-internal (no `apps/web/content/changelog/` entry, no `docs/<domain>/` mdoc).

### Security → security skill (Phase 5 Hardening)

**Composed skill:** `security` (web assessment, recon, threat intel, news monitoring)

**Trigger:**
- Fire `Security("web assessment")` when the feature exposes new HTTP surfaces (server actions, webhook endpoints, public-facing routes) — runs OWASP-style enumeration over the kit's actual routes
- Fire `Security("annual reports" or "news")` when the feature touches a third-party integration (Stripe, Resend, Better Auth provider, Sentry) — pulls recent vendor threat-intel into the Phase 5 threat-model brief

**Cost guard:** 1 web-assessment per feature is the norm; news lookups capped at ≤3 vendors. Beyond that, escalate.

**Failure mode:** security skill unavailable → Security agent falls back to static OWASP checklist against the diff; threat-model carries `⚠️ recon-not-run` flag in PRD `## Decisions → ### Threat Model`.

**Skip path:** Feature exposes no new HTTP surface AND touches no third-party integration (e.g., internal-only Prisma query refactor with same RBAC).

### E2E → playwright-e2e-expert (Phase 6 Verification)

**Composed skill:** `playwright-e2e-expert` (spec authoring, page-object models, async best practices, flake mitigation)

QA composes no skills (per `Data/Roster.json` — Vitest unit work runs direct; jsdom usually suffices).

**Trigger:**
- E2E fires `playwright-e2e-expert` when authoring or reviewing Playwright specs for the feature — page-object structure, polling assertions, bootstrap-helper usage, flake mitigation. Spec execution stays on the canonical path `pnpm --filter web-e2e exec playwright test <feature> --workers=1` (per `_test-pyramid-gate.md`); the run summary lands in PRD `## Verification → ### E2E-layer evidence` alongside the raw Playwright output

**Cost guard:** ONE feature scope at a time (kit dev server is single-tenant locally). `AskUserQuestion` if multiple features queue up.

**Failure mode:** skill unavailable → E2E authors specs directly from `_test-pyramid-gate.md` conventions; the canonical Playwright run still happens; flag PRD `### E2E-layer evidence → e2e-skill-unavailable`. The pyramid gate G6 is NOT relaxed.

**Skip path:** Documentation-only / config-only changes that bypass Phase 6 entirely.

## Cross-references

- **Council G2 pattern** (`Packs/thinking/src/Council/Workflows/Debate.md` Step 1b) — canonical Round 0 source that this partial mirrors
- **G4 cross-pack audit** (commit `955a1ade`) — 14 inter-skill composition ties wired across the corpus; this partial is the MakerkitTeam-internal v0.6.0 follow-on for the agents below the workflow level
- **`Data/Roster.json`** — `composed_skills: [...]` field per role enumerates the authorized DOS skills
- **`_algorithm-team-spawn.md`** — when an agent's composed skill is itself a multi-stream skill (Research StandardResearch, Brand 9-agent), the inner skill manages its own parallelism; the kit agent receives the aggregated result
- **`_test-pyramid-gate.md`** — the `playwright-e2e-expert` composition for E2E does NOT relax the pyramid; execution stays on the canonical Playwright commands

## Anti-Patterns

1. **Firing every composed skill on every phase** — defeats the trigger filters. The skip path is load-bearing; use it.
2. **Bundling per-role composition into a Phase 1 mega-brief** — agents lose focus when given 6 tools they don't need. Compose at the agent's natural phase only.
3. **Treating composed-skill output as ground truth** — Research/Brand/Security outputs carry `⚠️ unverified` semantics on failure; downstream phases must read those flags.
4. **Recursing — composed skill calls its own composed skills opaquely** — every composition layer should be one hop deep from the kit agent. If transitive composition is needed, surface it in the brief so the orchestrator can budget the cost.
5. **Skipping the cost guard** — every per-role section has a numeric ceiling; `AskUserQuestion` is non-optional when it fires.
