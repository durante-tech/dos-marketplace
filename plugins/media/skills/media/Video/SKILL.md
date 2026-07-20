---
name: Video
description: Generate AI video from text prompts, animate still images, and edit existing video using 8 models across 5 providers (seedance, grok-video, gen-4.5, kling-v3, kling-turbo, veo-fast, veo, wan-i2v). USE WHEN video generation, text to video, image to video, AI video, render video, animate image, seedance, kling, veo, runway, grok video, gen-4.5, wan video, video edit, cinematic video, motion, video clip.
role: generator
accepts:
  - text
  - url
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# Video Skill

Generate AI video from text, animate still images, and edit existing video using a unified CLI interface.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Video/`

If this directory exists, load and apply:
- `PREFERENCES.md` - Default model, output location, duration preferences

These override default behavior. If the directory does not exist, proceed with skill defaults.

## MANDATORY: Output to Downloads First

```
ALL GENERATED VIDEOS GO TO ~/Downloads/ FIRST
NEVER output directly to project directories
User MUST preview before use
```

**This applies to ALL workflows in this skill.**

---

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Generate video from text prompt only | `Workflows/TextToVideo.md` |
| Animate an image, image to video | `Workflows/ImageToVideo.md` |
| Edit existing video, modify video | `Workflows/VideoEdit.md` |

---

## Available Models

| Model | Provider | Image Input | Audio Control | Duration | Ref Images |
|-------|----------|-------------|---------------|----------|------------|
| `seedance` | ByteDance | Yes | `--generate-audio` | auto / -1 | 9 |
| `grok-video` | xAI | Yes | via prompt | 1-15s | No |
| `gen-4.5` | Runway | Yes | No | seconds | No |
| `kling-v3` | Kuaishou | start_image + end_image | `--generate-audio` | 3-15s | No |
| `kling-turbo` | Kuaishou | start_image + end_image | No | seconds | No |
| `veo-fast` | Google | Yes + last_frame | `--generate-audio` | 4/6/8s | No |
| `veo` | Google | Yes + last_frame | `--generate-audio` | 4/6/8s | 3 |
| `wan-i2v` | Wan Video | Required | No | frames | No |

## Model Selection Guide

| Use Case | Recommended Model |
|----------|------------------|
| Cinematic quality, audio | `seedance` |
| Quick draft / fast turnaround | `kling-turbo` or `veo-fast` |
| Smooth image-to-image transition | `kling-v3` (start + end image) or `veo` (last_frame) |
| Video editing / modification | `grok-video` |
| Style transfer with references | `seedance` (up to 9 refs) or `veo` (up to 3 refs) |
| Highest visual fidelity | `gen-4.5` or `veo` |
| Animate illustration / artwork | `wan-i2v` |
| Audio-synced video | `seedance`, `kling-v3`, or `veo` with `--generate-audio` |

## Intent-to-Flag Mapping

| User Says | Flags | Model |
|-----------|-------|-------|
| "quick video", "fast" | `--model kling-turbo` | `kling-turbo` |
| "cinematic", "high quality" | `--model seedance` | `seedance` |
| "with audio", "add sound" | `--generate-audio` | `seedance` / `kling-v3` / `veo` |
| "silent", "no audio" | `--no-audio` | Any |
| "animate this image" | `--image PATH` | `veo-fast` or `seedance` |
| "smooth transition" | `--image PATH --last-frame PATH` | `veo` or `kling-v3` |
| "edit this video" | `--video URL` | `grok-video` |
| "long video", "15 seconds" | `--duration 15` | `grok-video` or `kling-v3` |
| "short clip" | `--duration 4` | `veo-fast` |
| "reference style" | `--reference-image URL` | `seedance` (9) or `veo` (3) |

## Audio Control

Models handle audio differently:

| Model | Audio Support | Flags |
|-------|--------------|-------|
| `seedance` | Generated audio synced to video | `--generate-audio` / `--no-audio` |
| `kling-v3` | Generated audio synced to video | `--generate-audio` / `--no-audio` |
| `veo-fast` | Generated audio synced to video | `--generate-audio` / `--no-audio` |
| `veo` | Generated audio synced to video | `--generate-audio` / `--no-audio` |
| `grok-video` | Described in prompt (e.g. "with upbeat music") | N/A (prompt-based) |
| `gen-4.5` | No audio support | N/A |
| `kling-turbo` | No audio support | N/A |
| `wan-i2v` | No audio support | N/A |

## Reference Images (Model-Aware)

| Model | Max References | Notes |
|-------|---------------|-------|
| `seedance` | 9 | Style transfer, character consistency |
| `veo` | 3 | Style guidance |
| All others | 0 | No reference image support |

```bash
# seedance with reference images
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model seedance \
  --prompt "Character from references walking through a neon-lit city" \
  --reference-image ref1.jpg --reference-image ref2.jpg \
  --generate-audio \
  --output ~/Downloads/styled-video.mp4
```

## Usage

```bash
# Text to video — cinematic with audio
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model seedance \
  --prompt "Aerial drone shot of a misty mountain range at sunrise, golden light" \
  --generate-audio \
  --output ~/Downloads/mountain-sunrise.mp4

# Image to video — animate a still
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model veo-fast \
  --prompt "Gentle camera push-in, leaves rustling in wind" \
  --image ~/Downloads/forest-photo.png \
  --duration 6 \
  --output ~/Downloads/forest-animated.mp4

# Video edit — modify existing video
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model grok-video \
  --prompt "Change the sky to a dramatic sunset with orange and purple tones" \
  --video "https://example.com/original-clip.mp4" \
  --duration 5 \
  --output ~/Downloads/edited-clip.mp4
```

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Examples

**Example 1: Cinematic text-to-video with audio**
```
User: "create a cinematic video of a spaceship launching"
-> Routes to Workflows/TextToVideo.md
-> Uses seedance with --generate-audio
-> Crafts cinematic prompt with camera movement and lighting
-> Outputs MP4 to ~/Downloads/ for preview
```

**Example 2: Animate a product photo**
```
User: "animate this product shot with a slow zoom"
-> Routes to Workflows/ImageToVideo.md
-> Uses veo-fast with --image for fast turnaround
-> Describes slow push-in camera movement
-> Outputs MP4 to ~/Downloads/ for preview
```

**Example 3: Edit existing video**
```
User: "change the background of this video to a beach"
-> Routes to Workflows/VideoEdit.md
-> Uses grok-video with --video URL
-> Describes background replacement in prompt
-> Outputs edited MP4 to ~/Downloads/ for comparison
```
