# SocialMedia v0.1.0 — Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

This is a wizard-style installation. Use Claude Code's native tools:

1. **AskUserQuestion** — for user decisions
2. **TodoWrite** — for progress tracking
3. **Bash / Read / Write** — for actual installation
4. **VERIFY.md** — for final validation

### Welcome Message

```
"I'm installing SocialMedia v0.1.0 — direct Graph API v24.0 integration for
Facebook Pages and Instagram Business accounts.

This pack adds:
- Facebook Login (OAuth), Publish, and Fetch CLIs
- Instagram Publish (two-step container) and Fetch CLIs
- A shared Graph API v24.0 client with typed errors and pagination

No SDKs, no SaaS middleware, no recurring fees. Credentials stay in
~/.claude/.env (chmod 600).

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

# Skills directory
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Existing social-media skill
if [ -d "$CLAUDE_DIR/skills/SocialMedia" ]; then
  echo "WARNING Existing social-media skill found — will ask about conflict"
else
  echo "OK No existing social-media skill (clean install)"
fi

# bun runtime
if command -v bun &>/dev/null; then
  echo "OK bun runtime: $(bun --version)"
else
  echo "WARNING bun not found — install: curl -fsSL https://bun.sh/install | bash"
fi

# ~/.claude/.env
if [ -f "$CLAUDE_DIR/.env" ]; then
  echo "OK ~/.claude/.env exists"
  if grep -q "^FACEBOOK_" "$CLAUDE_DIR/.env" 2>/dev/null; then
    echo "INFO Existing FACEBOOK_* keys detected — Login.ts will prompt before overwrite"
  fi
else
  echo "INFO ~/.claude/.env does not exist — Login.ts will create it"
fi
```

Report findings to the user.

---

## Phase 2: User Questions

### Question 1: Conflict Resolution (if existing skill found)

```json
{
  "header": "Conflict — Existing SocialMedia Skill",
  "question": "An existing social-media skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates a timestamped backup, then installs the new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Meta Developer App Status

```json
{
  "header": "Meta Developer App",
  "question": "Do you already have a Meta Developer app in Development Mode with yourself added as admin?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, I have an app ready", "description": "I have the App ID and App Secret, and I'm added as admin"},
    {"label": "No, I need to create one", "description": "I'll create one after installation — show me how"},
    {"label": "I have an app but not in Dev Mode", "description": "I'll need to switch to Development Mode first"}
  ]
}
```

**If user chose "No, I need to create one":** explain the Meta Developer app creation flow:

```
1. Visit https://developers.facebook.com/apps/ and click "Create App"
2. Choose app type: "Business"
3. Enter a name (e.g., "DOS Personal") and contact email
4. After creation, go to App Roles → Roles and confirm you're listed as Admin
5. In Settings → Basic, copy the App ID and App Secret
6. Keep the app in Development Mode (this is the default — no App Review needed)
7. Return here and run Login.ts with your App ID and App Secret
```

### Question 3: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install SocialMedia v0.1.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/social-media/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**

```
Directories to be created:
- ~/.claude/skills/social-media/
- ~/.claude/skills/social-media/Lib/
- ~/.claude/skills/social-media/Facebook/Tools/
- ~/.claude/skills/social-media/Facebook/Workflows/
- ~/.claude/skills/social-media/Instagram/Tools/
- ~/.claude/skills/social-media/Instagram/Workflows/

Files to be created:
- SKILL.md (top-level router)
- Lib/env.ts, Lib/cli.ts, Lib/graph.ts
- Facebook/SKILL.md
- Facebook/Tools/{Login.ts, Publish.ts, Fetch.ts, package.json, tsconfig.json}
- Instagram/SKILL.md
- Instagram/Tools/{Publish.ts, Fetch.ts, package.json, tsconfig.json}

No hooks, no configuration changes outside of Skills directory.
Login.ts will later prompt before writing to ~/.claude/.env.
```

---

## Phase 3: Backup (If Requested)

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/socialmedia-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -d "$CLAUDE_DIR/skills/SocialMedia" ]; then
  cp -R "$CLAUDE_DIR/skills/SocialMedia" "$BACKUP_DIR/SocialMedia"
  echo "Backed up existing skill to: $BACKUP_DIR/SocialMedia"
fi
```

