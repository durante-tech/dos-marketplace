---
name: Restore Image
description: 
status: STABLE
---

# Restore Image Workflow

**Restore, enhance, and upscale damaged or low-quality images using AI.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the RestoreImage workflow in the ImageRestoration skill to restore images"
```

Running **RestoreImage** in **ImageRestoration**...

---

## Purpose

Fix old, damaged, blurry, or low-quality images:
- Old family photos with face damage
- Blurry or low-resolution headshots
- Noisy or compressed images
- AI-generated images that need face correction

---

## Workflow Steps

### Step 1: Assess the Image

Determine what needs fixing:
- **Damaged faces?** → CodeFormer or GFPGAN
- **Low resolution?** → CodeFormer with `--upscale`
- **General noise/damage?** → Flux Restore
- **Need identity preserved?** → GFPGAN v1.4

### Step 2: Select Model and Flags

#### Intent-to-Flag Mapping

| Image Problem | Model + Flags | Why |
|---------------|---------------|-----|
| Old photo with faces | `--model codeformer --fidelity 0.5 --background-enhance --face-upsample` | Full scene + face restore |
| Blurry face only | `--model gfpgan --version v1.4 --scale 2` | Fast, identity-preserving |
| Low quality, needs upscale | `--model codeformer --upscale 2 --background-enhance` | Scene-wide + upscale |
| Noisy / compressed | `--model flux-restore` | General denoising |
| AI art face glitches | `--model codeformer --fidelity 0.7 --face-upsample` | Higher fidelity for AI art |

**CodeFormer fidelity guide:**
- `0.1-0.3` — Maximum quality enhancement (may alter appearance)
- `0.5` — Balanced (recommended default)
- `0.7-0.9` — Maximum fidelity to original (minimal changes)

### Step 3: Run Restoration

```bash
bun run ~/.claude/skills/media/ImageRestoration/Tools/Restore.ts \
  --model codeformer \
  --image ~/Downloads/old-photo.jpg \
  --fidelity 0.5 \
  --background-enhance \
  --face-upsample \
  --output ~/Downloads/restored-photo.png
```

### Step 4: Compare and Iterate

Open both original and restored side by side:

```bash
open ~/Downloads/old-photo.jpg ~/Downloads/restored-photo.png
```

If faces need more identity preservation, try GFPGAN:

```bash
bun run ~/.claude/skills/media/ImageRestoration/Tools/Restore.ts \
  --model gfpgan \
  --image ~/Downloads/old-photo.jpg \
  --version v1.4 \
  --scale 2 \
  --output ~/Downloads/restored-gfpgan.png
```

---

## Examples

**Example 1: Full old photo restoration**
```bash
bun run ~/.claude/skills/media/ImageRestoration/Tools/Restore.ts \
  --model codeformer \
  --image ~/Downloads/grandparents-1960.jpg \
  --fidelity 0.5 \
  --background-enhance \
  --face-upsample \
  --upscale 2 \
  --output ~/Downloads/grandparents-restored.png
```

**Example 2: Batch face restoration**
```bash
for img in ~/Downloads/headshots-*.jpg; do
  output="${img%.jpg}-restored.png"
  bun run ~/.claude/skills/media/ImageRestoration/Tools/Restore.ts \
    --model gfpgan --image "$img" --version v1.4 --output "$output"
done
```

**Example 3: Clean up AI-generated image**
```bash
bun run ~/.claude/skills/media/ImageRestoration/Tools/Restore.ts \
  --model codeformer \
  --image ~/Downloads/ai-portrait.png \
  --fidelity 0.7 \
  --face-upsample \
  --output ~/Downloads/ai-portrait-fixed.png
```

---

## Integration with Other Workflows

- **Art/Essay workflow**: Restore reference images before using as refs
- **BackgroundRemoval**: Restore first, then remove background
- **Video/ImageToVideo**: Restore still image, then animate