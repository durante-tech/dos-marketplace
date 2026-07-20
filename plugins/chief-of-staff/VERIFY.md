# ChiefOfStaff Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. User-artifact checks are informational only — we never overwrite user content.

---

## File Verification

### Check SKILL.md exists at target

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/chief-of-staff/SKILL.md" ] && echo "OK ChiefOfStaff SKILL.md" || echo "MISSING ChiefOfStaff SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/chief-of-staff/SKILL.md`.

### Check subdirectories exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Directories:"
[ -d "$CLAUDE_DIR/skills/chief-of-staff/Workflows" ] && echo "  OK Workflows/" || echo "  MISSING Workflows/"
[ -d "$CLAUDE_DIR/skills/chief-of-staff/Templates" ] && echo "  OK Templates/" || echo "  MISSING Templates/"
```

**Expected:** Both Workflows/ and Templates/ directories present.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
SKILL_FILE="$CLAUDE_DIR/skills/chief-of-staff/SKILL.md"

if [ -f "$SKILL_FILE" ]; then
  head -1 "$SKILL_FILE" | grep -q "^---" && echo "OK SKILL.md frontmatter" || echo "ERROR SKILL.md missing frontmatter"
  grep -E "^(name|description):" "$SKILL_FILE" > /dev/null && echo "OK SKILL.md has name + description" || echo "ERROR SKILL.md missing required fields"
fi
```

**Expected:** SKILL.md has valid YAML frontmatter with name and description fields.

### Check all workflow files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Workflows:"
for wf in Triage.md Brief.md Followup.md Morning.md; do
  [ -f "$CLAUDE_DIR/skills/chief-of-staff/Workflows/$wf" ] && echo "  OK $wf" || echo "  MISSING $wf"
done
```

**Expected:** All 4 workflow files present (Triage, Brief, Followup, Morning).

### Check template files

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Templates:"
[ -f "$CLAUDE_DIR/skills/chief-of-staff/Templates/principal.md" ] && echo "  OK principal.md" || echo "  MISSING principal.md"
[ -f "$CLAUDE_DIR/skills/chief-of-staff/Templates/rules.md" ] && echo "  OK rules.md" || echo "  MISSING rules.md"
```

**Expected:** Both template files present.

### Check workflow frontmatter and voice notification

```bash
CLAUDE_DIR="$HOME/.claude"
WORKFLOWS_DIR="$CLAUDE_DIR/skills/chief-of-staff/Workflows"

echo "Workflow integrity checks:"
for wf in Triage Brief Followup Morning; do
  FILE="$WORKFLOWS_DIR/$wf.md"
  if [ -f "$FILE" ]; then
    head -1 "$FILE" | grep -q "^---" && FM="OK" || FM="ERR"
    grep -q 'voice\.sh' "$FILE" && VOICE="OK" || VOICE="ERR"
    echo "  $wf: frontmatter=$FM voice=$VOICE"
  else
    echo "  $wf: MISSING"
  fi
done
```

**Expected:** Every workflow file has valid frontmatter AND a `voice.sh` notification call.

---

## User Artifact Checks (Informational)

These checks are NOT blocking — user artifacts are seeded once from templates and then owned by the user. Missing or partially-filled files are normal, not errors.

```bash
USER_DIR="$HOME/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff"

echo "User artifacts:"
if [ -f "$USER_DIR/principal.md" ]; then
  echo "  OK principal.md present"
  grep -q "{principal_name}" "$USER_DIR/principal.md" && echo "  INFO principal.md still has placeholder values (user has not filled in yet)"
else
  echo "  INFO principal.md not yet seeded — will be created on first skill invocation"
fi

if [ -f "$USER_DIR/rules.md" ]; then
  echo "  OK rules.md present"
else
  echo "  INFO rules.md not yet seeded — will be created on first skill invocation"
fi

if [ -f "$USER_DIR/commitments.md" ]; then
  echo "  OK commitments.md present (will be read by Brief and Morning workflows)"
else
  echo "  INFO commitments.md not yet created — will be created on first Followup run"
fi
```

---

## Delegated Skill Checks (Informational)

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Delegated skills (optional):"
[ -d "$CLAUDE_DIR/skills/Research" ] && echo "  AVAILABLE Research (enables Brief attendee enrichment)" || echo "  UNAVAILABLE Research (Brief will skip enrichment)"
[ -d "$CLAUDE_DIR/skills/Investigation" ] && echo "  AVAILABLE Investigation (enables deep Tier-1 due diligence)" || echo "  UNAVAILABLE Investigation (Brief will skip deep due diligence)"
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## ChiefOfStaff Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/chief-of-staff/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] Workflows/ directory contains 4 workflow files
- [ ] Templates/ directory contains 2 template files

### Workflows Present
- [ ] Triage.md
- [ ] Brief.md
- [ ] Followup.md
- [ ] Morning.md

### Workflow Integrity
- [ ] Every workflow has valid YAML frontmatter
- [ ] Every workflow contains the voice notification curl block

### Templates
- [ ] principal.md template
- [ ] rules.md template

### User Artifacts (seeded, not required)
- [ ] ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md (seeded from template)
- [ ] ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/rules.md (seeded from template)

### Delegated Skills (optional)
- [ ] research skill available (attendee enrichment)
- [ ] investigation skill available (deep due diligence)

### Functional (manual test)
- [ ] Saying "morning brief" triggers the Morning workflow
- [ ] Saying "triage my inbox" triggers the Triage workflow
- [ ] Saying "brief me on {name}" triggers the Brief workflow
- [ ] Saying "follow up on that meeting" triggers the Followup workflow
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "chief-of-staff skill installation verified successfully"
2. **Prompt next step:** "Open ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md and fill in your voice samples and Tier-1 contacts to unlock the full skill"
3. **Recommend first run:** "Try 'morning brief' for a sample daily brief, or 'triage my inbox' with a few pasted messages"
