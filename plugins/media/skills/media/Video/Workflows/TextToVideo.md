---
name: Text To Video
description: 
status: STABLE
---

# Text to Video Workflow

**Generate video from a text prompt with no image input -- pure text-to-video generation.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Text to Video workflow in the Video skill to generate video from text"
```

Running **TextToVideo** in **Video**...

---

## Purpose

Generate video clips directly from text descriptions. No source image required. The workflow helps select the right model based on quality needs, audio requirements, and turnaround speed, then crafts a cinematic prompt optimized for video generation.

**Use this workflow for:**
- Creating video content from scratch using only a text description
- Generating promotional clips, social media video, or concept previews
- Producing videos with synchronized audio
- Quick video drafts for storyboarding or iteration

---

## Workflow Steps

### Step 1: Understand the Content and Scene

Analyze the user's request to determine:
- **Subject**: What is being shown (person, landscape, product, abstract)
- **Motion**: What movement is expected (camera pan, zoom, character action)
- **Mood**: Cinematic, energetic, calm, dramatic, playful
- **Audio needs**: Does the video need sound, music, or silence?
- **Duration**: How long should the clip be?

### Step 2: Select Model Based on Needs

| Need | Model | Why |
|------|-------|-----|
| Cinematic quality + audio | `seedance` | Best overall quality, auto duration, audio generation |
| Fast draft / iteration | `kling-turbo` | Quick turnaround, good enough for previews |
| Specific duration (1-15s) | `grok-video` | Precise duration control, audio via prompt |
| High fidelity, Google quality | `veo` | Strong visual quality, 4/6/8s durations |
| Fast + audio | `veo-fast` | Good balance of speed and quality with audio |
| Maximum visual quality | `gen-4.5` | Runway's flagship, excellent coherence |

### Step 3: Craft the Cinematic Prompt

Build a prompt that includes:
1. **Camera movement** (e.g., "slow dolly forward", "aerial tracking shot", "static wide angle")
2. **Subject description** (detailed, specific)
3. **Lighting and atmosphere** (e.g., "golden hour backlighting", "neon reflections on wet pavement")
4. **Motion description** (what moves and how)
5. **Audio cues** (for grok-video only: describe desired sounds in the prompt)

```
# Good prompt:
"Slow dolly forward through a dense bamboo forest, morning mist catching shafts of golden sunlight,
 leaves swaying gently in the breeze, shallow depth of field, cinematic 24fps"

# Weak prompt:
"A forest video"
```

### Step 4: Run Render.ts

```bash
# Cinematic with audio (seedance)
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model seedance \
  --prompt "CINEMATIC PROMPT HERE" \
  --generate-audio \
  --output ~/Downloads/video-output.mp4

# Fast draft (kling-turbo)
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model kling-turbo \
  --prompt "PROMPT HERE" \
  --duration 5 \
  --output ~/Downloads/video-draft.mp4

# Specific duration with audio in prompt (grok-video)
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model grok-video \
  --prompt "PROMPT HERE, with ambient forest sounds and birdsong" \
  --duration 10 \
  --output ~/Downloads/video-long.mp4

# Google quality (veo)
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model veo \
  --prompt "PROMPT HERE" \
  --generate-audio \
  --duration 8 \
  --output ~/Downloads/video-veo.mp4
```

### Step 5: Review Output

```bash
open ~/Downloads/video-output.mp4
```

Check for:
- Motion coherence (no sudden jumps or artifacts)
- Subject consistency throughout the clip
- Audio sync (if audio was generated)
- Overall quality matches the intended mood

If the result needs iteration, refine the prompt and re-run.

---

## Port form (RFC-0031 Phase 2) — `bun Tools/dos-video.ts <prompt> --intent=<X>`

For single-shot videos outside the multi-step workflow above, prefer the `video.generate` Port at `Tools/dos-video.ts`. The Port routes intent → Adapter (Veo / Runway / Kling / Seedance) and subprocess-calls this same Render.ts Adapter under the hood — same Studio gateway, same credit metering, same artifact tracking.

```bash
# Text-to-video — Port routes to Seedance (high quality with audio)
bun Tools/dos-video.ts "A fox running through autumn forest" \
  --intent=text-to-video \
  --output=~/Downloads/fox.mp4 \
  --telemetry-tag=Media/TextToVideo

