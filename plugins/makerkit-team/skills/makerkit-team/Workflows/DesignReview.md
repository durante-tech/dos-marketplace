---
name: DesignReview
description: Council of UX, UI, and Architect agents that critiques an existing or proposed design and synthesizes a PROCEED/REVISE/REJECT verdict for the operator, without any implementation.
status: STABLE
bestPath:
  - title: "Pre-flight"
    description: "Run the capability probe and gather the target surface, question, and constraints from the operator."
  - title: "Council"
    description: "UX, UI, and Architect each write a one-page critique with a PROCEED/REVISE/REJECT verdict."
  - title: "Synthesis"
    description: "Orchestrator identifies agreement, disagreement, and per-role action items across the three critiques."
  - title: "Operator Decision"
    description: "Operator chooses to proceed to DeliverFeature, revise via a solo re-spawn, or reject and archive findings."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# DesignReview Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=DesignReview action_phrase=" to council the design" -->

Council of UX + UI + Architect to review an existing or proposed design without implementation.

## When to Use

- Operator has a design idea but isn't sure if it's right
- Existing surface needs critique before redesign
- Architecture decision needs multi-perspective input
- "Should we build this as X or Y?"

## Pipeline

### Phase 0 — Pre-flight
1. Preflight: `bun Tools/MakerkitCli.ts preflight` — emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding.
2. Operator provides: target surface (URL, file path, or description), the question, any constraints

### Phase 1 — Council (parallel: UX + UI + Architect)

**Pre-Delegation Contract:**
- UX owns: user flow critique, accessibility audit, journey gaps
- UI owns: visual hierarchy, component reuse, brand consistency
- Architect owns: package placement, technical feasibility, integration cost

Each agent writes a one-page critique with a clear verdict (PROCEED / REVISE / REJECT) and reasoning.

### Phase 2 — Synthesis

**Orchestrator (you, not an agent):** read all 3 critiques, identify:
- Where they agree → strong signal
- Where they disagree → operator decides
- Action items per role

### Phase 3 — Operator Decision

Operator chooses next move:
- Proceed → spawn `DeliverFeature` workflow
- Revise → re-spawn the relevant agent solo with revisions
- Reject → archive findings, no further action

## Intent-to-Flag Mapping

DesignReview's only bun-CLI invocation is fixed by design — Phase 0 always runs the same capability probe regardless of the target surface or question under review.

| Command | Input Contract | When It Fires |
|---------|-----------------|----------------|
| `bun Tools/MakerkitCli.ts preflight` | flags: `[--kit-repo <p>] [--roster <p>] [--skills-dir <p>] [--doctrine <p>]` (no stdin) | Phase 0 step 1 — capability manifest gate before the UX/UI/Architect council spawns; exit 1 STOPs the run |

## Output

`MEMORY/ARTIFACTS/design-review-<slug>.md` with the 3 critiques + synthesis + decision.
