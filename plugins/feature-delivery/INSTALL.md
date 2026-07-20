# FeatureDelivery v1.0.0 - Installation Guide

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
"I'm installing FeatureDelivery v1.0.0 — interactive feature delivery pipeline for Claude Code.

This pack adds:
- 3-tier complexity classification (simple/medium/complex)
- Structured implementation specs
- Council decision gates with multi-agent debate
- 10-point code review checklist
- Ship automation (commit, push, PR)

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

# Check for existing feature-delivery skill
if [ -d "$CLAUDE_DIR/skills/FeatureDelivery" ]; then
  echo "WARNING Existing feature-delivery skill found at: $CLAUDE_DIR/skills/FeatureDelivery"
  ls -la "$CLAUDE_DIR/skills/feature-delivery/" 2>/dev/null
else
  echo "OK No existing feature-delivery skill (clean install)"
fi

# Check for git
if command -v git &>/dev/null; then
  echo "OK git found: $(git --version)"
else
  echo "ERROR git not found (required for ship workflow)"
fi

# Check for gh CLI
if command -v gh &>/dev/null; then
  echo "OK gh CLI found: $(gh --version | head -1)"
else
  echo "WARNING gh CLI not found (required for PR creation in ship workflow)"
fi
```

---

## Phase 2: Install Files

### 2.1 Copy Skill Files

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/FeatureDelivery"

# Create directory structure
mkdir -p "$SKILL_DIR/Workflows"

# Copy skill definition
cp src/SKILL.md "$SKILL_DIR/"

# Copy workflows
cp src/Workflows/Classify.md "$SKILL_DIR/Workflows/"
cp src/Workflows/Spec.md "$SKILL_DIR/Workflows/"
cp src/Workflows/CouncilGate.md "$SKILL_DIR/Workflows/"
cp src/Workflows/Review.md "$SKILL_DIR/Workflows/"
cp src/Workflows/Ship.md "$SKILL_DIR/Workflows/"
```

---

## Phase 3: Verify

Run the checks in `VERIFY.md` to confirm installation.
