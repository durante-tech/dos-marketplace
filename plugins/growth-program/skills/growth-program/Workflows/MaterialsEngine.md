---
name: MaterialsEngine
description: Phase 3 — recurring creative/materials engine (reels, carousels, statics, shorts) + a brand-locked production spec
status: STABLE
bestPath:
  - title: "Work Order & Format Mix"
    description: "Parse the content calendar into a per-asset work list and roll up the format mix for the window."
  - title: "Format Spec Lock"
    description: "Confirm or author the per-format creative spec (dimensions, hook pattern, caption structure, CTA placement)."
  - title: "Template System"
    description: "Build or confirm the brand-locked templates each asset fills, signed off by the Creative seat."
  - title: "Batch Production Loop"
    description: "Run copy, render, name/ID, QA, and log for every asset in the work list."
  - title: "Production Spec & Close"
    description: "Write production-spec.md with the asset/template registries and next-cycle fill instructions."
---

# MaterialsEngine Workflow

## When to Use
- Trigger phrases: "create materials", "posts/reels/carousels", "creative batch".
- Situation: `content-calendar.md` (Phase 2) already exists and dated calendar slots need actual on-brand rendered assets plus a repeatable production system.
- NOT for deciding what to post when (use `CampaignCalendar`) or publishing the rendered assets live (use `PresenceOps`) — this phase only produces drafts.

**Purpose:** Turn the dated calendar into actual on-brand creative AND the **repeatable production system**
that makes the *next* batch a fill-in-the-blanks job, not a from-scratch one. This phase ships
`materials/` (the produced assets, each with a stable ID that cites its calendar entry + campaign) plus a
`materials/production-spec.md` that locks per-format creative specs, the brand template system, the exact
`media`-pack invocation recipes, the batch-production loop, and a creative QA checklist. The **Creative
seat** holds craft + brand consistency and holds a hard veto on off-brand / low-craft output. It is the
production analog of `altyaa-turbo#251`'s week-1 asset drop — but generalized into an engine, not a one-off.

**Budget:** ~15–40 min for the spec + first batch (8–16 assets). Credits scale with asset volume and video
share (reels/shorts via `Media/Video` are the cost driver; statics/carousels via `Media/Art` are cheap).
A 12-asset mixed batch (4 statics, 4 carousels, 2 reels, 2 shorts) ≈ the bulk of a cycle's media spend.

## Inputs
- `content-calendar.md` — the dated, per-channel calendar (Phase 2). **The work order.** Every asset
  produced here is keyed to a calendar row (date × channel × campaign `C*`).
- `campaigns.md` — campaign briefs (`C*`): hypothesis, pillar served, success signal, CTA intent.
- `strategy.md` — brand voice + visual tokens (colors, type, logo, tone), ICP, channel mix, the wedge.
- Brand assets / tokens — the canonical `brand-tokens.json` (DTCG) or `brand-token-spec.md` from `brand` (Phase 1), or extracted from existing material. **Required**; the
  template system is brand-locked and cannot be built without it.
- (Optional) prior `materials/production-spec.md` — if this is cycle 2+, the spec already exists; this run
  *fills* templates and *amends* the spec rather than authoring it.

## Prerequisites (+ graceful degradation when a composed pack is absent)
- **`media` (REQUIRED, primary).** The asset factory: `Art` (statics, carousels, hero/vertical images),
  `SocialMedia → SocialKit` (platform-correct dimensions + multi-format kit), `Video` (reels/shorts via
  TextToVideo / ImageToVideo), `Remotion` (programmatic/data-driven video). **Degrade:** if `media` is
  absent, do NOT fabricate assets — emit `production-spec.md` + per-asset *production tickets* (the prompt,
  dimensions, template, copy block, QA target) so a human or a later run with `media` executes them. A spec
  with empty `materials/` is a valid, honest deliverable; fake "rendered" assets are not.
- **`brand` (REQUIRED for the template lock).** Supplies the visual tokens the templates bind to. **Degrade:**
  if no token spec exists, extract a provisional palette/type/logo from existing assets and flag
  `> KNOWN GAP — provisional brand tokens; lock before scaling production` in the spec.
