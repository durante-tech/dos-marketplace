---
name: Measurement
description: Phase 6 — the measurement harness (social insights + Share-of-AI-Voice), both lenses, one feedback edge
status: STABLE
bestPath:
  - title: "Scope the Metric Set"
    description: "Select KPIs from the canonical set that match the actual live channel mix — no vanity metrics."
  - title: "Lens A — Social Insights"
    description: "Pull reach/engagement/follower/GBP metrics via social-media and lay out the dashboard."
  - title: "Lens B — Share-of-AI-Voice"
    description: "Run the Q* query basket across AI engines per-engine, per-language, and wire GA4 AI-referral capture."
  - title: "Verify & Persist"
    description: "Run the Skeptic adversarial pass over every stat, then persist the verified SoAV headline to the knowledge graph."
---

# Measurement Workflow

## When to Use
- Trigger phrases: "measure", "social insights", "SoAV", "what's working".
- Situation: the program's presence and/or GEO pillar are live and need a recurring, sourced feedback harness covering both social insights and Share-of-AI-Voice.
- NOT for building the SoAV query basket itself (that's `GeoPillar`'s `query-basket.md`) — Measurement runs and scores the existing basket.

**Purpose:** Build the program's feedback edge — ONE harness with TWO lenses. Lens A (social
insights) reports whether presence is working: reach, engagement rate, follower growth, GBP actions,
saves/shares, conversion, pulled via `social-media`. Lens B (Share-of-AI-Voice) reports whether the
GEO pillar is winning: run the Q* basket across the AI engines on a cadence, score
presence/sentiment/citation, capture AI referrals in GA4, and log the trend. The Analyst owns the
numbers; the Skeptic refutes every unsourced figure into a DO NOT CITE block before it ships.

**Budget:** ~45-75 min wall-clock for the first build (baseline pulls + the manual Q* run dominate).
Credits: `social-media` insight pulls are API calls (low cost) + 1 `research` standard pass for the
SoAV tooling/benchmark scan + the manual Q* run is operator-time, not credits. Recurring runs after
the harness exists: ~15 min social pull + ~30 min Q* run per cadence tick.

## Inputs
- `campaigns.md` — the campaign set (C*); social KPIs key off each C*.
- `geo/query-basket.md` — the Q* SoAV seed queries (EN + locale) from GeoPillar.
- `geo/recommendation-roadmap.md` — the GEO pillars (P*) + gated sequencing (PH*), so SoAV deltas map
  back to the workstream that should move them.
- `strategy.md` — the channel mix + the wedge, so the KPI set matches the channels that actually exist.
- **Connected accounts** — FB Page / IG Business / LinkedIn / GBP tokens (for Lens A); GA4 property
  + a configured custom channel group (for the Lens B AI-referral capture).

## Prerequisites (+ graceful degradation)
| Composed pack | Used for | If absent — degrade to |
|---|---|---|
| `social-media` | Pull FB/IG insights + GBP actions via Graph API; LinkedIn analytics | Emit the dashboard layout + metric defs as a **manual-fill template**; cite the native UI path per platform (Meta Business Suite > Insights, LinkedIn page Analytics, GBP Performance). Mark every cell `[manual]`. |
| `research` | Scan the verified SoAV tool stack + AI-search benchmark figures | Ship the tool stack as a **vendor-claims table flagged unverified**; Skeptic forces a `> DO NOT CITE` on any pricing/coverage number not confirmed against the vendor's own docs. |
| GA4 access | AI-referral channel capture (Lens B web side) | Lens B runs on the **manual Q* log alone**; the referral table ships as a setup recipe with `[not yet wired]` baseline rows — never invented traffic numbers. |
| `mem-palace` | Recall prior baselines for trend continuity | First run becomes the baseline (T0); the trend columns ship empty with a "first observation" note instead of fabricated priors. |

If a platform is not in the channel mix (`strategy.md`), **omit its KPI rows entirely** — do not pad
the dashboard with channels the program doesn't run.

## Steps

