---
name: Archetypes
pack-id: durante-archetypes-v1.0.0
version: 1.0.0
author: durante-tech
description: Feature-archetype completeness matrices — market-grounded, tiered (table-stakes/expected/delighter) capability checklists with seed ISCs, plus gap audits of shipped features and PLAN-time scope seeding with explicit deferral ledgers. Closes the solo-builder breadth gap (depth-verified features that miss basics a full team would catch). USE WHEN archetype, feature archetype, completeness matrix, gap ledger, feature completeness, table stakes, what's missing from this feature, full-featured feature, audit feature completeness, seed scope ISCs, deferral ledger, scope seeding, mint archetype, archetype audit. NOT for bug-hunting review (use /code-review), convention conformance (use Sentinel), or feature delivery itself (use MakerkitTeam/FastAPIStarterTeam/FeatureDelivery — this pack feeds their spec stage).
type: skill
role: skill
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [archetypes, archetype, feature archetype, completeness matrix, gap ledger, feature completeness, table stakes, what's missing from this feature, full-featured feature, audit feature completeness, seed scope iscs, deferral ledger]
---

# Archetypes

> Feature-archetype completeness matrices — market-grounded, tiered (table-stakes/expected/delighter) capability checklists with seed ISCs, plus gap audits of shipped features and PLAN-time scope seeding with explicit deferral ledgers

---

## The Problem

Operating Archetypes capabilities ad-hoc loses the packaged contract — workflows, tools, manifests — that makes the surface installable and reproducible across hosts.

---

## The Solution

The **Archetypes** pack packages 3 workflows + 2 CLI tools behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.


**Core capabilities:**

- **AuditFeature** — `Workflows/AuditFeature.md`
- **AuthorArchetype** — `Workflows/AuthorArchetype.md`
- **SeedScope** — `Workflows/SeedScope.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the Archetypes pack from DOS/Packs/archetypes/"
```

Your AI reads `INSTALL.md` and walks through a 5-phase wizard (system analysis → user questions → backup → install → verify).

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing, configuration, documentation |
| Skill source | `src/SKILL.partials.md` | RFC-0006 partials (if present) |
| Extension manifest | `src/extension.yaml` | RFC-0002 pack manifest |
| Data | `src/Data/` | Pack data files |
| Tools | `src/Tools/` | 2 CLI/helper tool(s) |
| Workflows | `src/Workflows/` | 3 workflow definition(s) |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 4 (Data, Schema, Tools, Workflows)
- Files in src/: 11
- Workflows: 3
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **AuditFeature** | `src/Workflows/AuditFeature.md` |
| **AuthorArchetype** | `src/Workflows/AuthorArchetype.md` |
| **SeedScope** | `src/Workflows/SeedScope.md` |

---

## Invocation Scenarios

- `AuditFeature` workflow — see `src/Workflows/AuditFeature.md` for triggers and behavior
- `AuthorArchetype` workflow — see `src/Workflows/AuthorArchetype.md` for triggers and behavior
- `SeedScope` workflow — see `src/Workflows/SeedScope.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Archetypes/
```

Place per-user overrides here; they merge with base configuration at runtime where applicable.

---

## Credits

- **Pack family:** durante-tech / DOS
- **Distribution protocol:** RFC-0011 (Packs Distribution & Release Authoring)
- **Skill definition format:** RFC-0004
- **Extension manifest format:** RFC-0002

---

## Changelog

### 1.0.0 - 2026-07-08
- Initial published version with canonical pack-distribution scaffolding (INSTALL.md / README.md / VERIFY.md)
- See git history for prior incremental commits
