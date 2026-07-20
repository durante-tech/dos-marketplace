# StartupInvestorDocs Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check skill files exist at target

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/StartupInvestorDocs"

echo "StartupInvestorDocs files:"
[ -f "$SKILL_DIR/SKILL.md" ] && echo "  OK SKILL.md" || echo "  MISSING SKILL.md"
[ -d "$SKILL_DIR/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -f "$SKILL_DIR/Workflows/Generate.md" ] && echo "  OK Workflows/Generate.md" || echo "  MISSING Workflows/Generate.md"
[ -f "$SKILL_DIR/Workflows/Scan.md" ] && echo "  OK Workflows/Scan.md" || echo "  MISSING Workflows/Scan.md"
[ -f "$SKILL_DIR/Workflows/GapAnalysis.md" ] && echo "  OK Workflows/GapAnalysis.md" || echo "  MISSING Workflows/GapAnalysis.md"
[ -f "$SKILL_DIR/Workflows/Research.md" ] && echo "  OK Workflows/Research.md" || echo "  MISSING Workflows/Research.md"
[ -f "$SKILL_DIR/Workflows/Enhance.md" ] && echo "  OK Workflows/Enhance.md" || echo "  MISSING Workflows/Enhance.md"
[ -f "$SKILL_DIR/Workflows/SingleDoc.md" ] && echo "  OK Workflows/SingleDoc.md" || echo "  MISSING Workflows/SingleDoc.md"
```

**Expected:** 1 skill file, 1 directory, 6 workflow files.

---

## Installation Checklist

```markdown
## StartupInvestorDocs Installation Verification

### Files
- [ ] SKILL.md installed
- [ ] Workflows/ directory created
- [ ] Workflows/Generate.md installed
- [ ] Workflows/Scan.md installed
- [ ] Workflows/GapAnalysis.md installed
- [ ] Workflows/Research.md installed
- [ ] Workflows/Enhance.md installed
- [ ] Workflows/SingleDoc.md installed

### Content Integrity
- [ ] SKILL.md has "Document Types" table
- [ ] SKILL.md has "Investor Expectations by Stage" section
- [ ] SKILL.md has "Pitch Deck Structure" section
- [ ] SKILL.md has "Workflow Routing" section
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "startup-investor-docs pack installation verified successfully"
2. **Note:** "Use 'scan' workflow first to assess existing materials, then 'gap-analysis' to identify missing pieces, then 'generate' or 'single-doc' to create what's needed."
