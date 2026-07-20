---
name: BrandStrategy
description: Brand strategy definition — purpose, vision, mission, values, positioning, personality, archetype, brand architecture. Three-layer token architecture (option/decision/component). USE WHEN define brand, create brand identity, brand strategy, brand positioning, brand tokens, brand architecture, sub-brands, product line structure.
role: analyzer
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

# Brand Strategy

Define brand strategy and identity. Outputs a three-layer token architecture (option/decision/component) that bridges directly to code implementation.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Define brand, create brand identity, brand strategy, brand positioning, brand tokens | `Workflows/Define.md` |
| Brand architecture, sub-brands, product line, endorsed brand, house of brands | `Workflows/Architecture.md` |
