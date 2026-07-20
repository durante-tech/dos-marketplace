---
name: CampaignCalendar
description: Wedge + pillars → a campaign set (C*) + a dated, multi-channel content calendar with pillar-mix ratios
status: STABLE
bestPath:
  - title: "Load Upstream Contract"
    description: "Read strategy.md and any GEO roadmap, and recall prior campaigns to seed C* numbering."
  - title: "Derive Campaign Set"
    description: "Convert the wedge and pillars into a ranked, capped set of campaigns (C*) with hypotheses and success signals."
  - title: "Pillar Mix & Grid"
    description: "Set the educate/inspire/convert ratio and lay out the dated date x channel calendar grid."
  - title: "Seasonality Overlay"
    description: "Pin launch beats and seasonal windows onto the grid."
  - title: "Council Vet + Write"
    description: "Run the Channel/Strategist/Skeptic vet pass and write campaigns.md and content-calendar.md."
---

# CampaignCalendar Workflow

## When to Use
- Trigger phrases: "campaign calendar", "content calendar", "what posts when".
- Situation: `strategy.md` (Phase 1) already exists and you need a concrete, dated, multi-channel posting plan tied to campaigns.
- NOT for rendering the actual creative assets (use `MaterialsEngine`) or publishing/scheduling posts live (use `PresenceOps`) — this phase only plans dates and briefs.

**Purpose:** Phase 2 of the growth program. Turns the wedge + channel mix + GEO pillars from Phase 1 into a concrete **campaign set** and a **dated, multi-channel content calendar** — not a vague plan. Produces `docs/growth/campaigns.md` (every campaign C* with hypothesis, channels, pillar(s) served, offer, success signal, owner) and `docs/growth/content-calendar.md` (date × channel → post, governed by content-pillar mix ratios and aligned to seasonality + launch beats). Composes `dispatch` for copy and the **Strategist** (owns C*) + **Channel** (owns placement + cadence) council seats; the **Skeptic** verify-passes every offer claim and date-anchored stat.

**Budget:** ~8-20 min, ~15-40 credits depending on campaign count (3-6 typical) and calendar horizon (4-13 weeks). Calendar copy is drafted in batch by `dispatch`; council vetting is one debate round, not per-post.

<!-- partial: _workflow-voice.md skill_name=GrowthProgram workflow_name=CampaignCalendar action_phrase="derive the campaign set and build the dated multi-channel calendar" -->

## Inputs

- **`docs/growth/strategy.md`** (required) — the Phase 1 output. Supplies: the wedge, ICP, the per-channel mix + cadence + format-fit table, the brand voice baseline, market + locale.
- **`docs/growth/geo/recommendation-roadmap.md`** (optional but expected if the GEO pillar is in scope) — supplies the pillars (P*) and gated phases (PH*) campaigns can serve.
- **Campaign subject / cycle goal** — the wedge focus for THIS cycle (e.g., "Q3 reviews push", "launch the booking widget"). Defaults to the wedge in `strategy.md` if not narrowed.
- **Horizon** — calendar length in weeks. Default `--weeks 8`. Anchored to a real `--start <YYYY-MM-DD>` (default = next Monday).
- Optional **`--pillar-mix educate:inspire:convert`** — override the default `5:3:2` content-pillar ratio (see Step 4).
- Optional **`--seasonality <region|industry>`** — seed seasonal beats (e.g., `salons` → back-to-school, holiday party season; locale public holidays).

## Prerequisites

- **Phase 1 must have run** — `strategy.md` exists with a wedge + channel-mix table. If absent, stop and route to `BrandChannelStrategy`; do NOT invent a wedge here.
- **Composed packs (graceful degradation):**
  - **`dispatch` absent** → the calendar still ships with full structure + per-cell *content briefs* (angle, hook, CTA, asset-type), but the `copy` column reads `DRAFT-PENDING` and a `> NOTE: Dispatch unavailable — copy stubs only` banner is written at the top of `content-calendar.md`. Phase 3 (MaterialsEngine) picks up the briefs.
  - **`mem-palace` absent** → skip prior-campaign recall (Step 1.c); proceed from `strategy.md` alone.
  - **`research` absent / GEO out of scope** → omit the pillar-served `P*` references; campaigns serve only social milestones (M*). Calendar is unaffected.
  - **Council seats absent** → fall back to a single-pass authoring with the integrity checklist applied inline; mark `council: degraded` in `campaigns.md` frontmatter so reviewers know debate was skipped.
