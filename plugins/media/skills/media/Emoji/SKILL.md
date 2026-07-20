---
name: Emoji
description: Generate custom emoji-style images using SDXL Emoji model — create unique emoji icons from text descriptions. USE WHEN generate emoji, create emoji, emoji style, custom emoji, emoji icon, make emoji, emoji art, emoji design.
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
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Emoji/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Emoji Skill

Generate custom emoji-style images from text prompts using SDXL Emoji via Replicate.

## Available Models

| Model | Provider | Best For |
|-------|----------|----------|
| `fofr/sdxl-emoji` | SDXL Emoji (Replicate) | Generating emoji-style images from text prompts |

## Intent-to-Flag Mapping

| User Says | Flags |
|-----------|-------|
| "make me a cat emoji" | `--prompt "a happy cat"` |
| "create a custom emoji" | `--prompt "<description>"` |
| "emoji of a rocket" | `--prompt "a rocket ship"` |
| "generate 4 emoji variants" | `--prompt "<description>" --num-outputs 4` |
| "small emoji icon" | `--prompt "<description>" --width 512 --height 512` |
| "emoji without text" | `--prompt "<description>" --negative-prompt "text, letters, words"` |

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Generate emoji, create emoji, custom emoji | `Workflows/CreateEmoji.md` |

## Usage

```bash
# Generate a cat emoji
bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
  --prompt "a happy cat"

# Generate multiple variants
bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
  --prompt "a fire-breathing dragon" \
  --num-outputs 4 \
  --output ~/Downloads/dragon-emoji.png

# Custom size with negative prompt
bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
  --prompt "a smiling sun" \
  --width 512 --height 512 \
  --negative-prompt "text, letters, words" \
  --output ~/Downloads/sun-emoji.png
```

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Examples

**Example 1: Simple emoji generation**
```
User: "make me a pizza emoji"
-> Auto-prepends "An emoji of " to prompt
-> Generates 1024x1024 emoji-style pizza image
-> Outputs to ~/Downloads/emoji.png
```

**Example 2: Multiple variants for selection**
```
User: "generate 4 different robot emojis"
-> Uses --num-outputs 4 for variants
-> Saves first result to output path
```

**Example 3: Brand icon in emoji style**
```
User: "create an emoji-style icon of a shield with a lightning bolt"
-> Generates emoji-style brand icon
-> Clean, bold emoji aesthetic
```
