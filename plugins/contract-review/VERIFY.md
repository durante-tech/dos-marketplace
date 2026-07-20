# ContractReview Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/contract-review/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/contract-review/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/contract-review/Data" ] && echo "OK Data/" || echo "MISSING Data/"
[ -d "$CLAUDE_DIR/skills/contract-review/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/contract-review/Data/SaaSRedFlags.md" ] && echo "OK Data/SaaSRedFlags.md" || echo "MISSING Data/SaaSRedFlags.md"
[ -f "$CLAUDE_DIR/skills/contract-review/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/contract-review/SKILL.partials.md" ] && echo "OK SKILL.partials.md" || echo "MISSING SKILL.partials.md"
[ -f "$CLAUDE_DIR/skills/contract-review/Workflows/ReviewContract.md" ] && echo "OK Workflows/ReviewContract.md" || echo "MISSING Workflows/ReviewContract.md"
[ -f "$CLAUDE_DIR/skills/contract-review/extension.yaml" ] && echo "OK extension.yaml" || echo "MISSING extension.yaml"
```

**Expected:** All 5 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/contract-review/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/contract-review/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/contract-review/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/contract-review/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/contract-review/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
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
## ContractReview Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/contract-review/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] Workflows/ReviewContract.md installed

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"

```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "contract-review skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ContractReview/`"
