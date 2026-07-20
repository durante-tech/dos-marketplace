---
name: Build Bible
description: Creates a comprehensive 7-layer story bible mapping meaning, character change, plot, mystery, world, relationships, and prose from beginning to end, saved as a DOS-standard PRD.
status: STABLE
bestPath:
  - title: "Define the Arc Structure"
    description: "Determine story scale (short story/novella/novel) and chapter/section count."
  - title: "Map All Seven Layers"
    description: "Plan meaning, character change, plot, mystery, world, relationships, and prose start-to-finish."
  - title: "Chapter-by-Chapter Milestone Grid"
    description: "Build a grid showing what happens in each chapter across all seven layers."
  - title: "Deliver Story Bible"
    description: "Write the story bible and update the PRD with checked-off ISC criteria."
---

# Build Bible -- Master Story Plan

Create a comprehensive story bible mapping all 7 layers from beginning to end, integrated with DOS Algorithm PRD system.

## DOS Integration

**This workflow produces a DOS-standard PRD.** The 7-layer story bible is domain-specific planning that lives as subsections within `MEMORY/WORK/{slug}/PRD.md`. The chapter milestone grid and supporting docs are saved alongside the PRD.

**V13.3c PRD-scaffolding routing (RFC-0083 §5.5 split, Sprout pattern):** For vNext-format PRDs (`format_version: 3`) in standalone mode, invoke `Skill("prd", "scaffold")` instead of the legacy `mkdir + Write` sequence below. The Skill produces the vNext frontmatter + skeleton (slug derived from title); the workflow then adds story-bible-specific 7-layer subsections + chapter-milestone ISC criteria. The legacy `mkdir/Write` prose remains as fallback until v0.0.14 V14.6 retires it after a 30-day Sprout adoption soak.

**If the Algorithm is already running:** Edit the existing PRD to add story bible context and ISC criteria (one per layer mapping + one per chapter milestone).

**If invoked standalone:** Create a new PRD stub:
1. `mkdir -p MEMORY/WORK/{slug}/` (slug: `YYYYMMDD-HHMMSS_story-bible-title`)
2. Write `MEMORY/WORK/{slug}/PRD.md` with frontmatter per `~/.claude/DOS/PRDFORMAT.md`

## When to Use

After the Interview workflow has produced a structured summary, or when the user has enough story context to plan the full narrative.

## Workflow

### Step 1: Define the Arc Structure

Determine the story's scale and chapter/section count:
- **Short story:** 3-5 sections
- **Novella:** 10-15 chapters
- **Novel:** 20-40 chapters

For each chapter/section, define milestones across all seven layers.

### Step 2: Map All Seven Layers Start-to-Finish

#### Meaning Layer
- Opening thesis (what the protagonist believes)
- Midpoint challenge (first serious crack in the thesis)
- Climax synthesis (what the story proves)

#### Character Change Layer
- Sacred flaw stated or demonstrated
- Key pressure points where the flaw is tested
- Crisis moment: flaw vs growth
- Resolution: transformation or tragic failure

#### Plot Layer
- Inciting incident (cause-and-effect chain begins)
- Rising action beats (each caused by the previous)
- Midpoint reversal
- Climax sequence
- Resolution

#### Mystery Layer
- Questions planted per chapter
- Reveals timed (which chapter answers which question)
- Misdirection beats
- Final reveal

#### World Layer
- Setting established (rules, constraints, atmosphere)
- World pressure on the sacred flaw
- World expansion or revelation moments
- How setting changes reflect character change

#### Relationships Layer
- Key relationships and their starting state
- Bond evolution beats (which chapter changes which relationship)
- Relationship as mirror for internal change
- Final relationship states

#### Prose Layer
- Voice/style direction per section
- Rhetorical figures to deploy at key moments
- Tonal shifts mapped to narrative beats
- Anti-cliche watchlist (phrases to avoid)

### Step 3: Chapter-by-Chapter Milestone Grid

Create a grid showing what happens in each chapter across all layers:

```markdown
| Chapter | Meaning | Character | Plot | Mystery | World | Relationships | Prose |
|---------|---------|-----------|------|---------|-------|---------------|-------|
| 1 | [thesis established] | [flaw shown] | [inciting incident] | [question planted] | [setting introduced] | [bond established] | [voice set] |
| 2 | ... | ... | ... | ... | ... | ... | ... |
```

### Step 4: Deliver Story Bible

Write the complete story bible to the DOS PRD work directory:
- `MEMORY/WORK/{slug}/story-bible.md` — The full 7-layer bible
- `MEMORY/WORK/{slug}/PRD.md` — Updated with story context in `## Context` and ISC criteria checked off

**Never write the bible to a random project directory.** The DOS PRD work directory is the single source of truth. If the user needs it copied to a project, do so after verification.

Update the PRD: check off ISC criteria as each layer is mapped, update `progress: M/N`.

## Validation

- [ ] PRD exists at `MEMORY/WORK/{slug}/PRD.md`
- [ ] All seven layers mapped start-to-finish
- [ ] Chapter milestones defined for every layer
- [ ] Sacred flaw and transformation arc complete
- [ ] Mystery reveals timed across the narrative
- [ ] Anti-cliche watchlist established
- [ ] ISC criteria checked off in PRD