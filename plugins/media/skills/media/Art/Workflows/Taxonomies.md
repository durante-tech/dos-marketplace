---
name: Taxonomies
description: 
status: STABLE
---

# Visual Taxonomies & Classification Grids Workflow

**Drafted technical classification systems, taxonomies, and reference grids using brand aesthetic.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Taxonomies workflow in the Art skill to create taxonomies"
```

Running **Taxonomies** in **Art**...

---

Creates **VISUAL TAXONOMIES** — organized classification systems like periodic tables, capability matrices, or framework grids with editorial drafted technical style.

---

## Purpose

Visual taxonomies organize concepts into structured classification systems. Unlike technical diagrams (which show flows/relationships) or editorial illustrations (which use metaphors), taxonomies show **organized categories and hierarchies**.

**Use this workflow for:**
- "The Periodic Table of X"
- Classification grids and matrices
- Capability taxonomies
- Framework reference cards
- Organized typologies
- Systematic categorizations

---

## Visual Aesthetic: Structured Yet Hand-Drawn

**Think:** Drafted technical periodic table or field guide illustration

### Core Characteristics
1. **Grid structure** — Organized cells/boxes in systematic layout
2. **Drafted measuredion** — Boxes measured, lines organic, human feel
3. **Consistent typography** — 3-tier system (Advocate titles, Concourse labels, italic annotations)
4. **Category organization** — Clear groupings with visual hierarchy
5. **Color coding** — Strategic use of orange/navy to show categories
6. **Editorial aesthetic** — Maintains brand flat color, black linework style
7. **Scannable layout** — Easy to reference and navigate

---

## Color System for Taxonomies

**Same brand palette, organized usage:**

### Structure
```
Black #000000 — All grid lines, cell borders, primary structure
```

### Category Differentiation
```
Hot Accent Orange #F97316 — Category 1 headers/highlights
Blueprint Navy #1E3A8A — Category 2 headers/highlights
Blueprint Navy #1E3A8A — All body text and labels
```

### Background
```
White #FFFFFF or Warm-White Paper #FEF7E0 — For clarity
```

### Color Strategy
- Use orange for one category type, navy for another
- Alternate colors by row/column for visual organization
- Keep most content black/navy with strategic color accents

---

## 🚨 MANDATORY WORKFLOW STEPS

### Step 1: Define Classification System

**Identify what you're classifying:**

1. **What is being categorized?** (e.g., AI capabilities, security threats, business models)
2. **What are the organizing dimensions?** (e.g., complexity vs. impact, offensive vs. defensive)
3. **How many categories?** (e.g., 6 types, 12 elements, 4x4 grid)
4. **What's the hierarchy?** (e.g., major categories → subcategories)

**Output:**
```
CLASSIFICATION SUBJECT: [What you're organizing]

ORGANIZING DIMENSIONS:
- Dimension 1: [e.g., Complexity: Simple → Complex]
- Dimension 2: [e.g., Impact: Low → High]

CATEGORIES:
1. [Category name] — [Description]
2. [Category name] — [Description]
3. [Category name] — [Description]
...

ITEMS TO CLASSIFY:
- [Item 1] belongs to [Category]
- [Item 2] belongs to [Category]
...
```

---

### Step 2: Design Grid Layout

**Plan the visual organization:**

1. **Layout type:**
   - Periodic table grid (rows and columns)
   - Matrix (2x2, 3x3, 4x4)
   - Hierarchical tree
   - Grouped clusters
   - Linear taxonomy (top to bottom)

2. **Cell structure:**
   - What information in each cell
   - Size of cells (uniform or varied)
   - How categories are grouped visually

3. **Color assignment:**
   - Which categories get orange
   - Which get navy
   - Pattern of color distribution

**Output:**
```
LAYOUT: [Grid type, e.g., 4x4 matrix, Periodic table style]

GRID STRUCTURE:
- [Describe arrangement: "4 rows by 4 columns, grouped by color into quadrants"]
- Cell size: [Uniform squares, varied rectangles, etc.]
- Groupings: [How categories cluster together]

COLOR CODING:
- Orange: [Category type 1]
- Navy: [Category type 2]
- Black: [Remaining structure]

TYPOGRAPHY:
- Title (Tier 1): "[MAIN TITLE]"
- Category headers (Tier 2): [Category names]
- Item labels (Tier 3): [Individual items]
```

---

### Step 3: Construct Prompt

**Use 3-tier typography system:**

### Prompt Template

```
Drafted technical taxonomy grid in editorial notebook style.

STYLE REFERENCE: Periodic table, field guide illustration, reference card aesthetic

BACKGROUND: [White #FFFFFF OR Warm-White Paper #FEF7E0] — clean, flat

AESTHETIC:
- Drafted measured grid lines (slightly measured, human quality)
- Variable stroke weight (grid structure in black)
- Cell borders with slight waviness (not perfect rectangles)
- Editorial flat color aesthetic with strategic accents
- Organized layout but hand-crafted feel

LAYOUT TYPE: [Periodic table grid / Matrix / Hierarchical tree / etc.]

GRID STRUCTURE:
[Describe the grid organization, e.g.:]
- 4 rows by 4 columns of cells
- Each cell contains: [category icon/symbol] + [label text]
- Cells grouped by color into [quadrants/categories]
- Clear visual separation between category groups

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - TAXONOMY HEADER & SUBTITLE (Valkyrie Two-Part System):
Header (Main Title):
- "[Header Text]" — Left-justified at top
- Font: Valkyrie serif italic (elegant, sophisticated)
- Size: Large - 3-4x body text (prominent, commanding attention)
- Style: Italicized, sentence case or title case (NOT all-caps)
- Color: Black #000000 (or Hot Accent Orange #F97316 for emphasis)
- Position: Top-left with margin
- Example: "The Periodic Table of AI Capabilities"

Subtitle (Clarifying Detail):
- "[Subtitle Text]" — Below header
- Font: Valkyrie serif regular (warm, readable)
- Size: Small - 1-1.5x body text (noticeably smaller than header, supportive)
- Style: Regular (NOT italicized), sentence case (first letter capitalized, rest lowercase except proper nouns)
- Color: Black #000000 or Blueprint Navy #1E3A8A
- Position: Small gap below header, aligned left
- Example: "Classification of Machine Learning Functions"

TIER 2 - CATEGORY HEADERS (Concourse Sans):
- "[Category 1]", "[Category 2]", etc.
- Font: Concourse geometric sans-serif, clean, modern
- Size: Medium readable
- Color: Hot Accent Orange #F97316 for Category 1, Blueprint Navy #1E3A8A for Category 2
- Example: "Reasoning", "Creativity", "Perception"

TIER 3 - ITEM LABELS (Advocate Condensed):
- Individual items within cells
- Font: Advocate condensed, smaller
- Size: 60% of Tier 2
- Color: Blueprint Navy #1E3A8A
- Example: Item names, abbreviations, symbols

CONTENT TO INCLUDE:
[List all categories and items to be shown, e.g.:]

CATEGORY 1 (Hot Accent Orange #F97316 headers):
- Item A: [label]
- Item B: [label]
- Item C: [label]

CATEGORY 2 (Blueprint Navy #1E3A8A headers):
- Item D: [label]
- Item E: [label]

[etc.]

COLOR USAGE:
- Black (#000000) for all grid structure, cell borders
- Hot Accent Orange (#F97316) for [Category 1] headers and accents
- Blueprint Navy (#1E3A8A) for [Category 2] headers and accents
- Blueprint Navy (#1E3A8A) for all item labels and body text

CRITICAL REQUIREMENTS:
- Drafted technical engineering-drawing quality — NOT polished digital grid
- Grid lines wobble slightly (human measuredion)
- Cells roughly aligned but organic (grid-aware not grid-perfect)
- No gradients, no shadows, flat colors only
- Clear typography with 3-tier hierarchy
- Scannable and reference-friendly layout
- Strategic color coding for categories

Optional: Sign small in bottom right corner in navy (#1E3A8A).
```

---

### Step 4: Determine Aspect Ratio

**Choose based on taxonomy type:**

| Taxonomy Type | Aspect Ratio | Reasoning |
|---------------|--------------|-----------|
| Wide grid (many columns) | 16:9 or 21:9 | Horizontal periodictable layout |
| Tall hierarchy | 9:16 | Vertical tree structure |
| Square matrix | 1:1 | Balanced 4x4 or 5x5 grid |
| Reference card | 1:1 or 4:3 | Compact, poster-like |

**Default: 1:1 (square)** — Works for most taxonomy grids

---

### Step 5: Execute Generation

```bash
bun Tools/dos-image.ts "[YOUR PROMPT]" \
  --intent=diagram \
  --output=/path/to/taxonomy.png \
  --size=1024x1024 \
  --telemetry-tag=Media/Art/Taxonomies
```

**Model Recommendation:** nano-banana-pro (best text rendering for labels)

**Immediately Open:**
```bash
open /path/to/taxonomy.png
```

---

### Step 6: Validation (MANDATORY)

**Open the generated image and check:**

#### Must Have
- [ ] **Clear grid structure** — Organized layout with visible cells/categories
- [ ] **Readable text** — All labels legible in 3-tier hierarchy
- [ ] **Drafted technical aesthetic** — Measured lines, measured cells, human feel
- [ ] **Strategic color** — Orange/navy differentiate categories, not overwhelming
- [ ] **Scannable** — Easy to find and reference specific items
- [ ] **Hierarchical clarity** — Title > Categories > Items is obvious
- [ ] **Flat aesthetic** — No gradients, maintains brand editorial style

#### Must NOT Have
- [ ] Perfect straight grid lines
- [ ] Polished vector graphics
- [ ] Gradients or shadows
- [ ] Illegible or tiny text
- [ ] Color chaos (too many colors)
- [ ] Confusing organization

#### If Validation Fails

| Problem | Fix |
|---------|-----|
| Grid too perfect | Emphasize "measured drafted technical grid lines, organic measuredion" |
| Text unreadable | Increase text size, strengthen typography tier requirements |
| Too colorful | "Strategic color use — orange for [specific], navy for [specific], rest black" |
| Unclear organization | Simplify grid, reduce categories, clarify groupings |
| Looks digital | Reference "drafted technical field guide, editorial notebook aesthetic" |

---

## Example Use Cases

### Example 1: "Periodic Table of AI Capabilities"
- **Grid:** 5x6 matrix of capabilities
- **Categories:** Reasoning (orange), Creativity (navy), Perception (black), Action (orange), Memory (navy)
- **Items:** Each cell = one capability with icon + label
- **Aspect:** 16:9 (wide grid)

### Example 2: "Cybersecurity Threat Taxonomy"
- **Grid:** Hierarchical tree from top (threat types) to bottom (specific attacks)
- **Categories:** Network threats (orange), Application threats (navy), Human threats (orange)
- **Aspect:** 9:16 (tall tree)

### Example 3: "Business Model Classification"
- **Grid:** 3x3 matrix (complexity vs. scalability)
- **Categories:** 9 business model archetypes
- **Color:** Orange for high-scalability, navy for low-complexity
- **Aspect:** 1:1 (square reference card)

---

## Quick Reference

**Taxonomy Formula:**
```
1. Define classification system (what, dimensions, categories)
2. Design grid layout (structure, cells, color coding)
3. Construct prompt with 3-tier typography
4. Choose aspect ratio for layout type
5. Generate with nano-banana-pro
6. Validate for clarity and aesthetics
```

**Color Strategy:**
- 80% Black structure
- 10% Orange (Category 1)
- 10% Navy (Category 2)
- Text all Navy

**Typography:**
- Tier 1: Massive Advocate title
- Tier 2: Medium Concourse category headers
- Tier 3: Small Advocate item labels

---

**The workflow: Define → Design → Construct → Generate → Validate → Complete**