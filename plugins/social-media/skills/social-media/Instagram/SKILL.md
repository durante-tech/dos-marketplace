---
name: Instagram
description: Publish media and fetch analytics from Instagram Business accounts via Graph API v24.0. Requires a Facebook Page with a linked Instagram Business account (authenticate via Facebook/Tools/Login.ts). USE WHEN publish to instagram, post to instagram, share photo on instagram, instagram feed post, instagram insights, instagram analytics, instagram comments, ig business, ig media publish.
role: executor
accepts:
  - text
roots:
  - PRINCIPAL
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/SocialMedia/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Instagram

Instagram Business account tooling — two-step media publishing and insights via Graph API v24.0.

## Prerequisites

- Completed `Facebook/Tools/Login.ts` once (Instagram tools reuse the Facebook Page token)
- The authenticated Facebook Page has a **linked Instagram Business account**
- `FACEBOOK_IG_USER_ID` is present in `~/.claude/.env`
- bun runtime

If Login.ts ran but your Page had no linked IG Business account, `FACEBOOK_IG_USER_ID` will be absent and Instagram tools will error clearly. Link the IG account to the Page in Facebook Business Suite, then re-run Login.ts.

## Tools

| Tool | Purpose | Command |
|---|---|---|
| `Publish.ts` | Publish photo, reel, story, or carousel via 2-step container flow | `bun Tools/Publish.ts --image-url https://... --caption "hello"` |
| `Comment.ts` | Reply to or delete an IG comment (destructive delete requires --yes) | `bun Tools/Comment.ts --action reply --comment-id 17841... --message "Thanks!"` |
| `Fetch.ts` | Retrieve media, insights, or comments | `bun Tools/Fetch.ts --type media` |

## Publishing Flow

Instagram Business publishing is a mandatory two-step process:

1. **Create container** — `POST /{ig-user-id}/media` with `image_url` and `caption` → returns a container ID
2. **Poll status** — `GET /{container-id}?fields=status_code` until `status_code` is `FINISHED` (Meta's media processing is async)
3. **Publish** — `POST /{ig-user-id}/media_publish` with `creation_id` → returns the published media ID

`Publish.ts` handles all three steps, polling at a configurable interval (default 2s) up to a configurable timeout (default 120s).

### ⚠️ Image URL must be public

Instagram Graph API **does not accept local files or private URLs**. The image at `--image-url` must be publicly reachable by Meta's servers. Host it on:

- Cloudflare R2 with public access
- AWS S3 with a public bucket or presigned URL
- GitHub raw content
- Any public HTTP(S) endpoint

Local files (`file://`) and presigned URLs with short expiry are not supported.

## Media Types

`Publish.ts` dispatches on `--media-type`:

| Type | Flags | Notes |
|---|---|---|
| `image` (default) | `--image-url`, `--caption` | Single photo feed post |
| `reels` | `--video-url`, `--caption` | Default poll-timeout bumped to 300s (video processing) |
| `stories` | `--image-url` OR `--video-url` | No caption allowed; mutually exclusive media sources |
| `carousel` | `--image-urls <csv>`, `--caption` | 2–10 images; each becomes a child container, polled individually, then combined |

## Examples

```bash
# Single photo (default, no --media-type needed)
bun Tools/Publish.ts \
  --image-url "https://example.com/photo.jpg" \
  --caption "New essay on compounding systems"

# Reel
bun Tools/Publish.ts --media-type reels \
  --video-url "https://example.com/clip.mp4" \
  --caption "new release"

# Story — image
bun Tools/Publish.ts --media-type stories \
  --image-url "https://example.com/story.jpg"

# Story — video
bun Tools/Publish.ts --media-type stories \
  --video-url "https://example.com/story.mp4"

# Carousel (2–10 photos)
bun Tools/Publish.ts --media-type carousel \
  --image-urls "https://a.jpg,https://b.jpg,https://c.jpg" \
  --caption "three photos"

# Custom polling (large media)
bun Tools/Publish.ts \
  --image-url "https://example.com/highres.jpg" \
  --caption "..." \
  --poll-interval 5000 \
  --poll-timeout 300000

# Reply to a comment
bun Tools/Comment.ts --action reply --comment-id 17841000000000000 --message "Thanks!"

# Delete a comment (destructive — requires --yes)
bun Tools/Comment.ts --action delete --comment-id 17841000000000000 --yes

# Fetch recent media
bun Tools/Fetch.ts --type media --max-pages 3

# Fetch insights on a specific post
bun Tools/Fetch.ts --type insights --media-id 17841000000000000

# Fetch comments on a specific post
bun Tools/Fetch.ts --type comments --media-id 17841000000000000
```

## Environment Variables

| Key | Source | Required For |
|---|---|---|
| `FACEBOOK_PAGE_TOKEN` | Facebook `Login.ts` | All Instagram tools |
| `FACEBOOK_IG_USER_ID` | Facebook `Login.ts` (when Page has linked IG) | All Instagram tools |

## Supported Operations

- ✅ Publish photos
- ✅ Publish reels (video, longer polling timeout)
- ✅ Publish stories (image or video)
- ✅ Publish carousels (2–10 images)
- ✅ Fetch media list
- ✅ Fetch media insights
- ✅ Fetch media comments
- ✅ Reply to comments
- ✅ Delete comments (with `--yes` guard)
- ⬜ Publish carousels with mixed image + video (future)
- ⬜ Tag users / locations in posts (future)
- ⬜ Schedule posts (Instagram API does not support this — use Meta Business Suite)

## Errors

- **Missing `FACEBOOK_IG_USER_ID`** — your Page doesn't have a linked IG Business account, or you ran Login.ts before linking it. Link the IG account in Facebook Business Suite, then re-run Login.ts.
- **Container stuck in `IN_PROGRESS`** — Meta is still processing the media. Increase `--poll-timeout` (default 120s).
- **Container goes to `ERROR`** — the image URL was unreachable, the image was too large, or violated Instagram's content policy.
- **`GraphAPIError` code 190** — the Page token is invalid. Re-run Facebook `Login.ts`.
