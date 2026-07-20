---
name: RunPipeline
description: Execute the full DesignBundle pipeline — Phase A Fork Configuration → Phase B Context Mining → Phase C Decision Capture → Phase D Bundle Assembly → Phase E Apply Locked Decisions + Commit.
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Intent-to-Flag table here maps to phase-skip decisions (skip A, skip B, etc.) rather than to CLI flags on a single tool — the workflow shells out to many CLIs (gh, git, pnpm, bun) and the operator intent is structural (which phases to run), not flag-level."
bestPath:
  - title: "Phase A — Fork Configuration"
    description: "Swap remotes, push develop, set the GitHub default branch, and claim a parallel-fork slot (skipped if already configured)."
  - title: "Phase B — Context Mining"
    description: "Fan out six parallel Explore agents plus INTEL-FIRST across DOS root, sibling SaaS, fork, and MEMORY sources."
  - title: "Phase C — Decision Capture"
    description: "Lock scope, positioning, tagline, languages, and deploy target via a single AskUserQuestion call."
  - title: "Phase D — Bundle Assembly"
    description: "Write the canonical DESIGN.md, multi-format tokens, and context/intelligence/copy/press/meta/review files."
  - title: "Phase E — Apply Locked Decisions + Commit"
    description: "Stamp locked decisions into bundle files, commit, and verify the always-fire file-count floor."
---

# RunPipeline Workflow

## When to Use

- Operator says "design bundle for X", "fork and bundle", "kit to bundle", or "set up claude design system"
- A freshly-cloned dos-prisma-saas-kit fork needs to reach Claude-Design-System-form-ready AND launch-ready-brand-operating-system state in one pipeline
- NOT for standalone brand research (use Brand) or design-system token extraction alone (use DesignSystem) — RunPipeline orchestrates both into one bundle

**Purpose:** Take a freshly-cloned dos-prisma-saas-kit fork to Claude-Design-System-form-ready in one operator-driven pipeline. End state: a committed `claude-design-system-bundle/` folder at the repo root that drops into the Claude Design System form with copy-pasteable values for every field.

<!-- partial: _workflow-voice.md skill_name=DesignBundle workflow_name=RunPipeline action_phrase="run the design-bundle pipeline" -->


**Purpose:** Take a freshly-cloned dos-prisma-saas-kit fork to Claude-Design-System-form-ready in one operator-driven pipeline. End state: a committed `claude-design-system-bundle/` folder at the repo root that drops into the Claude Design System form with copy-pasteable values for every field.

<!-- partial: _workflow-voice.md skill_name=DesignBundle workflow_name=RunPipeline action_phrase="run the design-bundle pipeline" -->

## Intent-to-Flag Mapping

This workflow shells out to multiple CLIs (`gh`, `git`, `pnpm`, `bun ~/Durante/Tools/intel-context.ts`). The mapping below translates natural operator phrasing into the conditional execution paths taken in each phase. Most CLI invocations here are FIXED commands, not flag-tunable — the dial is "execute or skip a phase", not "pick a flag".

### Phase selection (operator may pre-state intent)

| User Says | Behavior | Effect |
|-----------|----------|--------|
| "design bundle for X" (Phase A not done) | Run all 5 phases | Full pipeline |
| "kit to bundle" (Phase A done) | Skip Phase A | Detect state via `git remote -v` + `.fork-slot`; jump to Phase B |
| "just bundle, decisions already made" | Skip Phase B + Phase C | Use existing context (warning: stale-context risk); operator must re-supply locks |
| "re-run with new deploy target" | Skip A+B, re-ask only the changed Phase C question | Targeted re-lock |
| "dry run" / "plan only" | Stop before Phase D | Report what would be written without writing |

### Sibling SaaS path resolution

| User Says | Resolution |
|-----------|------------|
| Operator provides explicit path | Use as-is |
| Operator says "use durante-studio" / "use the studio repo" | Resolve to `~/Developer/durante-studio/` (or `$DOS_DEV_DIR/durante-studio/` if env set) |
| Operator says "no sibling" / "skip brand-direction" | Phase D4 writes `brand-direction/README.md` placeholder only; no theme.css copied |
| Default (no instruction) | Auto-detect: scan `~/Developer/*/brand/BRAND-DEFINITION.md` and prompt operator if >1 match |

### Phase A — destination repo creation

| User Says | Flag / Path | Effect |
|-----------|-------------|--------|
| "private repo" (default) | `gh repo create <org/repo> --private` | Recommended for institutional sites pre-launch |
| "public repo" | `gh repo create <org/repo> --public` | Use only when operator explicitly asks |
| "repo already exists" | Skip A1 creation; verify via `gh repo view` | Operator-managed creation |

### Phase B — context mining depth

| User Says | Effect on agent prompts |
|-----------|-------------------------|
| (default) | All 6 agents fire with "very thorough" search breadth |
| "quick scan" / "shallow" | All 6 agents fire with "medium" breadth; cap responses at 300 words |
| "extra thorough" | All 6 agents fire with "very thorough" + an additional Brand-skill agent for external research |

### Phase E — commit format

| User Says | Effect |
|-----------|--------|
| (default) | `docs(brand): Claude design system bundle — <company> institutional context` |
| "no Co-Authored-By" | Strip the trailer (rare; operator preference) |
| "amend" / "fix the last commit" | Use `git commit --amend` instead of new commit |