1. **Scope the metric set to the actual channel mix.** Read `strategy.md` channel mix + `campaigns.md`
   C* list. For each live channel, select KPIs from the canonical set below; drop the rest. Decision
   rule: a KPI ships only if (a) the channel exposes it via API/native and (b) it ties to a campaign
   success signal or the wedge. No vanity metric without a downstream decision attached.
   - **Reach / impressions** (all channels) · **Engagement rate** (eng ÷ reach, per platform formula) ·
     **Follower / audience growth** (net new ÷ period) · **GBP actions** (calls, direction requests,
     website clicks, bookings) · **Saves + shares** (IG/TikTok — the intent signal) ·
     **Conversion** (clicks → the campaign's defined action: signup/booking/lead).

2. **Lens A — pull social insights via `social-media`.** For each live channel, invoke `social-media`
   analytics:
   - FB Page + IG Business → `social-media` "facebook insights" / "instagram insights" (Graph v24.0):
     `page/insights` metrics `page_impressions`, `page_post_engagements`, `page_fan_adds`; IG media
     `insights` for `reach`, `saved`, `shares`, `total_interactions`.
     ```
     SocialMedia: instagram insights — period last_28d, metrics [reach, saved, shares, total_interactions, follower_count]
     ```
   - LinkedIn → `social-media` "linkedin analytics" (`/rest/organizationPageStatistics` + share
     statistics): impressions, engagement, follower delta.
   - GBP → pull Performance API actions (calls / directions / website / bookings). If `social-media`
     lacks the GBP surface, cite the GBP Performance native path and mark `[manual]`.
   - Decision rule: every pulled number gets a **timestamp + period** in the cell (e.g. `last_28d @
     2026-06-24`). A bare number with no window is treated as unsourced and routed to the Skeptic.

3. **Lens A — lay out the dashboard.** Compose the metric set into the dashboard layout (see Output
   Template §2). One row per (channel × KPI), with: baseline (T0), latest, Δ vs prior period, target,
   and the C* it serves. Add the cross-channel summary tiles (total reach, blended eng rate, net
   follower growth, conversions-to-date). The dashboard is the operator's weekly read.

4. **Lens B — define the SoAV methodology + run the Q* basket.** This is the GEO feedback edge.
   - **Engines:** ChatGPT, Perplexity, Gemini, Claude, Le Chat (+ Google AI Overviews if in-market).
     Run EN + the primary locale separately — never extrapolate locale from EN (locale-integrity rule).
   - **Run protocol:** for each Q* × each engine, issue the query in a fresh/logged-out session (no
     personalization bleed), capture the verbatim answer. Score three axes:
     - **Presence** (0/1): is the subject brand named at all in the answer?
     - **Rank/position**: where in the list (1st / top-3 / mentioned / absent)?
     - **Sentiment** (pos/neutral/neg): how is it characterized?
     - **Citation** (0/1 + source): did the engine link a source, and is it ours or a third party?
   - **Score → SoAV:** Share-of-AI-Voice for a query = (subject mentions) ÷ (total distinct brands
     named). Roll up per-engine and a blended basket SoAV %.
   - Decision rule: log the **verbatim snippet** behind every score so the Skeptic can re-derive it; a
     score with no snippet is inadmissible.

5. **Lens B — wire GA4 AI-referral capture.** Set up the web side so AI-driven traffic is
   attributable:
   - Create a **custom channel group** "AI Assistants" in GA4 Admin → Channel groups, with a Source
     match list: `chatgpt.com`, `chat.openai.com`, `perplexity.ai`, `gemini.google.com`,
     `claude.ai`, `copilot.microsoft.com` (referral) + the `utm_source=chatgpt`-style tags where the
     engine passes them.
   - Build an exploration / looker tile: sessions + conversions where channel group = AI Assistants,
     segmented by landing page (which answer-target P* page is catching the referral).
   - Decision rule: if GA4 isn't wired yet, ship the recipe with `[not yet wired]` baseline rows. Do
     NOT invent referral counts — that is a fabricated-stat violation.

6. **Lens B — assemble the verified tool stack + the baseline-with-sources table.** Run a `research`
   standard pass on the SoAV / GEO-monitoring tool landscape; for each tool record what it measures,
   coverage (which engines), price, and the source for the claim. Then build the **baseline table**:
   one row per Q* with the T0 score per engine, each cell carrying its source/snippet ref.
   - Decision rule (Skeptic-owned): a tool's coverage/price cell that can't be confirmed against the
     vendor's own current docs goes to `> DO NOT CITE — unverified`; a benchmark figure ("X% of
     searches now AI") with no primary source is refuted, not softened.

7. **Set the recurring run cadence + the Definition-of-Winning hook.** Define how often each lens runs
   and who owns the tick:
   - Lens A (social): **weekly** pull, fed back into `content-calendar.md` (kill underperformers,
     double down on winners) — the PresenceOps feedback edge.
   - Lens B (SoAV): **monthly** Q* run (the basket is too expensive in operator-time for weekly) +
     **quarterly** deep re-baseline. GA4 AI-referral is **continuous** once wired.
   - Tie the top-line numbers to the single Definition-of-Winning check in `coordination.md` (e.g.
     "blended basket SoAV ≥ X% AND AI-referral conversions trending up").

8. **Adversarial verify pass (Skeptic).** Before the file ships, the Skeptic runs the integrity guard
   over EVERY load-bearing number: tool-stack claims, benchmark stats, baseline scores, referral
   counts. Confirmed → keep with source. Refuted/unverifiable → DO NOT CITE block. Any unsourced stat
   is a ship blocker (Skeptic has veto). Verdict logged in the file footer.

9. **Persist the verified SoAV to the KG (durability + trend continuity).** Once the Skeptic verdict is
   **SHIP**, write the blended basket SoAV as one canonical `share_of_ai_voice` KG fact via `mem-palace`.
   **GrowthProgram Measurement (Analyst seat) is the single-writer / source of truth for
   `share_of_ai_voice`** (canonical predicate ratified in PREDICATES.md §1.8, RFC-0140) — no other
   component emits this predicate. Persist the **Skeptic-verified** headline number only; never write the
   raw `SoAVRun --score` stdout before the integrity pass. Subject = the program subject (the brand/product
   the program runs for — use its `project:<uuid>` anchor if the program is tied to a TELOS project, else
   the canonical brand/product name); object = the blended basket SoAV as a plain number (the §3 headline,
   e.g. `34` for 34%); `valid_from` = the run date.
   ```
   mcp__mempalace__mempalace_kg_add({
     subject: "[program subject — brand/product or project:<uuid>]",
     predicate: "share_of_ai_voice",
     object: "[blended basket SoAV as a number, e.g. 34]",
     valid_from: "[YYYY-MM-DD run date]"
   })
   ```
   KG facts are temporal: each new run's fact supersedes the prior one, so the full SoAV trend (with
   `valid_from` timestamps) stays reconstructable via `kg_timeline` / `kg_query_predicate` — this is the
   write half that makes the Prerequisites "recall prior baselines for trend continuity" row actually
   resolve (a later run can only recall a baseline a prior run wrote). Write only when a fresh run produced
   a new measurement; if `mem-palace` is absent, skip — this run is the baseline (T0), per the degradation
   table. (Optionally split per locale into separate facts when locale-level trend tracking is needed; the
   blended basket figure is the canonical one.)

