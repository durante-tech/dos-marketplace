# Uncle Bob v1.0.0 — Installation Guide

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
"I'm installing UncleBob v1.0.0 — Robert C. Martin's wisdom on tap — verbatim quotes, Clean Code smell tags, SOLID coaching, Three Laws of TDD..

This pack installs 9 files across 1 directory.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/UncleBob" ]; then
  echo "WARNING Existing UncleBob skill found at: $CLAUDE_DIR/skills/UncleBob"
  ls -la "$CLAUDE_DIR/skills/uncle-bob/" 2>/dev/null
else
  echo "OK No existing UncleBob skill (clean install)"
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
  "header": "Conflict — Existing UncleBob Skill",
  "question": "An existing UncleBob skill was found. How should I proceed?",
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
  "question": "Ready to install UncleBob v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/uncle-bob/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/unclebob-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/UncleBob" ] && cp -r "$CLAUDE_DIR/skills/UncleBob" "$BACKUP_DIR/UncleBob"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/UncleBob"
mkdir -p "$CLAUDE_DIR/skills/uncle-bob/Workflows"
echo "Created UncleBob skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/Principles.md" "$CLAUDE_DIR/skills/uncle-bob/Principles.md"
cp "$PACK_DIR/src/QuoteBank.md" "$CLAUDE_DIR/skills/uncle-bob/QuoteBank.md"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/uncle-bob/SKILL.md"
cp "$PACK_DIR/src/SmellsLookup.md" "$CLAUDE_DIR/skills/uncle-bob/SmellsLookup.md"
cp "$PACK_DIR/src/StepAsideTable.md" "$CLAUDE_DIR/skills/uncle-bob/StepAsideTable.md"
cp "$PACK_DIR/src/Workflows/Coach.md" "$CLAUDE_DIR/skills/uncle-bob/Workflows/Coach.md"
cp "$PACK_DIR/src/Workflows/Diagnose.md" "$CLAUDE_DIR/skills/uncle-bob/Workflows/Diagnose.md"
cp "$PACK_DIR/src/Workflows/SteelMan.md" "$CLAUDE_DIR/skills/uncle-bob/Workflows/SteelMan.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/uncle-bob/extension.yaml"

echo "Copied 9 UncleBob files"
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"UncleBob v1.0.0 installed successfully.

What's available:
- Coach — see Workflows/Coach.md for triggers
- Diagnose — see Workflows/Diagnose.md for triggers
- SteelMan — see Workflows/SteelMan.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/UncleBob/"
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

- `src/Principles.md`
- `src/QuoteBank.md`
- `src/SKILL.md`
- `src/SmellsLookup.md`
- `src/StepAsideTable.md`
- `src/Workflows/Coach.md`
- `src/Workflows/Diagnose.md`
- `src/Workflows/SteelMan.md`
- `src/extension.yaml`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
