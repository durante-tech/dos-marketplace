# GitHub v1.0.0 — Installation Guide

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
"I'm installing Github v1.0.0 — Team-leader PR review pack — fan a fleet of open PRs out to a multi-perspective reviewer team, aggregate verdicts, post comments, propose fixes on a side branch, and merge only with explicit human approval..

This pack installs 6 files across 2 directories.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/Github" ]; then
  echo "WARNING Existing github skill found at: $CLAUDE_DIR/skills/Github"
  ls -la "$CLAUDE_DIR/skills/github/" 2>/dev/null
else
  echo "OK No existing github skill (clean install)"
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
  "header": "Conflict — Existing Github Skill",
  "question": "An existing github skill was found. How should I proceed?",
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
  "question": "Ready to install Github v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/github/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/github-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/Github" ] && cp -r "$CLAUDE_DIR/skills/Github" "$BACKUP_DIR/Github"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Github"
mkdir -p "$CLAUDE_DIR/skills/github/Tools"
mkdir -p "$CLAUDE_DIR/skills/github/Workflows"
echo "Created github skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/github/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md" "$CLAUDE_DIR/skills/github/SKILL.partials.md"
cp "$PACK_DIR/src/Workflows/ListPRs.md" "$CLAUDE_DIR/skills/github/Workflows/ListPRs.md"
cp "$PACK_DIR/src/Workflows/ReviewPRs.md" "$CLAUDE_DIR/skills/github/Workflows/ReviewPRs.md"
cp "$PACK_DIR/src/Workflows/ReviewSinglePR.md" "$CLAUDE_DIR/skills/github/Workflows/ReviewSinglePR.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/github/extension.yaml"

echo "Copied 6 Github files"
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"Github v1.0.0 installed successfully.

What's available:
- ListPRs — see Workflows/ListPRs.md for triggers
- ReviewPRs — see Workflows/ReviewPRs.md for triggers
- ReviewSinglePR — see Workflows/ReviewSinglePR.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Github/"
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

- `src/SKILL.md`
- `src/SKILL.partials.md`
- `src/Workflows/ListPRs.md`
- `src/Workflows/ReviewPRs.md`
- `src/Workflows/ReviewSinglePR.md`
- `src/extension.yaml`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
