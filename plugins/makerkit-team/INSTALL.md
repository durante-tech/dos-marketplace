# MakerkitTeam v1.0.0 — Installation Guide

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
"I'm installing MakerkitTeam v1.0.0 — Orchestrates a 13-agent delivery team (PM, SM, UX, UI, Architect, Frontend, Backend, DB, Security, QA, E2E, DevOps, Writer) for the dos-prisma-saas-kit Makerkit framework.

This pack installs 20 files across 3 directories.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/MakerkitTeam" ]; then
  echo "WARNING Existing makerkit-team skill found at: $CLAUDE_DIR/skills/MakerkitTeam"
  ls -la "$CLAUDE_DIR/skills/makerkit-team/" 2>/dev/null
else
  echo "OK No existing makerkit-team skill (clean install)"
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
  "header": "Conflict — Existing MakerkitTeam Skill",
  "question": "An existing makerkit-team skill was found. How should I proceed?",
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
  "question": "Ready to install MakerkitTeam v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/makerkit-team/"},
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
BACKUP_DIR="$CLAUDE_DIR/Backups/makerkitteam-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/MakerkitTeam" ] && cp -r "$CLAUDE_DIR/skills/MakerkitTeam" "$BACKUP_DIR/MakerkitTeam"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/MakerkitTeam"
mkdir -p "$CLAUDE_DIR/skills/makerkit-team/Data"
mkdir -p "$CLAUDE_DIR/skills/makerkit-team/Tools"
mkdir -p "$CLAUDE_DIR/skills/makerkit-team/Workflows"
echo "Created makerkit-team skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

cp "$PACK_DIR/src/CHANGELOG.md" "$CLAUDE_DIR/skills/makerkit-team/CHANGELOG.md"
cp "$PACK_DIR/src/Data/McpToolMap.json" "$CLAUDE_DIR/skills/makerkit-team/Data/McpToolMap.json"
cp "$PACK_DIR/src/Data/Roster.json" "$CLAUDE_DIR/skills/makerkit-team/Data/Roster.json"
cp "$PACK_DIR/src/FrameworkDigest.md" "$CLAUDE_DIR/skills/makerkit-team/FrameworkDigest.md"
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/makerkit-team/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md" "$CLAUDE_DIR/skills/makerkit-team/SKILL.partials.md"
cp "$PACK_DIR/src/Tools/BuildBrief.ts" "$CLAUDE_DIR/skills/makerkit-team/Tools/BuildBrief.ts"
cp "$PACK_DIR/src/Tools/InvokeAgent.ts" "$CLAUDE_DIR/skills/makerkit-team/Tools/InvokeAgent.ts"
cp "$PACK_DIR/src/Workflows/BugFix.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/BugFix.md"
cp "$PACK_DIR/src/Workflows/CodeReview.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/CodeReview.md"
cp "$PACK_DIR/src/Workflows/DeliverFeature.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/DeliverFeature.md"
cp "$PACK_DIR/src/Workflows/DesignReview.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/DesignReview.md"
cp "$PACK_DIR/src/Workflows/DocsRefresh.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/DocsRefresh.md"
cp "$PACK_DIR/src/Workflows/ExploreFeature.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/ExploreFeature.md"
cp "$PACK_DIR/src/Workflows/QuickFix.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/QuickFix.md"
cp "$PACK_DIR/src/Workflows/Refactor.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/Refactor.md"
cp "$PACK_DIR/src/Workflows/SecurityAudit.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/SecurityAudit.md"
cp "$PACK_DIR/src/Workflows/ShowRoster.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/ShowRoster.md"
cp "$PACK_DIR/src/Workflows/TestAndValidate.md" "$CLAUDE_DIR/skills/makerkit-team/Workflows/TestAndValidate.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/makerkit-team/extension.yaml"

echo "Copied 20 MakerkitTeam files"
```

### 4.3 Install Tool Dependencies

**Mark todo "Install tool dependencies" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/makerkit-team/Tools/package.json" ]; then
  cd "$CLAUDE_DIR/skills/makerkit-team/Tools" && bun install
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
"MakerkitTeam v1.0.0 installed successfully.

What's available:
- BugFix — see Workflows/BugFix.md for triggers
- CodeReview — see Workflows/CodeReview.md for triggers
- DeliverFeature — see Workflows/DeliverFeature.md for triggers
- DesignReview — see Workflows/DesignReview.md for triggers
- DocsRefresh — see Workflows/DocsRefresh.md for triggers
- ExploreFeature — see Workflows/ExploreFeature.md for triggers
- QuickFix — see Workflows/QuickFix.md for triggers
- Refactor — see Workflows/Refactor.md for triggers
- SecurityAudit — see Workflows/SecurityAudit.md for triggers
- ShowRoster — see Workflows/ShowRoster.md for triggers
- TestAndValidate — see Workflows/TestAndValidate.md for triggers

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/MakerkitTeam/"
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
- `src/Data/McpToolMap.json`
- `src/Data/Roster.json`
- `src/FrameworkDigest.md`
- `src/SKILL.md`
- `src/SKILL.partials.md`
- `src/Tools/BuildBrief.ts`
- `src/Tools/InvokeAgent.ts`
- `src/Workflows/BugFix.md`
- `src/Workflows/CodeReview.md`
- `src/Workflows/DeliverFeature.md`
- `src/Workflows/DesignReview.md`
- `src/Workflows/DocsRefresh.md`
- `src/Workflows/ExploreFeature.md`
- `src/Workflows/QuickFix.md`
- `src/Workflows/Refactor.md`
- `src/Workflows/SecurityAudit.md`
- `src/Workflows/ShowRoster.md`
- `src/Workflows/TestAndValidate.md`
- `src/extension.yaml`
- `plugin.json` — RFC-0011 §5.2 distribution manifest