## Tooling — SoAVRun

The Lens-B Q* run is operated via `~/.claude/skills/growth-program/Tools/SoAVRun.ts` (it scaffolds + scores; it does NOT call the
engines — the run is operator-time across logged-out sessions, per Step 4):
```bash
bun ~/.claude/skills/growth-program/Tools/SoAVRun.ts --scaffold --basket docs/growth/geo/query-basket.md --out soav-results.jsonl  # 1) make the log
# 2) fill present/rank/sentiment/cited/total_brands/source/snippet from logged-out engine runs
bun ~/.claude/skills/growth-program/Tools/SoAVRun.ts --score soav-results.jsonl                                                     # 3) scoreboard
```

## Intent-to-Flag Mapping

| Intent | Flag |
|---|---|
| "set up / scaffold the SoAV log" | `--scaffold --basket <query-basket.md\|.jsonl>` |
| "only these engines" | `--engines chatgpt,perplexity,…` |
| "score the filled log" | `--score <soav-results.jsonl>` |
| "write the log to `<path>`" | `--out <path>` |

## Output Template

> Write to `docs/growth/measurement.md`. This is the literal structure. Keep the stable IDs
> (`Q*` SoAV queries, `C*` campaigns) so the file cross-references the rest of the program.
> Every number carries a **source/period cell**; unverifiable figures live ONLY in DO NOT CITE blocks.

