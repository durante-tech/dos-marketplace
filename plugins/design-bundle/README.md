---
name: DesignBundle
pack-id: durante-designbundle-v1.0.0
version: 1.0.0
author: durante-tech
description: Take a fresh dos-prisma-saas-kit fork from 'just cloned' to 'Claude Design System form-ready' in one pipeline — configures the fork (git remote swap + push + fork:init), mines context across DOS root + sibling SaaS + current fork + MEMORY in parallel, captures decisions with structured questions (scope / positioning / tagline / languages / deploy), assembles a curated bundle at <repo>/claude-design-system-bundle/ with FORM_FILL.md + 6 context markdowns + verbatim code copies + brand-direction reference, applies locked decisions, commits. USE WHEN design bundle, claude design system, set up design system, institutional site bundle, fork and bundle, anthropic design form, design system folder bundle, fill design system form, kit to bundle, durante.tech bundle, institutional bundle.
type: skill
role: executor
visibility: public
category: Branding
platform: claude-code
dependencies: []
keywords: [designbundle, design bundle, claude design system, set up design system, institutional site bundle, fork and bundle, anthropic design form, design system folder bundle, fill design system form, kit to bundle, durante]
---

# DesignBundle

> Take a fresh dos-prisma-saas-kit fork from 'just cloned' to 'Claude Design System form-ready' in one pipeline — configures the fork (git remote swap + push + fork:init), mines context across DOS root + sibling SaaS + current fork + MEMORY in parallel, captures decisions with structured questions (scope / positioning / tagline / languages / deploy), assembles a curated bundle at <repo>/claude-design-system-bundle/ with FORM_FILL

---

## The Problem

Operating a multi-step capability ad-hoc per session forfeits the structured workflow that makes results consistent. Without a packaged set of workflows + tools + manifests, the same task gets re-invented every time.

---

## The Solution

The **DesignBundle** pack packages 1 workflow behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.


**Core capabilities:**

- **RunPipeline** — `Workflows/RunPipeline.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the design-bundle pack from DOS/Packs/design-bundle/"
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
| Workflows | `src/Workflows/` | 1 workflow definition(s) |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 1 (Workflows)
- Files in src/: 3
- Workflows: 1
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **RunPipeline** | `src/Workflows/RunPipeline.md` |

---

## Invocation Scenarios

- `RunPipeline` workflow — see `src/Workflows/RunPipeline.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DesignBundle/
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
