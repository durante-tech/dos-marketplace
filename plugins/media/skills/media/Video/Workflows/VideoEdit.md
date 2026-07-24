---
name: Video Edit
description: 
status: STABLE
---

# Video Edit Workflow

**Edit existing video with natural language instructions -- modify scenes, swap backgrounds, and apply transformations.**

## Purpose

Modify existing video clips using natural language descriptions. This workflow takes a source video and applies edits described in the prompt -- background replacement, style changes, element additions, or scene modifications.

**Important:** Only `grok-video` supports direct video editing input. For style transfer from reference images onto new video, use `seedance` with `--reference-image` via the TextToVideo or ImageToVideo workflows instead.

**Use this workflow for:**
- Changing backgrounds in existing video
- Adding or removing visual elements
- Applying style transformations to footage
- Modifying lighting, color grading, or atmosphere
- Adding text overlays or visual effects described in natural language

---

## Workflow Steps

### Step 1: Provide the Source Video

The source video must be accessible via URL. If the video is local, host it temporarily or use a file URL.

```bash
# Hosted video
SOURCE_VIDEO="https://example.com/original-clip.mp4"

# Verify the source is accessible
curl -sI "$SOURCE_VIDEO" | head -5
```

### Step 2: Describe the Edit

Write a clear, specific prompt describing what should change. Be explicit about what to modify and what to preserve.

```
# Good: "Replace the background with a tropical beach, keep the person and their movements identical"
# Bad:  "Make it look better"

# Good: "Change the color grading to a warm vintage film look with orange highlights and teal shadows"
# Bad:  "Change the colors"

# Good: "Add falling snow particles throughout the scene, slightly accumulating on surfaces"
# Bad:  "Add snow"
```

### Step 3: Run Render.ts with --video

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model grok-video \
  --prompt "EDIT DESCRIPTION HERE" \
  --video "https://example.com/original-clip.mp4" \
  --duration 5 \
  --output ~/Downloads/edited-video.mp4
```

**Duration control:** `grok-video` supports 1-15 second outputs. Match the original clip length or specify a different duration.

### Step 4: Compare Original vs Edit

```bash
# Open the edited video
open ~/Downloads/edited-video.mp4
```

Verify:
- The edit matches the description
- Subject identity and motion are preserved
- No unwanted artifacts introduced
- Temporal consistency (no flickering or sudden changes between frames)

If the result needs refinement, adjust the prompt to be more specific about what should or should not change, then re-run.

---

## Model Constraints

| Capability | grok-video | Notes |
|------------|------------|-------|
| Video input | Yes | `--video URL` |
| Duration control | 1-15 seconds | `--duration N` |
| Audio | Via prompt | Describe audio in the prompt text |
| Image input | Yes | Can also accept `--image` for image-to-video |
| Reference images | No | For style transfer, use seedance instead |

**For style transfer on video content:** Use `seedance` with `--reference-image` flags through the TextToVideo workflow. Describe the scene matching your source video, and provide style reference images (up to 9).

```bash
# Style transfer approach (via TextToVideo, not VideoEdit)
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model seedance \
  --prompt "Person walking through city street, anime art style, vibrant colors" \
  --reference-image ~/Downloads/anime-style-ref.png \
  --generate-audio \
  --output ~/Downloads/style-transferred.mp4
```

---

## Intent-to-Flag Mapping

| User Intent | Flags |
|-------------|-------|
| "edit this video" | `--model grok-video --video URL` |
| "change the background" | `--model grok-video --video URL` (describe new bg in prompt) |
| "add visual effects" | `--model grok-video --video URL` (describe effects in prompt) |
| "color grade this clip" | `--model grok-video --video URL` (describe grading in prompt) |
| "make it longer" | `--model grok-video --video URL --duration N` |
| "style transfer" | Use `seedance` with `--reference-image` instead (TextToVideo workflow) |

---

## Examples

### Example 1: Background Replacement

User says: "Replace the background of this video with a beach sunset."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model grok-video \
  --prompt "Replace the background with a tropical beach at sunset, golden light reflecting on calm ocean waves, palm trees silhouetted against an orange sky. Keep the foreground subject and all their movements exactly the same." \
  --video "https://example.com/talking-head.mp4" \
  --duration 8 \
  --output ~/Downloads/beach-background.mp4
```

### Example 2: Vintage Color Grading

User says: "Apply a retro VHS look to this clip."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model grok-video \
  --prompt "Apply a retro VHS aesthetic: scan lines, slight color bleeding, warm oversaturated tones, subtle tracking artifacts at the top and bottom, soft glow on highlights, 4:3 aspect ratio feel with slight vignette" \
  --video "https://example.com/modern-clip.mp4" \
  --duration 10 \
  --output ~/Downloads/vhs-edit.mp4
```

### Example 3: Add Weather Effects

User says: "Add rain to this outdoor scene."

```bash
bun run ~/.claude/skills/media/Video/Tools/Render.ts \
  --model grok-video \
  --prompt "Add heavy rain falling throughout the scene, water splashing on surfaces, wet reflections on the ground, slightly darker overcast lighting, with the sound of rain and distant thunder" \
  --video "https://example.com/outdoor-scene.mp4" \
  --duration 6 \
  --output ~/Downloads/rainy-scene.mp4
```

---

**The workflow: Provide source video -> Describe edit -> Render with --video -> Compare original vs edit**