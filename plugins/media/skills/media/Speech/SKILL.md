---
name: Speech
description: Generate speech audio using multiple TTS providers — ElevenLabs, OpenAI TTS, and 5 Replicate models (MiniMax Turbo/HD, Chatterbox, Qwen3-TTS, Voice Cloning). USE WHEN speech generation, text to speech, TTS, voice synthesis, generate audio, speak text, elevenlabs, openai tts, replicate speech, minimax, chatterbox, qwen tts, voice cloning.
role: generator
accepts:
  - text
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Speech/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Speech Skill

Generate speech audio using multiple TTS providers behind a unified CLI interface.

## Available Models

| Model | Provider | Strengths | Output |
|-------|----------|-----------|--------|
| `elevenlabs` | ElevenLabs | Highest quality, voice cloning, emotional presets | MP3 |
| `openai-tts` | OpenAI | Fast, consistent, 10 built-in voices | MP3 |
| `replicate-minimax-turbo` | MiniMax 2.8 Turbo | Fast general TTS, 17 voices, interjections, emotions | MP3 |
| `replicate-minimax-hd` | MiniMax 2.8 HD | Audiobooks, podcasts, 32 languages, full audio control | MP3 |
| `replicate-chatterbox` | Resemble AI | Voice clone from 5s audio, paralinguistic tags | WAV |
| `replicate-qwen` | Qwen3-TTS | Multilingual, voice design from text description, cloning | WAV |
| `replicate-clone` | MiniMax Clone | Create reusable voice_id from 5s+ reference audio | Utility |

## Usage

```bash
# MiniMax Turbo — fast with emotion
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-turbo \
  --text "Great news everyone!" \
  --voice-id Lively_Girl --emotion happy

# MiniMax HD — high quality, multilingual
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "Bem-vindo ao Durante OS" \
  --language pt

# Chatterbox — voice clone from reference audio
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-chatterbox \
  --text "Cloned voice speaking" \
  --ref-audio https://example.com/voice-sample.wav \
  --consent-attested   # REQUIRED: Speak.ts hard-blocks --ref-audio without affirmative consent attestation

# Qwen — voice design from text instruction
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "Hello world" \
  --instruct "speak slowly, deep male voice with warmth"

# ElevenLabs
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model elevenlabs --text "Hello" --voice fox

# OpenAI TTS
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model openai-tts --text "Hello" --voice nova --speed 1.1
```

## Model Selection Guide

| Use Case | Recommended Model |
|----------|------------------|
| Quick notification audio | `replicate-minimax-turbo` |
| Audiobook / long-form | `replicate-minimax-hd` |
| Clone a specific voice | `replicate-chatterbox` or `replicate-qwen` |
| Design a new voice from description | `replicate-qwen` |
| Portuguese / multilingual | `replicate-minimax-hd` or `replicate-qwen` |
| Highest quality, no latency concern | `elevenlabs` |
| Fast + consistent + cheap | `openai-tts` |
| Create reusable voice_id for MiniMax | `replicate-clone` |

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Generate speech, text to speech, TTS | Use `Tools/Speak.ts` with appropriate model |
| Narrate a blog post, essay, or document | `Workflows/Narrate.md` |
| Design a new voice from description | `Workflows/VoiceDesign.md` |
| Clone a voice from audio sample | `Workflows/CloneVoice.md` |
| Compare speech models side-by-side | `Workflows/CompareModels.md` |
| Voice notification (DOS system) | Use VoiceServer directly (HTTP POST to localhost:8888) |

## Examples

**Example 1: Quick speech generation**
```
User: "say 'Welcome to DOS' with a deep voice"
→ Uses Speak.ts with --model replicate-minimax-turbo --voice-id Deep_Voice_Man
→ Outputs MP3 to ~/Downloads/
```

**Example 2: Narrate a blog post**
```
User: "narrate this newsletter in Portuguese"
→ Routes to Workflows/Narrate.md
→ Uses replicate-minimax-hd with --language pt
→ Outputs long-form audio to ~/Downloads/
```

**Example 3: Design a custom voice**
```
User: "create a warm, slow-paced narrator voice"
→ Routes to Workflows/VoiceDesign.md
→ Uses replicate-qwen with --instruct "warm male voice, slow pace, narrator tone"
→ Generates test audio, iterates on description
```