```markdown
# Measurement — <Subject>

> Two lenses, one harness. Lens A = social presence is working. Lens B = the GEO pillar is winning.
> Owner: Analyst seat. Integrity: Skeptic seat (verdict in footer).
> Channel mix scoped to `strategy.md`. SoAV keys off `geo/query-basket.md` (Q*). Social keys off `campaigns.md` (C*).
> Baseline observed: T0 = 2026-06-24 · Locale(s): EN + fr-FR

## 0. How to read this file
- **Δ** columns compare latest period vs prior period of the same length.
- A cell with no `[source @ date]` is **inadmissible** — it has been moved to a DO NOT CITE block.
- `[manual]` = pulled from native UI (no API surface). `[not yet wired]` = setup pending, not a real zero.

---

## 1. Lens A — Social insights: metric set + definitions

| Metric | Definition (formula) | Channels | Pull source | Decision it drives |
|---|---|---|---|---|
| Reach | Unique accounts that saw content | FB, IG, LI, TikTok | `social-media` insights (`reach`/`impressions`) | Is the top of funnel growing? |
| Engagement rate | (reactions+comments+shares+saves) ÷ reach | FB, IG, LI | `social-media` (`total_interactions` ÷ `reach`) | Is the creative resonating? |
| Follower growth | net new followers ÷ period | all | `social-media` (`follower_count` delta) | Is the audience compounding? |
| GBP actions | calls + directions + website + bookings | GBP | GBP Performance API `[manual]` | Is local intent converting? |
| Saves / shares | saved + shares (intent signal) | IG, TikTok | `social-media` (`saved`, `shares`) | Which posts are worth amplifying? |
| Conversion | clicks → campaign action (signup/booking) | all | GA4 + UTM per C* | Is presence producing pipeline? |

## 2. Lens A — Dashboard layout

### Cross-channel summary tiles (this period)
| Tile | Value | Δ vs prior | Target | Source @ date |
|---|---|---|---|---|
| Total reach | 48,200 | +12% | 60,000 | SocialMedia last_28d @ 2026-06-24 |
| Blended engagement rate | 4.1% | +0.6pp | 5.0% | SocialMedia last_28d @ 2026-06-24 |
| Net follower growth | +1,340 | +18% | +1,500/mo | SocialMedia last_28d @ 2026-06-24 |
| Conversions to date | 86 | +9 | 120/qtr | GA4 (C1+C3 UTMs) @ 2026-06-24 |

### Per-channel × KPI (one row per channel × metric)
| Channel | KPI | Baseline T0 | Latest | Δ | Target | Serves | Source @ date |
|---|---|---|---|---|---|---|---|
| Instagram | Reach | 9,800 | 14,200 | +45% | 18,000 | C1, C2 | SocialMedia last_28d @ 2026-06-24 |
| Instagram | Eng. rate | 3.2% | 4.6% | +1.4pp | 5.0% | C1 | SocialMedia last_28d @ 2026-06-24 |
| Instagram | Saves+shares | 210 | 480 | +128% | 500 | C2 | SocialMedia last_28d @ 2026-06-24 |
| GBP | Actions | 320 | 410 | +28% | 500/mo | C3 | GBP Performance `[manual]` @ 2026-06-24 |
| LinkedIn | Reach | 4,100 | 5,050 | +23% | 7,000 | C4 | SocialMedia last_28d @ 2026-06-24 |
| LinkedIn | Conversion | 18 | 26 | +44% | 40/qtr | C4 | GA4 (C4 UTM) @ 2026-06-24 |

> Note: TikTok rows omitted — not in `strategy.md` channel mix.

## 3. Lens B — Share-of-AI-Voice methodology

**Engines:** ChatGPT · Perplexity · Gemini · Claude · Le Chat (+ Google AI Overviews, fr-FR).
**Run protocol:** fresh/logged-out session per query · verbatim capture · score 4 axes · log the snippet.
**Scoring axes:** Presence (0/1) · Rank (1st / top-3 / mentioned / absent) · Sentiment (pos/neu/neg) · Citation (0/1 + source).
**SoAV per query** = subject mentions ÷ distinct brands named. **Basket SoAV** = mean across Q* × engines.
**Cadence:** monthly Q* run · quarterly deep re-baseline · GA4 referral continuous.

### Per-engine score matrix — run T0 (2026-06-24)
| Q-ID | Query (locale) | ChatGPT | Perplexity | Gemini | Claude | Le Chat | SoAV % | Snippet ref |
|---|---|---|---|---|---|---|---|---|
| Q1 | "best <niche> tool" (EN) | top-3 / pos / cited(us) | mentioned / neu / cited(g2) | absent | top-3 / pos / no-cite | absent | 33% | log#Q1 |
| Q2 | "<niche> software for small business" (EN) | 1st / pos / cited(us) | top-3 / pos / cited(us) | mentioned / neu | mentioned / neu | absent | 40% | log#Q2 |
| Q3 | "meilleur outil <niche>" (fr-FR) | absent | mentioned / neu / cited(reddit) | absent | absent | mentioned / neu | 14% | log#Q3 |
| Q4 | "<competitor> alternative" (EN) | top-3 / pos / cited(us) | top-3 / pos / no-cite | mentioned / neu | top-3 / pos / cited(us) | mentioned / neu | 50% | log#Q4 |

> **Basket SoAV (T0): 34%** (EN 41% · fr-FR 14%) — fr-FR flagged THIN: locale corpus gap, see §6 blocker.

### Results log template (append one block per Q* per engine per run)
```
[run:2026-06-24][Q1][engine:ChatGPT][locale:EN]
presence: 1 | rank: top-3 | sentiment: pos | citation: 1 (source: our /compare page)
verbatim: "Top options include <BrandA>, <Subject>, and <BrandC>..."
brands named: BrandA, Subject, BrandC  → SoAV(this cell) = 1/3
```

## 4. Lens B — GA4 AI-referral capture

**Setup:** GA4 Admin → Channel groups → new group "AI Assistants" matching referral sources:
`chatgpt.com`, `chat.openai.com`, `perplexity.ai`, `gemini.google.com`, `claude.ai`, `copilot.microsoft.com`
+ `utm_source` tags where engines pass them. Exploration tile: sessions/conversions × landing page (P*).

| Source | Sessions | Conversions | Top landing page (P*) | Status |
|---|---|---|---|---|
| chatgpt.com | 142 | 6 | /compare (P2) | live @ 2026-06-24 |
| perplexity.ai | 88 | 3 | /pricing (P2) | live @ 2026-06-24 |
| gemini.google.com | — | — | — | [not yet wired] |
| claude.ai | 21 | 1 | / (P1) | live @ 2026-06-24 |

> `[not yet wired]` rows are setup-pending, NOT zero traffic. No invented numbers.

## 5. Verified tool stack

| Tool | Measures | Engine coverage | Price | Source (verified?) |
|---|---|---|---|---|
| Manual Q* run | full SoAV (4 axes) | all 5 | operator-time | n/a — our protocol |
| GA4 (custom channel group) | AI-referral traffic + conversions | all (referral) | free | GA4 docs ✅ |
| <vendor SoAV tracker> | presence + rank tracking | ChatGPT/Perplexity/Gemini | $/mo | vendor docs — see DO NOT CITE if unconfirmed |
| Search Console | classic SERP + AI Overviews impressions | Google | free | GSC docs ✅ |

## 6. Recurring run cadence + Definition-of-Winning hook

| Lens | Cadence | Owner | Feeds into |
|---|---|---|---|
| A — social insights | weekly | Analyst | `content-calendar.md` (kill/double-down) |
| B — Q* SoAV run | monthly | Analyst | `geo/recommendation-roadmap.md` (which P* to push) |
| B — deep re-baseline | quarterly | Analyst + Skeptic | this file (new T0 column) |
| B — GA4 AI-referral | continuous | Analyst | §4 tile |

**Definition-of-Winning (from `coordination.md`):** blended basket SoAV ≥ 50% (EN) AND AI-referral
conversions trending up MoM AND blended social engagement rate ≥ 5.0%.

---

## > DO NOT CITE — unverified (Skeptic quarantine)
> - "60% of searches will be AI by 2026" — no primary source located; refuted, intuition only.
> - <vendor> "tracks all 5 engines" — vendor marketing page claims 3; coverage cell downgraded.

## Integrity footer
- Load-bearing figures verified this pass: 14 / 16. Refuted → DO NOT CITE: 2.
- fr-FR locale: THIN — dedicated deep-research pass required before fr budget commit (locale-integrity gate).
- No `AggregateRating` schema emitted (no verified review base — see GeoPillar reviews gate).
- Skeptic verdict: SHIP (no unsourced load-bearing stat remains in body). Reviewed 2026-06-24.
```

