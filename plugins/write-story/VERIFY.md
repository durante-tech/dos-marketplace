# WriteStory Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check skill files exist at target

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/WriteStory"

echo "WriteStory files:"
[ -f "$SKILL_DIR/SKILL.md" ] && echo "  OK SKILL.md" || echo "  MISSING SKILL.md"
[ -d "$SKILL_DIR/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -f "$SKILL_DIR/Workflows/Interview.md" ] && echo "  OK Workflows/Interview.md" || echo "  MISSING Workflows/Interview.md"
[ -f "$SKILL_DIR/Workflows/BuildBible.md" ] && echo "  OK Workflows/BuildBible.md" || echo "  MISSING Workflows/BuildBible.md"
[ -f "$SKILL_DIR/Workflows/Explore.md" ] && echo "  OK Workflows/Explore.md" || echo "  MISSING Workflows/Explore.md"
[ -f "$SKILL_DIR/Workflows/WriteChapter.md" ] && echo "  OK Workflows/WriteChapter.md" || echo "  MISSING Workflows/WriteChapter.md"
[ -f "$SKILL_DIR/Workflows/Revise.md" ] && echo "  OK Workflows/Revise.md" || echo "  MISSING Workflows/Revise.md"
```

**Expected:** 1 skill file, 1 directory, 5 workflow files.

---

## Installation Checklist

```markdown
## WriteStory Installation Verification

### Files
- [ ] SKILL.md installed
- [ ] Workflows/ directory created
- [ ] Workflows/Interview.md installed
- [ ] Workflows/BuildBible.md installed
- [ ] Workflows/Explore.md installed
- [ ] Workflows/WriteChapter.md installed
- [ ] Workflows/Revise.md installed

### Content Integrity
- [ ] SKILL.md has "The Seven Story Layers" section
- [ ] SKILL.md has "Workflow Routing" section
- [ ] SKILL.md has "Examples" section
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "write-story pack installation verified successfully"
2. **Note:** "Start with the Interview workflow to extract story ideas, then BuildBible to create the master plan, then WriteChapter for prose generation."
