---
name: Brand Script
description: 
status: STABLE
---

# BrandScript -- StoryBrand SB7 Foundation

Create a complete StoryBrand BrandScript -- the single-page strategic document that captures the brand's story and drives all marketing copy.

## When to Use

- User says "brandscript", "brand script", "storybrand"
- User wants to clarify their messaging foundation before generating artifacts
- User wants to define who their customer is and what story to tell

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Gather Minimum Context

The BrandScript requires at minimum:

| Input | Why | Example |
|-------|-----|---------|
| Who is your customer? | Character (Element 1) | "Small business owners with 2-20 employees" |
| What do they want? | Character's desire | "Consistent, qualified leads every month" |
| What's their biggest problem? | Problem (Element 2) | "Website doesn't generate leads" |
| How does that make them feel? | Internal problem | "Frustrated, wasting money, behind competitors" |
| What do you do? | Guide's solution | "We clarify messaging so customers find you" |
| How does working with you work? | Plan (Element 4) | "Book call => We build strategy => Watch leads grow" |
| What proof do you have? | Authority | "200+ businesses, 94% retention" |

Ask conversationally. Infer from existing project context where possible. Use the Read tool to check for existing brand materials in the project.

### Step 2: Build the Three-Level Problem

This is the most critical step. Most businesses know their external problem but haven't articulated internal or philosophical.

**External Problem** -- The tangible obstacle:
- What is the THING that's broken, missing, or wrong?
- Must be specific. "Website doesn't convert" not "marketing challenges"

**Internal Problem** -- The emotional frustration:
- Ask: "And how does that make them FEEL?"
- Common: frustrated, embarrassed, anxious, overwhelmed, invisible, behind, incompetent
- This is almost always the real purchase driver

**Philosophical Problem** -- The moral wrong:
- Ask: "Why is it WRONG that they have to deal with this?"
- Pattern: "People who [positive trait] deserve [better outcome]"
- Often the brand's mission in disguise

**The Villain** -- The root cause:
- Not a symptom (frustration) but the SOURCE (confusing technology, complexity, broken system)
- Must be relatable, singular, and real

### Step 3: Craft the Guide Positioning

**Empathy Statement:**
```
"We understand [INTERNAL PROBLEM]. You shouldn't have to [UNFAIR BURDEN]."
```

Test: Does the customer think "These people get me"?

**Authority Proof:**
Use 2-3 of these methods:
1. Testimonials (short, specific, transformation-focused)
2. Statistics ("We've helped N+ [customers]")
3. Awards / Certifications
4. Logo strips ("Trusted by...")

Test: Does the customer think "...and they can actually help me"?

**The Yoda Test:** Would this make the brand sound like Yoda (wise guide) or Superman (hero)? Must be Yoda.

### Step 4: Define the Plan

**Process Plan (required)** -- 3 steps, action-verb titles:
```
Step 1: [ACTION] -- What they do or you do first
Step 2: [ACTION] -- What happens next
Step 3: [OUTCOME] -- The result they get
```

Rules:
- Maximum 6 steps (3 is ideal)
- Must feel EASY and inevitable
- Can describe steps to purchase OR steps after purchase

**Agreement Plan (optional)** -- Your guarantee:
```
"We promise [GUARANTEE STATEMENT]."
```

### Step 5: Define CTAs

**Direct CTA** -- The sale:
- Strong verb + desired outcome
- "Schedule a Call" / "Start Free Trial" / "Get a Quote"

**Transitional CTA** -- The on-ramp:
- Lead magnet that captures fence-sitters
- Types: PDF guide, quiz, webinar, free trial, calculator, email course
- Title formula: [NUMBER] + [SPECIFIC OUTCOME] + [QUALIFIER]

### Step 6: Articulate Stakes

**Failure (brief -- salt, not the meal):**
- 1-2 sentences naming what they lose by not acting
- Immediately pivot to solution/hope
- Frame as "what you deserve" not "what you'll suffer"

**Success (vivid and specific):**
- External: What they'll HAVE (tangible result)
- Internal: How they'll FEEL (positive emotion)
- Philosophical: What it MEANS (rightful state)
- Transformation: "From [BEFORE] to [AFTER]"

### Step 7: Write the One-Liner

Draft 3 versions using these formulas:

```
A: "[CUSTOMER TYPE] struggle with [PROBLEM]. We [SOLUTION]. So they can [RESULT]."
B: "We help [CHARACTER] who [PROBLEM] [SOLUTION] so they can [RESULT]."
C: "[PROBLEM]. [SOLUTION]. [RESULT]."
```

Pick the best. Test: Can a stranger immediately understand what you do?

### Step 8: Compile and Write

Use the Write tool to save the complete BrandScript:

```markdown
# StoryBrand BrandScript -- [COMPANY NAME]

## Character
**Customer:** [WHO]
**Desire:** [WHAT THEY WANT]

## Problem
**Villain:** [ROOT CAUSE]
**External:** [TANGIBLE OBSTACLE]
**Internal:** [EMOTIONAL STATE]
**Philosophical:** [MORAL WRONG]

## Guide
**Empathy:** "[EMPATHY STATEMENT]"
**Authority:** [PROOF]

## Plan
1. [STEP 1]
2. [STEP 2]
3. [STEP 3]

**Guarantee:** [AGREEMENT PLAN if applicable]

## Call to Action
**Direct:** [PRIMARY CTA]
**Transitional:** [LEAD MAGNET]

## Failure
[COST OF INACTION -- 1-2 sentences]

## Success
**External:** [TANGIBLE RESULT]
**Internal:** [POSITIVE EMOTION]
**Philosophical:** [RIGHTFUL STATE]
**Transformation:** "From [BEFORE] to [AFTER]"

## One-Liner
> [FINAL ONE-LINER]

## Before/After Matrix
| Dimension | Before | After |
|-----------|--------|-------|
| Feeling | [Negative] | [Positive] |
| Average Day | [Pain] | [Ease] |
| What They Have | [Lack] | [Abundance] |
| Status | [Low] | [High] |
```

Save to `{project}/Docs/brand-messaging/brandscript.md` using the Write tool.

## Output

A complete StoryBrand BrandScript document -- the foundational asset from which all other communication materials are derived.