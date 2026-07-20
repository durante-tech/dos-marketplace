# StreamRig Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/stream-rig/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/stream-rig/SKILL.md`.

### Check directories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/stream-rig/Overlays" ] && echo "OK Overlays/" || echo "MISSING Overlays/"
[ -d "$CLAUDE_DIR/skills/stream-rig/Presets" ] && echo "OK Presets/" || echo "MISSING Presets/"
[ -d "$CLAUDE_DIR/skills/stream-rig/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
[ -d "$CLAUDE_DIR/skills/stream-rig/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
```

### Check key files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/stream-rig/Overlays/README.md" ] && echo "OK Overlays/README.md" || echo "MISSING Overlays/README.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/Presets/podcast.yaml" ] && echo "OK Presets/podcast.yaml" || echo "MISSING Presets/podcast.yaml"
[ -f "$CLAUDE_DIR/skills/stream-rig/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/SKILL.partials.md" ] && echo "OK SKILL.partials.md" || echo "MISSING SKILL.partials.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/Tools/README.md" ] && echo "OK Tools/README.md" || echo "MISSING Tools/README.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/Workflows/EndShow.md" ] && echo "OK Workflows/EndShow.md" || echo "MISSING Workflows/EndShow.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/Workflows/EpisodeMemory.md" ] && echo "OK Workflows/EpisodeMemory.md" || echo "MISSING Workflows/EpisodeMemory.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/Workflows/InitRig.md" ] && echo "OK Workflows/InitRig.md" || echo "MISSING Workflows/InitRig.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/Workflows/PostStream.md" ] && echo "OK Workflows/PostStream.md" || echo "MISSING Workflows/PostStream.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/Workflows/PreShow.md" ] && echo "OK Workflows/PreShow.md" || echo "MISSING Workflows/PreShow.md"
[ -f "$CLAUDE_DIR/skills/stream-rig/Workflows/RefreshBrand.md" ] && echo "OK Workflows/RefreshBrand.md" || echo "MISSING Workflows/RefreshBrand.md"
```

**Expected:** All 11 files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/stream-rig/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/stream-rig/SKILL.md" | grep -q "^---" && echo "OK SKILL.md has frontmatter opener" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/stream-rig/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/stream-rig/SKILL.md" && echo "OK SKILL.md has description field" || echo "ERROR SKILL.md missing description"
  grep -q "^visibility:" "$CLAUDE_DIR/skills/stream-rig/SKILL.md" && echo "OK SKILL.md has visibility field (RFC-0011 §6)" || echo "ERROR SKILL.md missing visibility"
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
## StreamRig Skill Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/stream-rig/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter
- [ ] Workflows/EndShow.md installed
- [ ] Workflows/EpisodeMemory.md installed
- [ ] Workflows/InitRig.md installed
- [ ] Workflows/PostStream.md installed
- [ ] Workflows/PreShow.md installed
- [ ] Workflows/RefreshBrand.md installed

### Functional (manual test)
- [ ] Workflow triggers route correctly per SKILL.md "Workflow Routing"

```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "stream-rig skill installation verified successfully"
2. **Note:** "Customizations live at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/StreamRig/`"
