---
name: BackgroundRemoval
description: Remove backgrounds from images using multiple providers — 851 Labs (soft alpha, green screen, blur, custom bg), Lucataco Remove BG (fast, clean edges), and remove.bg API (cloud). USE WHEN remove background, transparent background, background removal, cut out, green screen, blur background, isolate subject, removebg, transparent png.
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
# BackgroundRemoval Skill

Remove backgrounds from images using a unified CLI with 3 providers.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/BackgroundRemoval/`

## Available Models

| Model | Provider | Speed | Features |
|-------|----------|-------|----------|
| `851-labs` | 851 Labs (Replicate) | ~5s | Soft alpha, green screen, blur bg, custom color, reverse mode |
| `remove-bg` | Lucataco (Replicate) | ~2s | Fast, clean edges, simple |
| `removebg-api` | remove.bg API | ~3s | Cloud service, 50 free/month |

## Model Selection Guide

| Use Case | Recommended Model |
|----------|------------------|
| Quick transparent PNG | `remove-bg` (fastest) |
| Soft alpha / feathered edges | `851-labs` with threshold 0.0 |
| Green screen background | `851-labs` with `--background-type green` |
| Blur background (portrait) | `851-labs` with `--background-type blur` |
| Custom color background | `851-labs` with `--background-type "[R,G,B]"` |
| Remove foreground (keep bg) | `851-labs` with `--reverse` |
| Fallback / no Replicate token | `removebg-api` |

## Intent-to-Flag Mapping

| User Says | Flags | Model |
|-----------|-------|-------|
| "remove background", "transparent" | `--model remove-bg` | Fast default |
| "soft edges", "feathered" | `--model 851-labs --threshold 0.0` | Soft alpha |
| "green screen" | `--model 851-labs --background-type green` | Chroma key |
| "blur background" | `--model 851-labs --background-type blur` | Portrait mode |
| "white background" | `--model 851-labs --background-type white` | Product photo |
| "custom color" | `--model 851-labs --background-type "[R,G,B]"` | Brand color |
| "remove foreground" | `--model 851-labs --reverse` | Keep only background |

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Remove background from image | `Workflows/RemoveBackground.md` |
| Replace background with color/blur/green | `Workflows/RemoveBackground.md` |

## Usage

```bash
# Fast transparent background
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model remove-bg --image ~/Downloads/photo.png

# Green screen
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model 851-labs --image photo.jpg --background-type green

# Blur background (portrait mode)
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model 851-labs --image portrait.jpg --background-type blur

# Brand color background (#EAE9DF)
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model 851-labs --image logo.png --background-type "[234,233,223]"
```

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Examples

**Example 1: Product photo cleanup**
```
User: "remove the background from this product shot"
→ Uses remove-bg for fast transparent PNG
→ Outputs to ~/Downloads/transparent.png
```

**Example 2: Portrait with blurred background**
```
User: "blur the background on this headshot"
→ Uses 851-labs with --background-type blur
→ Creates portrait-mode effect
```

**Example 3: Green screen for video compositing**
```
User: "make this a green screen image"
→ Uses 851-labs with --background-type green
→ Ready for chroma key compositing
```
