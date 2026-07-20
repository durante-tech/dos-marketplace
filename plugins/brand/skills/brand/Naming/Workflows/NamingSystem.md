---
name: Naming System
description: Naming conventions and taxonomy for developer tool products
status: BETA
---

# Naming System

Define naming conventions and taxonomy for a product's feature hierarchy. Ensures consistent naming across products, features, CLI commands, and API endpoints.

## When to Use

- Establishing naming conventions for a new product line
- Product has grown organically and naming is inconsistent
- Need conventions for CLI commands, API endpoints, and feature names
- Planning how future features should be named

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Audit Current Naming

If the product exists, audit:
- Product and feature names
- CLI command naming patterns (kebab-case? verb-noun?)
- API endpoint naming conventions
- Package/module naming
- UI element labels

### Step 2: Define Naming Principles

Establish 3-5 naming principles aligned with brand personality:

Example for a developer tool brand:
1. **Clarity over cleverness** — names should explain, not mystify
2. **Consistent grammar** — all CLI commands use verb-noun (e.g., `create-app`, `deploy-site`)
3. **Short and typeable** — max 2 words, no underscores in user-facing names
4. **Technical precision** — use correct technical terms, not marketing simplifications
5. **Extensible** — names should accommodate future variants without renaming

### Step 3: Build Naming Taxonomy

Define naming conventions per layer:

| Layer | Convention | Examples |
|-------|-----------|----------|
| Product | Invented/Metaphorical, Title Case | Linear, Vercel, Supabase |
| Feature | Descriptive, Title Case | Issues, Deployments, Edge Functions |
| CLI Command | kebab-case, verb-noun | `create-project`, `deploy-app` |
| API Endpoint | snake_case or camelCase (match framework) | `/api/create_project` |
| Config Key | camelCase | `buildOutput`, `deployRegion` |
| Internal Tool | Casual name, no brand weight | "the dashboard", "admin panel" |

### Step 4: Produce Naming Guide

Output a naming guide document with:
- Naming principles
- Taxonomy table with conventions per layer
- Examples of good and bad naming
- Decision tree for "how do I name this new thing?"
- Glossary of established terms (avoid synonyms)
