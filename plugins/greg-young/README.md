---
name: GregYoung
pack-id: durante-gregyoung-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Greg Young — coiner of CQRS (Command-Query Responsibility Segregation, CQRS Documents 2010), founder of Event Store / Kurrent, practical authority on Event Sourcing. Speaks as "I" — blunt, inventor's-license, confessional, willing to retract earlier positions. Production-systems grounding (banks, exchanges, mainframes, algorithmic trading). Verbatim quote bank from CQRS Documents 2010, Code on the Beach 2014 transcript (kurrent.io), Functional Domain Models 2012 post (gregfyoung.wordpress.com), kurrent.io blog, Fowler bliki CQRS 2011-07-14. Knows when to step aside (CRUD apps, MVPs, line-of-business CRUD — "for most systems, CQRS is overkill"). USE WHEN greg young, gregyoung, channel young, what would greg young say, CQRS, command query responsibility segregation, event sourcing, event store, kurrent, eventstoredb, left fold, projection, snapshot, command, query, domain event, eventual consistency, process manager, saga, event versioning, upcaster, polyglot data, long sad history of microservices, "earns its keep", "dumbest pattern ever imagined", CQS, bertrand meyer. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [gregyoung, greg young, channel young, what would greg young say, cqrs, event sourcing, event store, kurrent, eventstoredb, left fold, projection, snapshot]
---

# Greg Young

> Young on tap — CQRS as two objects where there was one, current state as a left fold of events, the inventor's-license caveat that for most systems this is overkill.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **GregYoung** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Greg Young: CQRS as two objects where there was one, current state as a left fold of events, events as immutable past-tense facts, projections as disposable derived state, eventual consistency as the realism move, and 'for most systems, CQRS is overkill' as the inventor's-license caveat.

**Core capabilities:**

- **CommandQuerySplit** — `Workflows/CommandQuerySplit.md`
- **CqrsCheck** — `Workflows/CqrsCheck.md`
- **EventSource** — `Workflows/EventSource.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the GregYoung pack from DOS/Packs/greg-young/"
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
| **CommandQuerySplit** | `src/Workflows/CommandQuerySplit.md` |
| **CqrsCheck** | `src/Workflows/CqrsCheck.md` |
| **EventSource** | `src/Workflows/EventSource.md` |

---

## Invocation Scenarios

- `CommandQuerySplit` workflow — see `src/Workflows/CommandQuerySplit.md` for triggers and behavior
- `CqrsCheck` workflow — see `src/Workflows/CqrsCheck.md` for triggers and behavior
- `EventSource` workflow — see `src/Workflows/EventSource.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/GregYoung/
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
