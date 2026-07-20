---
name: Catalog
description: List and inspect the Surface Crunch skill instance family.
status: STABLE
---

# Catalog Workflow

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Catalog workflow in the CrunchScaffold skill to inspect the Surface Crunch family"
```

Running the **Catalog** workflow in the **CrunchScaffold** skill...

Lists and inspects the **Surface Crunch** instance family — the skills that share the
meta-pattern. Pattern doctrine: `MEMORY/CANONICAL/surface-crunch-pattern.md`.

**Trigger:** "list crunch skills", "surface crunch family", "crunch catalog", "what
Surface Crunch skills exist".

---

## Step 1: Read the canonical roster

Read `MEMORY/CANONICAL/surface-crunch-pattern.md` → the "4 instances" tables. These
are the *hand-authored* instances of record: DOSUpgrade, Algorithm ratification,
TrackBootstrap, plus CrunchScaffold (the scaffolder).

## Step 2: Discover minted instances

Find skills stamped by CrunchScaffold via their provenance header:
```bash
grep -rl "minted-by: CrunchScaffold" ~/.claude/skills/ 2>/dev/null
```
For each hit, extract the `brief-hash` and timestamp from the header.

## Step 3: Classify draft vs complete

For each minted skill, check whether any `[[FILL: ...]]` markers remain anywhere in the
skill directory — not just one file:
```bash
grep -rl "\[\[FILL:" ~/.claude/skills/utilities/<Skill>/ 2>/dev/null
```
- any file matches → **draft** (checklist not fully worked)
- zero matches, `decisions-checklist.md` all checked → **complete**

## Step 4: Report

Emit a table:

```markdown
# Surface Crunch Family
| Instance | Type | Bifocal | Tiers | State | Provenance |
|----------|------|---------|-------|-------|------------|
| DOSUpgrade | hand-authored | yes | 4 | complete | — |
| Algorithm ratification | hand-authored | inward-only | list | complete | — |
| TrackBootstrap | hand-authored | outward-only | sub-track PRDs | complete | — |
| <minted skill> | minted | <mode> | <N> | draft/complete | brief-hash <hash> |
```

Note any **draft** instances whose `decisions-checklist.md` is unfinished — these are
the operator's open work items.

## Artifact Tracking

Catalog is read-only — no artifact log entry required.
