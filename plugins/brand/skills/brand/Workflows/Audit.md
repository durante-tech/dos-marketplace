---
name: Audit
description: Evaluate a brand implementation against elite patterns and produce an actionable scorecard with specific remediation priorities.
status: STABLE
bestPath:
  - title: "Gather Brand Evidence"
    description: "Collect brand definition, theme files, token usage, and live-site screenshots."
  - title: "Mirror Test"
    description: "Score whether the design alone reflects the product and audience."
  - title: "Patterns + Anti-Patterns"
    description: "Score the 6 Patterns That Win and scan for common brand anti-patterns."
  - title: "Token Architecture Assessment"
    description: "Evaluate option/decision/component token layering, coverage, and dark-mode/reduced-motion handling."
  - title: "Produce Scorecard"
    description: "Compile weighted scores and top-5 remediation priorities into the audit scorecard."
---

# Brand Audit

Evaluate a brand implementation against elite patterns. Produces an actionable scorecard with specific remediation priorities.

## When to Use

- After Implement workflow to validate generated artifacts
- User says "brand audit", "score our brand", "how good is our brand"
- Before a redesign to establish a baseline
- To compare against competitor brands

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Gather Brand Evidence

Collect all brand artifacts:
1. Read brand definition (`Docs/brand-definition.md`) if available
2. Read theme files: theme.css, fonts.ts, stage-colors.ts, motion-tokens.ts
3. Scan codebase for brand token usage vs hardcoded violations
4. Screenshot the live site if available (desktop + mobile)

### Step 2: The Mirror Test

The most important single test -- does the brand reflect what the product actually is?

Score each question 1-5:
1. If you removed the logo, could users identify the company from the design alone?
2. Does the visual language match the product's actual experience?
3. Would a new user's first impression match what the product delivers?
4. Does the brand feel designed FOR this audience (not adapted from a template)?
5. Is there a consistent personality across all touchpoints?

**Mirror Test Score: X/25**

### Step 3: The 6 Patterns That Win

Score against patterns observed in elite brands (Vercel, Linear, Stripe, Raycast, Arc):

1. **Custom Typography** (not system defaults) -- distinctive heading typeface, clear scale jumps, personality-reflecting type choices, variable font features. Score /10.
2. **One Hero Color, Owned** -- single color immediately associated with the brand, consistent usage, distinctive vs competitors, works in light/dark. Score /10.
3. **Dark-Mode-First** (for dev tools/technical products) -- dark as default, colors designed for dark surfaces, light mode exists but dark is "brand" mode. Score /10.
4. **Purposeful Motion** -- animations serve purpose (guide, indicate, narrate), no gratuitous motion, consistent personality, reduced motion fallbacks, scroll-driven storytelling. Score /10.
5. **Voice as Design System** -- documented tone, personality in error messages/empty states/microcopy, consistent across marketing and docs. Score /10.
6. **Brand Reflects Product** -- visual metaphors connect to product, interactive elements preview the experience, website feel matches product feel. Score /10.

**Patterns That Win Score: X/60**

### Step 4: Anti-Pattern Detection

Scan for common brand failures:
- Generic stock photography (High severity)
- Indistinguishable color palette (High)
- Inconsistent typography / hardcoded fonts (Medium)
- Gratuitous animation (Medium)
- Accessibility violations (High)
- Hardcoded values bypassing tokens (Medium)
- Template-looking design (High)
- Voice inconsistency across channels (Low)
- Mobile afterthought (Medium)
- No motion at all in a dynamic category (Low)

**Anti-Pattern Count: X/10** (lower is better)

### Step 5: Token Architecture Assessment

If brand tokens exist, evaluate quality:
- Token layering -- option/decision/component layers present (/10)
- Token coverage -- colors, type, motion, spacing all tokenized (/10)
- Token consistency -- decision tokens reference option tokens, not hardcoded (/10)
- Dark mode tokens -- not just inverted, properly adjusted (/10)
- Reduced motion tokens -- duration zeroed, layout preserved (/10)

**Token Architecture Score: X/50**

### Step 6: Produce Audit Scorecard

Compile all scores into a weighted scorecard:

| Section | Score | Weight |
|---------|-------|--------|
| Mirror Test | X/25 | 30% |
| Patterns That Win | X/60 | 35% |
| Anti-Patterns | X/10 (inverted) | 15% |
| Token Architecture | X/50 | 20% |

**Overall Score: X/100**

Include:
- Top 5 remediation priorities (issue, impact, effort, specific fix)
- Comparison to elite benchmarks (Vercel ~85, Linear ~90, Stripe ~88)
- Next steps: which workflows to run for remediation

Save scorecard to `Docs/brand-audit-scorecard.md`.

## Validation

- [ ] Mirror Test completed with evidence for each question
- [ ] All 6 Patterns That Win scored individually
- [ ] Anti-pattern scan covers all 10 categories
- [ ] Token architecture assessed (or noted as missing)
- [ ] Top 5 remediation priorities are specific and actionable
- [ ] Overall score calculated with weighted formula
- [ ] Comparison to elite benchmarks included