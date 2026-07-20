---
name: Logo Design
description: Award-winning logo development from brand DNA and token architecture
status: STABLE
featured: true
successRate: 88
icon: Sparkles
bestPath:
  - title: "Brand DNA Analysis"
    description: "Extract core brand values, personality, and visual identity tokens."
  - title: "Concept Generation"
    description: "Generate multiple logo concepts aligned with brand positioning."
  - title: "Refinement Rounds"
    description: "Iterate on selected concepts with typography, spacing, and color refinement."
  - title: "Multi-Format Export"
    description: "Export final logo in SVG, PNG, favicon, and social media formats."
---

# Logo Design

Award-winning logo development pipeline. From competitive research through concept exploration to a complete lockup system with validation against elite criteria.

## When to Use

- User says "design logo", "create logo", "logo for [brand]", "brand mark"
- After Define workflow has established brand strategy, tokens, and personality
- When a brand needs its primary visual mark designed from scratch
- When rebranding and need to explore new logo directions

## Prerequisites

- Brand definition document (`Docs/brand-definition.md`) with archetype, color tokens, typography, positioning, and audience
- Brand name finalized

## Steps

### Step 1: Gather Logo Context

1. Read `Docs/brand-definition.md`
2. Extract: brand name (exact spelling/capitalization), archetype (informs visual metaphor), color tokens, typography (heading font for wordmark), positioning (uniqueness), audience
3. Ask user for: logo types to explore, existing marks or assets, symbols/metaphors to include or avoid, industry constraints

### Step 2: Research Competitive Logos

Spawn parallel researchers:
- **Award-winning logo analysis** -- 15-20 award-winning logos (Pentawards, D&AD, Brand New), geometric analysis, common traits of winning marks
- **Competitive mark analysis** -- top 10 logos in the category, logo types, colors, geometric construction, differentiation, weaknesses, mark space map
- **Semiotics and symbol analysis** -- visual semiotics for the brand archetype, shapes that signal archetype traits, negative space techniques, trend assessment

### Step 3: Define 4 Concept Directions

Each direction must be a DIFFERENT type for genuine creative divergence:

**Direction A: Wordmark** -- pure typography, custom modifications, ligatures, unique letterforms. Best for short/distinctive names.

**Direction B: Symbol/Mark** -- abstract or literal icon, stands alone, geometric construction, negative space, visual metaphor. Best for global recognition.

**Direction C: Lettermark/Monogram** -- initials as designed mark, interlocking forms, geometric letter construction. Best for long names or interesting initial combinations.

**Direction D: Combination Mark** -- symbol + wordmark lockup, separable for flexible use. Best for new brands needing both recognition and name awareness.

Document each direction: visual concept, geometric basis, color treatment, differentiation, visual metaphor, risks.

### Step 4: Generate Logo Concepts

For each direction, generate 3-4 variations using appropriate image generation models:
- Wordmarks: models with strong text rendering (GPT Image, Ideogram)
- Symbols: models with clean shapes and reference iteration (Gemini, Recraft)
- Lettermarks: text rendering + refinement (GPT Image, then Flux Kontext)
- Combination marks: reference consistency (Gemini)

Present all 12-16 concepts with strengths, weaknesses, and direction-brief alignment.

### Step 5: Refine Selected Direction

After user selects a direction:
1. Iterative refinement using Flux Kontext with reference images
2. 2-3 rounds with user feedback
3. Test at multiple sizes: full (512+), medium (128), small (64), favicon (32, 16)
4. Test in monochrome: white on black, black on white

### Step 6: Produce Lockup System

Generate the full 7-variant lockup system using the refined logo as reference for every generation:

| Variant | Description |
|---------|-------------|
| Primary | Full logo, horizontal (symbol + wordmark) |
| Stacked | Symbol above wordmark, vertical |
| Icon-only | Symbol/mark without text |
| Monochrome | Single-color version (white) |
| Favicon | Simplified for 32x32 rendering |
| Dark variant | Optimized for dark backgrounds |
| Light variant | Optimized for light backgrounds |

Save all variants to `Docs/logos/` directory.

### Step 7: Validate Against Award Criteria

Score 1-10 on each criterion:
1. **Simplicity** -- minimal elements, describable in one sentence, drawable from memory
2. **Memorability** -- distinctive hook, recognizable after one viewing
3. **Versatility** -- works at favicon AND billboard, monochrome, dark AND light
4. **Timelessness** -- avoids trendy effects, classic geometric construction
5. **Appropriateness** -- reflects what the brand does, audience would trust this mark

**Overall Logo Score: X/50** (target 35+ for shipping quality)

Additional checks: squint test, thumbnail test, monochrome test, context test, no competitor resemblance.

### Step 8: Document and Handoff

Save logo system documentation with: selected direction, concept, geometric basis, award score, lockup variant table with files, usage guidelines (clear space, minimum size, do-not rules).

Recommend downstream workflows: embossed logo wallpaper, brand wallpaper, pack icon creation.

## Validation

- [ ] Research covered 15+ award-winning logos and 10+ competitive marks
- [ ] 4 distinct directions defined (different types, not variations)
- [ ] 12-16 concepts generated across directions
- [ ] Selected direction refined through 2-3 iteration rounds
- [ ] All 7 lockup variants generated with reference image consistency
- [ ] Award criteria scorecard completed (target 35+/50)
- [ ] Logo passes squint, thumbnail, monochrome, and context tests
- [ ] Downstream workflows documented