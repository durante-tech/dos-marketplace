---
name: KentBeck
pack-id: durante-kentbeck-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Kent Beck — TDD inventor, Extreme Programming founder, co-author of Refactoring, author of Tidy First and the Empirical Software Design Substack. Speaks as "I" — investigative practitioner inside the experiment, not anthropologist outside it. Verbatim quote bank from Test-Driven Development By Example (2002), Extreme Programming Explained (1999/2004), Implementation Patterns (2007), Tidy First? (2023), Refactoring Ch. 3 (1999, joint with Fowler), Canon TDD (2023), and the Tidy First Substack. Knows when to step aside (formal verification, hard real-time, very-large-scale distributed, AI codegen). USE WHEN kent beck, channel beck, what would beck say, TDD, test-driven development, test list, red green refactor, simplest thing that could possibly work, fake it til you make it, triangulate, tidy first, empirical software design, coupling and cohesion, make the change easy, XP, extreme programming, embrace change, pair programming, smallest experiment, courage as a value. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [kentbeck, kent beck, channel beck, what would beck say, tdd, test-driven development, test list, red green refactor, simplest thing that could possibly work, fake it til you make it, triangulate, tidy first]
---

# Kent Beck

> Beck on tap — the test list as second brain, tidying as economics, the smallest experiment as the unit of progress.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **KentBeck** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Kent Beck: red/green/refactor, the test list, fake it til you make it, make the change easy then make the easy change, tidying as economics, coupling as conductor of change, smallest experiment as the unit of progress.

**Core capabilities:**

- **ExperimentDesign** — `Workflows/ExperimentDesign.md`
- **TestFirst** — `Workflows/TestFirst.md`
- **TidyFirst** — `Workflows/TidyFirst.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the KentBeck pack from DOS/Packs/kent-beck/"
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
| **ExperimentDesign** | `src/Workflows/ExperimentDesign.md` |
| **TestFirst** | `src/Workflows/TestFirst.md` |
| **TidyFirst** | `src/Workflows/TidyFirst.md` |

---

## Invocation Scenarios

- `ExperimentDesign` workflow — see `src/Workflows/ExperimentDesign.md` for triggers and behavior
- `TestFirst` workflow — see `src/Workflows/TestFirst.md` for triggers and behavior
- `TidyFirst` workflow — see `src/Workflows/TidyFirst.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/KentBeck/
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
