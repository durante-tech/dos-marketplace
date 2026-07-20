# DesignSystem Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check skill files exist at target

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/DesignSystem"

echo "DesignSystem files:"
[ -f "$SKILL_DIR/SKILL.md" ] && echo "  OK SKILL.md" || echo "  MISSING SKILL.md"
[ -d "$SKILL_DIR/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -f "$SKILL_DIR/Workflows/Init.md" ] && echo "  OK Workflows/Init.md" || echo "  MISSING Workflows/Init.md"
[ -f "$SKILL_DIR/Workflows/Update.md" ] && echo "  OK Workflows/Update.md" || echo "  MISSING Workflows/Update.md"
[ -f "$SKILL_DIR/Workflows/Generate.md" ] && echo "  OK Workflows/Generate.md" || echo "  MISSING Workflows/Generate.md"
[ -f "$SKILL_DIR/Workflows/Audit.md" ] && echo "  OK Workflows/Audit.md" || echo "  MISSING Workflows/Audit.md"
```

**Expected:** 1 skill file and 4 workflow files present.

---

## Content Verification

### Check SKILL.md has required sections

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/DesignSystem"

echo "SKILL.md content checks:"
grep -q "Workflow Routing" "$SKILL_DIR/SKILL.md" && echo "  OK Workflow Routing section" || echo "  MISSING Workflow Routing section"
grep -q "Examples" "$SKILL_DIR/SKILL.md" && echo "  OK Examples section" || echo "  MISSING Examples section"
grep -q "DESIGN.md" "$SKILL_DIR/SKILL.md" && echo "  OK References DESIGN.md paradigm" || echo "  MISSING DESIGN.md reference"
```

---

## Installation Checklist

```markdown
## DesignSystem Installation Verification

### Files
- [ ] SKILL.md installed
- [ ] Workflows/Init.md installed
- [ ] Workflows/Update.md installed
- [ ] Workflows/Generate.md installed
- [ ] Workflows/Audit.md installed

### Content Integrity
- [ ] SKILL.md has "Workflow Routing" section
- [ ] SKILL.md has "Examples" section
- [ ] SKILL.md references DESIGN.md paradigm
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "design-system pack installation verified successfully"
2. **Note:** "To use, navigate to any project and say 'create a design system' or 'extract design from [URL]'. The skill creates a DESIGN.md file that governs all UI generation."
