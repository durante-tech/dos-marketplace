# Voice-Channeling Skill — Template

**Purpose:** Compress run 5+ of a voice-channeling skill (channel a named author/duo's voice) from Extended → Standard effort by codifying the pattern proven across UncleBob, Cockburn, Fowler, Pragmatic.

**Use when:** the user asks for a research-then-build skill that channels a specific software-engineering author's voice (e.g., Kent Beck, Sandi Metz, Michael Feathers, Eric Evans).

**Skip when:** the request isn't a voice-channeling skill (no first-person impersonation, no named author, no quote-driven authority pattern).

---

## The Lineage (9 proven precedents)

| Skill | Person | First-person | Cadence | Color | Icon |
|---|---|---|---|---|---|
| uncle-bob | Robert C. Martin (1) | "I" | moralistic-imperative | `#c97c4f` | `BookOpen` |
| cockburn | Alistair Cockburn (1) | "I observed" | anthropological | `#3b6e8f` | `Hexagon` |
| fowler | Martin Fowler (1) | "I've heard / I've written" | pragmatic-tradeoff | `#5a7d3a` | `Layers` |
| pragmatic | Andy Hunt + Dave Thomas (2) | **"we"** | practical-anecdotal-numbered | `#b8772f` | `ListChecks` |
| kent-beck | Kent Beck (1) | "I" | investigative-empirical-practitioner | `#7a5da3` | `TestTube` |
| eric-evans | Eric Evans (1) | "I" | strategic-modeller-with-domain-expert | `#3a6b6b` | `GitBranch` |
| feathers | Michael Feathers (1) | "I" | surgical-archaeological-methodical | `#5d6b7a` | `Microscope` |
| sandi-metz | Sandi Metz (1) | "I" | pedagogical-rule-grounded | `#a73c5d` | `Diamond` |
| greg-young | Greg Young (1) | "I" | blunt-inventor's-license-confessional | `#8b4d2e` | `ArrowDownUp` |

**Differentiation rule:** every new voice-channeling skill MUST have a load-bearing voice distinction from all four prior siblings. If you can't articulate the distinction in one sentence, the new skill will collapse into a clone.

---

## Two-Turn Delivery Pattern

### Turn 1 — Research Vault

**Effort:** Extended (Standard once template internalized).
**Profile:** deterministic workflow — vault shape locked.

**Steps:**
1. **Voice + sync-check baseline + mkdir + memory recall** in single parallel batch
2. **PRD stub** with 22-24 ISCs targeting the 7-file vault
3. **Spawn 3 parallel agents** with corpus-split briefs (see "Three-Agent Corpus Split" below)
4. **Assemble vault** — 7 files in parallel writes (see "Vault Files (Locked Shape)")
5. **VERIFY + LEARN reflection** logged to JSONL

**Vault location:** `MEMORY/RESEARCH/{YYYY-MM-DD}_{author-slug}/`

### Turn 2 — Skill Scaffold

**Effort:** Standard.
**Profile:** deterministic workflow — same shape as prior 4 siblings.

**Steps (apply ALL 4 prior-run learnings):**
1. **sync-check baseline at OBSERVE** (Cockburn LEARN)
2. **Single parallel batch:** PRD + SKILL.md + 5 cp + 3 workflow Writes (Cockburn LEARN)
2.5. **Author the manifest layer (MANDATORY per RFC-0011, RFC-0002, RFC-0004 §6.1)** — see block below.
3. **`cp -r` to Pack source** for Four-Copy mirror
4. **Pre-flight `bun Tools/validate-brand-voice.ts --paths 'Packs/{NewPack}/src/**/*.md'`** BEFORE commit (Fowler+Pragmatic LEARN — use `--paths` since DEFAULT_GLOBS doesn't include Packs/**)
5. **Anticipate ONE allowlist addition** — every voice-channeling skill so far has hit one verbatim-canonical-author-terminology violation (Cockburn=Guarantees, Fowler=multiplies, Pragmatic=leverage). Pre-stage the allowlist update.
6. **Commit submodule first** with explicit pathspec, **`cd ~/Durante` before parent commit** (memory: shell cwd persists)
7. **Run R11 verification** — `bun ~/Durante/Tools/dos-toolchain/lint-skills.ts --rule R11 --pack <NewPack>` MUST exit 0 before commit (pre-commit Gate 12 enforces).

#### Step 2.5 — Manifest layer (MANDATORY)

THREE files are REQUIRED for every voice-channeling pack regardless of inlined-mode SKILL.md authoring. Add these to the single parallel batch in Step 2:

| File | Content | Reference |
|------|---------|-----------|
| `Packs/<NewPack>/plugin.json` | `{"name":"<X>","dos":{"bridge":[]}}` (zero-bridge — static-analysis confirms voice-channeling skills don't invoke MemPalace bridge) | `Packs/brand/plugin.json` |
| `Packs/<NewPack>/src/extension.yaml` | RFC-0002 minimal manifest with `contributes: {}`, `requires: {}`, and metadata block listing pack/invocation/skill_path/roots/workflows/runtime_effects/voice_channeling=true | `Packs/cockburn/src/extension.yaml` (post-2026-04-30 remediation) |
| `MEMORY/ARCHIVE/RFC-0006/Phase3/Verification/slice-<N>-not-partializable-<context>.md` | Document the legacy-inlined SKILL.md divergence per RFC-0006 §5.2c. Voice-channeling skills MAY share one doc covering all of them — see `slice-9-not-partializable-voice-channeling.md` precedent. | RFC-0006 §5.2c |

**Why this matters:** Without these manifests, R11 fires WARN findings, pre-commit Gate 12 blocks (when in block mode), and the pack is invisible to RFC-0011 release manifest curation. The 2026-04-27 cohort (UncleBob, Cockburn, Fowler, Pragmatic, KentBeck, EricEvans, Feathers, SandiMetz, GregYoung) shipped without these and required a 19-file remediation pass on 2026-04-30 — Step 2.5 prevents that regression for future voice-channeling skills.

#### Step 2.6 — Pack-root distribution docs (MANDATORY)

After authoring the manifest layer in Step 2.5, scaffold the 4-file pack-distribution docs:

```bash
bun ~/Durante/Tools/scaffold-pack-docs.ts --pack <NewPack>
```

This generates `INSTALL.md` + `README.md` + `VERIFY.md` at the pack root, modeled on `Packs/agents/*` exemplars. The scaffolder reads SKILL.md frontmatter, lists src/ tree, and templates per-pack content.

These three files are required by `Packs/README.md` 4-file contract. Without them, the pack cannot be installed standalone (no INSTALL.md → AI has nothing to read), is invisible on GitHub (no README.md → empty directory landing), and has no validation path (no VERIFY.md → silent install failure mode).

R12 in `lint-skills.ts` and pre-commit Gate 13 enforce presence (warn → block after 14-day rollout).

---

## Vault Files (Locked Shape)

Every voice-channeling research vault contains these 7 files:

| File | Purpose | Typical LOC |
|---|---|---|
| `INDEX.md` | Vault entry-point + skill-creation blueprint | 60-100 |
| `SKILLDRAFT.md` | Full SKILL.md draft ready for paste | 180-220 |
| `Principles.md` | All verbatim canonical references | 270-380 |
| `QuoteBank.md` | ≥30 verbatim Tier-A quotes, source-tagged, topic-clustered | 145-160 |
| `Lookup.md` | Letter-prefix-tagged anti-patterns (e.g. HEX-1, CS-1, PBC-1) | 110-160 |
| `StepAsideTable.md` | Adjacent authors + concessions + named peer engagements | 135-150 |
| `Biography.md` | Dated personal-history hooks 1900-present + per-workflow rotation lists | 85-180 |

Total vault: **1000-1300 LOC** typical.

---

## Three-Agent Corpus Split (proven across 9 runs)

**IP-safety stance (mandatory for copyrighted-author runs):** every research-agent brief MUST include the boilerplate paragraph from `voice-channeling-ip-policy.md` — short canonical terms tagged `[verbatim]`, extended copyrighted body prose tagged `[paraphrase]` with faithful substance. Never reconstruct extended in-copyright prose and tag it verbatim.

When spawning the 3 parallel research agents, use one of these splits per the author's body of work:

### Split A — Single-author with broad book corpus (UncleBob, Cockburn, Fowler)

| Agent | Corpus |
|---|---|
| A | Architecture / core-discipline (the author's central technical contribution) |
| B | Methodology / practices / secondary contributions |
| C | Voice + Bio + adjacent works (biographical hooks, voice cadence, named peer engagements, books) |

### Split B — Co-author duo (Pragmatic, candidate for Beck+Cunningham)

| Agent | Corpus |
|---|---|
| A | Tips/Concepts catalog (named bullets / patterns) |
| B | Practices + Anti-Patterns (applied advice) |
| C | Voice + Bio + Books (BOTH authors, with disambiguation if name-conflicts exist) |

### Pre-Delegation Contract (all agents)

- **Output:** single markdown response, sections named exactly per the agent brief.
- **Quote tagging:** every quote MUST be tagged `[verbatim]` or `[paraphrase]`. Unmarked = paraphrase by convention; explicit tagging prevents downstream "verbatim" claims being false.
- **Source citation:** every verbatim quote needs book + chapter/page OR URL + access path. URLs must be real (agent should WebFetch-verify if uncertain).
- **Floor:** ≥10 verbatim quotes per agent, ≥30 total across 3 agents.
- **Anti-tells:** no paraphrasing as verbatim, no drift into peer agents' corpora, no biographical filler.
- **Time budget:** 4 minutes per agent.

---

## SKILL.md Frontmatter Template

```yaml
name: {AuthorName}                    # PascalCase, single word (Cockburn, Fowler, Pragmatic)
description: Channel {full-name} — {3-clause summary of their contribution}. {1-sentence voice distinction from prior siblings}. {1-clause "knows when to step aside"}. USE WHEN {15-25 trigger keywords from the author's named contributions}.
role: advisor
accepts: [text, code, design]
icon: {LucideIconName}                # Hexagon / Layers / ListChecks — distinct from siblings
colorVar: secondary
colorHex: "{#hex}"                    # Distinct from #c97c4f, #3b6e8f, #5a7d3a, #b8772f
tier: secondary
category: Engineering
displayLabel: {Display Name}
marketingDescription: "..."
capabilities:
  - "{Workflow 1 capability}"
  - "{Workflow 2 capability}"
  - "{Workflow 3 capability}"
  - "Step aside for contexts {author}'s frameworks don't address — point at the right author"
elevator: "..."
highlightWorkflows:
  - name: {Workflow1}
    technicalName: {Workflow1}
  - name: {Workflow2}
    technicalName: {Workflow2}
  - name: {Workflow3}
    technicalName: {Workflow3}
roots: [PROJECT.ARTIFACTS]
visibility: public
artifact_tracking:
  enabled: true
  roots:
    - MEMORY/ARTIFACTS
  types:
    - {type-1}
    - {type-2}
    - {type-3}
  log_path: MEMORY/ARTIFACTS/artifacts.jsonl
```

---

## Three Workflows (5-Part Fixed Output Each)

Every voice-channeling skill has exactly 3 workflows, each with a 5-part fixed-output shape. The sibling table:

| Skill | Workflow 1 (Diagnose-style) | Workflow 2 (Coach/Define-style) | Workflow 3 (Recommend/Apply-style) |
|---|---|---|---|
| uncle-bob | Diagnose | Coach | SteelMan |
| cockburn | architect | WriteUseCase | PickMethodology |
| fowler | Refactor | DefineTerm | WriteArchPattern |
| pragmatic | (TipLookup serves dual) | TipLookup | PragmaticDiagnose / KnowledgePortfolio |
| kent-beck | TestFirst | TidyFirst | ExperimentDesign |
| eric-evans | BoundedContext | UbiquitousLanguage | AggregateDesign |
| feathers | BreakDependency | CharacterizationTest | SeamFind |
| sandi-metz | ApplyRules | WorkExample | AbstractionCheck |
| greg-young | CqrsCheck | EventSource | CommandQuerySplit |

**Common 5-part shape (Diagnose-style):**

1. **The Diagnosis** — name the worst tag from `Lookup.md`, open with the author's signature anecdote/quote
2. **The Specific Issue** — file:line, what's there, what should be there in the author's terms
3. **The Refactor / Fix / Application** — minimal before/after or concrete prescription
4. **The Author Quote** — verbatim from `QuoteBank.md`, source-tagged
5. **The Closing Move** — author-specific (Bob's moral injunction, Cockburn's observation, Fowler's tradeoff, Pragmatic's habit-for-tomorrow)

**One pattern, one fix, one quote, one closing. Save the rest for follow-up turns.**

---

## Voice Distinction Worksheet (mandatory before scaffolding)

Fill in for the new author BEFORE writing SKILL.md:

```
1. First-person register:
   - "I" / "we" / "I observed" / "I've written" / other?
   - WHY this register is load-bearing for THIS author specifically

2. Opening move:
   - What does the author DO at the start of an essay/chapter/talk?
   - Bob: dated personal-history hook
   - Cockburn: field observation from interviews
   - Fowler: definition or framing pivot
   - Pragmatic: dated joint hook + story
   - {New author}: ?

3. Closing move:
   - What does the author DO at the end?
   - Bob: moral injunction ("demand technical excellence")
   - Cockburn: observation re-stated higher
   - Fowler: tradeoff statement / cross-reference
   - Pragmatic: small concrete habit
   - {New author}: ?

4. Vocabulary register:
   - Bob: theological ("discipline", "professional", "you must")
   - Cockburn: game-theoretic ("cooperative game", "warm bodies")
   - Fowler: cost-language ("premium", "tax", "tradeoff")
   - Pragmatic: portfolio/garden ("invest", "weed", "broken windows")
   - {New author}: ?

5. Anti-tells (≥6 explicit don'ts that distinguish from siblings):
   1.
   2.
   3.
   4.
   5.
   6.
```

If you can't fill this in confidently, **abort scaffolding** and do more research. A voice-channeling skill that collapses into a sibling's voice is worse than no skill at all.

---

## Brand-Voice Allowlist (a tendency, not a law)

Empirical observation across 9 runs: **5 of 9 ship clean** (UncleBob, KentBeck, EricEvans, SandiMetz, GregYoung); **2 hit verbatim-canonical violations requiring allowlist entries** (Cockburn, Pragmatic); **2 hit own-prose violations fixed by rephrase** (Fowler, Feathers). **Do NOT pre-stage allowlist additions** — run pre-flight first, only allowlist-add when a real violation surfaces from a verbatim source.

| Skill | Term | Why allowlisted (or rephrased) |
|---|---|---|
| uncle-bob | (none) | Bob's vocabulary aligns with brand voice |
| cockburn | "Guarantees" (Minimal Guarantees / Success Guarantees) | Verbatim *Writing Effective Use Cases* (2000) Ch. 6/7 template field names |
| fowler | "multiplies" | (Was my own prose, not verbatim — fixed by rephrase to "compounds") |
| pragmatic | "leverage" | Verbatim *PP2* Topic 18 ("It helps leverage your work and simplifies debugging and testing") |
| kent-beck | (none) | Beck's vocabulary aligns with brand voice |
| eric-evans | (none) | Evans's vocabulary aligns with brand voice |
| feathers | (none after rephrase) | Own prose "safety guarantee" / "safety guarantees" rephrased to "safety net" / "safety stories" (Fowler precedent) |
| sandi-metz | (none) | Metz's vocabulary aligns with brand voice |
| greg-young | (none) | Young's vocabulary aligns with brand voice |

**Pattern:** **clean runs (5/9) outnumber allowlist-add runs (2/9) and rephrase runs (2/9) combined.** The own-prose grep recipe (Anti-Patterns section below) added after Run #7 Feathers catches own-prose drift before the validator runs. The "expect ONE" prediction is a tendency, not a law — and the trend is toward more clean runs as the template stabilizes.

**Pre-flight:** run `bun Tools/validate-brand-voice.ts --paths 'Packs/{NewPack}/src/**/*.md'` BEFORE staging. If a violation surfaces:
- If the term is **verbatim canonical author terminology** → add file to FULL_FILE_ALLOWLIST in `Tools/validate-brand-voice.ts` with a comment explaining the source.
- If the term is **your own prose** → rephrase (Fowler's "multiplies" → "compounds" precedent).

---

## Color and Icon Distinctness Rule

Every new voice-channeling skill MUST have a `colorHex` and `icon` distinct from all prior siblings:

**Reserved:**
- `#c97c4f` (rust) — UncleBob
- `#3b6e8f` (cool slate) — Cockburn
- `#5a7d3a` (sage green) — Fowler
- `#b8772f` (mustard gold) — Pragmatic
- `#7a5da3` (muted violet) — KentBeck
- `#3a6b6b` (deep teal) — EricEvans
- `#5d6b7a` (slate gray) — Feathers
- `#a73c5d` (Ruby red) — SandiMetz
- `#8b4d2e` (burnt sienna) — GregYoung

**Reserved icons:**
- `BookOpen` — UncleBob
- `Hexagon` — Cockburn
- `Layers` — Fowler
- `ListChecks` — Pragmatic
- `TestTube` — KentBeck
- `GitBranch` — EricEvans
- `Microscope` — Feathers
- `Diamond` — SandiMetz
- `ArrowDownUp` — GregYoung

Pick from lucide-react names that semantically match the author's signature (e.g., `Wrench` for toolbelt-tier, `Compass` for navigation/orientation, `Telescope` for far-sighted-architectural, `Network` for distributed-systems, `Anchor` for foundational-stability).

---

## Boundary with Sibling Skills (cross-reference in StepAsideTable)

Voice-channeling skills overlap. Every new skill's `StepAsideTable.md` must explicitly route users to the right sibling for context the new skill doesn't own:

- Refactoring catalog with named transformations → **Fowler** (R-1..R-18 catalog) — *assumes tests exist*
- Code smells from Refactoring Ch. 3 → **Fowler** (CS-1..CS-17, with Beck attribution)
- SOLID, Three Laws of TDD, Clean Architecture → **UncleBob**
- Hexagonal Architecture, Use Case goal levels, Crystal methodology → **Cockburn**
- Numbered Tips, Knowledge Portfolio, Programming by Coincidence → **Pragmatic**
- Red-Green-Refactor on greenfield, Test List, Fake-It / Triangulate, Tidy First → **KentBeck**
- Bounded Context, Ubiquitous Language, Aggregate, Domain Event, Strategic Design → **EricEvans**
- Legacy code (no tests), Seam Model, Characterization Test, dependency-breaking catalog → **Feathers**
- Four Rules, Squint Test, Shameless Green, "duplication is far cheaper than the wrong abstraction", worked-example pedagogy → **SandiMetz**
- CQRS, Event Sourcing, left fold over events, projections, snapshots, "for most systems, CQRS is overkill" → **GregYoung**

Update this list as new skills ship.

---

## ISC Template (Turn 1 — Research)

22-24 ISCs covering the 7-file vault structure:

```
Identity & Voice (4):
- ISC-1: Dated personal-history hooks collected (≥4 hooks)
- ISC-2: Voice cadence portrait drafted with 3-or-4-way contrast vs siblings
- ISC-3: Anti-tells documented (≥6 explicit don'ts distinguishing from siblings)
- ISC-4: Signature analogies/metaphors collected

Principles (5-12, depending on author corpus):
- ISC-5..N: Each verbatim canonical reference with source

Quotes (3):
- ISC-N+1: ≥30 verbatim quotes total
- ISC-N+2: Every quote source-tagged
- ISC-N+3: Quotes organized into 6+ topic clusters

Diagnostic Lookup (1-3):
- Letter-prefix-tagged anti-patterns

Step-Aside (3):
- Author's own concessions catalogued
- Adjacent-author lookup per context
- ≥3 named peer engagements

Delivery (1):
- Vault saved at MEMORY/RESEARCH/{date}_{slug}/ with the 7-file structure
```

---

## ISC Template (Turn 2 — Skill Scaffold)

14 ISCs covering the live-skill scaffold:

```
- ISC-1: SKILL.md written with full frontmatter
- ISC-2: SKILL.md identity contract holds the chosen voice register throughout
- ISC-3: SKILL.md anti-tells section enumerates 8+ explicit don'ts
- ISC-4: Principles.md copied to live (verbatim canonical refs)
- ISC-5: QuoteBank.md copied to live (≥30 verbatim quotes)
- ISC-6: Lookup.md copied to live (letter-prefix-tagged anti-patterns)
- ISC-7: StepAsideTable.md copied to live (peer engagements + concessions)
- ISC-8: Biography.md copied to live (dated hooks)
- ISC-9: Workflows/Workflow1.md authored — fixed 5-part output shape
- ISC-10: Workflows/Workflow2.md authored — fixed 5-part output shape
- ISC-11: Workflows/Workflow3.md authored — fixed 5-part output shape
- ISC-12: Pack source mirror at Packs/{NewPack}/src/
- ISC-13: bun Tools/validate-brand-voice.ts --paths exit 0 (pre-flight)
- ISC-14: bun Tools/sync-check.ts exit 0 post-mirror
```

---

## Recurring Open Decisions (9-run pattern)

Each prior run deferred these decisions to "follow-on" — they are now defaulted via this template:

| Decision | Default (set here) |
|---|---|
| Workflow names | Use the sibling-aligned 3-workflow shape (Diagnose-style / Coach-style / Recommend-style). The operator may rename at scaffolding turn. |
| Council on workflow names | **Skip** unless the user asks. Nine runs deferred Council → it produces no value at the volume we're shipping. |
| Color hex | Pick distinct from reserved palette (see above). |
| Icon | Pick from lucide-react matching author's signature (see above). |
| Quote count | Target 40-55 verbatim. Publishing-prolific authors (Fowler, Pragmatic) hit higher; aphorism-heavy authors (Bob) hit lower. |

---

## Candidate Authors for Future Runs

Authors who fit the voice-channeling pattern and have published canonical material:

- **Pat Helland** — distributed systems essays, "data on the outside vs data on the inside" — distinctive paper-prose register.
- **Udi Dahan** — NServiceBus, "Domain Events Salvation" — adjacent to GregYoung's CQRS, distinctive messaging-bus voice.
- **Alberto Brandolini** — EventStorming workshop technique — pairs naturally with GregYoung's Event Sourcing.
- **DHH** — Rails, *37signals*, "Majestic Monolith" — strong opinionated register, may overlap politically.
- **Dan North** — BDD, CUPID — already engaged with UncleBob's SteelMan.
- **Rich Hickey** — *Simple Made Easy*, Clojure — distinctive philosophical register.
- **Kelsey Hightower** — Kubernetes / cloud-native — distinctive operator-engineer register.
- **Vaughn Vernon** — *Implementing DDD*, *Effective Aggregate Design* — already credited in EricEvans's StepAside; would overlap heavily.
- **Katrina Owen** — exercism.io founder, *99 Bottles of OOP* co-author — already credited in SandiMetz's StepAside.

When picking the next author, check:
1. Does the user have canonical writings (≥3 books / ≥20 talks / extensive blog)?
2. Is the voice register distinct from all 9 reserved?
3. Are there ≥30 verbatim quotes obtainable from public sources?
4. Will workflow surfaces overlap with siblings? (Plan StepAsideTable cross-references.)

---

## Anti-Patterns When Scaffolding (don't do these)

- **Don't skip the voice-distinction worksheet.** Skills that collapse into siblings' voices are dead weight.
- **Don't run `bun Tools/validate-brand-voice.ts` without `--paths` for new packs** — DEFAULT_GLOBS skips Packs/**, so default-mode pre-flight is silently incomplete.
- **Don't `cd ~/.claude` then forget to `cd ~/Durante` before parent commit** — shell cwd persists. (Memory: `git-commit-cwd-in-submodule.md`.)
- **Don't paraphrase verbatim quotes** — the entire skill is built on quote fidelity. Tag `[verbatim]` only for confirmed exact wording. (See `voice-channeling-ip-policy.md` for the full IP stance.)
- **Don't reconstruct extended in-copyright prose and tag it `[verbatim]`** — IP overreach. Short canonical terms `[verbatim]`, extended body prose `[paraphrase]` with faithful substance. (Memory: Run #7 Feathers self-correction.)
- **Don't skip the own-prose grep before the validator runs.** Quick recipe: `rg -n -i "guarantee\|leverage\|seamless\|empower\|production-grade\|production-ready\|revolutioniz\|game-changing\|synergy\|supercharg" Packs/{NewPack}/src/`. Hits in own prose → rephrase before pre-flight; hits inside `[verbatim]` source → consider allowlist-add. Catches own-prose violations before the validator does.
- **Don't conflate same-name authors** (Dave Thomas Pragmatic vs OTI; the two Marties: Fowler vs Martin). Disambiguate explicitly in StepAsideTable.

---

## Quick Reference (cheat sheet)

```bash
# Turn 1 — research vault
mkdir -p MEMORY/RESEARCH/$(date +%Y-%m-%d)_{author-slug}
# (PRD stub, then 3 parallel agents, then 7-file vault assembly)

# Turn 2 — scaffold skill
mkdir -p ~/.claude/skills/{NewSkill}/Workflows ~/Durante/Packs/{NewSkill}/src/Workflows
bun ~/Durante/Tools/sync-check.ts                         # baseline
# (write SKILL.md + cp 5 vault files + author 3 workflows in single batch)
cp -r ~/.claude/skills/{NewSkill}/* ~/Durante/Packs/{NewSkill}/src/
bun ~/Durante/Tools/validate-brand-voice.ts --paths 'Packs/{NewSkill}/src/**/*.md'   # pre-flight
bun ~/Durante/Tools/sync-check.ts                         # confirm
# (commit submodule, cd back to ~/Durante, commit parent)
```
