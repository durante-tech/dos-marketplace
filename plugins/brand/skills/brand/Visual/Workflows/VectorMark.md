---
name: Vector Mark
description: Vector-first logo and icon authoring — produce an SVG source-of-truth mark from brand tokens, then delegate raster previews and concept exploration to Media ($imagegen)
status: STABLE
featured: false
successRate: 90
icon: Sparkles
bestPath:
  - title: "Token-Driven Vector Construction"
    description: "Author the mark as clean SVG from brand geometry, color, and type tokens — the scalable source of truth."
  - title: "Raster Delegation"
    description: "Hand the SVG to Media ($imagegen) for concept exploration and multi-size raster previews."
  - title: "Multi-Format Export"
    description: "Emit SVG + PNG (512/128/64/32/16) + favicon, all derived from the single vector source."
---

# Vector Mark

Vector-first logo and icon authoring. Unlike LogoDesign (raster concept generation) and IconSystem (raster icon families), this workflow treats a hand-authored **SVG** as the scalable source of truth, then delegates *raster* generation — concept exploration and pixel previews — to the media pack's image-generation surface (`$imagegen`). Vector stays in Brand; raster crosses the pack boundary to Media.

## When to Use

- User says "vector logo", "SVG logo", "vector mark", "vector icon", "code-authored logo", "scalable mark", "SVG icon"
- The mark must be infinitely scalable and editable as code (favicons, app icons, print)
- After Define/TokenSpec has established geometry, color, and type tokens
- When you want a deterministic, token-driven mark rather than purely AI-rastered output

## Relationship to Sibling Workflows

| Workflow | Owns | Raster source |
|---|---|---|
| `LogoDesign.md` | Award-criteria raster logo exploration + lockup system | AI raster models |
| `IconSystem.md` | Coherent raster icon families | AI raster models |
| `VectorMark.md` (this) | SVG source-of-truth mark, token-driven | Delegates raster to Media `$imagegen` |

Use VectorMark when scalability and code-editability are primary; use LogoDesign/IconSystem when exploratory raster concepting is primary. They compose: a LogoDesign concept can be re-authored as a VectorMark SVG.

## Prerequisites

- Brand definition document (`Docs/brand-definition.md`) with archetype, color tokens (OKLCH), typography, and geometric basis
- Brand name finalized (for wordmarks/lettermarks)
- The media pack installed (for the raster delegation step). If Media is unavailable, skip Step 3 and ship SVG-only.

## Steps

### Step 1: Gather Vector Context

1. Read `Docs/brand-definition.md`.
2. Extract the geometric DNA: grid (e.g. 24x24), keyline shapes, stroke weight, corner radius, fill style — the same token vocabulary IconSystem uses.
3. Extract color tokens (resolve `--color-primary` to a concrete OKLCH/hex value for the SVG) and the heading font for any wordmark.
4. Confirm the mark type with the user: wordmark, symbol, lettermark, or combination mark.

### Step 2: Author the SVG Source of Truth

Write clean, hand-authored SVG — not traced raster:

- Use a square `viewBox` (e.g. `0 0 24 24` or `0 0 512 512`) so it scales losslessly.
- Construct geometry from the brand grid: paths/circles/rects on the keyline, snapped to the unit grid.
- Apply tokens as named CSS custom properties where possible, with concrete fallbacks (e.g. `fill="var(--color-primary, #00e1ab)"`).
- Keep it minimal: no embedded raster, no filters that break at small sizes. Target a single-path silhouette that survives the squint test.
- Provide a monochrome variant (single `currentColor` fill) alongside the colored variant.

Save the SVG source to `Docs/logos/mark.svg` (and `Docs/logos/mark-mono.svg`).

### Step 3: Delegate Raster Generation to Media ($imagegen)

For concept exploration and pixel previews, invoke the **Media** skill's image-generation surface — the `$imagegen` entrypoint (DOS in-family: Media → Art → Image Generation). Two delegation modes:

- **Concept exploration** (optional, before Step 2): ask Media to generate raster concept directions from a prompt built out of the brand tokens, then re-author the chosen direction as SVG in Step 2.
- **Raster previews** (after Step 2): render the authored SVG to PNG at each target size.

Concrete call (Media's Art generator; honors Media's rule that all generated images land in `~/Downloads/` first):

```bash
bun ~/Durante/Packs/media/src/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "<brand-token-derived mark concept prompt>" \
  --size 1:1 \
  --output ~/Downloads/mark-concept.png
```

If the `$imagegen` system skill is installed, prefer it; the DOS Media `Generate.ts` tool is the in-family fallback (same pattern HatchPet uses). Brand never generates raster itself — it always crosses to Media.

### Step 4: Export Multi-Format

From the single SVG source, produce:

| Format | Sizes | Source |
|---|---|---|
| SVG | scalable | hand-authored (Step 2) |
| PNG | 512, 128, 64, 32, 16 | rasterized from SVG |
| Favicon | 32, 16 | rasterized from SVG |
| Monochrome | SVG + PNG | `mark-mono.svg` |

Save all variants to `Docs/logos/`.

### Step 5: Validate

Score the mark against the same award criteria as LogoDesign (simplicity, memorability, versatility, timelessness, appropriateness, target 35+/50), plus vector-specific checks:

- SVG `viewBox` is square and path coordinates snap to the brand grid
- No embedded raster, no fragile filters; renders identically at 16px and 512px
- Monochrome variant uses `currentColor` and reads at favicon size
- Color values trace back to brand tokens (not arbitrary hex)

## Validation

- [ ] SVG source authored from brand grid + tokens (not traced raster)
- [ ] Monochrome `currentColor` variant produced
- [ ] Raster previews generated via Media `$imagegen` (Brand did not raster locally)
- [ ] Multi-format export complete (SVG + PNG sizes + favicon) from the single source
- [ ] Award + vector-specific validation passed (target 35+/50)

<!-- artifact-types: logo, icon-set -->
