---
name: Quick Review
description: Runs a fast 30-60 second parallel review by the 3 core Dream Team experts (Conversion, Visual, Copy) for quick iteration or pre-launch sanity checks, escalating to the full Review workflow when disagreements are material.
status: STABLE
bestPath:
  - title: "Context Gathering"
    description: "Collect section structure, key copy, visual system summary, and conversion goal."
  - title: "Parallel Expert Review"
    description: "Spawn the 3 core experts (Conversion, Visual, Copy) via the Agent tool."
  - title: "Synthesis & Verdict"
    description: "Output agreements, action items, and a ship / iterate / needs-work verdict."
  - title: "Escalation"
    description: "Route to the full Dream Team Review workflow when disagreements are material."
---

# DreamTeam Quick Review

**Mode:** Fast 3-expert parallel review | **Time:** 30-60 seconds

## When to Use

- Quick iteration check after making changes
- Pre-launch sanity check
- "Does this feel right?" gut check with expert framing
- When time is limited but expert feedback is needed

## The 3 Core Experts

| Role | Personas | Focus |
|------|----------|-------|
| Conversion Strategist | Peep Laja + Oli Gardner | Does every element serve conversion? |
| Visual Designer | Katie Dill + Karri Saarinen | Is the visual execution world-class? |
| Copywriter | Joanna Wiebe + Eddie Shleyner | Does the copy persuade? |

## Execution

### Step 1: Gather Context

Same as full review but faster -- focus on:
- Section structure (names and order)
- Key copy (headlines, CTAs, subtitles)
- Visual system summary
- Conversion goal

### Step 2: Spawn 3 Experts

Use the **Agent tool** to run 3 expert tasks. Each expert gets 100-150 word target.

```
DREAM TEAM QUICK REVIEW

You are the [ROLE] channeling [EXPERTS].
Framework: [FRAMEWORK]

CONVERSION GOAL: [goal]
PAGE: [condensed digest]

In 100-150 words:
- Top issue from your lens
- One strength to protect
- One specific recommendation
- Confidence: low / medium / high

Be critical. Reference specific sections. Return only your perspective.
```

### Step 3: Output

```markdown
## Quick Review: [Page]

**Conversion:** [take]
**Visual:** [take]
**Copy:** [take]

### Agreements
[Where 2+ experts converge]

### Action Items
[1-3 specific changes, ranked by impact]

### Verdict
[Ship it / One more pass / Needs work]
```

## Escalation

If disagreements are material or the verdict is "Needs work":
```
Escalating to full dream team review for deeper analysis.
```