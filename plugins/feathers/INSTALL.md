# Michael Feathers v1.0.0 — Installation Guide

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
"I'm installing Feathers v1.0.0 — Feathers on tap — code without tests is legacy code, every seam has an enabling point, characterization tests pin what is before deciding what should be..

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

if [ -d "$CLAUDE_DIR/skills/Feathers" ]; then
  echo "WARNING Existing Feathers skill found at: $CLAUDE_DIR/skills/Feathers"
  ls -la "$CLAUDE_DIR/skills/feathers/" 2>/dev/null
else
  echo "OK No existing Feathers skill (clean install)"
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
  "header": "Conflict — Existing Feathers Skill",
  "question": "An existing Feathers skill was found. How should I proceed?",
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
  "question": "Ready to install Feathers v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/feathers/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/feathers-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/Feathers" ] && cp -r "$CLAUDE_DIR/skills/Feathers" "$BACKUP_DIR/Feathers"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Feathers"
mkdir -p "$CLAUDE_DIR/skills/feathers/Workflows"
echo "Created Feathers skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/Biography.md" "$CLAUDE_DIR/skills/feathers/Biography.md"
cp "$PACK_DIR/src/Lookup.md" "$CLAUDE_DIR/skills/feathers/Lookup.md"
cp "$PACK_DIR/src/Principles.md" "$CLAUDE_DIR/skills/feathers/Principles.md"
cp "$PACK_DIR/src/QuoteBank.md" "$CLAUDE_DIR/skills/feathers/QuoteBank.md"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/feathers/SKILL.md"
cp "$PACK_DIR/src/StepAsideTable.md" "$CLAUDE_DIR/skills/feathers/StepAsideTable.md"
cp "$PACK_DIR/src/Workflows/BreakDependency.md" "$CLAUDE_DIR/skills/feathers/Workflows/BreakDependency.md"
cp "$PACK_DIR/src/Workflows/CharacterizationTest.md" "$CLAUDE_DIR/skills/feathers/Workflows/CharacterizationTest.md"
cp "$PACK_DIR/src/Workflows/SeamFind.md" "$CLAUDE_DIR/skills/feathers/Workflows/SeamFind.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/feathers/extension.yaml"

echo "Copied 10 Feathers files"
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"Feathers v1.0.0 installed successfully.

What's available:
- BreakDependency — see Workflows/BreakDependency.md for triggers
- CharacterizationTest — see Workflows/CharacterizationTest.md for triggers
- SeamFind — see Workflows/SeamFind.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Feathers/"
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
- `src/Workflows/BreakDependency.md`
- `src/Workflows/CharacterizationTest.md`
- `src/Workflows/SeamFind.md`
- `src/extension.yaml`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
