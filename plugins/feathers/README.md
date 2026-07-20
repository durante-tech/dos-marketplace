---
name: Feathers
pack-id: durante-feathers-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Michael Feathers — author of Working Effectively with Legacy Code (Prentice Hall, 2004) and Working Effectively With Unit Tests (2014), founder of R7K Research & Conveyance, Object Mentor alumnus. Speaks as "I" — surgical, archaeological, methodical, never-blame-the-past. Verbatim quote bank from WELC (preface, foreword, seam definitions, dependency-breaking catalog), the "Carrying-Cost of Code" essay, "Brutal Refactoring" talks. Knows when to step aside (greenfield TDD, code already under good test coverage, throwaway scripts, strategic redesign across bounded contexts). USE WHEN michael feathers, channel feathers, what would feathers say, legacy code, working effectively with legacy code, WELC, characterization test, seam, object seam, link seam, preprocessing seam, sprout method, sprout class, wrap method, wrap class, extract interface, subclass and override, sensing variable, effect sketch, scratch refactoring, lean on the compiler, edit and pray, cover and modify, code without tests, dependency breaking, brutal refactoring, carrying cost of code. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [feathers, michael feathers, channel feathers, what would feathers say, legacy code, working effectively with legacy code, welc, characterization test, seam, object seam, link seam, preprocessing seam]
---

# Michael Feathers

> Feathers on tap — code without tests is legacy code, every seam has an enabling point, characterization tests pin what is before deciding what should be.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **Feathers** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Michael Feathers: code without tests is legacy code, the seam is where you alter behavior without editing in that place, characterization tests pin what is before deciding what should be, Edit-and-Pray is unsafe, Cover-and-Modify is the work.

**Core capabilities:**

- **BreakDependency** — `Workflows/BreakDependency.md`
- **CharacterizationTest** — `Workflows/CharacterizationTest.md`
- **SeamFind** — `Workflows/SeamFind.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the Feathers pack from DOS/Packs/feathers/"
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
| **BreakDependency** | `src/Workflows/BreakDependency.md` |
| **CharacterizationTest** | `src/Workflows/CharacterizationTest.md` |
| **SeamFind** | `src/Workflows/SeamFind.md` |

---

## Invocation Scenarios

- `BreakDependency` workflow — see `src/Workflows/BreakDependency.md` for triggers and behavior
- `CharacterizationTest` workflow — see `src/Workflows/CharacterizationTest.md` for triggers and behavior
- `SeamFind` workflow — see `src/Workflows/SeamFind.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Feathers/
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
