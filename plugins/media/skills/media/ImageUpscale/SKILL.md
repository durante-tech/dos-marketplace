---
name: ImageUpscale
description: Upscale and enhance image resolution using multiple AI models — Recraft Crisp, Google Upscaler, Real-ESRGAN (with GFPGAN face enhance), and Clarity Upscaler (prompt-guided, HDR). USE WHEN upscale image, enlarge image, increase resolution, super resolution, enhance resolution, 2x, 4x, upscaler.
role: executor
accepts:
  - url
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# ImageUpscale Skill

Upscale and enhance image resolution using a unified CLI with 4 providers.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ImageUpscale/`

## Available Models

| Model | Provider | Speed | Features |
|-------|----------|-------|----------|
| `recraft` | Recraft AI | ~5s | Simple, high quality, just image in |
| `google` | Google Upscaler | ~5s | 2x or 4x, compression quality control |
| `real-esrgan` | Real-ESRGAN | ~5s | Scalable upscale, optional GFPGAN face enhancement |
| `clarity` | Clarity Upscaler | ~15s | Prompt-guided, HDR, creativity/resemblance controls |

## Model Selection Guide

| Use Case | Recommended Model |
|----------|------------------|
| Quick simple upscale | `recraft` (simplest, high quality) |
| Exact 2x or 4x | `google` with `--scale` |
| Portrait / face photo | `real-esrgan` with `--face-enhance` |
| Creative enhancement | `clarity` with `--prompt` and `--creativity` |
| HDR / dynamic range | `clarity` with `--dynamic` |
| Faithful enlargement | `clarity` with high `--resemblance` |
| Product photos | `recraft` or `google` |
| Batch / fast processing | `recraft` (fewest params, fast) |

## Intent-to-Flag Mapping

| User Says | Flags | Model |
|-----------|-------|-------|
| "upscale", "make bigger" | `--model recraft` | Simple default |
| "2x", "double resolution" | `--model google --scale 2` | Exact factor |
| "4x", "quadruple" | `--model google --scale 4` | Exact factor |
| "upscale face", "enhance portrait" | `--model real-esrgan --face-enhance` | Face focus |
| "enhance with prompt", "creative upscale" | `--model clarity --prompt "<guidance>"` | Guided |
| "HDR", "more dynamic" | `--model clarity --dynamic 6` | HDR effect |
| "keep it faithful", "no changes" | `--model clarity --resemblance 1.4` | High fidelity |
| "sharp", "crisp" | `--model recraft` | Best edge quality |
| "compress less", "high quality output" | `--model google --quality 95` | Quality control |

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Upscale image, enlarge, increase resolution | `Workflows/UpscaleImage.md` |
| Enhance image resolution, super resolution | `Workflows/UpscaleImage.md` |

## Usage

```bash
# Recraft — simple high quality upscale
bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
  --model recraft --image ~/Downloads/photo.jpg

# Google — 4x upscale
bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
  --model google --image ~/Downloads/small.png --scale 4 --quality 90

# Real-ESRGAN — with face enhancement
bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
  --model real-esrgan --image ~/Downloads/portrait.jpg --scale 4 --face-enhance

# Clarity — prompt-guided creative upscale
bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
  --model clarity --image ~/Downloads/landscape.jpg \
  --prompt "sharp detailed landscape, 8k" --scale 2 --creativity 0.5
```

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Examples

**Example 1: Quick product photo upscale**
```
User: "upscale this product image"
-> Uses Upscale.ts with --model recraft
-> Outputs to ~/Downloads/upscaled.png
```

**Example 2: Portrait enhancement**
```
User: "enhance this headshot, make it 4x resolution"
-> Uses Upscale.ts with --model real-esrgan --scale 4 --face-enhance
-> GFPGAN enhances facial details
-> Outputs to ~/Downloads/upscaled.png
```

**Example 3: Creative landscape enhancement**
```
User: "upscale this landscape with more detail and HDR"
-> Uses Upscale.ts with --model clarity --prompt "detailed landscape, HDR" --dynamic 6
-> Outputs to ~/Downloads/upscaled.png
```
