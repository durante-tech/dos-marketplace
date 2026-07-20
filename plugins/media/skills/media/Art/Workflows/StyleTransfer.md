---
name: Style Transfer
description: 
status: STABLE
---

# Style Transfer Workflow

**Maintain visual style and character consistency across multiple images using reference images.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Style Transfer workflow in the Art skill for consistent style generation"
```

Running **StyleTransfer** in **Art**...

---

## Purpose

Generate new images that maintain visual consistency with existing ones -- same character, same style, same brand aesthetic. This workflow uses reference images to anchor the generation, ensuring that a series of images looks like it came from the same artist, campaign, or universe.

**Use this workflow for:**
- Character consistency across a series (same person/mascot in different scenes)
- Brand visual consistency (same illustration style for all blog headers)
- Campaign cohesion (matching aesthetic across multiple deliverables)
- Style replication (generate new images that match an established look)
- Sequential storytelling (same characters across comic panels or story beats)

---

## Reference-Capable Models

| Model | Max Refs | Ref Flag | Best For |
|-------|----------|----------|----------|
| `flux-2-pro` | 8 | `--reference-image URL` | Character consistency, compositional control |
| `flux-2-max` | 8 | `--reference-image URL` | Highest quality Flux, cinematic character work |
| `seedream` | 14 | `--reference-image URL` | Style matching, cinematic film-like consistency |
| `nano-banana-replicate` | 14 | `--reference-image URL` | Multilingual text, high ref count, 4K output |
| `nano-banana-pro` | 14 | `--reference-image PATH` | Local file refs (Gemini API), 4K, multilingual |

---

## Workflow Steps

### Step 1: Identify Reference Images

Gather 1-5 images that define the style or character you want to maintain. More refs give the model stronger signal.

**For character consistency:**
- Include the character from multiple angles if possible
- Show the character in different poses or lighting
- 3-5 refs is the sweet spot for character lock-in

**For style consistency:**
- Include 2-4 images in the target style
- Mix different subjects so the model learns the style, not the content
- Include variety in composition to avoid over-fitting to one layout

### Step 2: Upload or Prepare References

References must be URLs for Replicate models or local file paths for `nano-banana-pro` (Gemini).

```bash
# For Replicate models (flux-2-pro, flux-2-max, seedream, nano-banana-replicate):
# Images must be hosted URLs
REF1="https://hosted.example.com/character-front.png"
REF2="https://hosted.example.com/character-side.png"
REF3="https://hosted.example.com/character-action.png"

# For nano-banana-pro (Gemini API):
# Local file paths work directly
REF1="$HOME/assets/style-ref-1.png"
REF2="$HOME/assets/style-ref-2.png"
```

### Step 3: Craft the Prompt

Describe the NEW scene while referencing the style or character from the refs. Be explicit about what should carry over and what should be new.

```
# Character consistency prompt pattern:
"[Same character from reference images] in a [new scene]. 
 Maintain exact appearance, clothing, and features. 
 [New scene description with lighting, environment, pose]."

# Style consistency prompt pattern:
"[New subject] in the exact same visual style as the reference images. 
 Match the color palette, linework, texture, and artistic medium. 
 [Scene description]."
```

### Step 4: Generate with References Attached

**Character consistency with flux-2-pro (up to 8 refs):**

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-pro \
  --prompt "The same character from the reference images, now standing in a rainy Tokyo street at night, neon reflections on wet pavement, same outfit and features" \
  --reference-image "https://hosted.example.com/char-front.png" \
  --reference-image "https://hosted.example.com/char-side.png" \
  --reference-image "https://hosted.example.com/char-action.png" \
  --size 16:9 \
  --output ~/Downloads/character-tokyo.png
```

**Style matching with seedream (up to 14 refs):**

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "A mountain landscape at dawn, same artistic style as reference images, matching color palette and brushwork, cinematic composition" \
  --reference-image "https://hosted.example.com/style-ref-1.png" \
  --reference-image "https://hosted.example.com/style-ref-2.png" \
  --reference-image "https://hosted.example.com/style-ref-3.png" \
  --size 16:9 \
  --output ~/Downloads/mountain-styled.png
