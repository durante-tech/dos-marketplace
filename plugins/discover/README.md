---
name: Discover
pack-id: durante-discover-v1.0.0
version: 1.0.0
author: durante-tech
description: Discovery conductor — interview an operator's clear-but-unwritten feature intent inside a dos-prisma-saas-kit fork and emit the validated, constraint-first rich folder that /forge Tier 1 consumes. Sits BEFORE /forge. USE WHEN discover, feature discovery interview, unwritten feature intent, interview feature intent, pre-forge discovery, rich folder for forge, discovery conductor. NOT for PRD authoring (use PRD), build-order classification (use /forge), or pre-PRD research fan-out (use the feature-discovery workflow — /discover interviews, it does not research).
type: skill
role: coordinator
visibility: public
category: Delivery
platform: claude-code
dependencies: []
keywords: [discover, feature discovery interview, unwritten feature intent, interview feature intent, pre-forge discovery, rich folder for forge, discovery conductor]
---

# Discover

> Interview unwritten feature intent into a forge-ready discovery folder

---

## The Problem

Operating Discover capabilities ad-hoc loses the packaged contract — workflows, tools, manifests — that makes the surface installable and reproducible across hosts.

---

## The Solution

The **Discover** pack packages 12 CLI tools behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Turn clear-but-unwritten feature intent into the folder /forge consumes

**Core capabilities:**

- See `src/SKILL.md` for capabilities

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the discover pack from DOS/Packs/discover/"
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
| Tools | `src/Tools/` | 12 CLI/helper tool(s) |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 1 (Tools)
- Files in src/: 31
- Workflows: 0
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| (See `src/SKILL.md` for routing) | |

---

## Invocation Scenarios

- See `src/SKILL.md` for invocation triggers.

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Discover/
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
