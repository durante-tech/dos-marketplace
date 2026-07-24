---
name: Aphorisms
description: 
status: STABLE
---

# Visual Aphorisms & Quote Cards Workflow

**Aphorisms as shareable visual quote cards using editorial aesthetic.**

Creates **VISUAL APHORISM CARDS** — insights and quotes as shareable square images with massive typography and minimal drafted technical accents.

---

## Purpose

Visual aphorism cards turn memorable one-liners into shareable social media content. These are **typographic statements with personality** — the quote IS the visual, with subtle editorial accents.

**Use this workflow for:**
- Social media quote cards (LinkedIn, Instagram, X)
- Newsletter pull quotes
- Aphorisms as standalone images
- Thought leadership visuals
- "HUMANS NEED ENTROPY" style statements
- Memorable insights amplified visually

---

## Visual Aesthetic: Typography as Hero

**Think:** Giant bold typography with subtle drafted technical accent, not full illustration

### Core Characteristics
1. **Typography dominant** — The quote IS the visual (80-90% of image)
2. **Massive Advocate** — All-caps bold lettering fills the frame
3. **Minimal illustration** — Small subtle accent element (not full scene)
4. **Square format** — 1:1 for social media
5. **High contrast** — Black text on light, or white text on dark
6. **Drafted monospace quality** — Drafted monospace typography, not digital font
7. **Editorial voice** — Punchy, memorable, thought-provoking

---

## Color System for Aphorisms

### Typography
```
Black #000000 — Primary text (most common)
OR
Hot Accent Orange #F97316 — Full text in brand color (alternative)
OR
White #FFFFFF — Text on dark background (high contrast)
```

### Accent Element
```
Hot Accent Orange #F97316 — Small accent illustration
Blueprint Navy #1E3A8A — Alternative accent color
```

### Background
```
Warm-White Paper #FEF7E0 — Warm neutral (most common)
OR
White #FFFFFF — Clean modern
OR
Black #000000 — Dark dramatic (white text)
OR
Hot Accent Orange #F97316 — Bold brand (white text)
```

### Color Strategy
- **High contrast typography** — Text must be immediately readable
- **Minimal color** — Quote + small accent, not busy
- **Brand presence** — Orange somewhere (text OR accent OR background)

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Select Aphorism

**Choose the quote:**

1. **What's the aphorism?**
   - The exact quote
   - Must be punchy and memorable
   - Ideal length: 2-8 words (fits large on card)

2. **What's the insight?**
   - What makes this quote powerful
   - Why is it shareable

3. **What tiny visual accent supports it?**
   - NOT a full illustration
   - Small simple element reinforcing the idea
   - Examples: scatter dots for entropy, em dash for typography quote

**Output:**
```
APHORISM: "[Quote in all-caps]"
LENGTH: [X words]

INSIGHT: [Why this quote resonates]

ACCENT ELEMENT: [Tiny illustration, e.g.:]
- "scatter of dots" for entropy
- "em dash symbol" for typography topic
- "lightning bolt" for insight moment
- "simple line drawing" reinforcing concept
```

---

### Step 2: Design Typography Layout

**Plan the visual:**

1. **Typography arrangement:**
   - All one line (short quote)
   - Multiple lines (longer quote)
   - Stacked words (vertical emphasis)
   - Asymmetric layout (dynamic placement)

2. **Size and weight:**
   - How large can text go while remaining readable
   - Line breaks for rhythm and emphasis
   - Word hierarchy (which words largest)

3. **Accent placement:**
   - Where does small illustration go
   - How does it complement (not compete with) text
   - Size: 5-10% of image area

**Output:**
```
TYPOGRAPHY LAYOUT:
[Describe arrangement, e.g.:]
- "HUMANS NEED" on first line
- "ENTROPY" on second line (larger)
- All-caps Advocate style, massive bold letters
- Fills 80% of image area
- Drafted monospace measuredion

ACCENT ELEMENT:
- Small scatter of dots (entropy visual)
- Hot Accent Orange (#F97316) colored
- Position: Bottom right corner
- Size: ~8% of image
- Does NOT compete with text

COLOR SCHEME:
- Text: [Black / Orange / White]
- Background: [Warm-White / White / Black / Orange]
- Accent: [Orange / Navy]
- Signature: Navy (optional)
```

---

### Step 3: Construct Prompt

### Prompt Template

```
Typographic quote card in editorial drafted monospace style.

STYLE REFERENCE: Bold typography poster, quote card, drafted monospace aphorism

BACKGROUND: [Warm-White Paper #FEF7E0 / White #FFFFFF / Black #000000 / Hot Accent Orange #F97316] — flat, solid

AESTHETIC:
- Typography as the primary visual (dominates composition)
- Drafted monospace Advocate style (measured, drafted, bold)
- Massive scale lettering (fills 80-90% of frame)
- Minimal accent illustration (subtle, not competing)
- High contrast for readability
- Square 1:1 format

QUOTE CARD STRUCTURE:

TYPOGRAPHY (Advocate Block Display - MASSIVE):
"[APHORISM TEXT IN ALL-CAPS]"

- Font: Advocate style extra bold, drafted monospace, all-caps
- Size: MASSIVE — fills most of image area
- Layout: [Single line / Multi-line / Stacked words]
- Line breaks: [Where breaks occur for rhythm]
  Line 1: "[FIRST PART]"
  Line 2: "[SECOND PART]" (optionally larger)
- Color: [Black #000000 / Hot Accent Orange #F97316 / White #FFFFFF]
- Style: Drafted monospace with measuredions (not perfect digital font)
- Variable letter sizing for emphasis
- Letters should have character and personality

ACCENT ILLUSTRATION (Minimal):
- [Small simple element, e.g., "scattered dots", "small em dash", "lightning bolt"]
- Drafted, technical, editorial style
- Position: [Bottom right / Top left / etc. — does NOT interfere with text]
- Size: 5-10% of image area
- Color: [Hot Accent Orange #F97316 / Blueprint Navy #1E3A8A]
- Style: Measured engineering-drawing quality, matches text aesthetic
- Purpose: Subtle visual reinforcement, NOT competing focal point

COLOR USAGE:
- Background: [Color choice] — flat solid fill
- Typography: [Color choice] — high contrast with background
- Accent element: [Orange or Navy]
- Signature: Blueprint Navy (#1E3A8A) small in corner (optional)

CRITICAL REQUIREMENTS:
- Typography is HERO (quote fills 80-90% of frame)
- Drafted monospace quality (measured lines, drafted technical character shapes)
- NOT a digital font — should feel drafted technical
- Accent illustration MINIMAL (does not distract from quote)
- High contrast readability (text must pop from background)
- Square 1:1 aspect ratio
- No gradients, flat colors only
- Shareable social media quality

Optional: Sign small in bottom right corner in navy (#1E3A8A).
```

