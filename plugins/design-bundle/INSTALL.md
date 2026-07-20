# DesignBundle v1.0.0 — Installation Guide

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
"I'm installing DesignBundle v1.0.0 — Take a fresh dos-prisma-saas-kit fork from 'just cloned' to 'Claude Design System form-ready' in one pipeline — configures the fork (git remote swap + push + fork:init), mines context across DOS root + sibling SaaS + current fork + MEMORY in parallel, captures decisions with structured questions (scope / positioning / tagline / languages / deploy), assembles a curated bundle at <repo>/claude-design-system-bundle/ with FORM_FILL.

This pack installs 3 files across 1 directory.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/DesignBundle" ]; then
  echo "WARNING Existing design-bundle skill found at: $CLAUDE_DIR/skills/DesignBundle"
  ls -la "$CLAUDE_DIR/skills/design-bundle/" 2>/dev/null
else
  echo "OK No existing design-bundle skill (clean install)"
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
  "header": "Conflict — Existing DesignBundle Skill",
  "question": "An existing design-bundle skill was found. How should I proceed?",
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
  "question": "Ready to install DesignBundle v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/design-bundle/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/designbundle-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/DesignBundle" ] && cp -r "$CLAUDE_DIR/skills/DesignBundle" "$BACKUP_DIR/DesignBundle"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/DesignBundle"
mkdir -p "$CLAUDE_DIR/skills/design-bundle/Workflows"
echo "Created design-bundle skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/design-bundle/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md" "$CLAUDE_DIR/skills/design-bundle/SKILL.partials.md"
cp "$PACK_DIR/src/Workflows/RunPipeline.md" "$CLAUDE_DIR/skills/design-bundle/Workflows/RunPipeline.md"

echo "Copied 3 DesignBundle files"
```

### 4.3 Install Slash Command (`/design-bundle`)

The pack ships an operator-facing slash command wrapper at `commands/design-bundle.md`. Install it to the user's Claude Code commands directory so `/design-bundle` becomes available in any DOS-enabled session:

```bash
mkdir -p "$CLAUDE_DIR/commands"
cp "$PACK_DIR/commands/design-bundle.md" "$CLAUDE_DIR/commands/design-bundle.md"
echo "Installed /design-bundle slash command"
```

The command supports flags: `--quick / --launch-ready / --research-only / --copy-only / --validate / --skip-research`. Operator runs `/design-bundle` to invoke the full pipeline; flags short-circuit to common variants.

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"DesignBundle v1.0.0 installed successfully.

What's available:
- RunPipeline — see Workflows/RunPipeline.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DesignBundle/"
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
- `src/Workflows/RunPipeline.md`
- `src/extension.yaml` — RFC-0002 extension manifest
- `commands/design-bundle.md` — operator-facing slash command wrapper (installs to `~/.claude/commands/`)
- `plugin.json` — RFC-0011 §5.2 distribution manifest
- `README.md` — pack overview
- `VERIFY.md` — post-install validation
