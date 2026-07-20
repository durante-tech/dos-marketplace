---
name: Comparisons
description: 
status: STABLE
---

# Illustrated Dichotomies & Comparisons Workflow

**Drafted technical side-by-side visual comparisons using brand aesthetic.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Comparisons workflow in the Art skill to create side-by-side visuals"
```

Running **Comparisons** in **Art**...

---

Creates **VISUAL COMPARISONS** — "X vs Y" split compositions, before/after transformations, and illustrated contrasts with editorial style.

---

## Purpose

Illustrated comparisons show two contrasting concepts, states, or approaches side-by-side. These are **visual dichotomies** that make differences immediately obvious through illustrated metaphor.

**Use this workflow for:**
- "X vs Y" comparisons
- Before/After transformations
- This/That contrasts
- Junior vs Senior behaviors
- Old way vs New way
- Opposite approaches

---

## Visual Aesthetic: Split Screen Editorial

**Think:** Magazine spread showing contrast, split composition with personality

### Core Characteristics
1. **Split composition** — Clear left/right or top/bottom division
2. **Mirror structure** — Parallel visual elements showing contrast
3. **Drafted technical** — Both sides maintain editorial measured linework
4. **Color differentiation** — Orange for one side, navy for other (or both black)
5. **Immediate contrast** — Differences obvious at a glance
6. **Editorial style** — Flat colors, black linework, brand aesthetic
7. **Balanced layout** — Equal visual weight to both sides

### Character Requirements (When figures present)

**If comparison includes human or robot figures, MUST apply Planeform aesthetic:**
- Read: `~/.claude/DOS/Aesthetic.md`
- Figures built from ANGULAR PLANES (no round forms)
- Adult proportions (1:7), NOT cute/stubby
- Faces are minimal geometric blocks
- Emotion through gesture/silhouette
- Constructivist/Bauhaus influence
- NOT cartoonish (sophisticated editorial)

---

## Color System for Comparisons

### Split Differentiation
```
Left/Top Side: Hot Accent Orange #F97316 accents
Right/Bottom Side: Blueprint Navy #1E3A8A accents
OR
Both sides: Black with strategic orange/navy highlights
```

### Structure
```
Black #000000 — Dividing line, all linework on both sides
Blueprint Navy #1E3A8A — All text and labels
```

### Background
```
White #FFFFFF or Warm-White Paper #FEF7E0 on both sides
OR
Left: Hot Accent Orange tint, Right: Blueprint Navy tint (very subtle)
```

### Color Strategy
- Option 1: Orange accents left, Navy accents right (clear differentiation)
- Option 2: Both black linework, orange on "preferred" side
- Dividing line always black
- Maintain flat aesthetic, no gradients

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Comparison

**Identify what you're contrasting:**

1. **What are the two sides?**
   - Side A: [Concept / State / Approach]
   - Side B: [Concept / State / Approach]

2. **What's the key difference?**
   - [What fundamentally distinguishes them]

3. **What visual metaphors show the contrast?**
   - Side A metaphor: [Physical object/scene]
   - Side B metaphor: [Contrasting object/scene]

4. **Is one side "better" or are they equal alternatives?**
   - Better: [Which side to highlight in orange]
   - Equal: [Use balanced color or both in black]

**Output:**
```
COMPARISON: [Side A] vs [Side B]