## Inputs (operator-supplied or auto-detected)

| Input | Source | Required |
|---|---|---|
| `<company name>` | Operator prompt or `git remote get-url origin` org | Yes |
| `<repo path>` | `pwd` (must be inside the fork's working tree) | Yes |
| `<sibling SaaS path>` | Operator prompt OR auto-discover sibling dirs under `~/Developer/` | Optional |
| `<github destination>` | Operator prompt (`org/repo`) — only consulted in Phase A | Conditional |

**Trigger Gate:** the workflow MUST be invoked from inside the fork. Verify with `git rev-parse --show-toplevel` before any other action; fail closed if not a git repo.

## Phase A — Fork Configuration (skipped if already configured)

**Detect state** (always run first):

```bash
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
SLOT=$(cat .fork-slot 2>/dev/null || echo "")
echo "remote=$REMOTE slot=$SLOT"
```

Skip Phase A if:
- `$REMOTE` ends with `<github destination>.git` (already swapped) AND
- `$SLOT` is a non-empty integer in `[0..63]` (slot already claimed).

Otherwise execute steps A1–A7 sequentially:

### A1. Verify GitHub destination repo exists

```bash
gh repo view <org/repo> --json name,isEmpty,defaultBranchRef
```

If the repo does not exist, ask the operator (`AskUserQuestion`):
- Option 1: Create now via `gh repo create <org/repo> --private --confirm`
- Option 2: Operator will create it manually — pause and ask to confirm before proceeding.

Do NOT create the repo without explicit operator confirmation.

### A2. Swap remotes

```bash
git remote rename origin upstream
git remote add origin git@github.com:<org/repo>.git
git remote -v
```

Verify both remotes resolve correctly before proceeding.

### A3. Push develop with tracking

```bash
git push -u origin develop
```

### A4. Set GitHub default branch

```bash
gh repo edit <org/repo> --default-branch develop
gh repo view <org/repo> --json defaultBranchRef  # verify
```

### A5. Verify `root.env` + registry exist

```bash
ls -la ~/.dos/forks/root.env ~/.dos/forks/registry.json
```

Both files MUST exist before running `fork:init`. If `root.env` is missing, fail with operator-actionable error message (HKDF root-key not yet generated).

### A6. Claim parallel-fork slot

```bash
pnpm fork:init
```

Capture output. The tool prints slot integer + ports + compose project name. If exit code ≠ 0, fail closed.

### A7. Verify slot + ports

```bash
cat .fork-slot                              # integer 0–63
grep -E '^(NEXT_PUBLIC_SITE_URL|DATABASE_URL|MAILPIT|NODE_ENV)=' .env.local
```

Record slot integer + port assignments for Phase E commit body.

## Phase B — Context Mining (parallel, fan-out)

Fire all six `Explore` agents + INTEL-FIRST in a **single assistant message** (parallel doctrine).

### B0. INTEL-FIRST

```bash
bun ~/Durante/Tools/intel-context.ts "<company name>" --format json
```

Single call. Surface `summary_md` field verbatim as `🔍 INTEL PRE-FLIGHT:` block.

### B1–B6. Six parallel Explore agents

| # | Subject | Targets |
|---|---|---|
| **B1** DOS root | `~/Durante/Docs/`, `~/Durante/README.md`, `~/Durante/USER/` | Founder narrative, BRAND.md, GTM docs, voice/tone files |
| **B2** Sibling SaaS | `<sibling SaaS path>/brand/`, `apps/web/styles/theme.css`, marketing JSON | Brand definition, guidelines, design tokens, marketing copy |
| **B3** Current fork | `apps/web/styles/{theme,globals,custom}.css`, `packages/ui/package.json`, `apps/web/app/[locale]/{layout,(public)}.tsx` | Tailwind tokens, UI exports, layouts |
| **B4** Project MEMORY | `~/.claude/projects/[REDACTED:operator-project-slug]<project>/memory/` | Prior decisions, domain-mapping notes |
| **B5** Global MEMORY index | `~/.claude/MEMORY.md` + linked files | Life/business context |
| **B6** USER/ | `~/Durante/USER/` recursively | Principal/founder biographical context |

Each agent prompt MUST:
- Be read-only (no Write/Edit).
- Return exact file paths for the top 5 sources.
- Quote verbatim where load-bearing; never paraphrase brand claims.
- Cap response at 500–700 words.
- Note explicitly when files are stub/empty (no fabrication).

### B7. Synthesize

After all 6 agents return, synthesize findings into a working context map (in-memory). DO NOT write the bundle yet — Phase C decisions must lock first.

## Phase C — Decision Capture (AskUserQuestion)

Fire ONE `AskUserQuestion` call with 4–5 questions. Each option carries a `description` field with consequences/tradeoffs.

| Q | Header | Options |
|---|---|---|
| 1 | Site scope | marketing-only · marketing+light-auth · marketing+full-SaaS |
| 2 | Positioning framing | operating-systems firm · durable infrastructure · founder-led architecture firm · Linear-style compression |
| 3 | Tagline | use existing personal canon · new institutional · no-tagline-at-launch (Stripe/Linear) |
| 4 | Languages | EN only · EN+<other> with switcher · EN-now-other-later |
| 5 | Deploy target | Vercel · Cloudflare Pages · Railway · TBD-defer |

Skip Q2 if Phase A already completed (repo name implies a positioning option). Use the operator's answers as **locked decisions** for Phase E.

## Phase D — Bundle Assembly

Create the bundle at `<repo>/claude-design-system-bundle/`. Use the canonical structure (~56 always-fire files, plus active-fork extras — the exact count is verified by the E3 floor check, not a fixed literal).

### D1. Scaffold directory tree

```bash
mkdir -p claude-design-system-bundle/{context,code/components,code/layouts,brand-direction,assets}
```

### D2. Write the 9 markdown synthesis files (always-fire — fresh-fork AND active-fork)

| File | Content |
|---|---|
| `README.md` | Bundle map + use instructions + institutional vs product distinction |
| `FORM_FILL.md` | Copy-pasteable values for all 6 Claude DS form fields — Notes field MUST reference `context/07-creative-brief.md` |
| `context/01-company.md` | Institutional positioning (LOCKED per Phase C), mission, what we ship |
| `context/02-founder.md` | Founder narrative + proof points (verbatim quotes from BRAND.md / similar) |
| `context/03-products.md` | Portfolio with one-liners + status badges |
| `context/04-brand-voice.md` | Voice register, allow-list, ban-list, reference brands, banned-at-institutional |
| `context/05-design-language.md` | Current-state tokens + aspirational direction from sibling project |
| `context/06-tech-stack.md` | Framework, styling, routing, naming, deploy (LOCKED per Phase C) |
| `context/07-creative-brief.md` | **The ambition** — what Claude should INVENT, not just document |

**`07-creative-brief.md` is load-bearing.** Without it the bundle is descriptive ("here are the rules"); with it the bundle is generative ("here's what we want — push the boundary"). Required sections:

1. **Core directive** — name the single creative ambition in one sentence. For durante-tech: "Make the founder bet visible through interaction."
2. **Spine pattern** — the one visual mechanic that proves the company thesis. For durante-tech: stage-color (cyan → amber → violet → emerald) maps to the founder's arc, not just to internal product phases.
3. **Skill orchestration table** — concrete pipeline through the DOS skill ecosystem in execution order:
   - **Brand** → `/Brand audit` → token spec + mark direction
   - **DesignSystem** → `/DesignSystem init` → DESIGN.md + Tailwind hierarchy
   - **Media** → diagrams + illustrations + OG cards + Remotion video
   - **CinematicLanding** → tier-1 quick wins, tier-2 scroll storytelling, tier-3 WebGL/sound if ambitious
   - **frontend-design** → component-reveal choreography + micro-interaction catalog
   - **PitchDeck** → standalone HTML+D3 deck reusing Brand + Media assets
   - **DreamTeam** → 7-expert council critique before launch (2–3 iteration rounds)
4. **Ambitious UX patterns** — concrete, named patterns to consider per section (hero, products grid, founder section, manifesto, language switcher). NOT exhaustive — explicit "push further" invitation.
5. **Voice as a design tool** — table comparing "what other companies do" vs "what this site does instead". Shows how the voice constraint amplifies confidence rather than restricts copy.
6. **Inspiration as constraints** — reference brands (Stripe, Linear, Basecamp, Vercel) with what to BORROW and what to AVOID. Plus anti-references (gradient SaaS, neon AI, "Trusted by" logo bars).
7. **What Claude is allowed (and encouraged) to do** — explicit permission list: propose 2–3 hero options, generate imagery via media skill, author new component patterns, push the visual language past the sibling product brand, suggest motion choreography with specific easings/durations.
8. **What the bundle deliberately leaves open** — logo direction, OG card, press section, careers — name the gaps as invitations.

**The single highest-impact directive** (always present at the end):

> "Treat the founder story as the product, and the visual mechanic as the proof. Every UX decision should ask: *does this make [the founder's] bet visible to someone who has 90 seconds on the site?* If it doesn't earn its place against that test, cut it. The restraint is the design."

This section's existence is what distinguishes a generative bundle from a descriptive one. **Without `07-creative-brief.md`, Claude defaults to mild — token migration + typography swap + Makerkit-shaped hero. With it, Claude orchestrates skills toward a thesis-proving interaction.**

**Markdown register requirements:**
- Blunt, technical, no hype, exact numbers, exact paths.
- Verbatim quotes preferred over paraphrase.
- Every claim must trace to a source file path (audit-mode discipline).
- No exclamation marks. No emojis in technical content.

### D3. Copy curated source files into `code/` (always-fire — these files exist in any kit-shaped fork)

```bash
cp apps/web/styles/theme.css claude-design-system-bundle/code/theme.css
cp apps/web/styles/globals.css claude-design-system-bundle/code/globals.css
cp apps/web/styles/custom.css claude-design-system-bundle/code/custom.css
jq '.exports' packages/ui/package.json > claude-design-system-bundle/code/ui-exports.json
# Curated makerkit + site copies — existence-guarded (the D6-D9 skip-clean discipline) so a
# kit restructure does NOT silently drop a curated source. Each prints ✓ or a ⚠ MISSING line
# the operator (and the E3 manifest) can see, instead of cp erroring to stderr and continuing.
while IFS='|' read -r src dst; do
  [ -z "$src" ] && continue
  if [ -f "$src" ]; then cp "$src" "$dst" && echo "✓ $dst"; else echo "⚠ MISSING $src (kit restructured — curated source not provided)"; fi
done <<'PAIRS'
packages/ui/src/makerkit/page.tsx|claude-design-system-bundle/code/components/makerkit-page.tsx
packages/ui/src/makerkit/marketing/hero.tsx|claude-design-system-bundle/code/components/makerkit-hero.tsx
packages/ui/src/makerkit/form.tsx|claude-design-system-bundle/code/components/makerkit-form.tsx
apps/web/app/[locale]/(public)/_components/site-header.tsx|claude-design-system-bundle/code/components/site-header.tsx
apps/web/app/[locale]/(public)/_components/site-navigation.tsx|claude-design-system-bundle/code/components/site-navigation.tsx
apps/web/app/[locale]/(public)/_components/site-footer.tsx|claude-design-system-bundle/code/components/site-footer.tsx
apps/web/app/[locale]/layout.tsx|claude-design-system-bundle/code/layouts/locale-layout.tsx
PAIRS
find 'apps/web/app/[locale]/(public)' -maxdepth 2 -name 'layout.tsx' -exec cp {} claude-design-system-bundle/code/layouts/public-layout.tsx \;
```

### D4. Copy brand-direction reference from sibling SaaS

```bash
cp <sibling SaaS path>/apps/web/styles/theme.css claude-design-system-bundle/brand-direction/studio-theme.css
```

Write `brand-direction/studio-typography.md` with the canonical Geist + Space Grotesk + JetBrains Mono stack reference (or whatever the sibling project's typography canon is). Source: `<sibling SaaS path>/brand/BRAND-DEFINITION.md`.

### D5. Write `assets/README.md`

Placeholder explaining what fonts/logos/icons go here. **Do NOT download external assets.** List explicitly-rejected assets from the sibling project (e.g., phoenix marks, wrong-color wordmarks) so they're never re-copied.

### D6. Active-fork capture — public assets (skip-clean if absent)

When the fork has populated `apps/web/public/` beyond Makerkit defaults (logos, OG cards, hero imagery, custom favicons, downloaded fonts), copy the entire subtree verbatim:

```bash
if [ -d apps/web/public ] && [ "$(find apps/web/public -type f | wc -l)" -gt 1 ]; then
  mkdir -p claude-design-system-bundle/assets/public
  rsync -a --exclude='.DS_Store' --exclude='*.env*' apps/web/public/ claude-design-system-bundle/assets/public/
  echo "✓ D6: public assets copied ($(find claude-design-system-bundle/assets/public -type f | wc -l) files)"
else
  echo "○ D6: no custom public assets — skipped (fresh-fork case)"
fi
```

**Exclude rules:** `.DS_Store`, `*.env*` (never copy secrets), `.git*`, `node_modules/`. Never download — only mirror what's already on disk.

**Why aggressive copy:** in active forks (altyaa-turbo, era-materna, donne, durante-studio) `apps/web/public/` carries finalized logos, OG cards, and brand-aligned imagery. Claude's design system needs to see these as ground truth, not placeholders.

### D7. Active-fork capture — i18n messages (skip-clean if untouched)

When `apps/web/i18n/messages/` has been customized beyond stock translations (marketing copy, hero strings, product page bodies in JSON):

```bash
if [ -d apps/web/i18n/messages ]; then
  mkdir -p claude-design-system-bundle/code/i18n
  cp apps/web/i18n/messages/*.json claude-design-system-bundle/code/i18n/ 2>/dev/null || true
  files=$(ls claude-design-system-bundle/code/i18n/*.json 2>/dev/null | wc -l)
  echo "✓ D7: i18n messages snapshot ($files locale files)"
else
  echo "○ D7: no i18n messages dir — skipped"
fi
```

The marketing copy is load-bearing brand evidence — hero taglines, founder quotes, value props. Mining the *agents* read it in Phase B but copying it into the bundle gives Claude the actual strings to evolve, not summaries of them.

### D8. Active-fork capture — `(public)/` route subtree (skip-clean if stock)

When the fork has authored real marketing-route content (custom `about/`, `products/`, `manifesto/`, `careers/` pages with substantive `page.tsx` bodies):

```bash
PUBLIC_ROUTE='apps/web/app/[locale]/(public)'
if [ -d "$PUBLIC_ROUTE" ]; then
  # Count substantive page files (page.tsx with > 30 lines, excluding _components/ and stock root)
  CUSTOM=$(find "$PUBLIC_ROUTE" -name 'page.tsx' ! -path '*/\(*/page.tsx' | xargs -I{} sh -c 'wc -l < "{}"' 2>/dev/null | awk '$1 > 30 { c++ } END { print c+0 }')
  if [ "${CUSTOM:-0}" -gt 1 ]; then
    mkdir -p claude-design-system-bundle/code/pages
    rsync -a --exclude='.DS_Store' --exclude='node_modules' --exclude='__tests__' "$PUBLIC_ROUTE/" claude-design-system-bundle/code/pages/
    echo "✓ D8: (public)/ route subtree mirrored ($CUSTOM substantive pages)"
  else
    echo "○ D8: (public)/ has only stock route — skipped"
  fi
fi
```

Preserves the route directory structure so Claude can see how custom marketing routes nest (e.g., `products/[slug]/page.tsx`).

### D10. Canonical `DESIGN.md` at bundle root (always-fire)

**This is the load-bearing artifact** per the [VoltAgent/awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design) format + Anthropic's Claude Design help docs. Anthropic's "Set up your design system" form ingests a single canonical file with 9 sections; the surrounding folder is supplementary context.

Write `claude-design-system-bundle/DESIGN.md` with these 9 sections (always present, populated from Phase B/C findings):

1. **Visual Theme & Atmosphere** — tone, density, mood, architectural mechanic (e.g., stage-color → algorithm-phase mapping)
2. **Color Palette & Semantic Roles** — OKLCH source-of-truth, three-layer token grammar (the rule, not just the ramp), light + dark mappings, "do not introduce" rules
3. **Typography Rules** — stack with rationale, type scale, tracking rules
4. **Component Stylings** — slot-first canonical example (Button), Card, Form, with anatomy + variants + states + tokens + accessibility contract
5. **Layout Principles** — container, section padding, gutter, grid, page chrome
6. **Depth & Elevation** — shadow tokens, border radius rule
7. **Do's and Don'ts** — explicit ban-list (taglines from sibling products, hype words, emojis, color-only indicators, country flags as language switchers)
8. **Responsive Behavior** — breakpoints, mobile-first, touch targets
9. **Agent Prompt Guide** — reusable prompt shapes ("Generate a new page", "Propose a new component primitive", "Audit the system", "Evolve a token")

**Why this is its own step (not just D2 §README):** the canonical form expects a SINGLE file matching the spec, not a folder. The folder is for *Claude Code* (richer context); the file is for *Claude Design's onboarding form*. Both consume the same source; the file is the wire format.

### D11. Multi-format token files projected from one source (`tokens.json` → `registry.json` + `tokens-sandbox.css`)

The token system lands in **three formats** so the bundle is consumable by the full AI-codegen ecosystem, not just Claude.ai — but they are NOT three independently hand-authored files that drift the instant one is edited. `tokens.json` (W3C DTCG) is the **single projected source**; `registry.json` and `tokens-sandbox.css` are *derived from it deterministically*. Author the OKLCH palette ONCE, in `tokens.json`, then project — and gate the projection on an OKLCH-pair contrast assertion so a palette that fails WCAG can never reach the other two formats.

```bash
# 1. Write code/tokens.json — THE SINGLE SOURCE — W3C Design Tokens Community Group format 2025.10
# Schema: https://design-tokens.github.io/community-group/format/
# Fields per token: $type, $value, $description, optional $metadata.
# Sections: palette / stage / semantic.light / semantic.dark / radius / motion / typography
# Color $value is OKLCH (e.g. "oklch(0.62 0.19 29)"). This file is authored; the next two are projected.
# Consumable by Style Dictionary v5, Tokens Studio for Figma, any DTCG-aware tool.

# 2. ASSERT contrast on the OKLCH color pairs BEFORE projecting (hard gate — abort the emit on a miss).
#    For every semantic foreground/background pair in tokens.json — semantic.{light,dark} of
#    foreground×background, primary×primary-foreground, muted-foreground×background,
#    destructive×destructive-foreground, ring×background, and any other fg/bg token pair:
#      a. Convert each OKLCH $value → sRGB → WCAG 2.2 relative luminance.
#         (OKLCH L alone is NOT WCAG luminance — you MUST round-trip through sRGB.)
#      b. ratio = (Llighter + 0.05) / (Ldarker + 0.05).
#      c. Require ratio ≥ 4.5 for body-text pairs, ≥ 3.0 for large-text / UI-component pairs.
#    Any pair below threshold ABORTS the bundle, naming the failing pair + measured ratio. This makes
#    context/10-accessibility.md's "contrast pairs proven against the locked palette" true by
#    construction, not by assertion.

# 3. PROJECT code/registry.json FROM tokens.json — shadcn-format registry endpoint (do NOT hand-edit)
# Schema: https://ui.shadcn.com/schema/registry.json
# Items: registry:theme with cssVars.{theme, light, dark} read straight from semantic.{light,dark}.
# Consumable by v0.app, Lovable, Bolt, Cursor, Claude Code's shadcn integration.

# 4. PROJECT code/tokens-sandbox.css FROM tokens.json — sanctioned mutation surface (do NOT hand-edit)
# Three-layer pre-skeletoned (option / decision / component) emitted from palette + semantic, with
# `/* add: */` comments at extension points. Footer carries the same contrast assertion as a
# validation checklist. Claude edits tokens.json, re-projects + re-asserts HERE, then promotes to
# apps/web/styles/theme.css.
```

**Why single-source-projected:** three hand-authored token files diverge the moment one is touched. Inverting to `tokens.json` → projection makes DTCG the one source of truth and the OKLCH-pair contrast assertion the gate every projection must clear.

**Pattern source:** Perplexity + Gemini research (2026-05-27) — DTCG 2025.10 + shadcn registry are the two converged AI-consumable formats; token-sandbox is the IBM Carbon "themes" play.

### D12. Three missing-leg context files (component anatomy, interaction grammar, accessibility)

Per Designer audit (2026-05-27): the original bundle was strong on tokens + voice but missing three legs:

```bash
# context/08-component-anatomy.md
# Carbon/Radix-style documentation. Anatomy (slots/DOM) + variants (intent × size × state matrix)
# + composition rules + do/don't pairs, per primitive. Canonical pattern at the file top.
# Document the load-bearing primitives (Button, Card, Form, Page, Hero, etc.) + the full
# package.json exports inventory + "proposing a new primitive" guidance.

# context/09-interaction-grammar.md
# Linear-restraint motion vocabulary. States catalog + scroll choreography primitives
# (reveal, stage-color background shift, parallax limit, animated counters)
# + motion tokens + easing curves + reduced-motion handling + anti-patterns.

# context/10-accessibility.md
# WCAG 2.2 AA baseline (AAA where reasonable). Contrast pairs proven against the locked
# palette + focus contract + keyboard nav patterns + screen-reader semantics +
# "color never sole carrier" rule + touch targets + i18n a11y + audit checklist.
```

**Why these three:** Designer's audit verdict ("the system is documented as tokens, not as a system") + Gemini research confirming the frontrunner pattern is "slot-first component manifests + interaction grammar + accessibility contracts as machine-readable scaffolding".

### D13. `brand-direction/` → `delta-reference/` rename + `DELTA.md`

**The hardest-to-resist failure mode** is cargo-culting the sibling product brand. Per Designer audit: "invariants in prose lose to gravity in code". The rename + `DELTA.md` encode the rule in the folder name and the first file.

```bash
# Rename
git mv claude-design-system-bundle/brand-direction claude-design-system-bundle/delta-reference

# Author claude-design-system-bundle/delta-reference/DELTA.md
# Three sections:
#  1. "The three inversions" — concrete table of what durante.tech inverts against the sibling
#     (tonal hierarchy, visual hierarchy, density/pace).
#  2. "What stays the same (DO inherit)" — the portfolio-wide invariants (OKLCH architecture,
#     warm hue 70, stage color mapping, type stack, dark-mode-first, voice ban-list, WCAG 2.2).
#  3. "How to use this folder" — explicit rule for when to invert vs inherit, with the
#     hardest-to-resist temptation called out by name.
```

**Why the rename:** the name `brand-direction` reads as "the direction to head", which is the opposite of the intent. `delta-reference` encodes "reference for understanding the delta" — naming the *difference*, not the *destination*.

### D14. Brand intelligence — `intelligence/` (always-fire if Phase B research returns)

If Phase B fired research agents (Perplexity / Claude / Gemini) the bundle MUST persist their findings in `intelligence/`. Write 8 files:

- `intelligence/01-landscape.md` — competitive landscape + white space (from Phase B Research output)
- `intelligence/02-competitor-profiles.md` — named-competitor profile cards (from Phase B Research output)
- `intelligence/03-ax-benchmark.md` — scaffold + AXDeepScan invocation snippet
- `intelligence/04-competitor-tech.md` — scaffold + DepWatch invocation snippet
- `intelligence/05-icp.md` — 6-segment audience map + v1 priority (from Phase B Research output)
- `intelligence/06-stakes-narrative.md` — Sales-skill stakes narrative per segment (synthesize from ICP + founder context)
- `intelligence/07-telos-alignment.md` — scaffold + Telos invocation snippet
- `intelligence/08-press-targets.md` — scaffold + Investigation invocation snippet

**Why this matters:** Phase B research is the most expensive intelligence in the pipeline. Persisting it in the bundle (not just in agent return messages) means the bundle survives the session and can be re-consumed by Claude Design / future operators / future Claude runs.

### D15. Copywriting + messaging library — `copy/` (always-fire, Standard depth)

The bundle ships pre-vetted copy assets in voice. Standard depth = 4 files:

- `copy/01-brandscript.md` — Donald-Miller StoryBrand 7-part applied at institutional level
- `copy/02-founder-narrative.md` — Will Storr 4-act founder story (EN + PT-BR if bilingual locked at Phase C)
- `copy/03-headline-bank.md` — 30+ headline candidates, all voice-vetted (hero / OG / press / per-language)
- `copy/04-voice-audit-template.md` — 15-item checklist Claude runs against any new copy before commit

**Voice gate.** Every line of generated copy MUST pass `04-voice-audit-template.md`'s ban-list (no exclamation marks, no "revolutionize / game-changing / leverage / supercharge", no emojis in technical content, no DOS-product-tagline-lifting). The audit template is enforced by Claude in subsequent runs.

**Depth alternatives:** Light depth = brandscript + headlines (2 files). Deep depth = Standard + launch dispatch + 30-day content calendar (6 files). Operator picks at Phase C.

### D16. Press + investor-readiness — `press/` (always-fire when scope ≥ marketing+light-auth)

Bundle ships press + investor materials when the site will have ANY public-facing identity beyond marketing-only.

5 files:

- `press/01-founder-bio.md` — verified bio in 9 formats (one-liner, X bio, LinkedIn, conference EN, conference PT-BR, 90s pitch, 25-word press one-liner, investor deck slide)
- `press/02-pitch-deck/README.md` — scaffold for PitchDeck-skill standalone HTML+D3 deck (10-slide investor outline)
- `press/03-investor-readiness.md` — pre-seed checklist + startup-investor-docs skill orchestration
- `press/04-press-assets.md` — visual press kit specifications (headshot, logo, OG, diagrams, favicons)
- `press/05-launch-release-draft.md` — embargoed launch press release draft (~450 words)

**Skip-clean rule:** if Phase C operator selects "marketing-only" scope AND explicitly opts out of press surface, skip D16. Re-runnable when needed.

### D17. SEO + Agent Experience — `meta/` (always-fire)

The bundle ships explicit metadata + AX-readiness targets so the site scores well for both humans and agents.

3 files:

- `meta/01-ax-readiness.md` — llms.txt template, robots.txt with AI-agent permissions, JSON-LD schema-org structured data, AX Score target ≥ 85
- `meta/02-seo-strategy.md` — per-page `generateMetadata` spec (8 page types: home, founder, products, press, manifesto, pitch, help, careers)
- `meta/03-sentinel-conformance.md` — portfolio-wide conventions + durante.tech-specific documented divergences

**Why mandatory:** durante.tech's audience includes AI agents themselves (Cursor, Claude, Continue read company sites when their users ask "what's X?"). For an AI-OS company, scoring < 85 on AX is a credibility leak.

### D18. Ship-readiness review templates — `review/` (always-fire)

The bundle ships review scaffolds so Claude (or a human) can gate launch.

4 files:

- `review/01-dreamteam-critique-template.md` — 7-expert critique (Peep Laja CRO / Joanna Wiebe copy / Katie Dill design / UX / Visual / Brand / Marketing). Iterate 2–3 rounds before launch.
- `review/02-council-positioning-debate.md` — captured debate that produced the locked positioning. Future operators read this to know WHY before relitigating WHAT.
- `review/03-memory-check.md` — MemPalace cross-project decision-conflict scan
- `review/04-prior-work-index.md` — single-glance audit trail of every PRD / artifact / commit / session that fed the bundle

**Pre-launch gate:** all 4 review files must end with `0 unresolved findings` before durante.tech goes public.

### D9. Active-fork capture — in-repo brand/design docs (skip-clean if absent)

When the fork has authored its own brand canon at the repo root or in `brand/` / `docs/` directories:

```bash
mkdir -p claude-design-system-bundle/context/brand-snapshot
found=0
for pattern in 'BRAND*.md' 'DESIGN*.md' 'STYLE*.md' 'brand-*.md' 'design-*.md' 'BRANDSCRIPT*.md' 'MEDIAKIT*.md'; do
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    # Skip paths inside node_modules / .git / the bundle itself
    case "$f" in *node_modules*|*.git/*|*claude-design-system-bundle/*) continue ;; esac
    rel=$(echo "$f" | sed 's|^./||; s|/|__|g')
    cp "$f" "claude-design-system-bundle/context/brand-snapshot/$rel"
    found=$((found + 1))
  done < <(find . -maxdepth 4 -iname "$pattern" 2>/dev/null)
done

# Also mirror a top-level brand/ directory if present
if [ -d brand ]; then
  rsync -a --exclude='.DS_Store' --exclude='node_modules' brand/ claude-design-system-bundle/context/brand-snapshot/brand/
  found=$((found + $(find brand -type f | wc -l)))
fi

if [ "$found" -gt 0 ]; then
  echo "✓ D9: brand-snapshot captured ($found docs)"
else
  rmdir claude-design-system-bundle/context/brand-snapshot 2>/dev/null
  echo "○ D9: no in-repo brand docs — skipped"
fi
```

**Path-flattening note:** files outside `brand/` are copied with `__` separators replacing `/` in their filenames (so `docs/brand/voice.md` becomes `docs__brand__voice.md` in the snapshot dir). This preserves provenance without recreating nested trees that may collide.

### D-summary — boundary rules for active-fork capture (D6–D9)

| Rule | Reason |
|---|---|
| **Never copy `.env*`, `.git/`, `node_modules/`** | Secrets + irrelevance |
| **Always skip-clean when source dir absent** | Fresh forks must still pass Phase D end-to-end |
| **Mirror verbatim — no transformation** | Claude sees ground truth, not summary-of-summary |
| **Print one `✓` or `○` line per phase** | Operator can confirm which captures fired |
| **Stay inside the working tree** | Never reach into sibling projects in D6-D9 (sibling content is Phase D4 only) |

**Active-fork worked examples** (reference set when authoring agent prompts in Phase B):

| Fork | Why it's a good test case |
|---|---|
| `~/Developer/altyaa-turbo` | Substantial product content; active brand work; tests D6+D7+D8 |
| `~/Developer/era-materna` | Marketing-heavy; pt-BR-first i18n; tests D7 (multi-locale) |
| `~/Developer/donne` | Greenfield-product shape; tests partial-coverage gracefully |
| `~/Developer/durante-studio` | Most complete brand canon; tests D9 (`brand/BRAND-DEFINITION.md`, `BRAND-GUIDELINES.md`) |

## Phase E — Apply Locked Decisions + Commit

### E1. Apply Phase C decisions to bundle files

Edit these files to replace placeholder/draft text with `(LOCKED YYYY-MM-DD)` stamps and the operator's chosen values:

| File | Section | Lock |
|---|---|---|
| `FORM_FILL.md` | "Any other notes?" section | Positioning + tagline + languages + deploy |
| `context/01-company.md` | Institutional vs product positioning block | Locked positioning |
| `context/04-brand-voice.md` | Messaging at the institutional level | Locked tagline approach + banned-at-institutional list |
| `context/06-tech-stack.md` | Deploy target + Internationalization sections | Locked deploy + i18n |

Use `Edit` (not `Write`) — the section locations are stable.

### E2. Stage + commit

```bash
git add claude-design-system-bundle/
git commit -m "$(cat <<EOF
docs(brand): Claude design system bundle — <company> institutional context

Curated design-system bundle (~56 files, $COUNT exact — see E3) for the Anthropic "Set up your design system" form.
Separates institutional (<domain>) from product (sibling at <other domain>).

Locks: positioning = "<locked positioning>";
<tagline status>; <languages>; deploy to <target>.

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"
```

### E3. Verify

```bash
git status                                          # working tree clean
git log -1 --format="%H %s"                         # capture commit hash
COUNT=$(find claude-design-system-bundle/ -type f | wc -l | tr -d ' ')
echo "bundle file count: $COUNT"
# The D-steps emit ~56 always-fire files (D2=9 + D3≈11 + D4-5=3 + D10=1 + D11=3 + D12=3 +
# D13≈2 + D14=8 + D15=4 + D16=5 + D17=3 + D18=4) plus active-fork extras. Assert a FLOOR,
# not a stale literal — the old `# expect 23` false-failed every real run (the count is a
# derived fact of what the run emits, not a constant). A count below the always-fire floor
# means a D-step was silently skipped.
if [ "$COUNT" -ge 50 ]; then echo "✓ bundle count OK (>= 50 always-fire floor)"; else echo "⚠ bundle count $COUNT is below the ~50-file always-fire floor — a D-step likely skipped; check the per-step ✓/○ output"; fi
```

Report the commit hash, bundle path, and `$COUNT` in the workflow's final output.

## Invariants (CRITICAL — every phase)

1. **Institutional vs product positioning distinction.** The bundle is for the COMPANY's institutional site, NEVER a re-pitch of a single product.
2. **No brand fabrication.** Every claim traces to a source file path. Verbatim > paraphrase.
3. **No app-code modification.** `apps/*` and `packages/*` are untouched; bundle is a sibling folder.
4. **No external asset downloads.** `assets/` is placeholder-only.
5. **`brand-direction/` is REFERENCE, not COPY.** Sibling project's brand is one product line; institutional site develops its own.
6. **`/code-review` decline allowed** for documentation+verbatim-copy bundles. Surface explicit `Declined:` line per §4 Decline Protocol.

## Worked Example

Pattern was first executed on `durante-tech` (2026-05-27), committed at `7773302` on `develop`. Reference bundle at `~/Developer/durante-tech/claude-design-system-bundle/` — 23 files, ~136 KB, ~2000 lines. Locked decisions: positioning = "operating-systems firm for AI-native software"; no launch tagline; EN+PT-BR with switcher; Railway deploy.

## Artifact Tracking

After Phase E completes, log to `MEMORY/ARTIFACTS/artifacts.jsonl`:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"DesignBundle","workflow":"RunPipeline","type":"design-bundle","title":"<company> claude design system bundle","path":"'$(pwd)'/claude-design-system-bundle","contentPreview":"<first 500 chars of FORM_FILL.md>","wing":"<company-slug>","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

## KG Composition Facts (`composes`)

After Artifact Tracking, record the bundle's declared composition in the knowledge graph. The DesignBundle is a *composite* artifact — it orchestrates the outputs of the Brand, DesignSystem, PitchDeck, and Media skills (the D10 skill-orchestration map). Emit one `composes` fact per constituent so the graph can answer "what does this bundle bundle?" and reverse-trace which skill outputs a bundle depends on.

Use the canonical `composes` predicate via the MemPalace bridge. Write a real subject/predicate/object triple — do NOT bury the relationship in a metadata dict (the bridge drops unknown metadata keys). Subject is the bundle keyed by `<company-slug>` (same slug used as the artifact `wing` above); each object is the constituent skill output keyed by the same slug.

```bash
BRIDGE="$HOME/.claude/DOS/Tools/mempalace_bridge.py"
SLUG="<company-slug>"   # same value used for the artifact `wing` above
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

for OBJ in "brand:${SLUG}" "designsystem:${SLUG}" "pitchdeck:${SLUG}" "media:${SLUG}"; do
  python3 "$BRIDGE" add_kg_fact "$(printf '{"subject":"bundle:%s","predicate":"composes","object":"%s","ts":"%s"}' "$SLUG" "$OBJ" "$TS")"
done
```

A `predicate-gate` rejection means the `composes` predicate is not yet ratified in `PREDICATES.md` on this install — the rejection self-queues a proposal and is non-fatal; do not fail the pipeline on it.

## Done

Bundle live at `<repo>/claude-design-system-bundle/`. Operator drags the folder into the Claude Design System form's "Link code from your computer" field and pastes values from `FORM_FILL.md` into the matching form fields. Commit hash recorded; ready for `git push` when operator approves.
