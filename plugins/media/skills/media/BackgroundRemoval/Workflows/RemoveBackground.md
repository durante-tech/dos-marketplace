---
name: Remove Background
description: 
status: STABLE
---

# Remove Background Workflow

**Remove or replace backgrounds from images using AI models.**

## Purpose

Remove, replace, or manipulate image backgrounds. Supports:
- Transparent PNG output (standard background removal)
- Green screen for video compositing
- Blurred background for portrait/product shots
- Custom color background for brand consistency
- Reverse mode (remove foreground, keep background)

---

## Workflow Steps

### Step 1: Verify Input Image

Confirm the image exists and note format:

```bash
ls -lh /path/to/image.png
```

Supported formats: PNG, JPEG, WebP.

### Step 2: Select Model and Mode

#### Intent-to-Flag Mapping

| User Says | Flags | When to Use |
|-----------|-------|-------------|
| "remove background" | `--model remove-bg` | Fast, simple transparent output |
| "soft edges", "feathered" | `--model 851-labs` | Soft alpha blending (default threshold 0.0) |
| "green screen" | `--model 851-labs --background-type green` | Chroma key compositing |
| "blur background" | `--model 851-labs --background-type blur` | Portrait / product emphasis |
| "white background" | `--model 851-labs --background-type white` | Clean product shots |
| "brand color" | `--model 851-labs --background-type "[234,233,223]"` | Brand-specific bg color |
| "remove foreground" | `--model 851-labs --reverse` | Keep only the background |
| "no replicate key" | `--model removebg-api` | Fallback to remove.bg cloud API |

### Step 3: Run Background Removal

```bash
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model remove-bg \
  --image ~/Downloads/input-photo.png \
  --output ~/Downloads/transparent-photo.png
```

#### Advanced: 851 Labs with Custom Background

```bash
# Green screen
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model 851-labs \
  --image ~/Downloads/portrait.jpg \
  --background-type green \
  --output ~/Downloads/greenscreen.png

# Blur background
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model 851-labs \
  --image ~/Downloads/headshot.jpg \
  --background-type blur \
  --output ~/Downloads/portrait-blur.png

# Custom RGB color
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model 851-labs \
  --image ~/Downloads/logo.png \
  --background-type "[234,233,223]" \
  --output ~/Downloads/logo-branded.png
```

### Step 4: Verify Output

```bash
ls -lh ~/Downloads/transparent-photo.png
open ~/Downloads/transparent-photo.png
```

Check that:
- File size differs from original (processing happened)
- Transparency is correct (for transparent mode)
- Background replacement looks clean (for color/blur modes)

---

## Examples

**Example 1: Quick product photo cleanup**
```bash
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model remove-bg \
  --image ~/Downloads/product-shot.jpg \
  --output ~/Downloads/product-transparent.png
```

**Example 2: Batch processing (multiple images)**
```bash
for img in ~/Downloads/batch-*.png; do
  output="${img%.png}-clean.png"
  bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
    --model remove-bg --image "$img" --output "$output"
done
```

**Example 3: Portrait with blurred background**
```bash
bun run ~/.claude/skills/media/BackgroundRemoval/Tools/RemoveBg.ts \
  --model 851-labs \
  --image ~/Downloads/headshot.jpg \
  --background-type blur \
  --output ~/Downloads/headshot-portrait.png
```

---

## Integration with Other Workflows

This workflow integrates with:
- **Art/Essay workflow**: Use `--remove-bg` flag in Generate.ts (calls remove.bg API)
- **Art/CreateDOSPackIcon workflow**: Icon generation with `--remove-bg` for transparency
- **Video/ImageToVideo workflow**: Create transparent subject, then animate