---
name: Brand Wallpaper
description:
status: STABLE
---

# Brand Wallpaper Workflow

Create branded desktop, social, or presentation wallpaper from a supplied logo, brand mark, or identity direction.

## Purpose

Use this workflow when the user wants a brand-centered background rather than a general illustration. The output should make the brand mark the first read, keep enough negative space for icons or overlays, and preserve brand colors without turning the wallpaper into an ad.

## Inputs

- Required: target brand, logo/mark path or URL, desired aspect ratio.
- Optional: palette, typography direction, intended surface, mood, required copy.
- If no logo file is available, ask for the logo or route to `Workflows/ImageEdit.md` only after the user provides an existing image.

## Workflow Steps

### Step 1: Define the Surface

Confirm the target size before generation:

| Surface | Aspect ratio | Default output |
|---------|--------------|----------------|
| Desktop wallpaper | 16:9 | 3840x2160 |
| Presentation background | 16:9 | 1920x1080 |
| Mobile wallpaper | 9:16 | 1440x2560 |
| Social banner | 3:1 | 3000x1000 |

### Step 2: Build the Composition

- Keep the mark readable at 25% zoom.
- Reserve at least one calm region for desktop icons, UI overlays, or title text.
- Use brand colors as anchors, not a full-canvas wash.
- Avoid fake logos, distorted marks, invented taglines, and unreadable microtext.

### Step 3: Generate or Composite

For generation from a brand reference:

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-pro \
  --prompt "[brand-aware wallpaper prompt]" \
  --reference-image "[logo-or-brand-reference-url]" \
  --size 16:9 \
  --output ~/Downloads/brand-wallpaper.png
```

For precise logo placement on an existing visual, route through `Workflows/ImageEdit.md` and specify exactly what must remain unchanged.

### Step 4: Verify

- Logo or mark is legible and not warped.
- Palette matches the source brand.
- No hallucinated slogans, URLs, or product names.
- Background has usable negative space.
- Final dimensions match the requested surface.

## Related Workflows

- `Workflows/ImageEdit.md` - place or adjust a logo on an existing image.
- `Workflows/RemoveBackground.md` - prepare transparent marks before compositing.
- `Workflows/StyleTransfer.md` - keep a brand system consistent across variants.