# Image-to-video — Port routes to Runway Gen-4.5
bun Tools/dos-video.ts "Camera slowly pulls back to reveal landscape" \
  --intent=image-to-video \
  --image=https://example.com/frame.png \
  --output=~/Downloads/pullback.mp4

# Style transfer — Port routes to Kling V3 (start/end frame)
bun Tools/dos-video.ts "Smooth cinematic transition" \
  --intent=style-transfer \
  --image=start.png \
  --output=~/Downloads/transition.mp4

# Edit existing video — Port routes to Veo (Phase 2.B re-tune candidate)
bun Tools/dos-video.ts "Continue the action with motion blur" \
  --intent=edit-existing \
  --output=~/Downloads/edited.mp4
```

Use the Port form when:
- A single video at a single intent (no multi-shot pipeline)
- Telemetry attribution matters (`--telemetry-tag` records caller)
- The caller is bash / agent CLI / external workflow

Use the Render.ts CLI form (this workflow) when:
- Per-model tuning (`--duration`, `--resolution`, `--last-frame`, `--negative-prompt`)
- `--reference-image`, `--seed`, `--num-frames` flags (Port doesn't surface these yet)
- Provider-specific model selection (`--model wan-i2v`, `--model kling-turbo`, etc.)

---

## Intent-to-Flag Mapping

| User Intent | Model | Key Flags |
|-------------|-------|-----------|
| "quick video", "fast", "draft" | `kling-turbo` | `--model kling-turbo` |
| "cinematic", "high quality" | `seedance` | `--model seedance --generate-audio` |
| "with music", "with audio" | `seedance` / `veo` | `--generate-audio` |
| "silent", "no sound" | Any | `--no-audio` |
| "long clip", "15 seconds" | `grok-video` | `--model grok-video --duration 15` |
| "short", "4 seconds" | `veo-fast` | `--model veo-fast --duration 4` |
| "best quality" | `gen-4.5` or `veo` | `--model gen-4.5` or `--model veo` |
| "with sound effects" | `grok-video` | Describe sounds in prompt text |
| "reference style" | `seedance` | `--reference-image URL` (up to 9) |

---

## Examples

### Example 1: Social Media Clip

User says: "Make a quick 5-second video of coffee being poured."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model kling-turbo \
  --prompt "Close-up shot of hot coffee being poured into a ceramic mug, steam rising, warm morning light from a side window, shallow depth of field, cozy atmosphere" \
  --duration 5 \
  --output ~/Downloads/coffee-pour.mp4
```

### Example 2: Cinematic Brand Video

User says: "Create a cinematic video of a futuristic city at night with audio."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model seedance \
  --prompt "Aerial tracking shot over a futuristic cyberpunk city at night, neon signs reflecting on wet streets below, flying vehicles leaving light trails, holographic advertisements flickering, cinematic anamorphic lens flare, 24fps film look" \
  --generate-audio \
  --output ~/Downloads/cyberpunk-city.mp4
```

### Example 3: Product Concept Preview

User says: "Generate a 10-second video of a smartwatch rotating on a pedestal."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model grok-video \
  --prompt "A sleek black smartwatch slowly rotating on a white marble pedestal, studio lighting with soft shadows, minimalist background, smooth 360-degree rotation, product advertisement style, subtle ambient electronic music" \
  --duration 10 \
  --output ~/Downloads/smartwatch-rotation.mp4
```

---

**The workflow: Understand scene -> Select model -> Craft cinematic prompt -> Render -> Review**