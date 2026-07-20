# Brand v2.0.0 - Installation Guide

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
"I'm installing Brand v2.0.0 — complete brand system with 7 sub-skills for Claude Code.

This pack adds:
- 7 sub-skills: Research, Strategy, Naming, Verbal, Visual, Implementation, Guidelines
- 27 workflows covering the full brand lifecycle
- 9-agent parallel brand research across 3 AI providers
- Three-layer token architecture (option/decision/component)
- Naming pipeline with npm/domain/trademark screening
- Voice and messaging frameworks (StoryBrand SB7, PAS, AIDA, JTBD)
- Visual identity: logo, icons, color, typography, illustration, motion
- Brand-to-code pipeline (theme.css, fonts.ts, motion-tokens.ts)
- Brand guidelines generation and consistency enforcement
- CinematicLanding handoff integration

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
SKILL_DIR="$CLAUDE_DIR/skills/Brand"

# Create directory structure for all 7 sub-skills
mkdir -p "$SKILL_DIR/Workflows"
for subskill in Research Strategy Naming Verbal Visual Implementation Guidelines; do
  mkdir -p "$SKILL_DIR/$subskill/Workflows"
done
mkdir -p "$SKILL_DIR/Naming/Tools"
mkdir -p "$SKILL_DIR/Visual/Tools"

# Copy parent SKILL.md
cp src/SKILL.md "$SKILL_DIR/"

# Copy cross-cutting Audit workflow
cp src/Workflows/Audit.md "$SKILL_DIR/Workflows/"

# Copy sub-skill SKILL.md files and workflows
for subskill in Research Strategy Naming Verbal Visual Implementation Guidelines; do
  cp "src/$subskill/SKILL.md" "$SKILL_DIR/$subskill/"
  cp src/$subskill/Workflows/*.md "$SKILL_DIR/$subskill/Workflows/" 2>/dev/null
  # Copy Tools if they exist
  if [ -d "src/$subskill/Tools" ] && ls src/$subskill/Tools/* 1>/dev/null 2>&1; then
    cp -r src/$subskill/Tools/* "$SKILL_DIR/$subskill/Tools/" 2>/dev/null
  fi
done
```

---

## Phase 3: Verify

Run the checks in `VERIFY.md` to confirm installation.
