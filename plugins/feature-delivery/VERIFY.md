# FeatureDelivery Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check skill files exist at target

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/FeatureDelivery"

echo "FeatureDelivery files:"
[ -f "$SKILL_DIR/SKILL.md" ] && echo "  OK SKILL.md" || echo "  MISSING SKILL.md"
[ -d "$SKILL_DIR/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -f "$SKILL_DIR/Workflows/Classify.md" ] && echo "  OK Workflows/Classify.md" || echo "  MISSING Workflows/Classify.md"
[ -f "$SKILL_DIR/Workflows/Spec.md" ] && echo "  OK Workflows/Spec.md" || echo "  MISSING Workflows/Spec.md"
[ -f "$SKILL_DIR/Workflows/CouncilGate.md" ] && echo "  OK Workflows/CouncilGate.md" || echo "  MISSING Workflows/CouncilGate.md"
[ -f "$SKILL_DIR/Workflows/Review.md" ] && echo "  OK Workflows/Review.md" || echo "  MISSING Workflows/Review.md"
[ -f "$SKILL_DIR/Workflows/Ship.md" ] && echo "  OK Workflows/Ship.md" || echo "  MISSING Workflows/Ship.md"
```

**Expected:** 1 SKILL.md + 1 directory + 5 workflow files.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/FeatureDelivery"

head -1 "$SKILL_DIR/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has valid frontmatter" || echo "ERROR SKILL.md missing frontmatter"
grep -q "^name:" "$SKILL_DIR/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
grep -q "^description:" "$SKILL_DIR/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description field"
```

**Expected:** Valid YAML frontmatter with name and description fields.

---

## Dependency Checks (Informational)

```bash
echo "Dependencies:"

# git
if command -v git &>/dev/null; then
  echo "  AVAILABLE git $(git --version | head -1)"
else
  echo "  UNAVAILABLE git (required for ship workflow)"
fi

# gh CLI
if command -v gh &>/dev/null; then
  echo "  AVAILABLE gh $(gh --version | head -1)"
else
  echo "  UNAVAILABLE gh CLI (install: https://cli.github.com/ -- required for PR creation)"
fi
```

---

## Installation Checklist

```markdown
## FeatureDelivery Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/feature-delivery/SKILL.md
- [ ] Workflows/ directory created
- [ ] Workflows/Classify.md installed
- [ ] Workflows/Spec.md installed
- [ ] Workflows/CouncilGate.md installed
- [ ] Workflows/Review.md installed
- [ ] Workflows/Ship.md installed

### Content Integrity
- [ ] SKILL.md has "Workflow Routing" section
- [ ] SKILL.md has "Tier Behavior" section
- [ ] SKILL.md has "Examples" section
- [ ] SKILL.md frontmatter has name and description (with USE WHEN)

### Dependencies
- [ ] git available
- [ ] gh CLI available
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "feature-delivery pack installation verified successfully"
2. **Recommend:** "Try it now: ask to build a feature, classify a feature, or ship your changes"
3. **Note:** "Requires git and gh CLI for full pipeline functionality"
