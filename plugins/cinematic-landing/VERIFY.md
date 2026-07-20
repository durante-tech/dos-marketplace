# CinematicLanding Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check CinematicLanding files exist at target

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/CinematicLanding"

echo "CinematicLanding files:"
[ -f "$SKILL_DIR/SKILL.md" ] && echo "  OK SKILL.md" || echo "  MISSING SKILL.md"
[ -d "$SKILL_DIR/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -f "$SKILL_DIR/Workflows/Audit.md" ] && echo "  OK Workflows/Audit.md" || echo "  MISSING Workflows/Audit.md"
[ -f "$SKILL_DIR/Workflows/CreatePrd.md" ] && echo "  OK Workflows/CreatePrd.md" || echo "  MISSING Workflows/CreatePrd.md"
[ -f "$SKILL_DIR/Workflows/DeliverTier.md" ] && echo "  OK Workflows/DeliverTier.md" || echo "  MISSING Workflows/DeliverTier.md"
[ -f "$SKILL_DIR/Workflows/FixOverlap.md" ] && echo "  OK Workflows/FixOverlap.md" || echo "  MISSING Workflows/FixOverlap.md"
```

**Expected:** 1 skill file, 1 directory, and 4 workflow files present.

---

## Installation Checklist

```markdown
## CinematicLanding Installation Verification

### Files
- [ ] SKILL.md installed
- [ ] Workflows/ directory created
- [ ] Workflows/Audit.md installed
- [ ] Workflows/CreatePrd.md installed
- [ ] Workflows/DeliverTier.md installed
- [ ] Workflows/FixOverlap.md installed

### Content Integrity
- [ ] SKILL.md has "Workflow Routing" section
- [ ] SKILL.md has "Component Library" section
- [ ] SKILL.md has "Narrative Architecture Template" section
- [ ] SKILL.md has "Examples" section
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "cinematic-landing pack installation verified successfully"
2. **Note:** "Use 'audit my landing page' or 'build tier 1' to start the cinematic pipeline."
