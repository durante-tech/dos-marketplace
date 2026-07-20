---
name: Illustration Direction
description: Visual content style guide with AI image generation prompt templates
status: BETA
---

# Illustration Direction

Define the brand's illustration and visual content style. Produces a style guide with do/don't examples and AI image generation prompt templates for consistent visual content production.

## When to Use

- Establishing a visual content style for blog, docs, and marketing
- Creating AI image generation prompt templates aligned to brand
- Defining screenshot, diagram, and code block treatments
- Setting illustration style (geometric, hand-drawn, 3D, etc.)

## Steps

### Step 1: Derive Visual Direction from Brand

Read brand personality and visual identity:
- Personality → playful (hand-drawn), precise (geometric), premium (3D), technical (diagrammatic)
- Color system → which brand colors apply to illustrations
- Typography → how text integrates with illustrations

### Step 2: Define Illustration Style

Document the style across dimensions:
- **Geometry**: Rounded vs angular, organic vs structured
- **Detail level**: Minimal/iconic vs detailed/realistic
- **Color treatment**: Full brand palette, monotone, duotone, gradients
- **Line weight**: Thin/precise vs thick/bold
- **Perspective**: Flat/2D, isometric, 3D
- **Human figures**: Abstract shapes, detailed characters, none
- **Texture**: Clean/flat, subtle grain, heavy texture

### Step 3: Define Content Treatments

For developer brands, define treatments for:

| Content Type | Treatment |
|---|---|
| Screenshots | Shadow style, corner radius, background color, browser chrome |
| Code blocks | Syntax theme (matches brand), background, border |
| Diagrams | Excalidraw-style vs Mermaid vs structured, color palette |
| Terminal output | Font, color scheme, prompt style |
| Architecture diagrams | Component shapes, arrow styles, grouping patterns |
| Hero images | Photography vs illustration, composition rules |

### Step 4: Create AI Prompt Templates

For each content type, produce prompt templates that enforce brand style:

```
Blog header illustration:
"[Subject], [brand illustration style], using [brand colors],
[geometry] shapes, [detail level], clean background,
editorial illustration style, --ar 16:9"
```

### Step 5: Produce Style Guide

Output:
- Style definition document with visual examples
- Do/Don't comparison images
- AI prompt template library (per content type)
- Asset treatment specifications
- Reference board of approved visual directions
