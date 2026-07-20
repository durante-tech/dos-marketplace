---
name: Narrate
description: 
status: STABLE
---

# Content Narration Workflow

**Convert text content — blog posts, essays, documentation — into professionally narrated audio.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Narrate workflow in the Speech skill to generate narrated audio"
```

Running **Narrate** in **Speech**...

---

## Purpose

The Narrate workflow transforms written content into high-quality spoken audio. It handles everything from short paragraphs to full-length articles, automatically selecting the best model based on content length, language, and desired tone.

**Use this workflow when:**
- Converting a blog post or essay into audio for distribution
- Creating audio versions of documentation or guides
- Generating narration for video voiceovers
- Producing podcast-style readings of written content
- Narrating content in Portuguese (PT-BR) or other languages

**This workflow does NOT cover:**
- Voice cloning (see `CloneVoice.md`)
- Designing a new voice from scratch (see `VoiceDesign.md`)
- Comparing models side-by-side (see `CompareModels.md`)

---

## Workflow Steps

### Step 1: Read the Source Content

Load the text to narrate. Accept input from file path, clipboard, or inline text.

```bash
# From a file
cat ~/Documents/blog-post.md

# Or receive inline text directly from the user
```

Assess the content: character count, language, number of paragraphs, and emotional tone.

### Step 2: Split Long Content (if > 500 characters)

For long-form content, split into logical sections (paragraphs or headings) to ensure consistent quality and avoid model token limits.

```bash
# Determine character count
wc -c ~/Documents/blog-post.md

# Split strategy:
# - Under 500 chars: single generation
# - 500-2000 chars: split by paragraph
# - Over 2000 chars: split by heading/section
```

### Step 3: Select Model Based on Content and Language

Choose the optimal model for the narration task:

- **Long-form English content** — `replicate-minimax-hd` (audiobook quality, natural pacing)
- **Long-form PT-BR or multilingual** — `replicate-minimax-hd` with `--language pt`
- **Short content, fast turnaround** — `openai-tts` (reliable, fast)
- **Emotional narration needed** — `replicate-minimax-turbo` with `--emotion`
- **Highest possible quality** — `elevenlabs` (premium, natural prosody)

### Step 4: Generate Speech

```bash
# Standard narration (long-form English)
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "Your content here..." \
  --output ~/Downloads/narration.mp3

# Portuguese narration
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "Seu conteudo aqui..." \
  --language pt \
  --output ~/Downloads/narration-pt.mp3

# Quick preview
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model openai-tts \
  --text "Preview this section..." \
  --voice nova \
  --output ~/Downloads/narration-preview.mp3

# Emotional narration
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-turbo \
  --text "An inspiring story..." \
  --emotion happy \
  --output ~/Downloads/narration-emotional.mp3
```

For multi-section content, generate sequentially with consistent settings:

```bash
# Section 1
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "Section 1 content..." \
  --output ~/Downloads/narration-01.mp3

# Section 2
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "Section 2 content..." \
  --output ~/Downloads/narration-02.mp3

# Continue for each section...
```

### Step 5: Output to Downloads

All output goes to `~/Downloads/` with descriptive filenames:

```bash
# Open the result
open ~/Downloads/narration.mp3
```

---

## Port form (RFC-0031 Phase 2) — `bun Tools/dos-audio.ts <text> --intent=<X>`

For single-shot narrations outside the multi-step workflow above, prefer the `audio.synthesize` Port at `Tools/dos-audio.ts`. The Port routes intent → Adapter (ElevenLabs / Replicate / Whisper / VoiceClone) and subprocess-calls this same Speak.ts Adapter under the hood — same Studio gateway, same credit metering, same artifact tracking. Skills/workflows emit *intent*, not *vendor*.

```bash
# Long-form narration — Port routes to ElevenLabs (highest quality default)
bun Tools/dos-audio.ts "Once upon a time, in a land far away..." \
  --intent=tts-narration \
  --output=~/Downloads/story.mp3 \
  --telemetry-tag=Speech/Narrate

# Short podcast intro — Port routes to ElevenLabs (same Adapter; short-form variant)
bun Tools/dos-audio.ts "Welcome to the Builder's Compass." \
  --intent=tts-podcast-intro \
  --output=~/Downloads/intro.mp3

# Voice design — Port routes to Replicate (Qwen3-TTS instruction-driven voice)
bun Tools/dos-audio.ts "Read in a calm reflective tone with even pacing." \
  --intent=voice-design \
  --output=~/Downloads/design.wav
```

Use the Port form when:
- A single audio file at a single intent (no multi-step content-to-audio pipeline)
- Telemetry attribution matters (`--telemetry-tag` records the caller in `MEMORY/ARTIFACTS/dos-router-telemetry.jsonl`)
- The caller is bash / agent CLI / external workflow

Use the Speak.ts CLI form (this workflow) when:
- Per-model tuning (`--speed`, `--stability`, `--exaggeration`, `--cfg-weight`)
- Voice selection beyond the Port's `--voice` pass-through
- Integration with the multi-step Narrate flow (model selection by content length)

**Stubbed intents (Phase 2.B):** `transcribe` and `voice-clone` — current dos-audio.ts walking skeleton documents the 5-intent surface but only wires 3 (TTS-shaped) Adapters. Phase 2.B will add Whisper transcribe + voice-clone via Replicate's `replicate-clone` model.

---

## Intent-to-Flag Mapping

| User Says | Model | Flags | Rationale |
|-----------|-------|-------|-----------|
| "narrate this blog post" | `replicate-minimax-hd` | (default) | Long-form quality, natural pacing |
| "quick preview", "read this quick" | `openai-tts` | `--voice nova` | Fast generation, consistent output |
| "narrate in Portuguese", "PT-BR" | `replicate-minimax-hd` | `--language pt` | 32-language support including PT-BR |
| "emotional narration", "read with feeling" | `replicate-minimax-turbo` | `--emotion [happy/sad/angry]` | Emotion control per sentence |
| "highest quality narration" | `elevenlabs` | `--voice` [selected] | Premium quality, best prosody |
| "read this fast", "speed up" | `openai-tts` | `--speed 1.3` | Speed control built-in |
| "audiobook style" | `replicate-minimax-hd` | (default) | Designed for long-form audio |
| "multilingual", "Spanish", "French" | `replicate-minimax-hd` | `--language [code]` | 32-language support |

---

## Examples

### Example 1: Blog Post Narration

```
User: "Narrate this blog post about AI agents"

Action:
1. Read the blog post content (~1500 chars, English)
2. Split into 3 paragraphs
3. Select replicate-minimax-hd (long-form English)
4. Generate 3 audio files sequentially
5. Output: ~/Downloads/ai-agents-01.mp3, ai-agents-02.mp3, ai-agents-03.mp3
```

### Example 2: Quick Portuguese Preview

```
User: "Read this paragraph in Portuguese, quick preview"

Action:
1. Content is short (~200 chars, PT-BR)
2. No splitting needed
3. Select replicate-minimax-hd with --language pt
4. Generate single file
5. Output: ~/Downloads/preview-pt.mp3
```

### Example 3: Emotional Newsletter Reading

```
User: "Read this newsletter intro with energy and excitement"

Action:
1. Content is medium (~400 chars, English)
2. No splitting needed
3. Select replicate-minimax-turbo with --emotion happy
4. Generate single file with Lively_Girl or similar energetic voice
5. Output: ~/Downloads/newsletter-intro.mp3
```