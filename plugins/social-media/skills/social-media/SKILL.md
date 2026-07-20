---
name: SocialMedia
description: Publish to and fetch analytics from Facebook Pages, Instagram Business accounts, and LinkedIn personal profiles via direct REST APIs (Graph v24.0 and LinkedIn /rest/posts). USE WHEN publish to facebook, post to facebook, publish to instagram, post to instagram, publish to linkedin, post to linkedin, share on facebook, share on instagram, share on linkedin, facebook insights, instagram insights, facebook analytics, instagram analytics, facebook login, facebook oauth, linkedin login, linkedin oauth, page token, ig business, graph api, meta api, linkedin api, social media publishing, social media analytics, page comments, instagram comments.
role: executor
accepts:
  - text
icon: Share2
colorVar: accent
colorHex: "#1877f2"
tier: primary
category: SocialMedia
displayLabel: Social Media
marketingDescription: Direct REST integration for Facebook Pages, Instagram Business, and LinkedIn — publish (and fetch insights/comments on Meta) from the command line, no SaaS middleware.
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
elevator: Zero-dep REST CLIs for Facebook, Instagram, and LinkedIn — publish, insights, comments
highlightWorkflows:
  - name: Facebook Login
    technicalName: FacebookLogin
  - name: Facebook Publish
    technicalName: FacebookPublish
  - name: Instagram Publish
    technicalName: InstagramPublish
roots:
  - PRINCIPAL
visibility: public
feature_capabilities:
  - Facebook Page OAuth with long-lived non-expiring token storage
  - Facebook Page insights and post comments
  - Facebook feed publishing (message, link, draft)
  - Instagram Business two-step media publishing
  - Instagram media, insights, and comment retrieval
  - LinkedIn personal-profile publishing (text, image, article) — publish-only; member analytics is platform-blocked (Org-only)
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/SocialMedia/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SocialMedia

Unified skill for publishing across Facebook Pages, Instagram Business accounts, and LinkedIn personal profiles, plus analytics on the Meta platforms. Facebook + Instagram call the Meta Graph API v24.0; LinkedIn calls its REST `/rest/posts` API. No SDKs, no third-party middleware, no recurring SaaS fees. (LinkedIn is publish-only — member-profile analytics is platform-blocked, Org-only.)

## First-Time Setup

Before any other tool works, the user must authenticate via `Facebook/Tools/Login.ts`. This single OAuth flow:

1. Requests 13 scopes covering Facebook Pages + Instagram Business + Ads reads
2. Exchanges the short-lived user token for a long-lived user token (60 days)
3. Extracts a **non-expiring Page access token** from `/me/accounts`
4. Stores `FACEBOOK_PAGE_TOKEN`, `FACEBOOK_PAGE_ID`, `FACEBOOK_IG_USER_ID` in `~/.claude/.env` (chmod 600)

After Login completes, Publish and Fetch tools read the stored token and operate indefinitely — the Page token survives unless the user revokes permissions or changes their password.

## Publish Safety

Publishing to a public account is irreversible, so every publish entrypoint (Facebook `Publish.ts`, Facebook `PublishVideo.ts`, Instagram `Publish.ts`, LinkedIn `Publish.ts`) is guarded by a shared policy in `Lib/cli.ts` (`decidePublish`/`enforcePublish`):

- **A bare invocation DRY-RUNS** — it prints the composed post + target account and exits non-zero. It never silently publishes.
- **`--yes` is required to go live** — the explicit confirmation for an irreversible public post (mirrors the `Comment.ts` destructive-delete `--yes` idiom).
- **`--draft` stages an unpublished post** on Facebook + LinkedIn (the soft path). **Instagram has no draft state**, so its only safety is the `--yes` confirm-gate.
- **`SOCIAL_DRAFT_ONLY=1` is a fail-closed, LLM-unspoofable draft-only mode.** When a composing skill sets this env var (outside the prompt surface), Facebook + LinkedIn are forced to draft regardless of flags, and Instagram is hard-refused (it cannot stage). This is how a consumer's "DRAFT ONLY" contract (e.g. StreamRig's PostStream/GoLive) becomes a structural boundary rather than a hoped-for convention — it is an env/spawn condition the calling agent cannot pass as a flag.

The guard is a pure policy function (unit-tested in `Lib/cli.test.ts`); the live-publish decision lives in exactly one place so it cannot drift per platform.

## Workflow Routing

