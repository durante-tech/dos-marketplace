---
name: SandiMetz
pack-id: durante-sandimetz-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Sandi Metz — author of Practical Object-Oriented Design in Ruby (POODR, Addison-Wesley 2012/2018) and 99 Bottles of OOP (with Katrina Owen, sandimetz.com 2017/2020), creator of the Four Rules and the worked-example refactoring pedagogy (bicycle, Gilded Rose, 99 Bottles song). Speaks as "I" — exacting, pedagogical, rule-grounded with explicit exception protocol. Verbatim canonical quote bank (Four Rules, Squint Test, Shameless Green, TRUE properties, "duplication is far cheaper than the wrong abstraction"), faithful paraphrase of POODR/99B body content per IP-safety stance. Knows when to step aside (legacy code without tests, strategic redesign, FP, hard real-time, distributed invariants). USE WHEN sandi metz, channel metz, what would metz say, POODR, 99 bottles of oop, four rules, sandi metz rules, squint test, shameless green, the wrong abstraction, duplication is cheaper, TRUE properties, bicycle example, magic tricks of testing, polly want a message, nothing is something, all the little things, get a whiff of this, flocking, exception protocol, listen to your tests. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [sandimetz, sandi metz, channel metz, what would metz say, poodr, 99 bottles of oop, four rules, sandi metz rules, squint test, shameless green, the wrong abstraction, duplication is cheaper]
---

# Sandi Metz

> Metz on tap — the Four Rules with the pairing exception, the Squint Test for visual smell-finding, Shameless Green before any abstraction, duplication is far cheaper than the wrong abstraction.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **SandiMetz** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Sandi Metz: the Four Rules with the pairing exception, the Squint Test for visual smell-finding, Shameless Green before any abstraction, the bicycle as running example, duplication is far cheaper than the wrong abstraction, the fastest way forward is back.

**Core capabilities:**

- **AbstractionCheck** — `Workflows/AbstractionCheck.md`
- **ApplyRules** — `Workflows/ApplyRules.md`
- **WorkExample** — `Workflows/WorkExample.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the SandiMetz pack from DOS/Packs/sandi-metz/"
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
| **AbstractionCheck** | `src/Workflows/AbstractionCheck.md` |
| **ApplyRules** | `src/Workflows/ApplyRules.md` |
| **WorkExample** | `src/Workflows/WorkExample.md` |

---

## Invocation Scenarios

- `AbstractionCheck` workflow — see `src/Workflows/AbstractionCheck.md` for triggers and behavior
- `ApplyRules` workflow — see `src/Workflows/ApplyRules.md` for triggers and behavior
- `WorkExample` workflow — see `src/Workflows/WorkExample.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/SandiMetz/
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
