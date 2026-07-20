# X (Twitter) Image Formats (2025-2026)

Complete reference for all X/Twitter image types, dimensions, and specifications.

## Profile & Account

| Format | Recommended px | Min px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------|--------------|----------|-------|
| Profile Picture | 400x400 (upload 800x800) | 200x200 | 1:1 (circular crop) | 2MB | 800x800 for Retina. No animated GIFs. |
| Header/Banner | 1500x500 | 600x200 | 3:1 | 5MB | Safe zone: 1260x420 centered. Bottom-left = profile overlap. |

## In-Stream / Post Images

| Format | Recommended px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------------|----------|-------|
| Single Post (landscape) | 1200x675 | 16:9 | 5MB | Fills feed width without cropping |
| Single Post (portrait) | 1080x1350 | 4:5 | 5MB | More vertical real estate in feed |
| Multi-Image (2) | 700x800 each | 7:8 each | 5MB/img | Side-by-side, equal width |
| Multi-Image (3) | 700x800 + 400x700 | 7:8 + 4:7 | 5MB/img | First image large left, two stacked right |
| Multi-Image (4) | 1200x600 each | 2:1 each | 5MB/img | 2x2 grid |

Supported range: any ratio between 2:1 and 1:3. Formats: JPG, PNG, GIF, WEBP.

## Twitter Cards (Open Graph / Meta Tags)

| Format | Recommended px | Min px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------|--------------|----------|-------|
| Summary Card (Small) | 800x418 | 144x144 | 1.91:1 | 3MB | Small thumbnail left of text |
| Summary Card Large Image | 1200x628 | 300x157 | 1.91:1 | 3MB | Most commonly used card type |
| App Card | 800x418 or 800x800 | - | 1.91:1 or 1:1 | 3MB | App icon + install button |
| Player Card | 1200x675 | 262x262 | 16:9 | 3MB | Audio/video embed thumbnail |

## Ad Formats

| Format | Recommended px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------------|----------|-------|
| Standalone Image Ad | 1200x628 or 1200x1200 | 1.91:1 or 1:1 | 5MB | 1:1 = more mobile real estate |
| Image Ad + Website Button | 800x418 or 800x800 | 1.91:1 or 1:1 | 5MB | CTA button customizable |
| Image Ad + App Button | 800x418 or 800x800 | 1.91:1 or 1:1 | 5MB | App install/open button |
| Image Ad + Poll | 800x418 | 1.91:1 | 5MB | 1:1 gets center-cropped on mobile |
| Image Ad + Conversation | 800x418 | 1.91:1 | 5MB | Pre-populated tweet prompts |
| Carousel Ad (per card) | 800x418 or 800x800 | 1.91:1 or 1:1 | 5MB/card | 2-6 cards. All same ratio. |
| DM Card Ad | 640x360 or 360x360 | 16:9 or 1:1 | 3MB | Drives DM conversations |
| Timeline Takeover | 1200x628 or 1200x1200 | 1.91:1 or 1:1 | 5MB | First ad on app open |
| Trend Takeover | 1200x675 | 16:9 | 5MB | Explore tab. Supports 6s GIF. |
| Amplify Pre-Roll | 1200x675 | 16:9 | 5MB | Thumbnail before video |

## Platform Features

| Format | Recommended px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------------|----------|-------|
| Spaces Cover | 1500x500 | 3:1 | 5MB | Same as profile header |
| Community Banner | 1500x500 | 3:1 | 5MB | Same as profile header |
| List Banner | 1500x500 | 3:1 | 5MB | Same as profile header |
| DM Image (organic) | 1200x675 | Any (scales to fit) | 5MB | Standard post sizes work |

## Discontinued

| Format | Status | Historical Dimensions |
|--------|--------|----------------------|
| Fleets | Dead (July 2021) | 1080x1920 (9:16) |
| Moments Cover | Dead (Dec 2022) | 1200x675 (16:9) |

## Strategic Notes

- **Three dominant ratios:** 1.91:1 (cards/ads), 16:9 (organic posts), 3:1 (banners)
- **Portrait (4:5)** increases dwell time and engagement for organic posts
- X Premium subscribers get less compression — design for compressed version if audience skews non-premium
- Multi-image cropping differs between mobile and desktop — test both

*Last updated: 2026-04-09*
