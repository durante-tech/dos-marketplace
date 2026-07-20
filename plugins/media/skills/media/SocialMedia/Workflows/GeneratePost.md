---
name: Generate Post
description: 
status: STABLE
---

# GeneratePost Workflow

**Generate platform-correct social media images using the Art skill's infrastructure.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the GeneratePost workflow in the social-media skill to create a platform-specific image"
```

Running **GeneratePost** in **SocialMedia**...

---

## Step 1: Identify Platform & Format

Determine from the user's request:

1. **Which platform?** Facebook, Instagram, X/Twitter, TikTok, or LinkedIn
2. **Which format type?** (feed post, story, cover, ad, product, etc.)
3. **What content?** (the subject/theme of the image)

If the user doesn't specify a format type, use the **recommended default** for the platform:

| Platform | Default Format | Dimensions | Aspect Ratio |
|----------|---------------|------------|--------------|
| Instagram | Feed Portrait | 1080x1350 | 4:5 |
| Facebook | Feed Portrait | 1080x1350 | 4:5 |
| X/Twitter | Single Post | 1200x675 | 16:9 |
| TikTok | Video Cover | 1080x1920 | 9:16 |
| LinkedIn | Feed Portrait | 1080x1350 | 4:5 |

If the user specifies a format type, read the platform's format reference file to get exact specs:

| Platform | Reference File |
|----------|---------------|
| Facebook | `~/.claude/skills/media/SocialMedia/FacebookFormats.md` |
| Instagram | `~/.claude/skills/media/SocialMedia/InstagramFormats.md` |
| X/Twitter | `~/.claude/skills/media/SocialMedia/XFormats.md` |
| TikTok | `~/.claude/skills/media/SocialMedia/TikTokFormats.md` |
| LinkedIn | `~/.claude/skills/media/SocialMedia/LinkedInFormats.md` |

---

## Step 2: Map to Generation Parameters

Use the SKILL.md **Model Aspect Ratio Mapping** table to determine the correct `--aspect-ratio` flag and whether post-generation resize is needed.

### Direct Model Support (no resize needed)

| Target Ratio | Generate.ts Flag |
|-------------|-----------------|
| 1:1 | `--aspect-ratio 1:1` |
| 4:5 | `--aspect-ratio 4:5` |
| 5:4 | `--aspect-ratio 5:4` |
| 16:9 | `--aspect-ratio 16:9` |
| 9:16 | `--aspect-ratio 9:16` |
| 3:2 | `--aspect-ratio 3:2` |
| 2:3 | `--aspect-ratio 2:3` |
| 3:4 | `--aspect-ratio 3:4` |
| 4:3 | `--aspect-ratio 4:3` |
| 21:9 | `--aspect-ratio 21:9` |

### Requires Post-Generation Resize

| Target | Generate At | Then Resize To | Use Case |
|--------|-----------|---------------|----------|
| 1.91:1 (1200x628) | 16:9 | Crop to 1200x628 | OG images, link previews, FB landscape |
| 3:1 (1500x500) | 21:9 | Crop to 1500x500 | X header/banner |
| 2.7:1 (851x315) | 21:9 | Crop to 851x315 | Facebook cover |
| 4:1 (1584x396) | 21:9 | Crop to 1584x396 | LinkedIn personal banner |
| ~5.9:1 (1128x191) | 21:9 | Crop to 1128x191 | LinkedIn company cover |
| 2:1 (1536x768) | 16:9 | Crop to 1536x768 | LinkedIn group cover |

---

## Step 3: Build the Prompt

Construct a generation prompt that:

1. **Describes the visual content** based on what the user wants
2. **Accounts for safe zones** — if the format has UI overlays (Stories, Reels, TikTok), keep critical content in the safe area
3. **Follows Art skill aesthetic** — load user customizations from `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md` if they exist

### Safe Zone Reminders in Prompt

For **Stories/Reels (9:16)** formats, add to prompt:
```
SAFE ZONE: Keep all critical content (text, faces, key elements) within the center 950x1420 area. 
Top 250px and bottom 250-670px will be covered by platform UI elements.
```

For **TikTok (9:16)** formats, add to prompt:
```
SAFE ZONE: Keep critical content within center 960x1386 area.
Right 164px has engagement icons. Bottom 324px has captions.
```

---

## Step 4: Generate the Image

```bash
bun Tools/dos-image.ts "[CONSTRUCTED PROMPT]" \
  --intent=diagram \
  --output=~/Downloads/[platform]-[format]-[descriptive-name].png \
  --size=1024x1024 \
  --telemetry-tag=Media/SocialMedia/GeneratePost
```

### If Post-Resize is Needed

After generation, resize to exact platform dimensions:

```bash
# Using sips (macOS built-in)
sips --resampleWidth [TARGET_WIDTH] --resampleHeight [TARGET_HEIGHT] \
  ~/Downloads/[filename].png --out ~/Downloads/[filename]-resized.png

# Or center-crop from larger image
sips --cropToHeightWidth [TARGET_HEIGHT] [TARGET_WIDTH] \
  ~/Downloads/[filename].png --out ~/Downloads/[filename]-cropped.png
```

---

## Step 5: Open for Review

```bash
open ~/Downloads/[filename].png
```

Report to the user:
- Platform and format generated for
- Exact dimensions of the output
- Any safe zone considerations
- Whether resize/crop was applied

---

## Multi-Platform Generation

If the user asks for images across multiple platforms, generate each sequentially with platform-appropriate dimensions. Name files clearly:

```
~/Downloads/instagram-feed-portrait-ai-productivity.png
~/Downloads/x-post-landscape-ai-productivity.png  
~/Downloads/linkedin-feed-square-ai-productivity.png
```