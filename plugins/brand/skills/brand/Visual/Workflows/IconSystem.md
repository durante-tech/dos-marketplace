---
name: Icon System
description: Coherent icon sets generated from brand DNA with code integration
status: STABLE
featured: true
successRate: 91.8
icon: Sparkles
bestPath:
  - title: "Brand Token Extraction"
    description: "Extract visual tokens from brand system for icon consistency."
  - title: "Style Definition"
    description: "Define stroke weight, corner radius, grid, and optical balance rules."
  - title: "Icon Generation"
    description: "Generate icon set following defined style across all required glyphs."
  - title: "Code Integration"
    description: "Export as React components with proper naming and tree-shaking support."
---

# Icon System

Develop a coherent icon set that extends the brand's visual language. Every icon shares the same geometric DNA as the logo, derived from brand definition tokens.

## When to Use

- User says "icon system", "icon set", "create icons", "brand icons"
- After LogoDesign workflow has produced a finalized logo
- When a product needs a consistent icon library (navigation, features, categories)
- When extending an existing brand with new icon needs

## Prerequisites

- Brand definition document (`Docs/brand-definition.md`) with token architecture
- Finalized logo (`logos/icon.png` or similar) for style reference
- List of icons needed (or workflow will help define the inventory)

## Steps

### Step 1: Load Brand Context and Logo Reference

1. Read `Docs/brand-definition.md` for visual identity tokens
2. Load finalized logo mark (`logos/icon.png`) as style anchor
3. Extract visual DNA from logo: geometric basis (circles/squares/triangles/custom grid), corner treatment (sharp/rounded/mixed), stroke vs fill, weight (thin/medium/bold), negative space usage
4. Ask user for: icon inventory, number of icons, display context, display sizes

### Step 2: Define Icon Style Rules

Derive rules from brand tokens and logo analysis:

**Grid specification:**
- Canvas: 24x24 units (scales to any pixel size)
- Safe area: 2 units padding on all sides (20x20 active area)
- Keyline shapes: circle (20u diameter), square (18x18u), landscape (20x16u), portrait (16x20u)

**Style rules (derived from brand):**

| Rule | Derived From |
|------|-------------|
| Line weight | Logo stroke weight + brand personality (precise = thin, bold = thick) |
| Corner radius | Logo corner treatment + personality (technical = sharp, friendly = rounded) |
| Fill style (outline/solid/duotone) | Logo fill approach |
| Stroke cap (round/square/butt) | Logo line endings |
| Stroke join (round/miter/bevel) | Logo corner joins |
| Color | Brand primary token (`--color-primary`) |
| Detail threshold | Minimum display size determines cutoff |

**Personality-to-style mapping:**
- Precise/Technical: geometric construction, 2px stroke, sharp corners (0-2px radius)
- Friendly/Approachable: rounded corners (3-4px), softer shapes, round stroke caps
- Bold/Confident: thicker stroke (2.5-3px), solid fills, strong silhouettes
- Elegant/Premium: thin stroke (1-1.5px), generous negative space, minimal elements

### Step 3: Generate Icon Set

Use reference chaining for visual consistency:
1. **First icon** -- use logo as reference image, establish the icon style
2. **Subsequent icons** -- use BOTH logo AND first icon as references for double consistency
3. For icons needing text (rare) -- use models with text rendering capability

Post-process each icon for final output:
- Remove background for transparency
- Resize to target sizes (256, 64, 32, 16)
- Apply brand color

### Step 4: Validate Icon Consistency

**Per-icon validation:**
- Follows 24x24 grid with 2-unit padding
- Line weight matches specification
- Corner radius matches specification
- Fill style consistent
- Readable at minimum display size
- Single concept, immediately recognizable
- No text in the icon
- Color matches brand primary

**Cross-set validation:**
- All icons same visual weight
- Stroke weight consistent across set
- Corner treatment consistent
- Level of detail consistent
- All recognizable at 16px
- Set looks like a family when viewed together
- Style consistent with brand logo mark

If any icon fails: regenerate with more specific instructions, or use Flux Kontext to edit the inconsistent element.

### Step 5: Produce Icon Style Guide

Write to `Docs/icon-style-guide.md`:
- Grid system specification
- Complete style rules table
- Icon inventory with concept, file path, and sizes
- "How to add new icons" instructions (grid template, reference images, style rules, validation, post-processing)
- Reference files (logo mark, style anchor icon, brand definition)

## Validation

- [ ] Icon grid defined with specific unit measurements
- [ ] Style rules derived from brand tokens and logo analysis (not arbitrary)
- [ ] Line weight, corner radius, and fill style documented
- [ ] All icons generated with logo as reference image
- [ ] Reference chaining used (logo + first icon for subsequent icons)
- [ ] Post-processing applied for sizing and transparency
- [ ] Per-icon validation completed for each icon
- [ ] Cross-set consistency validation completed
- [ ] Icon style guide produced with "how to add new icons" instructions