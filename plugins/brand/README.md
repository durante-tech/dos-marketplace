---
name: Brand
pack-id: durante-brand-v2.0.0
version: 2.0.0
author: durante-tech
description: Complete brand system with 7 sub-skills — research, strategy, naming, verbal identity, visual identity, implementation, and guidelines. 27 workflows covering the full brand lifecycle from competitive analysis through code generation to consistency enforcement.
type: skill
purpose-type: [brand, messaging, identity, visual, naming, voice, guidelines]
platform: claude-code
dependencies: []
keywords: [brand, strategy, naming, verbal, voice, tone, messaging, brandscript, sb7, storybrand, logo, icon, color, typography, illustration, motion, tokens, OKLCH, design-tokens, implementation, guidelines, enforcement, audit, research, competitive-analysis, social-brand]
---

# Brand

> Complete brand system — from competitive research through strategy, naming, verbal identity, visual identity, and implementation to guidelines and enforcement.

---

## The Problem

Building a brand is one of the most important and most neglected parts of launching a product. Most technical founders skip it entirely, or produce generic messaging that could describe any product:

- **No strategic foundation** -- jumping to logos without positioning, audience, or competitive analysis
- **No verbal identity** -- inconsistent voice across docs, marketing, and product
- **No naming conventions** -- products, features, and CLI commands named ad hoc
- **No connection to code** -- brand guidelines live in PDFs that developers never read
- **No enforcement** -- brand erodes through inconsistent execution (consistency drives 10-33% revenue)

The fundamental issue: brand decisions need to become implementable tokens and enforceable systems, not static PDFs.

---

## The Solution

7 sub-skills covering the complete brand lifecycle:

| Sub-Skill | Workflows | Purpose |
|-----------|-----------|---------|
| **Research** | research | 9-agent parallel competitive analysis across Claude, Gemini, Perplexity |
| **Strategy** | Define, Architecture | Purpose, values, positioning, brand architecture, three-layer tokens |
| **Naming** | NameProduct, NamingSystem | Product/feature naming with npm/domain/trademark screening |
| **Verbal** | Generate, BrandScript, VoiceGuide, Artifacts | Voice, tone, SB7 messaging, 30+ channel artifact frameworks |
| **Visual** | LogoDesign, IconSystem, ColorSystem, Typography, IllustrationDirection, MotionLanguage | Complete visual identity system including motion |
| **Implementation** | Implement, Handoff, SocialBrand | Tokens to code, CinematicLanding handoff, social platform templates |
| **Guidelines** | GenerateGuidelines, EnforceConsistency | Brand book generation, asset compliance checking |

Plus cross-cutting: **Audit** (consistency scorecard across all sub-skills)

**Total: 8 SKILL.md files, 21 workflows**

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Parent Router | `src/SKILL.md` | Routes brand requests to sub-skills |
| Audit Workflow | `src/Workflows/Audit.md` | Cross-cutting consistency scorecard |
| Research Skill | `src/Research/SKILL.md` | Competitive analysis routing |
| Research Workflow | `src/Research/Workflows/Research.md` | 9-agent parallel competitive analysis |
| Strategy Skill | `src/Strategy/SKILL.md` | Brand strategy + architecture routing |
| Define | `src/Strategy/Workflows/Define.md` | Purpose, values, positioning definition |
| Architecture | `src/Strategy/Workflows/Architecture.md` | Brand architecture and three-layer tokens |
| Naming Skill | `src/Naming/SKILL.md` | Product naming + screening routing |
| Naming Tools | `src/Naming/Tools/` | npm, WHOIS, USPTO availability checkers |
| NameProduct | `src/Naming/Workflows/NameProduct.md` | Individual product/feature naming |
| NamingSystem | `src/Naming/Workflows/NamingSystem.md` | Organization-wide naming conventions |
| Verbal Skill | `src/Verbal/SKILL.md` | Voice, tone, messaging routing |
| Generate | `src/Verbal/Workflows/Generate.md` | Voice and tone definition |
| BrandScript | `src/Verbal/Workflows/BrandScript.md` | StoryBrand SB7 messaging framework |
| VoiceGuide | `src/Verbal/Workflows/VoiceGuide.md` | Detailed voice usage guide |
| Artifacts | `src/Verbal/Workflows/Artifacts.md` | 30+ channel artifact frameworks |
| Visual Skill | `src/Visual/SKILL.md` | Visual identity routing |
| Visual Tools | `src/Visual/Tools/` | Image generation utilities |
| LogoDesign | `src/Visual/Workflows/LogoDesign.md` | Logo concept and design system |
| IconSystem | `src/Visual/Workflows/IconSystem.md` | Icon library and guidelines |
| ColorSystem | `src/Visual/Workflows/ColorSystem.md` | OKLCH-based color palette system |
| Typography | `src/Visual/Workflows/Typography.md` | Type scale and font selection |
| IllustrationDirection | `src/Visual/Workflows/IllustrationDirection.md` | Illustration style guide |
| MotionLanguage | `src/Visual/Workflows/MotionLanguage.md` | Animation and motion design tokens |
| Implementation Skill | `src/Implementation/SKILL.md` | Tokens to code + handoff routing |
| Implement | `src/Implementation/Workflows/Implement.md` | Design tokens to CSS/TS code generation |
| Handoff | `src/Implementation/Workflows/Handoff.md` | CinematicLanding integration handoff |
| SocialBrand | `src/Implementation/Workflows/SocialBrand.md` | Social platform brand templates |
| Guidelines Skill | `src/Guidelines/SKILL.md` | Brand book + enforcement routing |
| GenerateGuidelines | `src/Guidelines/Workflows/GenerateGuidelines.md` | Brand book generation |
| EnforceConsistency | `src/Guidelines/Workflows/EnforceConsistency.md` | Asset compliance checking |

