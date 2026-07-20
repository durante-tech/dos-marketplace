---
name: Section Review
description: Runs the battle-tested 3-expert (Conversion, Visual, Copy) section-by-section Dream Team review, extracts unanimous agreements, implements the changes, and commits before moving to the next section.
status: STABLE
bestPath:
  - title: "Section Read"
    description: "Read the section's JSX, translation keys, child components, and component inventory."
  - title: "Context Digest"
    description: "Assemble section context plus the available-but-unused component inventory for experts."
  - title: "Core Trio Review"
    description: "Spawn the Conversion, Visual, and Copy experts in parallel via the Agent tool."
  - title: "Implementation"
    description: "Apply unanimous changes and run healthcheck (lint + format + typecheck)."
  - title: "Commit & Iterate"
    description: "Re-review on principal feedback if needed, then commit and move to the next section."
---

# DreamTeam Section-by-Section Review

**Mode:** 3 experts per section, iterative | **Time:** 5-15 min per section
**This is the PROVEN workflow.** Battle-tested across 9 sections with measurable results.

## When to Use

- Iterating on existing pages section by section
- When the principal says "let's improve this" and points at a specific area
- Post-build polish passes
- When you have screenshots showing real issues

## Why 3 Experts, Not 7

Full 7-expert reviews generate too many competing recommendations. The **core trio** (Conversion + Visual + Copy) covers 90% of actionable feedback:

| Expert | Why Core |
|--------|----------|
| Conversion Strategist | Is this element helping or hurting conversion? |
| Visual Designer | Does this match Stripe/Linear caliber? What components to use? |
| Copywriter | Is the copy persuading? Is it too long? |

Add the other 4 experts only when the section specifically needs them:
- **Motion:** Only for animation-heavy sections
- **3D:** Only for sections with WebGL/R3F
- **Brand:** Only for hero, final CTA, or brand identity sections
- **Architect:** Only when feasibility is uncertain

## Execution

### Step 1: Read the Section

Read the actual JSX for ONLY the section being reviewed. Also read:
- Translation keys used in that section
- Any child components rendered in that section
- The component inventory (what's available but not yet used)

### Step 2: Build Context Digest

For each expert, provide:

```
SECTION CONTEXT:
- What section (number and name)
- What it currently looks like (structure, elements, components used)
- The actual copy (translation values, not keys)
- What's ABOVE this section (narrative context)
- What's BELOW this section (what follows)

COMPONENT INVENTORY (available but not yet used here):
[list specific components that could apply to this section]

ECOSYSTEM CONTEXT (if relevant):
[product facts that inform the content: skills count, agent count, etc.]
```

**CRITICAL:** Include the component inventory. Experts make specific, actionable recommendations when they know what tools exist. Without it, they give abstract advice.

### Step 3: Spawn 3 Experts via Agent Tool

Use the **Agent tool** to run the core trio in parallel. Each expert gets:

```
DREAM TEAM -- [SECTION NAME] REVIEW

You are the [ROLE] ([EXPERT NAMES]).

CURRENT STATE:
[section structure, elements, copy]

AVAILABLE COMPONENTS NOT YET USED:
[specific list relevant to this section]

In 100-150 words:
1. TOP ISSUE from your lens
2. STRENGTH to protect
3. TOP 3 RECOMMENDATIONS (name specific components + where to use them)
4. CONFIDENCE

Be CRITICAL. Reference specific elements. Propose component usage.
```

**Word count enforcement:** 100-150 words per expert. This prevents rambling.

### Step 4: Synthesize Unanimous Agreements

From the 3 responses, extract:
- **Unanimous:** All 3 agree -- implement immediately
- **Majority:** 2 of 3 agree -- implement with caution
- **Solo:** Only 1 recommends -- flag for human decision

### Step 5: Implement

Apply unanimous changes. Then run healthcheck:
```bash
pnpm healthcheck  # lint + format + typecheck
```

### Step 6: Re-review if Needed

If the principal flags issues after implementation (common!), run a **focused re-review** with just the relevant expert(s). The re-review is often where the best improvements happen.

```
The principal says: "the cards are still meh, 3 out of 10"
-> Spawn ONLY the designer with a focused brief via Agent tool
-> Get specific component treatment proposal
-> Implement the redesign
```

### Step 7: Commit and Move On

```
feat([section]): dream team [section] -- [summary]

[list unanimous changes]
[list components added]
[list components removed]
```

## Proven Patterns from Real Sessions

### The Asymmetric Treatment
For before/after or comparison elements, use **different visual energy** on each side:
- **Problem side:** Tilt high (10 deg), fast BorderTrail (4s), aggressive MagicCard spotlight, warm/red tints
- **Solution side:** Tilt subtle (4 deg), slow BorderTrail (8s), gentle MagicCard spotlight, cool/emerald tints
- This creates emotional contrast through interaction physics, not just color

### The Component Upgrade Path
When a section feels "template-y", the typical upgrade path is:
1. **MagicCard** -- adds cursor-following depth (biggest single improvement)
2. **BorderTrail** -- adds animated edge trace (draws focus)
3. **Tilt** -- adds perspective hover (spatial engagement)
4. **Magnetic** -- on CTAs only (micro-interaction reward)
5. **InfiniteSlider + ProgressiveBlur** -- for logo/brand bars

### The Copy Tightening Rule
- Hero subtitle: <=15 words
- Section subtitle: <=20 words
- Value points: <=12 words each
- Body paragraphs: <=2 sentences
- If it's body copy, it's text-base (16px). If it's a label, it's text-sm.

### The Section Trim Checklist
Before reviewing, count:
- Text elements in section (target: <=8)
- Animation systems used (target: <=3 per section)
- Competing focal points (target: 1)

## Validation

- [ ] Only 3 experts spawned (core trio) unless section-specific need
- [ ] Component inventory provided to each expert
- [ ] Each response <=150 words
- [ ] Unanimous agreements extracted and listed
- [ ] Changes implemented and healthcheck passing
- [ ] Principal given opportunity to re-review before moving on