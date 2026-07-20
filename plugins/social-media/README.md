# SocialMedia Pack v0.1.0

> Direct Graph API v24.0 CLIs for Facebook Pages and Instagram Business accounts.

## Quickstart

```bash
# 1. Create a Meta Developer app at https://developers.facebook.com/apps/
#    Keep it in Development Mode (no App Review required).
# 2. Add yourself as admin under App Roles.
# 3. Authenticate:
bun src/Facebook/Tools/Login.ts \
  --app-id <YOUR_APP_ID> \
  --app-secret <YOUR_APP_SECRET>

# 4. Publish to Facebook:
bun src/Facebook/Tools/Publish.ts --message "hello from DOS"

# 5. Publish to Instagram (image URL must be public):
bun src/Instagram/Tools/Publish.ts \
  --image-url https://example.com/photo.jpg \
  --caption "hello"

# 6. Fetch data:
bun src/Facebook/Tools/Fetch.ts --type insights
bun src/Instagram/Tools/Fetch.ts --type media --max-pages 3
```

## What's Included

| Subsystem | Tools |
|---|---|
| Facebook | `Login.ts` (OAuth), `Publish.ts`, `Fetch.ts` (posts / insights / comments) |
| Instagram | `Publish.ts` (two-step container flow), `Fetch.ts` (media / insights / comments) |

## Architecture

- **Graph API version:** pinned to v24.0 in `src/Lib/graph.ts` (`GRAPH_VERSION` constant)
- **Auth model:** long-lived Facebook Page access token stored in `~/.claude/.env` (chmod 600)
- **OAuth flow:** manual-redirect via `https://www.facebook.com/connect/login_success.html` — no local HTTP server, no port collisions
- **HTTP layer:** native `fetch`, zero runtime dependencies
- **Error handling:** `GraphAPIError` surfaces Meta error code + subcode, with an `isAuthError` check for tokens that need re-issuing

## Required Scopes (13)

`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_manage_metadata`, `pages_read_user_content`, `business_management`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `read_insights`, `ads_read`

All 13 are Advanced Access permissions. Development Mode lets you use them on your own assets without App Review — see `INSTALL.md` for the full setup.

## Prerequisites

- **bun** runtime
- **Meta Developer app** in Development Mode
- **Facebook Page** you administer
- **Instagram Business account** linked to the Page (optional, for Instagram tools only)

## Installation

See `INSTALL.md` for AI-agent-driven installation.
See `VERIFY.md` for post-install verification.

## Version

- **Pack:** 0.1.0
- **Graph API:** v24.0 (pinned — bump in `src/Lib/graph.ts`)
- **Runtime:** bun (no Node compatibility layer required)

## License & Credits

Part of the DuranteOS (DOS) project. Graph API documentation from Meta for Developers.
