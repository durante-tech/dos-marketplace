---
name: Social Kit
description: 
status: STABLE
---

# SocialKit Workflow

**Generate a complete social media content kit from one piece of content: platform-specific images + audio clips for Reels/TikTok.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the SocialKit workflow to generate platform images and audio clips from content"
```

Running **SocialKit** in **SocialMedia**...

---

## Purpose

Transform a single piece of content (article, essay, product launch, announcement) into a complete social media distribution kit. Produces correctly-sized images for each platform plus short audio clips for Reels and TikTok -- all from one source input. This eliminates the manual work of reformatting content across platforms.

---

## Workflow Steps

### Step 1: Read and Extract Source Content

Read the source material and extract:

1. **Key quote or hook** -- the most shareable 1-2 sentence excerpt (for audio clips)
2. **Visual concept** -- the core image idea that represents the content
3. **Title/headline** -- for text overlay in images
4. **Target platforms** -- which platforms to generate for (default: all)

If the user does not specify platforms, generate for all five: Instagram, X/Twitter, LinkedIn, Facebook, TikTok.

---

### Step 2: Extract Audio Hook

Identify the strongest 15-30 second spoken excerpt from the content. This becomes the Reels/TikTok audio clip.

Criteria for a strong hook:
- Opens with a provocative statement or question
- Self-contained (makes sense without surrounding context)
- Under 30 seconds when spoken (~75 words max)
- Ends on a strong note or call to action

---

### Step 3: Generate Platform-Specific Images

Generate images sized for each target platform using the SocialMedia format specifications.

**Platform Defaults (from `SocialMedia/SKILL.md`):**

| Platform | Dimensions | Aspect Ratio | Model Flag |
|----------|-----------|--------------|------------|
| Instagram | 1080x1350 | 4:5 | `--size 4:5` |
| X/Twitter | 1200x675 | 16:9 | `--size 16:9` |
| LinkedIn | 1080x1350 | 4:5 | `--size 4:5` |
| Facebook | 1080x1350 | 4:5 | `--size 4:5` |
| TikTok | 1080x1920 | 9:16 | `--size 9:16` |

For formats requiring post-generation resize (1.91:1 OG images, banners), follow the resize rules in `SocialMedia/SKILL.md`.

```bash
# Instagram (4:5 portrait)
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[VISUAL_CONCEPT]. Bold, scroll-stopping composition. Title: [HEADLINE]. Instagram-optimized, vibrant colors, clean layout." \
  --size 4:5 \
  --output ~/Downloads/socialkit-[slug]-instagram.png

# X/Twitter (16:9 landscape)
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[VISUAL_CONCEPT]. Widescreen composition, high contrast for timeline visibility. Title: [HEADLINE]." \
  --size 16:9 \
  --output ~/Downloads/socialkit-[slug]-x-twitter.png

# LinkedIn (4:5 portrait)
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[VISUAL_CONCEPT]. Professional, editorial quality. Title: [HEADLINE]. Clean, authoritative design." \
  --size 4:5 \
  --output ~/Downloads/socialkit-[slug]-linkedin.png

# Facebook (4:5 portrait)
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[VISUAL_CONCEPT]. Engaging, shareable composition. Title: [HEADLINE]. Clear visual hierarchy." \
  --size 4:5 \
  --output ~/Downloads/socialkit-[slug]-facebook.png

# TikTok (9:16 vertical)
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[VISUAL_CONCEPT]. Vertical composition, bold and dynamic. SAFE ZONE: Keep critical content within center 960x1386 area. Right 164px has engagement icons. Bottom 324px has captions." \
  --size 9:16 \
  --output ~/Downloads/socialkit-[slug]-tiktok.png
```

**Model selection:**
- `seedream` -- default, cinematic quality for social visuals
- `flux-2-max` -- when maximum detail or photorealism is needed
- `imagen-4-ultra` -- when typography or text overlay quality is critical

---

### Step 4: Generate Audio Clip for Reels/TikTok

Generate a short, punchy audio clip (15-30 seconds) from the extracted hook text.

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-turbo \
  --text "[AUDIO_HOOK_TEXT]" \
  --voice-id Lively_Girl \
  --emotion happy \
  --output ~/Downloads/socialkit-[slug]-reel-audio.mp3
```

