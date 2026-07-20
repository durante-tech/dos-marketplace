---
name: GeoPillar
description: Phase 5 — the GEO/AEO pillar — be the default answer when a human or an LLM asks for the best tool in the niche
status: STABLE
bestPath:
  - title: "Verified Baseline"
    description: "Establish the sourced 'you are here' baseline across in-repo schema state and off-repo entity/review/corpus signals."
  - title: "Corpus Supply-Chain"
    description: "Map how each AI engine sources its recommendation corpus, per-engine, never blended."
  - title: "Pillars & Answer-Targets"
    description: "Lock the wedge and author the 6 GEO pillars (P1-P6) with sourced, owned tactics."
  - title: "Gated Sequencing"
    description: "Sort work into Track A/B/C by what it's gated on and map onto phases PH0-PH3 with milestones."
  - title: "Architecture, Basket & Verify"
    description: "Author the in-repo ADRs, the versioned SoAV query basket, and run the Skeptic integrity pass."
---

# GeoPillar Workflow

## When to Use
- Trigger phrases: "GEO", "AEO", "share of AI voice", "be the default recommendation".
- Situation: the program needs to become the default named answer when a human or LLM asks for the best tool in the niche — a standalone, source-grounded GEO/AEO sub-program.
- NOT for general social-channel selection (use `BrandChannelStrategy`) or the ongoing SoAV measurement runs once the basket exists (use `Measurement`) — GeoPillar builds the roadmap and basket, Measurement operates them.

**Purpose:** Make the subject the *default named recommendation* when a buyer — or the LLM a buyer asks — looks for "the best tool" in the niche, in English and the primary locale. This is the richest phase of the program and the one that reproduces the `altyaa-turbo#251` method end-to-end: a sourced verified baseline ("you are here"), the per-engine corpus supply-chain, six pillars (P1–P6), a gating-first sequencing model, an in-repo architecture ADR, and a versioned Share-of-AI-Voice query basket. GEO is *one* workstream of the larger program, but it carries its own three-file sub-program because the method is deep enough to stand alone.

**Budget:** 90–150 min wall-clock. ~12–20 credits: 1 deep + 1 standard `research` pass (external corpus + entity + competitor density, FR/locale pass separate), 1 `sentinel` scan (in-repo schema/route/JSON-LD state), 5-seat council debate, 1 adversarial Skeptic verify pass over every load-bearing stat. The locale deep-research pass is a mandatory extra spend when the primary market is non-English — never extrapolate from EN data.

## Inputs
- **Project-knowledge brief** — the subject's positioning, ICP, pricing, primary market/locale, and (if it exists) the repo it ships from. Carries forward from Phase 1 (BrandChannelStrategy `strategy.md`).
- **`subject`** — the product/brand being made the default recommendation.
- **`niche` + `locale`** — the category the SoAV basket is scored against (e.g. "reputation/social tool for local SMBs") and the primary language (e.g. `fr`, with `en` always run as the secondary). The locale is *authoritative* for half the query basket.
- **`customer_base_status`** — verified count of real, paying customers. **Load-bearing:** the P4 reviews/corpus pillar is arithmetically gated on this number. Internal/seed accounts do **not** count.
- (Optional) prior `geo/` artifacts to revise rather than regenerate (append-only IDs).

## Prerequisites (+ graceful degradation)
- **`research`** (deep + standard modes) — REQUIRED. Sources the external baseline (review density, entity-graph presence, listicle/Reddit inclusions), the per-engine citation diet, and competitor figures. *Degradation:* if absent, the baseline ships with every external row marked `> DO NOT CITE — unverified, research pack unavailable` and the phase emits a hard blocker — a GEO roadmap on unsourced numbers is the exact failure this pillar exists to prevent.
- **`sentinel`** — REQUIRED for the in-repo track (`geo/architecture.md`). Scans for existing JSON-LD, schema/SEO primitives, programmatic route dirs, `llms.txt`, blog corpus, hreflang/metadata coverage. *Degradation:* if the subject ships no repo (pure off-site brand), skip `geo/architecture.md`, note "no in-repo surface — off-site corpus only," and fold the entity/`sameAs` work into the off-repo track. Never invent repo facts.
- **5-seat council** (canonical roster: `References/council-roster.md`) — for this phase: Strategist owns pillar/sequencing logic, Analyst owns the baseline + SoAV method, Skeptic owns the integrity guard (veto over any unsourced stat). *Degradation:* solo-conductor mode still runs all five lenses sequentially; the Skeptic verify pass is **never** skipped.
- **Phase 1 `strategy.md`** — supplies the locked wedge/positioning the entity layer encodes. *Degradation:* if absent, derive a provisional wedge from the brief and flag it as un-ratified.

## Steps

1. **Verified baseline — "you are here" (Analyst + Sentinel + Research).**
   - Run `sentinel` over the repo: enumerate every surface that carries (or lacks) JSON-LD, the `seo`/schema primitive dirs (present/absent), `/compare`·`/vs`·`/solutions`·`/for` route dirs, `/llms.txt`+`/llms-full.txt`, hreflang/`metadataBase`/OG coverage, and the blog corpus count + whether posts carry `Article` schema and `updatedAt`. Each row records its **path/evidence** ("verified in-tree").
   - Run `research` (standard) for the external rows: in-niche SoAV (≈0% if absent from corpus), G2 + Capterra (or locale equivalents) review counts and ratings, entity identity (Wikidata Q-ID / Crunchbase / company page — present/absent), listicle inclusions (EN + locale, count), Reddit/community presence, and **competitor review density for contrast** (the floors to clear). Each row records its **source**.
   - **Decision rule:** every baseline row MUST carry a SOURCE or a path. A row with neither is dropped, not estimated. ~0% SoAV is recorded as the honest *starting line*, with the "recognize-vs-recommend gap" framed so it reads as a floor, not an alarm.

