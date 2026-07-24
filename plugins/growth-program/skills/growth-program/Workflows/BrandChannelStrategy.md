---
name: BrandChannelStrategy
description: Phase 1 — establish brand voice + visual tokens, an ICP framework, a channel-selection decision matrix, per-channel cadence rationale, and the wedge/positioning-axis table. Writes strategy.md.
status: STABLE
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Bespoke Output section with workflow-specific shape (growth-program 7-phase pipeline emits per-phase document sets, not the canonical output shape)"
    rationale_link: null
bestPath:
  - title: "Baseline Recall"
    description: "Recall prior brand/ICP/channel decisions and locate or extract the brand voice + token baseline."
  - title: "Voice & Token Lock"
    description: "Distill the 5-trait brand voice and lock the visual token set that downstream phases bind to."
  - title: "ICP & Channel Matrix"
    description: "Define ICP segments and score each candidate channel into SELECT/HOLD/CUT with cadence rationale."
  - title: "Wedge & Integrity Gate"
    description: "State the positioning wedge against incumbents and run the council + Skeptic verify pass before writing strategy.md."
---

# BrandChannelStrategy Workflow

## When to Use
- Trigger phrases: "brand + channel strategy", "which platforms", "channel mix".
- Situation: first phase of a growth program — no `strategy.md` exists yet, or existing brand/channel decisions need re-deriving for a new subject.
- NOT for choosing daily content topics or dates (use `CampaignCalendar`) or GEO/AEO answer-engine strategy (use `GeoPillar`) — this phase only sets the wedge and channel mix those phases inherit.

**Purpose:** The spine of the program. Establish (or extract) the brand voice + visual tokens, an
ICP framework (segments × jobs-to-be-done × where they are), a CHANNEL-SELECTION decision matrix
(which of GBP/FB/IG/TikTok/LinkedIn/YouTube for which ICP × market × locale, with rationale), a
cadence-setting rationale per chosen channel, and the WEDGE — the one positioning axis the product
owns versus incumbents. Everything downstream (campaigns C*, calendar, materials, GEO answer-targets,
measurement baselines) cites this file. Phase 1 produces `docs/growth/strategy.md`.

**Budget:** ~8–15 min, ~1–4 credits. Add ~3–8 credits if a brand baseline must be *extracted* (Brand
pack 9-agent research) rather than read from an existing DESIGN.md / token spec; add a dedicated
deep-research pass (~5 credits) if the primary market is non-English and locale data is thin.

## Inputs
- `subject` — the campaign subject / wedge hypothesis (required; passed from RunProgram).
- **Project-knowledge brief** — from RunProgram Step 1 (Sentinel repo/SEO baseline + MemPalace recall +
  brand assets). Contains: product one-liner, repo URL, any `DESIGN.md`/brand-token-spec, prior decisions.
- **Preset** (optional) — `Presets/{b2b-saas-global,local-smb-french,dtc-ecommerce,…}.yaml`. Supplies
  default `channels`, `cadence`, `locale`, `market`, `wedge_hint`, `geo.engines`, `integrity` rules.
  A preset is a *starting hypothesis*, never the answer — every cell is re-derived against this product.
- **Operator answers** (only if not derivable): primary ICP, target market + locale, pricing posture,
  any hard channel constraints (e.g. "no TikTok — regulated industry").

## Prerequisites (+ graceful degradation when a composed pack is absent)
| Composed pack | Used for | If absent → degrade to |
|---|---|---|
| **Brand** | Voice extraction (`Verbal/VoiceGuide`), visual tokens (`Implementation/TokenSpec`), or full 9-agent `BrandResearch` when no baseline exists | Read `DESIGN.md` / `brand-token-spec.md` directly; if neither exists, hand-derive a **provisional** 5-trait voice + token table from the landing page and mark it `> PROVISIONAL — Brand pass deferred`. |
| **Sentinel** | Repo + on-page SEO/positioning baseline, current copy voice, locale signals in the project-knowledge brief | Skip the repo-derived voice cross-check; ask the operator for the product one-liner + 3 representative copy samples instead. |
| **MemPalace** | Recall prior brand/ICP/channel decisions so Phase 1 doesn't contradict shipped truth (`mempalace_search`, `kg_query`) | Proceed without recall; add a `> No memory recall — verify against prior decisions manually` note in the Provenance block. |
| **Council seats** (`growth-strategist`, `growth-channel`, `growth-creative`, `growth-skeptic`) | Wedge vet · channel-matrix vet · voice/token vet · integrity verify | Run single-voice; record `council: degraded (single-voice)` in the Provenance block so the conductor knows the gate was thinner. |

