---
name: Generate Music
description: 
status: STABLE
---

# Generate Music Workflow

**Generate music tracks, songs, jingles, and soundtracks using AI models.**

## Purpose

Generate music from text descriptions, genre tags, and optional lyrics. Supports:
- Instrumental background music and jingles
- Full songs with structured lyrics
- Genre-specific generation via mood/style tags
- Multiple output formats (MP3, WAV)

**Use this workflow when:**
- Creating background music for videos or presentations
- Composing a song with lyrics
- Generating a jingle or intro theme
- Producing a soundtrack or ambient track
- Experimenting with AI music in specific genres

**This workflow does NOT cover:**
- Speech generation (see `Speech/Workflows/Narrate.md`)
- Sound effects or audio editing
- Voice cloning or TTS

---

## Workflow Steps

### Step 1: Determine Music Requirements

Gather from the user:
- **Description / mood**: What should the music sound like?
- **Lyrics**: Does the user want vocals with lyrics?
- **Duration**: How long should the track be?
- **Format**: Any specific output format needed?

### Step 2: Select Model Based on Requirements

#### Intent-to-Flag Mapping

| User Says | Model | Flags | Rationale |
|-----------|-------|-------|-----------|
| "instrumental", "no vocals" | `elevenlabs` | `--instrumental` | Best instrumental quality |
| "jingle", "short clip" | `elevenlabs` | `--duration 15` | Quick, high quality |
| "song with lyrics" | `minimax` | `--lyrics "<structured>"` | Requires lyrics input |
| "lo-fi", "hip-hop", genre tags | `ace-step` | `--prompt "tag1,tag2"` | Genre-tag based |
| "long track", "full length" | `ace-step` | `--duration 240` | Supports long durations |
| "soundtrack", "cinematic" | `elevenlabs` | `--prompt "cinematic..."` | High quality orchestral |
| "WAV quality" | `elevenlabs` | `--output-format wav_cd_quality` | Lossless output |

### Step 3: Prepare Lyrics (if applicable)

For `minimax` (required) and `ace-step` (optional), structure lyrics with tags:

```
[intro]
(instrumental intro)

[verse]
Walking down the empty road
Searching for a place called home

[chorus]
Take me where the wild things grow
Let me feel the afterglow

[bridge]
Sometimes you just need to let go

[outro]
(fade out)
```

### Step 4: Generate Music

```bash
# ElevenLabs — instrumental
bun run ~/.claude/skills/media/Music/Tools/Compose.ts \
  --model elevenlabs \
  --prompt "upbeat electronic jingle, 120 BPM, energetic" \
  --instrumental --duration 30 \
  --output ~/Downloads/jingle.mp3

# MiniMax — song with lyrics
bun run ~/.claude/skills/media/Music/Tools/Compose.ts \
  --model minimax \
  --prompt "indie folk ballad, acoustic guitar, warm tone" \
  --lyrics "[verse]Walking down the road again[chorus]Take me home tonight" \
  --output ~/Downloads/folk-song.mp3

# ACE-Step — genre tags with optional lyrics
bun run ~/.claude/skills/media/Music/Tools/Compose.ts \
  --model ace-step \
  --prompt "pop,female vocal,upbeat,synth,dance" \
  --lyrics "[verse]Stars above the city lights[chorus]We dance until the dawn" \
  --duration 120 \
  --output ~/Downloads/pop-track.mp3

# ACE-Step — instrumental, reproducible
bun run ~/.claude/skills/media/Music/Tools/Compose.ts \
  --model ace-step \
  --prompt "lo-fi,chill,hip-hop,instrumental,piano" \
  --seed 42 \
  --output ~/Downloads/lofi-beat.mp3
```

### Step 5: Verify Output

```bash
ls -lh ~/Downloads/generated-music.mp3
open ~/Downloads/generated-music.mp3
```

Check that:
- File was created and has reasonable size
- Audio plays correctly
- Duration matches expectations

---

## Examples

### Example 1: Quick Jingle

```
User: "make a 15-second upbeat jingle for a tech product"

Action:
1. Select elevenlabs (best for short, high-quality instrumental)
2. Generate with --instrumental --duration 15
3. Output: ~/Downloads/generated-music.mp3
```

### Example 2: Full Song with Lyrics

```
User: "compose a pop song about summer nights with verse-chorus structure"

Action:
1. Structure lyrics: [verse] about summer nights, [chorus] catchy hook
2. Select minimax (requires structured lyrics)
3. Generate with --lyrics and --prompt describing the style
4. Output: ~/Downloads/generated-music.mp3
```

### Example 3: Lo-fi Background Beat

```
User: "generate a 2-minute lo-fi chill beat for studying"

Action:
1. Select ace-step (genre tags, long duration support)
2. Generate with --prompt "lo-fi,chill,study,piano,beats" --duration 120
3. Output: ~/Downloads/generated-music.mp3
```

---

## Integration with Other Workflows

This workflow integrates with:
- **Video/TextToVideo**: Generate soundtrack, then create music video
- **Speech/Narrate**: Combine narration with background music
- **SocialMedia/SocialKit**: Create audio for social media content