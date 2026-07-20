# Archetypes Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/archetypes/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/archetypes/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/archetypes/Data" ] && echo "OK Data/" || echo "MISSING Data/"
[ -d "$CLAUDE_DIR/skills/archetypes/Schema" ] && echo "OK Schema/" || echo "MISSING Schema/"
[ -d "$CLAUDE_DIR/skills/archetypes/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
[ -d "$CLAUDE_DIR/skills/archetypes/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/archetypes/CHANGELOG.md" ] && echo "OK CHANGELOG.md" || echo "MISSING CHANGELOG.md"
[ -f "$CLAUDE_DIR/skills/archetypes/Data/Media.archetype.ts" ] && echo "OK Data/Media.archetype.ts" || echo "MISSING Data/Media.archetype.ts"
[ -f "$CLAUDE_DIR/skills/archetypes/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/archetypes/SKILL.partials.md" ] && echo "OK SKILL.partials.md" || echo "MISSING SKILL.partials.md"
[ -f "$CLAUDE_DIR/skills/archetypes/Schema/Archetype.ts" ] && echo "OK Schema/Archetype.ts" || echo "MISSING Schema/Archetype.ts"
[ -f "$CLAUDE_DIR/skills/archetypes/Tools/RenderArchetype.ts" ] && echo "OK Tools/RenderArchetype.ts" || echo "MISSING Tools/RenderArchetype.ts"
[ -f "$CLAUDE_DIR/skills/archetypes/Tools/ValidateArchetype.ts" ] && echo "OK Tools/ValidateArchetype.ts" || echo "MISSING Tools/ValidateArchetype.ts"
[ -f "$CLAUDE_DIR/skills/archetypes/Workflows/AuditFeature.md" ] && echo "OK Workflows/AuditFeature.md" || echo "MISSING Workflows/AuditFeature.md"
[ -f "$CLAUDE_DIR/skills/archetypes/Workflows/AuthorArchetype.md" ] && echo "OK Workflows/AuthorArchetype.md" || echo "MISSING Workflows/AuthorArchetype.md"
[ -f "$CLAUDE_DIR/skills/archetypes/Workflows/SeedScope.md" ] && echo "OK Workflows/SeedScope.md" || echo "MISSING Workflows/SeedScope.md"
[ -f "$CLAUDE_DIR/skills/archetypes/extension.yaml" ] && echo "OK extension.yaml" || echo "MISSING extension.yaml"
```

**Expected:** All 11 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/archetypes/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/archetypes/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/archetypes/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/archetypes/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/archetypes/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
fi
```

**Expected:** Frontmatter present with name, description, and visibility fields.

## Quick Functional Test

```bash
cd ~/.claude/skills/archetypes/$(dirname Tools/RenderArchetype.ts) && bun run $(basename Tools/RenderArchetype.ts) --help 2>&1 | head -5 || echo "(tool may not support --help; check src for entry points)"
```

**Expected behavior:** prints usage / no crash. If Bun is not installed, the test fails but the skill files are still correctly placed.

---

## Dependency Checks (Informational)

```bash
echo "Dependencies:"
if command -v bun &> /dev/null; then
  echo "  AVAILABLE Bun runtime: $(bun --version)"
else
  echo "  UNAVAILABLE Bun runtime"
fi
[ -d "$CLAUDE_DIR/skills/archetypes/Tools/node_modules" ] && echo "  AVAILABLE Tool dependencies" || echo "  UNAVAILABLE Tool dependencies (run: cd ~/.claude/skills/archetypes/Tools && bun install)"
```

---

## Installation Checklist

```markdown
## Archetypes Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/archetypes/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] Workflows/AuditFeature.md installed
- [ ] Workflows/AuthorArchetype.md installed
- [ ] Workflows/SeedScope.md installed

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"
- [ ] CLI tool runs: `bun run ~/.claude/skills/archetypes/Tools/RenderArchetype.ts --help`
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Archetypes skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Archetypes/`"
