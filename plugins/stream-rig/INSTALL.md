# StreamRig v1.0.0 — Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** — for user decisions and confirmations
2. **TodoWrite** — for progress tracking
3. **Bash/Read/Write** — for actual installation
4. **VERIFY.md** — for final validation

### Welcome Message

Before starting, greet the user:

```
"I'm installing StreamRig v1.0.0 — Build-in-public livestream operations layer for creators — orchestrates brand kit generation, OBS scene setup, Stream Deck profile, runtime phase control, and the post-stream content multiplier (transcript to newsletter, social posts, clips, show notes).

This pack installs 11 files across 4 directories.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/StreamRig" ]; then
  echo "WARNING Existing stream-rig skill found at: $CLAUDE_DIR/skills/StreamRig"
  ls -la "$CLAUDE_DIR/skills/stream-rig/" 2>/dev/null
else
  echo "OK No existing stream-rig skill (clean install)"
fi

if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

if command -v bun &> /dev/null; then
  echo "OK Bun runtime available: $(bun --version)"
else
  echo "WARNING Bun runtime not found (install: curl -fsSL https://bun.sh/install | bash)"
fi
```

### 1.2 Present Findings

Tell the user what you found.

---

## Phase 2: User Questions

### Question 1: Conflict Resolution (only if existing skill found)

```json
{
  "header": "Conflict — Existing StreamRig Skill",
  "question": "An existing stream-rig skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install StreamRig v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/stream-rig/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/streamrig-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/StreamRig" ] && cp -r "$CLAUDE_DIR/skills/StreamRig" "$BACKUP_DIR/StreamRig"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/StreamRig"
mkdir -p "$CLAUDE_DIR/skills/stream-rig/Overlays"
mkdir -p "$CLAUDE_DIR/skills/stream-rig/Presets"
mkdir -p "$CLAUDE_DIR/skills/stream-rig/Tools"
mkdir -p "$CLAUDE_DIR/skills/stream-rig/Workflows"
echo "Created stream-rig skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/Overlays/README.md" "$CLAUDE_DIR/skills/stream-rig/Overlays/README.md"
cp "$PACK_DIR/src/Presets/podcast.yaml" "$CLAUDE_DIR/skills/stream-rig/Presets/podcast.yaml"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/stream-rig/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md" "$CLAUDE_DIR/skills/stream-rig/SKILL.partials.md"
cp "$PACK_DIR/src/Tools/README.md" "$CLAUDE_DIR/skills/stream-rig/Tools/README.md"
cp "$PACK_DIR/src/Workflows/EndShow.md" "$CLAUDE_DIR/skills/stream-rig/Workflows/EndShow.md"
cp "$PACK_DIR/src/Workflows/EpisodeMemory.md" "$CLAUDE_DIR/skills/stream-rig/Workflows/EpisodeMemory.md"
cp "$PACK_DIR/src/Workflows/InitRig.md" "$CLAUDE_DIR/skills/stream-rig/Workflows/InitRig.md"
cp "$PACK_DIR/src/Workflows/PostStream.md" "$CLAUDE_DIR/skills/stream-rig/Workflows/PostStream.md"
cp "$PACK_DIR/src/Workflows/PreShow.md" "$CLAUDE_DIR/skills/stream-rig/Workflows/PreShow.md"
cp "$PACK_DIR/src/Workflows/RefreshBrand.md" "$CLAUDE_DIR/skills/stream-rig/Workflows/RefreshBrand.md"

echo "Copied 11 StreamRig files"
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"StreamRig v1.0.0 installed successfully.

What's available:
- EndShow — see Workflows/EndShow.md for triggers
- EpisodeMemory — see Workflows/EpisodeMemory.md for triggers
- InitRig — see Workflows/InitRig.md for triggers
- PostStream — see Workflows/PostStream.md for triggers
- PreShow — see Workflows/PreShow.md for triggers
- RefreshBrand — see Workflows/RefreshBrand.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/StreamRig/"
```

### On Failure

```
"Installation encountered issues. Here's what to check:
1. Ensure ~/.claude/ directory exists
2. Check write permissions on ~/.claude/skills/
3. Run the verification commands in VERIFY.md
Need help? Open an issue at https://github.com/durante-tech/dos/issues"
```

---

## What's Included

- `src/Overlays/README.md`
- `src/Presets/podcast.yaml`
- `src/SKILL.md`
- `src/SKILL.partials.md`
- `src/Tools/README.md`
- `src/Workflows/EndShow.md`
- `src/Workflows/EpisodeMemory.md`
- `src/Workflows/InitRig.md`
- `src/Workflows/PostStream.md`
- `src/Workflows/PreShow.md`
- `src/Workflows/RefreshBrand.md`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