**Voice and emotion by content type:**

| Content Type | Voice | Emotion | Rationale |
|-------------|-------|---------|-----------|
| Announcement / launch | `Lively_Girl` | `happy` | High energy, excitement |
| Thought leadership | `Wise_Woman` | `neutral` | Authority, gravitas |
| Tutorial / how-to | `Gentle_Man` | `neutral` | Clear, approachable |
| Provocative / debate | `Deep_Male` | `surprised` | Attention-grabbing |
| Portuguese content | (any) + `--language pt` | (match tone) | Multilingual support |

For A/B testing, generate multiple takes:

```bash
# Take A: energetic
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-turbo \
  --text "[HOOK]" --voice-id Lively_Girl --emotion happy \
  --output ~/Downloads/socialkit-[slug]-reel-audio-a.mp3

# Take B: authoritative
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-turbo \
  --text "[HOOK]" --voice-id Wise_Woman --emotion neutral \
  --output ~/Downloads/socialkit-[slug]-reel-audio-b.mp3
```

---

### Step 5: Output Organized by Platform

All assets go to `~/Downloads/` with platform-prefixed names:

```
~/Downloads/socialkit-[slug]-instagram.png
~/Downloads/socialkit-[slug]-x-twitter.png
~/Downloads/socialkit-[slug]-linkedin.png
~/Downloads/socialkit-[slug]-facebook.png
~/Downloads/socialkit-[slug]-tiktok.png
~/Downloads/socialkit-[slug]-reel-audio.mp3
```

```bash
# Open all images for review
open ~/Downloads/socialkit-[slug]-*.png

# Play audio clip
afplay ~/Downloads/socialkit-[slug]-reel-audio.mp3
```

Report to the user:
- Platforms generated for (with dimensions)
- Audio clip duration and voice used
- Any safe zone adjustments applied (TikTok, Stories)
- Suggested posting order and timing

---

## Intent-to-Flag Mapping

| User Says | Art Flag | Speech Flag |
|-----------|----------|-------------|
| "Instagram only" | `--size 4:5` (single) | (default) |
| "X only", "Twitter only" | `--size 16:9` (single) | (default) |
| "all platforms" | Generate all 5 | Generate audio |
| "no audio" | Generate images only | Skip speech |
| "energetic", "hype" | (default) | `--emotion happy` |
| "professional" | `--model imagen-4-ultra` | `--voice-id Wise_Woman` |
| "fast draft" | `--model flux` | `--model replicate-minimax-turbo` |
| "highest quality" | `--model flux-2-max` | `--model replicate-minimax-hd` |
| "Portuguese" | (default) | `--language pt` |
| "with OG image" | Add 16:9 + crop to 1200x628 | (default) |

---

## Examples

**Example 1: Full social kit from a blog post**
```
User: "Generate a social kit for my post about Claude Code as an OS layer"
-> Reads post, extracts visual concept + audio hook
-> Generates 5 platform images (Instagram 4:5, X 16:9, LinkedIn 4:5, Facebook 4:5, TikTok 9:16)
-> Generates 20s audio clip with minimax-turbo (energetic)
-> Outputs: socialkit-claude-code-os-layer-{platform}.png + reel-audio.mp3
```

**Example 2: Single platform + audio**
```
User: "Just Instagram and a Reel audio for this product launch"
-> Extracts key visual and hook from launch content
-> Generates Instagram 4:5 image with seedream
-> Generates 15s energetic audio clip (--emotion happy)
-> Outputs: socialkit-product-launch-instagram.png + reel-audio.mp3
```

**Example 3: Portuguese launch kit**
```
User: "Kit social para o lançamento do DOS em português"
-> Extracts visual concept and hook in PT-BR
-> Generates all 5 platform images
-> Generates audio with minimax-turbo --language pt
-> Outputs: socialkit-lancamento-dos-{platform}.png + reel-audio.mp3
```