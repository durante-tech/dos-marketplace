# Dispatch v1.0.0 - Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every check must pass before declaring the pack installed.

---

## Automated Checks

```bash
SKILL_DIR="$HOME/.claude/skills/Dispatch"
PASS=0
FAIL=0

# 1. Core files exist
for f in SKILL.md extension.yaml; do
  if [ -f "$SKILL_DIR/$f" ]; then
    echo "  OK $f exists"
    ((PASS++))
  else
    echo "  FAIL $f missing"
    ((FAIL++))
  fi
done

# 2. Workflows exist (3 required)
for f in WeeklyDispatch.md BlogPost.md Newsletter.md; do
  if [ -f "$SKILL_DIR/Workflows/$f" ]; then
    echo "  OK Workflow $f exists"
    ((PASS++))
  else
    echo "  FAIL Workflow $f missing"
    ((FAIL++))
  fi
done

# 3. Mandatory Step-1 Research invocation present in every workflow
for f in WeeklyDispatch.md BlogPost.md Newsletter.md; do
  if grep -q 'Skill("Research"' "$SKILL_DIR/Workflows/$f" 2>/dev/null; then
    echo "  OK $f references Skill(\"Research\", ...) as Step 1"
    ((PASS++))
  else
    echo "  FAIL $f missing mandatory Research-skill Step 1"
    ((FAIL++))
  fi
done

# 4. Mandatory Media-skill hero image reference
for f in WeeklyDispatch.md BlogPost.md Newsletter.md; do
  if grep -q 'Skill("Media"' "$SKILL_DIR/Workflows/$f" 2>/dev/null; then
    echo "  OK $f references Skill(\"Media\", ...) for hero image"
    ((PASS++))
  else
    echo "  FAIL $f missing Skill(\"Media\", ...) hero invocation"
    ((FAIL++))
  fi
done

# 5. Dependencies installed
for dep in Research Media; do
  if [ -d "$HOME/.claude/skills/$dep" ]; then
    echo "  OK $dep pack installed"
    ((PASS++))
  else
    echo "  FAIL $dep pack missing — Dispatch depends on it"
    ((FAIL++))
  fi
done

# 6. NO Python files (markdown-only skill)
PYTHON_FILES=$(find "$SKILL_DIR" -name "*.py" 2>/dev/null | wc -l)
if [ "$PYTHON_FILES" -eq 0 ]; then
  echo "  OK No Python files (markdown-only authoring skill)"
  ((PASS++))
else
  echo "  FAIL Python files found — Dispatch is markdown-only"
  ((FAIL++))
fi

# 7. NO Tools directory (markdown-only skill)
if [ ! -d "$SKILL_DIR/Tools" ]; then
  echo "  OK No Tools/ directory (markdown-only authoring skill)"
  ((PASS++))
else
  echo "  FAIL Tools/ directory present — Dispatch is markdown-only"
  ((FAIL++))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
else
  echo "SOME CHECKS FAILED — review above"
fi
```

## Functional Verification

```bash
# Verify the skill is registered in the live skills list
SKILL_DIR="$HOME/.claude/skills/Dispatch"

if grep -q "name: Dispatch" "$SKILL_DIR/SKILL.md" 2>/dev/null; then
  echo "  OK Dispatch SKILL.md frontmatter has correct name"
else
  echo "  FAIL Dispatch SKILL.md frontmatter missing name"
fi

if grep -qE "USE WHEN.+blog|dispatch|newsletter" "$SKILL_DIR/SKILL.md" 2>/dev/null; then
  echo "  OK Dispatch SKILL.md USE WHEN keywords present"
else
  echo "  FAIL Dispatch SKILL.md missing USE WHEN keywords"
fi
```

---

## Installation Checklist

```markdown
## Dispatch v1.0.0 Installation Verification

### Files (5 checks)
- [ ] SKILL.md installed
- [ ] extension.yaml installed
- [ ] WeeklyDispatch.md workflow installed
- [ ] BlogPost.md workflow installed
- [ ] Newsletter.md workflow installed

### Hard Rules
- [ ] All 3 workflows reference Skill("research", ...) as Step 1
- [ ] All 3 workflows reference Skill("media", ...) for hero image

### Clean State
- [ ] No Python files in skill directory
- [ ] No Tools/ directory (markdown-only)

### Dependencies
- [ ] research pack installed
- [ ] media pack installed
- [ ] Studio gateway env configured (recommended)
```

---

## Verification Complete

When all checks pass:

1. **Confirm:** "Dispatch v1.0.0 installed and verified."
2. **Next:** "Say 'write a weekly dispatch on [topic]', 'draft a blog post about [topic]', or 'create this week's newsletter' to get started. The first step of every workflow is mandatory Research."
