# DreamTeam Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check DreamTeam files exist at target

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/DreamTeam"

echo "DreamTeam files:"
[ -f "$SKILL_DIR/SKILL.md" ] && echo "  OK SKILL.md" || echo "  MISSING SKILL.md"
[ -d "$SKILL_DIR/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -f "$SKILL_DIR/Workflows/SectionReview.md" ] && echo "  OK Workflows/SectionReview.md" || echo "  MISSING Workflows/SectionReview.md"
[ -f "$SKILL_DIR/Workflows/Review.md" ] && echo "  OK Workflows/Review.md" || echo "  MISSING Workflows/Review.md"
[ -f "$SKILL_DIR/Workflows/QuickReview.md" ] && echo "  OK Workflows/QuickReview.md" || echo "  MISSING Workflows/QuickReview.md"
[ -f "$SKILL_DIR/Workflows/Evolve.md" ] && echo "  OK Workflows/Evolve.md" || echo "  MISSING Workflows/Evolve.md"
[ -f "$SKILL_DIR/Workflows/Trim.md" ] && echo "  OK Workflows/Trim.md" || echo "  MISSING Workflows/Trim.md"
[ -f "$SKILL_DIR/Workflows/VisualBrief.md" ] && echo "  OK Workflows/VisualBrief.md" || echo "  MISSING Workflows/VisualBrief.md"
```

**Expected:** 1 skill file, 1 directory, and 6 workflow files present.

---

## Installation Checklist

```markdown
## DreamTeam Installation Verification

### Files
- [ ] SKILL.md installed
- [ ] Workflows/ directory created
- [ ] Workflows/SectionReview.md installed
- [ ] Workflows/Review.md installed
- [ ] Workflows/QuickReview.md installed
- [ ] Workflows/Evolve.md installed
- [ ] Workflows/Trim.md installed
- [ ] Workflows/VisualBrief.md installed

### Content Integrity
- [ ] SKILL.md has "Workflow Routing" section
- [ ] SKILL.md has "The 7 Roles" section
- [ ] SKILL.md has "Examples" section
- [ ] SectionReview.md has "Component Upgrade Path" pattern
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "dream-team pack installation verified successfully"
2. **Note:** "Use 'dream team review' or 'review this section' to invoke the expert council."
