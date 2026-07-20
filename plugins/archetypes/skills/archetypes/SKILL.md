---
name: Archetypes
description: Feature-archetype completeness matrices — market-grounded, tiered (table-stakes/expected/delighter) capability checklists with seed ISCs, plus gap audits of shipped features and PLAN-time scope seeding with explicit deferral ledgers. Closes the solo-builder breadth gap (depth-verified features that miss basics a full team would catch). USE WHEN archetype, feature archetype, completeness matrix, gap ledger, feature completeness, table stakes, what's missing from this feature, full-featured feature, audit feature completeness, seed scope ISCs, deferral ledger, scope seeding, mint archetype, archetype audit. NOT for bug-hunting review (use /code-review), convention conformance (use Sentinel), or feature delivery itself (use MakerkitTeam/FastAPIStarterTeam/FeatureDelivery — this pack feeds their spec stage).
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Archetypes/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Archetypes

Institutional product judgment as typed data. Each archetype (media library, notifications, audit log, ...) is a versioned completeness matrix: capabilities tiered T1 table-stakes / T2 expected / T3 delighter, grounded in two live-mined market cohorts, each row carrying a fork-agnostic seed ISC and anti-criteria. Three workflows close the loop: mint matrices, audit shipped features into evidence-cited gap ledgers, and seed feature PRDs so every table-stakes capability is **built or explicitly deferred — never silently absent**.

**Status:** v0.0.1 — media/asset-library archetype (42 rows, 6 anti-criteria) + Author/Audit/Seed workflows + zero-dep validator/renderer

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **AuthorArchetype** | "mint an archetype", "create a completeness matrix for X", "extend the X archetype" | `Workflows/AuthorArchetype.md` |
| **AuditFeature** | "audit this feature's completeness", "gap ledger for X", "what's missing from our X" | `Workflows/AuditFeature.md` |
| **SeedScope** | "seed scope ISCs", "apply the archetype to this PRD", "deferral ledger for this feature" | `Workflows/SeedScope.md` |

## Data Model

- `Schema/Archetype.ts` — typed source of truth (schema-first: markdown matrices are generated projections, never hand-edited).
- `Data/*.archetype.ts` — the corpus; one module per archetype, default-exporting an `Archetype`.
- `Tools/ValidateArchetype.ts` — corpus validator (unique ids, tier rules, T1 grounding, seed-ISC length). Exit 0/1/2.
- `Tools/RenderArchetype.ts` — markdown projection (`--list`, `<name>`, `--out FILE`).

Both tools are zero-external-dep by design — they run from the live install without node_modules.

## Examples

**Example 1: Audit a shipped feature**
```
User: "How complete is the kit's media feature, really?"
→ Invokes AuditFeature workflow
→ Matches media-asset-library archetype, spawns read-only inventory agent, verdicts all 42 rows
→ User gets a gap ledger: scoreboard, T1-absent headline, matrix-derived v-next priority order
```

**Example 2: Seed a new feature's scope**
```
User: "We're building notifications in the fork — seed the scope ISCs"
→ Invokes SeedScope workflow
→ Emits scope-layer criteria into the PRD: every T1 row build-or-DEFERRED, riders resolved
→ Delivery carries an explicit deferral ledger instead of silent scope gaps
```

**Example 3: Mint a new archetype**
```
User: "Create a completeness matrix for audit logs"
→ Invokes AuthorArchetype workflow
→ Two-cohort live mining (in-app products + dedicated services), tiered synthesis, typed encoding
→ User gets Data/AuditLog.archetype.ts, validator-clean, rendered for review
```

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Archetypes","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/archetypes/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/archetypes/` — active release submodule (versioned)
3. `Packs/archetypes/src/` — pack source (distributable)
4. `Packs/agents/archetypes/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
