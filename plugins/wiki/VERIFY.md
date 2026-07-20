# Wiki Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/wiki/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/wiki/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/wiki/Templates" ] && echo "OK Templates/" || echo "MISSING Templates/"
[ -d "$CLAUDE_DIR/skills/wiki/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
[ -d "$CLAUDE_DIR/skills/wiki/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/wiki/CHANGELOG.md" ] && echo "OK CHANGELOG.md" || echo "MISSING CHANGELOG.md"
[ -f "$CLAUDE_DIR/skills/wiki/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/wiki/SKILL.partials.md" ] && echo "OK SKILL.partials.md" || echo "MISSING SKILL.partials.md"
[ -f "$CLAUDE_DIR/skills/wiki/Templates/Schema.md" ] && echo "OK Templates/Schema.md" || echo "MISSING Templates/Schema.md"
[ -f "$CLAUDE_DIR/skills/wiki/Workflows/Ingest.md" ] && echo "OK Workflows/Ingest.md" || echo "MISSING Workflows/Ingest.md"
[ -f "$CLAUDE_DIR/skills/wiki/Workflows/Init.md" ] && echo "OK Workflows/Init.md" || echo "MISSING Workflows/Init.md"
[ -f "$CLAUDE_DIR/skills/wiki/Workflows/Lint.md" ] && echo "OK Workflows/Lint.md" || echo "MISSING Workflows/Lint.md"
[ -f "$CLAUDE_DIR/skills/wiki/Workflows/Query.md" ] && echo "OK Workflows/Query.md" || echo "MISSING Workflows/Query.md"
[ -f "$CLAUDE_DIR/skills/wiki/extension.yaml" ] && echo "OK extension.yaml" || echo "MISSING extension.yaml"
```

**Expected:** All 9 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/wiki/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/wiki/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/wiki/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/wiki/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/wiki/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
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
## Wiki Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/wiki/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] Workflows/Ingest.md installed
- [ ] Workflows/Init.md installed
- [ ] Workflows/Lint.md installed
- [ ] Workflows/Query.md installed

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"

```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "wiki skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Wiki/`"
