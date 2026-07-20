---
name: Brand Architecture
description: Sub-brand and product line structure with token inheritance rules
status: BETA
---

# Brand Architecture

Define how multiple brands, products, or features relate within a portfolio. Produces architecture model, naming hierarchy, visual differentiation rules, and token inheritance map.

## When to Use

- Launching a second product and need to decide how it relates to the parent brand
- Evaluating branded house vs house of brands vs endorsed brand model
- Defining which tokens child brands inherit vs override
- Planning a multi-product naming hierarchy

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Assess Current State

1. Read brand definition (`Docs/brand-definition.md`) if available
2. Inventory existing products, features, and sub-brands
3. Map current naming patterns and visual relationships
4. Identify pain points in current architecture (confusion, dilution, inconsistency)

### Step 2: Select Architecture Model

Present the four standard models with trade-offs:

| Model | Example | When to Use |
|-------|---------|-------------|
| Branded House | Google (Maps, Drive, Docs) | Strong parent brand, related products |
| House of Brands | P&G (Tide, Pampers, Gillette) | Distinct audiences, unrelated categories |
| Endorsed Brands | Marriott Courtyard | Parent credibility + sub-brand personality |
| Hybrid | Microsoft (Office, Xbox, LinkedIn) | Mixed portfolio, strategic acquisitions |

### Step 3: Define Token Inheritance

Map which brand tokens flow from parent to child:

```
Parent Brand Tokens
├── INHERITED (child cannot override)
│   ├── Brand values
│   ├── Voice personality traits
│   └── Typography system (primary typeface)
├── CUSTOMIZABLE (child can adapt)
│   ├── Color accent palette
│   ├── Motion personality
│   └── Illustration style
└── INDEPENDENT (child defines own)
    ├── Logo/mark
    ├── Product-specific vocabulary
    └── Feature naming conventions
```

### Step 4: Produce Architecture Document

Output a brand architecture document with:
- Selected model and rationale
- Relationship map (visual diagram of brand hierarchy)
- Token inheritance rules
- Naming hierarchy framework
- Migration roadmap (if restructuring existing brands)
