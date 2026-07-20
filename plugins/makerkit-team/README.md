---
name: MakerkitTeam
pack-id: durante-makerkitteam-v1.0.0
version: 1.0.0
author: durante-tech
description: Orchestrates a 13-agent delivery team (PM, SM, UX, UI, Architect, Frontend, Backend, DB, Security, QA, E2E, DevOps, Writer) for the dos-prisma-saas-kit Makerkit framework. Full dev-team motions — deliver, fix, refactor, review, validate, explore. USE WHEN deliver feature, ship feature to kit, makerkit team, run delivery pipeline, build feature in saas kit, makerkit pipeline, design review for kit, security audit for kit, refresh kit docs, quick fix in kit, bug fix in kit, code review for kit, refactor kit, test and validate kit, explore feature in kit, feature archaeology.
type: skill
role: orchestrator
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [makerkitteam, deliver feature, ship feature to kit, makerkit team, run delivery pipeline, build feature in saas kit, makerkit pipeline, design review for kit, security audit for kit, refresh kit docs, quick fix in kit, bug fix in kit]
---

# MakerkitTeam

> Orchestrates a 13-agent delivery team (PM, SM, UX, UI, Architect, Frontend, Backend, DB, Security, QA, E2E, DevOps, Writer) for the dos-prisma-saas-kit Makerkit framework

---

## The Problem

Operating a multi-step capability ad-hoc per session forfeits the structured workflow that makes results consistent. Without a packaged set of workflows + tools + manifests, the same task gets re-invented every time.

---

## The Solution

The **MakerkitTeam** pack packages 11 workflows + 2 CLI tools behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.


**Core capabilities:**

- **BugFix** — `Workflows/BugFix.md`
- **CodeReview** — `Workflows/CodeReview.md`
- **DeliverFeature** — `Workflows/DeliverFeature.md`
- **DesignReview** — `Workflows/DesignReview.md`
- **DocsRefresh** — `Workflows/DocsRefresh.md`
- **ExploreFeature** — `Workflows/ExploreFeature.md`
- **QuickFix** — `Workflows/QuickFix.md`
- **Refactor** — `Workflows/Refactor.md`
- **SecurityAudit** — `Workflows/SecurityAudit.md`
- **ShowRoster** — `Workflows/ShowRoster.md`
- **TestAndValidate** — `Workflows/TestAndValidate.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the makerkit-team pack from DOS/Packs/makerkit-team/"
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
| Data | `src/Data/` | Pack data files |
| Tools | `src/Tools/` | 2 CLI/helper tool(s) |
| Workflows | `src/Workflows/` | 11 workflow definition(s) |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 3 (Data, Tools, Workflows)
- Files in src/: 20
- Workflows: 11
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **BugFix** | `src/Workflows/BugFix.md` |
| **CodeReview** | `src/Workflows/CodeReview.md` |
| **DeliverFeature** | `src/Workflows/DeliverFeature.md` |
| **DesignReview** | `src/Workflows/DesignReview.md` |
| **DocsRefresh** | `src/Workflows/DocsRefresh.md` |
| **ExploreFeature** | `src/Workflows/ExploreFeature.md` |
| **QuickFix** | `src/Workflows/QuickFix.md` |
| **Refactor** | `src/Workflows/Refactor.md` |
| **SecurityAudit** | `src/Workflows/SecurityAudit.md` |
| **ShowRoster** | `src/Workflows/ShowRoster.md` |
| **TestAndValidate** | `src/Workflows/TestAndValidate.md` |

---

## Invocation Scenarios

- `BugFix` workflow — see `src/Workflows/BugFix.md` for triggers and behavior
- `CodeReview` workflow — see `src/Workflows/CodeReview.md` for triggers and behavior
- `DeliverFeature` workflow — see `src/Workflows/DeliverFeature.md` for triggers and behavior
- `DesignReview` workflow — see `src/Workflows/DesignReview.md` for triggers and behavior
- `DocsRefresh` workflow — see `src/Workflows/DocsRefresh.md` for triggers and behavior
- `ExploreFeature` workflow — see `src/Workflows/ExploreFeature.md` for triggers and behavior
- `QuickFix` workflow — see `src/Workflows/QuickFix.md` for triggers and behavior
- `Refactor` workflow — see `src/Workflows/Refactor.md` for triggers and behavior
- `SecurityAudit` workflow — see `src/Workflows/SecurityAudit.md` for triggers and behavior
- `ShowRoster` workflow — see `src/Workflows/ShowRoster.md` for triggers and behavior
- `TestAndValidate` workflow — see `src/Workflows/TestAndValidate.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/MakerkitTeam/
```

Place per-user overrides here; they merge with base configuration at runtime where applicable.

---

## Credits

- **Pack family:** durante-tech / DOS
- **Distribution protocol:** RFC-0011 (Packs Distribution & Release Authoring)
- **Skill definition format:** RFC-0004
- **Extension manifest format:** RFC-0002
- **Review-reception gate (ExecuteOpenTodos):** adapted from the [obra/superpowers](https://github.com/obra/superpowers) `receiving-code-review` skill (MIT, (c) 2025 Jesse Vincent)

---

## Changelog

### 1.0.0 - $(date +%Y-%m-%d)
- Initial published version with canonical pack-distribution scaffolding (INSTALL.md / README.md / VERIFY.md)
- See git history for prior incremental commits
