# StartupInvestorDocs v1.0.0 - Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** - For user decisions and confirmations
2. **Bash/Read/Write** - For actual installation
3. **VERIFY.md** - For final validation

### Welcome Message

Before starting, greet the user:
```
"I'm installing StartupInvestorDocs v1.0.0 — investor documentation suite for startups at any funding stage.

This pack adds:
- Complete investor doc generation (pitch deck, exec summary, financials, market analysis, team overview)
- Investor readiness scanning and scoring
- Gap analysis with prioritized fix recommendations
- Market and competitive research for investor materials
- Document enhancement with VC-perspective review
- Single document generation

Let me set this up."
```

---

## Phase 1: System Analysis

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
```

---

## Phase 2: Install Files

### 2.1 Copy Skill Files

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/StartupInvestorDocs"

# Create directory structure
mkdir -p "$SKILL_DIR/Workflows"

# Copy skill definition
cp src/SKILL.md "$SKILL_DIR/"

# Copy workflows
cp src/Workflows/Generate.md "$SKILL_DIR/Workflows/"
cp src/Workflows/Scan.md "$SKILL_DIR/Workflows/"
cp src/Workflows/GapAnalysis.md "$SKILL_DIR/Workflows/"
cp src/Workflows/Research.md "$SKILL_DIR/Workflows/"
cp src/Workflows/Enhance.md "$SKILL_DIR/Workflows/"
cp src/Workflows/SingleDoc.md "$SKILL_DIR/Workflows/"
```

---

## Phase 3: Verify

Run the checks in `VERIFY.md` to confirm installation.