2. **Corpus supply-chain — how an AI recommendation is actually made (Strategist + Analyst).**
   - Establish the thesis first: LLMs don't read the subject's marketing to recommend it — they synthesize a third-party corpus (~82% earned-media citations; source-attributed and Skeptic-verified). On-site work is **necessary but insufficient**.
   - Build the **per-engine citation-diet table**: for ChatGPT / Perplexity / Gemini / Claude / Le Chat (Mistral), record each engine's dominant source mix → the concrete implication (where to earn citations). The locale's own engine (Le Chat for FR) gets a "DIY probe only — no SaaS tracker covers it" flag.
   - **Decision rule:** measure per-engine, never blend — the same brand can swing from single-digit on Claude to ~30% on Perplexity. The supply-chain diagram + table is what justifies why P3 (third-party corpus) outranks P1/P2 in leverage.

3. **The wedge + answer-targets (Strategist + Creative + Channel).**
   - Lock the one-sentence positioning (carried from `strategy.md`, repeated identically everywhere — it is the entity description, the homepage H1, the llms manifest blockquote).
   - Build the **wedge table** (axis × subject × incumbents) showing the empty slot the strategy owns.
   - Define **answer-targets** = the queries the subject intends to be *named* in. These become the `Q*` basket (Step 7). Tag each `brand | category | comparison | vertical | done-for-you`; North-Star targets are **in-niche only** — brand-navigational queries are a health check, not a goal.

4. **The 6 pillars (Strategist, each pillar source-backed by Research).** Author P1–P6, each with objective, owner (`R*`), repo/off-repo flag, key moves (`E*` epics), and **research-backed tactics with inline sources**:
   - **P1 Entity & Structured Data** — make the subject machine-knowable (Wikidata/Crunchbase/company entity, locked NAP, sitewide JSON-LD). Disambiguation layer everything attaches to. `AggregateRating` **gated** (Skeptic hard rule).
   - **P2 On-Site Answer Surface** — data-driven `/compare`·`/vs`·`/solutions`·`/for` + hreflang + `llms.txt`; competitor-comparison **publishing gated on review proof**.
   - **P3 Third-Party Corpus Entry** — directories, listicles, Reddit/community threads engines actually cite. Highest-leverage, slow-burn, 82–85% off-site. *This is where SoAV actually moves.*
   - **P4 Review & Proof Density** — real, FTC-compliant reviews + case studies. **Gated on a real paying-customer base** (Skeptic hard gate).
   - **P5 Topical-Authority Content Engine** — GEO-re-aim the existing post corpus (front-loaded answers, cited sources, clusters) + owned ranked listicles as citation surfaces and outreach trade-bait. *Ungated → day-0.*
   - **P6 Measurement (Share-of-AI-Voice)** — instrument SoAV across 5 engines × EN/locale; the scoreboard that must exist *before* anyone claims credit.

5. **Gating-first sequencing — Tracks A/B/C → phases (Strategist + Skeptic).**
   - Sort work by **what it is gated on**, not by pillar number. Three tracks run in parallel from day 0:
     - **Track A (day-0, ungated):** wedge, entity nodes + sitewide schema, NAP, SoAV scoreboard, compliance gate, directory *claims*, the content engine (re-aim + owned listicles), metadata + `llms.txt`, page infra.
     - **Track B (customer-gated):** review-velocity sprint, case studies, `AggregateRating` flip, competitor `/compare` **publish**.
     - **Track C (slow-burn):** locale corpus entry, listicle outreach, Reddit — citations lag 4–8 months; owned listicles are the trade-bait that makes this land faster.
   - Map tracks onto phases **PH0→PH3** with windows, themes, and per-phase **in-niche SoAV targets** (≈0% baseline → ≥10% → ≥30% → ≥50%). Author the **milestones (`M*`) table** with dates, phase, and exit-criteria gates.
   - **Decision rule (Skeptic veto):** the reviews/corpus pillar is *arithmetically gated on a verified active-customer count* — it is a blocker, not a day-0 task. An "easy in-repo eng sprint" must not masquerade as the highest-leverage move; the needle is off-site.

