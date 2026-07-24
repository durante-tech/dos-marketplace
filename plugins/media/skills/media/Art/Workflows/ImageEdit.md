---
name: Image Edit
description: 
status: STABLE
---

# Image Edit Workflow

**Edit existing images using natural language instructions via reference-image models.**

## Purpose

Edit, modify, or remix existing images using natural language descriptions. This workflow routes to the correct model based on edit type: single-image edits use `grok-imagine` (fast, 1 reference), multi-reference compositing uses `flux-2-pro` (up to 8 refs), and style transformations use `seedream` (up to 14 refs).

**Use this workflow for:**
- Changing elements in an existing image (swap background, add object, remove element)
- Combining multiple images into a single composition
- Applying style changes to a photo or illustration
- Text overlay or typography additions to existing visuals
- Quick iterative edits on generated images

---

## Workflow Steps

### Step 1: Prepare the Source Image

The source image must be accessible via URL. If the image is local, upload it to a hosting service or use a file URL.

```bash
# If image is already hosted, use the URL directly
SOURCE_URL="https://example.com/original-image.png"

# If image is local, you can use a temporary hosting solution
# or pass a local path (supported for some models)
```

### Step 2: Identify the Edit Type

Determine what kind of edit is needed to select the right model:

| Edit Type | Model | Why |
|-----------|-------|-----|
| Single image edit (change color, add element, modify scene) | `grok-imagine` | Fast (~4s), single ref input, good text rendering |
| Combine 2-8 images into one | `flux-2-pro` | Up to 8 reference images, compositional strength |
| Style transformation (change aesthetic, artistic medium) | `seedream` | Up to 14 refs, cinematic style transfer |

### Step 3: Describe the Edit

Write a clear, specific prompt describing the desired change. Be explicit about what should change and what should stay the same.

```
# Good: "Change the background to a sunset beach scene, keep the person unchanged"
# Bad:  "Make it look better"

# Good: "Add a neon sign reading 'OPEN' to the storefront window"
# Bad:  "Add some text"
```

### Step 4: Run Generate.ts with the Appropriate Model

**Single-image edit with grok-imagine:**

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model grok-imagine \
  --prompt "Change the sky to a dramatic purple sunset, keep everything else identical" \
  --reference-image "https://example.com/original.png" \
  --size 16:9 \
  --output ~/Downloads/edited-image.png
```

**Multi-reference compositing with flux-2-pro:**

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-pro \
  --prompt "Combine these subjects into a single group portrait in a modern office" \
  --reference-image "https://example.com/person1.png" \
  --reference-image "https://example.com/person2.png" \
  --reference-image "https://example.com/office-bg.png" \
  --size 16:9 \
  --output ~/Downloads/composite-image.png
```

**Style transformation with seedream:**

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "Transform this photo into a watercolor painting with soft edges and muted tones" \
  --reference-image "https://example.com/photo.png" \
  --size 16:9 \
  --output ~/Downloads/styled-image.png
```

### Step 5: Compare Original vs Edit

```bash
# Open both images side by side
open ~/Downloads/edited-image.png
```

Verify the edit preserved what should be unchanged and modified only what was requested.

---

## Intent-to-Flag Mapping

| User Intent | Model | Flag Pattern | Max Refs |
|-------------|-------|-------------|----------|
| "edit this image" | `grok-imagine` | `--reference-image URL` | 1 |
| "change the background" | `grok-imagine` | `--reference-image URL` | 1 |
| "add text to this image" | `grok-imagine` | `--reference-image URL` | 1 |
| "combine these images" | `flux-2-pro` | `--reference-image URL` (multiple) | 8 |
| "merge these photos" | `flux-2-pro` | `--reference-image URL` (multiple) | 8 |
| "change the style" | `seedream` | `--reference-image URL` | 14 |
| "make it look like a painting" | `seedream` | `--reference-image URL` | 14 |
| "remix this" | `seedream` | `--reference-image URL` | 14 |

---

## Examples

### Example 1: Quick Background Swap

User says: "Change the background of this headshot to a gradient blue."

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model grok-imagine \
  --prompt "Replace the background with a smooth dark-to-light blue gradient. Keep the person and their clothing exactly the same." \
  --reference-image "https://hosted.example.com/headshot.png" \
  --size 1:1 \
  --output ~/Downloads/headshot-blue-bg.png
```

### Example 2: Composite Team Photo

User says: "Combine these three individual photos into a team shot."

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-pro \
  --prompt "Professional team photo of three people standing together in a modern white office, natural lighting, candid poses" \
  --reference-image "https://hosted.example.com/alice.png" \
  --reference-image "https://hosted.example.com/bob.png" \
  --reference-image "https://hosted.example.com/carol.png" \
  --size 16:9 \
  --output ~/Downloads/team-composite.png
```

### Example 3: Style Transformation

User says: "Turn this photo into a cinematic film still."

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "Cinematic film still, 35mm film grain, shallow depth of field, dramatic natural lighting, same composition and subjects as reference" \
  --reference-image "https://hosted.example.com/original-photo.png" \
  --size 16:9 \
  --output ~/Downloads/cinematic-edit.png
```

---

**The workflow: Prepare source -> Identify edit type -> Describe edit -> Generate -> Compare**