---

### Step 4: Determine Aspect Ratio

**Always 1:1 (square)** — Optimized for social media (Instagram, LinkedIn, X)

---

### Step 5: Execute Generation

Use the `image.generate` Port (RFC-0031). Aphorism cards are typography-dominant — `--intent=diagram` routes to GPT-Image-1 (Adapter with the best text rendering for label-heavy compositions, the same property that previously argued for `nano-banana-pro`).

```bash
bun Tools/dos-image.ts "[YOUR PROMPT]" \
  --intent=diagram \
  --output=/path/to/aphorism.png \
  --telemetry-tag=Media/Art/Aphorisms
```

The Port subprocess-calls the canonical Generate.ts Adapter under the hood — same Studio gateway, same credit metering, same artifact tracking — but the operator emits *intent* (`diagram`) rather than *vendor* (`nano-banana-pro`). Telemetry attribution via `--telemetry-tag` records the caller in `MEMORY/ARTIFACTS/dos-router-telemetry.jsonl`.

**Stylistic alternative:** if a hand-drafted variant feels closer to the brand voice than tight typography, fall through to the Generate.ts CLI for direct `--model flux` access:

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux \
  --prompt "[YOUR PROMPT]" \
  --size 1:1 \
  --output /path/to/aphorism.png
```

**Immediately Open:**
```bash
open /path/to/aphorism.png
```

---

### Step 6: Validation (MANDATORY)

#### Must Have
- [ ] **Quote readable** — Instantly legible even at thumbnail size
- [ ] **Typography dominant** — Quote is 80-90% of visual
- [ ] **Drafted monospace** — Measured, measured precision (not digital font)
- [ ] **High contrast** — Text pops from background
- [ ] **Minimal accent** — Small element supports, doesn't compete
- [ ] **Shareable** — Works as social media post
- [ ] **Brand presence** — Orange visible somewhere (text/accent/background)

#### Must NOT Have
- [ ] Perfect digital font (should be drafted monospace)
- [ ] Busy background or complex illustration
- [ ] Low contrast (can't read text easily)
- [ ] Accent element competing with quote
- [ ] Tiny text (must be readable at thumbnail)
- [ ] Gradients or shadows

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Text too small | "MASSIVE drafted monospace typography filling 85% of frame" |
| Looks like digital font | "Drafted technical Advocate letters, drafted measured strokes, measured precision" |
| Accent too busy | "MINIMAL accent: small simple [element], 8% of image, subtle" |
| Can't read thumbnail | Increase text size, stronger contrast, simplify layout |
| No brand presence | "Hot Accent Orange (#F97316) on [accent element / text / background]" |
| Too complex | "Typography IS the visual — quote dominant, minimal everything else" |

---

## Example Use Cases

### Example 1: "HUMANS NEED ENTROPY"
- **Typography:** Two lines, "ENTROPY" larger
- **Accent:** Small scatter of orange dots (bottom right)
- **Background:** Light warm-white
- **Text:** Black
- **Use:** LinkedIn post, newsletter pull quote

### Example 2: "THE EM DASH IS PERFECT"
- **Typography:** Stacked words, "EM DASH" emphasized
- **Accent:** Small orange em dash symbol
- **Background:** White
- **Text:** Black
- **Use:** X post about typography

### Example 3: "AI COPIES HUMAN CREATIVITY"
- **Typography:** Three lines, "AI" and "CREATIVITY" larger
- **Accent:** Tiny robot hand + human hand (orange, minimal)
- **Background:** Black
- **Text:** White (high contrast)
- **Use:** Instagram thought leadership post

### Example 4: "SECURITY IS A FEELING"
- **Typography:** Two lines
- **Accent:** Small orange shield with heart
- **Background:** Hot Accent Orange #F97316
- **Text:** White
- **Use:** Bold brand statement

---

## Quick Reference

**Aphorism Card Formula:**
```
1. Select aphorism (punchy quote, 2-8 words ideal)
2. Design typography layout (arrangement, emphasis, size)
3. Choose minimal accent element (5-10% of image)
4. Construct prompt with massive typography
5. Always use 1:1 square aspect ratio
6. Generate with nano-banana-pro
7. Validate for readability and shareability
```

**Color Strategy:**
- High contrast: Black text on warm-white, or white text on black/orange
- Brand presence: Orange somewhere in composition
- Minimal palette: Quote + accent + background = 3 colors max

**Key Principle:**
- **Typography IS the visual** — Everything else is subtle support
- Shareable, memorable, instantly readable
- Your voice amplified visually

---

**The workflow: Select → Design → Construct → Generate → Validate → Complete**