---
name: Github
pack-id: durante-github-v1.0.0
version: 1.0.0
author: durante-tech
description: GitHub PR fleet coordinator — list open PRs, orchestrate multi-perspective team reviews (Cockburn/Fowler/UncleBob/Sentinel), post comments, propose fixes, and gate merges with explicit approval. Wraps the gh CLI; the agent is the team leader. USE WHEN review prs, review pull requests, triage prs, github review, pr team review, fleet review, sweep prs, github fleet, comment on pr, merge pr, gh pr review, pr orchestration, list open prs, github prs, pr team, lead pr review.
type: skill
role: executor
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [github, review prs, review pull requests, triage prs, github review, pr team review, fleet review, sweep prs, github fleet, comment on pr, merge pr, gh pr review]
---

# GitHub

> Team-leader PR review pack — fan a fleet of open PRs out to a multi-perspective reviewer team, aggregate verdicts, post comments, propose fixes on a side branch, and merge only with explicit human approval.

---

## The Problem

Operating a multi-step capability ad-hoc per session forfeits the structured workflow that makes results consistent. Without a packaged set of workflows + tools + manifests, the same task gets re-invented every time.

---

## The Solution

The **Github** pack packages 3 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.

**Elevator:** Lead a review team across every open PR — opinions in, comments out, merges only with your nod.

**Core capabilities:**

- **ListPRs** — `Workflows/ListPRs.md`
- **ReviewPRs** — `Workflows/ReviewPRs.md`
- **ReviewSinglePR** — `Workflows/ReviewSinglePR.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the github pack from DOS/Packs/github/"
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
- Directories: 2 (Tools, Workflows)
- Files in src/: 6
- Workflows: 3
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **ListPRs** | `src/Workflows/ListPRs.md` |
| **ReviewPRs** | `src/Workflows/ReviewPRs.md` |
| **ReviewSinglePR** | `src/Workflows/ReviewSinglePR.md` |

---

## Invocation Scenarios

- `ListPRs` workflow — see `src/Workflows/ListPRs.md` for triggers and behavior
- `ReviewPRs` workflow — see `src/Workflows/ReviewPRs.md` for triggers and behavior
- `ReviewSinglePR` workflow — see `src/Workflows/ReviewSinglePR.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Github/
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