- **No publishing happens in this phase.** This workflow produces planning artifacts only. PresenceOps (Phase 4) is the only workflow that touches a publish API.

## Steps

### 1. Load the upstream contract + prior context

a. Read `docs/growth/strategy.md`. Extract into working memory: **wedge**, **ICP**, the **channel-mix table** (channel · cadence · format-fit), **brand voice** tokens, **market + locale**.

b. If `docs/growth/geo/recommendation-roadmap.md` exists, extract the **pillars (P*)** and their **gated phases (PH*)** — these become eligible `pillar(s) served` values for campaigns. Note any pillar the Skeptic gated (e.g., reviews pillar gated on a paying-customer base — Step 7).

c. Recall prior campaigns (skip if MemPalace absent):

```
Skill("mem-palace", "search wing=growthprogram room=Campaigns — prior campaigns, what worked, what was retired, for this product")
```

Use to seed `C*` numbering (append-only — never reuse a retired ID) and to avoid re-running a campaign that already failed its hypothesis.

### 2. Derive the campaign set from the wedge + pillars (Strategist seat)

Spawn the **Strategist** to convert the wedge into a ranked campaign set. The derivation is mechanical, not freeform:

```
Task(subagent_type: "growth-strategist",
  prompt: "From strategy.md wedge + ICP + channel mix and geo/recommendation-roadmap.md pillars (P*),
  derive 3-6 campaigns. For EACH: a falsifiable hypothesis, target channels (from the mix table only),
  the pillar(s) served (M* social milestone and/or P* GEO pillar), the offer, ONE success signal with a
  number+date, and a proposed owner. Rank by impact × confidence ÷ effort. Submit every market/offer
  figure to Analyst+Skeptic before it is load-bearing. Output the campaigns.md table rows.")
```

**Derivation rules (how the wedge becomes campaigns):**

| Source signal in `strategy.md` / roadmap | Yields a campaign of type | Example |
|---|---|---|
| The **wedge** itself (the one thing you uniquely win) | A **flagship** campaign — the cycle's spine | "Fastest booking widget in the niche" → `C1 Widget Wedge` |
| Each **content pillar / topic theme** in the channel mix | An **always-on** educate campaign | "Salon ops tips" → `C2 Owner Education` |
| Each **GEO pillar (P*)** not gated by the Skeptic | A **GEO-serving** campaign feeding the corpus | `P1 Comparison pages` → `C3 "vs" Corpus` |
| A dated **offer / launch / season** | A **burst** campaign with a hard start+end | "Q3 launch" → `C4 Widget Launch` |
| A **retention / reactivation** ICP segment | A **lifecycle** campaign (lower cadence, higher convert ratio) | "win back churned trials" → `C5 Reactivation` |

**Decision rule — cap the set:** more than 6 active campaigns dilutes a single-product calendar. If derivation yields >6, the Strategist merges the lowest-ranked into an "always-on" bucket or defers them to next cycle (note in `campaigns.md` Backlog).

### 3. Bind each campaign to milestones + a success signal (Strategist + Analyst)

For every `C*`, attach:
- **Milestone(s) served `M*`** — the coordination-layer milestones from Phase 7's calendar (or stub `M*` here for Phase 7 to adopt). One campaign may serve several; the calendar entry will inherit them.
- **A single success signal** — must be *one* number with a date and a measurement source the Analyst can actually pull (reach, engagement rate, GBP actions, trial starts, SoAV on a `Q*` query). Reject "raise awareness" — it is not a signal. The Analyst confirms the metric is instrumentable in Phase 6's stack before it ships.

### 4. Set the content-pillar mix ratio (Channel seat)

The calendar is governed by a **content-pillar mix** — the ratio of post *intents* across any rolling window. Default **`educate:inspire:convert = 5:3:2`** (the proven "give before you ask" balance: half the calendar teaches, ~a third builds affinity, ~a fifth sells).

