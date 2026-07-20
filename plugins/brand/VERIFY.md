# Brand Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed.

---

## File Verification

### Check skill and workflow files exist at target

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/Brand"

echo "Brand parent:"
[ -f "$SKILL_DIR/SKILL.md" ] && echo "  OK SKILL.md" || echo "  MISSING SKILL.md"
[ -f "$SKILL_DIR/Workflows/Audit.md" ] && echo "  OK Workflows/Audit.md" || echo "  MISSING Workflows/Audit.md"

echo ""
for subskill in Research Strategy Naming Verbal Visual Implementation Guidelines; do
  echo "$subskill sub-skill:"
  [ -f "$SKILL_DIR/$subskill/SKILL.md" ] && echo "  OK SKILL.md" || echo "  MISSING SKILL.md"
  [ -d "$SKILL_DIR/$subskill/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
  for wf in "$SKILL_DIR/$subskill/Workflows/"*.md; do
    [ -f "$wf" ] && echo "  OK $(basename $wf)" || true
  done
  echo ""
done
```

**Expected:** 8 SKILL.md files, 21 workflow files across 7 sub-skills + 1 cross-cutting.

---

## Content Verification

### Check parent SKILL.md has required sections

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_DIR="$CLAUDE_DIR/skills/Brand"

echo "SKILL.md content checks:"
grep -q "Sub-Skill Routing" "$SKILL_DIR/SKILL.md" && echo "  OK Sub-Skill Routing section" || echo "  MISSING Sub-Skill Routing section"
grep -q "Examples" "$SKILL_DIR/SKILL.md" && echo "  OK Examples section" || echo "  MISSING Examples section"
grep -q "Token Architecture" "$SKILL_DIR/SKILL.md" && echo "  OK Token Architecture section" || echo "  MISSING Token Architecture section"

echo ""
echo "Sub-skill routing checks:"
for subskill in Research Strategy Naming Verbal Visual Implementation Guidelines; do
  grep -q "$subskill/SKILL.md" "$SKILL_DIR/SKILL.md" && echo "  OK $subskill route" || echo "  MISSING $subskill route"
done
```

---

## Installation Checklist

```markdown
## Brand Installation Verification

### Parent Skill
- [ ] SKILL.md installed with Sub-Skill Routing table
- [ ] Workflows/Audit.md installed (cross-cutting)

### Research Sub-Skill
- [ ] Research/SKILL.md installed
- [ ] Research/Workflows/Research.md installed

### Strategy Sub-Skill
- [ ] Strategy/SKILL.md installed
- [ ] Strategy/Workflows/Define.md installed
- [ ] Strategy/Workflows/Architecture.md installed

### Naming Sub-Skill
- [ ] Naming/SKILL.md installed
- [ ] Naming/Workflows/NameProduct.md installed
- [ ] Naming/Workflows/NamingSystem.md installed

### Verbal Sub-Skill
- [ ] Verbal/SKILL.md installed
- [ ] Verbal/Workflows/Generate.md installed
- [ ] Verbal/Workflows/BrandScript.md installed
- [ ] Verbal/Workflows/VoiceGuide.md installed
- [ ] Verbal/Workflows/Artifacts.md installed

### Visual Sub-Skill
- [ ] Visual/SKILL.md installed
- [ ] Visual/Workflows/LogoDesign.md installed
- [ ] Visual/Workflows/IconSystem.md installed
- [ ] Visual/Workflows/ColorSystem.md installed
- [ ] Visual/Workflows/Typography.md installed
- [ ] Visual/Workflows/IllustrationDirection.md installed
- [ ] Visual/Workflows/MotionLanguage.md installed

### Implementation Sub-Skill
- [ ] Implementation/SKILL.md installed
- [ ] Implementation/Workflows/Implement.md installed
- [ ] Implementation/Workflows/Handoff.md installed
- [ ] Implementation/Workflows/SocialBrand.md installed

### Guidelines Sub-Skill
- [ ] Guidelines/SKILL.md installed
- [ ] Guidelines/Workflows/GenerateGuidelines.md installed
- [ ] Guidelines/Workflows/EnforceConsistency.md installed
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "brand pack v2.0.0 installation verified successfully"
2. **Note:** "The brand skill has 7 sub-skills. Say 'research brand' to start a deep dive, 'define brand' for strategy, 'name my product' for naming, 'brand voice' for verbal identity, 'design logo' for visual, 'implement brand' for code generation, or 'brand guidelines' for documentation."
