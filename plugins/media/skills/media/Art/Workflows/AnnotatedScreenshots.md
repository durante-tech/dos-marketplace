---
name: Annotated Screenshots
description: 
status: STABLE
---

# Annotated Screenshots Workflow

**Real screenshots with engineering blueprint annotations, arrows, and highlights using brand aesthetic.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the AnnotatedScreenshots workflow in the Art skill to annotate images"
```

Running **AnnotatedScreenshots** in **Art**...

---

Creates **ANNOTATED SCREENSHOTS** — actual UI screenshots or code snippets with drafted technical orange/navy commentary overlays.

---

## Purpose

Annotated screenshots combine real artifacts (UI, code, data) with engineering blueprint commentary. This **hybrid real + illustrated** approach adds voice and insights directly onto actual examples.

**Use this workflow for:**
- Product reviews with annotated screenshots
- Technical tutorials pointing out UI elements
- UX critiques with visual commentary
- Code reviews with illustrated notes
- "THIS IS THE PROBLEM" arrows and callouts

---

## Visual Aesthetic: Real + Hand-Drawn Overlay

**Think:** Screenshot with drafted arrows, dimension lines, and callouts in editorial voice

### Core Characteristics
1. **Real foundation** — Actual screenshot or code snippet (not illustrated)
2. **Drafted technical overlay** — Arrows, circles, highlights, callouts in editorial style
3. **Typography mix** — Real UI text + drafted monospace annotations
4. **Color accents** — Orange/navy for annotations against real screenshot
5. **Editorial voice** — Annotations sound like smart commentary
6. **Editorial style** — Maintains drafted technical, drafted linework for overlays
7. **Functional clarity** — Annotations enhance understanding, not just decoration

---

## Color System for Annotated Screenshots

### Real Screenshot Layer
```
Original colors preserved (screenshot remains unmodified)
OR
Slightly desaturated/faded to make annotations pop
```

### Annotation Overlay
```
Hot Accent Orange #F97316 — Primary annotations (important callouts)
Blueprint Navy #1E3A8A — Secondary annotations (supporting notes)
Black #000000 — Arrows, circles, underlines
Blueprint Navy #1E3A8A — Annotation text (when not orange/navy)
```

### Strategy
- Screenshot slightly faded/grayed (80% opacity) to let annotations stand out
- Orange for critical annotations ("THIS IS THE ISSUE")
- Navy for helpful context ("here's how it works")
- Black for structural annotations (arrows, circles, boxes)

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Prepare Screenshot

**Get the base image:**

1. **Capture screenshot:**
   - Take actual screenshot of UI, code, website, etc.
   - Crop to relevant area
   - Ensure text is readable

2. **Process screenshot:**
   - Optionally desaturate slightly (makes overlays pop)
   - Resize if needed for clarity
   - Save as base image

**Output:**
```
SCREENSHOT SOURCE: [Path to screenshot file]
SUBJECT: [What the screenshot shows]
KEY AREAS TO ANNOTATE:
- Area 1: [Description] — [What to call out]
- Area 2: [Description] — [What to call out]
...
```

---

### Step 2: Plan Annotations

**Identify what to mark:**

1. **What are you calling attention to?**
   - Problem areas
   - Good examples
   - Workflow steps
   - Hidden features

2. **What type of annotation for each?**
   - Arrow pointing to element
   - Circle/box highlighting region
   - Underline or bracket
   - Callout with note

3. **What's the commentary?**
   - "*this is the problem*"
   - "*should be here instead*"
   - "*genius design*"
   - "*completely missed the point*"

**Output:**
```
ANNOTATIONS TO ADD:

1. [Area/Element]:
   - Type: [Arrow / Circle / Box / Underline]
   - Color: [Orange / Navy / Black]
   - Text: "[Your commentary]"
   - Position: [Where on screenshot]

2. [Area/Element]:
   - Type: [Annotation type]
   - Color: [Color choice]
   - Text: "[Commentary]"
   - Position: [Location]

...

EMPHASIS:
- Orange (critical): [Which annotations]
- Navy (helpful): [Which annotations]
```

---

### Step 3: Construct Prompt

**Note:** This workflow is different - you're adding overlays to an existing image. You may need to:
- Upload screenshot as reference image
- Generate drafted annotation layer separately
- Composite in image editor

OR

- Use prompt to describe "screenshot with annotations" if model can render both

### Prompt Template (If Generating Combined Image)

```
Real UI screenshot with engineering blueprint annotations overlay.

STYLE: Actual screenshot with measured drafted arrows, dimension lines, and callouts on top

SCREENSHOT BASE:
- [Describe the screenshot content, e.g.: "ChatGPT interface showing conversation"]
- Slightly desaturated/faded (80% opacity) to let annotations stand out
- All original text and UI elements clearly visible

ANNOTATION OVERLAY STYLE:
- Drafted technical arrows, circles, underlines in editorial style
- Variable stroke weight, measured measured lines
- Measured precision (not polished vectors)
- Drafted monospace annotation text

TYPOGRAPHY FOR ANNOTATIONS (Advocate Italic):
- Font: Advocate condensed italic (drafted monospace style)
- Size: Readable against screenshot
- Color: Hot Accent Orange #F97316 or Blueprint Navy #1E3A8A for emphasis
- Style: Editorial voice — casual, direct, insightful

ANNOTATIONS TO ADD:
[List each annotation, e.g.:]

