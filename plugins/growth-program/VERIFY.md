# GrowthProgram Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before
> declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
test -f "$CLAUDE_DIR/skills/growth-program/SKILL.md" && echo "OK: SKILL.md" || echo "MISSING: SKILL.md"
```

### Check the 8 workflows exist

```bash
for w in RunProgram BrandChannelStrategy CampaignCalendar MaterialsEngine PresenceOps GeoPillar Measurement Coordination; do
  test -f "$CLAUDE_DIR/skills/growth-program/Workflows/$w.md" && echo "OK: $w" || echo "MISSING: $w"
done
```

### Check the 5 council seats exist

```bash
for a in creative channel strategist analyst skeptic; do
  test -f "$CLAUDE_DIR/skills/growth-program/Agents/growth-$a.md" && echo "OK: $a" || echo "MISSING: $a"
done
```

### Check references

```bash
for r in output-contract integrity-guard; do
  test -f "$CLAUDE_DIR/skills/growth-program/References/$r.md" && echo "OK: $r" || echo "MISSING: $r"
done
```

---

## Behavioral Verification

Invoke `/growth-program <campaign-subject>` and confirm it: (1) mines repo + brand baseline before asking,
(2) runs the 7 phases with the 5-seat council, (3) writes `docs/growth/` and stops at the program +
first material batch (does NOT auto-publish), (4) quarantines any unsourced stat in a do-not-cite block.
