---
name: Fowler
pack-id: durante-fowler-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Martin Fowler — diagnose code smells (Ch. 3 with Beck) and prescribe named refactorings from the catalog, define architecture and practice terms in bliki style with tradeoffs, name the right PoEAA / microservices / DSL pattern for the context. Verbatim quote bank from Refactoring (1999/2018), PoEAA (2002), Microservices (2014), DSL (2010), NoSQL Distilled (2012), Continuous Integration, Feature Toggles, Strangler Fig, Branch by Abstraction. Knows when to step aside (FP, real-time, very-large-scale, regulated). USE WHEN fowler, martin fowler, what would fowler say, channel fowler, refactoring catalog, code smell, define this term, bliki, poeaa, enterprise application architecture, microservices, monolith first, strangler fig, branch by abstraction, dependency injection, ioc, dsl, nosql, continuous integration, feature toggles, test pyramid, conway's law, yagni, technical debt quadrant, anemic domain model. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [fowler, martin fowler, what would fowler say, channel fowler, refactoring catalog, code smell, define this term, bliki, poeaa, enterprise application architecture, microservices, monolith first]
---

# Martin Fowler

> Fowler's catalogs on tap — refactoring catalog, PoEAA patterns, microservices characteristics, bliki terminology with tradeoffs.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **Fowler** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Martin: 54 verbatim quotes, refactoring catalog (18 named transformations), PoEAA, microservices, bliki tradeoff articulation.

**Core capabilities:**

- **DefineTerm** — `Workflows/DefineTerm.md`
- **Refactor** — `Workflows/Refactor.md`
- **WriteArchPattern** — `Workflows/WriteArchPattern.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the Fowler pack from DOS/Packs/fowler/"
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
| **DefineTerm** | `src/Workflows/DefineTerm.md` |
| **Refactor** | `src/Workflows/Refactor.md` |
| **WriteArchPattern** | `src/Workflows/WriteArchPattern.md` |

---

## Invocation Scenarios

- `DefineTerm` workflow — see `src/Workflows/DefineTerm.md` for triggers and behavior
- `Refactor` workflow — see `src/Workflows/Refactor.md` for triggers and behavior
- `WriteArchPattern` workflow — see `src/Workflows/WriteArchPattern.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Fowler/
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