6. **In-repo architecture ADR (`geo/architecture.md`) — Strategist + Sentinel + Analyst.**
   - Anchor on §1 **current repo state, verified not inferred** (from Step 1's Sentinel scan) — every ADR builds on a real path.
   - Author **ADR-01…06**: (01) one `<JsonLd>` component + pure schema-builder lib; (02) centralized `buildPageMetadata()` for canonical + OG + hreflang; (03) `/llms.txt` + `/llms-full.txt` as force-static handlers, explicitly **non-SoAV insurance**; (04) one data layer feeding routes + sitemap + llms (programmatic `/compare`·`/vs`·`/for`·`/solutions`); (05) **`AggregateRating` gated behind one real-data predicate, default OFF**; (06) `Article` schema on the whole post corpus via the live CMS shape. Each ADR = decision · rationale (sourced) · alternatives-rejected.
   - Emit the **component/file map** (path · purpose · new|modify), the **per-page-type JSON-LD plan**, the **dependency-ordered build sequence** (with the build≠publish gate overlay), and the **verification gate**.

7. **Query basket (`geo/query-basket.md`) — Analyst + Skeptic.**
   - Author the **versioned 30-query basket** (15 locale / 15 EN), each with `lang` (authoritative), `intent`, `category`. In-repo home + a `CHANGELOG.md` — editing a query is a **new basket version** (a single flip is a ~3.3% swing).
   - Define **what counts as a win** (RECOMMENDED / MENTIONED / CITED-ONLY tiers), the **run protocol** (multi-sample, per-engine × per-language, mean appearance rate), the cadence, and the **results-log template**.
   - **Decision rule:** locale detection must be accent/synonym-aware; brand-navigational queries are excluded from in-niche gates.

8. **Skeptic integrity pass (cross-cutting — runs against the whole phase output).** Every load-bearing number gets an adversarial verify against a primary source. Confirmed → keep with source. Refuted/unverifiable → moved to an explicit `> DO NOT CITE — unverified` block. Enforce: no fake/incentivized reviews (FTC), no `AggregateRating` without verified data, reviews/corpus gated on real customers, locale research not extrapolated from EN. The phase does not ship until this pass clears.

## Output Template

This phase writes **three files** under `geo/`. The literal structure of each follows — fill the bracketed cells. IDs are append-only and cross-referenced everywhere: `P*` pillars, `PH*` phases, `M*` milestones, `C*` campaigns, `E*` epics, `Q*` queries, `R*` roles.

---

### File 1 — `geo/recommendation-roadmap.md`

```markdown
# Recommendation-Engine Roadmap — <subject> (the GEO spine)

> **Program:** Make <subject> the default answer when an LLM is asked "best <niche>" — in <primary locale> first, then English.
> **Stable IDs (cache-key discipline):** P*/PH* pillars/phases · M* milestones · C* campaigns · E* epics · Q* queries · R* roles. If an ID changes here, every sibling doc breaks.
> **Siblings:** [architecture.md](./architecture.md) · [query-basket.md](./query-basket.md) · [../measurement.md](../measurement.md) · [../coordination.md](../coordination.md)

## TL;DR — the thesis in six sentences
1. LLMs don't read your site to recommend you — they synthesize a third-party corpus (~<X>% earned media — <SOURCE>). On-site work is necessary but insufficient.
2. The single highest-leverage move is <review-density / corpus move>, because <floor it clears> (<SOURCE>).
3. <subject>'s baseline is mechanically ~0% SoAV: <one-line why> — below every floor that gates corpus visibility.
4. The wedge nobody owns: "<positioning sentence>."
5. Review-seeding is gated on a real customer base + FTC compliance — the existential risk for this brand.
6. The scoreboard is Share-of-AI-Voice, reported per-engine × per-language, never blended.

## Verified baseline — "you are here"
Every row is a floor to clear. Repo rows verified in-tree this session; external rows carry a source.

| Dimension | Current state | Source / verification |
|---|---|---|
| **SoAV (in-niche)** | ~0% — <subject> absent from the corpus LLMs read | Analyst baseline; corpus ~<X>% third-party (<SOURCE>) |
| **G2 reviews** | <n> (no claimed profile) | <SOURCE> |
| **<locale review platform> reviews** | <n>, <rating>, <listing state> | Verified live: <url> |
| **Entity identity** | <None / Q-ID / Crunchbase / company page> | <SOURCE>; off-repo gap |
| **On-site JSON-LD** | <n surface(s)> — <path> | Verified in-tree |
| **`lib/seo` + `components/seo`** | <exist / do not exist> | Verified: <evidence> |
| **/compare · /vs · /solutions · /for routes** | <do not exist> | Verified: route dirs absent |
| **/llms.txt + /llms-full.txt** | <do not exist> | Verified: routes absent |
| **hreflang / metadataBase + OG** | <coverage gap> | architect audit gap |
| **Blog corpus** | <n> posts (<path>), <schema state> | Verified: <n> files |
| **Listicle inclusions (EN + locale)** | <n> | <SOURCE> |
| **Reddit / community presence** | <n> | <SOURCE> |
| **Measurement harness** | None — no basket, no SoAV runs, no GA4 AI channel | measurement council |
| **Competitor review density (contrast)** | <Competitor A> <n> G2 @<r> / <n> <platform> @<r>; <Competitor B> <n> G2 @<r> | Verified figures, competitor teardown |

**Why ~0% is correct, not alarming:** <one paragraph — a 0-review profile is invisible to both the platform's own ranking and to AI retrieval; recognize-vs-recommend gap framed as a floor>.

## How an AI recommendation is actually made — the corpus supply chain
<ASCII diagram: USER → ENGINE (5×) → [REVIEW SITES · COMMUNITIES · LISTICLES · ENTITY GRAPH] → "best X for Y" answer; YOUR SITE shown as the ~15-18% substrate feeding disambiguation.>

**Each engine eats a different diet (measure per-engine, never blend):**

| Engine | Citation diet | Implication |
|---|---|---|
| **ChatGPT** | <diet — SOURCE> | <where to earn citations> |
| **Perplexity** | <freshness-driven, Reddit-heavy — SOURCE> | <fresh dates + Reddit win> |
| **Gemini** | <listicle/affiliate + organic/GBP — SOURCE> | <listicles + local signals> |
| **Claude** | <long-form editorial + reviews — SOURCE> | <editorial + reviews> |
| **Le Chat (Mistral)** | <locale-native, locale-biased — SOURCE> | **DIY probe only — no SaaS tracker covers it** |

## The wedge + answer-targets
**Positioning (one signal, locked everywhere — GC1):** > "<the one sentence>." — <price · locale · how>.

| Axis | <subject> | <EN incumbents> | <locale incumbents> |
|---|---|---|---|
| Pricing | <published flat> | <quote-only / hidden> | <varies> |
| <key axis 2> | <subject value> | <incumbent value> | <incumbent value> |
| <empty-slot axis> | **yes, end-to-end** | partial | **slot is empty** |

**Answer-targets** = the queries we intend to be *named* in (full set in [query-basket.md](./query-basket.md), IDs Q1–Q30). North-Star targets are in-niche only; brand-navigational (Q10, Q25) is a health check. Locale exemplars: Q1 <…>, Q11 <…>. EN exemplars: Q16 <…>, Q29 <…>, Q30 <…>.

## The 6 pillars

### P1 — Entity & Structured Data
*Make <subject> machine-knowable — canonical entity, locked NAP, sitewide JSON-LD so LLMs can disambiguate and name it.*
- **Objective:** <the disambiguation layer downstream JSON-LD/listicles resolve to>.
- **Owner:** R1 (off-repo entity) + R2 (in-repo schema). R3 governs NAP.
- **Repo/off flag:** mixed — repo (E1–E3, E8) + off-repo (E4–E6) + ops (E7).
- **Key moves:** JsonLd component + builders (E1); Org+WebSite sitewide, SoftwareApplication on home (E2); Article on all posts (E3); Wikidata Q-ID (E4) / Crunchbase (E5) / company page (E6); lock entity spec (E7); definitional H1 (E8).
- **Research-backed tactics:** <`sameAs` → live URLs only; JSON-LD ≈ <X>× citation odds (<SOURCE>); **gate `AggregateRating` behind real review counts (E24)**>.

### P2 — On-Site Answer Surface
*Build /compare·/vs·/solutions·/for + hreflang + llms.txt LLMs lift into "best X for Y" — publishing gated on review proof.*
- **Objective / Owner / Repo flag / Key moves (E9–E16) / Research-backed tactics** <verdict-first comparison structure; programmatic pages data-driven with unique substance; hreflang mirrored on both locales; **llms.txt is INSURANCE not a SoAV lever (<SOURCE>)**>.

### P3 — Third-Party Corpus Entry
*Get INTO the directories, listicles, Reddit threads engines actually cite — highest-leverage, ~82-85% off-site, slow-burn.*
- **Objective:** seed the supply LLMs read — *where SoAV actually moves.*
- **Key moves (E16–E21) / Research-backed tactics** <one G2 claim blankets the aggregator corpus; Reddit is the dominant community source, lag months 4-8 (<SOURCE>); listicle inclusion is earned not paid (~<X>% reply (<SOURCE>)); locale corpus is thinner/less-contested>.

### P4 — Review & Proof Density
*Seed real, FTC-compliant reviews + case studies — the proof the whole corpus consumes; **gated on a real paying-customer base.***
- **Objective:** clear ranking floors (<G2 Grid floor>, <platform Shortlist floor>); unlock `AggregateRating`.
- **Key moves (E22–E27) / Research-backed tactics** <self-service campaign cadence; **FTC Consumer Review Rule — show the prompt to ALL operators, never sentiment-gate; incentives disclosed + capped; never self/staff-seed (<SOURCE>)**>.

### P5 — Topical-Authority Content Engine
*GEO-re-aim the post corpus + publish owned ranked listicles as citation surfaces and outreach trade-bait. Ungated → day-0.*
- **Key moves (E28–E31) / Research-backed tactics** <front-load the answer, cite sources, add stats + a quote, strict heading hierarchy (<SOURCE>); clusters; owned listicles double as trade-bait>.

### P6 — Measurement (Share-of-AI-Voice)
*Instrument SoAV across 5 engines × EN/locale (incl. a DIY Le Chat probe), per-engine/per-language, with noise bands — the scoreboard, never blended. Build it BEFORE any campaign claims credit.*
- **Key moves (E32–E35) / Research-backed tactics** <multi-sample 3-5×; tier RECOMMENDED > MENTIONED > CITED-ONLY; DIY Le Chat probe mandatory; GA4 AI channel as a floor; paid trackers optional, none replaces the DIY probe>.

## Sequencing model — sort by GATING, not pillar number
P1–P6 is a grouping, not a running order. Three tracks run in parallel from day 0.

### Track A — Day-0, ungated → PH0
<wedge (GC1), entity + sitewide schema (GC2), NAP (GC3), SoAV scoreboard (GC4), compliance gate (GC5), directory *claims* (GC6); content engine re-aim + owned listicles (GC14/GC15); metadata + llms.txt (GC16) + page infra (GC12/GC13 build).>

### Track B — Customer-gated → PH1 → PH2
<review-velocity sprint (GC8), case studies (GC9), AggregateRating + review proof, competitor /compare PUBLISH (GC12, gated ≥20 reviews).>

### Track C — Slow-burn (start early, pays late) → PH0/1 → land PH2+
<locale corpus entry (GC7), EN listicle outreach (GC10), Reddit (GC11); day-0 owned listicles (GC15) are the trade-bait. Competitive monitoring (GC17) continuous.>

> **The order in one line:** everything ungated — foundation AND content — starts day 0; only review-dependent work waits for customers.

## The 4 phases

| Phase | Window | Theme | In-niche SoAV target |
|---|---|---|---|
| **PH0 Foundation** | now → <date> | Lock entity/positioning/scoreboard/compliance + off-repo claims; launch content engine + ship metadata/llms.txt (ungated, day-0); build page infra; gate only competitor-comparison PUBLISHING on review density. | baseline v0 (~0%) |
| **PH1 Corpus Entry** | → <date> | Seed real reviews to clear floors, claim directories (EN+locale), start listicle/Reddit (excluded from near-term targets), publish ungated /solutions + /for. | **≥10%** (locale crosses first) |
| **PH2 Authority & Flywheel** | → <date> | Complete clusters, PUBLISH competitor /compare (review-gated), harvest case studies, let corpus + owned listicles compound. | **≥30%** |
| **PH3 Defensibility** | <date>+ | Deepen the locale/vertical moat, monitor competitive response, sustain review velocity, own the in-niche corpus. | **≥50%** |

### Milestones + exit criteria

| ID | Milestone | Date | Phase | Exit criteria (gate) |
|---|---|---|---|---|
| **GM1** | Positioning + entity scaffold live | <date> | PH0 | Canonical positioning kit locked; entity nodes live with identical NAP; `sameAs` URLs recorded. |
| **GM2** | On-site backbone + content engine live | <date> | PH0 | JsonLd component + builders merged + unit-tested; Org+WebSite sitewide; Article on all posts; definitional H1; **AggregateRating absent + gated**; Rich Results clean; day-0 llms.txt + OG/hreflang shipped; GEO re-aim underway + ≥1 owned listicle live. |
| **GM3** | Scoreboard + compliance gate operational | <date> | PH0 | 30-query versioned basket committed; DIY harness runs 5 engines incl. Le Chat; GA4 AI channel + Bing AI Performance live; **~0% baseline recorded as v0**; compliance signed off; **verified active-customer count gates review seeding**. |
| **GM4** | Corpus claimed + review sprint underway + vertical pages live | <date> | PH1 | G2 claimed + locale platforms live; in-product review prompt (sentiment-neutral); listicle + Reddit started (lagging, tracked); ungated /solutions + /for published EN+locale. |
| **GM5** | PH1 SoAV gate ≥10% in-niche | <date> | PH1 | <floor> verified G2 + <floor> verified <platform> reviews; in-niche SoAV ≥10% per-engine/per-language mean with noise band; lagging off-site wins explicitly excluded. |
| **GM6** | Answer surface complete + competitor /compare published | <date> | PH2 | Competitor /compare + /vs PUBLISHED (gate cleared: ≥20-review proof); posts re-aimed into 5-8 clusters; owned-listicle library ≥2 EN + ≥2 locale; ≥2 case studies. |
| **GM7** | PH2 SoAV gate ≥30% in-niche | <date> | PH2 | In-niche SoAV ≥30%; first listicle + Reddit citations in basket source mix; review-proof rendering on home + compare; **AggregateRating live from verified data**. |
| **GM8** | PH3 defensibility + SoAV ≥50% | <date> | PH3 | In-niche SoAV ≥50%; competitive-response monitoring running; sustained review velocity + locale moat; SoAV durable across monthly cycles (not noise). |

## Campaigns → pillar/phase/owner map
(Full plays + KPIs in [../campaigns.md](../campaigns.md).)

| ID | Campaign | Pillar | Phase | Owner |
|---|---|---|---|---|
| **GC1** | Lock the Wedge | P1 | PH0 | R1 |
| **GC2** | Machine-Knowable (Entity Scaffold) | P1 | PH0 | R1 |
| **GC4** | SoAV Radar | P6 | PH0 | R2 |
| **GC5** | Compliance Gate | P4 | PH0 | R6 |
| **GC6** | Claim the Corpus | P4 | PH1 | R1 |
| **GC8** | Review-Velocity Sprint | P4 | PH1 | R3 |
| **GC12** | The Comparison Lattice (publish-gated) | P2 | PH0 infra → PH2 publish | R2 |
| **GC14** | Re-Aim the Content Corpus — *day-0* | P5 | PH0 | R4 |
| **GC16** | Agent-Ready Insurance (llms.txt) | P2 | PH0 | R2 |
| **GC17** | Competitive-Response Monitoring | P3 | PH3 | R1 |

**Roles:** R1 <Founder — brand/entity/outreach> · R2 <Engineer — all in-repo> · R3 <Growth Ops> · R4 <Content Strategist EN+locale> · R5 <Community/Outreach — operator-run, NOT an agency> · R6 <Compliance Reviewer>.

## North Star + targets
**North Star:** In-niche Share-of-AI-Voice — % of basket runs where <subject> is *named*, per-engine × per-language with a noise band, never blended. PH1 ≥10% (locale first) · PH2 ≥30% · PH3 ≥50%.
**Health-check (not a goal):** brand-navigational SoAV → ~100% fast; low value signals an entity problem, not a corpus one. **Leading indicators:** review counts, directory presence, listicle inclusions, Reddit mentions, citation-source mix.

## Honest risks (Skeptic's fatal_risks, folded in)
1. Review velocity is gated on a customer base that may not exist yet. Self/staff-seeding is banned and detected. **Hard gate:** GM3 requires a verified active-customer count before any seeding.
2. Authenticity exposure is existential. Shipping `AggregateRating` with no reviews / sentiment-gating (FTC) / astroturfing is a brand-extinction event. GC5 makes compliance a hard, owned workstream.
3. The 30-query basket is small — a single flip ≈ a ~3.3% swing. Mitigations: per-engine × per-language, 3-5 samples, noise bands, exclude lagging off-site wins.
4. The needle is ~82-85% off-site, but the in-repo punch list is the part the team controls — risk of "easy eng first." Counter: entity claims start day-1 in parallel with the schema sprint.
5. Comparison pages before review proof actively harm — gate competitor `/compare` PUBLISHING on ≥20 reviews.

> ### DO NOT CITE — unverified
> Stats the Skeptic verify pass refuted or could not trace to a primary source. They may inform intuition but must NEVER be load-bearing in any material.
> - <stat> — <why refuted / source missing>
> - <misattributed figure> — <correct attribution + caveat>

## Sources
<grouped: GEO/AEO & corpus mechanics · reviews/directories · competitor teardown · programmatic patterns · locale · measurement tooling — every load-bearing figure above resolves to a URL here.>
```

---

### File 2 — `geo/architecture.md`

```markdown
# Architecture & ADR — Be-the-Default-Recommendation (In-Repo)

> **Scope.** Engineering architecture for the **repo track only** — JSON-LD entity scaffold, metadata/hreflang, programmatic answer surface (/compare·/vs·/solutions·/for), llms.txt, sitemap, the gated AggregateRating honesty hook. Owner R2. Off-repo nodes (entity/reviews/listicles/Reddit) are out of scope here — referenced only where they GATE repo work.
> **Spine anchors.** Pillars P1 + P2 + the P4 honesty gate. Campaigns GC02/GC12/GC13/GC16. Epics E1-E3, E8-E16, E24, E28. Milestones GM2 / GM4 / GM6.
> **Two hard constraints (load-bearing):**
> 1. **No fabricated proof.** <subject> has <n> reviews (verified: <url>). AggregateRating/Review schema is fabrication until real reviews land — penalized + betrays the brand. Ships gated behind one predicate (ADR-05), default OFF.
> 2. **Off-site is the needle; on-site is the substrate.** ~<X>% of citations are earned-media (<SOURCE>). On-site JSON-LD makes <subject> *nameable* once the corpus references it — we build it because JSON-LD ≈ <X>× citation odds (<SOURCE>), not because it moves SoAV alone.

## 1. Current repo state (verified, not inferred)
| Fact | Path / evidence | Consequence |
|---|---|---|
| JSON-LD exists in <n> place(s) | <path:lines> | <extract & type, not invent> |
| Root metadata centralized but bare on alternates | <path> — sets metadataBase/OG; **no alternates** | hreflang/canonical is the gap — extend (ADR-02). |
| Sitemap is a static path array, no hreflang | <path> | Densify + per-URL hreflang (ADR-04). |
| Public route group home for new pages | <path> | Programmatic routes + seo-data slot here. |
| **None** of /compare·/vs·/solutions·/for, hreflang, seo-data exist | confirmed absent | Net-new + a clean leapfrog. |

**Convention baseline** (from <AGENTS.md / kit-conventions>): <RSC default + generateMetadata; named exports; server-only; data-testid; i18n parity is SILENT (fr falls back to en).>

## 2. Design decisions (ADRs)
### ADR-01 — One `<JsonLd>` component + a pure schema-builder library
**Decision.** <RSC at components/seo/json-ld.tsx; pure builders at lib/seo/schema.ts: organizationSchema, softwareApplicationSchema, websiteSchema, articleSchema, faqPageSchema, breadcrumbSchema; stable @id anchors.> **Rationale.** <JSON-LD ≈ <X>× citation odds (<SOURCE>); one deep component + pure builders = conceptual integrity + unit-testability; pattern already proven in <path>.> **Alternatives rejected.** <next-seo (App-Router-unmaintained); one component per type (classitis); generateMetadata.other (Next strips it).>
### ADR-02 — Centralized `buildPageMetadata()` for canonical + OG + hreflang
**Decision / Rationale / Alternatives rejected** <encodes localePrefix asymmetry once; x-default → primary locale; hreflang mirrored both locales.>
### ADR-03 — `/llms.txt` + `/llms-full.txt` force-static, explicitly **non-SoAV**
**Decision / Rationale / Alternatives rejected** <ship as <1-day insurance; budget ZERO SoAV against it (<SOURCE>: zero lift); clean leapfrog.>
### ADR-04 — Data-driven programmatic page system, ONE data layer feeding routes + sitemap + llms
**Decision / Rationale / Alternatives rejected** <locale-keyed entries, real facts only, generateStaticParams; single source so sitemap + llms can't diverge.>
### ADR-05 — `AggregateRating` gated behind ONE real-data predicate, default OFF
**Decision / Rationale / Alternatives rejected** <getAggregateRating() returns null unless flag === true AND reviewCount > 0; today always null; one place to flip.>
### ADR-06 — `Article` schema on the whole post corpus via the live CMS shape
**Decision / Rationale / Alternatives rejected** <reuse ContentItem fields; @id cross-ref to Organization; dateModified is the freshness hook.>

> **Honesty note: drop the refuted stats.** <The Skeptic verify pass refuted <list>. Do not cite them in PRs, ADRs, or page copy. Directional practices stand; the percentages do not.>

## 3. Component / file map
### 3.1 Foundation primitives | 3.2 llms.txt surface | 3.3 Programmatic routes + data models | 3.4 Existing pages wired in
| Path | Purpose | kind (new\|modify) |
|---|---|---|
| <components/seo/json-ld.tsx> | <shared RSC injection point> | new |
| <lib/seo/schema.ts> | <pure builders, stable @id, no React, unit-tested> | new |
| <lib/seo/metadata.ts> | <buildPageMetadata — canonical + hreflang> | new |
| <lib/seo/reviews-source.ts> | <the single honesty gate; today always null> | new |
| <…/compare/[competitor]/page.tsx> | <verdict-first one-table layout; generateStaticParams> | new |
| <…/page.tsx (home)> | <Org+WebSite+SoftwareApplication; definitional H1> | modify |
| <…/sitemap.xml/route.ts> | <enumerate programmatic routes + hreflang alternates> | modify |

### 3.5 Data-model type sketches
- **`CompetitorEntry`** — `{ slug; name; category; copy: Record<Locale,{ positioning; whySwitch[]; featureMatrix[]; verdict; faq[] }>; pricingPublic?; }` — pricing for quote-only incumbents says "quote-only", never an invented number.
- **`VerticalEntry` / `SolutionEntry`** — `{ slug; copy: Record<Locale,{ h1; definitionalIntro; …; faq[] }> }`.

## 4. Per-page-type JSON-LD plan
| Surface | Schema graph | @id cross-refs | Notes |
|---|---|---|---|
| **Homepage** | Organization + WebSite + SoftwareApplication | publisher → #organization | offers = <price>; **No aggregateRating.** H1 = definitional sentence. |
| **Blog post** (×<n>) | Article + BreadcrumbList | author/publisher → #organization | dateModified = updatedAt ?? publishedAt; inLanguage = post.language. |
| **/compare/[competitor]** | Product + FAQPage + BreadcrumbList | brand → #organization | Verdict-first; AggregateRating gated. |

## 5. Sequencing / build order
<primitives → existing pages (GM2 backbone) → metadata rollout → data models → programmatic routes → sitemap → llms.txt (calendar day-0) → verification.> **Publish-gate overlay (NOT a code step):** competitor /compare publishing gated on ≥20-30 reviews — build in step 5, keep noindex/out of sitemap until the floor clears; AggregateRating (ADR-05) flips in the same window.

## 6. Tier-boundary & convention compliance
<no new cross-package import; route-handler Content-Type + force-static; i18n parity MANDATORY + SILENT; a unit test asserts AggregateRating absent while reviews-source returns null.>

## 7. Verification gate (definition of done — repo track)
1. healthcheck (typecheck + lint + depcruise). 2. unit tests (schema builders valid; **aggregateRating absent**; sitemap hreflang shape; metadata alternates map). 3. i18n key-parity en↔locale. 4. JSON-LD validation (Rich Results) — **AggregateRating must NOT appear**. 5. curl /llms.txt → 200 text/plain static. 6. hreflang reciprocity + x-default → primary locale.

## 8. Open questions
<sameAs live-URL status before GM2; competitor-copy legal review; build-time cost of N static pages; locale slug strategy; CSP/inline-script; dateModified refresh cadence owner.>

### Appendix — ticket ↔ ADR ↔ spine cross-reference
| Engineer ticket | ADR | Spine epic / campaign | Milestone |
|---|---|---|---|
| EP1-T1 (JsonLd + builders) | ADR-01 | E1 / GC02 | GM2 |
| EP2-T3 (data file) | ADR-04 | E11 / GC12, GC13 | GM6 |
| EP4-T1 (AggregateRating gate) | ADR-05 | E24 / GC12, GC06-GC08 | GM5→GM7 |
```

---

### File 3 — `geo/query-basket.md`

```markdown
# Query Basket — The 30-Query SoAV Seed Basket

> **Canonical IDs:** Epic E32 (30-query EN+locale basket as a versioned in-repo file) · Pillar **P6** · Campaign **GC4** · Milestone **GM3** (<date>) · Owner **R2**.
> **In-repo home:** `tooling/soav/basket.json` (versioned) + `tooling/soav/CHANGELOG.md`. Consumed by `tooling/soav/run-basket.ts` (E33) and reported via E35 (monthly SoAV report).

This is the measurement input for the whole "be-the-default-recommendation" program — the fixed list of buyer questions we run across AI assistants every month to see whether <subject> gets **named**. The scoreboard's stimulus, not a content asset.

## How this basket works (read first)
30 queries, fixed at 15 <locale> / 15 EN, each tagged `lang` (authoritative), `intent`, `category`. Run each query only in its own language; locale detection must be accent/synonym-aware. **Treat the basket like a cache-defining input** — editing a query silently invalidates the SoAV time series (a single flip ≈ a ~3.3% swing). Any change = a new basket version + a CHANGELOG.md entry + an explicit trend break. **North-Star targets are IN-NICHE** (category/comparison/vertical/done-for-you) — not the two brand-navigational queries (Q10, Q25), which approach ~100% fast and serve as a health check. Phase gates: PH1 ≥10% (GM5, locale first) · PH2 ≥30% (GM7) · PH3 ≥50% (GM8) — per-engine × per-language, never blended.

**Canonical column schema (the file `SoAVRun.ts` parses):** `ID | Query | Lang | Intent | Category` — `Lang` is the locale, `Intent`/`Category` are design taxonomy. An OPTIONAL trailing `Engines` column overrides which AI engines a given query runs on; omit it and the query runs across the run-protocol default set (the `--engines` list). The parser keys on header **names**, so column order and extra columns are tolerated — and `Category` is never misread as engines.

## The 30 queries, grouped by category
Six categories: reputation (8), social (8), vertical (8), comparison (4), brand (2).

### Reputation (8)
| ID | Query | Lang | Intent | Category |
|----|-------|------|--------|----------|
| Q1 | <locale category-best query> | <locale> | category-best | reputation |
| Q2 | <locale done-for-you query> | <locale> | done-for-you | reputation |
| Q16 | best <niche> software for small local business | en | category-best | reputation |
| Q18 | AI tool that drafts review replies I just approve and it posts them | en | done-for-you | reputation |
| Q30 | how can a local business show up in ChatGPT and AI search results | en | category-best | reputation |

### Social (8)
| ID | Query | Lang | Intent | Category |
|----|-------|------|--------|----------|
| Q4 | <locale multi-channel query> | <locale> | category-best | social |
| Q19 | best tool to manage Google Facebook Instagram and TikTok together | en | category-best | social |
| Q29 | flat <price>/month tool that runs my reviews and social posts | en | category-best | social |

### Vertical (8)
| ID | Query | Lang | Intent | Category |
|----|-------|------|--------|----------|
| Q6 | <locale restaurant-visibility query> | <locale> | vertical-restaurant | vertical |
| Q21 | software to manage online reviews for my restaurant | en | vertical-restaurant | vertical |
| Q23 | online reputation software for a dental clinic or medical practice | en | vertical-clinic | vertical |

### Comparison (4)
| ID | Query | Lang | Intent | Category |
|----|-------|------|--------|----------|
| Q11 | <locale "alternative to <incumbent>" query> | <locale> | comparison | comparison |
| Q26 | affordable <competitor> alternative for a small local business | en | comparison | comparison |
| Q27 | <Competitor A> vs <Competitor B> vs cheaper done-for-you <niche> tool | en | comparison | comparison |

### Brand — navigational (2, health check only — excluded from in-niche targets)
| ID | Query | Lang | Intent | Category |
|----|-------|------|--------|----------|
| Q10 | <subject> avis : que vaut ce logiciel | <locale> | brand-navigational | brand |
| Q25 | <subject> reviews: is it a good <niche> tool | en | brand-navigational | brand |

## Category × language coverage map
| Category | Locale queries | EN queries | Total | In-niche? |
|----------|---------------|-----------|-------|-----------|
| reputation | Q1, Q2, Q3, Q13 | Q16, Q17, Q18, Q30 | 8 | yes |
| social | Q4, Q5, Q14, Q15 | Q19, Q20, Q28, Q29 | 8 | yes |
| vertical | Q6, Q7, Q8, Q9 | Q21, Q22, Q23, Q24 | 8 | yes |
| comparison | Q11, Q12 | Q26, Q27 | 4 | yes |
| brand | Q10 | Q25 | 2 | **no (health check)** |
| **Total** | **15** | **15** | **30** | — |

## How to run the basket monthly across ChatGPT / Perplexity / Claude / Gemini (+ Le Chat)
Canonical layer = the DIY harness (E33) calling provider APIs directly — lowest-cost and the **only** way to cover Le Chat (Mistral), which no off-the-shelf tracker covers. **Run protocol:** (1) load the version-locked basket; (2) multi-sample — 5× the stochastic chat engines, 3× the retrieval-grounded engines; (3) run each query in its own language; (4) score with locale-aware detection; (5) SoAV per cell = mean appearance rate; (6) aggregate to per-engine × per-language in-niche means, never blended; (7) persist a dated artifact + record sample variance. **Cadence:** monthly full cycle · weekly Perplexity+Le Chat watch on top-intent queries · continuous GA4 AI channel (a floor — ~60-70% leaks to Direct) + Bing AI Performance · quarterly re-baseline + basket v2 decision.

## What counts as a "win" (named in the answer)
| Tier | Definition | Counts toward headline SoAV? |
|------|-----------|------------------------------|
| **RECOMMENDED** | Engine puts <subject> in its suggested / "best-for" list | yes (+ stricter recommended-rate inner metric) |
| **MENTIONED** | Named in passing / as an also-ran in prose | yes |
| **CITED-ONLY** | Domain appears only as a footnote/source, not in prose | **no** — logged separately as a leading indicator |

Headline SoAV = RECOMMENDED + MENTIONED. Score against the answer body, not just the citation list; per-cycle SoAV is the mean across samples, never a single run; brand-navigational queries are a health check, excluded from in-niche gates. **Baseline:** ~0% — record the first full cycle as v0.

## Results-log template
One row per [query × engine] per cycle. Persist each cycle to a dated file (e.g. `tooling/soav/results/2026-07.csv`).

| Date | Cycle | Basket ver | Query ID | Lang | Engine | Samples | Named? (R/M/C/N) | SoAV (mean) | Position | Competitors named |
|------|-------|-----------|----------|------|--------|---------|------------------|-----------|----------|-------------------|
| <date> | v0 baseline | v1 | Q1 | <locale> | Le Chat | 5 | N | 0.00 | — | <rivals> |
| <date> | v0 baseline | v1 | Q16 | en | ChatGPT | 5 | N | 0.00 | — | <rivals> |
| <date> | v0 baseline | v1 | Q10 | <locale> | Claude | 5 | M | 0.40 | passing, para 2 | — |

**Roll-up companion table** (one row per [engine × language] per cycle, in-niche only — exclude Q10/Q25):

| Date | Cycle | Engine | Lang | In-niche SoAV (mean) | Recommended-rate | vs PH target | Locale-vs-EN note | Sample variance | Citation source mix |
|------|-------|--------|------|----------------------|------------------|--------------|-------------------|-----------------|---------------------|
| <date> | v0 | ChatGPT | en | 0.0% | 0.0% | below PH1 10% | — | low | <directories cited> |
| <date> | v0 | Le Chat | <locale> | 0.0% | 0.0% | below PH1 10% | locale expected to lead | low | <locale directories> |

**Report caveats every cycle:** stochastic noise (a 30-query basket is small — multi-sample + noise bands, never declare victory on a single flip), basket version, sample count per engine, the GA4 floor. Lagging off-site wins (Reddit/listicle, compounding months 4-8) are **explicitly excluded** from near-term PH1 accounting.
```

## Integrity checkpoints (this phase, owned by the Skeptic seat)

- **Every baseline row carries a SOURCE or a path** — Step 1 cannot ship a row that is neither verified in-tree nor sourced. Estimated numbers are dropped, not guessed.
- **Adversarial stat verify** — every load-bearing figure (corpus %, citation-diet %, review counts, citation-odds multipliers, traffic shares) is independently challenged against a primary source. Confirmed → keep with inline source. Refuted/unverifiable → moved to the `> DO NOT CITE — unverified` block (present in `recommendation-roadmap.md` and as the "Honesty note" in `architecture.md`). This is the exact pass that refuted 5 fabricated/misattributed figures in #251.
- **No `AggregateRating` / `Review` schema without verified data** — ADR-05 ships the rating gated behind one predicate, default OFF, with a unit test asserting it is absent while the reviews source returns null. Emitting a rating at 0 reviews is a structured-data violation and a trust risk.
- **No fake/incentivized reviews (FTC Consumer Review Rule + platform ToS)** — P4 specifies the prompt is shown to ALL operators (never sentiment-gated), incentives are disclosed + capped, and self/staff-seeding is banned and detected. Internal accounts do not count toward the customer-base gate.
- **Reviews/corpus pillar gated on a real paying-customer base** — surfaced as a hard blocker in the GM3 exit criteria and the risks section, never presented as a day-0 action. The "easy in-repo eng sprint" is explicitly prevented from masquerading as the highest-leverage move (the needle is ~82-85% off-site).
- **Locale integrity** — if the primary market is non-English, the locale corpus/engine research is its own deep-research pass; thin locale data is flagged as a known gap and never extrapolated from EN. The Le Chat DIY probe is mandatory or the primary market is unmeasured.
- **ID + brand-voice discipline** — `P*/PH*/M*/C*/E*/Q*` are append-only and cross-referenced across all three files (a changed ID is a cache-key break); the definitional sentence is repeated *identically* everywhere (H1 = entity description = llms blockquote); brand-voice ban-list honored in page copy.

## Worked example

**Input:** `subject = Altyaa` (AI reputation + social tool for local SMBs), `niche = "reputation/social tool for local SMBs"`, `locale = fr` (EN secondary), `customer_base_status = ~0 verified paying customers (4 internal @altyaa accounts — do NOT count)`, repo `altyaa-turbo`.

1. **Baseline.** Sentinel finds JSON-LD in exactly one place (`apps/web/app/[locale]/(public)/faq/page.tsx:61-82`, inline `FAQPage`), `lib/seo`+`components/seo` absent, no `/compare·/vs·/solutions·/for`, no `/llms.txt`, 61 `.mdoc` posts with no `Article` schema or `updatedAt`. Research finds a bare Capterra listing (`capterra.com/p/10040726/Altyaa`, 0 reviews, $99 flat), no Wikidata/Crunchbase/LinkedIn, 0 listicle inclusions, 0 Reddit presence; contrast: Birdeye 3,502 G2 @4.7 / 704 Capterra @4.7. SoAV recorded as ~0% — the honest starting line.
2. **Supply-chain.** Per-engine diet table: ChatGPT ~51% earned media + Reddit; Perplexity ~46.5% Reddit + freshness; Gemini listicle/GBP; Claude Capterra + editorial; **Le Chat — DIY probe only, France's #1 own engine**. Justifies P3 > P1/P2 in leverage.
3. **Wedge + targets.** "Altyaa is an AI-powered reputation and social-media management platform for local SMBs that drafts review replies and social posts for operator approval — $99 flat · French-first · approved-by-you." The empty slot: done-for-you AI operator, French-native, published flat price. 30 answer-targets → Q1 *meilleur logiciel d'e-réputation PME*, Q29 *flat $99 tool that runs my reviews and social posts*, Q30 *how can a local business show up in ChatGPT*.
4. **Pillars + sequencing.** P1-P6 authored; Track A ships the wedge + entity nodes + SoAV scoreboard + the Durante content engine (re-aim 61 posts + owned listicles) on day-0; Track B (reviews, competitor `/compare` publish) waits for customers; Track C (Appvizer/Capterra.fr/Reddit) starts early, lands PH2+. Phases PH0→PH3 target ~0% → ≥10% (FR first) → ≥30% → ≥50%.
5. **Architecture.** ADR-01…06 land on the verified `faq/page.tsx` pattern; `AggregateRating` gated default-OFF behind `reviews-source.ts` returning null (verified 0 reviews).
6. **Basket.** 15 FR / 15 EN, versioned at `tooling/soav/basket.json`, v0 baseline recorded as ~0% per-engine × per-language.
7. **Skeptic pass.** Refutes and moves to `> DO NOT CITE`: the *22% SimilarWeb FR* stat (unfindable), Princeton *+115%/+41%/+28%* (real headline ~40%), freshness *82%/37%/4-10×* (no primary), pillar-cluster *41%/12%/3×* (not in source), Zapier *40%-of-3M*. Re-attributes the *82-85% third-party* figure to Muck Rack (Dec 2025) and the *3.4×* to Otterly.AI 2025 (single-vendor, directional). The customer-base gate is surfaced as the GM3 hard blocker before any review seeding is scheduled.

**Output:** `geo/recommendation-roadmap.md` + `geo/architecture.md` + `geo/query-basket.md` — decision-grade, every stat sourced or quarantined, reviews pillar gated on a real customer base.
