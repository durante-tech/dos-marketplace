---
name: FeatureDelivery
pack-id: durante-featuredelivery-v1.0.0
version: 1.0.0
author: durante-tech
description: Interactive feature delivery pipeline -- classification tiers, structured specs, council decision gates, multi-perspective review, and ship automation
type: skill
purpose-type: [delivery, pipeline, feature, shipping, review]
platform: claude-code
dependencies: []
keywords: [feature-delivery, pipeline, classify, spec, council-gate, review, ship, commit, pr, pull-request, tier, simple, medium, complex]
---

# FeatureDelivery

> Interactive feature delivery pipeline -- from complexity classification through structured specs, council decision gates, multi-perspective review, to commit/push/PR shipping.

---

## The Problem

Building features end-to-end involves multiple phases that developers typically handle ad-hoc:

- **No complexity assessment** -- jumping straight into coding without evaluating whether the feature needs a spec, a worktree, or a council review
- **No structured specs** -- building from a mental model instead of a written plan with schema changes, build order, and test strategy
- **No decision gates** -- no multi-perspective review before building or shipping, catching issues only after the PR is open
- **No consistent shipping flow** -- commit messages, PR bodies, and review checklists vary wildly between features

The fundamental issue: feature delivery needs a pipeline with the right amount of rigor for each feature's complexity.

---

## The Solution

The feature-delivery pack provides a tier-aware pipeline that scales process to match feature complexity.

**What's included:**

1. **Classification** -- Assess complexity tier (simple/medium/complex) based on signals like schema changes, multi-package scope, auth involvement
2. **Spec Generation** -- Structured implementation specification: schema changes, service layer, UI components, build order, test strategy
3. **Council Gates** -- Multi-agent debate at pipeline decision points (plan gate before build, review gate before ship)
4. **Code Review** -- 10-point checklist covering conventions, types, security, performance, testing, accessibility, data integrity
5. **Ship Automation** -- Step-by-step commit, push, PR sequence with human confirmation at each stage

**Tier behavior:**

| Tier | Worktree | Spec | Council Gates | Review |
|------|----------|------|---------------|--------|
| Simple | No | No | None | Quick |
| Medium | Yes | Yes | Quick (1 round) at plan | Standard |
| Complex | Yes | Yes | Full debate (3 rounds) at plan + review | Thorough |

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Classification tiers, pipeline phases, workflow routing |
| Classify workflow | `src/Workflows/Classify.md` | Assess feature complexity tier |
| Spec workflow | `src/Workflows/Spec.md` | Generate structured implementation specification |
| CouncilGate workflow | `src/Workflows/CouncilGate.md` | Multi-agent debate at decision points |
| Review workflow | `src/Workflows/Review.md` | Multi-perspective code review |
| Ship workflow | `src/Workflows/Ship.md` | Commit, push, PR sequence |

**Summary:**
- **Directories:** 1 (Workflows)
- **Files:** 6 (SKILL.md + 5 workflows)
- **Hooks registered:** 0
- **Dependencies:** git, gh CLI (for PR creation)

---

## What Makes This Different

This sounds similar to just asking an AI "build this feature" which also produces code. What makes this approach different?

The feature-delivery pack introduces a tier-aware pipeline where process scales with complexity. A simple config change skips straight to implementation. A complex multi-package feature with schema changes gets a full spec, council debate with architect/engineer/designer/pentester perspectives, thorough review, and structured PR. The council gate system catches architectural issues before code is written, not after. The 10-point review checklist ensures consistent quality across conventions, types, security, performance, testing, accessibility, and data integrity.

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "build a feature" / "deliver a feature" | Full pipeline: classify, spec (if needed), council gate, build, review, ship |
| "classify this feature" | Classify workflow only: assess tier |
| "spec this feature" / "write a spec" | Spec workflow: generate implementation specification |
| "council review" / "council gate" | CouncilGate workflow: multi-agent debate |
| "review the code" / "code review" | Review workflow: 10-point checklist |
| "ship it" / "commit and PR" | Ship workflow: commit, push, PR sequence |

