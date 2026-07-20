---
name: Social Brand
description: Developer social presence system — GitHub, Twitter, Discord, OG images
status: BETA
---

# Social Brand System

Generate brand-consistent social presence assets for developer platforms. Templates, avatars, OG images, and platform-specific styling.

## When to Use

- Setting up branded presence on GitHub, Twitter/X, Discord, Dev.to
- Creating OG image templates for blog posts and pages
- Generating social media avatar and banner variations
- Establishing README badge and screenshot styling

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Gather Brand Assets

Read from brand outputs:
- Logo system (primary, icon-only, wordmark)
- Color system (primary, secondary, neutral)
- Typography (heading font, body font)
- Brand personality (for tone of social bio/descriptions)

### Step 2: Generate Platform Assets

For each platform:

**GitHub:**
- Organization avatar (logo on brand background)
- Social preview image (1280x640)
- README header banner
- Badge styling (colors matching brand)
- `.github/FUNDING.yml` and social links

**Twitter/X:**
- Profile picture (400x400)
- Header banner (1500x500)
- Bio copy (aligned with brand voice)

**Discord:**
- Server icon (512x512)
- Server banner (960x540)
- Role colors (mapped from brand palette)
- Bot avatar (if applicable)

**LinkedIn:**
- Company logo (300x300)
- Cover image (1128x191)
- Company description (brand voice)

**OG Images:**
- Default OG template (1200x630)
- Blog post OG template (title + brand frame)
- Documentation OG template
- Dark mode variants

### Step 3: Generate Code Snippet Styling

For developer brands, define:
- Syntax highlighting theme (matching brand colors)
- Terminal screenshot styling (font, colors, prompt)
- Code block backgrounds and borders
- Carbon/ray.so configuration preset

### Step 4: Produce Social Brand Kit

Output directory with:
- All generated assets organized by platform
- Template files (Figma/Canva export if applicable)
- Platform-specific guidelines (sizing, safe zones)
- Social bio copy in brand voice
