---
name: BrandVerbal
description: Brand voice, tone, messaging frameworks, and copy guidelines. StoryBrand SB7 BrandScript, one-liners, elevator pitches, value propositions, and voice documentation. USE WHEN brand voice, tone of voice, messaging framework, brandscript, one-liner, elevator pitch, brand messaging, voice guidelines, how should we sound, writing style, copy guidelines.
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

# Brand Verbal Identity

Voice, tone, and messaging — how the brand speaks. Uses StoryBrand SB7 as the primary narrative framework for messaging, with additional frameworks (PAS, AIDA, JTBD, Positioning, PASTOR, Cialdini, FAB) for specific contexts.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Create brand messaging, generate messaging, storybrand, brandscript, messaging system | `Workflows/Generate.md` |
| BrandScript specifically, SB7, character/problem/guide/plan | `Workflows/BrandScript.md` |
| Voice guide, tone of voice, how should we sound, voice documentation, copy guidelines | `Workflows/VoiceGuide.md` |
| Channel artifacts, email sequence, ad copy, sales script, homepage copy, pitch deck narrative, social bios | `Workflows/Artifacts.md` |
