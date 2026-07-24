---
name: GrowthProgram
description: Run a product's social-media presence + growth campaign program end-to-end — brand & channel strategy, a multi-channel campaign calendar, a recurring creative/materials engine, ongoing publish/engage/measure social ops, AND a GEO/AEO pillar (be the default answer when a human or LLM asks for the best tool in the niche). Research-grounded, council-vetted, integrity-guarded. Produces a program from project knowledge + a campaign subject. USE WHEN social media presence, social media program, campaign calendar, content calendar, create campaign materials, social posts/reels/carousels, run our socials, growth program, go-to-market campaign, GEO, AEO, share of AI voice, be the default recommendation.
role: orchestrator
accepts: [text]
icon: TrendingUp
tier: primary
category: Growth
displayLabel: GrowthProgram
roots: []
visibility: public
capabilities: [customization.cascade, four-copy.sync]
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/GrowthProgram/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# GrowthProgram

**Status:** v0.1.0 — orchestrator skill for social-media presence + growth campaign programs. Given
**project knowledge + a campaign subject**, it runs a 7-phase pipeline and emits a `docs/growth/` program.
**Social presence, the campaign calendar, and the creative/materials engine are first-class; GEO/AEO is one
pillar.** It composes existing DOS skills for the heavy lifting and adds a 5-seat council + an adversarial
integrity guard.

GrowthProgram is the growth-marketing analog of the StreamRig / Sales orchestrators: it owns the program
shape (phases, council, output contract, integrity rules) and composes `brand` (voice/visual), `dispatch`
(copy/calendar), `media` (creative assets), `social-media` + `stream-rig` (publish/engage/insights +
content multiplier), `research` (GEO corpus + grounding), `sentinel` (repo/SEO baseline), and `mem-palace`
(project-knowledge recall).

**Lineage:** generalizes `durante-tech/altyaa-turbo#251` (which delivered the GEO pillar + a week-1 asset
drop) into the full presence + campaign program.

## Inputs
- **Project knowledge** — the product/brand: what it is, ICP, the channels it lives on + cadence, market +
  locale, pricing, brand voice/visual baseline, current presence/SEO/entity baseline. Mine the repo
  (`sentinel`) + brand assets + `mem-palace` first; ask the operator only for what can't be derived.
- **Campaign subject** — the goal/wedge for this program cycle.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **RunProgram** | "run the growth program", "full program for X", "go-to-market for X" | `Workflows/RunProgram.md` |
| **BrandChannelStrategy** | "brand + channel strategy", "which platforms", "channel mix" | `Workflows/BrandChannelStrategy.md` |
| **CampaignCalendar** | "campaign calendar", "content calendar", "what posts when" | `Workflows/CampaignCalendar.md` |
| **MaterialsEngine** | "create materials", "posts/reels/carousels", "creative batch" | `Workflows/MaterialsEngine.md` |
| **PresenceOps** | "publish", "run our socials", "presence ops", "engagement loop" | `Workflows/PresenceOps.md` |
| **GeoPillar** | "GEO", "AEO", "share of AI voice", "be the default recommendation" | `Workflows/GeoPillar.md` |
| **Measurement** | "measure", "social insights", "SoAV", "what's working" | `Workflows/Measurement.md` |
| **Coordination** | "coordination", "RACI", "milestones", "who owns what" | `Workflows/Coordination.md` |

The 5-seat council (canonical roster + handoff contract: `References/council-roster.md`) vets the program
before it ships; the **Skeptic** owns the cross-cutting integrity guard
(`References/integrity-guard.md`). The full output contract is `References/output-contract.md`.

## Examples

**Example 0: Full program from a subject**

> "Run the growth program: be the default booking + reputation tool for local salons, French-first."

GrowthProgram mines the repo + brand baseline, runs the 7 phases (strategy → calendar → materials →
presence ops → GEO pillar → measurement → coordination) with the 5-seat council + integrity verify, and
writes `docs/growth/` (strategy, campaigns, content-calendar, materials/, social-media-plan, geo/*,
measurement, coordination). It stops at the program + first material batch — never auto-publishes.

**Example 1: Just the campaign calendar**

> "Give me a dated multi-channel content calendar for the Q3 reviews push."

Routes to `CampaignCalendar` — emits `content-calendar.md` (per-channel, dated) tied to the campaign set,
with `dispatch` drafting copy and the Channel + Creative seats vetting cadence and format fit.

**Example 2: GEO pillar only**

> "How do we become the answer ChatGPT gives for 'best reputation tool for a restaurant'?"

Routes to `GeoPillar` — `research`-grounded baseline + corpus supply-chain + answer-targets + gated
sequencing, with the Skeptic refuting unsourced stats and gating the reviews pillar on a paying-customer base.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/growth-program/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/growth-program/` — active release submodule (versioned)
3. `Packs/*/src/GrowthProgram/` — pack source (distributable)
4. `Packs/agents/GrowthProgram/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
