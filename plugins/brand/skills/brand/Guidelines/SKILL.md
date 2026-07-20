---
name: BrandGuidelines
description: Brand book generation and consistency enforcement. Living guidelines system from all brand artifacts. Asset compliance checking. USE WHEN brand guidelines, brand book, style guide, brand rules, check brand consistency, enforce brand, brand compliance, brand governance.
role: generator
accepts:
  - text
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

# Brand Guidelines & Governance

Generate brand books and enforce consistency. The enforcement system — not a static PDF, but a living compliance engine.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Brand guidelines, brand book, style guide, generate brand documentation | `Workflows/GenerateGuidelines.md` |
| Check brand consistency, enforce brand, brand compliance, audit assets | `Workflows/EnforceConsistency.md` |
