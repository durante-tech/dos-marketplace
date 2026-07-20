---
name: Motion Language
description: Animation tokens, easing curves, transition patterns, and scroll behavior
status: BETA
---

# Motion Language

Define the brand's motion identity — how things move, transition, and respond to interaction. Produces motion tokens that integrate with the three-layer token architecture.

## When to Use

- Defining animation behavior for a brand/product
- Creating motion tokens (easing, duration, scroll behavior)
- Establishing micro-interaction patterns
- Ensuring consistent animation across product and marketing

## Steps

### Step 1: Derive Motion Personality

From brand personality:
- **Precise/Technical** → linear easing, short durations, minimal overshoot
- **Playful/Creative** → spring physics, bouncy easing, generous overshoot
- **Premium/Luxury** → slow reveals, subtle easing, choreographed sequences
- **Fast/Efficient** → quick transitions, no unnecessary animation

### Step 2: Define Duration Scale

| Token | Duration | Use |
|-------|----------|-----|
| `--duration-instant` | 100ms | Micro-feedback (hover, focus) |
| `--duration-fast` | 200ms | State changes (toggle, tab switch) |
| `--duration-normal` | 300ms | Standard transitions (modal, drawer) |
| `--duration-slow` | 500ms | Emphasis transitions (page, hero) |
| `--duration-dramatic` | 800ms+ | Cinematic reveals (landing page) |

### Step 3: Define Easing Curves

| Token | Curve | Use |
|-------|-------|-----|
| `--ease-default` | cubic-bezier(0.4, 0, 0.2, 1) | General purpose |
| `--ease-in` | cubic-bezier(0.4, 0, 1, 1) | Exit animations |
| `--ease-out` | cubic-bezier(0, 0, 0.2, 1) | Enter animations |
| `--ease-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | Playful interactions |

### Step 4: Define Interaction Patterns

- **Hover**: Scale, color shift, shadow elevation
- **Click/Tap**: Brief scale-down then release
- **Page transition**: Fade, slide, or morph (pick one, be consistent)
- **Loading**: Skeleton, shimmer, or spinner (pick one)
- **Scroll-driven**: Parallax ratios, reveal triggers, sticky behavior

### Step 5: Produce Motion Tokens

Output as three-layer tokens:
- Option: `--duration-300: 300ms; --ease-out: cubic-bezier(0, 0, 0.2, 1);`
- Decision: `--motion-entrance: var(--duration-300); --motion-ease-default: var(--ease-out);`
- Component: `--modal-reveal-duration: var(--motion-entrance); --modal-reveal-ease: var(--motion-ease-default);`