## Integrity checkpoints (this phase)

- **Every cell sourced.** Each social number carries `[source @ date+period]`; each SoAV score carries
  a verbatim snippet ref. A bare number is inadmissible and routes to the Skeptic.
- **No fabricated traffic.** GA4 rows that aren't wired ship as `[not yet wired]`, never as zero or an
  invented count. Benchmark stats ("X% of search is AI") need a primary source or go to DO NOT CITE.
- **Tool claims verified.** Coverage/price for every tool is confirmed against the vendor's current docs;
  unconfirmed → DO NOT CITE, downgraded, not softened.
- **No AggregateRating without verified data.** Measurement never emits rating schema; if a SoAV answer
  cites a competitor's review count, it is reported as observed, not asserted as our own.
- **Locale integrity.** Non-EN SoAV with thin corpus is flagged THIN and gated behind a dedicated
  deep-research pass — never blended into the headline as if equally grounded.
- **Skeptic veto.** The file does not ship while a single unsourced load-bearing stat remains in the
  body; verdict + counts logged in the integrity footer.

## Worked example

**Subject:** "Be the default booking + reputation tool for local salons, French-first." Channels in
`strategy.md`: IG, GBP, LinkedIn. Campaigns: C1 (reels wedge), C2 (carousel proof), C3 (GBP local),
C4 (LinkedIn founder). Q-basket from GeoPillar: Q1-Q4 (EN + fr-FR).

