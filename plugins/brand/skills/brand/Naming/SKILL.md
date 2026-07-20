---
name: BrandNaming
description: Product and feature naming with linguistic analysis, domain/npm/trademark screening, and naming system conventions for developer tools. USE WHEN name product, name feature, naming conventions, product name, brand name, tagline, check name availability, naming system.
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

# Brand Naming

Product and feature naming pipeline with automated screening across npm, domains, GitHub, and trademark databases.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Name product, name feature, brand name, check name availability | `Workflows/NameProduct.md` |
| Naming conventions, naming system, naming taxonomy, how to name features | `Workflows/NamingSystem.md` |