| Pillar intent | What it does | Typical formats | Default share |
|---|---|---|---|
| **Educate** | Teach the ICP something useful; earns trust + GEO corpus | how-to, carousel, tip reel, comparison | 50% |
| **Inspire** | Build affinity + identity; shareable, top-of-funnel | story, BTS, UGC, customer win, founder POV | 30% |
| **Convert** | Make the ask; offer-led, bottom-of-funnel | demo, offer post, testimonial, CTA reel | 20% |

**Decision rules:**
- A **burst/launch campaign** temporarily shifts its own window toward `convert` (e.g., `2:2:6` in launch week) — but the *rolling 4-week* mix must return to baseline so the feed doesn't read as a sales channel (platform ToS + algorithm de-rank risk — Channel seat enforces).
- **GEO-serving** posts count as **educate** (they are corpus-building) and must carry a canonical on-site counterpart (the calendar links the post to the `geo/` page it amplifies).
- Per-channel format-fit from `strategy.md` overrides generic format choice (e.g., LinkedIn skews educate/inspire; TikTok skews inspire).

### 5. Lay out the dated grid (Channel seat)

Build the **date × channel** grid for the horizon. The unit of the grid is one **calendar entry** = `{date, channel, campaign C*, pillar intent, format, hook, asset-ref, copy, status}`.

a. **Place cadence first.** For each channel, stamp its posting days from the `strategy.md` cadence (e.g., IG 4×/wk, GBP 2×/wk, LinkedIn 3×/wk). This produces empty slots.

b. **Assign campaigns to slots** so that, within each rolling 4-week window, the pillar-mix ratio (Step 4) holds *per channel*. The Channel seat balances; don't let one campaign monopolize a channel.

c. **Overlay launch beats + seasonality** (Step 6) — these pin specific dates and can bump always-on posts.

d. **Draft copy in batch** via Dispatch (one call per channel-week keeps credits down):

```
Skill("dispatch", "draft platform-native copy for these N calendar entries — brand voice from strategy.md,
  per-channel length + format, the campaign hook + offer, the pillar intent. Return one copy block per
  entry keyed by calendar-entry id. DRAFTS ONLY — never publish.")
```

Each entry's `copy` cell holds the first ~80 chars + a pointer to the full draft in `materials/` (Phase 3 owns the rendered asset; this phase owns the copy + brief).

### 6. Overlay seasonality + launch beats

- **Launch beats** — a campaign with a hard date gets a **beat sequence**: `tease (T-7) → announce (T-0) → proof (T+3) → recap (T+10)`. Each beat is a calendar entry tied to the launch milestone `M*`; the Channel seat spaces them so no two beats land same-day same-channel.
- **Seasonality** — pull the locale + industry calendar (public holidays, industry seasons, platform moments like back-to-school, Black Friday). Mark seasonal windows on the grid; shift convert-heavy bursts INTO high-intent seasons and educate INTO low-season. **Locale integrity:** if the market is non-English, flag thin seasonal research as a known gap rather than extrapolating from EN (Skeptic — Step 7).

### 7. Council vet + integrity verify (Channel + Strategist + Skeptic)

One debate round. **Channel** rejects any calendar with no feedback edge, a cadence that violates platform ToS, or a pillar-mix that reads as a sales feed. **Strategist** confirms each `C*` still maps to the wedge and isn't diluting leverage. **Skeptic** runs the integrity pass (Integrity checkpoints, below). Apply outcomes, then write the two artifacts.

## Output Template

Two files. Both lead with frontmatter, cross-reference the stable-ID scheme (`C*` campaigns · `M*` milestones · `P*`/`PH*` GEO pillars/phases · `Q*` SoAV queries — append-only), and are dated + concrete. The literal structure to fill:

### `docs/growth/campaigns.md`