1. **Scope:** drop TikTok/FB/YouTube (not in mix). KPI set = reach, eng rate, follower growth, GBP
   actions, saves/shares, conversion.
2. **Lens A pull:** `SocialMedia instagram insights` → IG reach 14,200 (+45% vs prior), eng 4.6%,
   saves+shares 480. GBP Performance `[manual]` → 410 actions (+28%). LinkedIn conv 26 (+44%). All
   stamped `last_28d @ 2026-06-24`.
3. **Dashboard:** summary tiles (total reach 48,200 / blended eng 4.1% / +1,340 followers / 86 conv) +
   per-channel×KPI rows, each citing its C*.
4. **Lens B run:** Q1-Q4 × 5 engines, logged-out, verbatim captured. Basket SoAV = 34% (EN 41%,
   fr-FR 14%). fr-FR flagged THIN — corpus gap surfaced as a blocker, not blended into the headline.
5. **GA4:** "AI Assistants" channel group live → chatgpt.com 142 sessions / 6 conv to /compare (P2);
   gemini row `[not yet wired]`.
6. **Tool stack + baseline:** `research` pass confirms GA4 + GSC; one vendor's "all 5 engines" claim
   refuted (docs say 3) → coverage downgraded + a DO NOT CITE note.
7. **Cadence:** weekly social → calendar; monthly Q* → recommendation-roadmap; quarterly re-baseline;
   GA4 continuous. DoW hook = SoAV ≥ 50% EN AND AI-referral conv ↑ AND eng ≥ 5.0%.
8. **Skeptic verify:** 14/16 figures confirmed; 2 refuted to DO NOT CITE (a benchmark stat + the
   vendor coverage claim). Verdict SHIP. File written to `docs/growth/measurement.md`.
