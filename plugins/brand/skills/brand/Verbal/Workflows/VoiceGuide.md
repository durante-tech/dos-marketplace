---
name: Voice Guide
description: Brand voice and tone documentation with channel-specific guidance
status: BETA
---

# Voice Guide

Define and document the brand's verbal identity — how it sounds across every touchpoint. Produces a machine-readable voice guide that can be used by AI writing tools.

## When to Use

- Defining brand voice for the first time
- Documenting an instinctive voice that needs to scale beyond founders
- Creating voice guidelines for AI content generation tools
- Onboarding writers, marketers, or AI systems to the brand voice

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Extract Voice from Existing Content

If the brand has existing content:
1. Analyze 10-20 representative pieces (docs, blog, social, emails)
2. Identify patterns: formality level, humor usage, technical depth, personality traits
3. Note inconsistencies that need resolution

If no existing content, derive from brand Strategy outputs (personality, archetype, values).

### Step 2: Define Voice Attributes

Define 3-5 personality traits that characterize the voice:

| Attribute | Description | Scale |
|-----------|-------------|-------|
| e.g., Precise | We choose exact words, not approximate ones | Casual ←→ Precise |
| e.g., Warm | We're approachable, not corporate | Cold ←→ Warm |
| e.g., Confident | We state positions, not hedge | Tentative ←→ Confident |

### Step 3: Define Tone Spectrum

Voice is constant; tone flexes by context:

| Context | Tone Shift | Example |
|---------|-----------|---------|
| Documentation | More precise, less casual | "Configure the build pipeline using..." |
| Error messages | Empathetic, action-oriented | "Something went wrong. Here's how to fix it:" |
| Marketing | More energetic, confident | "Ship faster. Build better." |
| Changelogs | Concise, celebratory | "New: Dark mode support across all components" |
| Support | Patient, helpful | "I understand the frustration. Let's sort this out." |
| Social media | Casual, personality-forward | "We accidentally shipped a feature nobody asked for. You're welcome." |

### Step 4: Create We-Say / Don't-Say List

| We Say | We Don't Say | Why |
|--------|-------------|-----|
| "Build" | "Leverage" | Plain language over jargon |
| "Fix" | "Remediate" | Developer-friendly |
| "You" | "Users" | Direct address |
| "Check out" | "Please find enclosed" | Casual, not corporate |

### Step 5: Produce Voice Guide Document

Output:
- Voice attributes with scales
- Tone spectrum by context
- We-say/don't-say vocabulary list
- Sample rewrites (before/after showing voice applied)
- Channel-specific guidance (docs, social, email, CLI output)
- Machine-readable format for AI content tools
