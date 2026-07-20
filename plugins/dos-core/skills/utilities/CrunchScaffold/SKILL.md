---
disable-model-invocation: true
name: CrunchScaffold
description: Scaffold a new Surface Crunch skill — the meta-pattern behind DOSUpgrade, Algorithm ratification, and TrackBootstrap. Given a parameterized domain brief it stamps a DRAFT skill (skeleton + decisions-checklist) from the surface-crunch-skill bundle and hands it to CreateSkill. USE WHEN scaffold a surface crunch skill, new research-package skill, crunch scaffold, build a DOSUpgrade-shaped skill, meta-pattern skill, surface crunch skill, generate a crunch skill, scaffold crunch, bifocal survey skill, list crunch skills, surface crunch family, crunch catalog.
role: executor
accepts:
  - text
roots:
  - INSTALL
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/CrunchScaffold/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# CrunchScaffold

**Primary Purpose:** scaffold a new **Surface Crunch** skill from a parameterized
domain brief.

Surface Crunch is the recurring DOS meta-pattern behind **DOSUpgrade**, **Algorithm
ratification**, and **TrackBootstrap**: *a wide bifocal Surface is decomposed under
Extraction Contracts and converged into a ranked Tiering against Targets*. Canonical
reference: `MEMORY/CANONICAL/surface-crunch-pattern.md`.

CrunchScaffold is **not** a generic skill scaffolder — that is `CreateSkill`.
CrunchScaffold is Surface-Crunch-specific: it knows the pattern's shape, asks the
right parameterized brief, stamps the `surface-crunch-skill` template bundle, and
hands the result to CreateSkill for the generic build mechanics.

## What it produces — a DRAFT, by design

CrunchScaffold stamps the Surface Crunch *structure* and itemises the *judgment work*
— it never invents the judgment. The output is:

1. A **draft skill** in pack source `Packs/utilities/src/<NewSkill>/` — skeleton with
   `[[FILL: ...]]` markers where domain knowledge is required (`dos-build.ts`
   propagates the built copy to live `skills/` later, after the checklist is worked).
2. A **`decisions-checklist.md`** enumerating that irreducible domain work (per-Surface
   Extraction Contracts, the scoring rubric, Tier thresholds, the dedup key).
3. A **provenance header** in every stamped file (`minted-by: CrunchScaffold`,
   brief-hash) so a minted family is greppable and retirable in one sweep.

The draft is deliberately not runnable until the checklist is worked. This is the
Council ruling: a scaffolder that guesses domain content produces plausible-but-wrong
skills.

## Workflow Routing

| Workflow | Trigger | File |
|---|---|---|
| **Scaffold** | "scaffold a surface crunch skill", "new research-package skill", "build a DOSUpgrade-shaped skill for X", "crunch scaffold X" | `Workflows/Scaffold.md` |
| **Catalog** | "list crunch skills", "surface crunch family", "crunch catalog", "what surface crunch skills exist" | `Workflows/Catalog.md` |

**Default:** a request to *create* a Surface Crunch skill routes to **Scaffold**; a
request to *inspect* the family routes to **Catalog**.

## Examples

**Example 1: Scaffold a competitive-intelligence Crunch**
```
User: "Scaffold a surface crunch skill for competitor moves — inward: my Telos and
       deals; outward: competitor blogs and changelogs; 4 tiers."
→ Routes to Workflows/Scaffold.md
→ Collects the domain brief; discovery-first probe confirms no existing instance
→ Stamps the surface-crunch-skill bundle → draft skills/utilities/CompetitiveIntel/
→ Emits decisions-checklist.md; hands the draft to CreateSkill (dos-build, lint)
→ User gets a draft Crunch skill + a checklist of the domain work left to do
```

**Example 2: Decline — pattern does not fit**
```
User: "Scaffold a surface crunch skill that converts one PDF to text."
→ Scaffold workflow's fit-check fails (no enumerable Surface, single linear answer)
→ Skill DECLINES with reason; routes the user to CreateSkill (generic) instead
→ No draft written
```

**Example 3: Inspect the family**
```
User: "What Surface Crunch skills exist?"
→ Routes to Workflows/Catalog.md
→ Reads surface-crunch-pattern.md + greps skills/ for the provenance header
→ Returns the instance table: DOSUpgrade, Algorithm-ratification, TrackBootstrap, + any minted
```

## Sibling pattern

CrunchScaffold is the **scaffolder** of the Surface Crunch family; DOSUpgrade,
TrackBootstrap, and Algorithm ratification are its **instances**. CrunchScaffold
composes — never duplicates — `CreateSkill` for the generic skill-construction
mechanics (`dos-build.ts`, `scaffold-pack-docs.ts`, `lint-skills.ts`, Sentinel).

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"CrunchScaffold","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/utilities/CrunchScaffold/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/utilities/CrunchScaffold/` — active release submodule (versioned)
3. `Packs/*/src/CrunchScaffold/` — pack source (distributable)
4. `Packs/agents/CrunchScaffold/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
