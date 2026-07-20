---
name: Music
description: Generate music and songs using multiple AI models — ElevenLabs Music, MiniMax Music 1.5, and ACE-Step. USE WHEN music generation, generate music, compose music, create song, AI music, soundtrack, jingle, background music, instrumental.
role: generator
accepts:
  - text
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# Music Skill

Generate music using a unified CLI with 3 providers.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Music/`

## Available Models

| Model | Provider | Strengths | Output |
|-------|----------|-----------|--------|
| `elevenlabs` | ElevenLabs Music | High quality, instrumental toggle, multiple output formats | MP3 |
| `minimax` | MiniMax Music 1.5 | Lyrics with structure tags, high quality audio | MP3 |
| `ace-step` | ACE-Step (Replicate) | Open source, genre/mood tags, variable duration, optional lyrics | MP3 |

## Model Selection Guide

| Use Case | Recommended Model |
|----------|------------------|
| Quick instrumental jingle | `elevenlabs` with `--instrumental` |
| Background music / soundtrack | `elevenlabs` |
| Full song with lyrics | `minimax` (lyrics required) |
| Genre-specific generation | `ace-step` with comma-separated tags |
| Long-form music (2-4 min) | `ace-step` with `--duration` |
| Reproducible output | `ace-step` with `--seed` |
| High quality output format | `elevenlabs` with `--output-format wav_cd_quality` |

## Intent-to-Flag Mapping

| User Says | Flags | Model |
|-----------|-------|-------|
| "generate music", "make a track" | `--model elevenlabs --prompt "<description>"` | Default |
| "instrumental", "no vocals" | `--model elevenlabs --instrumental` | Instrumental |
| "jingle", "short music" | `--model elevenlabs --duration 15` | Short clip |
| "song with lyrics", "write a song" | `--model minimax --lyrics "<structured>"` | Full song |
| "lo-fi", "chill beats" | `--model ace-step --prompt "lo-fi,chill,hip-hop"` | Genre tags |
| "soundtrack", "cinematic" | `--model elevenlabs --prompt "cinematic orchestral"` | Soundtrack |
| "background music" | `--model elevenlabs --prompt "<mood description>"` | Ambient |
| "long track", "full length" | `--model ace-step --duration 240` | Extended |

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Generate music, compose a track, create a song | `Workflows/GenerateMusic.md` |
| Any music generation request | `Workflows/GenerateMusic.md` |

## Usage

```bash
# ElevenLabs — instrumental jingle
bun run ~/.claude/skills/media/Music/Tools/Compose.ts \
  --model elevenlabs --prompt "upbeat electronic jingle, 120 BPM" \
  --instrumental --duration 30

# MiniMax — full song with lyrics
bun run ~/.claude/skills/media/Music/Tools/Compose.ts \
  --model minimax --prompt "indie folk ballad, acoustic guitar" \
  --lyrics "[verse]Walking down the road[chorus]Take me home tonight"

# ACE-Step — genre tags
bun run ~/.claude/skills/media/Music/Tools/Compose.ts \
  --model ace-step --prompt "pop,female vocal,upbeat,synth" \
  --duration 120 --seed 42
```

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Examples

**Example 1: Quick background music**
```
User: "generate some chill background music"
-> Uses Compose.ts with --model elevenlabs --prompt "chill ambient background music, soft piano"
-> Outputs MP3 to ~/Downloads/generated-music.mp3
```

**Example 2: Song with lyrics**
```
User: "compose a pop song with these lyrics: verse about summer, chorus about dancing"
-> Uses Compose.ts with --model minimax --prompt "upbeat pop song"
  --lyrics "[verse]Summer days are here again[chorus]We dance all night long"
-> Outputs MP3 to ~/Downloads/generated-music.mp3
```

**Example 3: Genre-specific instrumental**
```
User: "make a 2-minute lo-fi hip hop beat"
-> Uses Compose.ts with --model ace-step --prompt "lo-fi,chill,hip-hop,instrumental,beats"
  --duration 120
-> Outputs MP3 to ~/Downloads/generated-music.mp3
```
