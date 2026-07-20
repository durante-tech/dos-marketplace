# ChiefOfStaff v0.0.1 — Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** — For user decisions and confirmations
2. **TodoWrite** — For progress tracking
3. **Bash / Read / Write** — For actual installation
4. **VERIFY.md** — For final validation

### Welcome Message

Before starting, greet the user:

```
"I'm installing ChiefOfStaff v0.0.1 — a local-first chief of staff for Claude Code.

This pack adds the chief-of-staff skill with:
- 4 workflows: Triage (inbox), Brief (meeting prep), Followup (commitments), Morning (daily brief)
- 2 living artifact templates: principal.md (voice + Tier-1 contacts) and rules.md (Processing Rules canon)
- 100% local-first — no cloud, no telemetry
- Optional delegation to Research and Investigation skills

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
# Check for Claude Code skills directory
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

# Check if skills directory exists
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check for existing chief-of-staff skill
if [ -d "$CLAUDE_DIR/skills/ChiefOfStaff" ]; then
  echo "WARNING Existing chief-of-staff skill found at: $CLAUDE_DIR/skills/ChiefOfStaff"
  ls -la "$CLAUDE_DIR/skills/chief-of-staff/" 2>/dev/null
else
  echo "OK No existing chief-of-staff skill (clean install)"
fi

# Check for Workflows subdirectory
if [ -d "$CLAUDE_DIR/skills/chief-of-staff/Workflows" ]; then
  echo "WARNING Existing Workflows directory found"
  ls -1 "$CLAUDE_DIR/skills/chief-of-staff/Workflows/"*.md 2>/dev/null | wc -l | tr -d ' '
else
  echo "OK No existing Workflows directory"
fi

# Check for Templates subdirectory
if [ -d "$CLAUDE_DIR/skills/chief-of-staff/Templates" ]; then
  echo "WARNING Existing Templates directory found"
else
  echo "OK No existing Templates directory"
fi

# Check for existing user artifacts (principal.md + rules.md)
USER_DIR="$CLAUDE_DIR/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff"
if [ -d "$USER_DIR" ]; then
  echo "INFO User customization directory exists at: $USER_DIR"
  [ -f "$USER_DIR/principal.md" ] && echo "  Existing principal.md (will NOT overwrite)"
  [ -f "$USER_DIR/rules.md" ] && echo "  Existing rules.md (will NOT overwrite)"
else
  echo "INFO User customization directory does not exist (will be created)"
fi

# Check for optional delegated skills
if [ -d "$CLAUDE_DIR/skills/Research" ]; then
  echo "OK research skill installed (Brief workflow will use it for attendee enrichment)"
else
  echo "INFO research skill not installed (Brief workflow will skip enrichment)"
fi

if [ -d "$CLAUDE_DIR/skills/Investigation" ]; then
  echo "OK investigation skill installed (Brief workflow can escalate to it for Tier-1 due diligence)"
else
  echo "INFO investigation skill not installed (Brief workflow will skip deep due diligence)"
fi
```

### 1.2 Present Findings

Tell the user what you found:

