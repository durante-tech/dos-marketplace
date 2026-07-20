---
name: Define
description: 
status: STABLE
---

# Brand Definition

Define brand strategy and identity. Outputs a three-layer token architecture (option/decision/component) that bridges directly to code implementation.

## When to Use

- After Research workflow produces a brand research report
- User says "define brand", "create brand identity", "brand strategy"
- User has enough context to make brand decisions

## Prerequisites

- Brand research report (from Research workflow) OR sufficient user-provided context
- Understanding of target audience and competitive landscape
- Product/company name and description

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Load Context

1. Read the brand research report if available (`Docs/brand-research-report.md`)
2. Extract key decision inputs: archetype, typography candidates, color options, motion personality, competitive white space, anti-patterns

### Step 2: Define Brand Core

Lock the strategic foundation. Each decision must reference research evidence.

**Brand Core:**
- **Mission** -- why the company exists (one sentence, active voice)
- **Vision** -- the future state it creates (one sentence, aspirational but concrete)
- **Values** -- 3-5 guiding principles (each with a behavioral definition, not just a word)
- **Archetype** -- primary + shadow archetype from research taxonomy

**Positioning:**
- **Target audience** -- primary segment with JTBD
- **Market category** -- where this brand competes
- **Value proposition** -- structured: [For X] [who Y] [product] is [category] that [key benefit] [unlike competitors] [unique differentiator]
- **Emotional positioning** -- how users should FEEL when interacting with the brand

**Voice:**
- **Tone spectrum** -- 3 adjectives on a continuum (e.g., "precise but not cold, confident but not arrogant")
- **Do/Don't pairs** -- 5 pairs showing voice in action
- **Vocabulary register** -- word choices that signal brand personality
- **Sentence patterns** -- short/long mix, active/passive preference

### Step 3: Define Visual Identity as Token Architecture

Every visual decision expressed as a three-layer token.

**3a: Color System (OKLCH)**
- Option tokens: 5-7 base hues with full lightness scales (50-950) in oklch()
- Decision tokens: semantic assignments (primary, secondary, accent, success, warning, error, neutral)
- Component tokens: applied colors for specific UI contexts (hero-accent, section-bg, text-primary)
- Dual-mode: both light (:root) and dark (.dark) decision token assignments
- Contrast: all text/bg combinations WCAG AA compliant

**3b: Typography Hierarchy**
- Option tokens: raw type scale (12px through 72px), font families, weights, line heights
- Decision tokens: semantic assignments (heading-font, body-font, heading-size-hero, body-size-default)
- Component tokens: applied type (hero-heading-size, section-heading-size, card-title-size)

**3c: Motion Language**
- Option tokens: duration scale (instant through cinematic), easing curves
- Decision tokens: semantic motion (entrance, exit, emphasis, scroll-reveal, hover)
- Component tokens: applied motion (hero-reveal-duration, section-entrance, card-hover)

### Step 4: Personality-to-Token Mapping

Document WHY each token choice reflects the brand personality:

| Brand Trait | Token Expression | Rationale |
|------------|-----------------|-----------|
| [trait] | [specific token choice] | [why this choice reflects the trait] |

### Step 5: Implementation Mapping

Show how tokens connect to code artifacts:

| Token Layer | Code Artifact | Format |
|------------|---------------|--------|
| Option tokens (colors) | `theme.css` `:root` block | CSS custom properties |
| Decision tokens (colors) | `theme.css` semantic section | CSS custom properties |
| Component tokens (colors) | `stage-colors.ts` | TypeScript config |
| Option tokens (typography) | `fonts.ts` | next/font configuration |
| Motion tokens (all layers) | `motion-tokens.ts` | TypeScript constants |

### Step 6: Produce Brand Definition Document

Write the complete brand definition to `Docs/brand-definition.md` including: brand core, positioning, voice, token architecture (all three layers for color, typography, motion), personality-token mapping, implementation mapping, and decision log.

### Step 7: Handoff

1. Present key decisions to user for validation
2. Recommend next workflows: Implement, Handoff, or Audit

## Validation

- [ ] Brand core has mission, vision, values, archetype with evidence
- [ ] Positioning includes structured value proposition
- [ ] Voice has do/don't pairs (not just adjectives)
- [ ] Color system uses OKLCH with all three token layers
- [ ] Typography hierarchy has three token layers with concrete values
- [ ] Motion language has three token layers with easing curves and durations
- [ ] Every visual decision maps to a brand personality trait
- [ ] Implementation mapping shows which code artifact each token feeds
- [ ] Decision log references research findings