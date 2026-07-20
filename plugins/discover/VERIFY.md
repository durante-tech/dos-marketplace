# Discover Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/discover/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/discover/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/discover/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/discover/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/discover/SKILL.partials.md" ] && echo "OK SKILL.partials.md" || echo "MISSING SKILL.partials.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/bare/.gitkeep" ] && echo "OK Tools/__fixtures__/bare/.gitkeep" || echo "MISSING Tools/__fixtures__/bare/.gitkeep"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/established/.claude/kit-conventions.md" ] && echo "OK Tools/__fixtures__/established/.claude/kit-conventions.md" || echo "MISSING Tools/__fixtures__/established/.claude/kit-conventions.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/established/.fork-slot" ] && echo "OK Tools/__fixtures__/established/.fork-slot" || echo "MISSING Tools/__fixtures__/established/.fork-slot"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/established/AGENTS.md" ] && echo "OK Tools/__fixtures__/established/AGENTS.md" || echo "MISSING Tools/__fixtures__/established/AGENTS.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/established/MEMORY/WORK/20260101-000000_seed/PRD.md" ] && echo "OK Tools/__fixtures__/established/MEMORY/WORK/20260101-000000_seed/PRD.md" || echo "MISSING Tools/__fixtures__/established/MEMORY/WORK/20260101-000000_seed/PRD.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/fresh/.claude/kit-conventions.md" ] && echo "OK Tools/__fixtures__/fresh/.claude/kit-conventions.md" || echo "MISSING Tools/__fixtures__/fresh/.claude/kit-conventions.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/fresh/.fork-slot" ] && echo "OK Tools/__fixtures__/fresh/.fork-slot" || echo "MISSING Tools/__fixtures__/fresh/.fork-slot"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/fresh/AGENTS.md" ] && echo "OK Tools/__fixtures__/fresh/AGENTS.md" || echo "MISSING Tools/__fixtures__/fresh/AGENTS.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/brief.md" ] && echo "OK Tools/__fixtures__/golden/20260101-000000_example-feature/brief.md" || echo "MISSING Tools/__fixtures__/golden/20260101-000000_example-feature/brief.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/build-order.md" ] && echo "OK Tools/__fixtures__/golden/20260101-000000_example-feature/build-order.md" || echo "MISSING Tools/__fixtures__/golden/20260101-000000_example-feature/build-order.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/capability-selection.md" ] && echo "OK Tools/__fixtures__/golden/20260101-000000_example-feature/capability-selection.md" || echo "MISSING Tools/__fixtures__/golden/20260101-000000_example-feature/capability-selection.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/locked-decisions.md" ] && echo "OK Tools/__fixtures__/golden/20260101-000000_example-feature/locked-decisions.md" || echo "MISSING Tools/__fixtures__/golden/20260101-000000_example-feature/locked-decisions.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/golden/20260101-000000_example-feature/task-string.md" ] && echo "OK Tools/__fixtures__/golden/20260101-000000_example-feature/task-string.md" || echo "MISSING Tools/__fixtures__/golden/20260101-000000_example-feature/task-string.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/kit-divergent/.claude/kit-conventions.md" ] && echo "OK Tools/__fixtures__/kit-divergent/.claude/kit-conventions.md" || echo "MISSING Tools/__fixtures__/kit-divergent/.claude/kit-conventions.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/missing-conventions/.fork-slot" ] && echo "OK Tools/__fixtures__/missing-conventions/.fork-slot" || echo "MISSING Tools/__fixtures__/missing-conventions/.fork-slot"
[ -f "$CLAUDE_DIR/skills/discover/Tools/__fixtures__/missing-conventions/AGENTS.md" ] && echo "OK Tools/__fixtures__/missing-conventions/AGENTS.md" || echo "MISSING Tools/__fixtures__/missing-conventions/AGENTS.md"
[ -f "$CLAUDE_DIR/skills/discover/Tools/emit.test.ts" ] && echo "OK Tools/emit.test.ts" || echo "MISSING Tools/emit.test.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/emit.ts" ] && echo "OK Tools/emit.ts" || echo "MISSING Tools/emit.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/golden.test.ts" ] && echo "OK Tools/golden.test.ts" || echo "MISSING Tools/golden.test.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/ground.test.ts" ] && echo "OK Tools/ground.test.ts" || echo "MISSING Tools/ground.test.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/ground.ts" ] && echo "OK Tools/ground.ts" || echo "MISSING Tools/ground.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/intel.test.ts" ] && echo "OK Tools/intel.test.ts" || echo "MISSING Tools/intel.test.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/intel.ts" ] && echo "OK Tools/intel.ts" || echo "MISSING Tools/intel.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/interview.test.ts" ] && echo "OK Tools/interview.test.ts" || echo "MISSING Tools/interview.test.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/interview.ts" ] && echo "OK Tools/interview.ts" || echo "MISSING Tools/interview.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/seam-guard-parity.test.ts" ] && echo "OK Tools/seam-guard-parity.test.ts" || echo "MISSING Tools/seam-guard-parity.test.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/task-string-validator.test.ts" ] && echo "OK Tools/task-string-validator.test.ts" || echo "MISSING Tools/task-string-validator.test.ts"
[ -f "$CLAUDE_DIR/skills/discover/Tools/task-string-validator.ts" ] && echo "OK Tools/task-string-validator.ts" || echo "MISSING Tools/task-string-validator.ts"
[ -f "$CLAUDE_DIR/skills/discover/extension.yaml" ] && echo "OK extension.yaml" || echo "MISSING extension.yaml"
```

**Expected:** All 31 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/discover/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/discover/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/discover/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/discover/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/discover/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
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
[ -d "$CLAUDE_DIR/skills/discover/Tools/node_modules" ] && echo "  AVAILABLE Tool dependencies" || echo "  UNAVAILABLE Tool dependencies (run: cd ~/.claude/skills/discover/Tools && bun install)"
```

---

## Installation Checklist

```markdown
## Discover Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/discover/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] All source files copied per VERIFY.md

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"

```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "discover skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Discover/`"
