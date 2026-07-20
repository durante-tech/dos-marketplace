---
name: TokenSpec
description: Produce a brand token specification document for DesignSystem consumption
status: STABLE
---

# Brand Token Spec

Produce a structured brand token artifact that the DesignSystem/Init workflow (and the wider AI-codegen fleet) can consume to generate DESIGN.md. This is the bridge between brand identity decisions and code implementation.

This workflow co-emits **two** files that travel together:

- `{project}/brand-tokens.json` — the **canonical** machine-readable token artifact in W3C DTCG 2025.10 (the source of truth; design-tool- and codegen-ready).
- `{project}/brand-token-spec.md` — a **human-readable companion generated FROM the JSON** (a rendered view, not the source of truth).

The JSON is canonical; the markdown is a view of it. Ship the JSON **additively** beside the markdown — co-emitted, never a cutover.

## When to Use

- After Visual sub-skill workflows (ColorSystem, Typography, MotionLanguage) have defined the visual identity
- User says "brand token spec", "prepare for design system", "tokens for DesignSystem"
- Before running DesignSystem/Init with brand-aware mode

## Prerequisites

- Brand strategy output — `Docs/brand-definition.md` from `Strategy/Define` (**REQUIRED** identity doc; carries brand core, positioning, voice, and the three-layer token architecture)
- Visual identity decisions (color palette, typography, motion language) — optional
- If `Docs/brand-definition.md` is missing, this workflow **FLAGS and halts** rather than silently deriving an identity — run `Strategy/Define` first. If only the Visual outputs are missing, it derives reasonable token *values* from the identity doc's personality using the three-layer architecture (the identity doc itself is never defaulted).

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Load Brand Identity

