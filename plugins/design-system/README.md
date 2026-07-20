---
name: DesignSystem
pack-id: durante-designsystem-v1.0.0
version: 1.0.0
author: durante-tech
description: AI-native design system management via DESIGN.md — extract, initialize, manage, and apply deterministic design systems with semantic tokens for colors, typography, spacing, and components
type: skill
purpose-type: [design-system, ui, frontend, tokens, styling]
platform: claude-code
dependencies: []
keywords: [design-system, DESIGN.md, design-tokens, ui, components, styling, tailwind, css-variables, typography, color-palette, spacing, audit, consistency]
---

# DesignSystem

> AI-native design system management -- extract, initialize, generate, and audit UI through a single DESIGN.md specification file.

---

## The Problem

Design systems are one of the most impactful investments a product team can make, yet most projects either skip them entirely or let them rot. The typical experience:

- **No single source of truth** -- colors, fonts, and spacing are scattered across CSS files, Tailwind configs, and component props with no central authority
- **Hallucinated styles** -- AI assistants generate UI with made-up hex codes and arbitrary spacing because they have no awareness of the project's design tokens
- **Drift over time** -- hardcoded values creep in as developers bypass the system, and nobody catches it until the UI looks inconsistent
- **Extraction is manual** -- reverse-engineering a design system from an existing site requires tedious inspection and documentation

The fundamental issue: design systems need to be machine-readable, not just human-readable PDFs.

---

## The Solution

The design-system skill implements the DESIGN.md paradigm. It treats design systems as AI-readable markdown files containing semantic design tokens and component rules, enabling deterministic and consistent UI generation across projects.

**What's included:**

1. **Init** -- Create a new DESIGN.md from scratch or extract one from an existing URL/codebase
2. **Update** -- Surgically modify specific tokens (colors, fonts, spacing) in an existing DESIGN.md
3. **Generate** -- Build new UI components (React, HTML, CSS, Tailwind) strictly adhering to DESIGN.md tokens -- no hallucinated colors
4. **Audit** -- Scan existing UI code for hardcoded values that violate the design system, with optional auto-fix

**Core principle:** When generating UI code, the agent MUST read DESIGN.md first and strictly apply the tokens. No hallucinating colors, font sizes, or spacing values not present in the system.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill router | `src/SKILL.md` | Top-level skill definition and workflow routing |
| Init workflow | `src/Workflows/Init.md` | Create or extract a new DESIGN.md |
| Update workflow | `src/Workflows/Update.md` | Modify design tokens in an existing DESIGN.md |
| Generate workflow | `src/Workflows/Generate.md` | Generate UI code strictly from DESIGN.md tokens |
| Audit workflow | `src/Workflows/Audit.md` | Check UI code against DESIGN.md for violations |

**Summary:**
- **Directories:** 1 (Workflows)
- **Files:** 5
- **Hooks registered:** 0
- **Dependencies:** None

---

## What Makes This Different

This sounds similar to just using Tailwind or CSS variables, which also centralize design tokens. What makes this approach different?

The design-system skill makes design tokens AI-native. DESIGN.md is a markdown specification that any AI agent can read before generating code, ensuring deterministic output. The Init workflow can extract a complete token system from an existing URL or codebase. The Generate workflow enforces strict token adherence -- it will not produce colors, sizes, or spacing that are not in the system. The Audit workflow scans your codebase for hardcoded values that bypass the design system and can auto-fix them. The result is a self-enforcing loop: define tokens once, generate code from tokens, audit code against tokens.

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "create a design system" | Routes to Init, generates DESIGN.md from user input |
| "extract design from this URL" | Routes to Init in extraction mode, fetches and parses the site |
| "change the primary color to blue" | Routes to Update, surgically edits the token in DESIGN.md |
| "build a profile card component" | Routes to Generate, reads DESIGN.md first, outputs code using tokens |
| "audit this UI against the design system" | Routes to Audit, scans for hardcoded violations |
| "design tokens" or "style guide" | Routes to Init or Update depending on whether DESIGN.md exists |

---

## Example Usage

### Create a New Design System

```
User: "create a design system for my SaaS app -- dark mode first, blue primary"

AI:
1. Routes to Init workflow
2. Generates DESIGN.md with color palette (OKLCH), typography scale, spacing, components
3. Saves DESIGN.md to project root
4. "Design system created at DESIGN.md. It defines your color tokens, typography hierarchy, spacing scale, and component blueprints."
```

### Extract from Existing Site

```
User: "extract the design system from linear.app"

AI:
1. Routes to Init in extraction mode
2. Fetches the site, analyzes colors, fonts, spacing
3. Produces DESIGN.md with extracted tokens
4. "Extracted design system with 6 color scales, Inter + JetBrains Mono typography, 4px spacing grid."
```

### Audit Existing Code

```
User: "check my components against the design system"

AI:
1. Routes to Audit workflow
2. Reads DESIGN.md, then scans src/ for hardcoded hex codes, font families, spacing
3. Reports violations with file/line references
4. "Found 12 hardcoded colors and 3 unauthorized fonts. Want me to fix them?"
```

---

## Configuration

The design-system pack requires no external tools or API keys. All configuration lives in the DESIGN.md file itself.

| Setting | Default | Notes |
|---------|---------|-------|
| DESIGN.md location | Project root | Init creates it at the root; all workflows look there first |
| Color format | OKLCH | Perceptually uniform color space; customizable in DESIGN.md |
| Token categories | Colors, typography, spacing, components | All categories are generated by Init; editable via Update |
| Audit scope | `src/` directory | Audit scans source files; adjustable per invocation |

---

## Customization

### Recommended Customization

- Edit DESIGN.md directly to adjust tokens for your brand (colors, fonts, spacing scale)
- Configure the Init workflow's extraction depth for sites with complex nested styles

### Optional Customization

| Area | What to Change | Effect |
|------|---------------|--------|
| Color format | Switch from OKLCH to HSL or hex in DESIGN.md | Generated code uses your preferred color format |
| Component blueprints | Add or modify component definitions in DESIGN.md | Generate workflow produces components matching your patterns |
| Audit strictness | Adjust violation severity levels | Audit reports distinguish warnings from errors |
| Framework target | Specify React, HTML, Vue, or Tailwind in Generate requests | Output code uses your framework's conventions |

---

## Credits

- **DESIGN.md paradigm:** Inspired by Google Stitch's approach to AI-readable design specifications
- **Original skill:** Lucas Gertel / DuranteOS

---

## Related Work

- [Google Stitch](https://stitch.withgoogle.com/) -- AI-readable design specifications (inspiration for DESIGN.md paradigm)
- [Tailwind CSS](https://tailwindcss.com/) -- Utility-first CSS framework with token-like classes (complements, not replaces)
- [Style Dictionary](https://amzn.github.io/style-dictionary/) -- Design token build system by Amazon (JSON-based alternative)
- [Figma Tokens](https://tokens.studio/) -- Design token management plugin for Figma (visual alternative)

---

## Works Well With

- **Brand Pack** -- Brand definition tokens feed directly into DESIGN.md creation
- **Media Pack** -- Generated visuals can reference DESIGN.md for brand-consistent colors

---

## Changelog

### 1.0.0 - 2026-04-09
- Initial release
- Init, Update, Generate, and Audit workflows
- DESIGN.md paradigm for AI-native design token management
- Deterministic UI generation from semantic tokens
