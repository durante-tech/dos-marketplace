---
name: DeepUiMigrate
description: Operator-gated loop that migrates a component subtree to the kit's idiom — Tailwind to kit components, hardcoded values to tokens, static UI to MotionPrimitives, plus a11y hardening.
status: STABLE
bestPath:
  - title: "Scope + Audit"
    description: "Resolve the component subtree and run the read-only 4-lens deep-ui-audit."
  - title: "Converge + Gate"
    description: "Group findings into structural/motion/a11y batches and get operator approval before any code is placed."
  - title: "Prep"
    description: "Install dependencies and copy-adapt the needed components, typechecked in isolation."
  - title: "Migrate + Verify"
    description: "Apply each batch's lens findings per file, gate animations behind reduced-motion, and typecheck after every batch."
---

# Deep UI Migrate — the full gated loop

## When to Use

- User wants to migrate a component subtree to the design system / kit idiom, or audit one against it
- Fit: "migrate this UI to our design system", "tailwind to kit", "audit this component subtree", "deep UI audit"
- NOT for full design-system extraction/tokens (use DesignSystem) or brand definition (use Brand)

A repeatable pipeline to migrate a component subtree to "the way it should be" using
the kit's idiom: raw Tailwind → `@kit/ui`/shadcn components, hardcoded values → design
tokens, static UI → MotionPrimitives, plus a11y hardening. Motion is **one lens of four**.

The **audit** is a single autonomous workflow (`deep-ui-audit.workflow.js`, read-only).
The **migration** is operator-gated and batched, so it is NOT one autonomous workflow —
it is the loop below, driven by the agent with your approval between batches.

## The loop

```
0. SCOPE        resolve the entry component's local import subtree → component file list
                (read the entry file, ls its dir, follow ./ imports)
1. ENRICH       (once per catalog, optional) ensure reference/CATALOG.json is current
                — structured per-component cards: props, shadcn/kit pairing,
                  migration-use, adapt-notes, reduced-motion guard
2. AUDIT        Workflow({ name:"deep-ui-audit", args:{ componentPaths, kitInventory } })
                → 4-lens fan-out → tiered plan (Tailwind→kit · tokens · motion · a11y)
3. CONVERGE     present the plan grouped into batches:
                  A — structural   (Tailwind→kit + tokens)   med risk → verify carefully
                  B — motion        (MotionPrimitives)        needs `motion` dep
                  C — a11y          (guards + landmarks)      couples to B
4. GATE         operator approves scope/batches  ← STOP here; never place code before this
5. PREP         install `motion`; copy-and-adapt the needed MotionPrimitives components
                into the repo (cn → repo helper, fix JSX namespace, keep 'use client'),
                typecheck the components in isolation BEFORE wiring
6. MIGRATE      per batch, fan out worktree-free agents (one per file — files are disjoint):
                  - apply ONLY that batch's lens findings
                  - preserve EVERY data-testid / handler / prop / conditional verbatim
                  - gate every animation behind useReducedMotion() → static fallback
                  - preserve RSC boundaries (server-safe file → client wrapper, not convert)
7. VERIFY       `typecheck` after EVERY batch against the clean baseline; visual eyeball
                is the operator's (authed routes can't be screenshotted from here)
```

## Running the audit engine

```js
Workflow({ name: "deep-ui-audit", args: {
  componentPaths: [
    "/abs/.../coach/facebook-page.tsx",
    "/abs/.../coach/accounts-roster.tsx",
    // … the scoped subtree
  ],
  // ground the tailwind-to-kit lens (else agents grep the repo themselves):
  kitInventory: "card button badge avatar empty tabs skeleton progress tooltip separator …",
} })
```

Returns `{ totals, plan }`. `plan` is per-component findings tagged `lens / tier / effort / risk`.

## Migration discipline (learned, load-bearing)

- **Surgical, lens-scoped batches.** One batch = one concern. A migrate agent applies only
  its batch's findings; it does not freelance. Files are disjoint → parallel, no worktrees.
- **Conservative skips are wins.** Agents SHOULD skip findings that would change behavior
  (e.g. a `TransitionPanel` rewrite that deletes a `key=` remount; count-up on a `formatCount`
  K/M value that would re-expand the compact format). Record skips — never silently drop.
- **Reduced-motion is non-negotiable.** Every animation gated by `useReducedMotion()`.
- **Typecheck is the achievable gate.** Visual confirmation is the operator's on the dev server.
- **Intentional visual deltas exist.** Migrating `.card`→`@kit/ui` `Card` changes padding/shadow
  to the kit's canonical values — that's the point, not a regression. Say so up front.

## Precedent

First run: `altyaa-turbo` `apps/web/.../<home-route>/_components/coach/` (facebook-page subtree, 8
components). Result: 67 findings → batched A/B/C migration, 8 files +505/−227, 7 motion
components installed, typecheck clean at every gate. See this pack's CHANGELOG.
