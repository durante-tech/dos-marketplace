# ContentAnalysis v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **TodoWrite** - For progress tracking
3. **Bash/Read/Write** - For actual installation
4. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing ContentAnalysis v1.0.0 -- content-adaptive wisdom extraction from videos, podcasts, articles, and YouTube.

This pack installs the content-analysis skill, which includes:
- Dynamic section detection based on content
- Five depth levels (Instant through Comprehensive)
- ExtractWisdom sub-skill with conversational voice standards

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

# Check if content-analysis skill directory exists
if [ -d "$CLAUDE_DIR/skills/ContentAnalysis" ]; then
  echo "WARNING Existing content-analysis skill found at: $CLAUDE_DIR/skills/ContentAnalysis"
  ls -la "$CLAUDE_DIR/skills/content-analysis/" 2>/dev/null
else
  echo "OK No existing content-analysis skill (clean install)"
fi

# Check for skills directory
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

# Check for ExtractWisdom subdirectory specifically
if [ -d "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom" ]; then
  echo "WARNING Existing ExtractWisdom sub-skill found"
  ls -la "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom/" 2>/dev/null
else
  echo "OK No existing ExtractWisdom sub-skill"
fi

# Check for user customization directory
if [ -d "$CLAUDE_DIR/DOS/USER/SKILLCUSTOMIZATIONS/ExtractWisdom" ]; then
  echo "OK User customizations found (will be preserved)"
  ls -la "$CLAUDE_DIR/DOS/USER/SKILLCUSTOMIZATIONS/ExtractWisdom/" 2>/dev/null
else
  echo "INFO No user customizations found (none to preserve)"
fi

# Check for DOS writing style (enhances extraction tone)
if [ -f "$CLAUDE_DIR/DOS/USER/WRITINGSTYLE.md" ]; then
  echo "OK Writing style definition found (extraction voice will be calibrated)"
else
  echo "INFO No writing style found (skill uses built-in voice standards)"
fi
```

### 1.2 Present Findings

Tell the user what you found:
```
"Here's what I found on your system:
- Skills directory: [exists / will be created]
- Existing content-analysis skill: [found -- will ask about conflict / not found]
- User customizations: [found (will be preserved) / not found]
- Writing style: [found (voice calibration available) / not found (built-in voice)]

