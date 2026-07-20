---
name: MotionPrimitives
description: Catalog of 33 production-grade animated UI components (Motion/Framer Motion + Tailwind CSS) with copy-paste source, docs, and examples bundled offline. Adds or enhances UI animations and micro-interactions in React/Next.js projects, or runs a gated design-system migration of a component subtree against your kit. USE WHEN add animation, animate component, enhance with animation, motion, framer motion, micro-interaction, hover effect, scroll animation, reveal on scroll, text animation, shimmer text, marquee, infinite slider, animated number, count up, animated background, transition panel, tilt effect, spotlight, glow effect, morphing dialog, morphing popover, magnetic button, spinning text, scramble text, animated component, make this more dynamic, motion primitives, design-system migration, migrate UI to design system, tailwind to kit, audit component subtree, deep UI audit, migrate components to our kit. NOT for full design-system extraction/tokens (use DesignSystem) or brand definition (use Brand).
role: advisor
accepts:
  - text
visibility: public
roots: []
capabilities:
  - customization.cascade
divergence_from_canonical:
  _four-copy-footer.md:
    partial_version: 1.0.0
    reason: "B-20 mechanical derivation from the shipped SKILL.md — the authored body carries no four-copy footer section; footer adoption is a content decision, not this conversion's"
    rationale_link: null
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
**Status:** v1.0.0

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/MotionPrimitives/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


# Motion Primitives — Animated UI Component Library

