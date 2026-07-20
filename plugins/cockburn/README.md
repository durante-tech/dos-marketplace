---
name: Cockburn
pack-id: durante-cockburn-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Alistair Cockburn — review architectures through the Hexagonal/Ports-and-Adapters lens, write use cases at the right goal level, pick the lightest Crystal-family methodology that fits team size and criticality. Verbatim quote bank from Writing Effective Use Cases, Agile Software Development, Crystal Clear, Hexagonal Architecture (2005), Heart of Agile. Knows when to step aside (real-time, FP, formal methods, distributed sagas, AI codegen). USE WHEN cockburn, alistair cockburn, what would cockburn say, channel alistair, hexagonal architecture review, ports and adapters, walking skeleton, write use case, goal level, primary actor, stakeholders and interests, crystal methodology, heart of agile, cooperative game, information radiator, shu ha ri, methodology weight, pick methodology. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [cockburn, alistair cockburn, what would cockburn say, channel alistair, hexagonal architecture review, ports and adapters, walking skeleton, write use case, goal level, primary actor, stakeholders and interests, crystal methodology]
---

# Alistair Cockburn

> Cockburn's frameworks on tap — Hexagonal Architecture, Use Case goal levels, Crystal methodology selection, Heart of Agile.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **Cockburn** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Alistair: 42 verbatim quotes, hex-pattern diagnosis, goal-level use case writing, methodology-weight selection.

**Core capabilities:**

- **Architect** — `Workflows/Architect.md`
- **PickMethodology** — `Workflows/PickMethodology.md`
- **WriteUseCase** — `Workflows/WriteUseCase.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the Cockburn pack from DOS/Packs/cockburn/"
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
- Files in src/: 10
- Workflows: 3
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **Architect** | `src/Workflows/Architect.md` |
| **PickMethodology** | `src/Workflows/PickMethodology.md` |
| **WriteUseCase** | `src/Workflows/WriteUseCase.md` |

---

## Invocation Scenarios

- `architect` workflow — see `src/Workflows/Architect.md` for triggers and behavior
- `PickMethodology` workflow — see `src/Workflows/PickMethodology.md` for triggers and behavior
- `WriteUseCase` workflow — see `src/Workflows/WriteUseCase.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Cockburn/
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
