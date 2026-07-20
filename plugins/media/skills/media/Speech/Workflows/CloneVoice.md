---
name: Clone Voice
description: 
status: STABLE
---

# Voice Cloning Workflow

**Clone a real voice from a short audio sample — quick one-off or persistent reusable voice.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the CloneVoice workflow in the Speech skill to clone a voice"
```

Running **CloneVoice** in **Speech**...

---

## Purpose

The CloneVoice workflow replicates a real person's voice from a short audio sample. It supports two paths: quick cloning for immediate one-off use, and persistent cloning that creates a reusable voice ID for ongoing production.

**Use this workflow when:**
- You have a voice recording and want to generate new speech in that voice
- You need to create a persistent voice profile for repeated use
- You want to clone a voice and use it across multiple languages
- You need paralinguistic control (laughs, pauses, coughs) in a cloned voice

**This workflow does NOT cover:**
- Designing a voice from a text description (see `VoiceDesign.md`)
- Using preset/built-in voices (see `Narrate.md`)
- Comparing output quality across models (see `CompareModels.md`)

---

## Two Cloning Paths

| Path | Model | Use Case | Output | Persistence |
|------|-------|----------|--------|-------------|
| **A) Quick Clone** | `replicate-chatterbox` | One-off or experimental | WAV | None — re-upload audio each time |
| **B) Persistent Clone** | `replicate-clone` + `replicate-minimax-turbo/hd` | Production, repeated use | MP3 | Creates reusable `voice_id` |
| **C) Multilingual Clone** | `replicate-qwen` | Clone + other languages | WAV | None — re-upload audio each time |

---

## Workflow Steps

### Step 1: Obtain Reference Audio

You need a clean audio sample of the target voice:

- **Duration:** 5-10 seconds (minimum 5s)
- **Quality:** Clear speech, minimal background noise
- **Content:** Natural speech (not singing, not whispering)
- **Format:** WAV or MP3 (WAV preferred)

```bash
# Check audio file details
file ~/Downloads/voice-sample.wav

# If audio needs trimming, use ffmpeg
ffmpeg -i ~/Downloads/raw-recording.wav -ss 0 -t 10 ~/Downloads/voice-sample.wav
```

The reference audio can be a local file path or a publicly accessible URL.

### Step 2: Choose Your Cloning Path

**Path A — Quick Clone (replicate-chatterbox):**
- Best for: Quick experiments, one-off generations, paralinguistic tags
- Requires: `--ref-audio` pointing to your sample
- Supports: `[laugh]`, `[cough]`, `[sigh]`, `[gasp]` tags in text
- Output: WAV

**Path B — Persistent Clone (replicate-clone then minimax):**
- Best for: Production use, repeated generations with same voice
- Step 1: Run `replicate-clone` to create a `voice_id`
- Step 2: Use that `voice_id` with `replicate-minimax-turbo` or `replicate-minimax-hd`
- Output: MP3

**Path C — Multilingual Clone (replicate-qwen):**
- Best for: Cloning a voice and speaking in different languages
- Requires: `--ref-audio` and `--ref-text` (transcript of the reference audio)
- Output: WAV

### Step 3: Generate with Quick Clone (Path A)

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-chatterbox \
  --text "Hello, this is my cloned voice speaking new words." \
  --ref-audio ~/Downloads/voice-sample.wav \
  --output ~/Downloads/cloned-speech.wav
```

With paralinguistic tags:

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-chatterbox \
  --text "That is amazing [laugh] I can not believe it worked [gasp]" \
  --ref-audio ~/Downloads/voice-sample.wav \
  --output ~/Downloads/cloned-expressive.wav
```

### Step 4: Generate with Persistent Clone (Path B)

First, create the reusable voice ID:

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-clone \
  --ref-audio ~/Downloads/voice-sample.wav \
  --output ~/Downloads/clone-result.json
```

This returns a `voice_id`. Use it with MiniMax models:

```bash
# With MiniMax Turbo (fast, emotions)
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-turbo \
  --text "Now I can generate unlimited speech in this voice." \
  --voice-id [RETURNED_VOICE_ID] \
  --output ~/Downloads/persistent-clone.mp3

# With MiniMax HD (audiobook quality, multilingual)
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "This is the same voice in high definition quality." \
  --voice-id [RETURNED_VOICE_ID] \
  --output ~/Downloads/persistent-clone-hd.mp3
```

