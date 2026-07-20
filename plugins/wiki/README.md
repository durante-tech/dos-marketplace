---
name: Wiki
pack-id: durante-wiki-v1.0.0
version: 1.0.0
author: durante-tech
description: Agent-maintained knowledge vault — an interlinked OKF v0.1 markdown synthesis layer over immutable sources, with init, ingest, query, and lint workflows. USE WHEN wiki, knowledge vault, init vault, create wiki, ingest source, add to wiki, ingest into wiki, ask the wiki, query the wiki, what do we know about, wiki lint, check the wiki, synthesis layer, knowledge base, okf, open knowledge format, knowledge bundle. NOT for semantic memory search or knowledge-graph facts (use MemPalace — Wiki maintains the prose synthesis layer that cites them) and NOT for finding prior sessions or PRDs (use ContextSearch).
type: skill
role: generator
visibility: public
category: Research
platform: claude-code
dependencies: []
keywords: [wiki, knowledge vault, init vault, create wiki, ingest source, add to wiki, ingest into wiki, ask the wiki, query the wiki, what do we know about, wiki lint, check the wiki]
---

# Wiki

> Agent-maintained OKF knowledge vault over your immutable sources

---

## The Problem

Operating Wiki capabilities ad-hoc loses the packaged contract — workflows, tools, manifests — that makes the surface installable and reproducible across hosts.

---

## The Solution

The **Wiki** pack packages 4 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** The agent maintains the wiki; you read the compounding synthesis

**Core capabilities:**

- **Ingest** — `Workflows/Ingest.md`
- **Init** — `Workflows/Init.md`
- **Lint** — `Workflows/Lint.md`
- **Query** — `Workflows/Query.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the wiki pack from DOS/Packs/wiki/"
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
| Templates | `src/Templates/` | Prompt/code templates |
| Workflows | `src/Workflows/` | 4 workflow definition(s) |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 3 (Templates, Tools, Workflows)
- Files in src/: 9
- Workflows: 4
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **Ingest** | `src/Workflows/Ingest.md` |
| **Init** | `src/Workflows/Init.md` |
| **Lint** | `src/Workflows/Lint.md` |
| **Query** | `src/Workflows/Query.md` |

---

## Invocation Scenarios

- `Ingest` workflow — see `src/Workflows/Ingest.md` for triggers and behavior
- `Init` workflow — see `src/Workflows/Init.md` for triggers and behavior
- `Lint` workflow — see `src/Workflows/Lint.md` for triggers and behavior
- `Query` workflow — see `src/Workflows/Query.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Wiki/
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
