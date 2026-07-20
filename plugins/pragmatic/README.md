---
name: Pragmatic
pack-id: durante-pragmatic-v1.0.0
version: 1.0.0
author: durante-tech
description: Channel Andy Hunt + Dave Thomas (the Pragmatic Programmers) — find the right numbered Tip from the catalog of 100 (1st ed 70 / 20th anniv 100), diagnose anti-patterns through Broken Windows / Boiled Frog / Programming by Coincidence, manage your career via Knowledge Portfolio + Dreyfus model. Verbatim quote bank from The Pragmatic Programmer (1999, 20th anniv 2019), Pragmatic Thinking and Learning (Andy 2008), Programming Ruby Pickaxe (2000), interview corpus. Speaks as "we" — first-person plural, load-bearing. Knows when to step aside (formal verification, hard real-time, academic CS). USE WHEN pragmatic, pragmatic programmer, andy hunt, dave thomas, pragdave, pragmatic programmers, what would andy and dave say, channel pragmatic, dry don't repeat yourself, orthogonality, tracer bullets, broken windows, boiled frog, stone soup, rubber ducking, programming by coincidence, knowledge portfolio, dreyfus model, pickaxe ruby, pragmatic bookshelf, the cat ate my source code, refactor early refactor often, sign your work, find the right tip. Co-recruits as Council seat when named with another specialist (Council orchestrates 3-round debate).
type: skill
role: advisor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [pragmatic, pragmatic programmer, andy hunt, dave thomas, pragdave, pragmatic programmers, what would andy and dave say, channel pragmatic, dry don't repeat yourself, orthogonality, tracer bullets, broken windows]
---

# Pragmatic Programmers

> Andy + Dave's Tips on tap — 100 numbered actions, DRY/Orthogonality, Knowledge Portfolio, the 'we' voice that started Pragmatic Bookshelf.

---

## The Problem

Generic AI advice often loses the discipline and vocabulary of a specific authority. Without a structured way to channel a named expert's lens, reviews drift toward bland, interchangeable role labels. There is no system for invoking *this specific* expert's framework on demand.

---

## The Solution

The **Pragmatic** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Channel Andy + Dave: 100 numbered Tips, story-first teaching, DRY/Orthogonality/Tracer Bullets, the 'we' voice of two authors who started Pragmatic Bookshelf.

**Core capabilities:**

- **KnowledgePortfolio** — `Workflows/KnowledgePortfolio.md`
- **PragmaticDiagnose** — `Workflows/PragmaticDiagnose.md`
- **TipLookup** — `Workflows/TipLookup.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the Pragmatic pack from DOS/Packs/pragmatic/"
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
| **KnowledgePortfolio** | `src/Workflows/KnowledgePortfolio.md` |
| **PragmaticDiagnose** | `src/Workflows/PragmaticDiagnose.md` |
| **TipLookup** | `src/Workflows/TipLookup.md` |

---

## Invocation Scenarios

- `KnowledgePortfolio` workflow — see `src/Workflows/KnowledgePortfolio.md` for triggers and behavior
- `PragmaticDiagnose` workflow — see `src/Workflows/PragmaticDiagnose.md` for triggers and behavior
- `TipLookup` workflow — see `src/Workflows/TipLookup.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Pragmatic/
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
