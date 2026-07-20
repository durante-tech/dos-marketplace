---
name: Color System
description: Brand color palette with accessibility, usage rules, and semantic mapping
status: BETA
---

# Color System

Generate a comprehensive color system from brand personality. OKLCH color space for perceptual uniformity. WCAG accessibility built in.

## When to Use

- Defining brand colors for the first time
- Expanding a basic palette into a full color system
- Checking accessibility compliance of existing colors
- Creating semantic color mappings (primary, accent, success, error)

## Steps

### Step 1: Derive Color Direction from Brand

Read brand Strategy outputs:
- Brand personality and archetype
- Competitive landscape (avoid competitor colors)
- Industry conventions and expectations
- Cultural considerations for target markets

### Step 2: Generate Primary Palette

Using OKLCH color space:
1. Select primary color aligned with brand personality
2. Generate harmonious secondary colors (complementary, analogous, or triadic)
3. Create neutral scale (warm or cool, aligned with primary)
4. Define accent colors for emphasis and CTAs

### Step 3: Build Semantic Color Map

| Role | Token | Usage |
|------|-------|-------|
| Primary | `--color-primary` | Brand identity, CTAs, active states |
| Secondary | `--color-secondary` | Supporting elements, secondary actions |
| Accent | `--color-accent` | Highlights, notifications, emphasis |
| Neutral | `--color-neutral-{50-950}` | Backgrounds, text, borders |
| Success | `--color-success` | Positive states, confirmations |
| Warning | `--color-warning` | Caution states, alerts |
| Error | `--color-error` | Error states, destructive actions |

### Step 4: Verify Accessibility

Check all text/background combinations against WCAG 2.1:
- AA: 4.5:1 contrast for normal text, 3:1 for large text
- AAA: 7:1 contrast for normal text, 4.5:1 for large text
- Flag any failing combinations with remediation suggestions

### Step 5: Define Usage Rules

Document:
- Color ratio guidelines (60/30/10 primary/secondary/accent)
- Dark mode palette derivation
- Gradient rules (which colors can gradient, direction, stops)
- Color-on-color combinations (allowed vs forbidden)
- Print color specs (Pantone, CMYK)
