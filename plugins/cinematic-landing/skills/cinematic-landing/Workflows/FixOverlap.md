---
name: Fix Overlap
description: Debug and fix visual bleed-through between GSAP-pinned sections and adjacent content via z-index layering.
status: STABLE
bestPath:
  - title: "Diagnose"
    description: "Screenshot the overlap, identify the pinned section, and check z-index and backgrounds."
  - title: "Apply Fix"
    description: "Layer z-index across the pinned and subsequent sections per the standard pattern."
  - title: "Verify"
    description: "Scroll-test that bleed-through is gone and the pinned section still functions."
---

# Fix Section Overlap

Debug and fix visual bleed-through between GSAP-pinned sections and adjacent content.

## When to Use

- User reports "sections overlapping", "content bleeding through"
- After delivering Tier 2 (pinned sections) or Tier 3 (cinematic transitions)
- Screenshot shows pinned content visible behind subsequent sections

## Workflow

### Step 1: Diagnose

1. **Screenshot** the overlapping area (if possible)
2. **Identify the pinned section** -- use Grep to search for GSAP `ScrollTrigger.create({ pin: true })` or similar patterns
3. **Check z-index layers** -- pinned section vs subsequent sections
4. **Check backgrounds** -- subsequent sections need solid backgrounds (not transparent)

### Step 2: Apply Fix

The pattern is always the same:

```
PINNED SECTION:     z-0 (or relative z-0)
SECTIONS AFTER IT:  relative z-10 bg-background
FIXED UI:           z-50
```

Specifically:
1. Add `z-0` to the section containing the GSAP pin
2. Add `relative z-10 bg-background` to ALL sections that follow the pinned section
3. If using `CinematicSection` wrappers, add via `className` prop

Use the **Edit tool** to apply these changes to the relevant component files.

### Step 3: Verify

1. Scroll through the page -- no visual bleed-through
2. Pinned section still works correctly (pins and unpins)
3. Subsequent sections fully cover the pinned content when scrolling past

## Common Patterns

### CinematicSection with z-index
```tsx
<section id="lp-algorithm" className="relative z-0 ...">
  {/* GSAP-pinned content */}
</section>

<CinematicSection className="relative z-10 bg-background">
  {/* This section fully covers the pinned section */}
</CinematicSection>
```

### Multiple wrappers
If a section has both `CinematicSection` and `ScrollReveal`, the z-index goes on the outer wrapper:
```tsx
<CinematicSection className="relative z-10 bg-background">
  <ScrollReveal>
    <LandingSection>...</LandingSection>
  </ScrollReveal>
</CinematicSection>
```

## Validation

- [ ] No visual overlap between pinned and subsequent sections
- [ ] Pinned section still functions (pins/unpins on scroll)
- [ ] All section backgrounds are solid (no transparency issues)
- [ ] Semantic tokens used (bg-background, not hardcoded colors)