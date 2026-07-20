---
name: Image To Video
description: 
status: STABLE
---

# Image to Video Workflow

**Animate a still image into video -- bring photos, illustrations, and renders to life with motion.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Image to Video workflow in the Video skill to animate an image"
```

Running **ImageToVideo** in **Video**...

---

## Purpose

Transform a static image into a video clip by adding camera movement, subject motion, and optionally generated audio. All 8 models support image input in different ways -- this workflow selects the right model and flags based on the animation intent.

**Use this workflow for:**
- Animating product photos with subtle motion
- Bringing illustrations or artwork to life
- Creating smooth transitions between two images (start + end frame)
- Adding parallax or camera movement to still photography
- Generating video from AI-generated images

---

## Workflow Steps

### Step 1: Verify the Input Image

Confirm the source image exists and is accessible:

```bash
# Local file
ls -la ~/Downloads/source-image.png

# Or a hosted URL
# https://example.com/source-image.png
```

The image should be high quality -- video generation amplifies artifacts in the source.

### Step 2: Select Model Based on Animation Need

| Animation Need | Model | Why |
|----------------|-------|-----|
| Fast animation, good quality | `veo-fast` | Quick turnaround, audio support |
| Highest quality animation | `seedance` | Best motion coherence, audio, 9 reference images |
| Smooth transition between two images | `kling-v3` | Supports start_image + end_image |
| Start-to-end frame interpolation | `veo` | Supports --last-frame for smooth endings |
| Quick draft animation | `kling-turbo` | Fastest, start + end image support |
| Animate illustration / artwork | `wan-i2v` | Designed for image-to-video, frame-based duration |
| Specific duration control (1-15s) | `grok-video` | Precise duration, prompt-based audio |
| Maximum visual fidelity | `gen-4.5` | Runway flagship quality |

### Step 3: Describe the Desired Motion

Write a prompt focused on **what should move and how**. The model already has the visual from the image -- describe the animation:

```
# Good: "Gentle camera push-in, hair blowing in wind, clouds drifting slowly in background"
# Bad:  "Animate this" (too vague -- model won't know what motion to add)

# Good: "Slow pan right revealing the full landscape, birds flying across the sky"
# Bad:  "Make it a video" (no motion direction)
```

### Step 4: Run Render.ts with --image

**Standard image animation (veo-fast):**

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model veo-fast \
  --prompt "Gentle camera push-in, leaves rustling in the breeze, dappled sunlight shifting" \
  --image ~/Downloads/forest-photo.png \
  --duration 6 \
  --generate-audio \
  --output ~/Downloads/forest-animated.mp4
```

**High-quality animation with references (seedance):**

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model seedance \
  --prompt "Character turns head slowly toward camera, cinematic lighting shift" \
  --image ~/Downloads/portrait.png \
  --generate-audio \
  --output ~/Downloads/portrait-animated.mp4
```

**Smooth transition between two images (kling-v3):**

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model kling-v3 \
  --prompt "Smooth morphing transition from day scene to night scene" \
  --image ~/Downloads/scene-day.png \
  --last-frame ~/Downloads/scene-night.png \
  --duration 5 \
  --generate-audio \
  --output ~/Downloads/day-to-night.mp4
```

**End-frame controlled animation (veo):**

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model veo \
  --prompt "Camera slowly orbits the subject, lighting transitions from warm to cool" \
  --image ~/Downloads/start-frame.png \
  --last-frame ~/Downloads/end-frame.png \
  --duration 8 \
  --generate-audio \
  --output ~/Downloads/orbit-shot.mp4
```

**Fast illustration animation (wan-i2v):**

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model wan-i2v \
  --prompt "Character waves hand, background elements drift gently" \
  --image ~/Downloads/illustration.png \
  --output ~/Downloads/illustration-animated.mp4
```

### Step 5: Review and Iterate

```bash
open ~/Downloads/forest-animated.mp4
```

Check for:
- Source image fidelity preserved (no distortion of the original)
- Motion looks natural and matches the prompt
- Start frame matches the input image closely
- End frame (if --last-frame used) transitions smoothly

---

## Intent-to-Flag Mapping

| User Intent | Model | Key Flags |
|-------------|-------|-----------|
| "animate this image" | `veo-fast` | `--image PATH` |
| "high quality animation" | `seedance` | `--image PATH --generate-audio` |
| "transition between two images" | `kling-v3` | `--image PATH --last-frame PATH` |
| "smooth ending" | `veo` | `--image PATH --last-frame PATH` |
| "fast animation" | `kling-turbo` | `--image PATH` |
| "animate illustration" | `wan-i2v` | `--image PATH` |
| "with audio" | `seedance` / `veo` | `--generate-audio` |
| "product spin" | `grok-video` | `--image PATH --duration 10` |
| "subtle movement" | `veo-fast` | `--image PATH --duration 4` |

---

## Examples

### Example 1: Animate a Product Photo

User says: "Animate this product shot with a slow zoom and soft lighting shift."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model veo-fast \
  --prompt "Slow push-in zoom, soft studio lighting gradually brightening, subtle shadow movement, product photography style" \
  --image ~/Downloads/product-shot.png \
  --duration 6 \
  --output ~/Downloads/product-animated.mp4
```

### Example 2: Day-to-Night Transition

User says: "Create a smooth transition from this daytime photo to the nighttime version."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model kling-v3 \
  --prompt "Smooth timelapse transition from golden hour to blue hour to night, street lights gradually turning on, sky shifting from orange to deep blue to black with stars appearing" \
  --image ~/Downloads/city-day.png \
  --last-frame ~/Downloads/city-night.png \
  --duration 10 \
  --generate-audio \
  --output ~/Downloads/day-to-night-transition.mp4
```

### Example 3: Animate Artwork

User says: "Bring this illustration to life with gentle movement."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model wan-i2v \
  --prompt "Gentle parallax movement, foreground elements sway slightly, background clouds drift slowly, hair moves in a soft breeze, subtle particle effects floating" \
  --image ~/Downloads/illustration.png \
  --output ~/Downloads/illustration-alive.mp4
```

---

**The workflow: Verify image -> Select model -> Describe motion -> Render with --image -> Review**