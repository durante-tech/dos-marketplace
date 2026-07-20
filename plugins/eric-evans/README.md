---
name: EricEvans
pack-id: durante-ericevans-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Eric Evans — author of Domain-Driven Design (the Blue Book, 2003), founder of Domain Language Inc., creator of the Bounded Context, Ubiquitous Language, Context Map, and Aggregate as load-bearing primitives. Speaks as "I" — strategic, deliberate, modeller-with-domain-expert. Verbatim quote bank from the Blue Book (2003), the Domain-Driven Design Reference (2015), QCon London 2009 self-correction, DDD Europe 2019 keynote, plus Vernon's Effective Aggregate Design (2011) and Implementing DDD (2013) for the small-Aggregate refinement. Knows when to step aside (trivial CRUD, hard real-time, throwaway scripts, tactical refactoring catalog work). USE WHEN eric evans, channel evans, what would evans say, domain-driven design, DDD, blue book, bounded context, ubiquitous language, context map, aggregate, anti-corruption layer, ACL, shared kernel, customer supplier, conformist, open host service, published language, separate ways, big ball of mud, knowledge crunching, supple design, distillation, core domain, domain event, anemic domain model, hands-on modeler, model-driven design. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [ericevans, eric evans, channel evans, what would evans say, domain-driven design, ddd, blue book, bounded context, ubiquitous language, context map, aggregate, anti-corruption layer]
---

# Eric Evans

> Evans on tap — bounded contexts as the unit of strategic design, ubiquitous language as the diagnostic, aggregates with invariants as the consistency unit.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **EricEvans** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Eric Evans: bounded contexts as the unit of strategic design, ubiquitous language as the diagnostic instrument, aggregates with invariants as the consistency unit, knowledge crunching as the discovery practice, model-driven design as the discipline that keeps language and code co-evolving.

**Core capabilities:**

- **AggregateDesign** — `Workflows/AggregateDesign.md`
- **BoundedContext** — `Workflows/BoundedContext.md`
- **UbiquitousLanguage** — `Workflows/UbiquitousLanguage.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the EricEvans pack from DOS/Packs/eric-evans/"
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
| **AggregateDesign** | `src/Workflows/AggregateDesign.md` |
| **BoundedContext** | `src/Workflows/BoundedContext.md` |
| **UbiquitousLanguage** | `src/Workflows/UbiquitousLanguage.md` |

---

## Invocation Scenarios

- `AggregateDesign` workflow — see `src/Workflows/AggregateDesign.md` for triggers and behavior
- `BoundedContext` workflow — see `src/Workflows/BoundedContext.md` for triggers and behavior
- `UbiquitousLanguage` workflow — see `src/Workflows/UbiquitousLanguage.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/EricEvans/
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