CORE CONTRAST: [What's fundamentally different]

VISUAL METAPHORS:
- Side A: [Metaphor showing this approach/state]
- Side B: [Contrasting metaphor]

VALUE JUDGMENT:
- [Neutral comparison] OR [Side X is preferred]

COLOR STRATEGY:
- [Orange left / Navy right] OR [Orange on preferred, black on alternative]
```

---

### Step 2: Design Split Layout

**Plan the visual structure:**

1. **Split orientation:**
   - Vertical split (left/right) — Classic comparison
   - Horizontal split (top/bottom) — Before/after flow
   - Diagonal split — More dynamic

2. **Mirror elements:**
   - What visual elements repeat on both sides
   - How metaphors contrast (same structure, different details)
   - Balance of visual weight

3. **Dividing line:**
   - Strong black line separating sides
   - Soft visual separation
   - No line (color/metaphor creates division)

**Output:**
```
SPLIT ORIENTATION: [Vertical left/right / Horizontal top/bottom]

LAYOUT STRUCTURE:
Left/Top: [Side A]
- Metaphor: [What to illustrate]
- Key elements: [Specific visual details]
- Color: [Orange accents / Black only]

Right/Bottom: [Side B]
- Metaphor: [Contrasting illustration]
- Key elements: [Specific visual details]
- Color: [Navy accents / Black only]

DIVIDING LINE:
- [Strong black vertical/horizontal line] OR [Soft separation] OR [No line]

MIRROR ELEMENTS:
- [What appears on both sides for parallel structure]
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Drafted technical split composition comparing two contrasting concepts in editorial style.

STYLE REFERENCE: Magazine comparison spread, split-screen editorial illustration, before/after visual

BACKGROUND: [White #FFFFFF OR Warm-White Paper #FEF7E0] — clean, flat, both sides

AESTHETIC:
- Split composition with [vertical/horizontal] division
- Drafted navy linework on both sides (measured, drafted)
- Mirror structure showing parallel concepts with visual contrast
- Editorial flat color with strategic orange/navy differentiation
- Variable stroke weight, organic lines

SPLIT ORIENTATION: [Vertical left-to-right / Horizontal top-to-bottom]

COMPOSITION STRUCTURE:
- Clear [vertical/horizontal] division creating two equal sections
- [Black dividing line] OR [Visual separation through composition]
- Left/Top: [Side A name]
- Right/Bottom: [Side B name]

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - COMPARISON TITLE (Advocate Block Display):
- "[SIDE A] VS [SIDE B]" — Large at top
- Font: Advocate style, extra bold, drafted monospace, all-caps
- Size: 3x larger than body text
- Color: Black #000000
- Position: Top center above split
- Example: "JUNIOR ENGINEER VS SENIOR ENGINEER"

TIER 2 - SIDE LABELS (Concourse Sans):
- Left/Top: "[Side A]"
- Right/Bottom: "[Side B]"
- Font: Concourse geometric sans-serif
- Size: Medium readable
- Color: Blueprint Navy #1E3A8A
- Position: Headers for each side

TIER 3 - ANNOTATIONS (Advocate Condensed Italic):
- Key characteristics: "*overthinks*" vs "*simplifies*"
- Font: Advocate condensed italic
- Size: 60% of Tier 2
- Color: Matches side color (Orange left, Navy right)
- Position: Within each side's visual

LEFT/TOP SIDE - [SIDE A]:
Visual metaphor: [Describe the illustration, e.g.:]
- [Metaphor showing Side A characteristic]
- Drafted technical with [measured lines, measured precision]
- Color: Hot Accent Orange (#F97316) accents on [specific elements]
- Black (#000000) primary linework
- Represents: [What this side embodies]

RIGHT/BOTTOM SIDE - [SIDE B]:
Visual metaphor: [Contrasting illustration, e.g.:]
- [Metaphor showing Side B characteristic]
- Drafted technical matching style to left side
- Color: Blueprint Navy (#1E3A8A) accents on [specific elements]
- Black (#000000) primary linework
- Represents: [What this side embodies]

[OR if one side is preferred:]
- Preferred side: Hot Accent Orange (#F97316) accents
- Alternative side: Black only (or subtle Navy)

DIVIDING LINE:
- [Strong black vertical/horizontal line down center] OR
- [Soft visual separation through composition and color]

COLOR USAGE:
- Black (#000000) for all linework on both sides and dividing line
- Left side: Hot Accent Orange (#F97316) accents on [elements]
- Right side: Blueprint Navy (#1E3A8A) accents on [elements]
- Blueprint Navy (#1E3A8A) for all label text
- OR: Orange on preferred side only, black on alternative

CRITICAL REQUIREMENTS:
- Engineering blueprint style on BOTH sides (consistent aesthetic)
- Clear visual contrast between sides (metaphors show difference)
- Mirror structure (parallel elements contrasted)
- Strategic color differentiation (orange vs navy, or orange on better side)
- No gradients, flat colors only
- Immediate visual understanding of the difference
- Equal visual weight to both sides (balanced composition)

Optional: Sign small in bottom right corner in navy (#1E3A8A).
```

---

### Step 4: Determine Aspect Ratio

| Split Type | Aspect Ratio | Reasoning |
|------------|--------------|-----------|
| Vertical split (left/right) | 16:9 or 21:9 | Wide for side-by-side |
| Horizontal split (top/bottom) | 9:16 or 1:1 | Vertical or square for stacking |
| Square balanced | 1:1 | Symmetric comparison |
| Social media | 1:1 | Instagram/LinkedIn friendly |

**Default: 16:9 (horizontal)** — Classic side-by-side comparison

---

### Step 5: Execute Generation

```bash
bun Tools/dos-image.ts "[YOUR PROMPT]" \
  --intent=diagram \
  --output=/path/to/comparison.png \
  --size=1536x1024 \
  --telemetry-tag=Media/Art/Comparisons
```

**Model Recommendation:** nano-banana-pro or flux (both work well for split compositions)

**Immediately Open:**
```bash
open /path/to/comparison.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Clear split** — Obvious division between two sides
- [ ] **Visual contrast** — Metaphors clearly show the difference
- [ ] **Balanced composition** — Equal visual weight to both sides
- [ ] **Readable labels** — Side names and annotations legible
- [ ] **Color differentiation** — Orange/navy (or orange/black) distinguishes sides
- [ ] **Drafted technical** — Both sides maintain editorial aesthetic
- [ ] **Immediate understanding** — Difference obvious at a glance

#### Must NOT Have
- [ ] Unbalanced sides (one dominates)
- [ ] Unclear which is which
- [ ] Corporate comparison chart look
- [ ] Gradients or photorealistic elements
- [ ] Cluttered or confusing visuals
- [ ] Missing dividing line or separation

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Sides unclear | "Strong black dividing line down center, clear LEFT: vs RIGHT: labels" |
| Not balanced | "Equal visual weight, mirror structure, parallel composition both sides" |
| Contrast weak | "Stronger metaphor contrast: [Side A metaphor] vs [Side B opposite metaphor]" |
| Too complex | Simplify each side to single clear metaphor |
| Colors confusing | "Orange accents left side only, Navy accents right side only" |
| Looks corporate | Reference "editorial split composition, drafted technical contrast illustration" |

---

## Example Use Cases

### Example 1: "Junior Engineer vs Senior Engineer"
- **Split:** Vertical left/right
- **Left (Junior):** Complex spaghetti code (orange tangle)
- **Right (Senior):** Simple elegant solution (navy straight line)
- **Color:** Orange left, Navy right
- **Aspect:** 16:9

### Example 2: "Before AI vs After AI"
- **Split:** Horizontal top/bottom
- **Top (Before):** Manual tedious work (person with paper pile)
- **Bottom (After):** Automated flow (person directing AI)
- **Color:** Orange on "After" (preferred state)
- **Aspect:** 9:16

### Example 3: "Security Theater vs Real Security"
- **Split:** Vertical left/right
- **Left (Theater):** Fancy locks on cardboard door
- **Right (Real):** Simple but solid construction
- **Color:** Orange right (effective), black left (ineffective)
- **Aspect:** 16:9

---

## Quick Reference

**Comparison Formula:**
```
1. Define comparison (sides, contrast, metaphors)
2. Design split layout (orientation, mirror elements, colors)
3. Construct prompt with split structure
4. Choose aspect ratio for split type
5. Generate with nano-banana-pro
6. Validate for clarity and balance
```

**Color Strategy:**
- Balanced comparison: Orange left, Navy right
- Value judgment: Orange on better side, black on other
- Neutral: Both black with subtle orange/navy accents

**Key Principle:**
- Difference should be immediately obvious
- Visual metaphors do the talking, minimal text needed

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**