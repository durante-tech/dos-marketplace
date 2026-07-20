# Archetypes v1.0.0 — Installation Guide

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
"I'm installing Archetypes v1.0.0 — Feature-archetype completeness matrices — market-grounded, tiered (table-stakes/expected/delighter) capability checklists with seed ISCs, plus gap audits of shipped features and PLAN-time scope seeding with explicit deferral ledgers.

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

if [ -d "$CLAUDE_DIR/skills/archetypes" ]; then
  echo "WARNING Existing Archetypes skill found at: $CLAUDE_DIR/skills/archetypes"
  ls -la "$CLAUDE_DIR/skills/archetypes/" 2>/dev/null
else
  echo "OK No existing Archetypes skill (clean install)"
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
  "header": "Conflict — Existing Archetypes Skill",
  "question": "An existing Archetypes skill was found. How should I proceed?",
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
  "question": "Ready to install Archetypes v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/archetypes/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/archetypes-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/archetypes" ] && cp -r "$CLAUDE_DIR/skills/archetypes" "$BACKUP_DIR/Archetypes"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/archetypes"
mkdir -p "$CLAUDE_DIR/skills/archetypes/Data"
mkdir -p "$CLAUDE_DIR/skills/archetypes/Schema"
mkdir -p "$CLAUDE_DIR/skills/archetypes/Tools"
mkdir -p "$CLAUDE_DIR/skills/archetypes/Workflows"
echo "Created Archetypes skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/CHANGELOG.md" "$CLAUDE_DIR/skills/archetypes/CHANGELOG.md"
cp "$PACK_DIR/src/Data/Media.archetype.ts" "$CLAUDE_DIR/skills/archetypes/Data/Media.archetype.ts"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/archetypes/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md" "$CLAUDE_DIR/skills/archetypes/SKILL.partials.md"
cp "$PACK_DIR/src/Schema/Archetype.ts" "$CLAUDE_DIR/skills/archetypes/Schema/Archetype.ts"
cp "$PACK_DIR/src/Tools/RenderArchetype.ts" "$CLAUDE_DIR/skills/archetypes/Tools/RenderArchetype.ts"
cp "$PACK_DIR/src/Tools/ValidateArchetype.ts" "$CLAUDE_DIR/skills/archetypes/Tools/ValidateArchetype.ts"
cp "$PACK_DIR/src/Workflows/AuditFeature.md" "$CLAUDE_DIR/skills/archetypes/Workflows/AuditFeature.md"
cp "$PACK_DIR/src/Workflows/AuthorArchetype.md" "$CLAUDE_DIR/skills/archetypes/Workflows/AuthorArchetype.md"
cp "$PACK_DIR/src/Workflows/SeedScope.md" "$CLAUDE_DIR/skills/archetypes/Workflows/SeedScope.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/archetypes/extension.yaml"

echo "Copied 11 Archetypes files"
```

### 4.3 Install Tool Dependencies

**Mark todo "Install tool dependencies" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/archetypes/Tools/package.json" ]; then
  cd "$CLAUDE_DIR/skills/archetypes/Tools" && bun install
  echo "Tool dependencies installed"
fi
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"Archetypes v1.0.0 installed successfully.

What's available:
- AuditFeature — see Workflows/AuditFeature.md for triggers
- AuthorArchetype — see Workflows/AuthorArchetype.md for triggers
- SeedScope — see Workflows/SeedScope.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Archetypes/"
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
- `src/Data/Media.archetype.ts`
- `src/SKILL.md`
- `src/SKILL.partials.md`
- `src/Schema/Archetype.ts`
- `src/Tools/RenderArchetype.ts`
- `src/Tools/ValidateArchetype.ts`
- `src/Workflows/AuditFeature.md`
- `src/Workflows/AuthorArchetype.md`
- `src/Workflows/SeedScope.md`
- `src/extension.yaml`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
