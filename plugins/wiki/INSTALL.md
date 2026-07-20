# Wiki v1.0.0 — Installation Guide

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
"I'm installing Wiki v1.0.0 — Agent-maintained OKF knowledge vault over your immutable sources.

This pack installs 9 files across 3 directories.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/Wiki" ]; then
  echo "WARNING Existing wiki skill found at: $CLAUDE_DIR/skills/Wiki"
  ls -la "$CLAUDE_DIR/skills/wiki/" 2>/dev/null
else
  echo "OK No existing wiki skill (clean install)"
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
  "header": "Conflict — Existing Wiki Skill",
  "question": "An existing wiki skill was found. How should I proceed?",
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
  "question": "Ready to install Wiki v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/wiki/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/wiki-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/Wiki" ] && cp -r "$CLAUDE_DIR/skills/Wiki" "$BACKUP_DIR/Wiki"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Wiki"
mkdir -p "$CLAUDE_DIR/skills/wiki/Templates"
mkdir -p "$CLAUDE_DIR/skills/wiki/Tools"
mkdir -p "$CLAUDE_DIR/skills/wiki/Workflows"
echo "Created wiki skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/CHANGELOG.md" "$CLAUDE_DIR/skills/wiki/CHANGELOG.md"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/wiki/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md" "$CLAUDE_DIR/skills/wiki/SKILL.partials.md"
cp "$PACK_DIR/src/Templates/Schema.md" "$CLAUDE_DIR/skills/wiki/Templates/Schema.md"
cp "$PACK_DIR/src/Workflows/Ingest.md" "$CLAUDE_DIR/skills/wiki/Workflows/Ingest.md"
cp "$PACK_DIR/src/Workflows/Init.md" "$CLAUDE_DIR/skills/wiki/Workflows/Init.md"
cp "$PACK_DIR/src/Workflows/Lint.md" "$CLAUDE_DIR/skills/wiki/Workflows/Lint.md"
cp "$PACK_DIR/src/Workflows/Query.md" "$CLAUDE_DIR/skills/wiki/Workflows/Query.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/wiki/extension.yaml"

echo "Copied 9 Wiki files"
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"Wiki v1.0.0 installed successfully.

What's available:
- Ingest — see Workflows/Ingest.md for triggers
- Init — see Workflows/Init.md for triggers
- Lint — see Workflows/Lint.md for triggers
- Query — see Workflows/Query.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Wiki/"
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

- `src/CHANGELOG.md`
- `src/SKILL.md`
- `src/SKILL.partials.md`
- `src/Templates/Schema.md`
- `src/Workflows/Ingest.md`
- `src/Workflows/Init.md`
- `src/Workflows/Lint.md`
- `src/Workflows/Query.md`
- `src/extension.yaml`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
