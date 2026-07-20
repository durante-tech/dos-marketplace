---
name: BrandResearch
description: Multi-agent parallel brand research — competitive analysis, brand extraction from URLs, market landscape, audience intelligence. 9 agents across 3 providers. USE WHEN brand research, brand deep dive, extract brand from URL, brand intelligence, reverse engineer brand, competitive brand analysis.
role: researcher
accepts:
  - text
  - url
roots:
  - PROJECT.WORK
  - PROJECT.ARTIFACTS
  - PROTECTED_LOCAL
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Brand/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Brand Research

Deep multi-agent parallel brand research. 9 agents, 3 providers, 9 distinct research dimensions.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Research brand, brand deep dive, extract brand, brand intelligence, reverse engineer brand | `Workflows/Research.md` |
