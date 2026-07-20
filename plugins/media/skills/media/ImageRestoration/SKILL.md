---
name: ImageRestoration
description: Restore, enhance, and upscale damaged or low-quality images using AI models — CodeFormer (face + bg), GFPGAN (face identity), Flux Restore (general). USE WHEN restore image, fix old photo, enhance photo, upscale image, face restoration, deblur, denoise, old photo repair, image quality, sharpen, restore face.
role: executor
accepts:
  - url
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ImageRestoration/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# ImageRestoration Skill

Restore, enhance, and upscale images using a unified CLI with 3 AI models.

## Available Models

| Model | Provider | Best For | Upscale | Face Focus |
|-------|----------|----------|---------|------------|
| `codeformer` | CodeFormer (Replicate) | Face restoration + background enhance | Up to 8x | Yes |
| `gfpgan` | GFPGAN (Replicate) | Face restoration with identity preservation | Yes | Yes |
| `flux-restore` | Flux Kontext (Replicate) | General image restoration, denoising | No | No |

## Model Selection Guide

| Use Case | Recommended Model |
|----------|------------------|
| Old family photo (faces) | `codeformer` with `--fidelity 0.5 --background-enhance` |
| Blurry face fix | `gfpgan --version v1.4` |
| Low-quality face + upscale | `codeformer --face-upsample --upscale 2` |
| General denoising / cleanup | `flux-restore` |
| Maximum identity preservation | `gfpgan --version v1.4` |
| Full scene restoration | `codeformer --background-enhance --upscale 2` |

## Intent-to-Flag Mapping

| User Says | Flags | Model |
|-----------|-------|-------|
| "restore this photo" | `--model codeformer --fidelity 0.5` | Default |
| "fix the faces" | `--model codeformer --face-upsample` | Face focus |
| "upscale this" | `--model codeformer --upscale 2 --background-enhance` | Full scene |
| "preserve identity" | `--model gfpgan --version v1.4` | Identity-aware |
| "denoise", "clean up" | `--model flux-restore` | General |
| "old photo" | `--model codeformer --fidelity 0.5 --background-enhance --face-upsample` | Full restore |

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Restore image, fix photo, enhance, upscale | `Workflows/RestoreImage.md` |

## Usage

```bash
# Restore old photo with face enhancement
bun run ~/.claude/skills/media/ImageRestoration/Tools/Restore.ts \
  --model codeformer \
  --image ~/Downloads/old-family-photo.jpg \
  --fidelity 0.5 \
  --background-enhance \
  --face-upsample \
  --output ~/Downloads/restored-photo.png

# Quick face fix with GFPGAN
bun run ~/.claude/skills/media/ImageRestoration/Tools/Restore.ts \
  --model gfpgan \
  --image blurry-headshot.jpg \
  --version v1.4 \
  --scale 2

# General image restoration
bun run ~/.claude/skills/media/ImageRestoration/Tools/Restore.ts \
  --model flux-restore \
  --image noisy-screenshot.png
```

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Examples

**Example 1: Restore old family photo**
```
User: "restore this old photo of my grandparents"
→ Uses codeformer with --fidelity 0.5 --background-enhance --face-upsample
→ Outputs restored PNG to ~/Downloads/
```

**Example 2: Fix blurry profile picture**
```
User: "sharpen this headshot"
→ Uses gfpgan with --version v1.4 --scale 2
→ Preserves identity while enhancing detail
```

**Example 3: Clean up noisy image**
```
User: "denoise this screenshot"
→ Uses flux-restore for general cleanup
→ Outputs clean PNG to ~/Downloads/
```