```

**Brand consistency with nano-banana-pro (local files, up to 14 refs):**

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "A new blog header showing a developer at a terminal, same illustration style as references, matching brand colors and linework" \
  --reference-image /path/to/brand-header-1.png \
  --reference-image /path/to/brand-header-2.png \
  --size 2K \
  --aspect-ratio 16:9 \
  --output ~/Downloads/blog-header-new.png
```

### Step 5: Compare to Original Style

```bash
# Open the new image alongside a reference for comparison
open ~/Downloads/character-tokyo.png
```

Check that the key visual elements carried over:
- Color palette matches
- Line quality / texture matches
- Character features are consistent (if character transfer)
- Overall aesthetic feels like the same series

---

## Intent-to-Flag Mapping

| User Intent | Model | Why | Refs |
|-------------|-------|-----|------|
| "same character in a new scene" | `flux-2-pro` | Strong compositional character lock | up to 8 |
| "same character, highest quality" | `flux-2-max` | Best Flux quality + character refs | up to 8 |
| "same style, different subject" | `seedream` | Best style transfer, cinematic | up to 14 |
| "match this illustration style" | `seedream` | High ref count, style-first model | up to 14 |
| "brand consistency" | `nano-banana-pro` | Local file refs, 4K, brand work | up to 14 |
| "series of matching images" | `nano-banana-replicate` | High ref count, consistent 4K | up to 14 |
| "character sheet" | `flux-2-pro` | Multiple angles from refs | up to 8 |

---

## Examples

### Example 1: Character Across Scenes

User says: "Generate my fox mascot in three different environments."

```bash
# Scene 1: Office
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-pro \
  --prompt "The same fox character from references, sitting at a modern desk with multiple monitors, professional office setting, warm lighting" \
  --reference-image "https://hosted.example.com/fox-front.png" \
  --reference-image "https://hosted.example.com/fox-profile.png" \
  --size 16:9 \
  --output ~/Downloads/fox-office.png

# Scene 2: Outdoors
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-pro \
  --prompt "The same fox character from references, hiking on a mountain trail at sunrise, adventurous pose, golden hour lighting" \
  --reference-image "https://hosted.example.com/fox-front.png" \
  --reference-image "https://hosted.example.com/fox-profile.png" \
  --size 16:9 \
  --output ~/Downloads/fox-mountain.png

# Scene 3: Stage
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-pro \
  --prompt "The same fox character from references, presenting on a conference stage with a large screen behind, spotlight, audience silhouettes" \
  --reference-image "https://hosted.example.com/fox-front.png" \
  --reference-image "https://hosted.example.com/fox-profile.png" \
  --size 16:9 \
  --output ~/Downloads/fox-stage.png
```

### Example 2: Blog Header Series in Matching Style

User says: "I need 2 new blog headers matching our existing style."

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "Abstract visualization of data flowing through a neural network, same artistic style as references, matching color palette and texture" \
  --reference-image "https://hosted.example.com/blog-header-1.png" \
  --reference-image "https://hosted.example.com/blog-header-2.png" \
  --reference-image "https://hosted.example.com/blog-header-3.png" \
  --size 16:9 \
  --output ~/Downloads/blog-header-neural.png

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "Abstract visualization of a shield protecting digital assets, same artistic style as references, matching color palette and texture" \
  --reference-image "https://hosted.example.com/blog-header-1.png" \
  --reference-image "https://hosted.example.com/blog-header-2.png" \
  --reference-image "https://hosted.example.com/blog-header-3.png" \
  --size 16:9 \
  --output ~/Downloads/blog-header-security.png
```

### Example 3: Brand Asset with Local Refs (Gemini)

User says: "Create a new icon matching our brand style, I have the refs locally."

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "A settings gear icon in the exact same illustration style as the reference images, matching line weight, color palette, and texture" \
  --reference-image "$HOME/assets/brand-icon-1.png" \
  --reference-image "$HOME/assets/brand-icon-2.png" \
  --reference-image "$HOME/assets/brand-icon-3.png" \
  --size 1K \
  --aspect-ratio 1:1 \
  --output ~/Downloads/brand-icon-settings.png
```

---

**The workflow: Gather refs -> Prepare URLs/paths -> Craft style-aware prompt -> Generate with refs -> Compare to originals**
