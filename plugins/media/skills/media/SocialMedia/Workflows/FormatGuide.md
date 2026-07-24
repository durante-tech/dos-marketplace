---
name: Format Guide
description: 
status: STABLE
---

# FormatGuide Workflow

**Display image format specifications for social media platforms.**

## Step 1: Identify What the User Wants

Determine from the request:

1. **Which platform(s)?** Facebook, Instagram, X/Twitter, TikTok, LinkedIn, or "all"
2. **Which format category?** (all, feed posts, stories, ads, covers, commerce, etc.)
3. **Specific format?** (e.g., "Instagram carousel ad specs")

---

## Step 2: Load Platform Reference

Read the appropriate format reference file(s):

| Platform | File |
|----------|------|
| Facebook | `~/.claude/skills/media/SocialMedia/FacebookFormats.md` |
| Instagram | `~/.claude/skills/media/SocialMedia/InstagramFormats.md` |
| X/Twitter | `~/.claude/skills/media/SocialMedia/XFormats.md` |
| TikTok | `~/.claude/skills/media/SocialMedia/TikTokFormats.md` |
| LinkedIn | `~/.claude/skills/media/SocialMedia/LinkedInFormats.md` |

---

## Step 3: Present Information

### If specific format requested:
Show only the relevant row(s) with all details (recommended px, min px, aspect ratio, max size, safe zones, notes).

### If category requested (e.g., "all feed post sizes"):
Show a comparison table across platforms for that category:

```markdown
## Feed Post Sizes Across Platforms

| Platform | Recommended | Aspect Ratio | Notes |
|----------|-------------|--------------|-------|
| Instagram | 1080x1350 | 4:5 | Best engagement. Grid crops to 3:4. |
| Facebook | 1080x1350 | 4:5 | Max vertical ratio in feed. |
| X/Twitter | 1200x675 | 16:9 | Fills feed width without cropping. |
| LinkedIn | 1080x1350 | 4:5 | Max feed real estate on mobile. |
| TikTok | 1080x1920 | 9:16 | Only format that fills screen. |
```

### If "all formats" for a platform:
Show the full reference from the platform file, organized by category.

### If cross-platform comparison:
Show a consolidated view highlighting differences.

---

## Step 4: Include Strategic Notes

Always include the **Strategic Notes** section from the platform reference file(s). These contain key insights about:
- Which formats perform best for engagement
- Recent platform changes affecting dimensions
- Safe zone warnings
- Cropping behavior differences between mobile/desktop

---

## Quick Cross-Platform Reference

For fast lookups without reading full files, use this consolidated table:

### Universal Formats (work across all platforms)

| Use Case | Dimensions | Aspect Ratio | Works On |
|----------|------------|--------------|----------|
| OG / Link Preview | 1200x630 | 1.91:1 | All platforms + Slack, Discord |
| Story / Reel | 1080x1920 | 9:16 | IG, FB, TikTok |
| Square Post | 1080x1080 | 1:1 | All platforms |
| Portrait Post | 1080x1350 | 4:5 | IG, FB, LinkedIn, X |

### Platform-Specific Formats

| Format | Dimensions | Ratio | Platform Only |
|--------|------------|-------|---------------|
| X Header | 1500x500 | 3:1 | X/Twitter |
| FB Personal Cover | 851x315 | 2.7:1 | Facebook |
| LI Personal Banner | 1584x396 | 4:1 | LinkedIn |
| LI Company Cover | 1128x191 | ~5.9:1 | LinkedIn |
| LI Event Cover | 1776x444 | 4:1 | LinkedIn |
| FB Event Cover | 1920x1005 | 1.91:1 | Facebook |
| FB Group Cover | 1640x856 | 1.91:1 | Facebook |
| LI Group Cover | 1536x768 | 2:1 | LinkedIn |
| TikTok Shop Product | 800x800 | 1:1 | TikTok |