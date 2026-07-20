---
name: BrandImplementation
description: Transform brand identity into structured token specs and deployment artifacts. Brand token spec for DesignSystem consumption, CinematicLanding handoff, and social brand templates. USE WHEN brand token spec, prepare for design system, brand handoff, prepare for landing page, social brand, social templates, OG images.
role: executor
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

# Brand Implementation

Transform brand identity decisions into structured specs and deployment artifacts. Brand does NOT produce theme.css or code files -- that's DesignSystem's job. Brand produces the *identity spec* that DesignSystem consumes.

## Boundary with DesignSystem

| Brand (identity layer) | DesignSystem (implementation layer) |
|------------------------|-------------------------------------|
| Decides *which* colors represent the brand | Encodes colors into DESIGN.md tokens |
| Chooses typography personality | Maps fonts to CSS variables |
| Defines motion language philosophy | Generates motion-tokens.ts |
| Produces brand-token-spec.md | Consumes spec via Init workflow |

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Brand token spec, prepare for design system, tokens for DesignSystem | `Workflows/TokenSpec.md` |
| Brand handoff, prepare for landing page, ready for CinematicLanding | `Workflows/Handoff.md` |
| Social brand, social templates, GitHub profile, Twitter templates, OG images, Discord branding | `Workflows/SocialBrand.md` |
