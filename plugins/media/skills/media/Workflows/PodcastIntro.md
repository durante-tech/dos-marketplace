---
name: Podcast Intro
description: Generate a complete podcast/video intro package — branded cover image plus spoken intro audio.
status: STABLE
bestPath:
  - title: "Define Show Identity"
    description: "Gather show name, tagline, intro script, mood, and format (podcast or video) from the user."
  - title: "Generate Cover Art"
    description: "Produce a podcast (1:1) or video (16:9) cover image matching the show's brand and mood."
  - title: "Generate Spoken Intro"
    description: "Produce the narrated intro audio using a voice/model matched to the chosen mood."
  - title: "Output & Review"
    description: "Deliver the cover image and intro audio to Downloads as a matched, reviewable pair."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Media PodcastIntro workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# PodcastIntro Workflow

## When to Use

- User wants a branded intro package for a podcast or video show
- User says "podcast intro", "show opener", "branded intro package"
- NOT for narrating existing long-form content (use ContentToVisual) or a standalone cover image only (use `Art/SKILL.md`)

**Generate a complete podcast/video intro package: branded cover image + spoken intro audio.**

<!-- partial: _workflow-voice.md skill_name=Media workflow_name=PodcastIntro action_phrase=" to generate cover art and spoken intro audio" -->

## Purpose

Create a cohesive intro package for podcasts or video shows in a single workflow. Combines the Art skill (cover image generation) with the Speech skill (spoken intro narration) to produce two complementary assets that share a unified brand identity.

---

## Workflow Steps

### Step 1: Define Show Identity

Gather from the user's request:

1. **Show name** -- the podcast or video series title
2. **Tagline** -- a short phrase or subtitle (e.g., "Intelligence that compounds.")
3. **Intro text** -- the spoken intro script (e.g., "Welcome to Durante. Intelligence that compounds. Let's go.")
4. **Mood** -- energetic, calm, professional, playful (defaults to energetic)
5. **Format** -- podcast (1:1 cover) or video (16:9 thumbnail)

If the user provides only a show name, generate a tagline and intro text based on context.

---

### Step 2: Generate Cover Art

Choose the appropriate aspect ratio based on format:

| Format | Aspect Ratio | Use Case |
|--------|-------------|----------|
| Podcast | 1:1 | Apple Podcasts, Spotify cover |
| Video | 16:9 | YouTube thumbnail, video intro frame |
| Both | Generate both | Full package |

```bash
# Podcast cover (1:1)
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[SHOW_NAME] podcast cover art. [VISUAL_DESCRIPTION]. Bold title text: [SHOW_NAME]. Tagline: [TAGLINE]. Professional podcast branding, cinematic lighting, rich colors." \
  --size 1:1 \
  --output ~/Downloads/podcast-cover-[show-name-slug].png

# Video thumbnail (16:9)
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[SHOW_NAME] video intro frame. [VISUAL_DESCRIPTION]. Title text: [SHOW_NAME]. Cinematic widescreen composition, broadcast quality." \
  --size 16:9 \
  --output ~/Downloads/video-cover-[show-name-slug].png
```

**Model selection:**
- `seedream` -- default, cinematic film quality
- `imagen-4-ultra` -- when typography/title rendering is critical
- `flux-2-max` -- highest detail for complex compositions

---

### Step 3: Generate Spoken Intro

```bash
# Fast, energetic intro (default)
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-turbo \
  --text "[INTRO_TEXT]" \
  --voice-id Lively_Girl \
  --emotion happy \
  --output ~/Downloads/podcast-intro-[show-name-slug].mp3

# Professional, warm tone alternative
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model elevenlabs \
  --text "[INTRO_TEXT]" \
  --voice fox \
  --output ~/Downloads/podcast-intro-[show-name-slug].mp3
```

**Voice selection by mood:**

| Mood | Model | Voice / Options |
|------|-------|----------------|
| Energetic | `replicate-minimax-turbo` | `--voice-id Lively_Girl --emotion happy` |
| Professional | `replicate-minimax-turbo` | `--voice-id Wise_Woman --emotion neutral` |
| Calm / reflective | `replicate-minimax-hd` | `--voice-id Gentle_Man` |
| Custom brand voice | `elevenlabs` | `--voice fox` (or user's cloned voice) |

---

### Step 4: Output and Review

All assets go to `~/Downloads/` with descriptive names:

```
~/Downloads/podcast-cover-[show-name-slug].png
~/Downloads/video-cover-[show-name-slug].png    (if video format requested)
~/Downloads/podcast-intro-[show-name-slug].mp3
```

```bash
# Open cover for visual review
open ~/Downloads/podcast-cover-[show-name-slug].png

# Play intro audio
afplay ~/Downloads/podcast-intro-[show-name-slug].mp3
```

Report to the user:
- Cover image dimensions and model used
- Audio duration, voice, and emotion settings
- Suggested next steps (upload to host, add to video editor)

---

### Step 5: Optional Enhancements

- Use `--emotion happy` or `--emotion excited` for high-energy intros
- Generate multiple voice takes with different models for A/B comparison
- Create both 1:1 and 16:9 covers for cross-platform use
- Add `--thumbnail` flag if the cover will be used as a blog header

---

## Intent-to-Flag Mapping

| User Says | Art Flag | Speech Flag |
|-----------|----------|-------------|
| "podcast" | `--size 1:1` | (default) |
| "video", "YouTube" | `--size 16:9` | (default) |
| "energetic", "upbeat" | (default) | `--emotion happy` |
| "calm", "reflective" | (default) | `--voice-id Gentle_Man` |
| "professional" | `--model imagen-4-ultra` | `--voice-id Wise_Woman` |
| "cinematic" | `--model seedream` | `--model replicate-minimax-hd` |
| "fast draft" | `--model flux` | `--model replicate-minimax-turbo` |

---

## Examples

**Example 1: "Intelligence that compounds" podcast intro**
```
User: "Create a podcast intro for MyShow -- tagline is 'Intelligence that compounds'"
-> Generates 1:1 cover with seedream: dark cinematic, "MyShow" title, tech aesthetic
-> Generates spoken intro with minimax-turbo: "Welcome to MyShow. Intelligence that compounds."
-> Outputs: podcast-cover-myshow.png + podcast-intro-myshow.mp3
```

**Example 2: YouTube show opener**
```
User: "Make a video intro package for my show 'Build in Public' -- energetic vibe"
-> Generates 16:9 thumbnail with seedream: bold visual, "Build in Public" title
-> Generates spoken intro with minimax-turbo: --emotion happy, --voice-id Lively_Girl
-> Outputs: video-cover-build-in-public.png + podcast-intro-build-in-public.mp3
```

**Example 3: Bilingual intro**
```
User: "Portuguese podcast intro for 'Futuro Digital'"
-> Generates 1:1 cover with imagen-4-ultra (better PT-BR text rendering)
-> Generates spoken intro with minimax-hd: --language pt
-> Outputs: podcast-cover-futuro-digital.png + podcast-intro-futuro-digital.mp3
```