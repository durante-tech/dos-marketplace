---
name: Compare Models
description: 
status: STABLE
---

# Model Comparison Workflow

**Compare speech models side-by-side with the same text to find the best voice for your use case.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the CompareModels workflow in the Speech skill to compare TTS models"
```

Running **CompareModels** in **Speech**...

---

## Purpose

The CompareModels workflow generates the same text across multiple speech models so you can listen and compare quality, speed, naturalness, and character. Instead of guessing which model fits your needs, hear them all and pick the winner.

**Use this workflow when:**
- Starting a new project and need to choose a TTS model
- Evaluating quality differences between providers
- Comparing speed vs quality tradeoffs
- Testing how a specific text sounds across different voices
- Benchmarking after model updates

**This workflow does NOT cover:**
- Voice cloning comparison (see `CloneVoice.md` — test each clone path separately)
- Voice design iteration (see `VoiceDesign.md`)
- Production narration (see `Narrate.md` — use after you have chosen your model)

---

## Comparison Sets

Pre-defined comparison sets for common evaluation scenarios:

| Set Name | Models Included | Use Case |
|----------|----------------|----------|
| **Default (3)** | elevenlabs, openai-tts, replicate-minimax-turbo | Quick general comparison |
| **Quality (2)** | elevenlabs, replicate-minimax-hd | Best quality head-to-head |
| **Speed (3)** | openai-tts, replicate-minimax-turbo, replicate-chatterbox | Fastest options compared |
| **Full (5)** | elevenlabs, openai-tts, minimax-turbo, minimax-hd, replicate-qwen | All generative models |
| **Multilingual (2)** | replicate-minimax-hd, replicate-qwen | Language support comparison |

**Note:** `replicate-clone` is excluded from comparisons — it is a utility model that creates voice IDs, not speech.

---

## Workflow Steps

### Step 1: User Provides Text

Get the text to use across all models. Use a representative sample of the actual content:

```bash
# Good comparison text characteristics:
# - 1-3 sentences (enough to judge quality, not wasteful)
# - Mix of short and long words
# - At least one comma or pause point
# - Representative of the final use case

TEXT="The future of personal AI is not about replacing human judgment. 
It is about amplifying it, giving every person the tools to think more 
clearly and act more decisively."
```

### Step 2: Select Comparison Set

Based on the user's intent, choose the appropriate set:

```bash
# Default comparison (most common)
MODELS=("elevenlabs" "openai-tts" "replicate-minimax-turbo")

# Quality comparison
MODELS=("elevenlabs" "replicate-minimax-hd")

# Speed comparison
MODELS=("openai-tts" "replicate-minimax-turbo" "replicate-chatterbox")

# Full comparison
MODELS=("elevenlabs" "openai-tts" "replicate-minimax-turbo" "replicate-minimax-hd" "replicate-qwen")
```

### Step 3: Generate All Models in Parallel

Run each model with the same text. Use a consistent filename pattern with model suffix:

```bash
# ElevenLabs
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model elevenlabs \
  --text "The future of personal AI is not about replacing human judgment." \
  --output ~/Downloads/compare-elevenlabs.mp3

# OpenAI TTS
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model openai-tts \
  --text "The future of personal AI is not about replacing human judgment." \
  --voice nova \
  --output ~/Downloads/compare-openai.mp3

# MiniMax Turbo
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-turbo \
  --text "The future of personal AI is not about replacing human judgment." \
  --output ~/Downloads/compare-minimax-turbo.mp3

# MiniMax HD (if included)
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "The future of personal AI is not about replacing human judgment." \
  --output ~/Downloads/compare-minimax-hd.mp3

# Qwen (if included)
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "The future of personal AI is not about replacing human judgment." \
  --instruct "clear male voice, moderate pace, professional" \
  --output ~/Downloads/compare-qwen.wav
```

Generate these in parallel when possible to minimize total wait time.

### Step 4: Output with Model Suffix

All files land in `~/Downloads/` with the naming pattern `compare-[model].[ext]`:

```
~/Downloads/
  compare-elevenlabs.mp3
  compare-openai.mp3
  compare-minimax-turbo.mp3
  compare-minimax-hd.mp3
  compare-qwen.wav
```

### Step 5: Listen and Pick Winner

Open all files for sequential listening:

```bash
# Open all comparison files
open ~/Downloads/compare-elevenlabs.mp3
open ~/Downloads/compare-openai.mp3
open ~/Downloads/compare-minimax-turbo.mp3
```

Present a summary table to help the user decide:

```
| Model              | Quality   | Speed | Cost    | Format | Best For            |
|--------------------|-----------|-------|---------|--------|---------------------|
| elevenlabs         | Highest   | Med   | Highest | MP3    | Premium production  |
| openai-tts         | Good      | Fast  | Low     | MP3    | Quick, consistent   |
| minimax-turbo      | Good+     | Fast  | Low     | MP3    | Emotions, variety   |
| minimax-hd         | High      | Med   | Low     | MP3    | Long-form, 32 langs |
| qwen               | Good      | Med   | Low     | WAV    | Voice design, clone |
```

---

## Intent-to-Flag Mapping

| User Says | Comparison Set | Models | Rationale |
|-----------|---------------|--------|-----------|
| "compare voices", "which model?" | Default (3) | elevenlabs, openai-tts, minimax-turbo | Quick representative comparison |
| "compare all", "test everything" | Full (5) | All 5 generative models | Comprehensive evaluation |
| "compare quality", "best quality" | Quality (2) | elevenlabs, minimax-hd | Premium quality head-to-head |
| "compare speed", "fastest option" | Speed (3) | openai-tts, minimax-turbo, chatterbox | Latency-focused comparison |
| "compare for Portuguese" | Multilingual (2) | minimax-hd, qwen | Language support comparison |
| "compare with emotion" | Emotion (2) | elevenlabs, minimax-turbo | Emotional expression comparison |
| "cheap vs premium" | Cost (2) | openai-tts, elevenlabs | Price-quality tradeoff |

---

## Examples

### Example 1: Default Quick Comparison

```
User: "Compare how this sounds across models"

Action:
1. User provides text: "Welcome to Durante OS, your personal AI operating system."
2. Select Default set: elevenlabs, openai-tts, minimax-turbo
3. Generate 3 files in parallel
4. Output:
   - ~/Downloads/compare-elevenlabs.mp3
   - ~/Downloads/compare-openai.mp3
   - ~/Downloads/compare-minimax-turbo.mp3
5. Open all for listening
6. Present quality/speed/cost summary
```

### Example 2: Quality Shootout for Audiobook

```
User: "I need the best quality for an audiobook, compare the top models"

Action:
1. User provides a paragraph from their book
2. Select Quality set: elevenlabs, minimax-hd
3. Generate 2 files
4. Output:
   - ~/Downloads/compare-elevenlabs.mp3
   - ~/Downloads/compare-minimax-hd.mp3
5. Open both for A/B comparison
6. Recommendation: elevenlabs for English-only premium,
   minimax-hd for multilingual or cost-sensitive
```

### Example 3: Full Model Sweep

```
User: "Test all models with this line, I want to hear everything"

Action:
1. User provides text
2. Select Full set: all 5 generative models
3. Generate 5 files (parallel where possible)
4. Output:
   - ~/Downloads/compare-elevenlabs.mp3
   - ~/Downloads/compare-openai.mp3
   - ~/Downloads/compare-minimax-turbo.mp3
   - ~/Downloads/compare-minimax-hd.mp3
   - ~/Downloads/compare-qwen.wav
5. Open all sequentially
6. Present full comparison matrix with recommendation
```