---

## Phase 4: Installation

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

# Create directory structure
mkdir -p "$TARGET/Lib"
mkdir -p "$TARGET/Facebook/Tools"
mkdir -p "$TARGET/Facebook/Workflows"
mkdir -p "$TARGET/Instagram/Tools"
mkdir -p "$TARGET/Instagram/Workflows"

# Copy top-level skill router
cp "$PACK_DIR/src/SKILL.md" "$TARGET/SKILL.md"

# Copy shared Lib
cp "$PACK_DIR/src/Lib/env.ts" "$TARGET/Lib/env.ts"
cp "$PACK_DIR/src/Lib/cli.ts" "$TARGET/Lib/cli.ts"
cp "$PACK_DIR/src/Lib/graph.ts" "$TARGET/Lib/graph.ts"

# Copy Facebook subsystem
cp "$PACK_DIR/src/Facebook/SKILL.md" "$TARGET/Facebook/SKILL.md"
cp -R "$PACK_DIR/src/Facebook/Tools/." "$TARGET/Facebook/Tools/"

# Copy Instagram subsystem
cp "$PACK_DIR/src/Instagram/SKILL.md" "$TARGET/Instagram/SKILL.md"
cp -R "$PACK_DIR/src/Instagram/Tools/." "$TARGET/Instagram/Tools/"

echo "All skill files copied to $TARGET"
```

### Install Tool Type Definitions

```bash
CLAUDE_DIR="$HOME/.claude"
cd "$CLAUDE_DIR/skills/social-media/Facebook/Tools" && bun install
cd "$CLAUDE_DIR/skills/social-media/Instagram/Tools" && bun install
echo "TypeScript definitions installed"
```

---

## Phase 5: Authentication (Optional, Recommended)

Ask the user:

```json
{
  "header": "Authenticate Now?",
  "question": "Would you like to authenticate with Facebook now?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, run Login.ts now (Recommended)", "description": "Walks through OAuth and stores Page token"},
    {"label": "No, I'll do it later", "description": "Skip authentication — run Login.ts manually when ready"}
  ]
}
```

If yes, prompt for App ID and App Secret, then:

```bash
CLAUDE_DIR="$HOME/.claude"
bun "$CLAUDE_DIR/skills/social-media/Facebook/Tools/Login.ts" \
  --app-id "$APP_ID" --app-secret "$APP_SECRET"
```

Warn the user: the browser will open, they must paste the redirect URL back into the terminal, and credentials will be written to `~/.claude/.env` with chmod 600.

---

## Phase 6: Verification

Execute all checks from `VERIFY.md`.

---

## Success Message

```
"SocialMedia v0.1.0 installed successfully!

What's available:
- Facebook subsystem — OAuth login, Page publishing, insights, comments
- Instagram subsystem — two-step media publishing, media list, insights, comments
- Graph API v24.0 pinned (bump in Lib/graph.ts when ready)

Try it now:
- 'publish "hello world" to my facebook page'
- 'what are my facebook page insights this week'
- 'publish this photo to instagram: https://example.com/pic.jpg'

All Graph API calls use the token stored in ~/.claude/.env (chmod 600).
Re-run Login.ts anytime to refresh or switch accounts."
```

---

## Troubleshooting

### `MISSING FACEBOOK_PAGE_TOKEN`
Run `Facebook/Tools/Login.ts` to authenticate.

### `GraphAPIError code 190`
Token was revoked or the admin changed their password. Re-run `Login.ts`.

### `Container did not reach FINISHED`
Instagram image processing is slow for large media. Increase `--poll-timeout` on `Instagram/Tools/Publish.ts`.

### `Missing FACEBOOK_IG_USER_ID`
The authenticated Facebook Page does not have a linked Instagram Business account. Link it in Facebook Business Suite, then re-run `Login.ts`.

### bun not found
Install bun: `curl -fsSL https://bun.sh/install | bash`

### `@types/bun` not found when editing .ts files
Run `bun install` inside `Facebook/Tools/` and `Instagram/Tools/` to populate `node_modules/@types/bun`.