### Step 5: Generate with Multilingual Clone (Path C)

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "Bonjour, je parle maintenant en francais avec cette voix clonee." \
  --ref-audio ~/Downloads/voice-sample.wav \
  --ref-text "This is the original English transcript of my reference audio." \
  --output ~/Downloads/cloned-french.wav
```

### Step 6: Test and Validate

Listen to the output and compare with the reference:

```bash
# Open both for A/B comparison
open ~/Downloads/voice-sample.wav
open ~/Downloads/cloned-speech.wav
```

If quality is insufficient:
- Try a cleaner or longer reference audio sample
- Switch between paths (chatterbox vs qwen)
- For persistent clone, ensure the voice_id was created from a clean sample

---

## Intent-to-Flag Mapping

| User Says | Model | Flags | Rationale |
|-----------|-------|-------|-----------|
| "clone this voice" | `replicate-chatterbox` | `--ref-audio [path]` | Quick one-off clone |
| "clone with laughs/coughs" | `replicate-chatterbox` | `--ref-audio` + tags in `--text` | Paralinguistic support |
| "permanent voice", "reusable voice" | `replicate-clone` | `--ref-audio [path]` | Creates persistent voice_id |
| "use my cloned voice" | `replicate-minimax-turbo/hd` | `--voice-id [id]` | Uses previously created voice_id |
| "clone + Portuguese" | `replicate-qwen` | `--ref-audio` + `--ref-text` | Multilingual voice cloning |
| "clone + other language" | `replicate-qwen` | `--ref-audio` + `--ref-text` | Cross-lingual voice transfer |
| "clone for production" | `replicate-clone` then `minimax-hd` | Two-step | Persistent + highest quality |
| "quick voice test" | `replicate-chatterbox` | `--ref-audio` + short `--text` | Fast clone iteration |

---

## Reference Audio Tips

### Good Reference Audio

- 5-10 seconds of clear, natural speech
- Single speaker, no overlapping voices
- Minimal background noise
- Normal speaking pace and volume
- Consistent tone (not transitioning between emotions)

### Bad Reference Audio

- Under 3 seconds (insufficient data)
- Heavy background music or noise
- Multiple speakers
- Whispering or shouting
- Heavy compression or distortion

---

## Examples

### Example 1: Quick Clone for a Demo

```
User: "Clone my voice from this recording and say the demo script"

Action:
1. User provides ~/Downloads/my-voice.wav (7s sample)
2. Select Path A — replicate-chatterbox (quick, one-off)
3. Generate with demo script text
4. Output: ~/Downloads/demo-cloned.wav

bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-chatterbox \
  --text "Welcome to Durante OS. Let me show you what is possible." \
  --ref-audio ~/Downloads/my-voice.wav \
  --output ~/Downloads/demo-cloned.wav
```

### Example 2: Persistent Voice for Content Series

```
User: "Create a permanent voice from this sample for my weekly updates"

Action:
1. User provides ~/Downloads/narrator-sample.wav (10s sample)
2. Select Path B — replicate-clone for persistence
3. Create voice_id, then generate with minimax-hd
4. Save voice_id for future use

# Step 1: Create voice
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-clone \
  --ref-audio ~/Downloads/narrator-sample.wav \
  --output ~/Downloads/voice-id-result.json

# Step 2: Use for content
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "This week in AI, several breakthroughs emerged..." \
  --voice-id [VOICE_ID_FROM_STEP_1] \
  --output ~/Downloads/weekly-update-01.mp3
```

### Example 3: Clone Voice into Portuguese

```
User: "Take this English voice sample and make it speak Portuguese"

Action:
1. User provides ~/Downloads/english-voice.wav with transcript
2. Select Path C — replicate-qwen (multilingual clone)
3. Generate PT-BR speech with cloned voice
4. Output: ~/Downloads/cloned-portuguese.wav

bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "Bem-vindo ao Durante. Estamos felizes em ter voce aqui." \
  --ref-audio ~/Downloads/english-voice.wav \
  --ref-text "Welcome to Durante. We are happy to have you here." \
  --output ~/Downloads/cloned-portuguese.wav
```