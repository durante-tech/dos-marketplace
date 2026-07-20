---
name: Recipe Cards
description: 
status: STABLE
---

# Process Recipe Cards Workflow

**Step-by-step visual recipes for processes and methodologies using brand aesthetic.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the RecipeCards workflow in the Art skill to create recipe cards"
```

Running **RecipeCards** in **Art**...

---

Creates **PROCESS RECIPE CARDS** — numbered steps with small illustrations for each action, combining procedural clarity with editorial style.

---

## Purpose

Process recipe cards present methodologies, workflows, and step-by-step processes as visual recipes. These **illustrated how-to guides** make complex processes scannable and memorable.

**Use this workflow for:**
- "The 5-Step TELOS Analysis Recipe"
- Consulting methodology playbooks
- How-to guides and processes
- Workflow documentation
- Best practice checklists
- Strategic frameworks with steps

---

## Visual Aesthetic: Recipe Card with Personality

**Think:** Cooking recipe card, but for business processes, with editorial drafted technical style

### Core Characteristics
1. **Numbered steps** — Clear 1, 2, 3 progression
2. **Small illustration per step** — Icon or simple visual for each action
3. **Scannable format** — Easy to reference and follow
4. **Recipe card layout** — Compact, organized, referenceable
5. **Drafted technical icons** — Measured, editorial style illustrations
6. **Typography hierarchy** — 3-tier system for title, steps, details
7. **Deliverable quality** — Professional enough for client handoff

---

## Color System for Recipe Cards

### Structure
```
Black #000000 — Step numbers, dividing lines, icon outlines
```

### Step Differentiation
```
Hot Accent Orange #F97316 — Critical steps or outcomes
Blueprint Navy #1E3A8A — Supporting steps or inputs
Blueprint Navy #1E3A8A — All body text and descriptions
```

### Background
```
Warm-White Paper #FEF7E0 — Recipe card warmth
OR
White #FFFFFF — Clean modern
```

### Color Strategy
- Step numbers in black (or orange for critical steps)
- Icons primarily black linework with strategic orange/navy accents
- Text in navy for readability
- Outcome/result step in orange (final step)

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Process

**Identify the recipe:**

1. **What process are you documenting?**
   - Process name
   - Overall goal/outcome

2. **How many steps?**
   - Ideal: 3-7 steps (recipe card format)
   - Too many steps → break into multiple recipes

3. **What are the steps?**
   - List each action in sequence
   - What happens at each step
   - What's the outcome

**Output:**
```
PROCESS NAME: [The X Recipe / X-Step Y Method]
OUTCOME: [What this process achieves]

STEPS:
1. [Step name] — [Action description] — [Icon metaphor]
2. [Step name] — [Action description] — [Icon metaphor]
3. [Step name] — [Action description] — [Icon metaphor]
4. [Step name] — [Action description] — [Icon metaphor]
5. [Step name] — [Action description] — [Icon metaphor]

CRITICAL STEPS (Orange):
- [Which step(s) are most important]
```

---

### Step 2: Design Recipe Card Layout

**Plan the visual structure:**

1. **Layout style:**
   - Vertical list (top to bottom)
   - Grid (2x3 for 6 steps)
   - Linear horizontal flow
   - Circular flow (process loops)

2. **Step representation:**
   - Number badge (circled number)
   - Small icon illustration for step
   - Brief text description
   - Arrow to next step

3. **Visual flow:**
   - How steps connect
   - Progressive visual cues
   - Final outcome emphasis

**Output:**
```
LAYOUT: [Vertical list / Grid / Horizontal flow / Circular]

CARD STRUCTURE:
- Title at top (Tier 1 typography)
- [X] steps arranged [vertically/in grid]
- Each step contains:
  * Numbered badge (e.g., "1" in circle)
  * Small drafted technical icon/illustration
  * Step name (Tier 2)
  * Brief description (Tier 3)
- Arrows or lines connecting steps
- Final outcome emphasized

