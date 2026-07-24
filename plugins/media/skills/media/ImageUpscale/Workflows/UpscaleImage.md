---
name: Upscale Image
description: 
status: STABLE
---

# Upscale Image Workflow

**Upscale and enhance image resolution using AI models.**

## Purpose

Upscale images to higher resolution using multiple AI providers. Supports:
- Simple high-quality upscaling (Recraft)
- Exact 2x/4x factor with quality control (Google)
- Face-aware upscaling with GFPGAN enhancement (Real-ESRGAN)
- Prompt-guided creative upscaling with HDR (Clarity)

**Use this workflow when:**
- Enlarging a small or low-resolution image
- Preparing images for print or large displays
- Enhancing portraits with face detail recovery
- Upscaling product photos for e-commerce
- Adding HDR or creative enhancement during upscale

**This workflow does NOT cover:**
- Image restoration / denoising (see `ImageRestoration/Workflows/RestoreImage.md`)
- Background removal (see `BackgroundRemoval/Workflows/RemoveBackground.md`)
- Image generation from scratch (see `Art/Workflows/`)

---

## Workflow Steps

### Step 1: Verify Input Image

Confirm the image exists and note format and dimensions:

```bash
ls -lh /path/to/image.png
```

Supported formats: PNG, JPEG, WebP.

### Step 2: Select Model and Options

#### Intent-to-Flag Mapping

| User Says | Flags | When to Use |
|-----------|-------|-------------|
| "upscale", "make bigger" | `--model recraft` | Simplest, high quality default |
| "2x" | `--model google --scale 2` | Exact 2x factor |
| "4x" | `--model google --scale 4` | Exact 4x factor |
| "enhance face", "portrait" | `--model real-esrgan --face-enhance` | Face-aware upscaling |
| "creative", "with prompt" | `--model clarity --prompt "..."` | Guided enhancement |
| "HDR", "dynamic range" | `--model clarity --dynamic 6` | HDR effect |
| "high quality output" | `--model google --quality 95` | Control compression |
| "faithful", "exact" | `--model clarity --resemblance 1.4` | Preserve original |

### Step 3: Run Upscale

```bash
# Simple upscale (recommended default)
bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
  --model recraft \
  --image ~/Downloads/input.jpg \
  --output ~/Downloads/upscaled.png

# 4x with quality control
bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
  --model google \
  --image ~/Downloads/small.png \
  --scale 4 --quality 90 \
  --output ~/Downloads/upscaled-4x.png

# Portrait with face enhancement
bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
  --model real-esrgan \
  --image ~/Downloads/portrait.jpg \
  --scale 4 --face-enhance \
  --output ~/Downloads/portrait-enhanced.png

# Creative upscale with prompt guidance
bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
  --model clarity \
  --image ~/Downloads/landscape.jpg \
  --prompt "sharp detailed landscape, vibrant colors, 8k resolution" \
  --scale 2 --creativity 0.5 --dynamic 6 \
  --output ~/Downloads/landscape-hd.png
```

### Step 4: Verify Output

```bash
ls -lh ~/Downloads/upscaled.png
open ~/Downloads/upscaled.png
```

Check that:
- File size is larger than input (upscaling happened)
- Image dimensions are increased
- Quality and detail look correct
- Faces are preserved (if face-enhance was used)

---

## Examples

### Example 1: Quick Product Photo Upscale

```
User: "upscale this product image for the website"

Action:
1. Select recraft (simple, high quality)
2. Run upscale with default settings
3. Output: ~/Downloads/upscaled.png
```

### Example 2: Portrait 4x Enhancement

```
User: "make this headshot 4x resolution, enhance the face"

Action:
1. Select real-esrgan with --face-enhance --scale 4
2. GFPGAN recovers facial details during upscale
3. Output: ~/Downloads/upscaled.png
```

### Example 3: Creative Landscape with HDR

```
User: "upscale this landscape photo with HDR and make it look cinematic"

Action:
1. Select clarity with --prompt "cinematic landscape, HDR, detailed"
2. Set --dynamic 6 for HDR, --creativity 0.5 for balance
3. Output: ~/Downloads/upscaled.png
```

### Example 4: Batch Upscale

```
User: "upscale all images in this folder"

Action:
1. List images in folder
2. Loop through each, using recraft for speed:
   for img in ~/Downloads/batch-*.png; do
     output="${img%.png}-upscaled.png"
     bun run ~/.claude/skills/media/ImageUpscale/Tools/Upscale.ts \
       --model recraft --image "$img" --output "$output"
   done
3. Output: individual upscaled files
```

---

## Integration with Other Workflows

This workflow integrates with:
- **ImageRestoration/RestoreImage**: Restore first, then upscale for best results
- **BackgroundRemoval/RemoveBackground**: Upscale, then remove background
- **Art/Generate**: Generate image, then upscale for higher resolution