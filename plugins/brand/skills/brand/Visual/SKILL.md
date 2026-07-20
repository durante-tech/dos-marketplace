---
name: BrandVisual
description: Visual identity system — logo design, icon systems, color palettes, typography hierarchy, illustration direction, photography style, and motion language. USE WHEN design logo, create logo, icon system, brand icons, color palette, color system, typography, type scale, illustration style, photography direction, motion language, animation tokens, brand mark, visual identity.
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

# Brand Visual Identity

Complete visual identity system. Logo, icons, color, typography, illustration, and motion — all governed by the brand's personality and token architecture.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Design logo, create logo, brand mark, logo for brand | `Workflows/LogoDesign.md` |
| Icon system, icon set, brand icons, create icons | `Workflows/IconSystem.md` |
| Vector logo, SVG logo, vector mark, vector icon, SVG icon, scalable mark, code-authored logo | `Workflows/VectorMark.md` |
| Color palette, color system, brand colors, accessibility | `Workflows/ColorSystem.md` |
| Typography, type scale, font pairing, type hierarchy | `Workflows/Typography.md` |
| Illustration style, illustration direction, visual content direction, AI image prompts | `Workflows/IllustrationDirection.md` |
| Motion language, animation tokens, easing, transitions, micro-interactions, scroll behavior | `Workflows/MotionLanguage.md` |
