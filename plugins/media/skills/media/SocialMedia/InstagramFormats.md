# Instagram Image Formats (2025-2026)

Complete reference for all Instagram image types, dimensions, and specifications.

## Important: 3:4 Profile Grid (2025 Update)

Instagram shifted from 1:1 square to **3:4 profile grid previews** in late 2025. All content is now center-cropped to 3:4 on your profile grid. Designing at 1080x1440 (3:4) gives zero-crop grid thumbnails.

## Profile

| Format | Recommended px | Min px | Aspect Ratio | Notes |
|--------|---------------|--------|--------------|-------|
| Profile Picture | 320x320 | 110x110 | 1:1 (circular crop) | Stored at 320x320. Center subject. |

## Feed Posts

| Format | Recommended px | Min px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------|--------------|----------|-------|
| Square | 1080x1080 | 600x600 | 1:1 | 30MB | On 3:4 grid, gets letterboxed with padding |
| Portrait (recommended) | 1080x1350 | 600x750 | 4:5 | 30MB | Max feed real estate. Slight grid crop. |
| Tall Portrait (grid-optimized) | 1080x1440 | 600x800 | 3:4 | 30MB | NEW: Matches grid exactly, zero cropping |
| Landscape | 1080x566 | 600x315 | 1.91:1 | 30MB | Least recommended. Minimal feed space. |

## Carousel / Album Posts

| Format | Recommended px | Min px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------|--------------|----------|-------|
| Per slide | 1080x1350 (4:5) or 1080x1080 (1:1) | 600x600 | Set by first slide | 30MB/slide | Up to 20 slides. All must match ratio. |

## Stories

| Format | Recommended px | Min px | Aspect Ratio | Max Size | Safe Zone |
|--------|---------------|--------|--------------|----------|-----------|
| Story | 1080x1920 | 600x1067 | 9:16 | 30MB | Top 250px + bottom 250px = UI. Effective: 950x1420 |

## Reels

| Format | Recommended px | Min px | Aspect Ratio | Max Size | Safe Zone |
|--------|---------------|--------|--------------|----------|-----------|
| Reel | 1080x1920 | 600x1067 | 9:16 | 4GB | Bottom 670px (35%) = captions/buttons. Right 120px = icons |
| Reel Cover | 1080x1920 | 600x1067 | 9:16 (crops to 3:4 on grid) | 30MB | Center 1080x1440 visible on grid |

## Other Organic

| Format | Recommended px | Aspect Ratio | Notes |
|--------|---------------|--------------|-------|
| Highlight Cover | 1080x1920 | 9:16 (displayed as circle) | Center icon in middle 500x500 |
| IGTV Cover (legacy) | 420x654 | ~2:3 | Deprecated. Use Reel Cover instead. |
| Guide Cover | 1080x1350 | 4:5 | Pulled from first post in guide. Feature being deprecated. |
| Collaborative Post | 1080x1350 | 4:5 or 1:1 | Same specs as regular feed posts |

## Shop / Commerce

| Format | Recommended px | Min px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------|--------------|----------|-------|
| Product Image | 1024x1024 | 500x500 | 1:1 (required) | 8MB | White background. No text overlays. 85%+ product fill. |

## Ad Formats

| Format | Recommended px | Aspect Ratio | Max Size | Notes |
|--------|---------------|--------------|----------|-------|
| Feed Image Ad | 1080x1350 (4:5) or 1080x1080 (1:1) | 4:5 or 1:1 | 30MB | 4:5 = max feed space |
| Stories Ad | 1080x1920 | 9:16 | 30MB | Top 270px + bottom 380px = UI overlays |
| Reels Ad | 1080x1920 | 9:16 | 30MB | Bottom 35% occluded |
| Explore Ad | 1080x1080 or 1080x1920 | 1:1 or 9:16 | 30MB | Grid tile is square-cropped |
| Carousel Ad (per card) | 1080x1080 | 1:1 (required) | 30MB/card | Up to 10 cards. Ad carousels = 1:1 only. |
| Collection Ad | 1080x1080 | 1:1 | 30MB | Cover + 4 product thumbnails |
| Shopping Ad | 1080x1350 | 4:5 | 30MB | Product tags overlaid |

## Link Previews (controlled via website OG tags)

| Format | Recommended px | Aspect Ratio | Notes |
|--------|---------------|--------------|-------|
| Link Sticker Preview | 1200x630 (og:image) | 1.91:1 | Auto-pulled from URL meta tags |
| Bio Link Preview | 1200x630 (og:image) | 1.91:1 | Set via website Open Graph tags |

## Strategic Notes

- **3:4 grid shift** is the biggest dimensional change since Instagram launched — design with it in mind
- **4:5 (1080x1350)** remains the best engagement format for feed posts
- Safe zones matter more than dimensions for Reels (35% bottom occluded)
- JPG at 85-95% for photos, PNG for graphics with text — Instagram recompresses aggressively regardless

*Last updated: 2026-04-09*