1. PURPLE ARROW pointing to [UI element]:
   - Drafted measured arrow in Hot Accent Orange (#F97316)
   - Text annotation: "*THIS IS THE PROBLEM*"
   - Thick stroke, clear pointing direction
   - Position: [Location on screenshot]

2. TEAL CIRCLE around [UI area]:
   - Drafted measured circle in Blueprint Navy (#1E3A8A)
   - Text annotation: "*notice this pattern*"
   - Slightly measured outline
   - Position: [Area to highlight]

3. BLACK UNDERLINE beneath [text]:
   - Drafted technical wavy underline in Black (#000000)
   - Emphasizes existing screenshot text
   - No additional annotation needed

4. PURPLE CALLOUT box:
   - Drafted callout box with arrow pointing to [element]
   - Text: "*should have been here instead*"
   - Hot Accent Orange (#F97316) box outline and text
   - Position: [Near relevant UI element]

[etc. for all annotations]

COLOR USAGE:
- Screenshot: Original colors (or slightly desaturated)
- Hot Accent Orange (#F97316): Critical annotations, "this is wrong" callouts
- Blueprint Navy (#1E3A8A): Helpful context, "here's why" explanations
- Black (#000000): Structural annotations (arrows, circles, underlines)
- Blueprint Navy (#1E3A8A): General annotation text when not emphasized

CRITICAL REQUIREMENTS:
- Screenshot remains readable and recognizable
- Drafted technical annotations clearly overlay (not integrated into UI)
- Annotations enhance understanding, point out insights
- Variable stroke weight, drafted technical quality
- Editorial voice in text ("*this*", not formal descriptions)
- Strategic color (not every annotation needs color)
- No gradients on annotations

Optional: Sign small in bottom corner in navy (#1E3A8A).
```

### Alternative: Composite Workflow

If generating combined image is difficult:

1. **Generate annotation layer separately:**
   - Transparent background
   - Only arrows, circles, text annotations
   - Match screenshot dimensions

2. **Composite in image editor:**
   - Layer screenshot (bottom)
   - Layer annotations (top)
   - Adjust annotation opacity if needed

---

### Step 4: Determine Aspect Ratio

**Match screenshot aspect ratio:**
- Screenshot is 16:9 → Use 16:9
- Screenshot is vertical phone UI → Use 9:16
- Screenshot is square → Use 1:1
- Screenshot is wide desktop → Use 21:9

**Preserve original screenshot proportions**

---

### Step 5: Execute Generation

**Option A: Generate combined (if model supports):**
```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --reference-image /path/to/screenshot.png \
  --prompt "[ANNOTATION PROMPT]" \
  --size 2K \
  --aspect-ratio [match screenshot] \
  --output /path/to/annotated.png
```

**Option B: Generate annotation layer, then composite manually**

**Immediately Open:**
```bash
open /path/to/annotated.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Screenshot readable** — Original content clearly visible
- [ ] **Annotations clear** — Arrows/circles/text obviously drafted technical overlays
- [ ] **Editorial voice** — Annotations sound like smart commentary
- [ ] **Strategic pointing** — Annotations highlight key insights, not random decoration
- [ ] **Color emphasis** — Orange on critical, navy on helpful
- [ ] **Drafted, measured quality** — Precise arrows with end-ticks, measured circles, drafted
- [ ] **Functional value** — Annotations actually enhance understanding

#### Must NOT Have
- [ ] Unreadable screenshot
- [ ] Polished digital annotation look
- [ ] Generic corporate callouts ("Feature A")
- [ ] Too many annotations (cluttered)
- [ ] Formal voice (should be casual, direct)
- [ ] Perfect straight arrows or circles

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Screenshot too dark | Lighten/desaturate screenshot layer, increase annotation contrast |
| Annotations too polished | Emphasize "drafted measured arrows, measured circles, drafted sketch" |
| Voice too formal | Rewrite annotations in casual voice: "*this right here*" |
| Can't tell what's being pointed out | Larger/bolder arrows, clearer pointing direction |
| Too cluttered | Reduce annotations to 3-5 key insights only |
| Looks corporate | Reference "editorial annotation style, smart person's markup, drafted technical notes" |

---

## Example Use Cases

### Example 1: ChatGPT UI Critique
- **Screenshot:** ChatGPT conversation interface
- **Annotations:**
  - Orange arrow: "*this prompt engineering is bad*"
  - Navy circle: "*notice how it avoided the question*"
  - Black underline: Emphasizing problematic output
- **Aspect:** 16:9

### Example 2: Code Review
- **Screenshot:** Python code snippet
- **Annotations:**
  - Orange box: "*bottleneck right here*"
  - Navy arrow: "*clever use of list comprehension*"
  - Black circle: Highlighting security issue
- **Aspect:** 1:1 (code block)

### Example 3: UX Flow Breakdown
- **Screenshot:** Mobile app workflow (multiple screens)
- **Annotations:**
  - Numbered orange arrows showing flow
  - Navy notes on each step: "*where users drop off*"
  - Black boxes highlighting UI elements
- **Aspect:** 9:16 (vertical phone layout)

---

## Quick Reference

**Annotated Screenshot Formula:**
```
1. Prepare screenshot (capture, crop, optionally desaturate)
2. Plan annotations (what to mark, commentary, colors)
3. Construct prompt OR composite manually
4. Match screenshot aspect ratio
5. Generate/composite annotations
6. Validate for clarity and voice
```

**Color Strategy:**
- Screenshot: Original colors (or slightly faded)
- Orange: Critical annotations
- Navy: Helpful context
- Black: Structural marks

**Voice:**
- Casual, direct, editorial commentary
- "*this is the issue*" not "Area A shows problem"

---

**The workflow: Prepare → Plan → Annotate → Generate → Validate → Complete**