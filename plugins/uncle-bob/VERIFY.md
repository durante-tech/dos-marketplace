# UncleBob Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/uncle-bob/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/uncle-bob/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/uncle-bob/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/uncle-bob/Principles.md" ] && echo "OK Principles.md" || echo "MISSING Principles.md"
[ -f "$CLAUDE_DIR/skills/uncle-bob/QuoteBank.md" ] && echo "OK QuoteBank.md" || echo "MISSING QuoteBank.md"
[ -f "$CLAUDE_DIR/skills/uncle-bob/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/uncle-bob/SmellsLookup.md" ] && echo "OK SmellsLookup.md" || echo "MISSING SmellsLookup.md"
[ -f "$CLAUDE_DIR/skills/uncle-bob/StepAsideTable.md" ] && echo "OK StepAsideTable.md" || echo "MISSING StepAsideTable.md"
[ -f "$CLAUDE_DIR/skills/uncle-bob/Workflows/Coach.md" ] && echo "OK Workflows/Coach.md" || echo "MISSING Workflows/Coach.md"
[ -f "$CLAUDE_DIR/skills/uncle-bob/Workflows/Diagnose.md" ] && echo "OK Workflows/Diagnose.md" || echo "MISSING Workflows/Diagnose.md"
[ -f "$CLAUDE_DIR/skills/uncle-bob/Workflows/SteelMan.md" ] && echo "OK Workflows/SteelMan.md" || echo "MISSING Workflows/SteelMan.md"
[ -f "$CLAUDE_DIR/skills/uncle-bob/extension.yaml" ] && echo "OK extension.yaml" || echo "MISSING extension.yaml"
```

**Expected:** All 9 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/uncle-bob/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/uncle-bob/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/uncle-bob/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/uncle-bob/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/uncle-bob/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
fi
```

**Expected:** Frontmatter present with name, description, and visibility fields.

## Dependency Checks (Informational)

```bash
echo "Dependencies:"
if command -v bun &> /dev/null; then
  echo "  AVAILABLE Bun runtime: $(bun --version)"
else
  echo "  UNAVAILABLE Bun runtime"
fi

```

---

## Installation Checklist

```markdown
## UncleBob Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/uncle-bob/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] Workflows/Coach.md installed
- [ ] Workflows/Diagnose.md installed
- [ ] Workflows/SteelMan.md installed

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"

```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "UncleBob skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/UncleBob/`"
