---
name: Generate Guidelines
description: Brand book generation from all brand artifacts
status: BETA
---

# Generate Brand Guidelines

Compile a comprehensive brand guidelines document from all brand artifacts. Living document, not a static PDF — structured for machine consumption and human reference.

## When to Use

- After completing brand definition, visual identity, and verbal identity
- Onboarding new team members or agencies
- Creating a reference document for AI content tools
- Updating guidelines after brand evolution

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Gather All Brand Artifacts

Read from all sub-skill outputs:
- Strategy: brand-definition.md (purpose, values, positioning, personality)
- Verbal: voice guide, messaging framework, BrandScript
- Visual: logo system, color system, typography, illustration direction, motion language
- Implementation: theme.css, token files, social templates

### Step 2: Compile Guidelines Document

Structure:

```markdown
# [Brand Name] Brand Guidelines

## 1. Brand Foundation
- Purpose, mission, vision
- Values and personality
- Brand archetype
- Positioning statement

## 2. Logo
- Primary logo and variants
- Clear space rules
- Minimum sizes
- Misuse examples (don'ts)

## 3. Color System
- Primary and secondary palettes (with hex, RGB, OKLCH)
- Usage ratios and rules
- Accessibility matrix
- Dark mode palette

## 4. Typography
- Typeface selections with licensing
- Type scale
- Hierarchy rules
- Responsive behavior

## 5. Voice & Tone
- Voice attributes
- Tone spectrum by context
- We-say / don't-say vocabulary
- Channel-specific guidance

## 6. Imagery
- Illustration style
- Photography direction
- Screenshot treatments
- Diagram conventions

## 7. Motion
- Motion personality
- Duration and easing tokens
- Interaction patterns
- Do/don't animation examples

## 8. Applications
- Social media templates
- Email signatures
- Presentation templates
- Code snippet styling
```

### Step 3: Generate Machine-Readable Version

Output a `brand-guidelines.json` alongside the markdown:
- Color tokens with all formats
- Typography tokens
- Voice rules as structured data
- Logo file inventory with paths
- This enables AI tools to consume brand rules programmatically

### Step 4: Identify Gaps

Flag any sections where artifacts are missing:
- "Color System: NOT YET DEFINED — run Brand/Visual/ColorSystem workflow"
- This turns the guidelines into a progress tracker