```markdown
---
phase: 2
artifact: campaigns
wedge: "Fastest 30-second salon booking widget in the FR market"
cycle: "2026-Q3"
pillar_mix: educate:inspire:convert = 5:3:2
council: vetted            # or: degraded (debate skipped)
generated: 2026-06-24
---

# Campaigns — 2026-Q3 cycle

**Wedge served:** Fastest 30-second salon booking widget in the FR market.
**Pillar-mix baseline (rolling 4-week, per channel):** educate 50% · inspire 30% · convert 20%.

## Overview

| ID | Campaign | Type | Channels | Serves | Pillar mix | Success signal | Owner | Status |
|----|----------|------|----------|--------|-----------|----------------|-------|--------|
| C1 | Widget Wedge | flagship | IG, TikTok, GBP | M1, P1 | 5:3:2 | 200 widget demo-clicks by 2026-08-15 | @founder | active |
| C2 | Owner Education | always-on | IG, LinkedIn | M2 | 8:2:0 | 4% IG eng-rate sustained 4 wks | @social | active |
| C3 | "vs" Corpus | GEO-serving | LinkedIn, blog | GM3, P1, PH1 | 9:1:0 | +2 SoAV pts on Q1,Q4 by 2026-09-30 | @geo | active |
| C4 | Widget Launch | burst | all | M1 | 2:2:6 (launch wk) | 60 trial starts in launch week | @founder | scheduled 2026-07-28 |
| C5 | Reactivation | lifecycle | email, GBP | M4 | 3:2:5 | reactivate 25 churned trials | @growth | active |

## C1 — Widget Wedge  (flagship)

- **Hypothesis:** Salon owners switch when shown the booking flow is sub-30s vs the incumbent's multi-screen flow. If we demo speed head-to-head, demo-clicks rise.
- **Target channels:** IG (reels), TikTok (reels), GBP (post). *(format-fit per strategy.md)*
- **Pillar(s) served:** M1 (Launch booking widget) · P1 (Comparison/"vs" corpus).
- **Offer:** Free 14-day trial, no card. Single CTA: "See the 30-second flow."
- **Success signal:** 200 widget demo-clicks by **2026-08-15** (source: GA4 event `widget_demo_click`).
- **Owner:** @founder.
- **Content-pillar mix:** 5:3:2 baseline; shifts to 2:2:6 during C4 launch week (2026-07-28..08-03).
- **Integrity notes:** speed claim "sub-30s" verified against 2026-06 internal timing log [link]; incumbent flow length **DO NOT CITE as N screens — unverified** (see verify log).

## C3 — "vs" Corpus  (GEO-serving)

- **Hypothesis:** Owners + LLMs cite the tool that owns the "X vs Y" answer. Publishing sourced comparison pages + amplifying them socially lifts Share-of-AI-Voice.
- **Target channels:** LinkedIn (educate posts), blog (canonical pages — links from calendar).
- **Pillar(s) served:** M3 (GEO corpus live) · P1 (comparison pillar) · PH1 (corpus phase 1).
- **Offer:** none (top-of-funnel / corpus). CTA = read the comparison.
- **Success signal:** +2 SoAV points on Q1 + Q4 by **2026-09-30** (source: query-basket results-log).
- **Owner:** @geo.
- **Gate:** none (comparison pillar is not customer-gated; the *reviews* pillar P2 IS — see Backlog).

## Backlog / deferred (this cycle)

| ID | Campaign | Why deferred |
|----|----------|--------------|
| C6 | Reviews Flywheel | **GATED:** reviews/corpus pillar (P2) requires a real paying-customer base; not a day-0 action (Skeptic). Revisit at 50+ paying customers. |
| C7 | Influencer seeding | Lower rank this cycle; merged into C2 always-on bucket. |
```

### `docs/growth/content-calendar.md`