Read brand outputs from the project:
1. `Docs/brand-definition.md` (**REQUIRED**) — brand core, personality, archetype, positioning, voice, and the three-layer token architecture written by `Strategy/Define`. If this file does NOT exist, **FLAG it to the user and halt** — do not silently default an identity. Recovery: run `Strategy/Define` first. (This is the strategy-identity hub under `Docs/`; it is distinct from the Verbal pack's separate messaging artifact under `Docs/brand-messaging/`, which this workflow does not read.)
2. Visual sub-skill outputs — color palette, typography scale, motion language.
3. If only the Visual outputs are missing, derive token *values* from the brand personality in `Docs/brand-definition.md` using the three-layer token architecture (the identity doc itself is never defaulted).

### Step 2: Compile Color Spec

Structure the color palette into DesignSystem-consumable format:

```markdown
## Colors

### Palette
| Token | Value (OKLCH) | Semantic Role | Brand Rationale |
|-------|---------------|---------------|-----------------|
| `brand-primary` | oklch(...) | Primary actions, key accents | [Why this color fits the brand] |
...

### Rules
- [Brand-specific color rules]
- [Accessibility requirements]
- [Dark mode derivation approach]
```

Include the brand rationale for each color — this is what DesignSystem lacks without Brand input.

### Step 3: Compile Typography Spec

```markdown
## Typography

### Scale
| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
...

### Fonts
- Headings: [font] — [why it fits the brand]
- Body: [font] — [why it fits the brand]
- Code: [font]

### Rules
- [Brand-specific type rules]
```

### Step 4: Compile Spacing Spec

```markdown
## Spacing

### Scale
| Token | Value | Usage |
|-------|-------|-------|
...

### Philosophy
- [Airy vs dense, why]
```

### Step 5: Compile Motion Spec

```markdown
## Motion

### Duration Scale
| Token | Value | Usage |
|-------|-------|-------|
...

### Easing Curves
| Token | Value | Usage |
|-------|-------|-------|

### Scroll Behavior
- [Brand-specific scroll philosophy]

### Reduced Motion
- [Strategy for prefers-reduced-motion]
```

### Step 6: Compile Component Blueprints

Define high-level component patterns based on brand personality:

```markdown
## Component Blueprints

### Card
- [Brand-specific card treatment]

### Button (Primary)
- [Brand-specific button treatment]

### [Other key components]
```

### Step 7: Serialize to Canonical DTCG JSON (headline)

Serialize the three-layer token model compiled in Steps 2–6 into the **canonical** artifact `{project}/brand-tokens.json` in **W3C DTCG 2025.10** (schema: `https://design-tokens.github.io/community-group/format/`). This JSON — not the markdown — is the source of truth, and it imports natively into Figma Variables, Tokens Studio, and Style Dictionary v5.

**One shared dialect (pinned across the fleet).** Use the SAME DTCG dialect already emitted by `DesignBundle/RunPipeline` (its `tokens.json` step D11 — W3C DTCG 2025.10, `$type` / `$value` / `$description`). Do NOT invent a new format: Brand and DesignBundle are pinned to one shared DTCG dialect so every downstream consumer reads one shape. (In-pack precedent: `Guidelines/GenerateGuidelines` already emits `brand-guidelines.json` beside its markdown — this follows that JSON-beside-markdown pattern.)

**Structure contract** (so the producer, the validator, and every consumer agree):

- Every token is an object `{ "$value": <value>, "$type": "<type>" }`, where `$type ∈ { color, dimension, fontFamily, fontWeight, duration, cubicBezier, number, shadow, typography }`. `$description` is optional.
- The three architecture layers serialize as DTCG token **groups** with `{group.token}` **aliasing**:
  - `option` — primitives: raw OKLCH colors, px/rem dimensions, font families/weights, durations, easing curves. Hold **literal** `$value`s.
  - `decision` — semantic tokens that **alias** `option` via `"$value": "{option.color.blue-500}"`.
  - `component` — component-scoped tokens that **alias** `decision` via `"$value": "{decision.color.brand-primary}"`.
- **Version marker (conformance):** the root group carries a top-level `"$schema"` AND `"$extensions": { "dos.version": "1.0.0", "dos.dialect": "dtcg-2025.10" }` so consumers can assert conformance before reading.

**Complete reference example** (a small-but-full three-layer artifact — emit this exact shape):

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "$description": "Brand tokens — canonical artifact emitted by Brand/Implementation/TokenSpec (W3C DTCG 2025.10).",
  "$extensions": {
    "dos.version": "1.0.0",
    "dos.dialect": "dtcg-2025.10",
    "dos.source": "Brand/Implementation/TokenSpec",
    "dos.companion": "brand-token-spec.md"
  },
  "option": {
    "color": {
      "ink-900":   { "$value": "oklch(0.18 0.02 250)", "$type": "color", "$description": "Near-black ink primitive" },
      "blue-500":  { "$value": "oklch(0.55 0.2 250)",  "$type": "color", "$description": "Core brand blue primitive" },
      "blue-300":  { "$value": "oklch(0.72 0.13 250)", "$type": "color", "$description": "Lighter brand blue for dark surfaces" },
      "paper-050": { "$value": "oklch(0.98 0 250)",    "$type": "color", "$description": "Page background primitive" }
    },
    "dimension": {
      "space-8":   { "$value": "0.5rem", "$type": "dimension" },
      "space-16":  { "$value": "1rem",   "$type": "dimension" },
      "radius-8":  { "$value": "0.5rem", "$type": "dimension" }
    },
    "font": {
      "family-sans":    { "$value": ["Inter", "system-ui", "sans-serif"], "$type": "fontFamily" },
      "family-mono":    { "$value": ["JetBrains Mono", "monospace"],       "$type": "fontFamily" },
      "weight-regular": { "$value": 400, "$type": "fontWeight" },
      "weight-bold":    { "$value": 700, "$type": "fontWeight" },
      "size-body":      { "$value": "1rem",   "$type": "dimension" },
      "size-h1":        { "$value": "2.5rem", "$type": "dimension" }
    },
    "duration": {
      "fast": { "$value": "150ms", "$type": "duration" },
      "base": { "$value": "300ms", "$type": "duration" }
    },
    "cubicBezier": {
      "standard": { "$value": [0.4, 0, 0.2, 1], "$type": "cubicBezier" }
    }
  },
  "decision": {
    "color": {
      "brand-primary":         { "$value": "{option.color.blue-500}",  "$type": "color", "$description": "Primary actions, key accents" },
      "brand-primary-on-dark": { "$value": "{option.color.blue-300}",  "$type": "color" },
      "text-default":          { "$value": "{option.color.ink-900}",   "$type": "color" },
      "surface-default":       { "$value": "{option.color.paper-050}", "$type": "color" }
    },
    "space": {
      "inline-sm": { "$value": "{option.dimension.space-8}",  "$type": "dimension" },
      "stack-md":  { "$value": "{option.dimension.space-16}", "$type": "dimension" }
    },
    "typography": {
      "heading-1": {
        "$type": "typography",
        "$value": {
          "fontFamily": "{option.font.family-sans}",
          "fontWeight": "{option.font.weight-bold}",
          "fontSize":   "{option.font.size-h1}",
          "lineHeight":  1.1
        }
      },
      "body": {
        "$type": "typography",
        "$value": {
          "fontFamily": "{option.font.family-sans}",
          "fontWeight": "{option.font.weight-regular}",
          "fontSize":   "{option.font.size-body}",
          "lineHeight":  1.5
        }
      }
    },
    "motion": {
      "transition-fast": { "$value": "{option.duration.fast}",        "$type": "duration" },
      "easing-standard": { "$value": "{option.cubicBezier.standard}", "$type": "cubicBezier" }
    }
  },
  "component": {
    "button": {
      "bg":         { "$value": "{decision.color.brand-primary}",   "$type": "color" },
      "fg":         { "$value": "{decision.color.surface-default}", "$type": "color" },
      "padding-x":  { "$value": "{decision.space.stack-md}",        "$type": "dimension" },
      "radius":     { "$value": "{option.dimension.radius-8}",      "$type": "dimension" },
      "transition": { "$value": "{decision.motion.transition-fast}","$type": "duration" }
    },
    "card": {
      "bg":      { "$value": "{decision.color.surface-default}", "$type": "color" },
      "text":    { "$value": "{decision.color.text-default}",    "$type": "color" },
      "padding": { "$value": "{decision.space.stack-md}",        "$type": "dimension" },
      "radius":  { "$value": "{option.dimension.radius-8}",      "$type": "dimension" }
    }
  }
}
```

### Step 8: Generate Companion Markdown (from the JSON)

`{project}/brand-token-spec.md` is a **human-readable companion GENERATED FROM `brand-tokens.json`** — a rendered view, not the source of truth. Render it from the canonical JSON with:
1. Header noting this is a DesignSystem input spec AND that `brand-tokens.json` is the canonical artifact it is generated from.
2. The prose tables from Steps 2–6 (Colors / Typography / Spacing / Motion / Component Blueprints), each row derived from the JSON, carrying the brand rationale that the JSON's `$description` fields can't fully express.
3. Integration instructions: "Run DesignSystem/Init with `brand-tokens.json` (canonical) — or this markdown companion — as brand brief input."

Whenever the tokens change, regenerate the markdown from the JSON; never hand-edit the markdown as if it were the source of truth.

### Step 9: Validate

- [ ] `brand-tokens.json` emitted **beside** `brand-token-spec.md` (co-emitted, additive — both present)
- [ ] JSON is valid W3C DTCG 2025.10 with `$schema` + `$extensions.dos.version` version marker
- [ ] All three groups present (`option` / `decision` / `component`) with `{group.token}` aliasing: decision → option, component → decision
- [ ] All color `$value`s use OKLCH (literal in `option`; aliases in `decision`/`component`)
- [ ] Typography / spacing / motion tokens have concrete values (not placeholders)
- [ ] Markdown companion is generated from the JSON (JSON canonical), brand rationale included
- [ ] Motion spec includes reduced-motion strategy
- [ ] Clear integration path to DesignSystem/Init documented

## Output

- `{project}/brand-tokens.json` — **canonical** W3C DTCG 2025.10 token artifact (design-tool- and codegen-ready; consumed by DesignSystem/Init and the wider AI-codegen fleet).
- `{project}/brand-token-spec.md` — human-readable companion generated from the JSON.

**Next step:** Run `DesignSystem/Init` with brand brief mode, pointing at `brand-tokens.json` (canonical), to generate DESIGN.md from this spec.