---

## Example Usage

### Full Pipeline -- Complex Feature

```
User: "build a multi-tenant billing system with Stripe integration"

AI:
1. Routes to Classify -- detects schema changes, auth involvement, multi-package scope
2. Classification: Complex (tier 3)
3. Creates worktree for isolation
4. Routes to Spec -- generates implementation spec with schema changes, service layer,
   UI components, build order, test strategy
5. Council Gate (plan): architect, engineer, designer, pentester debate the spec (3 rounds)
6. Builds the feature following the approved spec
7. Routes to Review -- 10-point checklist (conventions, types, security, performance, etc.)
8. Council Gate (review): final multi-perspective review before shipping
9. Routes to Ship -- commit, push, PR with human confirmation at each step
```

### Quick Ship -- Simple Change

```
User: "update the footer copyright year"

AI:
1. Routes to Classify -- single file, no schema, no auth
2. Classification: Simple (tier 1)
3. Implements the change directly (no worktree, no spec, no council gate)
4. Routes to Review -- quick review pass
5. Routes to Ship -- "Commit this change? Push? Create PR?"
```

### Spec Only

```
User: "spec out adding SSO support with SAML"

AI:
1. Routes to Spec workflow directly
2. Generates structured specification:
   - Schema changes (identity providers table, SAML config)
   - Service layer (SAML assertion parser, session management)
   - UI components (SSO config page, provider selector)
   - Build order (schema first, then service, then UI)
   - Test strategy (unit, integration, e2e with mock IdP)
3. "Spec complete. Ready for council gate review?"
```

---

## Configuration

The feature-delivery pack requires a git repository and optionally the GitHub CLI for PR creation.

| Requirement | Required | Notes |
|-------------|----------|-------|
| Git repository with remote origin | Yes | All tiers use git for commits |
| `gh` CLI installed | For Ship workflow | Required only for PR creation |
| Project detected | For medium/complex tiers | Needed for worktree isolation |

---

## Customization

### Recommended Customization

- Adjust tier classification signals in the Classify workflow to match your project's complexity indicators (e.g., add "involves payments" as a complexity signal)
- Customize the 10-point review checklist to include project-specific checks (e.g., i18n, analytics events)

### Optional Customization

| Area | What to Change | Effect |
|------|---------------|--------|
| Tier thresholds | Modify signal weights in Classify | Changes when features escalate to medium/complex |
| Council agents | Add or replace perspectives in CouncilGate | Different expertise in plan/review debates |
| Debate rounds | Adjust round count per tier | More or fewer rounds of council deliberation |
| Review checklist | Add/remove items from the 10-point list | Review focuses on your project's priorities |
| PR template | Customize Ship workflow PR body format | PR descriptions match your team's conventions |

---

## Credits

- **Pipeline design:** Lucas Gertel / DuranteOS
- **Council concept:** Multi-agent debate pattern

---

## Related Work

- [GitHub Actions](https://github.com/features/actions) -- CI/CD pipeline automation (complements Ship workflow)
- [Linear](https://linear.app/) -- Issue tracking with project cycles (upstream of feature requests)
- [Graphite](https://graphite.dev/) -- Stacked PRs and code review tooling (alternative shipping flow)

---

## Works Well With

- **Sentinel Pack** -- Run Sentinel first to discover codebase conventions that the Review workflow should enforce
- **Thinking Pack** -- Use first-principles analysis to evaluate architectural decisions before the council gate
- **DesignSystem Pack** -- Generate workflow specs reference DESIGN.md tokens for UI components

---

## Changelog

### 1.0.0 - 2026-04-09
- Initial release
- 3-tier classification system (simple/medium/complex)
- Structured implementation specs with build order
- Council gate system with tier-aware debate depth
- 10-point code review checklist with severity classification
- Ship automation with human confirmation at each stage