A bundled, offline mirror of **[Motion Primitives](https://motion-primitives.com)** (by Ibelick):
33 production-grade animated React components built with **Motion** (Framer Motion) +
**Tailwind CSS**. Use this skill as the best-practices catalog whenever a session needs to
**add or enhance UI animations** in a React / Next.js project.

Everything is local under `reference/` — no network needed.

## When this fires

Any request to animate, enhance, or add motion to UI: text effects, scroll reveals, hover
depth, animated numbers, marquees, morphing dialogs, glow/spotlight, magnetic buttons, etc.
Also: any request to **migrate a component subtree to a design system / kit** or **audit UI
against a kit** — that routes to Mode B below.

## Two modes

This pack has two distinct modes. Mode A is the default; Mode B is the gated migration capability.

- **Mode A — copy-and-adapt animation (default).** Add or enhance a single animation/micro-interaction
  by copying a catalog component's source and adapting it to the host. See *Operating workflow* below
  and the *Intent → component routing* table.
- **Mode B — gated design-system migration (audit + migrate).** Migrate or audit a whole component
  subtree against a design system / kit. Two pieces:
  - **`Workflows/deep-ui-audit.workflow.js`** — an RFC-0121 read-only native audit (4 lenses:
    tailwind-to-kit / tokens / motion / a11y; one agent per component; deterministic converge into a
    tiered plan; schema'd findings; writes nothing, network off). Run it first to produce the plan.
  - **`Workflows/DEEP-UI-MIGRATE.md`** — a sophisticated operator-GATED migration loop
    (SCOPE → ENRICH → AUDIT → CONVERGE-into-batches → GATE → PREP → MIGRATE → VERIFY) that preserves
    every `data-testid`/handler/prop, gates every animation behind `useReducedMotion()`, preserves RSC
    boundaries, records conservative skips, and typechecks per batch. The operator approves the plan
    before any code is placed.

  Reach for Mode B on: "migrate this UI to our design system", "tailwind to kit", "audit this component
  subtree", "deep UI audit". Mode B is gated + read-only-until-approved — it never mutates without an
  operator gate.

## Operating workflow (copy-and-adapt)

1. **Read the catalog.** Open `reference/INDEX.md` — 33 components grouped (Core / Text /
   Number / Interactive / Toolbars / Advanced), each with a one-line description, source
   pointer, and example count. For migration/automation work, read `reference/CATALOG.json`
   instead — a structured per-component layer (props, **shadcn/@kit pairing**, **migration-use**,
   adapt-notes, reduced-motion guard) built for design-system-migration workflows.
2. **Route intent → component** using the map below (or the INDEX descriptions).
3. **Read the source.** For the chosen component `<name>`:
   - `reference/components/<name>/page.mdx` — docs: props/API, usage, behavior
   - `reference/components/<name>/<name>.tsx` — the implementation to copy
   - `reference/components/<name>/examples/*.tsx` — concrete usage variants
4. **Adapt to the host project** (do NOT paste blindly):
   - Match the project's `cn`/`clsx` utility import path.
   - Match the Tailwind version + token conventions already in use.
   - Confirm the `motion` package is installed (`motion` for the modern import, or
     `framer-motion` on older projects); install if missing. Imports are `import { motion }
     from 'motion/react'` upstream — rewrite to the project's actual package.
   - Respect `prefers-reduced-motion` where the host app already does.
5. **Wire it in** to the target component/page, keeping the project's file + naming conventions.
6. **Verify** it typechecks and renders (run the project's typecheck / dev server).

Prefer copy-and-adapt over adding a package dependency. The upstream CLI
(`npx motion-primitives@latest add <name>`) and shadcn registry bundles
(`reference/registry/<name>.json`) exist as a fallback if the host project already uses a
shadcn-style registry.

## Intent → component routing

| You want to… | Use | Slug |
|---|---|---|
| Animate text in/per-char/per-word | Text Effect | `text-effect` |
| Cycle through phrases | Text Loop | `text-loop` |
| Morph one word into another | Text Morph | `text-morph` |
| Roll/flip characters | Text Roll | `text-roll` |
| Cryptographic scramble reveal | Text Scramble | `text-scramble` |
| Shimmer on text | Text Shimmer / Shimmer Wave | `text-shimmer` / `text-shimmer-wave` |
| Spin text in a circle | Spinning Text | `spinning-text` |
| Count up / animate a number | Animated Number / Sliding Number | `animated-number` / `sliding-number` |
| Reveal elements on scroll into view | In View | `in-view` |
| Scroll progress bar | Scroll Progress | `scroll-progress` |
| Stagger a list/grid on mount | Animated Group | `animated-group` |
| Sliding highlight behind tabs/menu | Animated Background | `animated-background` |
| Infinite marquee / logo strip | Infinite Slider | `infinite-slider` |
| Swipeable carousel | Carousel | `carousel` |
| Switch panels with enter/exit | Transition Panel | `transition-panel` |
| Collapsible section / FAQ | Accordion / Disclosure | `accordion` / `disclosure` |
| Modal dialog (with variants) | Dialog | `dialog` |
| Dialog that morphs from its trigger | Morphing Dialog | `morphing-dialog` |
| Popover that morphs from its trigger | Morphing Popover | `morphing-popover` |
| macOS-style dock | Dock | `dock` |
| Expanding/shrinking toolbar | Toolbar Dynamic / Expandable | `toolbar-dynamic` / `toolbar-expandable` |
| Cursor-following spotlight | Spotlight | `spotlight` |
| Animated glow around an element | Glow Effect | `glow-effect` |
| Moving border highlight | Border Trail | `border-trail` |
| 3D tilt on hover | Tilt | `tilt` |
| Button attracted to cursor | Magnetic | `magnetic` |
| Custom animated cursor | Cursor | `cursor` |
| Layered progressive blur (e.g. fade edges) | Progressive Blur | `progressive-blur` |
| Before/after image slider | Image Comparison | `image-comparison` |

## Shared dependencies

Some components import helpers in `reference/shared/`:
- `shared/hooks/useClickOutside.tsx`, `shared/hooks/usePreventScroll.tsx`
- `shared/lib/utils.ts` (the `cn` helper) and others

If a copied component imports one of these, copy the helper too (or map it to the host
project's existing equivalent — most projects already have a `cn`).

## Examples

**Example 1: Add a scroll-reveal animation to a marketing section**
```
User: "Make the features section fade up as you scroll to it"
→ motion-primitives skill fires (scroll animation / reveal on scroll trigger)
→ Routes intent → In View (`in-view`), reads reference/components/in-view/in-view.tsx + examples
→ Adapts the import to the project's motion package + cn helper, wraps the section
→ User gets a working scroll-triggered reveal. Note: the `in-view` source ships NO `prefers-reduced-motion` guard (CATALOG.json flags this) — wrap it in Motion's `MotionConfig reducedMotion="user"` or gate on `useReducedMotion()` to respect the OS setting
```

**Example 2: Animate a stat counter on a dashboard**
```
User: "The revenue number should count up when the card mounts"
→ motion-primitives skill fires (animated number / count up trigger)
→ Routes intent → Animated Number (`animated-number`), reads the component + examples
→ Wires it into the card, matching the project's Tailwind tokens
→ User gets a smooth count-up animation copy-adapted (no new package dependency)
```

**Example 3: Add depth to a CTA button**
```
User: "Make the primary button feel more dynamic on hover"
→ motion-primitives skill fires (hover effect / make this more dynamic trigger)
→ Routes intent → Magnetic (`magnetic`) or Tilt (`tilt`), reads source + shared hooks
→ Copies useClickOutside/cn helpers as needed, adapts to the button component
→ User gets a magnetic/tilt micro-interaction wired into the existing CTA
```

## Provenance & license

Upstream `github.com/ibelick/motion-primitives` (`main`), mirrored 2026-06-09. MIT licensed —
see `reference/LICENCE.md`. Attribution retained. To refresh, see `reference/README.md`.
