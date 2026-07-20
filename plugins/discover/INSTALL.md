# Discover v1.0.0 — Installation Guide

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
"I'm installing Discover v1.0.0 — Interview unwritten feature intent into a forge-ready discovery folder.

This pack installs 31 files across 1 directory.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/Discover" ]; then
  echo "WARNING Existing discover skill found at: $CLAUDE_DIR/skills/Discover"
  ls -la "$CLAUDE_DIR/skills/discover/" 2>/dev/null
else
  echo "OK No existing discover skill (clean install)"
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
  "header": "Conflict — Existing Discover Skill",
  "question": "An existing discover skill was found. How should I proceed?",
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
  "question": "Ready to install Discover v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/discover/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/discover-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/Discover" ] && cp -r "$CLAUDE_DIR/skills/Discover" "$BACKUP_DIR/Discover"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/Discover"
mkdir -p "$CLAUDE_DIR/skills/discover/Tools"
echo "Created discover skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/discover/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md" "$CLAUDE_DIR/skills/discover/SKILL.partials.md"
cp "$PACK_DIR/src/Tools/__fixtures__/bare/.gitkeep" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/bare/.gitkeep"
cp "$PACK_DIR/src/Tools/__fixtures__/established/.claude/kit-conventions.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/established/.claude/kit-conventions.md"
cp "$PACK_DIR/src/Tools/__fixtures__/established/.fork-slot" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/established/.fork-slot"
cp "$PACK_DIR/src/Tools/__fixtures__/established/AGENTS.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/established/AGENTS.md"
cp "$PACK_DIR/src/Tools/__fixtures__/established/MEMORY/WORK/20260101-000000_seed/PRD.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/established/MEMORY/WORK/20260101-000000_seed/PRD.md"
cp "$PACK_DIR/src/Tools/__fixtures__/fresh/.claude/kit-conventions.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/fresh/.claude/kit-conventions.md"
cp "$PACK_DIR/src/Tools/__fixtures__/fresh/.fork-slot" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/fresh/.fork-slot"
cp "$PACK_DIR/src/Tools/__fixtures__/fresh/AGENTS.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/fresh/AGENTS.md"
cp "$PACK_DIR/src/Tools/__fixtures__/golden/20260101-000000_example-feature/brief.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/brief.md"
cp "$PACK_DIR/src/Tools/__fixtures__/golden/20260101-000000_example-feature/build-order.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/build-order.md"
cp "$PACK_DIR/src/Tools/__fixtures__/golden/20260101-000000_example-feature/capability-selection.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/capability-selection.md"
cp "$PACK_DIR/src/Tools/__fixtures__/golden/20260101-000000_example-feature/locked-decisions.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/locked-decisions.md"
cp "$PACK_DIR/src/Tools/__fixtures__/golden/20260101-000000_example-feature/task-string.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/task-string.md"
cp "$PACK_DIR/src/Tools/__fixtures__/kit-divergent/.claude/kit-conventions.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/kit-divergent/.claude/kit-conventions.md"
cp "$PACK_DIR/src/Tools/__fixtures__/missing-conventions/.fork-slot" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/missing-conventions/.fork-slot"
cp "$PACK_DIR/src/Tools/__fixtures__/missing-conventions/AGENTS.md" "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/missing-conventions/AGENTS.md"
cp "$PACK_DIR/src/Tools/emit.test.ts" "$CLAUDE_DIR/skills/discover/Tools/emit.test.ts"
cp "$PACK_DIR/src/Tools/emit.ts" "$CLAUDE_DIR/skills/discover/Tools/emit.ts"
cp "$PACK_DIR/src/Tools/golden.test.ts" "$CLAUDE_DIR/skills/discover/Tools/golden.test.ts"
cp "$PACK_DIR/src/Tools/ground.test.ts" "$CLAUDE_DIR/skills/discover/Tools/ground.test.ts"
cp "$PACK_DIR/src/Tools/ground.ts" "$CLAUDE_DIR/skills/discover/Tools/ground.ts"
cp "$PACK_DIR/src/Tools/intel.test.ts" "$CLAUDE_DIR/skills/discover/Tools/intel.test.ts"
cp "$PACK_DIR/src/Tools/intel.ts" "$CLAUDE_DIR/skills/discover/Tools/intel.ts"
cp "$PACK_DIR/src/Tools/interview.test.ts" "$CLAUDE_DIR/skills/discover/Tools/interview.test.ts"
cp "$PACK_DIR/src/Tools/interview.ts" "$CLAUDE_DIR/skills/discover/Tools/interview.ts"
cp "$PACK_DIR/src/Tools/seam-guard-parity.test.ts" "$CLAUDE_DIR/skills/discover/Tools/seam-guard-parity.test.ts"
cp "$PACK_DIR/src/Tools/task-string-validator.test.ts" "$CLAUDE_DIR/skills/discover/Tools/task-string-validator.test.ts"
cp "$PACK_DIR/src/Tools/task-string-validator.ts" "$CLAUDE_DIR/skills/discover/Tools/task-string-validator.ts"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/discover/extension.yaml"

echo "Copied 31 Discover files"
```

### 4.3 Install Tool Dependencies

**Mark todo "Install tool dependencies" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/discover/Tools/package.json" ]; then
  cd "$CLAUDE_DIR/skills/discover/Tools" && bun install
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
"Discover v1.0.0 installed successfully.

What's available:
- See SKILL.md for available capabilities.

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Discover/"
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
- `src/Tools/__fixtures__/bare/.gitkeep`
- `src/Tools/__fixtures__/established/.claude/kit-conventions.md`
- `src/Tools/__fixtures__/established/.fork-slot`
- `src/Tools/__fixtures__/established/AGENTS.md`
- `src/Tools/__fixtures__/established/MEMORY/WORK/20260101-000000_seed/PRD.md`
- `src/Tools/__fixtures__/fresh/.claude/kit-conventions.md`
- `src/Tools/__fixtures__/fresh/.fork-slot`
- `src/Tools/__fixtures__/fresh/AGENTS.md`
- `src/Tools/__fixtures__/golden/20260101-000000_example-feature/brief.md`
- `src/Tools/__fixtures__/golden/20260101-000000_example-feature/build-order.md`
- `src/Tools/__fixtures__/golden/20260101-000000_example-feature/capability-selection.md`
- `src/Tools/__fixtures__/golden/20260101-000000_example-feature/locked-decisions.md`
- `src/Tools/__fixtures__/golden/20260101-000000_example-feature/task-string.md`
- `src/Tools/__fixtures__/kit-divergent/.claude/kit-conventions.md`
- `src/Tools/__fixtures__/missing-conventions/.fork-slot`
- `src/Tools/__fixtures__/missing-conventions/AGENTS.md`
- `src/Tools/emit.test.ts`
- `src/Tools/emit.ts`
- `src/Tools/golden.test.ts`
- `src/Tools/ground.test.ts`
- `src/Tools/ground.ts`
- `src/Tools/intel.test.ts`
- `src/Tools/intel.ts`
- `src/Tools/interview.test.ts`
- `src/Tools/interview.ts`
- `src/Tools/seam-guard-parity.test.ts`
- `src/Tools/task-string-validator.test.ts`
- `src/Tools/task-string-validator.ts`
- `src/extension.yaml`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