```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing chief-of-staff skill: [found -- will ask about conflict / not found]
- User customization directory: [exists / will be created]
- Existing principal.md / rules.md: [found -- will preserve / not found]
- research skill (optional, for attendee enrichment): [found / not found]
- investigation skill (optional, for Tier-1 due diligence): [found / not found]

[If neither Research nor Investigation is installed]: Note: ChiefOfStaff is self-contained and
works without these. Installing them later will automatically enable first-time attendee
enrichment in the Brief workflow.

The user's own principal.md and rules.md will NOT be overwritten if they already exist — only
the Pack-level skill files are installed. You will always own your own principal profile
and rules canon."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing chief-of-staff skill detected:**

```json
{
  "header": "Conflict -- Existing ChiefOfStaff Skill",
  "question": "An existing chief-of-staff skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install ChiefOfStaff v0.0.1?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/chief-of-staff/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**

```
"Directories to be created:
- ~/.claude/skills/chief-of-staff/
- ~/.claude/skills/chief-of-staff/Workflows/ (4 workflow files)
- ~/.claude/skills/chief-of-staff/Templates/ (2 template files)

Files to be created in the skill directory:
- ~/.claude/skills/chief-of-staff/SKILL.md
- ~/.claude/skills/chief-of-staff/Workflows/Triage.md
- ~/.claude/skills/chief-of-staff/Workflows/Brief.md
- ~/.claude/skills/chief-of-staff/Workflows/Followup.md
- ~/.claude/skills/chief-of-staff/Workflows/Morning.md
- ~/.claude/skills/chief-of-staff/Templates/principal.md
- ~/.claude/skills/chief-of-staff/Templates/rules.md

User-owned files (created ONLY if they don't already exist):
- ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md (seeded from template)
- ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/rules.md (seeded from template)

No other files will be modified. No hooks, no configuration changes."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/chiefofstaff-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -d "$CLAUDE_DIR/skills/ChiefOfStaff" ]; then
  cp -R "$CLAUDE_DIR/skills/ChiefOfStaff" "$BACKUP_DIR/ChiefOfStaff"
  echo "Backed up chief-of-staff skill to: $BACKUP_DIR/ChiefOfStaff"
fi

echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

**Create a TodoWrite list to track progress:**

```json
{
  "todos": [
    {"content": "Create skill directory structure", "status": "pending", "activeForm": "Creating directories"},
    {"content": "Copy skill files", "status": "pending", "activeForm": "Copying files"},
    {"content": "Seed user artifact files if missing", "status": "pending", "activeForm": "Seeding user files"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/chief-of-staff/Workflows"
mkdir -p "$CLAUDE_DIR/skills/chief-of-staff/Templates"
mkdir -p "$CLAUDE_DIR/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff"
echo "Directory structure created"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy top-level skill file
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/chief-of-staff/SKILL.md"

# Copy all workflows
cp "$PACK_DIR/src/Workflows/"*.md "$CLAUDE_DIR/skills/chief-of-staff/Workflows/"

# Copy all templates
cp "$PACK_DIR/src/Templates/"*.md "$CLAUDE_DIR/skills/chief-of-staff/Templates/"

echo "All skill files copied"
```

**Mark todo as completed.**

### 4.3 Seed User Artifact Files (ONLY IF MISSING)

**Mark todo "Seed user artifact files if missing" as in_progress.**

**CRITICAL: Never overwrite existing user principal.md or rules.md.** These files belong to the user and contain their personal content. Use `cp -n` (no-clobber) to seed without a TOCTOU race.

```bash
USER_DIR="$HOME/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff"
TEMPLATES_DIR="$HOME/.claude/skills/chief-of-staff/Templates"

cp -n "$TEMPLATES_DIR/principal.md" "$USER_DIR/principal.md" && echo "Seeded principal.md" || echo "principal.md preserved"
cp -n "$TEMPLATES_DIR/rules.md"     "$USER_DIR/rules.md"     && echo "Seeded rules.md"     || echo "rules.md preserved"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md.** On success, mark todo as completed.

---

## Success / Failure Messages

### On Success

```
"ChiefOfStaff v0.0.1 installed successfully!

What's available:
- 4 workflows: Triage / Brief / Followup / Morning
- 2 seeded artifact files at ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/

Next step — fill in your principal.md:
1. Open ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md
2. Add 3–5 voice samples from your sent folder
3. Add your Tier-1 contacts with relationship context
4. Set your sign-off preference, emoji tolerance, and bad-news register
5. Save the file

Then try it:
- 'morning brief' -- compose today's daily brief (will note missing fields if any)
- 'triage my inbox' -- paste messages to classify
- 'brief me on {name}' -- generate a pre-meeting dossier

All storage is local. Nothing sends without your approval."
```

### On Failure

```
"Installation encountered issues. Here's what to check:

1. Ensure ~/.claude/ directory exists (created by Claude Code)
2. Check write permissions on ~/.claude/skills/
3. Run the verification commands in VERIFY.md

Need help? Open an issue at https://github.com/durante-tech/dos/issues"
```

---

## Troubleshooting

See the Troubleshooting section of `README.md` — installer issues are the same as runtime issues for a skill this simple.
