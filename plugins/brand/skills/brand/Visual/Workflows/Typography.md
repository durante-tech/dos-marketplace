---
name: Typography
description: Type scale, font pairing, and responsive hierarchy for brand
status: BETA
---

# Typography System

Define the brand's typographic system — type scale, font pairing, weight hierarchy, and responsive behavior.

## When to Use

- Selecting fonts for a new brand
- Creating a type scale and hierarchy
- Pairing heading and body typefaces
- Defining responsive typography behavior

## Steps

### Step 1: Derive Typography Direction

From brand Strategy:
- Brand personality → formal/casual, modern/traditional, technical/friendly
- Target audience → developer (monospace preferences), consumer (readability focus)
- Competitive analysis → what typefaces competitors use, where whitespace exists

### Step 2: Select Typefaces

Recommend primary (heading) and secondary (body) typefaces:
- Consider: licensing (Google Fonts, Adobe Fonts, custom), performance (variable fonts), language support
- Provide 2-3 pairing options with rationale
- Include monospace recommendation for code contexts

### Step 3: Define Type Scale

Using a modular scale (e.g., 1.25 major third, 1.333 perfect fourth):

| Level | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| Display | 4rem | 800 | 1.1 | Hero headlines |
| H1 | 2.5rem | 700 | 1.2 | Page titles |
| H2 | 2rem | 700 | 1.25 | Section heads |
| H3 | 1.5rem | 600 | 1.3 | Sub-sections |
| Body | 1rem | 400 | 1.6 | Paragraphs |
| Small | 0.875rem | 400 | 1.5 | Captions, meta |
| Code | 0.9rem | 400 | 1.5 | Code blocks |

### Step 4: Define Responsive Behavior

- Fluid typography scale using `clamp()`
- Breakpoint adjustments (mobile reduces scale ratio)
- Minimum readable sizes per device

### Step 5: Produce Typography Tokens

Output as three-layer tokens:
- Option: `--font-size-48: 3rem; --font-weight-bold: 700;`
- Decision: `--heading-size-hero: var(--font-size-48);`
- Component: `--hero-heading-size: var(--heading-size-hero);`
