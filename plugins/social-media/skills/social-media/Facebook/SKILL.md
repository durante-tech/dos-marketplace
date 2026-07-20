---
name: Facebook
description: Authenticate, publish, and fetch data from Facebook Pages via Graph API v24.0. USE WHEN facebook login, facebook oauth, facebook page token, publish to facebook, post to facebook page, share on facebook, facebook insights, facebook page analytics, facebook post comments, facebook page posts, connect facebook account.
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

# Facebook

Facebook Page tooling — OAuth flow, feed publishing, and insights/analytics via Graph API v24.0.

## Prerequisites

- Meta Developer app in **Development Mode** with yourself added as admin, developer, or tester
- App ID and App Secret from https://developers.facebook.com/apps/
- At least one Facebook Page you administer
- bun runtime

## Tools

| Tool | Purpose | Command |
|---|---|---|
| `Login.ts` | OAuth flow → long-lived Page token stored in `~/.claude/.env` | `bun Tools/Login.ts --app-id <id> --app-secret <secret>` |
| `Publish.ts` | Post to Page feed (text, link preview, photo, scheduled) | `bun Tools/Publish.ts --message "hello world"` |
| `PublishVideo.ts` | Publish a native video post (video URL, async processing) | `bun Tools/PublishVideo.ts --video-url https://example.com/clip.mp4` |
| `Comment.ts` | Reply to or delete a Page comment (destructive delete requires --yes) | `bun Tools/Comment.ts --action reply --comment-id 123_456 --message "Thanks!"` |
| `Fetch.ts` | Retrieve posts, insights, or comments (insights supports --since/--until) | `bun Tools/Fetch.ts --type posts --max-pages 3` |

## First-Time Setup

1. Create a Meta Developer app at https://developers.facebook.com/apps/ (type: **Business**)
2. Keep the app in **Development Mode** — this is the default for new apps and requires no App Review
3. Add yourself as **Admin** under App Roles → Roles
4. Copy the App ID and App Secret from Settings → Basic
5. Run: `bun Tools/Login.ts --app-id <APP_ID> --app-secret <APP_SECRET>`
6. Your browser opens to the Facebook OAuth dialog — approve all 13 requested scopes
7. Facebook redirects to a blank `login_success.html` page — copy the full URL from your address bar
8. Paste the URL back into the terminal when prompted
9. Select the Page you want to authorize (if you administer more than one)
10. The long-lived, non-expiring Page token is written to `~/.claude/.env`

## Publishing

Once Login has run:

```bash
# Simple text post
bun Tools/Publish.ts --message "Shipped the new pack"

# Post with link attachment
bun Tools/Publish.ts --message "New essay" --link "https://example.com/essay"

# Native photo post (attaches to /{page-id}/photos)
bun Tools/Publish.ts --message "look at this" --image "https://example.com/photo.jpg"

# Draft (unpublished)
bun Tools/Publish.ts --message "Saved for later" --draft

# Scheduled post (unix timestamp, 10m–6mo in the future)
bun Tools/Publish.ts --message "Tomorrow at 9am" --schedule $(date -v+1d -v9H -v0M -v0S +%s)

# Native video post (async processing — video URL must be public)
bun Tools/PublishVideo.ts --video-url "https://example.com/clip.mp4" \
  --title "New release" --description "Shipping notes"
```

## Moderating Comments

```bash
# Reply to a comment
bun Tools/Comment.ts --action reply --comment-id 123456_987654 --message "Thanks for reading!"

# Delete a comment (destructive — requires --yes)
bun Tools/Comment.ts --action delete --comment-id 123456_987654 --yes
```

## Fetching Data

```bash
# Recent posts with engagement summary
bun Tools/Fetch.ts --type posts --max-pages 3

# Page insights for default metrics
bun Tools/Fetch.ts --type insights

# Custom metrics
bun Tools/Fetch.ts --type insights --metrics page_impressions,page_fans

# Insights for a specific date range (last 7 days)
bun Tools/Fetch.ts --type insights --since $(date -v-7d +%s) --until $(date +%s)

# Comments on a specific post
bun Tools/Fetch.ts --type comments --post-id 123456789_987654321
```

## Environment Variables

| Key | Written By | Used By |
|---|---|---|
| `FACEBOOK_APP_ID` | `Login.ts` | Login re-runs |
| `FACEBOOK_PAGE_ID` | `Login.ts` | `Publish.ts`, `Fetch.ts` |
| `FACEBOOK_PAGE_TOKEN` | `Login.ts` | `Publish.ts`, `Fetch.ts`, Instagram tools |
| `FACEBOOK_IG_USER_ID` | `Login.ts` (if Page has linked IG) | Instagram tools |

## Required Scopes (13)

`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_manage_metadata`, `pages_read_user_content`, `business_management`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `read_insights`, `ads_read`

## Errors

If a tool fails with a `GraphAPIError` where `code: 190`, the token has been revoked or expired (rare for Page tokens — usually means the admin changed their password). Re-run `Login.ts`.