**Summary:**
- **Sub-skills:** 7
- **SKILL.md files:** 8 (1 parent + 7 sub-skills)
- **Workflows:** 21 (20 in sub-skills + 1 cross-cutting Audit)
- **Hooks registered:** 0
- **Dependencies:** None

---

## What Makes This Different

The brand pack treats brand as a system, not a deliverable. Every brand decision becomes an implementable token (option -> decision -> component layers), not a PDF guideline. The 7 sub-skills mirror how top-tier agencies (Pentagram, Wolff Olins, Collins) structure their engagements, but optimized for developer-facing startups.

Key differentiators:
- **Naming pipeline** with automated npm/domain/trademark screening (no other AI brand tool does this)
- **Verbal identity** using StoryBrand SB7 + 8 additional frameworks for 30+ channel artifact types
- **Brand-as-code** — generates theme.css, fonts.ts, motion-tokens.ts that ship directly into codebases
- **Consistency enforcement** — checks assets against brand rules programmatically (drives 10-33% revenue uplift)
- **Social brand system** — GitHub, Twitter, Discord, OG image templates for developer platforms

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "Research our competitors' brands" | Research/Research: 9-agent parallel competitive analysis across Claude, Gemini, Perplexity |
| "Define our brand strategy" | Strategy/Define: establishes purpose, values, positioning, and audience |
| "Create our brand architecture" | Strategy/Architecture: defines brand hierarchy and three-layer token system |
| "Name our new product" | Naming/NameProduct: generates candidates with npm/domain/trademark screening |
| "Create a naming system" | Naming/NamingSystem: establishes organization-wide naming conventions |
| "Define our voice and tone" | Verbal/Generate: creates voice attributes, tone spectrum, and usage guidelines |
| "Write our brand script" | Verbal/BrandScript: StoryBrand SB7 messaging framework |
| "Generate marketing artifacts" | Verbal/Artifacts: produces 30+ channel-specific content from brand messaging |
| "Design our logo" | Visual/LogoDesign: logo concept exploration and design system |
| "Create our color system" | Visual/ColorSystem: OKLCH-based color palette with semantic tokens |
| "Set up typography" | Visual/Typography: type scale, font selection, and pairing |
| "Generate design tokens as code" | Implementation/Implement: outputs theme.css, fonts.ts, motion-tokens.ts |
| "Create social media templates" | Implementation/SocialBrand: GitHub, Twitter, Discord, OG image templates |
| "Generate our brand book" | Guidelines/GenerateGuidelines: comprehensive brand guidelines document |
| "Check brand consistency" | Guidelines/EnforceConsistency: audits assets against brand rules |
| "Audit our brand" | Audit: cross-cutting consistency scorecard across all sub-skills |

---

## Example Usage

### Competitive Research

```
You: Research the brand landscape for developer productivity tools

Brand: Running Research workflow with 9-agent parallel analysis...

=== Competitive Brand Analysis ===
Agents: Claude, Gemini, Perplexity (3 perspectives x 3 dimensions)

Top competitors analyzed: Vercel, Raycast, Linear, Cursor, Warp

Positioning map:
  Developer-first + Premium:  Linear, Vercel
  Developer-first + Playful:  Raycast, Warp
  Technical + Minimal:        Cursor

Key findings:
  - All 5 use geometric sans-serif wordmarks
  - 4/5 use dark-mode-first color systems
  - Only Linear has a complete motion language
  - None have automated brand enforcement

White space identified:
  - "Warm technical" voice (all competitors are cold/clinical)
  - Illustration-driven identity (everyone is icon-only)
  - Brand-as-code approach (none ship tokens as npm packages)
```

### Product Naming