**Sub-component routing:** references to `<Sub>/SKILL.md` in this skill are FILE PATHS relative to this skill's directory — load them with the Read tool and follow their instructions. Sub-components (Facebook/, Instagram/) are NOT separately registered skills: never invoke `Skill("social-media:<Component>")` — it fails with "Unknown skill".

| Request Pattern | Route To |
|---|---|
| Authenticate Facebook, get Page token, facebook login, oauth flow | `Facebook/SKILL.md` → `Tools/Login.ts` |
| Publish to Facebook Page, post to facebook, share on facebook | `Facebook/SKILL.md` → `Tools/Publish.ts` |
| Facebook Page insights, page analytics, post performance | `Facebook/SKILL.md` → `Tools/Fetch.ts --type insights` |
| Facebook Page posts list, recent posts, feed | `Facebook/SKILL.md` → `Tools/Fetch.ts --type posts` |
| Facebook post comments, comment moderation | `Facebook/SKILL.md` → `Tools/Fetch.ts --type comments` |
| Publish to Instagram, post photo to instagram, IG feed post | `Instagram/SKILL.md` → `Tools/Publish.ts` |
| Instagram media list, recent posts, IG feed | `Instagram/SKILL.md` → `Tools/Fetch.ts --type media` |
| Instagram insights, post analytics, IG reach | `Instagram/SKILL.md` → `Tools/Fetch.ts --type insights` |
| Instagram comments, IG moderation | `Instagram/SKILL.md` → `Tools/Fetch.ts --type comments` |
| Authenticate LinkedIn, linkedin login, linkedin oauth, member token | `LinkedIn/Tools/Login.ts` |
| Publish to LinkedIn personal profile, share on linkedin, linkedin text post | `LinkedIn/Tools/Publish.ts --message` |
| LinkedIn image post, photo on linkedin, linkedin carousel | `LinkedIn/Tools/Publish.ts --image` or `--images` |
| LinkedIn article/link post, share link on linkedin | `LinkedIn/Tools/Publish.ts --article` |

## Examples

**Example 1: First-time Facebook authentication**
```
User: "connect my facebook page to DOS"
→ Routes to Facebook/SKILL.md → Login.ts
→ Opens OAuth dialog in browser with 13 scopes
→ User pastes redirect URL back
→ Exchanges code → long-lived user token → Page token
→ Writes credentials to ~/.claude/.env
```

**Example 2: Publish a Facebook post**
```
User: "post 'shipped the new pack today' to my facebook page"
→ Routes to Facebook/SKILL.md → Publish.ts
→ Reads FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN from env
→ POST /{page-id}/feed with message
→ Returns post ID
```

**Example 3: Publish a photo to Instagram**
```
User: "publish this photo to instagram with caption 'new essay'"
→ Routes to Instagram/SKILL.md → Publish.ts
→ Step 1: POST /{ig-user-id}/media → container ID
→ Step 2: Poll /{container-id}?fields=status_code until FINISHED
→ Step 3: POST /{ig-user-id}/media_publish with creation_id
→ Returns IG media ID
```

**Example 4: Check Facebook Page engagement**
```
User: "what are my facebook page impressions this week"
→ Routes to Facebook/SKILL.md → Fetch.ts --type insights
→ GET /{page-id}/insights?metric=page_impressions,page_engaged_users
→ Returns metric breakdown
```

## Architecture

All tools share a Lib layer:

- `Lib/env.ts` — loads `~/.claude/.env` into `process.env`
- `Lib/cli.ts` — `CLIError` class and `handleError` for consistent exit codes
- `Lib/graph.ts` — Graph API v24.0 client (Facebook + Instagram), `GraphAPIError`, `graphPaginate`, `buildAuthUrl`, and `REQUIRED_SCOPES`
- `Lib/linkedin.ts` — LinkedIn REST client (`/rest/posts`), a separate API/auth surface from the Meta Graph

**The `graph.ts`/`linkedin.ts` split is intentional:** Facebook + Instagram genuinely share the Meta Graph API, token model, and error codes; LinkedIn is a distinct API with its own auth. Keeping them as separate clients is the right seam — they are not forced through one transport.

**Version pinning:** the Graph API version lives in exactly one constant (`GRAPH_VERSION` in `Lib/graph.ts`). Bumping is a one-line change.

**HTTP layer:** native `fetch`. Zero dependencies.

**Auth errors:** `GraphAPIError.isAuthError` returns true for Meta codes 190 and 102 — prompt the user to re-run Login.ts.

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"SocialMedia","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/social-media/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/social-media/` — active release submodule (versioned)
3. `Packs/*/src/SocialMedia/` — pack source (distributable)
4. `Packs/agents/SocialMedia/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