[If writing style not found]: Note: The content-analysis skill can calibrate its
extraction voice from a DOS writing style definition. Without one, it uses
built-in conversational voice standards which work well out of the box."
```

---

## Phase 2: User Questions

**Use AskUserQuestion tool at each decision point.**

### Question 1: Conflict Resolution (if existing skill found)

**Only ask if existing content-analysis skill detected:**

```json
{
  "header": "Conflict -- Existing ContentAnalysis Skill",
  "question": "An existing content-analysis skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup of existing skill directory, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill directory without backup"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install ContentAnalysis v1.0.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/content-analysis/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

**If user chose "Show me what will change":**
```
"Files and directories to be created:
- ~/.claude/skills/content-analysis/SKILL.md (skill definition and routing)
- ~/.claude/skills/content-analysis/ExtractWisdom/SKILL.md (extraction methodology and rules)
- ~/.claude/skills/content-analysis/ExtractWisdom/Workflows/Extract.md (extraction workflow)

No other files will be modified. User customizations at
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ExtractWisdom/ are never touched."
```

Then re-ask the final confirmation question.

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/contentanalysis-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup existing skill directory
if [ -d "$CLAUDE_DIR/skills/ContentAnalysis" ]; then
  cp -r "$CLAUDE_DIR/skills/ContentAnalysis" "$BACKUP_DIR/ContentAnalysis"
  echo "Backed up content-analysis skill to: $BACKUP_DIR/ContentAnalysis"
fi

echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

**Create a TodoWrite list to track progress:**

```json
{
  "todos": [
    {"content": "Create skill directory structure", "status": "pending", "activeForm": "Creating skill directories"},
    {"content": "Copy skill files", "status": "pending", "activeForm": "Copying skill files"},
    {"content": "Run verification", "status": "pending", "activeForm": "Running verification"}
  ]
}
```

### 4.1 Create Skill Directory Structure

**Mark todo "Create skill directory structure" as in_progress.**

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/ContentAnalysis"
mkdir -p "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom"
mkdir -p "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom/Workflows"
echo "Created content-analysis skill directory structure"
```

**Mark todo as completed.**

### 4.2 Copy Skill Files

**Mark todo "Copy skill files" as in_progress.**

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"

# Copy all files from src/ to skill directory
cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/content-analysis/SKILL.md"
cp "$PACK_DIR/src/ExtractWisdom/SKILL.md" "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom/SKILL.md"
cp "$PACK_DIR/src/ExtractWisdom/Workflows/Extract.md" "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom/Workflows/Extract.md"

echo "Copied all content-analysis skill files"
```

**Mark todo as completed.**

---

## Phase 5: Verification

**Mark todo "Run verification" as in_progress.**

**Execute all checks from VERIFY.md:**

```bash
CLAUDE_DIR="$HOME/.claude"

echo "=== ContentAnalysis Skill Verification ==="

# Check SKILL.md exists
echo "Checking skill definition..."
[ -f "$CLAUDE_DIR/skills/content-analysis/SKILL.md" ] && echo "OK SKILL.md installed" || echo "ERROR SKILL.md missing"

# Check directories exist
echo "Checking directories..."
[ -d "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom" ] && echo "OK ExtractWisdom/ directory exists" || echo "ERROR ExtractWisdom/ missing"
[ -d "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom/Workflows" ] && echo "OK ExtractWisdom/Workflows/ directory exists" || echo "ERROR ExtractWisdom/Workflows/ missing"

# Check sub-skill files
echo "Checking sub-skill files..."
[ -f "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom/SKILL.md" ] && echo "OK ExtractWisdom SKILL.md installed" || echo "ERROR ExtractWisdom SKILL.md missing"
[ -f "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom/Workflows/Extract.md" ] && echo "OK Extract workflow installed" || echo "ERROR Extract workflow missing"

# Check frontmatter
echo "Checking frontmatter..."
head -1 "$CLAUDE_DIR/skills/content-analysis/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"
head -1 "$CLAUDE_DIR/skills/content-analysis/ExtractWisdom/SKILL.md" | grep -q "^---" && echo "OK ExtractWisdom SKILL.md has valid frontmatter" || echo "ERROR ExtractWisdom SKILL.md missing frontmatter"

# Informational checks
echo ""
echo "Enhancement availability (informational):"
[ -f "$CLAUDE_DIR/DOS/USER/WRITINGSTYLE.md" ] && echo "  AVAILABLE Writing style (voice calibration)" || echo "  INFO No writing style (uses built-in voice standards)"
[ -d "$CLAUDE_DIR/DOS/USER/SKILLCUSTOMIZATIONS/ExtractWisdom" ] && echo "  AVAILABLE User customizations" || echo "  INFO No user customizations (optional)"

echo ""
echo "=== Verification Complete ==="
```

**Mark todo as completed when all file checks pass.**

---

## Success/Failure Messages

### On Success

```
"ContentAnalysis v1.0.0 installed successfully!

What's available:
- Dynamic wisdom extraction from any content (videos, podcasts, articles)
- Five depth levels: Instant, Fast, Basic, Full, Comprehensive
- Conversational voice that reads like someone telling you about it

Try it now:
- 'extract wisdom from [YouTube URL]'
- 'extract wisdom (fast) from this article'
- 'analyze this podcast at comprehensive level'

Customization: Add preferences at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ExtractWisdom/"
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

### Extraction produces static sections instead of dynamic ones

Ensure the ExtractWisdom sub-skill SKILL.md was properly installed. Check:
```bash
cat ~/.claude/skills/content-analysis/ExtractWisdom/SKILL.md | head -5
```

The file should contain the dynamic section methodology, not a static template.

### Voice sounds too formal or compressed

The extraction voice calibrates from `~/.claude/DOS/USER/WRITINGSTYLE.md` if present. Without it, the skill uses built-in Level 3 conversational standards. If output feels too formal, check that the ExtractWisdom SKILL.md's tone rules section is intact.

### YouTube URLs not working

The skill itself does not fetch YouTube content -- it relies on the AI's ability to access content through available tools (browser, transcript fetching, etc.). Ensure you have web access tools available in your Claude Code configuration.

---

## What's Included

| File | Purpose |
|------|---------|
| `src/SKILL.md` | Top-level skill definition and workflow routing |
| `src/ExtractWisdom/SKILL.md` | Complete extraction methodology, tone rules, depth levels, quality standards |
| `src/ExtractWisdom/Workflows/Extract.md` | Step-by-step extraction workflow |
