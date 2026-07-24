---
name: Thinking
description: Multi-mode analytical and creative thinking — first principles decomposition, iterative depth analysis, creative brainstorming, multi-agent council debates, adversarial red teaming, world threat modeling, and scientific hypothesis testing. USE WHEN first principles, decompose, reconstruct, iterative depth, multi-angle, be creative, brainstorm, divergent ideas, tree of thoughts, council, debate, deliberate, red team, attack idea, devil's advocate, threat model, world model, future analysis, time horizon, hypothesis, design experiment, define goal, structured investigation, quick diagnosis, full cycle. Ambiguous intent (test-idea, stress-test) is partitioned by axis in the Workflow-Routing table's decision list — the router disambiguates rather than pre-claiming.
role: thinker
accepts:
  - text
icon: Brain
colorVar: tertiary
colorHex: "#ffb95a"
tier: primary
category: Thinking
displayLabel: Thinking
marketingDescription: "7 thinking modes: first principles, council debates, red teaming, threat modeling."
capabilities:
  - customization.cascade
  - four-copy.sync
elevator: "7 modes: first principles, council, red team, threat modeling"
highlightWorkflows:
  - name: First Principles
    technicalName: FirstPrinciples
  - name: Council Debate
    technicalName: CouncilDebate
  - name: Red Team
    technicalName: RedTeam
roots:
  - INSTALL.LEARNING
visibility: public
feature_capabilities:
  - Adversarial red teaming
  - First principles decomposition
  - Multi-agent council debates
  - Scientific hypothesis testing
  - World threat modeling
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# Thinking

Unified skill for all analytical and creative thinking modes.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Thinking/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

**Sub-component routing:** references to `<Sub>/SKILL.md` in this skill are FILE PATHS relative to this skill's directory — load them with the Read tool and follow their instructions. Sub-components (Council/, RedTeam/, Science/, FirstPrinciples/, IterativeDepth/, BeCreative/, WorldThreatModelHarness/) are NOT separately registered skills: never invoke `Skill("thinking:<Component>")` — it fails with "Unknown skill".

> **Lineage:** All modes below are specializations of the Science cycle OBSERVE→HYPOTHESIZE→EXPERIMENT→ANALYZE→ITERATE (see `Science/Protocol.md`). The cycle is the substrate they embody — not a router peer that out-competes them.

**One phrase, one owner.** Every trigger below is owned by exactly one mode. The two genuinely ambiguous intents — *test-idea* and *stress-test* — are partitioned by axis and resolved by the decision list, never claimed by two rows.

| Request Pattern | Route To | Disambiguate when ambiguous |
|---|---|---|
| First principles, decompose, challenge assumptions/constraints, rebuild from scratch | `FirstPrinciples/SKILL.md` | — |
| Iterative depth, deep exploration, multi-angle/multi-lens analysis, structured passes, surface hidden requirements | `IterativeDepth/SKILL.md` | — |
| Be creative, brainstorm, divergent ideas, idea generation, tree of thoughts | `BeCreative/SKILL.md` | — |
| Council, debate, perspectives, weigh options, deliberate, multiple viewpoints (voices/seats debating) | `Council/SKILL.md` | — |
| Red team, attack idea, attack this idea, counterarguments, critique, devil's advocate, stress-test an argument/plan/claim | `RedTeam/SKILL.md` | **stress-test** → argument/plan/claim (fatal flaws now) lands here; "against the future" → WTM |
| Threat model, world model, test idea, future analysis, test investment, time horizons, stress-test against the future | `WorldThreatModelHarness/SKILL.md` | **test-idea** → temporal/horizon/investment lands here; **stress-test** → time-referent lands here |
| Hypothesis, define goal, design experiment, measure results, analyze results, quick diagnosis, structured investigation, full cycle | `Science/SKILL.md` | — |

**When two modes both match (axis tie-break):**

- **test idea** → temporal / horizon / investment lens → `WorldThreatModelHarness` (owns the literal TestIdea workflow); empirical / experiment / measure → `Science`; attack / find-flaws → `RedTeam` (phrase it "attack this idea").
- **stress test** → time-referent ("against the future", "across horizons") → `WorldThreatModelHarness`; argument / plan / claim (find fatal flaws now) → `RedTeam`.

**Precedence — Science is evaluated LAST and most-narrowly.** Science is the methodological substrate the other six modes embody (see `Science/Protocol.md`), not a catch-all. Route to it only on explicit experiment-design language; vague intent ("think about", "figure out", "improve") goes to the decision list above, never defaults to Science.

## Examples

**Example 1: First principles decomposition of a hard problem**
```
User: "Apply first principles to why our onboarding conversion is stuck at 12%"
→ Routes to FirstPrinciples/SKILL.md
→ Decomposes the problem into atomic assumptions, challenges each one, rebuilds a model of conversion from the ground up
→ User gets a list of which assumptions are load-bearing vs. inherited cargo-cult plus a rebuilt hypothesis tree
```

**Example 2: Council debate across multiple expert perspectives**
```
User: "Council debate: should we migrate from Postgres to Aurora DSQL for our SaaS?"
→ Routes to Council/SKILL.md
→ Convenes a 3-round debate with named perspectives (e.g., DBA, FinOps, Architect), each round refining positions against opponents
→ User gets a written transcript, areas of consensus, remaining disagreement, and a final synthesis recommendation
```

**Example 3: Red team an investment thesis**
```
User: "Red team my pitch deck thesis that AI compliance is a $10B market by 2028"
→ Routes to RedTeam/SKILL.md
→ Generates adversarial counterarguments, stress-tests the market sizing math, hunts for hidden assumptions
→ User gets a critique report ranked by severity with each weakness paired to a suggested defense or pivot
```

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/thinking/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/thinking/` — active release submodule (versioned)
3. `Packs/*/src/Thinking/` — pack source (distributable)
4. `Packs/agents/Thinking/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