```markdown
---
phase: 2
artifact: content-calendar
start: 2026-06-29        # Monday
weeks: 8
channels: [GBP, FB, IG, TikTok, LinkedIn, YouTube]
pillar_mix: educate:inspire:convert = 5:3:2
dispatch: drafted        # or: stubs-only (Dispatch unavailable)
generated: 2026-06-24
---

# Content Calendar — 2026-06-29 → 2026-08-23 (8 weeks)

**Reads with `campaigns.md`.** Every entry cites its campaign (`C*`). Pillar legend: 🟦 educate · 🟩 inspire · 🟧 convert. Status: `idea → brief → drafted → approved → scheduled`.

## Pillar-mix audit (rolling 4-week, per channel — must hold ≈ 5:3:2)

| Channel | Educate | Inspire | Convert | Verdict |
|---------|--------:|--------:|--------:|---------|
| IG      | 50%     | 31%     | 19%     | ✅ in band |
| TikTok  | 44%     | 44%     | 12%     | ⚠️ inspire-heavy (intentional: launch tease) |
| LinkedIn| 67%     | 25%     | 8%      | ✅ (educate-skew per strategy.md) |
| GBP     | 50%     | 13%     | 37%     | ⚠️ convert-heavy — Channel to rebalance wk3 |

## Week 1 — 2026-06-29 (theme: pre-launch tease)

| Date | Channel | Campaign | Pillar | Format | Hook / angle | Asset | Copy (preview → full) | Status |
|------|---------|----------|--------|--------|--------------|-------|------------------------|--------|
| 06-29 | IG | C2 | 🟦 educate | carousel | "3 booking-page mistakes losing you walk-ins" | M-IG-001 | "Mistake #1: a phone-only flow…" → materials/ig/M-IG-001.md | drafted |
| 06-29 | LinkedIn | C3 | 🟦 educate | text+image | "Acuity vs [us]: the 30-sec test" | M-LI-004 | "We timed both flows…" → materials/li/M-LI-004.md | brief |
| 06-30 | GBP | C1 | 🟧 convert | GBP post | "Book in 30 seconds — try it free" | M-GBP-002 | "No card. See the flow…" → materials/gbp/M-GBP-002.md | drafted |
| 07-01 | TikTok | C1 | 🟩 inspire | reel | "POV: a client books while you finish a cut" | M-TT-003 | (vertical, 9s) → materials/tt/M-TT-003.md | brief |
| 07-03 | IG | C1 | 🟩 inspire | reel | BTS: building the widget | M-IG-005 | "Day 4 of shipping…" → materials/ig/M-IG-005.md | idea |

## Week 5 — 2026-07-27 (LAUNCH BEAT week · C4 · mix → 2:2:6)

| Date | Channel | Campaign | Pillar | Format | Hook / angle | Asset | Beat | Status |
|------|---------|----------|--------|--------|--------------|-------|------|--------|
| 07-28 | all | C4 | 🟧 convert | announce | "The 30-second widget is live" | M-LAUNCH-001 | **T-0 announce** | scheduled |
| 07-31 | IG,TikTok | C4 | 🟧 convert | reel | live demo of the flow | M-LAUNCH-004 | **T+3 proof** | scheduled |
| 08-07 | LinkedIn,GBP | C4 | 🟦 educate | recap | "What launch week taught us" | M-LAUNCH-009 | **T+10 recap** | brief |

## Seasonality + launch beats (overlay)

| Window | Type | Effect on calendar |
|--------|------|--------------------|
| 2026-07-28 → 08-03 | **Launch beat (C4)** | mix → 2:2:6; tease (T-7 = 07-21), announce (T-0), proof (T+3), recap (T+10) |
| 2026-08-15 → 09-01 | **Rentrée (FR back-to-salon season)** | shift convert bursts in; high booking intent |
| 2026-06 EN-only seasonal data | **KNOWN GAP** | FR seasonal calendar needs a dedicated locale pass before committing Q4 budget (Skeptic) |

> NOTE (only if Dispatch unavailable): copy stubs only — `DRAFT-PENDING` in copy cells. Briefs (hook + angle + CTA + format) are complete; Phase 3 MaterialsEngine renders copy + assets.
```

**Stable-ID discipline (load-bearing):** every calendar entry cites a `C*`; every `C*` cites the `M*` and (if GEO) `P*`/`PH*` it serves and may target a `Q*`; asset refs (`M-<CHANNEL>-NNN`, `M-LAUNCH-NNN`) are the handles Phase 3 fills and Phase 6 measures. IDs are **append-only** — a retired campaign's `C*` is never reused.

## Integrity checkpoints

Owned by the **Skeptic** seat; applied to THIS phase before the two files ship:

- **Offer/stat verify (adversarial):** every load-bearing number in a campaign — offer terms, a speed/price/share claim, a competitor figure used in a "vs" angle — gets an independent refute-pass against a primary source. Confirmed → keep with inline source. Refuted/unverifiable → moved to an explicit `> DO NOT CITE — unverified` block; it may inform intuition but **never** becomes a calendar hook or a campaign's load-bearing claim. (This is what refuted 5 figures in `altyaa-turbo#251`.)
- **No fabricated social proof:** a convert post may NOT cite a review count, rating, or "#1" claim that isn't substantiated. **No fake/incentivized reviews** (FTC Consumer Review Rule + platform ToS). A testimonial in the calendar must trace to a real, consented customer.
- **No `AggregateRating`/`Review` schema** referenced by any GEO-serving calendar entry unless backed by verified real data.
- **Sequencing gate:** any campaign whose hypothesis depends on review density / a customer corpus is **gated on a real paying-customer base** — it lands in Backlog with the gate stated, never as a week-1 entry.
- **Brand voice + ToS:** every drafted copy block respects the `strategy.md` voice tokens and the per-platform ToS (cadence limits, promo rules, link policies). The Channel seat blocks a calendar whose pillar-mix reads as a pure sales feed.
- **Locale integrity:** non-English market + thin locale/seasonal research → flagged as a **KNOWN GAP** in the seasonality overlay; do not extrapolate seasonal beats from EN data.
- **Definition of done:** calendar is **dated and per-channel** (not a vague plan); the pillar-mix audit table is present and every channel is in-band or has a stated, intentional exception; every entry resolves to a `C*` that resolves to the wedge.

## Worked example

> "Give me the campaign set + a dated 8-week multi-channel calendar for the Q3 booking-widget push — French-first salons."

1. **Load** `strategy.md` → wedge = "fastest 30-second FR salon booking widget"; channel mix = IG 4×/wk, TikTok 3×/wk, GBP 2×/wk, LinkedIn 3×/wk. `geo/recommendation-roadmap.md` → P1 comparison pillar (open), P2 reviews pillar (**gated**). MemPalace recall → no prior campaigns; start IDs at `C1`.
2. **Derive (Strategist):** wedge → `C1 Widget Wedge` (flagship); education theme → `C2 Owner Education` (always-on); P1 → `C3 "vs" Corpus` (GEO-serving); the Q3 launch date → `C4 Widget Launch` (burst); churned-trial segment → `C5 Reactivation` (lifecycle). P2 → `C6 Reviews Flywheel` derived but **gated → Backlog**. Six active capped at five; C7 influencer idea merged into C2.
3. **Bind (Strategist+Analyst):** C1→M1+P1, signal "200 demo-clicks by 08-15 (GA4)"; C3→M3+P1+PH1, signal "+2 SoAV on Q1,Q4 by 09-30 (query-basket log)". Analyst confirms both metrics are instrumentable.
4. **Mix (Channel):** baseline 5:3:2; C4 launch week → 2:2:6 with rolling-4wk return to baseline.
5. **Grid (Channel):** stamp cadence → assign campaigns so per-channel rolling mix holds → Dispatch drafts copy per channel-week → pillar-mix audit shows GBP convert-heavy in wk3, Channel rebalances.
6. **Overlay:** C4 launch beats (tease 07-21 → announce 07-28 → proof 07-31 → recap 08-07); FR rentrée season flagged 08-15→09-01; EN-only seasonal data flagged **KNOWN GAP**.
7. **Vet+verify (council):** Skeptic moves the unverified "incumbent = N screens" figure to a `DO NOT CITE` block (the speed claim survives, sourced to the internal timing log); confirms C6 stays gated. Write `campaigns.md` + `content-calendar.md`.

**Result:** five active campaigns, one gated/backlogged, an 8-week dated grid across five channels with a passing pillar-mix audit, launch beats pinned, locale gap surfaced, and every hook tracing to a verified claim — handed to Phase 3 (MaterialsEngine) which renders the `M-*` assets and to Phase 7 (Coordination) which keys RACI off `C*`. Nothing published.
