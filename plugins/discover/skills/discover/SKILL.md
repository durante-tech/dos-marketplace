---
name: Discover
description: Discovery conductor — interview an operator's clear-but-unwritten feature intent inside a dos-prisma-saas-kit fork and emit the validated, constraint-first rich folder that /forge Tier 1 consumes. Sits BEFORE /forge. USE WHEN discover, feature discovery interview, unwritten feature intent, interview feature intent, pre-forge discovery, rich folder for forge, discovery conductor. NOT for PRD authoring (use PRD), build-order classification (use /forge), or pre-PRD research fan-out (use the feature-discovery workflow — /discover interviews, it does not research).
role: coordinator
accepts:
  - text
icon: Compass
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Delivery
displayLabel: Discover
marketingDescription: Interview unwritten feature intent into a forge-ready discovery folder
elevator: Turn clear-but-unwritten feature intent into the folder /forge consumes
highlightWorkflows: []
roots: []
visibility: public
capabilities:
  - customization.cascade
  - four-copy.sync
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Discover/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Discover

Turn an operator's clear-but-unwritten feature intent into the validated, constraint-first rich folder that `/forge` Tier 1 consumes. `/discover` is a thin front door: the interview and the emitted folder are the only things it owns.

## Command

| Command | Purpose |
|---------|---------|
| `/discover <feature intent>` | Ground the fork, interview the intent, emit the `MEMORY/RESEARCH/{ts}_{name}/` rich folder |

**Procedure:** the full conductor procedure lives in `commands/discover.md` (the command body IS the workflow implementation — there is no `Workflows/` directory in this pack). The deterministic stages are pack modules under `src/Tools/` (validator / ground / interview / emit), each unit-tested.

## Boundaries (invariants)

- NEVER classifies SKIP-vs-RUN or picks build-order stages — that is `/forge` Tier 0.
- NEVER invokes `feature-discovery` or `prd-isc-fanout` — `/forge` owns invocation.
- NEVER writes a PRD — `Skill("prd")` / `/forge` Tier 2 own the system of record.
- NEVER writes outside the emitted `MEMORY/RESEARCH/{ts}_{name}/` folder.
- Requires a dos-prisma-saas-kit fork (`.fork-slot` + `.claude/kit-conventions.md`); blocks loudly anywhere else, including the DOS repo itself.

## Examples

```
/discover members should be able to pin dashboard widgets

→ GROUND reads the fork facade (layer-2 fresh, slot 3, 12 prior PRDs)
→ interview captures constraints (roles, persistence, mobile behavior)
→ emits MEMORY/RESEARCH/20260706-161200_pin-dashboard-widgets/ for /forge
```

```
/discover CSV export for the billing table

→ GROUND blocks: not a kit fork (.fork-slot missing) — stops loudly,
  no interview, nothing emitted
```

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/discover/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/discover/` — active release submodule (versioned)
3. `Packs/*/src/{{skill_name}}/` — pack source (distributable)
4. `Packs/agents/{{skill_name}}/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
