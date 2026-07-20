---
name: FastAPIStarterTeam
pack-id: durante-fastapistarterteam-v0.5.0
version: 0.5.0
author: durante-tech
description: Orchestrates a 13-agent delivery team (PM, SM, API DX, Schema, Architect, Agent Engineer, Backend, DB, Security, QA, E2E, DevOps, Writer) for the dos-fastapi-starter Python API framework. Full dev-team motions — deliver, fix, refactor, review, validate, explore. Includes a PR review-execute loop. USE WHEN deliver feature in starter, ship feature to fastapi starter, fastapi team, run delivery pipeline, build feature in starter, fastapi starter pipeline, design review for starter, security audit for starter, refresh starter docs, quick fix in starter, bug fix in starter, code review for starter, refactor starter, test and validate starter, explore feature in starter, feature archaeology, review open prs in starter, review pr in starter, deep review pr in starter, execute todos for pr, apply review todos, fastapi starter pr loop.
type: skill
role: orchestrator
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [fastapistarterteam, fastapi-starter, deliver feature, ship feature to starter, fastapi team, run delivery pipeline, build feature in starter, design review for starter, security audit for starter, refresh starter docs, quick fix in starter, bug fix in starter, code review for starter, pydantic-ai, logfire, alembic, sqlalchemy, fastcrud, arq]
---

# FastAPIStarterTeam

> Orchestrates a 13-agent delivery team (PM, SM, API DX, Schema, Architect, Agent Engineer, Backend, DB, Security, QA, E2E, DevOps, Writer) for the dos-fastapi-starter Python API framework — sibling to MakerkitTeam.

---

## The Problem

Operating a multi-step Python-API delivery ad-hoc per session forfeits the structured workflow that makes results consistent. Without a packaged set of workflows + tools + manifests, the same task gets re-invented every time — JWT wiring, Pydantic AI agent endpoints, Logfire instrumentation, Alembic migrations, deployment recipes.

---

## The Solution

The **FastAPIStarterTeam** pack packages 14 workflows + 6 CLI tools + 5 shared partials behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest. Targets the `~/Developer/dos-fastapi-starter` codebase and its `tooling/mcp_server/` MCP surface.

**Core capabilities:**

- **BugFix** — `Workflows/BugFix.md`
- **CodeReview** — `Workflows/CodeReview.md`
- **DeliverFeature** — `Workflows/DeliverFeature.md`
- **DesignReview** — `Workflows/DesignReview.md`
- **DocsRefresh** — `Workflows/DocsRefresh.md`
- **ExecuteOpenTodos** — `Workflows/ExecuteOpenTodos.md`
- **ExploreFeature** — `Workflows/ExploreFeature.md`
- **QuickFix** — `Workflows/QuickFix.md`
- **Refactor** — `Workflows/Refactor.md`
- **ReviewOpenPRs** — `Workflows/ReviewOpenPRs.md`
- **ReviewSinglePR** — `Workflows/ReviewSinglePR.md`
- **SecurityAudit** — `Workflows/SecurityAudit.md`
- **ShowRoster** — `Workflows/ShowRoster.md`
- **TestAndValidate** — `Workflows/TestAndValidate.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the fastapi-starter-team pack from DOS/Packs/fastapi-starter-team/"
```

Your AI reads `INSTALL.md` and walks through a 5-phase wizard (system analysis → user questions → backup → install → verify).

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing, configuration, documentation |
| Skill source | `src/SKILL.partials.md` | RFC-0006 partials |
| Extension manifest | `src/extension.yaml` | RFC-0002 pack manifest |
| Data | `src/Data/` | Roster.json (13 roles) + McpToolMap.json (6 clusters) |
| Tools | `src/Tools/` | 6 TS/Bun tool(s) |
| Workflows | `src/Workflows/` | 14 workflow definitions + 5 shared partials |
| Framework digest | `src/FrameworkDigest.md` | 12-section synthesis of dos-fastapi-starter |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 3 (Data, Tools, Workflows)
- Roles: 13
- Workflows: 14
- Shared partials: 5
- Tools: 6
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Sibling pack

`makerkit-team` — TS/Next.js/Prisma sibling, shares the same shape (Roster.json schema, partial composition, PR-loop primitives). When you have both installed, terminology stays parallel: "deliver feature in kit" → MakerkitTeam, "deliver feature in starter" → FastAPIStarterTeam.

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/FastAPIStarterTeam/
```

---

## Credits

- **Pack family:** durante-tech / DOS
- **Distribution protocol:** RFC-0011 (Packs Distribution & Release Authoring)
- **Skill definition format:** RFC-0004
- **Extension manifest format:** RFC-0002
- **Review-reception gate (ExecuteOpenTodos):** adapted from the [obra/superpowers](https://github.com/obra/superpowers) `receiving-code-review` skill (MIT, (c) 2025 Jesse Vincent)
- **Upstream codebase:** forked from `benavlabs/FastAPI-boilerplate`, adapted with Pydantic AI + Logfire + slot allocator + MCP server.

---

## Changelog

See `src/CHANGELOG.md`.
