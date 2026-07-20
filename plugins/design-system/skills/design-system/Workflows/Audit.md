---
name: Audit
description: Review existing UI code against DESIGN.md, flagging and optionally fixing hardcoded or unauthorized styles.
status: STABLE
bestPath:
  - title: "Load Context"
    description: "Read DESIGN.md and identify the target files and styling approach."
  - title: "Scan for Violations"
    description: "Search the codebase for hardcoded colors, typography, spacing, and component values that bypass tokens."
  - title: "Classify & Report"
    description: "Categorize each violation by severity and produce a file/line-referenced report."
  - title: "Auto-Fix (Optional)"
    description: "Replace hardcoded values with the closest matching tokens and re-scan to confirm resolution."
---

# Audit Workflow

Review existing UI code to ensure it complies with DESIGN.md, flagging and optionally fixing hardcoded or unauthorized styles.

## When to Use

- User says "audit UI", "check consistency", "find hardcoded values", "lint styles"
- After generating new components to verify compliance
- Periodically to catch design system drift
- Before a design system update to assess current state

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Load Context

1. Read the project's DESIGN.md to understand the authorized tokens
2. Identify the target files or directories to scan (default: `src/` directory)
3. Determine the project's styling approach (Tailwind, CSS Modules, styled-components, inline styles)

### Step 2: Scan for Violations

Search the codebase for styles that bypass the design system:

**Color violations:**
- Hardcoded hex codes (`#3B82F6`, `#fff`, etc.)
- Hardcoded rgb/rgba/hsl values
- Tailwind color classes not mapped to design tokens (e.g., `bg-blue-500` when the system uses `bg-primary`)

**Typography violations:**
- Hardcoded font-family declarations
- Arbitrary font sizes not in the type scale
- Hardcoded font weights not in the system

**Spacing violations:**
- Arbitrary pixel values for padding/margin/gap
- Tailwind spacing classes not on the defined scale

**Component violations:**
- Border radius values not matching component blueprints
- Shadow values not defined in the system

### Step 3: Classify Violations

For each violation found, classify:

| Severity | Description | Example |
|----------|-------------|---------|
| **Critical** | Hardcoded color that conflicts with a design token | `color: #3B82F6` when `brand-primary` exists |
| **Warning** | Hardcoded value that has no corresponding token | `padding: 13px` (not on the spacing scale) |
| **Info** | Style that works but could use the token for consistency | Inline `font-weight: 700` instead of `heading-weight` token |

### Step 4: Report

Present the audit results:

```markdown
## Design System Audit Report

### Summary
- Files scanned: X
- Violations found: Y
- Critical: X | Warning: Y | Info: Z

### Violations by File

#### src/components/Card.tsx
- Line 12: `color: #3B82F6` -- should be `var(--brand-primary)` [CRITICAL]
- Line 18: `padding: 20px` -- should be `var(--space-6)` (1.5rem) [WARNING]

#### src/components/Hero.tsx
- Line 5: `font-size: 48px` -- should be `var(--heading-section)` (3rem) [WARNING]
```

### Step 5: Auto-Fix (If Requested)

If the user wants fixes applied:
1. Use the Edit tool to replace hardcoded values with the correct design tokens
2. Map each violation to the closest matching token
3. If no close match exists, flag it for the user's decision
4. Re-scan after fixes to confirm all violations are resolved

## Validation

- [ ] Step 0 loaded the `brand` SoT before any token-critical scanning
- [ ] DESIGN.md was loaded and parsed for authorized tokens
- [ ] Codebase scanned for hardcoded colors, fonts, spacing, and component values
- [ ] Each violation classified by severity (critical, warning, info)
- [ ] Report includes file paths and line numbers
- [ ] Auto-fix applied only with user consent
- [ ] Re-scan confirms fixes resolved the violations