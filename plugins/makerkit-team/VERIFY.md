# MakerkitTeam Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/makerkit-team/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/makerkit-team/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/makerkit-team/Data" ] && echo "OK Data/" || echo "MISSING Data/"
[ -d "$CLAUDE_DIR/skills/makerkit-team/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
[ -d "$CLAUDE_DIR/skills/makerkit-team/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/makerkit-team/CHANGELOG.md" ] && echo "OK CHANGELOG.md" || echo "MISSING CHANGELOG.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Data/McpToolMap.json" ] && echo "OK Data/McpToolMap.json" || echo "MISSING Data/McpToolMap.json"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Data/Roster.json" ] && echo "OK Data/Roster.json" || echo "MISSING Data/Roster.json"
[ -f "$CLAUDE_DIR/skills/makerkit-team/FrameworkDigest.md" ] && echo "OK FrameworkDigest.md" || echo "MISSING FrameworkDigest.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/SKILL.partials.md" ] && echo "OK SKILL.partials.md" || echo "MISSING SKILL.partials.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Tools/BuildBrief.ts" ] && echo "OK Tools/BuildBrief.ts" || echo "MISSING Tools/BuildBrief.ts"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Tools/InvokeAgent.ts" ] && echo "OK Tools/InvokeAgent.ts" || echo "MISSING Tools/InvokeAgent.ts"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/BugFix.md" ] && echo "OK Workflows/BugFix.md" || echo "MISSING Workflows/BugFix.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/CodeReview.md" ] && echo "OK Workflows/CodeReview.md" || echo "MISSING Workflows/CodeReview.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/DeliverFeature.md" ] && echo "OK Workflows/DeliverFeature.md" || echo "MISSING Workflows/DeliverFeature.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/DesignReview.md" ] && echo "OK Workflows/DesignReview.md" || echo "MISSING Workflows/DesignReview.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/DocsRefresh.md" ] && echo "OK Workflows/DocsRefresh.md" || echo "MISSING Workflows/DocsRefresh.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/ExploreFeature.md" ] && echo "OK Workflows/ExploreFeature.md" || echo "MISSING Workflows/ExploreFeature.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/QuickFix.md" ] && echo "OK Workflows/QuickFix.md" || echo "MISSING Workflows/QuickFix.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/Refactor.md" ] && echo "OK Workflows/Refactor.md" || echo "MISSING Workflows/Refactor.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/SecurityAudit.md" ] && echo "OK Workflows/SecurityAudit.md" || echo "MISSING Workflows/SecurityAudit.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/ShowRoster.md" ] && echo "OK Workflows/ShowRoster.md" || echo "MISSING Workflows/ShowRoster.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/Workflows/TestAndValidate.md" ] && echo "OK Workflows/TestAndValidate.md" || echo "MISSING Workflows/TestAndValidate.md"
[ -f "$CLAUDE_DIR/skills/makerkit-team/extension.yaml" ] && echo "OK extension.yaml" || echo "MISSING extension.yaml"
```

**Expected:** All 20 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/makerkit-team/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/makerkit-team/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/makerkit-team/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/makerkit-team/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/makerkit-team/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
fi
```

**Expected:** Frontmatter present with name, description, and visibility fields.

## Quick Functional Test

```bash
cd ~/.claude/skills/makerkit-team/$(dirname Tools/BuildBrief.ts) && bun run $(basename Tools/BuildBrief.ts) --help 2>&1 | head -5 || echo "(tool may not support --help; check src for entry points)"
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
[ -d "$CLAUDE_DIR/skills/makerkit-team/Tools/node_modules" ] && echo "  AVAILABLE Tool dependencies" || echo "  UNAVAILABLE Tool dependencies (run: cd ~/.claude/skills/makerkit-team/Tools && bun install)"
```

---

## Installation Checklist

```markdown
## MakerkitTeam Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/makerkit-team/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] Workflows/BugFix.md installed
- [ ] Workflows/CodeReview.md installed
- [ ] Workflows/DeliverFeature.md installed
- [ ] Workflows/DesignReview.md installed
- [ ] Workflows/DocsRefresh.md installed
- [ ] Workflows/ExploreFeature.md installed
- [ ] Workflows/QuickFix.md installed
- [ ] Workflows/Refactor.md installed
- [ ] Workflows/SecurityAudit.md installed
- [ ] Workflows/ShowRoster.md installed
- [ ] Workflows/TestAndValidate.md installed

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"
- [ ] CLI tool runs: `bun run ~/.claude/skills/makerkit-team/Tools/BuildBrief.ts --help`
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "makerkit-team skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/MakerkitTeam/`"
