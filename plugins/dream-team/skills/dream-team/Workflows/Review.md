---
name: Review
description: Runs the full 7-expert Dream Team parallel review (or a debate-mode upgrade) over a page's context digest, synthesizing unanimous agreements, key tensions, and prioritized recommendations.
status: STABLE
bestPath:
  - title: "Context Digest"
    description: "Read page source, copy, visual effects inventory, and the conversion goal."
  - title: "Mode Selection"
    description: "Choose default parallel review or the debate-mode upgrade via the thinking pack."
  - title: "Expert Fan-Out"
    description: "Spawn the 7 named experts in parallel via the Agent tool."
  - title: "Synthesis"
    description: "Extract unanimous agreements, key tensions, and prioritized recommendations."
---

# DreamTeam Review

**Mode:** Full 7-expert parallel review | **Time:** 60-120 seconds

## When to Use

- Major page review before launch
- Post-iteration quality check
- Competitive positioning analysis
- Structural redesign planning
- Any time you need the full spectrum of expert perspectives

## Parameters

- **lens** (optional): `conversion` | `differentiation` | `density` | `coherence` | `narrative`
  - If no lens specified, each expert uses their default analytical lens
  - If lens specified, all experts focus on that specific question through their unique perspective

## Execution

### Step 1: Gather Page Context

Read the actual page source and copy. Build a structured digest:

```
1. Read page.tsx (or equivalent) -- capture section structure, components, layout
2. Read translation/copy files -- capture all user-facing text
3. Inventory visual effects -- list all animation systems, 3D elements, effects
4. Identify conversion goal -- what CTA, where does it link
5. Note stage -- pre-traction, growth, established
```

The context digest MUST include:
- Ordered section list with headings and copy snippets
- All CTA instances with text and destination
- Complete visual effects inventory (every animation, 3D element, overlay)
- Translation call count and JSX line count (density metrics)

### Step 2: Choose Mode — Parallel Review (default) or Debate (upgrade)

**Default — parallel review:** spawn 7 raw expert Tasks (continue to Step 2a below). Fast (60-120s), no cross-talk between experts, synthesis happens at Step 3.

**Upgrade — debate mode:** when the operator invokes `/dreamteam --debate`, or the lens is `coherence` / `narrative` with material expected disagreement, or the user explicitly authorizes deeper analysis, route to the thinking pack's Council/Debate workflow instead. This trades wall-clock (~30-120s extra) for 3-round structured challenge-and-response with visible transcript.

```ts
// Debate-mode upgrade — invoke Thinking's Council/Debate workflow
Skill({
  skill: "Thinking",
  args: "Run the Council/Debate workflow. Topic: 'DreamTeam review of [page name] — conversion goal: [goal], stage: [stage], lens: [lens or default]'. Council seats (mixed — trait-composed): Conversion Strategist (sales,analytical,thorough), Visual Designer (creative,pragmatic,systematic), Copywriter (creative,analytical,thorough), Motion Designer (creative,pragmatic,parallel), 3D/Visual Artist (creative,enthusiastic,parallel), Brand Strategist (brand,analytical,thorough), Technical Architect (technical,analytical,thorough). Pass the full page context digest from Step 1 as the debate motion. Return: the full 3-round transcript + Council Synthesis section."
})
```

When debate-mode is chosen, skip Steps 2a and 3 of THIS workflow — Thinking's Debate workflow handles round orchestration and synthesis itself. The Council Synthesis block becomes the DreamTeam review output.

### Step 2a: Spawn 7 Experts in Parallel (default mode)

Use the **Agent tool** to run 7 expert tasks in parallel. Each expert gets:
1. Their persona and named framework (from SKILL.md)
2. The full page context digest
3. The conversion goal
4. The stage (pre-traction/growth/established)
5. The lens (if specified), otherwise their default analytical lens

**Task template for each expert:**

```
DREAM TEAM REVIEW

You are the [ROLE] channeling [EXPERT NAMES].

Your framework: [SPECIFIC FRAMEWORK DESCRIPTION]

Your analytical lens: [DEFAULT LENS or CUSTOM LENS]

CONVERSION GOAL: [goal]
STAGE: [stage]

ACTUAL PAGE CONTENT:
[full context digest]

Provide in 150-250 words:
1. TOP ISSUE -- The #1 problem from your lens
2. STRENGTH -- What's working well (be specific)
3. TOP 3 RECOMMENDATIONS -- Specific, actionable changes (reference sections/copy by name)
4. CONFIDENCE -- low / medium / high

Be CRITICAL. Reference specific sections and copy by name.
Do not simulate other experts. Return only your own perspective.
```

**Expert assignments:**
| Role | Personas |
|------|----------|
| Conversion Strategist | Peep Laja + Oli Gardner |
| Visual Designer | Katie Dill + Karri Saarinen |
| Copywriter | Joanna Wiebe + Eddie Shleyner |
| Motion Designer | Felix Peault + Jesper Landberg |
| 3D/Visual Artist | Bruno Simon + Peter Tarka |
| Brand Strategist | Emily Heyward + Marty Neumeier |
| Technical Architect | (feasibility lens) |

### Step 3: Synthesize

Format the output as:

```markdown
## Dream Team Review: [Page Name]

### Expert Perspectives

**Conversion (Peep Laja / Oli Gardner):**
[response]

**Visual (Katie Dill / Karri Saarinen):**
[response]

**Copy (Joanna Wiebe / Eddie Shleyner):**
[response]

**Motion (Felix Peault / Jesper Landberg):**
[response]

**3D (Bruno Simon / Peter Tarka):**
[response]

**Brand (Emily Heyward / Marty Neumeier):**
[response]

**Architect:**
[response]

### Unanimous Agreements
[Points where 3+ experts independently converge]

### Key Tensions
[Points where experts materially disagree]

### Prioritized Recommendations
| # | Change | Source | Impact | Effort |
|---|--------|--------|--------|--------|
[ranked by impact x unanimity]

### Recommendation
[Proceed / Iterate / Major rework needed]
```

## Validation

- [ ] All 7 experts run via Agent tool
- [ ] Each response references specific page sections/copy by name
- [ ] Each response includes at least 1 actionable recommendation
- [ ] Synthesis identifies genuine agreements (not forced consensus)
- [ ] Tensions are acknowledged, not smoothed over
- [ ] Recommendations are prioritized by impact x unanimity

## Escalation

If the review surfaces material disagreements requiring debate:
```
This review has tensions that need resolution.
Run: "council debate: [specific tension]" for structured challenge-and-response.
```