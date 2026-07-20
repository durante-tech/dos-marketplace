---
name: Create Emoji
description: 
status: STABLE
---

# Create Emoji Workflow

**Generate custom emoji-style images from text descriptions using AI.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the CreateEmoji workflow in the Emoji skill to generate custom emojis"
```

Running **CreateEmoji** in **Emoji**...

---

## Purpose

Generate custom emoji-style images:
- Unique emoji icons for Slack, Discord, or messaging
- Brand-specific emoji for team communication
- Fun custom emojis from any description
- Emoji-style icons for apps or websites

---

## Workflow Steps

### Step 1: Describe the Emoji

Determine what the emoji should depict. The model works best with:
- Simple, recognizable subjects (animals, objects, expressions)
- Clear, descriptive language
- Single subjects rather than complex scenes

The prompt is auto-prefixed with "An emoji of " if it doesn't already start with emoji-related terms.

### Step 2: Optionally Specify Size and Variants

| Use Case | Size | Notes |
|----------|------|-------|
| Standard emoji | 1024x1024 (default) | High quality, can be downscaled |
| Small icon | 512x512 | Faster generation |
| Multiple options | Any + `--num-outputs 4` | Generate variants to pick from |

### Step 3: Run Emoji Generation

```bash
bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
  --prompt "a happy cat wearing sunglasses" \
  --output ~/Downloads/cat-emoji.png
```

#### Advanced: Multiple variants

```bash
bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
  --prompt "a rocket ship" \
  --num-outputs 4 \
  --output ~/Downloads/rocket-emoji.png
```

#### Advanced: Clean emoji without text artifacts

```bash
bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
  --prompt "a golden trophy" \
  --negative-prompt "text, letters, words, watermark" \
  --output ~/Downloads/trophy-emoji.png
```

### Step 4: Review Output

```bash
open ~/Downloads/cat-emoji.png
```

Check that:
- The emoji style is clean and recognizable
- No unwanted text or artifacts
- Subject matches the description

### Step 5: Iterate if Needed

If the result needs refinement:
- Add more specific descriptors to the prompt
- Use `--negative-prompt` to exclude unwanted elements
- Try a different `--seed` for variation
- Generate multiple outputs and pick the best

---

## Examples

**Example 1: Simple emoji**
```bash
bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
  --prompt "a slice of pizza with melted cheese"
```

**Example 2: Brand emoji set**
```bash
for item in "shield" "lightning bolt" "rocket" "star"; do
  bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
    --prompt "$item" \
    --negative-prompt "text, watermark" \
    --output ~/Downloads/emoji-${item// /-}.png
done
```

**Example 3: Reproducible generation**
```bash
bun run ~/.claude/skills/media/Emoji/Tools/GenerateEmoji.ts \
  --prompt "a smiling robot" \
  --seed 42 \
  --output ~/Downloads/robot-emoji.png
```

---

## Integration with Other Workflows

- **BackgroundRemoval/RemoveBackground**: Generate emoji, then remove background for transparency
- **Art/CreateDOSPackIcon**: Use emoji style as base for pack icons
- **SocialMedia/GeneratePost**: Create custom emojis for social media posts