---
name: ContractReview
pack-id: durante-contractreview-v1.0.0
version: 1.0.0
author: durante-tech
description: Multi-agent legal contract analysis team for SaaS/service agreements. 4 specialized agents (Risk, Commercial, Compliance, Synthesis) review contracts in parallel and produce a traffic-light redline report. USE WHEN contract review, review contract, legal review, redline contract, analyze contract, SaaS agreement, MSA review, service agreement, contract risk, contract analysis, red flag, legal analysis.
type: skill
role: analyzer
visibility: public
category: Legal
platform: claude-code
dependencies: []
keywords: [contractreview, contract review, review contract, legal review, redline contract, analyze contract, saas agreement, msa review, service agreement, contract risk, contract analysis, red flag]
---

# Contract Review

> Multi-agent contract analysis with traffic-light redlining for SaaS/service agreements.

---

## The Problem

Cadenced or ad-hoc analysis without a packaged scaffold loses the file-output discipline that makes findings actionable. Drift between sessions, no diff against prior runs, no consistent output paths.

---

## The Solution

The **ContractReview** pack packages 1 workflow behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Multi-agent contract review with traffic-light redlining

**Core capabilities:**

- **ReviewContract** — `Workflows/ReviewContract.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the contract-review pack from DOS/Packs/contract-review/"
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
| Workflows | `src/Workflows/` | 1 workflow definition(s) |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 2 (Data, Workflows)
- Files in src/: 5
- Workflows: 1
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **ReviewContract** | `src/Workflows/ReviewContract.md` |

---

## Invocation Scenarios

- `ReviewContract` workflow — see `src/Workflows/ReviewContract.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ContractReview/
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
