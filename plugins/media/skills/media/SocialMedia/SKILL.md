---
name: SocialMedia
description: Social media image and audio content with platform-specific formats for Facebook, Instagram, X, TikTok, and LinkedIn. Full content kits with images + audio clips. USE WHEN social media image, generate post image, Instagram post, Facebook cover, X header, TikTok thumbnail, LinkedIn banner, social media dimensions, social media sizes, what size for Instagram, create social content, social media formats, social kit, content kit, reels audio.
role: executor
accepts:
  - text
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# SocialMedia

Generate platform-correct images for social media using the Art skill's generation infrastructure. Knows every image format for Facebook, Instagram, X/Twitter, TikTok, and LinkedIn.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/SocialMedia/`

If this directory exists, load and apply:
- `PREFERENCES.md` - Brand colors, default platforms, preferred formats

These define user-specific preferences. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **GeneratePost** | "create image for Instagram", "generate a Facebook cover", "make a LinkedIn post image" | `Workflows/GeneratePost.md` |
| **FormatGuide** | "what size for TikTok", "show me Instagram formats", "social media dimensions" | `Workflows/FormatGuide.md` |
| **SocialKit** | "create content kit", "images + audio for all platforms", "reels audio" | `Workflows/SocialKit.md` |

## Platform Format References

| Platform | File |
|----------|------|
| Facebook | `FacebookFormats.md` |
| Instagram | `InstagramFormats.md` |
| X / Twitter | `XFormats.md` |
| TikTok | `TikTokFormats.md` |
| LinkedIn | `LinkedInFormats.md` |

## Quick Reference — Most Common Formats

| Use Case | Platform | Dimensions | Aspect Ratio |
|----------|----------|------------|--------------|
| Feed post | Instagram | 1080x1350 | 4:5 |
| Feed post | Facebook | 1080x1350 | 4:5 |
| Feed post | LinkedIn | 1080x1350 | 4:5 |
| Feed post | X | 1200x675 | 16:9 |
| Story / Reel | All | 1080x1920 | 9:16 |
| Profile picture | All | 400x400+ | 1:1 |
| Cover / Banner | Facebook | 851x315 | 2.7:1 |
| Header | X | 1500x500 | 3:1 |
| Banner | LinkedIn | 1584x396 | 4:1 |
| Video cover | TikTok | 1080x1920 | 9:16 |
| OG / Link preview | All | 1200x630 | 1.91:1 |
| Carousel card | Instagram | 1080x1080 | 1:1 |
| Carousel card | LinkedIn | 1080x1080 | 1:1 |

## Model Aspect Ratio Mapping

The Art Generate.ts supports specific aspect ratios. This table maps platform needs to the closest model-supported ratio:

| Platform Need | Closest Model Ratio | Model Flag | Post-Resize Needed |
|---------------|---------------------|------------|---------------------|
| 1:1 | 1:1 | `--aspect-ratio 1:1` | No |
| 4:5 | 4:5 | `--aspect-ratio 4:5` | No |
| 16:9 | 16:9 | `--aspect-ratio 16:9` | No |
| 9:16 | 9:16 | `--aspect-ratio 9:16` | No |
| 3:2 | 3:2 | `--aspect-ratio 3:2` | No |
| 2:3 | 2:3 | `--aspect-ratio 2:3` | No |
| 3:4 | 3:4 | `--aspect-ratio 3:4` | No |
| 4:3 | 4:3 | `--aspect-ratio 4:3` | No |
| 1.91:1 | 16:9 | `--aspect-ratio 16:9` | Crop to 1200x628 |
| 3:1 (X header) | 21:9 | `--aspect-ratio 21:9` | Crop to 1500x500 |
| 2.7:1 (FB cover) | 21:9 | `--aspect-ratio 21:9` | Crop to 851x315 |
| 4:1 (LI banner) | 21:9 | `--aspect-ratio 21:9` | Crop to 1584x396 |
| 5.9:1 (LI company) | 21:9 | `--aspect-ratio 21:9` | Crop to 1128x191 |

For non-standard ratios, generate at the closest wider ratio then crop/resize using `sips` or ImageMagick.

## Examples

**Example 1: Generate an Instagram feed post**
```
User: "Create an Instagram post image about AI productivity"
-> Invokes GeneratePost workflow
-> Reads InstagramFormats.md for feed post specs (1080x1350, 4:5)
-> Generates via Art Generate.ts with --aspect-ratio 4:5
-> Outputs to ~/Downloads/ for preview
```

**Example 2: Create a LinkedIn banner**
```
User: "Make me a new LinkedIn banner"
-> Invokes GeneratePost workflow
-> Reads LinkedInFormats.md for banner specs (1584x396, 4:1)
-> Generates at 21:9 then crops to exact dimensions
-> Outputs to ~/Downloads/ for preview
```

**Example 3: Check TikTok ad specs**
```
User: "What size should a TikTok in-feed ad be?"
-> Invokes FormatGuide workflow
-> Reads TikTokFormats.md
-> Displays: 1080x1920 (9:16), safe zone details
```
