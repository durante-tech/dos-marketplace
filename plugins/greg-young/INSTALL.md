# Greg Young v1.0.0 — Installation Guide

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
"I'm installing GregYoung v1.0.0 — Young on tap — CQRS as two objects where there was one, current state as a left fold of events, the inventor's-license caveat that for most systems this is overkill..

This pack installs 10 files across 1 directory.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/GregYoung" ]; then
  echo "WARNING Existing GregYoung skill found at: $CLAUDE_DIR/skills/GregYoung"
  ls -la "$CLAUDE_DIR/skills/greg-young/" 2>/dev/null
else
  echo "OK No existing GregYoung skill (clean install)"
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
  "header": "Conflict — Existing GregYoung Skill",
  "question": "An existing GregYoung skill was found. How should I proceed?",
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
  "question": "Ready to install GregYoung v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/greg-young/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/gregyoung-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/GregYoung" ] && cp -r "$CLAUDE_DIR/skills/GregYoung" "$BACKUP_DIR/GregYoung"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/GregYoung"
mkdir -p "$CLAUDE_DIR/skills/greg-young/Workflows"
echo "Created GregYoung skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/Biography.md" "$CLAUDE_DIR/skills/greg-young/Biography.md"
cp "$PACK_DIR/src/Lookup.md" "$CLAUDE_DIR/skills/greg-young/Lookup.md"
cp "$PACK_DIR/src/Principles.md" "$CLAUDE_DIR/skills/greg-young/Principles.md"
cp "$PACK_DIR/src/QuoteBank.md" "$CLAUDE_DIR/skills/greg-young/QuoteBank.md"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/greg-young/SKILL.md"
cp "$PACK_DIR/src/StepAsideTable.md" "$CLAUDE_DIR/skills/greg-young/StepAsideTable.md"
cp "$PACK_DIR/src/Workflows/CommandQuerySplit.md" "$CLAUDE_DIR/skills/greg-young/Workflows/CommandQuerySplit.md"
cp "$PACK_DIR/src/Workflows/CqrsCheck.md" "$CLAUDE_DIR/skills/greg-young/Workflows/CqrsCheck.md"
cp "$PACK_DIR/src/Workflows/EventSource.md" "$CLAUDE_DIR/skills/greg-young/Workflows/EventSource.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/greg-young/extension.yaml"

echo "Copied 10 GregYoung files"
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"GregYoung v1.0.0 installed successfully.

What's available:
- CommandQuerySplit — see Workflows/CommandQuerySplit.md for triggers
- CqrsCheck — see Workflows/CqrsCheck.md for triggers
- EventSource — see Workflows/EventSource.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/GregYoung/"
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

- `src/Biography.md`
- `src/Lookup.md`
- `src/Principles.md`
- `src/QuoteBank.md`
- `src/SKILL.md`
- `src/StepAsideTable.md`
- `src/Workflows/CommandQuerySplit.md`
- `src/Workflows/CqrsCheck.md`
- `src/Workflows/EventSource.md`
- `src/extension.yaml`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