```
You: Name our CLI tool for database migrations

Brand: Running Naming/NameProduct...

=== Naming Candidates ===
Strategy: Metaphor-based (movement/transition themes)

Top 5 candidates:
  1. drift    — npm: available | .dev: available | USPTO: clear
  2. passage  — npm: taken    | .dev: available | USPTO: clear
  3. traverse — npm: available | .dev: taken    | USPTO: clear
  4. relay    — npm: taken    | .dev: taken    | USPTO: conflict (Relay by Facebook)
  5. flux     — npm: taken    | .dev: available | USPTO: conflict

Recommendation: "drift" — evokes natural movement, memorable,
all channels available, aligns with naming system conventions.

Next steps:
  1. Register npm package name
  2. Register drift.dev domain
  3. Run Verbal/Generate to define drift's sub-brand voice
```

### Design Tokens to Code

```
You: Generate our design tokens as code

Brand: Running Implementation/Implement...

=== Design Tokens Generated ===

Files created:
  src/tokens/theme.css        — CSS custom properties (light + dark)
  src/tokens/colors.ts        — OKLCH color palette with semantic mapping
  src/tokens/fonts.ts         — Type scale, font stacks, line heights
  src/tokens/motion-tokens.ts — Easing curves, durations, animation presets
  src/tokens/spacing.ts       — Spatial scale (4px base grid)

Token layers:
  Option tokens:   48 (raw color values, font sizes, etc.)
  Decision tokens: 32 (semantic mappings like "color-primary")
  Component tokens: 24 (button-bg, card-border, etc.)

Integration:
  - Import directly into Next.js/Tailwind projects
  - Compatible with Tailwind v4 CSS-first config
  - Dark mode via prefers-color-scheme + manual toggle
```

---

## Configuration

The brand pack requires no upfront configuration. All outputs are generated from conversational input.

| Setting | Required | Default | Description |
|---------|----------|---------|-------------|
| Brand output directory | No | `Docs/Brand/` | Where brand artifacts are stored |
| Token output directory | No | `src/tokens/` | Where generated code tokens are written |
| Image generation | No | Enabled | Uses available image generation tools for visual identity |
| MemPalace storage | No | Enabled | Stores brand decisions in knowledge graph for consistency |

---

## Customization

### Recommended Customization

- Run Strategy/Define early to establish your brand foundation before using other sub-skills
- Configure token output directory to match your project's source structure
- Adjust Verbal/Artifacts channel list to match your actual marketing channels

### Optional Customization

| Customization | File/Workflow | Description |
|---------------|---------------|-------------|
| Naming screening sources | `src/Naming/Tools/` | Add or modify npm, domain, and trademark checking tools |
| Voice frameworks | `src/Verbal/Workflows/Generate.md` | Extend beyond SB7 with industry-specific messaging frameworks |
| Color system method | `src/Visual/Workflows/ColorSystem.md` | Switch between OKLCH, HSL, or other color space approaches |
| Motion presets | `src/Visual/Workflows/MotionLanguage.md` | Adjust animation timing and easing defaults |
| Social platforms | `src/Implementation/Workflows/SocialBrand.md` | Add templates for platforms beyond GitHub, Twitter, Discord |
| Enforcement rules | `src/Guidelines/Workflows/EnforceConsistency.md` | Add custom brand rules for programmatic checking |

---

## Credits

- **StoryBrand SB7 Framework:** Donald Miller
- **Architecture design:** Council-designed (Architect, Designer, Engineer, Researcher debate)
- **Original brand work:** Lucas Gertel / DuranteOS

---

## Related Work

- [Building a StoryBrand](https://storybrand.com/) — Donald Miller's SB7 framework
- [Design Tokens W3C Community Group](https://www.w3.org/community/design-tokens/) — Token format specification
- [OKLCH Color Picker](https://oklch.com/) — Perceptually uniform color space
- [Pentagram](https://www.pentagram.com/) — Agency engagement model reference
- [Brand New (Under Consideration)](https://www.underconsideration.com/brandnew/) — Brand identity case studies

---

## Works Well With

- **DesignSystem** -- consumes Brand tokens to build component-level design systems
- **CinematicLanding** -- uses brand visual identity and motion language for landing pages
- **Sales** -- uses verbal identity and messaging for outbound and proposals
- **Media** -- applies brand visual identity to illustrations, thumbnails, and video
- **Research** -- deep competitive research feeds into brand strategy
- **MemPalace** -- stores brand decisions for cross-session consistency

---

## Changelog

### 2.0.0 - 2026-04-11
- Restructured from 7 flat workflows to 7 sub-skills (Media pattern)
- Absorbed StoryBrand L1-3 into Brand/Verbal (BrandScript, Generate, Artifacts)
- Added 11 new workflows: Naming, Voice, Color, Typography, Illustration, Motion, Social, Guidelines, Enforcement, Architecture
- Removed stale context documents (brand-dna.md, brandscript.md, etc.) — these are workflow outputs, not pack source
- Council-designed architecture with 3-round debate

### 1.0.0 - 2026-04-09
- Initial release with 7 flat workflows
