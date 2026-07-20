---
name: Ref
pack-id: durante-ref-v1.0.0
version: 1.0.0
author: durante-tech
description: Documentation lookup for libraries, frameworks, SDKs, and APIs routed through Studio's credit-metered gateway. Search across public docs and read URLs as markdown via api.ref.tools.
type: skill
role: executor
visibility: public
category: Inference
platform: claude-code
dependencies: []
keywords: [ref, docs lookup, ref search, find documentation, library docs, framework docs, sdk docs, api docs, read documentation]
---

# Ref

> Library docs lookup, credit-metered through Studio.

---

## The Problem

Agents need current documentation more often than their training data can provide it. Ad-hoc web searches are noisy, hard to meter, and easy to route around the canonical vendor docs.

---

## The Solution

The **Ref** pack packages 1 workflow and 2 CLI tools behind a single `SKILL.md` entry card and Studio gateway contract.

**Elevator:** Documentation search and read via Studio's gateway.

**Core capabilities:**

- **DocsLookup** - `Workflows/DocsLookup.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```text
Install the ref pack from DOS/Packs/ref/
```

The installer creates the skill directories, copies pack files, runs `bun install` in `Tools`, and verifies the two CLI entry points.

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing, configuration, documentation |
| Skill source | `src/SKILL.partials.md` | RFC-0006 partial source |
| Extension manifest | `src/extension.yaml` | RFC-0002 pack manifest |
| Lib | `src/Lib/` | Studio env and gateway helpers |
| Tools | `src/Tools/` | 2 CLI entry points |
| Workflows | `src/Workflows/` | 1 workflow definition |

**Summary:**
- Directories: 3 (`Lib`, `Tools`, `Workflows`)
- Files in `src/`: 13
- Workflows: 1
- Tools: 2
- Hooks registered: 0
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **DocsLookup** | `src/Workflows/DocsLookup.md` |

---

## Invocation Scenarios

- Search docs: `bun ~/.claude/skills/ref/Tools/Search.ts --query "Prisma transaction timeout option"`
- Read a docs URL: `bun ~/.claude/skills/ref/Tools/Read.ts --url "https://www.prisma.io/docs/..."`

---

## Customization

User customizations live separately and are never overwritten by updates:

```text
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Ref/
```

---

## Credits

- **Pack family:** durante-tech / DOS
- **Skill definition format:** RFC-0004
- **Extension manifest format:** RFC-0002
- **Ref gateway spec:** RFC-0029

---

## Changelog

### 1.0.0
- Initial published version with Studio-routed search/read CLIs, docs workflow, installation guide, and verification smoke checks.
