---
name: Init
description: Create or extract a new DESIGN.md file to serve as the single source of truth for the project's design system.
status: STABLE
bestPath:
  - title: "Determine Mode"
    description: "Choose creation, extraction, or brand-brief mode based on what the user provides."
  - title: "Gather Context"
    description: "Collect colors, typography, framework, spacing, and motion inputs for the chosen mode."
  - title: "Generate DESIGN.md"
    description: "Produce the 9-section schema with the machine-readable tokens and constraints frontmatter."
  - title: "Save & Confirm"
    description: "Write DESIGN.md to the project root and summarize what was defined and what was flagged."
---

# Init Workflow

Create or extract a new DESIGN.md file to serve as the single source of truth for the project's design system.

DESIGN.md follows the **9-section schema (v2.0)** — the VoltAgent / Anthropic "Set up your design system" form shape, converged with the DesignBundle producer (`Packs/design-bundle/src/Workflows/RunPipeline.md` §D10). All three entry modes (creation / extraction / brand-brief) terminate in this same structured schema, so the downstream consumers (Generate / Audit / Update) get ONE contract regardless of how the file was authored.

## DOS Integration

**DESIGN.md lives at the project root** (correct — it's a project-level spec). However, when this workflow runs within the DOS Algorithm, register the work:

**If the Algorithm is already running:** The PRD at `MEMORY/WORK/{slug}/PRD.md` should include ISC criteria for design system initialization (e.g., colors defined, typography scale, spacing scale, component blueprints, state matrix, motion tokens). Check off criteria as each section of DESIGN.md is completed.

**If invoked standalone:** No PRD needed — DESIGN.md at the project root is the deliverable.

## When to Use

- User wants to create a new design system from scratch
- User wants to extract a design system from an existing URL or codebase
- User has brand-tokens.json (canonical W3C DTCG 2025.10) or brand-token-spec.md from the brand skill and wants to generate DESIGN.md from it
- No DESIGN.md exists in the project yet

## Two-Producer Precedence (which DESIGN.md wins)

Two skills can emit a `DESIGN.md`. They write to **different paths** and have a defined precedence — they do not race:

| Producer | Path | Role | Authority |
|---|---|---|---|
| **Init** (this workflow) | `<project-root>/DESIGN.md` | The **live source of truth** read by Generate / Audit / Update in-repo | **Authoritative** for all in-repo tooling |
| **DesignBundle** RunPipeline §D10 | `<repo>/claude-design-system-bundle/DESIGN.md` | A point-in-time **wire-format export** for the Claude Design onboarding form | Snapshot — regenerated FROM the project-root file, never the reverse |

**Rule:** when both exist, the **project-root file wins** for every generation/audit/update operation. The bundle copy is a handoff artifact for external ingestion (the onboarding form expects a single file; the folder is supplementary context). If the two diverge, reconcile by re-exporting the bundle from the project-root SoT — do not hand-edit the bundle copy into authority.

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Determine Mode

Three modes based on user intent. **All three converge on the same v2.0 schema** in Step 3 — the mode only changes where the values come from, never the output shape.

**Creation mode** (user describes what they want):
- Generate tokens from user-provided preferences (colors, fonts, style)
- Ask for: primary color, font preferences, dark/light mode (or `dual`), spacing philosophy, motion personality

**Extraction mode** (user provides a URL or existing code):
- Fetch the URL using WebFetch or scan the codebase
- Parse and extract: color palette, typography, spacing, component patterns, observed motion/easing, observed radius/shadow scales
- Convert extracted values to semantic tokens
- **Flag, don't invent:** for any v2.0 section the source does not reveal (e.g. no dark theme present, no motion observable), emit the section with a `> FLAGGED:` callout rather than fabricating values

**Brand brief mode** (brand tokens exist in project):
- **Prefer the canonical `brand-tokens.json`** (W3C DTCG 2025.10 — Brand/Implementation/TokenSpec's source-of-truth artifact) when present at the project root; parse its three-layer DTCG groups (`$type`/`$value`/`$description`) directly. Fall back to `brand-token-spec.md` (the human-readable companion) only when the JSON is absent.
- Pre-populate all DESIGN.md sections from the brand spec
- Colors, typography, spacing, **motion**, and component blueprints come from brand decisions
- **Motion now has a slot.** Earlier the brief validated a motion block but the template dropped it; in v2.0 the brief's motion decisions serialize into **Section 7 (Motion)** and `tokens.motion` — nothing is dropped.
- Brand rationale from the spec informs semantic naming choices
- Only ask the user for framework preference (Tailwind, CSS Modules, etc.) since brand spec doesn't specify implementation tech

### Step 2: Gather Context

For creation mode, collect from the user:
- **Primary color** and any secondary/accent colors (or a mood/personality)
- **Typography** -- heading and body font preferences
- **Mode** -- dark-mode-first, light-mode-first, or `dual` (both themes serialized)
- **Framework** -- Tailwind, CSS Modules, vanilla CSS, styled-components
- **Spacing system** -- 4px grid, 8px grid, or custom
- **Motion personality** -- snappy / standard / expressive (maps to the duration band)

For extraction mode:
- **URL** to extract from, or directory to scan
- Any specific elements to focus on
- Note which v2.0 sections were observable vs. flagged

For brand brief mode:
- **brand-tokens.json** (canonical DTCG) -- read and parse all token groups; OR **brand-token-spec.md** -- the markdown companion, parsed only when the JSON is absent
- **Framework** -- ask user which CSS/component framework to target
- Validate all required sections are present (colors, typography, spacing, motion, components)

### Step 3: Generate DESIGN.md

Produce the DESIGN.md file following this structure. It carries **two machine-readable frontmatter blocks** (`tokens:` + `constraints:`) plus the **9 markdown sections**.

**Schema is additive / back-compatible.** Sections 1–4 are the v1 core (always present; a v1-era reader uses them and safely ignores 5–9). Sections 5–9 are the v2.0 additions, optional-first: if a mode cannot supply them, emit the header with a `> FLAGGED:` line rather than omitting it (keeps the contract stable for Generate).

```markdown
---
schema_version: 2.0          # DESIGN.md schema. 1.x = 4-section; 2.0 = 9-section + token/constraints blocks
mode_origin: creation        # creation | extraction | brand-brief — the entry mode that produced this file
color_mode: dual             # light | dark | dual

# ── Machine-readable token block (generalizes the _design_overrides: frontmatter) ──
# DTCG dialect (Design Tokens Community Group, 2025.10), mirroring Brand's
# brand-tokens.json — do NOT invent a dialect. Three-layer architecture:
#   option (raw OKLCH ramps) -> decision (semantic, light+dark dual) -> component (applied in §4).
# SELF-EMITTED by Init from whatever the mode parsed. When Brand later ships
# brand-tokens.json, set tokens.source to that path and this block becomes a cache
# that an emitter regenerates — so the chain never builds against a moving target.
tokens:
  source: self-emitted        # self-emitted | brand-tokens.json — when brand-tokens.json was read above, set this to that path (the canonical source) and this block becomes a regenerable cache
  $description: "option (raw) -> decision (semantic light/dark) -> component (applied)"
  palette:                    # LAYER 1 — option (raw OKLCH, never referenced directly by components)
    brand-400:   { $type: color, $value: "oklch(0.62 0.17 250)" }
    brand-500:   { $type: color, $value: "oklch(0.55 0.20 250)" }
    brand-600:   { $type: color, $value: "oklch(0.48 0.20 250)" }
    neutral-050: { $type: color, $value: "oklch(0.99 0.00 250)" }
    neutral-600: { $type: color, $value: "oklch(0.60 0.02 250)" }
    neutral-900: { $type: color, $value: "oklch(0.15 0.01 250)" }
  semantic:                   # LAYER 2 — decision (light + dark DUAL-value; this is what §8 serializes)
    brand-primary: { $type: color, $value: { light: "{palette.brand-500}", dark: "{palette.brand-400}" } }
    surface:       { $type: color, $value: { light: "{palette.neutral-050}", dark: "{palette.neutral-900}" } }
    text:          { $type: color, $value: { light: "{palette.neutral-900}", dark: "oklch(0.93 0.01 250)" } }
    text-muted:    { $type: color, $value: { light: "{palette.neutral-600}", dark: "oklch(0.60 0.02 250)" } }
    border:        { $type: color, $value: { light: "oklch(0.88 0.01 250)", dark: "oklch(0.30 0.01 250)" } }
    focus-ring:    { $type: color, $value: { light: "{palette.brand-500}", dark: "{palette.brand-400}" } }
    status-success:{ $type: color, $value: { light: "oklch(0.62 0.18 160)", dark: "oklch(0.65 0.18 160)" } }
    status-error:  { $type: color, $value: { light: "oklch(0.52 0.20 25)",  dark: "oklch(0.58 0.20 25)" } }
  radius:                     # shape scale (§5) — components reference these, never raw rem
    sm:   { $type: dimension, $value: "0.25rem" }
    md:   { $type: dimension, $value: "0.5rem" }
    lg:   { $type: dimension, $value: "0.75rem" }
    full: { $type: dimension, $value: "9999px" }
  shadow:                     # elevation scale (§5)
    e1: { $type: shadow, $value: "0 1px 2px oklch(0 0 0 / 0.06)" }
    e2: { $type: shadow, $value: "0 2px 8px oklch(0 0 0 / 0.10)" }
    e3: { $type: shadow, $value: "0 8px 24px oklch(0 0 0 / 0.14)" }
  motion:                     # motion scale (§7) — UI feedback band is 150–400ms (see constraints)
    duration-fast:    { $type: duration,    $value: "150ms" }
    duration-base:    { $type: duration,    $value: "250ms" }
    duration-slow:    { $type: duration,    $value: "400ms" }
    easing-standard:  { $type: cubicBezier, $value: [0.2, 0, 0, 1] }
    easing-decelerate:{ $type: cubicBezier, $value: [0, 0, 0, 1] }
    reduced-motion:   { $type: duration,    $value: "0ms" }  # prefers-reduced-motion resolves all durations here
  breakpoint:                 # responsive scale (§6), mobile-first min-widths
    sm: { $type: dimension, $value: "640px" }
    md: { $type: dimension, $value: "768px" }
    lg: { $type: dimension, $value: "1024px" }
    xl: { $type: dimension, $value: "1280px" }
  typography:                 # richer type tokens (§2) — beyond size/weight/line-height
    measure-body:    { $type: dimension, $value: "66ch" }      # target line length (45–75ch)
    tracking-tight:  { $type: dimension, $value: "-0.025em" }  # heading letter-spacing
    tracking-normal: { $type: dimension, $value: "0em" }
    opsz-display:    { $type: number,    $value: 48 }          # optical-size axis for variable fonts
    font-loading:    { $type: string,    $value: "swap" }      # font-display strategy

# ── Numeric constraints (un-stranded from SKILL.md's 13-row thresholds table) ──
# Machine-readable pass/fail gates. Each carries a value + citation. UI generation
# audits emitted artifacts against these at output time; Sentinel audits at scan time.
# These are HARD defaults — intentional deviations go in _design_overrides with a cited rationale.
constraints:
  contrast_normal_text:    { min: "4.5:1", cite: "WCAG 2.2 §1.4.3" }
  contrast_large_text:     { min: "3.0:1", cite: "WCAG 2.2 §1.4.3" }
  contrast_non_text:       { min: "3.0:1", cite: "WCAG 2.2 §1.4.11" }   # focus rings, borders, icon glyphs
  cognitive_chunking:      { max: 9, note: "7±2 items per group", cite: "Miller 1956" }
  whitespace_ratio:        { min: 0.40, applies: "hero/landing", cite: "Bringhurst / Tufte" }
  reading_line_length:     { range: "45-75ch", optimal: "66ch", cite: "Bringhurst §2.1.2" }
  tap_target_ios:          { min: "44x44pt", cite: "Apple HIG" }
  tap_target_android:      { min: "48x48dp", cite: "Material Design" }
  palette_max_hues:        { max: 5, cite: "Tufte, Envisioning Information" }
  font_family_max:         { max: 2, cite: "Bringhurst / Reynolds" }
  line_height_body:        { range: "1.4-1.6", cite: "Bringhurst §2.1.4" }
  motion_duration_ui:      { range: "150-400ms", cite: "Material Motion / Apple HIG" }
  first_contentful_paint:  { max: "1.8s", cite: "Core Web Vitals" }
  cumulative_layout_shift: { max: 0.1, cite: "Core Web Vitals" }

# ── Operator escape hatch (PRESERVED from v1) ──
# Intentional, per-component deviations from constraints/tokens. Each MUST cite a rationale.
_design_overrides: []
---

# DESIGN.md

<!-- DESIGN.md schema v2.0 — 9-section VoltAgent form.
     Sections 1–4 are the v1 core (always present, back-compatible).
     Sections 5–9 are additive (optional-first): a v1 consumer reads 1–4 and
     ignores 5–9 safely; a v2 consumer reads all 9. Token VALUES live in the
     frontmatter `tokens:` block above — the tables below are the human-readable
     projection of that single source. Do not let the two drift. -->

## 1. Colors

### Palette (decision layer — light + dark dual values)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `brand-primary` | oklch(0.55 0.20 250) | oklch(0.62 0.17 250) | Primary actions, key accents |
| `surface` | oklch(0.99 0.00 250) | oklch(0.15 0.01 250) | Background surfaces |
| `text` | oklch(0.15 0.01 250) | oklch(0.93 0.01 250) | Primary text |
| `text-muted` | oklch(0.60 0.02 250) | oklch(0.60 0.02 250) | Secondary text |
| `border` | oklch(0.88 0.01 250) | oklch(0.30 0.01 250) | Borders and dividers |
| `focus-ring` | oklch(0.55 0.20 250) | oklch(0.62 0.17 250) | Keyboard focus outline (≥3:1 non-text) |
| `status-success` | oklch(0.62 0.18 160) | oklch(0.65 0.18 160) | Success states |
| `status-error` | oklch(0.52 0.20 25) | oklch(0.58 0.20 25) | Error states |

### Rules
- NEVER use raw hex/rgb values in components -- always reference tokens
- Dark mode adjusts lightness and reduces chroma, it does NOT invert (see §8)
- ≤ 5 distinct hues in the primary palette (`constraints.palette_max_hues`)
- All text/bg combinations meet WCAG 2.2 AA in BOTH themes (4.5:1 body, 3:1 large, 3:1 non-text)

## 2. Typography

### Scale
| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `heading-hero` | 4.5rem | 700 | 1.1 | Hero headlines |
| `heading-section` | 3rem | 700 | 1.1 | Section titles |
| `heading-sub` | 1.875rem | 600 | 1.25 | Subsections |
| `heading-card` | 1.25rem | 600 | 1.25 | Card titles |
| `body-default` | 1rem | 400 | 1.5 | Paragraph text |
| `body-small` | 0.875rem | 400 | 1.5 | Small body |
| `caption` | 0.75rem | 500 | 1.5 | Captions, labels |
| `code` | 0.875rem | 400 | 1.625 | Code blocks |

### Tokens (beyond size/weight/line-height — from `tokens.typography`)
| Token | Value | Usage |
|-------|-------|-------|
| `measure-body` | 66ch | Body paragraph max line length (45–75ch band) |
| `tracking-tight` | -0.025em | Heading letter-spacing |
| `tracking-normal` | 0em | Body letter-spacing |
| `opsz-display` | 48 | Optical-size axis for variable display fonts |
| `font-loading` | swap | `font-display` strategy (avoids invisible-text flash) |

### Fonts
- Headings: [font name] via `--font-family-heading`
- Body: [font name] via `--font-family-body`
- Code: [font name] via `--font-family-mono`

### Rules
- ≤ 2 type families per surface (`constraints.font_family_max`)
- Headings use `tracking-tight`; body uses `tracking-normal`
- Body line length stays inside `measure-body`; body leading 1.4–1.6
- Code uses the mono font -- no exceptions

## 3. Spacing

### Scale
| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 0.25rem | Tight gaps |
| `space-2` | 0.5rem | Small gaps |
| `space-3` | 0.75rem | Medium-small |
| `space-4` | 1rem | Default gap |
| `space-6` | 1.5rem | Medium |
| `space-8` | 2rem | Large |
| `space-12` | 3rem | Section padding |
| `space-16` | 4rem | Large section padding |
| `space-20` | 5rem | Section vertical padding |

### Rules
- Use the spacing scale -- no arbitrary values
- Section padding: `space-20` vertical, responsive
- Card padding: `space-6` default (`space-4` in `compact` density)

## 4. Component Stylings

Each component documents four things: **Anatomy** (slots) · **Variants** (intent × size/density) · **State matrix** · **A11y contract**.

The **state matrix** is the full interactive set — `default · hover · focus-visible · active · disabled · loading` — NOT hover-only. Focus is always rendered via the `focus-ring` token (never removed). Form primitives add an `invalid` state.

**Density / size variants** apply across components: size `sm | md | lg`; density `comfortable` (default) | `compact` (drops vertical padding one step on the spacing scale).

### Button (canonical / slot-first example)
- **Anatomy:** `[icon-leading?] [label] [icon-trailing?]` inside one interactive root
- **Variants:** intent `primary | secondary | ghost | destructive`; size `sm | md | lg`; density `comfortable | compact`

  | State | Visual |
  |-------|--------|
  | default | bg `brand-primary`, on-primary text, radius `radius.md`, padding `space-3`/`space-6` |
  | hover | bg → `brand-600` (≈ darken 8%) |
  | focus-visible | 2px `focus-ring` outline, 2px offset — outline is NEVER removed |
  | active | bg darken ~12%, scale 0.99 |
  | disabled | opacity 0.45, `cursor: not-allowed`, no hover/active |
  | loading | spinner replaces leading icon, label dimmed, `aria-busy=true`, pointer-events none |
- **A11y:** real `<button>`; `aria-disabled` mirrors `disabled`; focus ring meets non-text contrast ≥ 3:1; tap target ≥ 44×44pt; loading announced via `aria-live=polite`.

### Card
- **Anatomy:** `[media?] [header] [body] [footer?]`
- **Variants:** elevation `flat | raised` (raised = `shadow.e2`); density `comfortable | compact`
- **States:** default; hover (raise to `shadow.e3`, only when the card is interactive); focus-visible (`focus-ring` on the interactive wrapper, not the chrome)
- **A11y:** if the whole card is a link, expose exactly one focusable element; never nest interactive controls inside a card-link.

### Input (form primitive — accessibility-decisive)
- **Anatomy:** `[label] [control [icon?]] [hint?] [error?]`
- **Variants:** size `sm | md | lg`
- **States:** default; hover (border strengthens); focus-visible (`focus-ring` + border `brand-primary`); active; disabled (opacity 0.45); loading (trailing spinner, `aria-busy`); **invalid** (border `status-error`, `aria-invalid=true`, error text linked via `aria-describedby`)
- **A11y:** every input has a programmatic `<label for>`; errors referenced by `aria-describedby`; error is never color-only (icon + text); placeholder is NOT a label.

### Select
- **Anatomy:** `[label] [trigger [value] [chevron]] [listbox [option*]]`
- **States:** default · hover · focus-visible · active(open) · disabled · loading
- **A11y:** native `<select>` or `role=combobox` with `aria-expanded`; full keyboard (↑ ↓ Home End type-ahead Esc); focus returns to the trigger on close.

### Dialog
- **Anatomy:** `[overlay] [container [header [title] [close]] [body] [footer]]`
- **States:** closed · opening · open · closing; focus-visible on every control
- **A11y:** `role=dialog` `aria-modal=true`, labelled by the title; focus trap while open; focus returns to the invoker on close; Esc closes; `prefers-reduced-motion` collapses the open/close transition (see §7).

### Toast
- **Anatomy:** `[icon] [message] [action?] [dismiss?]`
- **Variants:** intent `info | success | warning | error`; auto-dismiss duration token
- **States:** enter · visible · exit; pause-on-hover / pause-on-focus
- **A11y:** `role=status` (polite) or `role=alert` (assertive, errors only); meaning carried by text, never icon/color alone; dismiss reachable by keyboard; respects reduced-motion (fade, no slide).

## 5. Depth & Elevation

### Radius scale (`tokens.radius`)
| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 0.25rem | Inputs, small chips |
| `radius-md` | 0.5rem | Buttons, controls |
| `radius-lg` | 0.75rem | Cards, dialogs |
| `radius-full` | 9999px | Pills, avatars |

### Shadow / elevation scale (`tokens.shadow`)
| Token | Value | Usage |
|-------|-------|-------|
| `shadow-e1` | 0 1px 2px oklch(0 0 0 / 0.06) | Resting surfaces, subtle separation |
| `shadow-e2` | 0 2px 8px oklch(0 0 0 / 0.10) | Raised cards, dropdowns |
| `shadow-e3` | 0 8px 24px oklch(0 0 0 / 0.14) | Dialogs, popovers, hover-raise |

### Rules
- Radius comes from the scale only -- no arbitrary `border-radius`
- Elevation conveys hierarchy, not decoration; one step per layer
- (These tokens exist so the Audit workflow's radius/shadow lint has a defined target to check.)

## 6. Responsive Behavior

### Breakpoint scale (`tokens.breakpoint`, mobile-first min-widths)
| Token | Min width | Target |
|-------|-----------|--------|
| `bp-sm` | 640px | Large phones / small tablets |
| `bp-md` | 768px | Tablets |
| `bp-lg` | 1024px | Laptops |
| `bp-xl` | 1280px | Desktops |

### Rules
- Mobile-first: base styles target the smallest viewport; breakpoints layer up
- Touch targets ≥ 44×44pt (iOS) / 48×48dp (Android) on touch surfaces (`constraints.tap_target_*`)
- Container max-width caps body line length near `measure-body`
- No layout shift above the fold (`constraints.cumulative_layout_shift` ≤ 0.1)

## 7. Motion

### Tokens (`tokens.motion`)
| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | 150ms | Hover, focus, small state changes |
| `duration-base` | 250ms | Toggles, expands, toasts |
| `duration-slow` | 400ms | Dialog/overlay enter-exit |
| `easing-standard` | cubic-bezier(0.2, 0, 0, 1) | Most transitions |
| `easing-decelerate` | cubic-bezier(0, 0, 0, 1) | Elements entering the screen |
| `reduced-motion` | 0ms | Target all durations resolve to under `prefers-reduced-motion` |

### Rules
- UI feedback stays in the 150–400ms band (`constraints.motion_duration_ui`) -- faster feels broken, slower feels sluggish
- **`prefers-reduced-motion`: respect it.** When set, all motion resolves to `reduced-motion` (0ms) or opacity-only fades; no slide, parallax, or scale.
- Motion communicates state change or spatial relationship -- never decoration for its own sake.

## 8. Light + Dark

### The dual-value mapping rule
Every semantic token in §1 / `tokens.semantic` resolves to a `{ light, dark }` pair. The **option layer (raw OKLCH ramps) is shared**; only the **decision layer** swaps between themes.

- Dark mode **adjusts lightness and reduces chroma** -- it does NOT invert the palette.
- `color_mode` in frontmatter declares which themes are serialized: `light`, `dark`, or `dual` (both).
- When `dual`, Generate emits a theme toggle that swaps the decision layer only; the option layer and all component code stay unchanged.
- Contrast constraints (§1) must hold independently in BOTH themes -- verify each pairing twice.

## 9. Do's & Don'ts

**Do**
- Reference tokens for every color/space/radius/shadow/duration value
- Use OKLCH for all color values
- Render the `focus-ring` on every interactive element
- Carry meaning in text + shape, not color alone
- Respect `prefers-reduced-motion`
- Keep ≤ 5 hues and ≤ 2 type families

**Don't**
- Hardcode hex / rgb / arbitrary px / arbitrary ms
- Invert the palette for dark mode
- Remove focus outlines
- Use color as the sole status indicator
- Invent values the source never specified -- flag them instead (see below)
```

**Flag, don't invent.** Populate every value the source (user input, extraction, or brand spec) actually provides. For an additive section the source is silent on, emit the header with a `> FLAGGED: not specified by <source> — operator to confirm` callout and sensible scale defaults, rather than fabricating a design decision. This preserves the flag-not-invent posture: the file is honest about what was decided vs. defaulted.

### Step 4: Save File

Write the completed DESIGN.md to the project root.

### Step 5: Confirm

Tell the user:
- Where DESIGN.md was saved
- Schema version (2.0) and `color_mode`
- Summary of what was defined (X colors, Y type sizes, Z spacing values, N component blueprints, motion tokens, radius/shadow scales) and which sections were `FLAGGED`
- How to use it: "When generating UI, I will read this file first and use only the defined tokens, audited against the `constraints:` block"

## Validation

- [ ] DESIGN.md created at project root
- [ ] Frontmatter carries `schema_version: 2.0`, `tokens:` block, and `constraints:` block
- [ ] `tokens:` uses the DTCG `$type`/`$value` dialect, three-layer (palette → semantic → applied), with light+dark dual values on semantic colors
- [ ] `constraints:` reflects the SKILL.md thresholds (contrast, tap-target, line-length, chunking, motion, FCP/CLS) with citations
- [ ] `_design_overrides:` escape hatch is present (even if empty)
- [ ] All 9 sections present (Colors, Typography, Spacing, Component Stylings, Depth & Elevation, Responsive Behavior, Motion, Light + Dark, Do's & Don'ts)
- [ ] Components include the full state matrix (default/hover/focus-visible/active/disabled/loading) and a `focus-ring` token
- [ ] Form primitives present with a11y contracts (Input, Select, Dialog, Toast) alongside Card + Button
- [ ] Density/size variants documented (sm/md/lg, comfortable/compact)
- [ ] Motion section has motion tokens + a `prefers-reduced-motion` token
- [ ] Depth & Elevation has radius + shadow scales; Responsive has a breakpoint scale + touch targets
- [ ] Colors section has semantic token names with light+dark values and usage rules
- [ ] Typography section has full scale plus tracking/measure/opsz/font-loading tokens
- [ ] Rules are included (not just values -- usage guidelines too)
- [ ] All color values use OKLCH format
