---
name: Voice Design
description: 
status: STABLE
---

# Voice Design Workflow

**Design a new voice from a natural language description — no reference audio needed.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the VoiceDesign workflow in the Speech skill to create a custom voice"
```

Running **VoiceDesign** in **Speech**...

---

## Purpose

The VoiceDesign workflow creates entirely new voices from text descriptions using Qwen3-TTS. Instead of cloning an existing voice or picking from a preset list, you describe the voice you want in natural language and the model synthesizes it.

**Use this workflow when:**
- You need a specific voice character that does not exist in preset libraries
- You want to prototype voices for a project before recording with a real actor
- You need a voice with a particular accent, age, pace, or emotional quality
- You want to iterate on voice characteristics without reference audio

**This workflow does NOT cover:**
- Cloning an existing voice from audio (see `CloneVoice.md`)
- Using preset voices from ElevenLabs or MiniMax (see `Narrate.md`)
- Comparing multiple models (see `CompareModels.md`)

---

## Workflow Steps

### Step 1: Describe the Desired Voice

The user provides a natural language description of the voice they want. Good descriptions include:

- **Gender and age:** "young female", "elderly male", "middle-aged"
- **Tone and warmth:** "warm", "authoritative", "playful", "calm"
- **Pace:** "slow and deliberate", "fast and energetic", "moderate"
- **Accent or origin:** "Brazilian accent", "British English", "neutral American"
- **Character:** "wise narrator", "friendly assistant", "news anchor"

### Step 2: Construct the Instruct Flag

Build the `--instruct` value from the user's description. The instruct string should be a concise, comma-separated set of voice attributes.

```bash
# The --instruct flag accepts natural language voice descriptions
# Keep it concise but specific — each attribute shapes the output

# Example instruct strings:
"deep male voice, warm, slow pace"
"young female, energetic, Brazilian accent"
"elderly narrator, wise and calm, measured pace"
"authoritative news anchor, clear enunciation, neutral American accent"
"soft-spoken female, gentle, slightly breathy, slow"
"confident male presenter, mid-range pitch, moderate pace, friendly"
```

### Step 3: Generate a Test Sample

Run a short test with a representative sentence to hear the voice before committing to longer content.

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "This is a test of the voice design. How does this sound to you?" \
  --instruct "deep male voice, warm, slow pace" \
  --output ~/Downloads/voice-test.wav
```

Open and listen:

```bash
open ~/Downloads/voice-test.wav
```

### Step 4: Iterate on the Description

If the voice is not quite right, refine the instruct string:

```bash
# Too fast? Add pace control
--instruct "deep male voice, warm, slow pace, deliberate"

# Too monotone? Add emotional quality
--instruct "deep male voice, warm, slow pace, expressive, gentle enthusiasm"

# Wrong character? Adjust personality
--instruct "deep male voice, gravelly, storyteller quality, slow pace"
```

Regenerate the test sample with each iteration:

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "This is a test of the refined voice. Notice the changes." \
  --instruct "deep male voice, gravelly, storyteller quality, slow pace" \
  --output ~/Downloads/voice-test-v2.wav
```

### Step 5: Generate Final Audio with the Refined Voice

Once satisfied with the voice, use the finalized instruct string for the full content:

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "Your full content goes here..." \
  --instruct "deep male voice, gravelly, storyteller quality, slow pace" \
  --output ~/Downloads/voice-final.wav
```

---

## Intent-to-Flag Mapping

| User Says | Model | Flags | Rationale |
|-----------|-------|-------|-----------|
| "design a voice", "create a voice" | `replicate-qwen` | `--instruct "[description]"` | Only model supporting voice design from text |
| "I want a voice that sounds like..." | `replicate-qwen` | `--instruct "[description]"` | Translate description to instruct string |
| "make a narrator voice" | `replicate-qwen` | `--instruct "narrator, [attributes]"` | Character-based voice design |
| "voice for my app" | `replicate-qwen` | `--instruct "[app-appropriate attrs]"` | Tailor to use case |
| "test this voice" | `replicate-qwen` | `--instruct` + short `--text` | Quick iteration sample |
| "refine the voice" | `replicate-qwen` | Updated `--instruct` | Iterate on previous description |

**Note:** `replicate-qwen` is the ONLY model that supports voice design from text descriptions via `--instruct`. All voice design requests route here exclusively.

---

## Instruct String Best Practices

### Effective Descriptions

| Attribute Category | Good Examples | Avoid |
|--------------------|---------------|-------|
| **Gender/Age** | "young female", "elderly male", "middle-aged woman" | "sounds like Morgan Freeman" (use CloneVoice instead) |
| **Tone** | "warm", "authoritative", "playful", "serious" | "normal" (too vague) |
| **Pace** | "slow and deliberate", "fast-paced", "moderate" | "default speed" (not descriptive) |
| **Accent** | "Brazilian accent", "British English", "neutral American" | "foreign accent" (too vague) |
| **Character** | "news anchor", "storyteller", "friendly assistant" | "good voice" (not actionable) |

### Instruct String Length

- **Minimum:** 3-4 attributes ("deep male, warm, slow")
- **Optimal:** 5-7 attributes ("deep male voice, warm, slow pace, storyteller quality, slight rasp")
- **Maximum:** Keep under 20 words — too long and attributes may conflict

---

## Examples

### Example 1: Podcast Narrator Voice

```
User: "I need a warm, deep male voice for narrating a tech podcast"

Instruct: "deep male voice, warm and engaging, moderate pace, 
          tech-savvy tone, clear enunciation, friendly authority"

bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "Welcome to the show. Today we are exploring..." \
  --instruct "deep male voice, warm and engaging, moderate pace, tech-savvy tone, clear enunciation, friendly authority" \
  --output ~/Downloads/podcast-narrator-test.wav
```

### Example 2: Brazilian Portuguese Assistant

```
User: "Design a young female voice with a Brazilian accent for our app"

Instruct: "young female, energetic, Brazilian accent, friendly, 
          clear pronunciation, moderate pace"

bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "Ola! Bem-vindo ao nosso aplicativo." \
  --instruct "young female, energetic, Brazilian accent, friendly, clear pronunciation, moderate pace" \
  --output ~/Downloads/brazilian-assistant-test.wav
```

### Example 3: Audiobook Elder Narrator

```
User: "I want an old wise narrator voice, like someone telling a fairy tale"

Instruct: "elderly narrator, wise and calm, measured pace, 
          gentle warmth, storytelling cadence, slight gravitas"

bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-qwen \
  --text "Once upon a time, in a land far beyond the mountains..." \
  --instruct "elderly narrator, wise and calm, measured pace, gentle warmth, storytelling cadence, slight gravitas" \
  --output ~/Downloads/elder-narrator-test.wav
```