- **`dispatch` (copy).** Drafts/locks caption + hook + CTA copy per asset (it owns calendar copy in Phase 2;
  here it tightens it to each format's caption structure). **Degrade:** if absent, the Creative seat writes
  copy directly against the per-format caption template below.
- **The Creative council seat (`Agents/growth-creative.md`) — REQUIRED gate.** Veto authority on every
  asset. **Degrade:** never. If the seat can't be convened, the run STOPS at draft and flags
  `> BLOCKED — no Creative-seat sign-off; do not publish`.
- **The Skeptic seat — integrity gate (see Integrity checkpoints).** Owns the no-fabricated-claim,
  no-fake-review, rights-clearance pass on every asset's *copy* and *visual claims*.
- **`mem-palace` (optional).** Recall prior winning hooks/templates + the brand's reusable asset library so
  the batch reuses proven structures. **Degrade:** start the asset library fresh in this run.

## Steps

1. **Read the work order + lock the format mix.**
   1a. Parse `content-calendar.md` into a per-asset work list: each row → `{date, channel, campaign C*,
       format, pillar, success-signal}`. Roll up the **format mix** for this window (e.g. "wk1: 4 statics,
       3 carousels, 2 reels, 2 shorts, 1 GBP post").
   1b. Map each channel → its canonical format(s) and the spec row below (an IG slot is a 4:5 static or a
       9:16 reel; a LinkedIn slot is a 1.91:1 static or a doc-carousel; a TikTok/Shorts slot is 9:16 video).
   1c. **Decision rule — net-new vs reuse:** if a template for this `{format × channel}` already exists in
       the spec, this is a *fill* (cheap, fast); if not, this batch authors the template first (Step 3),
       then fills it. Author at most ~5 net-new templates per run — beyond that, defer to keep craft high.

2. **Pin the per-format creative spec** (the lever that makes assets format-fit). For each format in the mix,
   confirm/author the row in the spec's *Format Spec* table (full table in Output Template §2). The four
   load-bearing formats and their non-negotiables:
   - **Reel (9:16 video, 1080×1920):** 3-second hook is everything; on-screen text in the top-safe zone
     (avoid bottom ~250px UI overlap); 7–30s; loop-friendly end; captions burned in (sound-off default);
     hook pattern from the bank (§2). CTA in caption + last frame.
   - **Carousel (4:5 or 1:1, 1080×1350 / 1080×1080, 3–10 slides):** slide 1 is the hook/cover; slides
     2–N one idea each; final slide = CTA. Consistent template per slide; swipe-completion is the metric.
   - **Static (channel-native ratio):** one idea, one focal point, the squint-test (legible at thumbnail
     size); logo lockup in a fixed corner; ≤ 7 words of overlay text.
   - **Short (9:16 video, ≤ 60s, YT Shorts / TikTok / Reels cross-post):** same as reel but built for
     cross-post — no platform-watermarked source, no platform-specific UI in the hook.
   For each: lock **dimensions, hook pattern, caption structure, CTA placement** (these four are the spec's
   columns).

3. **Build / confirm the brand-locked TEMPLATE system** (Step 3 is what makes it an *engine*).
   3a. Define a template `T*` per `{format × channel}` slot, bound to the brand tokens from `strategy.md`:
       background/color rules, type scale + font, logo lockup position + size, safe-zone margins, the
       grid/layout, and the fixed vs. variable regions (variable = the copy block + the focal image; fixed
       = everything brand). A template is "filled" by swapping only the variable regions.
   3b. **`media` invocation for template authoring** — generate the *master* once, then derive:
       - Static/carousel masters → `media` → `Art/SKILL.md` (ImageGeneration). Prompt carries the brand
         tokens verbatim (palette hex, type, mood). Establish character/style consistency with
         `Art → Workflows/StyleTransfer.md` so every later fill matches.
       - Multi-format export from one master → `media` → `SocialMedia/SKILL.md → Workflows/SocialKit.md`
         (emits the platform-correct dimensions of one design — the cheapest way to hit every channel's ratio).
       - Data/numbers-driven recurring video template → `media` → `Remotion/SKILL.md` (programmatic;
         re-render with new props each cycle — the highest-leverage reuse).
   3c. The Creative seat signs off the template *before* any fill — a flaw in `T*` multiplies across the batch.

4. **Run the repeatable batch-production loop** (the cadence + naming discipline). For each asset in the
   work list, in this order:
   - **(a) Copy block** — `dispatch` (or Creative seat) writes hook + body + CTA + caption to the format's
     caption structure (§2). The Skeptic verifies every factual claim in the copy *now* (Step = Integrity).
   - **(b) Render** — the exact `media` recipe for the asset type (full recipe table in Output Template §4):
     | Asset type | `media` route | Notes |
     |---|---|---|
     | Static | `Art/SKILL.md` (ImageGeneration) → `SocialKit` for ratio | fill template `T*`, swap focal + overlay |
     | Carousel | `Art/SKILL.md` per slide, same template `T*` | cover slide + N body + CTA slide |
     | Hero / vertical image | `Art/SKILL.md` + `StyleTransfer` for consistency | reuse across a campaign |
     | Reel / Short | `Video/SKILL.md` (TextToVideo) or `Video → ImageToVideo` from a static | burn captions, top-safe text |
     | Data/recurring video | `Remotion/SKILL.md` | props per cycle |
     | Logo / mark touch-ups | `brand` (source) → `Art/ImageEdit` | never re-draw the logo ad hoc |
   - **(c) Name + ID** — write to `materials/` with the naming convention (§ below) and assign the stable
     asset ID `A*` (Output Template §3). The asset ID cites its calendar date, channel, and campaign `C*`.
   - **(d) QA** — run the creative QA checklist (§5 / Integrity) — on-brand, format-fit, accessibility,
     rights. Any FAIL → fix or pull; the Creative seat has final veto.
   - **(e) Log** — append to `MEMORY/ARTIFACTS/artifacts.jsonl` (per the Media artifact-tracking contract).
   **Cadence decision rule:** batch-produce a *full calendar window* (typically one week) in one loop, not
   asset-by-asset across the cycle — batching amortizes the template/render setup and keeps voice consistent.

5. **Write the production spec + close the loop.** Author/amend `materials/production-spec.md`
   (Output Template §1–§6): format specs, the template registry `T*`, the asset registry `A*`, the recipe
   table, the QA checklist with this batch's results, and the *next-cycle fill instructions* (what a future
   run swaps to produce the next window without re-deciding anything). Record winning hooks/templates to
   `mem-palace` so cycle 2+ reuses them.

## Output Template (the artifact this phase writes)

This phase writes a directory: `materials/` (the assets) + `materials/production-spec.md` (the system).
The spec is the decision-grade artifact — its literal structure follows. Stable IDs: `A*` assets,
`T*` templates; every asset cites its calendar date + channel + campaign `C*`.

```markdown
# Materials & Production Spec — <Subject>
**Cycle:** <YYYY-Wnn> · **Window:** <start>–<end> · **Owner:** <role> · **Creative-seat sign-off:** ☐
**Brand tokens:** locked from `strategy.md` (palette / type / logo / voice) · **Status:** DRAFT — not published

## 1. Batch summary
| Metric | Value |
|---|---|
| Assets in this batch | 12 (4 static · 4 carousel · 2 reel · 2 short) |
| Campaigns served | C1, C2, C4 |
| Templates used | T1, T3, T5 (0 net-new) / T6 authored this cycle |
| Channels covered | IG, TikTok, LinkedIn, YouTube Shorts, GBP |
| QA pass rate | 12/12 on-brand · 12/12 format-fit · 11/12 a11y (A07 fixed) · 12/12 rights |
| DO-NOT-CITE blocks raised | 1 (see §6) |

## 2. Per-format creative spec
| Format | Dimensions (px / ratio) | Hook pattern | Caption structure | CTA placement |
|---|---|---|---|---|
| Reel | 1080×1920 · 9:16 | 3s pattern-interrupt: "Stop <doing X>." → payoff | Hook line · 1–2 value lines · CTA · 3–5 tags | Last frame + caption line 1 |
| Carousel | 1080×1350 · 4:5 · 3–10 slides | Cover = bold claim/number; "Swipe →" affordance | Slide-1 hook · 1 idea/slide · final = CTA slide | Final slide + caption |
| Static | channel-native (IG 4:5, LI 1.91:1, GBP 4:3) | One idea, one focal point; ≤7 overlay words | Single sentence + CTA + tags | Caption line 1 + logo corner |
| Short | 1080×1920 · 9:16 · ≤60s | Same as reel, cross-post-safe (no platform UI) | Title-case hook · value · CTA · tags | End-card + caption |

**Hook bank (reusable):** PI = pattern-interrupt · LIST = "N ways to…" · BEFORE/AFTER · MYTH-BUST ·
QUESTION-HOOK · POV · NUMBER-LEAD. Each asset's `A*` row names the hook it used.
**Safe zones:** vertical video — keep text in top 65%, clear of bottom ~250px (platform UI).
**Overlay limit:** static ≤7 words · reel hook ≤6 words on screen at once.

## 3. Asset registry (A*) — every asset cites its calendar row + campaign
| ID | Format | Template | Campaign | Channel | Calendar date | Hook | File | QA |
|---|---|---|---|---|---|---|---|---|
| A01 | Static | T1 | C1 | IG | 2026-07-07 | NUMBER-LEAD | `materials/A01_C1_ig_static_2026-07-07.png` | PASS |
| A02 | Carousel | T3 | C1 | LinkedIn | 2026-07-08 | LIST | `materials/A02_C1_li_carousel_2026-07-08/` | PASS |
| A03 | Reel | T5 | C2 | TikTok | 2026-07-09 | PI | `materials/A03_C2_tt_reel_2026-07-09.mp4` | PASS |
| A04 | Short | T5 | C2 | YT Shorts | 2026-07-09 | PI | `materials/A04_C2_yt_short_2026-07-09.mp4` | PASS (cross-post of A03) |
| A05 | Static | T1 | C4 | GBP | 2026-07-10 | QUESTION-HOOK | `materials/A05_C4_gbp_static_2026-07-10.png` | PASS |

**Naming convention:** `A<NN>_<C*>_<channel>_<format>_<YYYY-MM-DD>.<ext>` (carousels = a dir of
`slide-01.png … slide-NN.png` + `caption.md`). Append-only; IDs never reused.

## 4. Media invocation recipes (per asset type — copy/paste-ready)
| Asset type | Media route | Recipe / key params |
|---|---|---|
| Static | `Media → Art/SKILL.md` (ImageGeneration) | "Fill T1: <focal>, overlay '<≤7 words>', brand palette <hex>, <ratio>"; then `SocialKit` for per-channel ratios |
| Carousel | `Media → Art/SKILL.md` ×N slides, same T3 | cover (hook) + body slides (1 idea each) + CTA slide; consistent grid/type |
| Hero/vertical | `Media → Art` + `Art/Workflows/StyleTransfer.md` | StyleTransfer locks character/style across a campaign's assets |
| Reel | `Media → Video/SKILL.md` (TextToVideo) | 9:16, 7–30s, burn captions, top-safe text, loop-friendly end |
| Short (cross-post) | `Media → Video → ImageToVideo` (from a static) OR reuse reel master | strip platform UI/watermark; re-export 9:16 |
| Data/recurring video | `Media → Remotion/SKILL.md` | parametric template; new props each cycle |
| Logo/mark | `brand` (source) → `Media → Art/ImageEdit` | never redraw ad hoc; edit the locked mark only |

## 5. Creative QA checklist (run per asset; Creative seat = final veto)
- **On-brand:** palette = brand hex · type = brand fonts · logo lockup in fixed corner · voice matches `strategy.md` tone. ☐
- **Format-fit:** exact dimensions/ratio · text inside safe zones · duration in range · file < platform cap. ☐
- **Accessibility:** captions burned into all video (sound-off) · contrast ≥ WCAG AA on overlay text · alt text written for every static/carousel. ☐
- **Rights:** no unlicensed stock/music/faces · AI-gen assets cleared · no third-party trademarks/logos · no scraped UGC without consent. ☐
- **Claim integrity:** every factual/number claim in copy survives the Skeptic verify pass (see §6). ☐
- **Verdict:** PASS / FIX (note) / PULL · **Creative-seat sign-off:** ☐

## 6. Integrity ledger (this batch)
| Asset | Claim in copy | Source / status | Disposition |
|---|---|---|---|
| A02 | "rated #1 by 500+ salons" | unverifiable — no source | > DO NOT CITE — moved to soft framing "trusted by local salons" |
| A05 | "save 4 hours/week" | derived from product telemetry (cite ticket) | KEEP — sourced |

> **DO NOT CITE — unverified**
> A02 "#1 by 500+ salons" — no primary source; review/rating claims are gated on a real paying-customer
> base + verified data (FTC + no `AggregateRating` without substantiation). Replaced with non-numeric voice.

## 7. Next-cycle fill instructions (what makes it an engine)
- Templates T1/T3/T5 are locked → next window is a **fill**: swap focal + copy block + date only.
- Net-new only when a new `{format × channel}` slot appears on the calendar (author ≤5/run).
- Reuse the winning hook(s) flagged in `mem-palace`; rotate hook patterns to avoid fatigue.
- Re-render Remotion data videos with the cycle's new numbers (props only).
```

## Integrity checkpoints (this phase)

Owned by the **Skeptic seat**, applied to creative *copy* and *visual claims* before the Creative seat's
craft veto:
- **Stat integrity — adversarial verify on every claim in caption/overlay/end-card.** Any number
  (ratings, customer counts, "save N hours", market position) is refuted against a primary source before it
  ships. Confirmed → keep with the source named. Refuted/unverifiable → a `> DO NOT CITE — unverified`
  block in §6 and the copy is rewritten to non-numeric/soft framing. "Studies show…" with no source = fabricated.
- **No fake / incentivized reviews; no `AggregateRating` baked into creative.** Review-density or
  star-rating claims in assets are *earned*, never manufactured (FTC Consumer Review Rule + platform ToS).
  Rating/review creative is **gated on a real paying-customer base** — flag as a blocker, not a day-0 asset.
- **Rights clearance is a hard gate, not a nicety.** No unlicensed stock/music/faces, no third-party
  trademarks, no scraped UGC without consent, AI-gen assets cleared. A rights FAIL pulls the asset.
- **Brand voice + platform ToS respected.** Every asset matches `strategy.md` voice; no platform-watermarked
  source cross-posted; no claims that violate a channel's ad/content policy.
- **Locale integrity.** If the primary market is non-English, copy is authored in-locale (not
  EN-then-translate); thin locale creative research is flagged `> KNOWN GAP` before scaling that locale's batch.

## Worked example

**Subject:** "Be the default booking + reputation tool for local salons, French-first."
The calendar (Phase 2) hands MaterialsEngine a week-1 window: 4 statics, 4 carousels, 2 reels, 2 shorts,
1 GBP post across IG / TikTok / LinkedIn / YT Shorts / GBP, tied to campaigns C1 (booking-pain) and
C2 (reputation-flywheel).

1. **Work order + mix** — parse the 13 rows; all formats already have templates except a TikTok reel slot →
   author 1 net-new template `T6`.
2. **Format spec** — confirm reel (1080×1920, PI hook, captions burned, top-safe text), carousel (1080×1350,
   cover→idea→CTA), static (IG 4:5), GBP static (4:3).
3. **Templates** — `Media → Art` generates the static/carousel masters in the salon brand palette;
   `Art/StyleTransfer` locks the warm-pastel look across the campaign; `T6` authored + Creative-seat-approved
   before any reel fills.
4. **Batch loop** — for each asset: `dispatch` writes French-first copy → Skeptic verifies claims (the
   "#1 by 500+ salons" line is unverifiable → DO NOT CITE, rewritten to "des salons qui nous font
   confiance") → `media` renders per the recipe table → named `A03_C2_tt_reel_2026-07-09.mp4` → QA (a11y
   FAIL on A07 missing burned captions → fixed) → logged.
5. **Spec** — `materials/production-spec.md` written with the asset registry (A01–A13), template registry
   (T1–T6), recipe table, QA results (13/13 on-brand, 13/13 format-fit, 13/13 a11y after fix, 13/13 rights),
   the integrity ledger (1 DO-NOT-CITE), and next-cycle fill instructions. Winning PI hook saved to
   `mem-palace`. **STOP — drafts only; nothing published** (PresenceOps, Phase 4, owns publish).