ICON METAPHORS:
Step 1: [Simple icon, e.g., "magnifying glass" for discover]
Step 2: [Icon, e.g., "lightbulb" for ideate]
Step 3: [Icon, e.g., "hammer" for build]
...

COLOR CODING:
- Step [X] (critical): Orange badge and icon accents
- Step [Y] (outcome): Orange emphasis
- Other steps: Black badges, minimal color
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Drafted technical process recipe card in editorial style.

STYLE REFERENCE: Recipe card, visual playbook, illustrated step-by-step guide

BACKGROUND: [Warm-White Paper #FEF7E0 OR White #FFFFFF] — clean, card-like

AESTHETIC:
- Recipe card layout (organized, scannable)
- Drafted technical step icons (simple, measured, editorial style)
- Numbered steps with clear progression
- Variable stroke weight (icons and dividing lines)
- Professional but human quality (deliverable to clients)

LAYOUT TYPE: [Vertical list / Grid / Horizontal flow]

CARD STRUCTURE:
[Describe the overall layout, e.g.:]
- Title at top
- 5 steps arranged vertically down the card
- Each step has: numbered badge → icon → name → description
- Arrows connecting steps showing flow
- Final step emphasized with orange accent

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - RECIPE TITLE (Advocate Block Display):
- "[PROCESS NAME]" — Large at top
- Font: Advocate style, extra bold, drafted monospace, all-caps
- Size: 3x larger than body text
- Color: Black #000000
- Example: "THE 5-STEP TELOS ANALYSIS RECIPE"

TIER 2 - STEP NAMES (Concourse Sans):
- "Step 1: [Name]", "Step 2: [Name]", etc.
- Font: Concourse geometric sans-serif
- Size: Medium readable
- Color: Blueprint Navy #1E3A8A (or Orange for critical step)
- Position: Next to each step icon

TIER 3 - STEP DESCRIPTIONS (Advocate Condensed):
- Brief action description for each step
- Font: Advocate condensed (smaller)
- Size: 60% of Tier 2
- Color: Blueprint Navy #1E3A8A
- Position: Below step name

PROCESS STEPS TO ILLUSTRATE:
[List each step in detail, e.g.:]

STEP 1: [Step Name]
- Number badge: "1" in black circle
- Icon: [Drafted technical simple icon, e.g., "magnifying glass examining document"]
- Description: "[Brief action description]"
- Color: Black linework
- Arrows: Black arrow pointing to Step 2

STEP 2: [Step Name]
- Number badge: "2" in black circle
- Icon: [Drafted technical icon, e.g., "hands sorting cards"]
- Description: "[Action description]"
- Color: Black linework
- Arrows: Black arrow pointing to Step 3

STEP 3: [Critical Step Name]
- Number badge: "3" in Hot Accent Orange (#F97316) circle — CRITICAL STEP
- Icon: [Drafted technical icon with orange accents]
- Description: "[Action description]"
- Color: Hot Accent Orange (#F97316) accents on icon and badge
- Arrows: Orange arrow pointing to Step 4

[Continue for all steps...]

FINAL STEP [X]: [Outcome]
- Number badge: "[X]" in Hot Accent Orange (#F97316) circle — OUTCOME
- Icon: [Success/completion icon, e.g., "trophy", "checkmark", "rocket"]
- Description: "[Outcome achieved]"
- Color: Hot Accent Orange (#F97316) emphasis
- Represents: Final result of process

CONNECTING ELEMENTS:
- Drafted technical arrows between steps (measured, measured)
- Dotted or dashed lines for optional paths
- All arrows in Black (#000000) except critical path (Orange)

COLOR USAGE:
- Black (#000000) for most step badges, icons, arrows
- Hot Accent Orange (#F97316) for critical step(s) and final outcome
- Blueprint Navy (#1E3A8A) optional for input/supporting steps
- Blueprint Navy (#1E3A8A) for all text

CRITICAL REQUIREMENTS:
- Drafted technical recipe card aesthetic (not polished diagram)
- Simple scannable icons for each step (not detailed illustrations)
- Clear numbered progression (1 → 2 → 3 → outcome)
- 3-tier typography hierarchy
- Strategic orange emphasis on critical/outcome steps
- No gradients, flat colors only
- Professional deliverable quality (client-ready)
- Recipe card proportions (vertical card layout)

Optional: Sign small in bottom right corner in navy (#1E3A8A).
```

---

### Step 4: Determine Aspect Ratio

| Recipe Type | Aspect Ratio | Reasoning |
|-------------|--------------|-----------|
| Vertical list (3-7 steps) | 9:16 or 4:3 | Tall card format |
| Grid layout (6-9 steps) | 1:1 | Square balanced grid |
| Horizontal flow | 16:9 | Wide linear progression |
| Circular process | 1:1 | Square for circular symmetry |

**Default: 9:16 (vertical)** — Classic recipe card orientation

---

### Step 5: Execute Generation

```bash
bun Tools/dos-image.ts "[YOUR PROMPT]" \
  --intent=diagram \
  --output=/path/to/recipe-card.png \
  --size=1024x1536 \
  --telemetry-tag=Media/Art/RecipeCards
```

**Model Recommendation:** nano-banana-pro (best text rendering for steps)

**Immediately Open:**
```bash
open /path/to/recipe-card.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Clear progression** — Steps obviously flow 1 → 2 → 3
- [ ] **Scannable layout** — Easy to reference quickly
- [ ] **Simple icons** — Each step has recognizable illustration
- [ ] **Readable text** — All step names and descriptions legible
- [ ] **Strategic color** — Orange on critical/outcome steps
- [ ] **Drafted, measured quality** — Recipe card has editorial aesthetic
- [ ] **Professional deliverable** — Client-ready quality

#### Must NOT Have
- [ ] Complex detailed illustrations (should be simple icons)
- [ ] Cluttered layout (too much information)
- [ ] Illegible small text
- [ ] Missing step numbers
- [ ] Unclear flow or progression
- [ ] Corporate process diagram look

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Icons too complex | "Simple drafted technical icons, minimal detail, recognizable at glance" |
| Can't follow flow | "Clear numbered badges 1→2→3, black arrows connecting steps" |
| Too cluttered | Reduce description text, simplify layout |
| Looks corporate | Reference "recipe card aesthetic, drafted technical playbook, editorial style" |
| Text unreadable | Increase Tier 2/3 text sizes, more spacing |
| Missing emphasis | "Hot Accent Orange (#F97316) on Step [X] critical and final outcome step" |

---

## Example Use Cases

### Example 1: "5-Step TELOS Analysis Recipe"
- **Steps:** Context → Questions → Blockers → Constraints → Solutions
- **Icons:** Magnifying glass, question marks, roadblock, fence, lightbulb
- **Color:** Orange on final "Solutions" step
- **Layout:** Vertical 9:16
- **Use:** Consulting deliverable

### Example 2: "The Security Assessment Method"
- **Steps:** Assets → Threats → Vulnerabilities → Mitigations → Validation
- **Icons:** Treasure, storm, crack, shield, checkmark
- **Color:** Orange on "Mitigations" (critical) and "Validation" (outcome)
- **Layout:** Vertical 9:16

### Example 3: "3-Step Content Creation Recipe"
- **Steps:** Research → Create → Distribute
- **Icons:** Books, pencil, megaphone
- **Color:** Orange on final "Distribute" outcome
- **Layout:** Horizontal 16:9 (simpler process)

---

## Quick Reference

**Recipe Card Formula:**
```
1. Define process (name, steps, outcome)
2. Design layout (vertical/grid, icons, flow)
3. Construct prompt with numbered progression
4. Choose aspect ratio for layout type
5. Generate with nano-banana-pro
6. Validate for scannability and professionalism
```

**Color Strategy:**
- Most steps: Black badges and icons
- Critical step: Orange badge and accents
- Final outcome: Orange emphasis
- Text: Navy

**Icon Design:**
- Simple, recognizable, drafted technical
- Not detailed illustrations
- Represents the action of that step

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**