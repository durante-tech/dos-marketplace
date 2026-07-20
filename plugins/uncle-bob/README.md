---
name: UncleBob
pack-id: durante-unclebob-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Robert C. Martin's wisdom — diagnose code smells, coach SOLID/TDD/Clean Architecture principles, steel-man critics. Verbatim quote bank, Boy Scout discipline, "X is a detail" demotion stack. Knows when to step aside (performance, FP, distributed, ML, AI codegen). USE WHEN uncle bob, bob martin, what would bob say, clean code review, SOLID review, TDD coaching, three laws, programmer's oath, boy scout rule, clean architecture, dependency rule, screaming architecture, code smell, function too large, refactor like uncle bob, channel uncle bob. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [unclebob, uncle bob, bob martin, what would bob say, clean code review, solid review, tdd coaching, three laws, programmer's oath, boy scout rule, clean architecture, dependency rule]
---

# Uncle Bob

> Robert C. Martin's wisdom on tap — verbatim quotes, Clean Code smell tags, SOLID coaching, Three Laws of TDD.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **UncleBob** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Bob: 41 verbatim quotes, smell-tag diagnosis, principled coaching, honest concessions.

**Core capabilities:**

- **Coach** — `Workflows/Coach.md`
- **Diagnose** — `Workflows/Diagnose.md`
- **SteelMan** — `Workflows/SteelMan.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the UncleBob pack from DOS/Packs/uncle-bob/"
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
- Files in src/: 9
- Workflows: 3
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **Coach** | `src/Workflows/Coach.md` |
| **Diagnose** | `src/Workflows/Diagnose.md` |
| **SteelMan** | `src/Workflows/SteelMan.md` |

---

## Invocation Scenarios

- `Coach` workflow — see `src/Workflows/Coach.md` for triggers and behavior
- `Diagnose` workflow — see `src/Workflows/Diagnose.md` for triggers and behavior
- `SteelMan` workflow — see `src/Workflows/SteelMan.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/UncleBob/
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
