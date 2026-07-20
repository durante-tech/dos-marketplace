# FastAPIStarterTeam Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/fastapi-starter-team/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/fastapi-starter-team/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/fastapi-starter-team/Data" ] && echo "OK Data/" || echo "MISSING Data/"
[ -d "$CLAUDE_DIR/skills/fastapi-starter-team/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
[ -d "$CLAUDE_DIR/skills/fastapi-starter-team/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
DEST="$CLAUDE_DIR/skills/FastAPIStarterTeam"

# Skill manifests
for f in SKILL.md SKILL.partials.md CHANGELOG.md FrameworkDigest.md extension.yaml; do
  [ -f "$DEST/$f" ] && echo "OK $f" || echo "MISSING $f"
done

# Data
for f in Data/Roster.json Data/McpToolMap.json; do
  [ -f "$DEST/$f" ] && echo "OK $f" || echo "MISSING $f"
done

# Tools (6)
for f in Tools/BuildBrief.ts Tools/InvokeAgent.ts Tools/ParsePrTodos.ts Tools/ClassifyPrShape.ts Tools/RenderTodoComment.ts Tools/_shared.ts; do
  [ -f "$DEST/$f" ] && echo "OK $f" || echo "MISSING $f"
done

# Workflows (14 + 5 partials)
for f in BugFix.md CodeReview.md DeliverFeature.md DesignReview.md DocsRefresh.md ExecuteOpenTodos.md ExploreFeature.md QuickFix.md Refactor.md ReviewOpenPRs.md ReviewSinglePR.md SecurityAudit.md ShowRoster.md TestAndValidate.md _test-pyramid-gate.md _algorithm-team-spawn.md _commit-merge.md _github-collaboration.md _pr-loop-shared.md; do
  [ -f "$DEST/Workflows/$f" ] && echo "OK Workflows/$f" || echo "MISSING Workflows/$f"
done
```

**Expected:** All ~30 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/fastapi-starter-team/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/fastapi-starter-team/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/fastapi-starter-team/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/fastapi-starter-team/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/fastapi-starter-team/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
fi
```

### Check Roster.json parses + has 13 roles

```bash
CLAUDE_DIR="$HOME/.claude"
ROLES=$(jq '.team | length' "$CLAUDE_DIR/skills/fastapi-starter-team/Data/Roster.json" 2>/dev/null)
[ "$ROLES" = "13" ] && echo "OK Roster.json has 13 roles" || echo "ERROR Roster.json role count = $ROLES (expected 13)"
```

### Check McpToolMap.json parses + has 6 clusters

```bash
CLAUDE_DIR="$HOME/.claude"
CLUSTERS=$(jq '.clusters | length' "$CLAUDE_DIR/skills/fastapi-starter-team/Data/McpToolMap.json" 2>/dev/null)
[ "$CLUSTERS" = "6" ] && echo "OK McpToolMap.json has 6 clusters" || echo "ERROR McpToolMap.json cluster count = $CLUSTERS (expected 6)"
```

## Quick Functional Test

```bash
cd ~/.claude/skills/FastAPIStarterTeam && bun run Tools/BuildBrief.ts --help 2>&1 | head -5 || echo "(tool may not support --help; check src for entry points)"
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

if command -v uv &> /dev/null; then
  echo "  AVAILABLE uv runtime: $(uv --version)"
else
  echo "  UNAVAILABLE uv runtime (required for the dos-fastapi-starter MCP server)"
fi

if command -v jq &> /dev/null; then
  echo "  AVAILABLE jq: $(jq --version)"
else
  echo "  UNAVAILABLE jq (used by some verification checks)"
fi
```

---

## Installation Checklist

```markdown
## FastAPIStarterTeam Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/fastapi-starter-team/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] Roster.json has 13 roles
- [ ] McpToolMap.json has 6 clusters
- [ ] All 14 workflows installed
- [ ] All 5 shared partials installed
- [ ] All 6 Tools installed

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"
- [ ] CLI tool runs: `bun run ~/.claude/skills/fastapi-starter-team/Tools/BuildBrief.ts --help`
- [ ] dos-fastapi-starter MCP server registered in project .mcp.json (optional but recommended)
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "fastapi-starter-team skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/FastAPIStarterTeam/`"
3. **Suggest:** "Wire the dos-fastapi-starter MCP server in your project .mcp.json — see SKILL.md → MCP Integration."
