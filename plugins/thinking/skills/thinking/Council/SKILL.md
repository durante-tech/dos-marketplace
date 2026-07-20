---
name: Council
description: Multi-agent debate with visible transcripts where agents respond to each other. USE WHEN council, debate, perspectives, weigh options, deliberate, multiple viewpoints, council with [name], council with fowler, council with uncle bob, council with kent beck, council with sandi metz, council with eric evans, council with greg young, council with cockburn, council with feathers, council with pragmatic, council debate including, multi-specialist debate. Recruits voice-channeling specialists (Fowler, UncleBob, KentBeck, SandiMetz, EricEvans, GregYoung, Cockburn, Feathers, Pragmatic) as Specialist Seats when ≥2 are named together. Unlike RedTeam (adversarial), Council is collaborative-adversarial.
role: thinker
accepts:
  - text
roots:
  - INSTALL.LEARNING
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Council/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Council Skill

Multi-agent debate system where specialized agents discuss topics in rounds, respond to each other's points, and surface insights through intellectual friction.

**Key Differentiator from RedTeam:** Council is collaborative-adversarial (debate to find best path), while RedTeam is purely adversarial (attack the idea). Council produces visible conversation transcripts; RedTeam produces steelman + counter-argument. Council also OWNS person/seat language — *multiple viewpoints, perspectives, voices debating*; IterativeDepth owns *multi-lens* (one analyst, many lenses). The two are partitioned by agency (many agents vs. one analyst), not by collision.

## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **Council** skill to ACTION...
```

| Trigger | Workflow |
|---------|----------|
| Full structured debate (3 rounds, visible transcript) | `Workflows/Debate.md` |
| Quick consensus check (1 round, fast) | `Workflows/Quick.md` |
| Pure adversarial analysis | RedTeam skill |

## Quick Reference

| Workflow | Purpose | Rounds | Output |
|----------|---------|--------|--------|
| **DEBATE** | Full structured discussion | 3 | Complete transcript + synthesis |
| **QUICK** | Fast perspective check | 1 | Initial positions only |

## Context Files

| File | Content |
|------|---------|
| `CouncilMembers.md` | Agent roles, perspectives, voice mapping, **Specialist Seats roster** |
| `RoundStructure.md` | Three-round debate structure and timing |
| `OutputFormat.md` | Transcript format templates |

## Core Philosophy

**Origin:** Best decisions emerge from diverse perspectives challenging each other. Not just collecting opinions - genuine intellectual friction where experts respond to each other's actual points.

**Speed:** Parallel execution within rounds, sequential between rounds. A 3-round debate of 4 agents = 12 agent calls but only 3 sequential waits. Complete in 30-90 seconds.

## Examples

```
"Council: Should we use WebSockets or SSE?"
-> Invokes DEBATE workflow -> 3-round transcript (default trait-composed seats)

"Quick council check: Is this API design reasonable?"
-> Invokes QUICK workflow -> Fast perspectives

"Council with security: Evaluate this auth approach"
-> DEBATE with Security agent added

"Council with Fowler, UncleBob, and KentBeck on event sourcing"
-> DEBATE with 3 Specialist Seats — each spawned agent receives the
   specialist's pack SKILL.md + QuoteBank as system prompt; 3-round
   debate channels each author's voice (see CouncilMembers.md)

"Council with Architect, Engineer, and Cockburn on hexagonal refactor"
-> Mixed council — 2 trait-composed seats + 1 specialist seat
```

## Integration

**Works well with:**
- **RedTeam** - Pure adversarial attack after collaborative discussion
- **Development** - Before major architectural decisions
- **Research** - **MANDATORY** Round 0 evidence gathering when the motion contains external verifiable claims (named libraries, statistics, dates, proper nouns). See `Workflows/Debate.md` § Step 1b. Routes to Research's `DocsLookup` (lib/SDK docs via Ref) / `QuickResearch` (general web) / `StandardResearch` (multi-perspective) per claim type. Skipped silently when motion is purely internal/taste.

## Best Practices

1. Use QUICK for sanity checks, DEBATE for important decisions
2. Add domain-specific experts as needed (security for auth, etc.)
3. Review the transcript - insights are in the responses, not just positions
4. Trust multi-agent convergence when it occurs

---

**Last Updated:** 2025-12-20
