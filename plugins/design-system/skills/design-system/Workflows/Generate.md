---
name: Generate
description: Generate new UI code (React, HTML, CSS, Tailwind) that strictly adheres to the rules defined in DESIGN.md.
status: STABLE
bestPath:
  - title: "Load DESIGN.md"
    description: "Read the project's DESIGN.md and parse its tokens and usage rules before writing any code."
  - title: "Analyze & Map Tokens"
    description: "Understand the requested component and map applicable color, typography, spacing, and component tokens."
  - title: "Generate & Save Code"
    description: "Write token-adherent code following the project's framework and save it to the codebase."
  - title: "Verify Token Adherence"
    description: "Self-check that every value traces to a DESIGN.md token, with no hardcoded hex, sizes, or fonts."
---

# Generate Workflow

Generate new UI code (React, HTML, CSS, Tailwind) that strictly adheres to the rules defined in DESIGN.md.

## When to Use

- User wants to build a new component, page section, or UI element
- User says "build a profile card", "create a pricing section", "generate a login form"
- DESIGN.md exists in the project (if not, redirect to Init first)

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Load Context

**MANDATORY: ALWAYS read DESIGN.md before writing any code. This is non-negotiable.**

1. Read DESIGN.md. **Precedence (when two exist):** if BOTH a project-root DESIGN.md (authored by Init) and a DesignBundle DESIGN.md (`claude-design-system-bundle/DESIGN.md`) are present, the precedence rule defined in the Init workflow selects the canonical one — read that one, never merge the two.
2. Parse the available tokens: colors, typography, spacing, component blueprints.
   - **Machine path (preferred):** read the structured `tokens:` block — the DTCG `$value`/`$type` block Init emits in DESIGN.md — and consume that JSON directly. Do NOT re-parse the human-readable markdown pipe-tables when the structured block is present; the structured block is the single machine source, so there is zero prose-reparse on the generation path.
   - **Fallback (additive-migration window):** if no `tokens:` block exists yet, parse the markdown token tables instead. Both paths yield the same token set.
3. Note any usage rules that constrain how tokens can be applied

### Step 2: Analyze Request

Understand the component the user wants to build:
- What type of component (card, form, section, nav, etc.)
- Does a component blueprint exist in DESIGN.md? If so, follow it exactly.
- If no blueprint exists, compose from available tokens.

### Step 3: Map Tokens

Determine which design tokens from DESIGN.md apply to this component:
- **Colors** -- background, text, border, accent, hover states
- **Typography** -- which heading level, body size, weight
- **Spacing** -- padding, margins, gaps from the spacing scale
- **Component rules** -- radius, shadows, hover behavior from blueprints

### Step 4: Generate Code

Write the code strictly using defined tokens:
- Map tokens to CSS variables, Tailwind classes, or inline styles as dictated by the project framework
- **shadcn projects (framework-conditional):** if the target project is a shadcn/ui project (a `components.json` is present), emit shadcn-registry-compatible components and prefer a DesignBundle `registry.json` as the token source when one exists. This is ONE framework path among Tailwind, CSS Modules, vanilla CSS, and styled-components — never force shadcn on a project that is not already using it.
- **Do not hallucinate colors or sizes not present in the system**
- If a needed value is not in DESIGN.md, flag it to the user rather than inventing one
- The same flag-not-invent rule applies on the machine path: if a token is referenced but absent from the structured `tokens:` JSON (or the JSON entry has no `$value`), flag it to the user rather than inventing a value — never synthesize a token the structured block omits
- Follow the project's existing code patterns (component structure, file naming, imports)

### Step 5: Save

Write the new component to the appropriate directory in the user's codebase.

### Step 6: Verify Token Adherence

After generating, self-check:
- Every color value references a DESIGN.md token
- Every font size and weight matches a DESIGN.md token
- Every spacing value comes from the DESIGN.md scale
- No hardcoded hex codes, pixel values, or font names

## Validation

- [ ] DESIGN.md was read before any code was written
- [ ] Structured `tokens:` block consumed when present (markdown tables used only as fallback)
- [ ] All colors reference design system tokens (no hardcoded hex/rgb)
- [ ] All typography uses defined scale (no arbitrary font sizes)
- [ ] All spacing uses defined scale (no arbitrary pixel values)
- [ ] Component blueprint followed if one exists in DESIGN.md
- [ ] Code matches the project's framework and patterns
- [ ] Any needed values not in DESIGN.md were flagged, not invented