---
name: Enhance
description: Improve existing investor documents across storytelling, data presentation, and competitive positioning, producing an enhancement summary with a change log.
status: STABLE
bestPath:
  - title: "Materials Assessment"
    description: "Read existing docs and identify the weakest areas across 5 enhancement dimensions."
  - title: "Storytelling & Data Enhancement"
    description: "Strengthen the narrative arc and replace vague claims with sourced, specific data."
  - title: "Positioning Sharpening"
    description: "Replace feature-checklist comparisons with strategic moat analysis per competitor."
  - title: "VC Perspective Review"
    description: "Critique the materials from a VC partner's point of view — what would make them lean forward or pass."
  - title: "Enhancement Delivery"
    description: "Produce enhanced documents plus a change log of storytelling, data, and positioning improvements."
---

# Enhance -- Investor Document Improvement

## When to Use

- User has existing investor docs that need improvement
- After Scan or GapAnalysis identified specific weaknesses
- User says "improve my pitch deck", "strengthen my exec summary", "make my docs investor-ready"
- Before important investor meetings to sharpen materials

## Workflow

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Read and Assess Current Materials

Read all existing investor documents. Identify the weakest areas across 5 enhancement dimensions:

| Dimension | What to Look For | Common Problems |
|-----------|-----------------|-----------------|
| Storytelling arc | Problem-solution-traction-vision flow | Jumping straight to solution without establishing pain |
| Data presentation | Numbers, charts, metrics | Vague claims without data, no trend lines |
| Competitive positioning | Differentiation clarity | Feature checklist instead of strategic moat analysis |
| Financial rigor | Projection assumptions | Hockey-stick revenue with no justification |
| Investor psychology | Objection preemption | Not addressing obvious risks proactively |

### Step 2: Storytelling Arc Enhancement

The strongest investor narratives follow: **Pain -> Failed Alternatives -> Insight -> Solution -> Proof -> Vision**

**Pitch Deck Arc:**
- Slide 1-2: Pain must be visceral, not abstract ("Companies lose $X per year" not "Efficiency is important")
- Slide 3: Why existing solutions fail (name specific competitors and their limitations)
- Slide 4: The insight that makes your approach different (the "aha moment")
- Slide 5-6: Solution shown through the user's eyes, not feature lists
- Slide 7-8: Proof via metrics, not promises (revenue, growth rate, retention)
- Slide 9-10: Vision of the category you're creating, not just the product you're building

**Executive Summary Arc:**
- Paragraph 1: Hook with the biggest proof point or market insight
- Paragraph 2-3: Problem framing with data (market size of the pain)
- Paragraph 4: Solution and why now (timing + unique insight)
- Paragraph 5: Traction proof (specific numbers with trajectory)
- Paragraph 6: Team-problem fit (why this team solves this problem)
- Paragraph 7: The ask and what it unlocks

### Step 3: Data Presentation Enhancement

Apply these specific techniques to strengthen every data claim:

| Weak Pattern | Strong Pattern | Example |
|-------------|---------------|---------|
| "Large market" | "[$X]B market growing [Y]% CAGR (Source)" | "$47B market growing 23% CAGR (Gartner 2024)" |
| "Strong growth" | "[X]% MoM growth over [N] months" | "34% MoM revenue growth over 8 months" |
| "Good retention" | "[X]% [timeframe] retention vs [Y]% industry avg" | "87% 6-month retention vs 43% industry average" |
| "Many users" | "[X] users, [Y] DAU, [Z]% WAU/MAU" | "12K users, 3.2K DAU, 68% WAU/MAU ratio" |
| "Revenue growing" | "$[X] ARR, [Y]x YoY, [Z]% net revenue retention" | "$1.2M ARR, 4.2x YoY, 130% NRR" |

For missing data, flag it explicitly:
```
[DATA NEEDED: Insert actual [metric] here. If unavailable, explain proxy metric or timeline to achieve.]
```

### Step 4: Competitive Positioning Sharpening

Replace generic feature comparison tables with strategic positioning:

**Weak:** Feature checklist ("We have X, competitor doesn't")
**Strong:** Strategic moat analysis showing WHY you win, not just WHERE you differ

Framework for each competitor:
- **Their strength:** What they do well -- be honest
- **Their structural limitation:** What they CAN'T do because of their architecture/business model/incentives
- **Our advantage:** Why our approach is fundamentally better for the target customer
- **Switching trigger:** What event causes their customer to look for alternatives

### Step 5: VC Perspective Review

Review the materials from a VC partner's perspective:
1. Top 3 things that would make you lean forward (strengths to emphasize more)
2. Top 3 things that would make you pass (weaknesses to fix immediately)
3. The single question you'd ask in a partner meeting that the deck doesn't answer
4. Specific sentence-level rewrites for the weakest 3 claims
5. What's missing that every funded company at this stage includes?

### Step 6: Apply Enhancements and Deliver

Produce enhanced versions of each document. Include a change log:

```markdown
# Enhancement Summary: [Company] Investor Materials

## Documents Enhanced
| Document | Changes | Impact |
|----------|---------|--------|

## Storytelling Changes
- [Before -> After for key narrative elements]

## Data Improvements
- [Claims strengthened with specific numbers]

## Positioning Changes
- [Competitive framing improvements]

## Remaining Gaps
- [Issues that need user input to resolve]
```

## Validation

- [ ] Storytelling arc improved
- [ ] Data claims strengthened with specifics
- [ ] Competitive positioning sharpened
- [ ] VC perspective review completed
- [ ] Enhancement summary delivered