---
name: lifecycle
pack-id: durante-lifecycle-v1.0.0
version: 1.0.0
author: durante-tech
description: Capability lifecycle discipline for DOS — deprecate, migrate, and retire packs, skills, hooks, tools, and adopted imports with verified closure. USE WHEN retire pack, retire skill, retire hook, retire tool, deprecate, deprecation, sunset, remove capability, tombstone, kill feature, decommission, end of life, EOL, zombie code, dead code, unused pack, migrate surface, version migration, live-tree migration, freeze retarget, strangler fig, expand contract, remove import, upstream dormant, sunset import, native absorption. NOT for version-freeze mechanics (release.sh / dos-release-freeze.ts own the freeze), MemPalace substrate cleanup (use MemPalace), or marketplace de-listing (operator-executed outbound).
type: skill
role: workflow
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [lifecycle, retire pack, retire skill, retire hook, retire tool, deprecate, deprecation, sunset, remove capability, tombstone, kill feature, decommission]
---

# Lifecycle

> Retire, migrate, and sunset capabilities with verified closure — the discipline of subtraction

---

## The Problem

Operating lifecycle capabilities ad-hoc loses the packaged contract — workflows, tools, manifests — that makes the surface installable and reproducible across hosts.

---

## The Solution

The **lifecycle** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.


**Core capabilities:**

- **MigrateSurface** — `Workflows/MigrateSurface.md`
- **Retire** — `Workflows/Retire.md`
- **SunsetImport** — `Workflows/SunsetImport.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the lifecycle pack from DOS/Packs/lifecycle/"
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
| Workflows | `src/Workflows/` | 3 workflow definition(s) |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 1 (Workflows)
- Files in src/: 7
- Workflows: 3
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **MigrateSurface** | `src/Workflows/MigrateSurface.md` |
| **Retire** | `src/Workflows/Retire.md` |
| **SunsetImport** | `src/Workflows/SunsetImport.md` |

---

## Invocation Scenarios

- `MigrateSurface` workflow — see `src/Workflows/MigrateSurface.md` for triggers and behavior
- `Retire` workflow — see `src/Workflows/Retire.md` for triggers and behavior
- `SunsetImport` workflow — see `src/Workflows/SunsetImport.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/lifecycle/
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

### 1.0.0 - $(date +%Y-%m-%d)
- Initial published version with canonical pack-distribution scaffolding (INSTALL.md / README.md / VERIFY.md)
- See git history for prior incremental commits
