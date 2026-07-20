---
name: AuditFeature
description: Retro-audit a shipped feature against its archetype matrix, producing an evidence-cited gap ledger.
divergence_from_canonical:
  _workflow-voice.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
status: STABLE
---

# AuditFeature Workflow

Answer "how complete is this shipped feature, really?" — every matrix row gets a verdict backed by file:line evidence or a grep no-hit. Reference execution: the kit media audit (`Docs/Research/feature-archetype-media-pilot.md`, dos repo).

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the AuditFeature workflow in the Archetypes skill"
```

Running the **AuditFeature** workflow in the **Archetypes** skill...

## Steps

### Step 1 — Match feature to archetype

```bash
cd ~/.claude/skills/archetypes && bun Tools/RenderArchetype.ts --list
```

If no archetype matches, run **AuthorArchetype** first (or proceed with the closest match and note the mismatch).

### Step 2 — Inventory the shipped surface (read-only agent)

Spawn a read-only Explore agent over the target repo. The prompt MUST:
- Enumerate per matrix dimension what EXISTS (file:line evidence) and what is ABSENT (explicit grep pattern + no-hit).
- Include the archetype's row list so the agent probes every row, not just what it notices.
- Forbid modifications.

### Step 3 — Verdict every row

For each matrix row emit a `LedgerEntry` (see `Schema/Archetype.ts`):

| Verdict | Meaning | Evidence requirement |
|---|---|---|
| BUILT | Works as the seed ISC means | file:line |
| PARTIAL | Exists narrower than the row means | file:line + what's missing |
| ABSENT | Not present | grep pattern + no-hit, **re-verified by the primary agent** for T1 rows |
| AHEAD | Exceeds the market baseline | file:line + market count |
| DEFERRED | Consciously out of scope | pointer to the deferral decision |

**Never assert ABSENT on a T1 row from the sub-agent's report alone — re-run the grep yourself.**

### Step 4 — Report

Produce the gap-ledger report: scoreboard (rows × tier × verdict), the T1-absent list (the headline), and a matrix-derived next-version priority order (tier × absence). Feed genuinely-new capabilities discovered in the audited product back into the matrix via **AuthorArchetype** (compounding loop).

### Step 5 — Persist

Resolve project-level MEMORY and write the report:

```bash
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/RESEARCH" ]; then
  RESEARCH_BASE="${CLAUDE_PROJECT_DIR}/MEMORY/RESEARCH"
elif [ -d "$(pwd)/MEMORY/RESEARCH" ]; then
  RESEARCH_BASE="$(pwd)/MEMORY/RESEARCH"
else
  RESEARCH_BASE="$HOME/.claude/MEMORY/RESEARCH"
fi
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
# write: $RESEARCH_BASE/$(date +%Y-%m)/archetype-audit-<feature>-$(date +%Y%m%d).md
```

Log the artifact per the Artifact Tracking section of `SKILL.md` (type: `gap-ledger`).

## Intent-to-Flag Mapping

### Matrix retrieval

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "which archetypes exist", "do we have one for X" | `RenderArchetype.ts --list` | Step 1 matching |
| "show me the matrix first" | `RenderArchetype.ts <name>` | Reviewing rows before the audit |
| "audit against a saved copy" | `RenderArchetype.ts <name> --out <path>` | Handing the matrix to a sub-agent |

## Output

- Gap-ledger report in `MEMORY/RESEARCH/{YYYY-MM}/` with scoreboard + T1-absent headline + priority order.
- Matrix extension candidates routed to AuthorArchetype.
