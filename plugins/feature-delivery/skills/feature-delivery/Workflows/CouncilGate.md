---
name: Council Gate
description: Run a multi-agent council debate at plan or ship decision gates and synthesize perspectives into a PROCEED/MODIFY/REJECT verdict.
status: STABLE
bestPath:
  - title: "Gate Selection"
    description: "Determine gate type (plan/review) and debate depth (skip/quick/full) from the feature tier."
  - title: "Context Preparation"
    description: "Gather the spec, diff, or test results the council needs for this gate."
  - title: "Council Debate Execution"
    description: "Run the debate via Thinking's Council/Debate machinery, or compose agents directly for quick 1-round gates."
  - title: "Synthesis"
    description: "Combine all agent responses into a single consensus verdict with recommendations."
  - title: "User Presentation"
    description: "Present the synthesis to the user, who has final say on proceeding."
---

# Council Gate

**Purpose:** Multi-agent review at pipeline decision points.

## When to Use

- Before building (plan gate) on medium/complex features
- Before shipping (review gate) on complex features
- When the user asks for a council review at any point

## Gate Types

### Plan Gate (before BUILD)
**Question:** "Should we proceed with this implementation plan?"
**Default council:** architect, engineer, designer, researcher
**Auto-add:** pentester (if spec mentions auth/RBAC/tokens), additional engineer (if unusually complex)

### Review Gate (before SHIP)
**Question:** "Is this implementation ready to ship?"
**Default council:** architect, engineer
**Auto-add:** pentester (if touches auth/data/APIs)

## Debate Depth by Tier

| Gate | Simple | Medium | Complex |
|------|--------|--------|---------|
| Plan | Skip | Quick (1 round) | Full debate (3 rounds) |
| Review | Skip | Quick (1 round) | Full debate (3 rounds) |

## Steps

### Step 1: Determine Gate Type and Depth

Based on the pipeline phase and feature tier, select:
- Gate type: plan or review
- Debate depth: skip, quick (1 round), or full (3 rounds)

### Step 2: Prepare Context

Gather the material each council member needs:
- **Plan gate:** The implementation spec, project structure, relevant existing code
- **Review gate:** The git diff, spec (for comparison), test results

Use the Read and Bash tools to collect this context.

### Step 3: Compose and Execute Council Debate

**Primary path — delegate to Thinking's Council/Debate (full gates, 3-round debate):**

For Plan and Review gates on complex features (full debate depth), route the entire gate through Thinking's structured debate machinery rather than hand-composing agents here. Thinking handles trait composition, 3-round transcript, and synthesis end-to-end:

```ts
Task({
  subagent_type: "general-purpose",
  description: "Feature gate council debate",
  prompt: `Invoke the thinking skill, Council/Debate workflow (3 rounds, full debate).

GATE TYPE: <plan | review>
FEATURE TIER: <medium | complex>

QUESTION FOR COUNCIL:
<"Should we proceed with this implementation plan?" OR "Is this implementation ready to ship?">

CONTEXT BUNDLE (gathered in Step 2):
- Implementation spec / git diff: <inline or path>
- Project structure summary: <inline>
- Relevant existing code or test results: <inline or path>
- Auto-add triggers detected: <pentester if auth/RBAC/tokens; extra engineer if unusually complex>

DEFAULT COUNCIL ROSTER for feature gates:
- Architect (traits: technical,analytical,thorough)
- Engineer (traits: technical,pragmatic,rapid)
- Critic (traits: security,contrarian,investigative)
- Pentester (traits: security,skeptical,investigative) — include only if auth/data/APIs touched

Return: per-round transcript, final synthesis, and a single Consensus verdict (PROCEED / MODIFY / REJECT) with reasoning.`
})
```

**Fallback path — short consensus (quick 1-round debate):**

When depth is QUICK (1 round, medium-tier features) and the gate question is narrow enough that the trait-composition overhead would dominate, compose agents directly from traits and skip Thinking delegation. Run `bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "<traits>" --output json` for each council member and use the returned `prompt` as the agent system prompt with `subagent_type: "general-purpose"`.

**Default compositions for feature gates:**

| Role | Traits |
|------|--------|
| architect | `technical,analytical,thorough` |
| engineer | `technical,pragmatic,rapid` |
| Critic | `security,contrarian,investigative` |
| Pentester | `security,skeptical,investigative` |

Adapt traits to the feature context — a billing feature gate might add `sales,pragmatic,thorough` instead of a designer.

```
Each agent evaluates from their composed perspective and returns:
- Assessment: approve / concerns / reject
- Reasoning: 2-3 key points
- Recommendations: specific suggestions if any
```

**Quick debate (1 round):** All agents respond once. Synthesize.

**Full debate (3 rounds):**
- Round 1: Initial positions from all agents
- Round 2: Agents respond to each other's concerns
- Round 3: Final positions with synthesis

### Step 4: Synthesize

Combine all agent responses into a synthesis:

```
Council Gate: [PLAN / REVIEW]
Tier: [SIMPLE / MEDIUM / COMPLEX]
Depth: [QUICK / FULL]

Consensus: [PROCEED / MODIFY / REJECT]

Perspectives:
- Architect: [Assessment] -- [Key point]
- Engineer: [Assessment] -- [Key point]
- Designer: [Assessment] -- [Key point]
- Pentester: [Assessment] -- [Key point] (if included)

Recommendations:
1. [Specific recommendation]
2. [Specific recommendation]

Decision needed: [What the user should decide]
```

### Step 5: Present to User

**User always has final say** -- the council advises, the human decides.

- If modifications recommended: suggest spec updates
- If rejection recommended: present concerns clearly
- If approved: proceed to next pipeline phase

## Validation

- [ ] Correct gate type used (plan vs review)
- [ ] Debate depth matches tier
- [ ] All relevant perspectives included
- [ ] Synthesis presented to user
- [ ] User decision recorded before proceeding