The **Skeptic** seat is non-negotiable even in degraded mode — the integrity guard
(`References/integrity-guard.md`) runs on every load-bearing competitor/market figure in this file.

## Steps

### 1. Recall + resolve the baseline (don't re-derive what's already true)
1a. **Memory recall.** `mempalace_search` for "{product} brand voice", "{product} ICP", "{product}
channel"; `kg_query` for any `decided`/`positioned_as` facts. Surface conflicts with `subject` to the
operator before proceeding — a Phase-1 file that contradicts a shipped decision is a defect.
1b. **Locate the brand baseline.** Glob the repo for `DESIGN.md`, `brand-tokens.json` (canonical DTCG), `brand-token-spec.md`,
`brand-voice*.md`. Decision rule:
- Baseline exists + current → **read it**, do not re-run Brand.
- Baseline exists but stale/thin → `brand` → `Audit` (score it), then patch the gaps only.
- No baseline → `brand` → `BrandResearch` (9-agent) → `Verbal/VoiceGuide` + `Implementation/TokenSpec`.
- brand pack absent → degrade per the table above (provisional, flagged).

### 2. Establish the brand voice (5 traits, each with a do/don't) — Creative seat owns
2a. Distill voice into **exactly 5 traits**, each a one-word axis + a sentence + a *do* and a *don't*
example string (the do/don't pair is what makes it operable for the materials engine, not decorative).
2b. Capture **3 banned moves** (e.g. "no hype superlatives", "no emoji in headlines") and the
reading-grade target. These become hard lints in Phase 3 (`MaterialsEngine`).
2c. Creative seat veto: any trait without a contrasting do/don't is rejected as unusable.

### 3. Lock the visual tokens (the brand-locked surface the materials engine reuses)
Pull the **decision-layer** tokens (not raw option values) — read them from the canonical `brand-tokens.json` (DTCG decision-layer groups) when present, else from `brand-token-spec.md`: primary/secondary/accent,
foreground/background, the type pairing (display + body), and any motion/stage tokens. Record the logo
path + safe-area + the one-line usage rule. If extracted provisionally, mark every token cell
`(provisional)`. These tokens are the contract Phase 3 templates and Phase 5 GEO pages bind to.

### 4. Build the ICP framework (segments × JTBD × where-they-are) — Strategist + Channel seats
4a. Define **2–4 ICP segments** (`ICP1…ICPn`). For each: a named persona, the **job-to-be-done**
(Christensen framing — "when [situation], I want to [motivation], so I can [outcome]"), the trigger
moment, the buying objection, and — load-bearing for Step 5 — **where they actually are** (which
platforms, which communities, which search/answer surfaces), each with a *source or "assumed"* tag.
4b. Mark the **primary** ICP (the wedge's bullseye). Channel placement in Step 5 optimizes for primary
first; secondary ICPs get coverage, not the cadence peak.
4c. Skeptic check: any "where they are" cell asserted as fact (not "assumed") must have a source, or it
drops to `> DO NOT CITE — unverified` and is treated as an assumption downstream.

### 5. Channel-selection decision matrix (the heart of Phase 1) — Channel seat owns, Strategist vets
5a. Start from the preset's `channels` as a hypothesis. For **each** of the six candidate channels
(GBP, FB, IG, TikTok, LinkedIn, YouTube — plus any preset extras like X / blog-newsletter / GitHub),
score fit on a fixed rubric so the SELECT/HOLD/CUT verdict is defensible, not vibes:
- **ICP-fit** — does the primary ICP live here? (cite the Step-4 "where they are" cell)
- **Format-fit** — does the brand's signature format (Step 2 + preset `signature_formats`) thrive here?
- **Market/locale-fit** — is the channel load-bearing in this market? (e.g. **GBP is non-negotiable
  for local discovery; Le Chat/TikTok skew by locale**) — cite the locale signal.
- **Effort/ROI** — production cost vs. expected reach for *this* team.
5b. Decision rule → **SELECT** (ICP-fit yes AND (format-fit yes OR market-fit non-negotiable)) ·
**HOLD** (promising but gated on a later milestone / customer base) · **CUT** (with the one-line reason).
A channel a council seat wants to CUT but the operator insists on stays as HOLD with the dissent recorded.
5c. Channel seat rejects any matrix with no live-ops implication; Strategist rejects any SELECT that
doesn't serve the primary ICP or the wedge.

### 6. Cadence rationale per SELECTED channel — Channel seat owns
For every SELECT, set a cadence (posts/week) **with a one-line *why*** — tie it to the platform's
algorithm reality and the team's sustainable output, not a round number. Distinguish the **anchor
channel** (highest cadence, where the audience concentrates) from **amplifier channels** (repurpose the
anchor). State the minimum sustainable floor — the cadence the program can hold for 12 weeks without
burning the team — because Phase 2's calendar inherits these numbers exactly.

### 7. State the wedge (the positioning-axis table) — Strategist owns, Skeptic verifies
7a. Name the **wedge** in one sentence: the single axis the product uniquely wins. Pull the
preset `wedge_hint` as a prompt, then sharpen it against the real product + ICP.
7b. Build the **WEDGE / positioning-axis table** (the `#251` shape): rows = the 4–6 axes buyers compare
on; columns = **this product** vs. 2–3 named incumbents. Mark each cell, and mark the **one row** that
is the wedge (where this product is the only ✓). Every competitor claim is a load-bearing figure → it
goes through the Skeptic's refute pass; unverifiable claims drop to a `> DO NOT CITE` block and never
appear in the comparison cells.

### 8. Council gate + integrity verify + write
Run the 3-round council pass on Steps 5 + 7 (the contested ones). The Skeptic runs the integrity guard
over every competitor/market/locale figure. Resolve tensions, record dissents, then write
`docs/growth/strategy.md` per the Output Template. Log to `MEMORY/ARTIFACTS/artifacts.jsonl`
(pack: GrowthProgram, workflow: BrandChannelStrategy, type: strategy, path: docs/growth/strategy.md).

## Output Template

> The literal structure of `docs/growth/strategy.md`. Fill every cell. Stable IDs are append-only and
> referenced by every downstream phase. Example rows are illustrative (a French local-SMB salon tool).

```markdown
# Growth Strategy — {Product}
<!-- phase: 1 · subject: {subject} · generated: {date} · preset: {preset|none} -->

## 0. Wedge (one sentence)
**{Product} is the only {category} that {the one axis you uniquely win}.**
> e.g. "Bookly is the only salon tool that turns every booking into a verified Google review — the
> two things a local salon actually lives or dies on, in one loop."

## 1. Brand Voice
| Trait | Means | Do (example) | Don't (example) |
|---|---|---|---|
| Plainspoken | No jargon, short sentences | "Book in 10 seconds." | "Leverage our scheduling paradigm." |
| Warm | Talks to a person, not a segment | "We've got your Saturday rush covered." | "Optimize peak-hour throughput." |
| Confident | States outcomes, no hedging | "You'll fill the empty chairs." | "We think this might help maybe." |
| Local | Speaks the market's idiom (fr-FR) | "Votre salon, complet." | Translated-from-EN stiffness |
| Proof-led | Leads with the number, sourced | "+18% rebookings (Pilot salons, n=12)" | "Tons of salons love us!" |

**Banned moves:** hype superlatives ("revolutionary") · emoji in headlines · unsourced "studies show".
**Reading grade:** ≤ 7 (fr-FR equivalent). **Voice source:** `Brand/Verbal/VoiceGuide` 2026-06-20.

## 2. Visual Tokens (brand-locked — materials + GEO pages bind here)
| Token | Value | Usage |
|---|---|---|
| color.primary | `#0F5C4E` | CTAs, links, logo mark |
| color.accent | `#E8B04B` | Highlights, review stars |
| color.bg / fg | `#FFFFFF` / `#142019` | Surfaces / body text |
| type.display / body | "Fraunces" / "Inter" | Headlines / running text |
| logo | `assets/bookly-mark.svg` | Clear-space = 1× mark height; never on `accent` |
> Source: `brand-tokens.json` (canonical DTCG decision layer) or `brand-token-spec.md`. Mark cells `(provisional)` if hand-derived.

## 3. ICP Framework
| ID | Persona | Job-to-be-done (when… / want… / so…) | Trigger | Top objection | Where they are (source\|assumed) |
|---|---|---|---|---|---|
| **ICP1** *(primary)* | Independent salon owner, 1–3 chairs | when my chair sits empty, I want to fill it fast & get reviews, so I rank on Maps | A no-show / a slow week | "I don't have time to learn software" | **GBP** (Maps is how clients find salons — assumed-strong), **Instagram** (local salon community — source: hashtag vol), **TikTok** (FR beauty — source) |
| ICP2 | Small chain mgr (3–8 salons) | when I can't see all locations, I want one dashboard, so I cut admin | Opening a 2nd location | "Will it sync my existing calendar?" | **LinkedIn** (B2B — assumed), **Facebook** (local ops groups) |

**Primary ICP = ICP1.** Cadence peak optimizes for ICP1; ICP2 gets coverage, not the peak.

## 4. Channel-Selection Decision Matrix
| Channel | ICP-fit | Format-fit | Market/Locale-fit | Effort/ROI | **Verdict** | Rationale (one line) |
|---|---|---|---|---|---|---|
| **GBP** | ICP1 ✓✓ | Posts + reviews + Q&A | **Non-negotiable** (local discovery, fr-FR) | Low effort, high ROI | **SELECT (anchor)** | This is where salons get found; reviews loop lives here |
| Instagram | ICP1 ✓ | Reels + carousels fit "before/after" | Strong (FR beauty) | Med effort, high ROI | **SELECT** | Visual proof format thrives; ICP1 community |
| TikTok | ICP1 ✓ | Short vertical fits owner-POV | Strong (FR beauty skews young) | High effort | **SELECT** | Reach upside; repurpose IG reels to cap cost |
| Facebook | ICP1/ICP2 ~ | Events + local groups | Moderate (older FR local) | Low (repurpose) | **SELECT (amplifier)** | Cheap reuse of IG; local-group reach |
| LinkedIn | ICP2 ✓ | Founder POV + chain case studies | B2B only | Med | **HOLD** | Gated on ICP2 push (M-later); not day-0 |
| YouTube | ICP1 ~ | Long demo | Weak for discovery here | High | **CUT** | Production cost ≫ reach for a local SMB; revisit at scale |
| Le Chat (note) | — | — | FR-native (Mistral) | — | *(GEO surface, not a post channel — see geo/)* | Tracked in Phase 5, not posted to |

## 5. Cadence (inherited verbatim by the Phase-2 calendar)
| Channel | Cadence | Why | Role |
|---|---|---|---|
| GBP | 2/week | Posts decay fast; 2× keeps the profile "active" for ranking | **anchor** |
| Instagram | 4/week | Reels reward consistency; 4× is the sustainable floor for 1 person | anchor (visual) |
| TikTok | 3/week | Repurpose 3 of the 4 IG reels — near-zero marginal cost | amplifier |
| Facebook | 3/week | Cross-post IG + 1 local-group native post | amplifier |
| LinkedIn | (held) | Starts at M-{n} when ICP2 campaign opens | — |
**Minimum sustainable floor (12-week hold):** GBP 2 · IG 4 · TikTok 3 · FB 3 = 12 posts/week, ~80% repurposed.

## 6. WEDGE / Positioning-Axis Table
| Axis | **Bookly** | Incumbent A (Planity) | Incumbent B (Treatwell) | Generic calendar |
|---|---|---|---|---|
| Online booking | ✓ | ✓ | ✓ | ~ |
| **Booking → verified Google review loop** | **✓ (only)** ⭐ | ✗ | ✗ | ✗ |
| No-show / SMS reminders | ✓ | ✓ | ✓ | ✗ |
| Published price (no "request demo") | ✓ | ✗ | ✗ | ✓ |
| fr-FR + RGPD-native | ✓ | ✓ | ~ | varies |
| Marketplace lead-gen | ✗ | ~ | ✓ | ✗ |
**Wedge row = "Booking → verified Google review loop" (⭐).** Competitor claims verified 2026-06-20
against product pages; see Provenance. The "marketplace lead-gen ✗" is an honest non-claim, not a gap to hide.

## 7. Provenance & Integrity
- **Sources:** [competitor matrix] Planity/Treatwell public pricing+feature pages (accessed {date});
  [ICP1 "where"] FR salon hashtag volume (Instagram, {date}); [voice] Brand/VoiceGuide run {id}.
- **Council:** 5-seat, 3-round · dissents: {Channel wanted YouTube CUT, operator HOLD — recorded as HOLD}.
- **Memory recall:** {n} prior decisions checked, 0 conflicts | or "degraded (no MemPalace)".
- **Known gaps:** ICP1 TikTok reach figure unconfirmed → see DO-NOT-CITE block.

> DO NOT CITE — unverified
> - "FR salons see 30% more bookings with online reviews" — no primary source located; informs
>   intuition only, MUST NOT appear in any campaign, page, or measurement baseline.
```

## Integrity checkpoints (this phase, owned by the Skeptic seat)
- **Every competitor cell in the WEDGE table is a load-bearing claim.** Each ✓/✗ for an incumbent is
  verified against that incumbent's own primary source (pricing/feature page) on a dated access. Refuted
  or unverifiable → the cell becomes `~`/`?` and the claim moves to the `> DO NOT CITE` block. No
  competitor FUD: state honest non-claims (the "marketplace ✗" row) rather than implying a weakness.
- **Market / ICP figures are sourced or labeled "assumed".** Any "where they are" or market-size number
  asserted as fact needs an inline source; otherwise it ships tagged `assumed` and is treated as a
  hypothesis by every downstream phase (it cannot anchor a measurement baseline).
- **No review/rating claims here.** Phase 1 never asserts review counts or stars, and never proposes
  `AggregateRating`/`Review` schema — that is FTC + structured-data territory gated on a real
  paying-customer base (deferred to GEO Phase 5, surfaced there as a blocker, not a day-0 task).
- **Locale integrity.** If the market is non-English and the locale research is thin, the channel matrix
  + cadence ship flagged `> locale research thin — deep-research pass required before locale budget`;
  never extrapolate EN channel behavior onto a non-EN market.
- **Brand-voice honesty.** A *provisional* (hand-derived) voice or token set is marked provisional in
  every cell so Phase 3 knows it is binding a draft contract, not a Brand-pack-verified one.

## Worked example
**Subject:** "Be the default booking + reputation tool for local salons in France, French-first."

1. **Recall** — `mempalace_search "salon booking ICP"` → 0 prior decisions (greenfield). Locale = fr-FR.
2. **Baseline** — no `DESIGN.md`; run `Brand → BrandResearch` → voice (5 traits, Plainspoken/Warm/
   Confident/Local/Proof-led) + tokens (forest-green primary, gold accent, Fraunces/Inter).
3. **ICP** — Strategist + Channel derive ICP1 *independent salon owner* (primary) + ICP2 *small-chain
   manager*. ICP1's bullseye job: "fill empty chairs + earn reviews so I rank on Maps." Where: GBP, IG,
   TikTok.
4. **Channel matrix** — GBP **SELECT (anchor)** — non-negotiable for local discovery; IG/TikTok/FB
   SELECT; LinkedIn **HOLD** (gated on the ICP2 push); YouTube **CUT** (production cost ≫ reach for a
   local SMB). Channel seat flags Le Chat as a GEO surface for Phase 5, not a post channel.
5. **Cadence** — GBP 2 · IG 4 · TikTok 3 · FB 3 = 12/week, ~80% repurposed from the IG anchor — the
   sustainable floor a single owner can hold for a quarter.
6. **Wedge** — "the only salon tool with a booking → verified Google review loop." WEDGE table built vs.
   Planity + Treatwell; the review-loop row is the only all-✓ row → marked ⭐.
7. **Integrity** — Skeptic refutes a floating "30% more bookings with reviews" stat (no source) → moved
   to `> DO NOT CITE`. Planity/Treatwell feature cells verified against their pricing pages, dated.
8. **Write** `docs/growth/strategy.md`. Phase 2 (`CampaignCalendar`) reads it: the 12/week cadence and
   the SELECT channels become the calendar grid; the wedge becomes campaign **C1**'s hypothesis; ICP1
   becomes C1's target; the HOLD on LinkedIn becomes a milestone (**M-{n}**) in coordination.
