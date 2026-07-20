# Dispatch v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **Bash/Read/Write** - For actual installation
3. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing Dispatch v1.0.0 — citation-backed authoring with mandatory metered research.

This pack adds:
- WeeklyDispatch workflow — Sunday-style retrospective on the week's events
- BlogPost workflow — Standalone post authoring
- Newsletter workflow — Curated list of 5-15 items with annotations
- Mandatory Research-skill invocation as Step 1 in every workflow
- Hard rules: no invented URLs, every claim traceable to a research vault citation
- Hero image generation via the media skill (also metered)

Dependencies: research pack and media pack must be installed.

Let me set this up."
```

---

## Phase 1: System Analysis

### 1.1 Check Prerequisites

```bash
# Check for Claude Code skills directory
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

# Check if skills directory exists
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check research pack
if [ -d "$CLAUDE_DIR/skills/Research" ]; then
  echo "OK research pack installed (mandatory Step-1 dependency)"
else
  echo "MISSING research pack — install Research before Dispatch"
fi

# Check media pack
if [ -d "$CLAUDE_DIR/skills/Media" ]; then
  echo "OK media pack installed (hero image generation)"
else
  echo "MISSING media pack — install Media before Dispatch"
fi

# Check Studio gateway env
if [ -f "$HOME/.claude/.env" ] && grep -q "STUDIO_API_URL" "$HOME/.claude/.env" && grep -q "STUDIO_API_KEY" "$HOME/.claude/.env"; then
  echo "OK Studio gateway env configured"
else
  echo "WARN Studio gateway env not configured — research/media calls will not be metered. Run: durante configure"
fi
```

---

## Phase 2: Install Files

### 2.1 Copy Skill Files

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/Dispatch"

# Create directory structure
mkdir -p "$SKILL_DIR/Workflows"

# Copy skill definition
cp src/SKILL.md "$SKILL_DIR/"
cp src/extension.yaml "$SKILL_DIR/"

# Copy workflows
cp src/Workflows/WeeklyDispatch.md "$SKILL_DIR/Workflows/"
cp src/Workflows/BlogPost.md "$SKILL_DIR/Workflows/"
cp src/Workflows/Newsletter.md "$SKILL_DIR/Workflows/"
```

### 2.2 Note on Output Path

Dispatch posts are written to the Studio public-blog content directory:
- Default: `apps/web/content/posts/{slug}.mdoc`
- Adjust workflow Step 5 if your Studio path differs.

### 2.3 Internal-Pack Registration

Dispatch is an **internal pack** — only `extension.yaml` is tracked in the cc-durante-studio submodule. The skill body stays operator-local. The gitignore registration is handled by `bun ~/Durante/Tools/scaffold-internal-pack.ts Dispatch` (already run during pack creation).

---

## Phase 3: Verify

Run the checks in `VERIFY.md` to confirm installation.
