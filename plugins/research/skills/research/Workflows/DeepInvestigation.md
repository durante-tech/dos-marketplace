---
name: Investigation Vault
description: Iterative multi-hour knowledge vault with structured output
status: STABLE
featured: true
successRate: 91
icon: Search
bestPath:
  - title: "Scope Definition"
    description: "Define investigation boundaries, targets, and depth parameters."
  - title: "Iterative Deep Search"
    description: "Execute multi-hour search cycles with progressive refinement."
  - title: "Knowledge Indexing"
    description: "Index and cross-reference all findings into structured knowledge base."
  - title: "Vault Export"
    description: "Export investigation vault with full provenance and source chains."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Research DeepInvestigation workflow has bespoke Output section with workflow-specific shape"
---


# Deep Investigation Workflow

**Mode:** Iterative progressive research | **Single-run or Loop mode**

## 🚨 CRITICAL: URL Verification Required

**BEFORE delivering any research results with URLs:**
1. Verify EVERY URL using WebFetch or curl
2. Confirm the content matches what you're citing
3. NEVER include unverified URLs - research agents HALLUCINATE URLs

See `SKILL.md` for full URL Verification Protocol.

---

## When to Use

- User says "deep investigation", "investigate [topic]", "deep research on [market/landscape/domain]"
- Competitive analysis, market mapping, threat landscape, technology survey
- Any research that benefits from **iterative deepening** — broad discovery first, then progressively deeper dives on the most important entities
- User explicitly requests loop mode research

## How It Works

This workflow implements a **progressive narrowing funnel**:

```
Iteration 1: Broad landscape → discover entities → score them → deep-dive the top one
Iteration 2: Read previous artifacts → pick next highest-value entity → deep-dive
Iteration 3+: Continue until coverage gates pass
```

**Single-run mode:** Completes one full cycle (landscape through first deep dive).
**Loop mode:** The Algorithm's loop mechanism drives iterations. Each iteration reads previous artifacts and deepens coverage. The workflow is stateless — all state lives in artifacts on disk.

---

## Vault Location

All artifacts persist at:
```bash
# Resolve project-level RESEARCH dir (falls back to global)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/RESEARCH" ]; then
  RESEARCH_BASE="${CLAUDE_PROJECT_DIR}/MEMORY/RESEARCH"
elif [ -d "$(pwd)/MEMORY/RESEARCH" ]; then
  RESEARCH_BASE="$(pwd)/MEMORY/RESEARCH"
else
  RESEARCH_BASE="$HOME/.claude/MEMORY/RESEARCH"
fi
```
```
$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_{topic-slug}/
```

Read `~/.claude/MEMORY/STATE/current-work.json` for the active work directory.

---

## Workflow

### Step 0: Detect Iteration State

READ the vault directory and ENTITIES.md, then ask the tested owner which phase
to jump to. Parsing ENTITIES.md into the structured entity rows is your job
(read the markdown table); the phase branch itself is deterministic and lives in
`ResearchVaultGates.ts iteration-state` (oracle-tested), so the resumption logic
can't drift from the Step 5 gates:

```bash
# entities = JSON array of {name,category,status,value?,effort?} parsed from ENTITIES.md
bun ~/.claude/skills/research/Tools/ResearchVaultGates.ts iteration-state "$(jq -nc \
  --argjson landscape <LANDSCAPE.md exists: true|false> \
  --argjson entitiesFile <ENTITIES.md exists: true|false> \
  --argjson entities '<entities-json or []>' \
  '{landscapeExists:$landscape,entitiesExists:$entitiesFile,entities:$entities}')"
```

It prints one of:
- `STEP_1_LANDSCAPE` — neither artifact exists → FIRST ITERATION (start at Step 1)
- `STEP_4_INVESTIGATE` — continuation, a PENDING CRITICAL/HIGH entity remains
- `STEP_3_DISCOVER` — continuation, CRITICAL/HIGH done but categories incomplete
- `EXIT_COMPLETE` — continuation, both gates pass → EXIT (report completion)

**This is the key to loop mode.** The Algorithm re-runs the full workflow each iteration, but the workflow itself checks what's already done and jumps to the right phase. No loop control logic here — just artifact-aware resumption.

---

### Step 1: Landscape (Broad — First Iteration Only)

**Goal:** Understand the full landscape. This is the EXPENSIVE phase — do it once, reference it cheaply in all later iterations.

**Select domain template pack:** Read `Templates/{domain}.md` based on user's topic. If no exact match, use the closest template or create entity categories dynamically.

**Launch Extensive Research (9-12 agents):**

```
Use the Extensive Research pattern (3 researcher types x 3 threads):

Angles should cover:
- Market/domain overview and structure
- Key players and competitive dynamics
- Recent developments and trends
- Historical context and evolution
- Adjacent domains and cross-cutting themes
- Contrarian views and underappreciated dynamics
```

**Produce LANDSCAPE.md:**

```markdown
# {Topic} Landscape

## Overview
[2-3 paragraph synthesis of the domain]

## Market/Domain Structure
[Segmentation, categories, size if applicable]

## Key Dynamics
[What forces shape this domain? What's changing?]

## Entity Categories
[From domain template pack or discovered dynamically]
- Category 1: [description, estimated entity count]
- Category 2: [description, estimated entity count]
- ...

## Initial Entity Discoveries
[Entities found during landscape research — transfer to ENTITIES.md]

## Sources
[Verified URLs only]
```

After saving LANDSCAPE.md, log the artifact. The JSONL line is rendered by the
golden-tested owner (`ResearchRender.ts log-artifact`) — it fixes the line
schema and key order so all workflows stay byte-identical:

```bash
LANDSCAPE_PATH="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{topic-slug}/LANDSCAPE.md"
PREVIEW="$(head -c 200 "$LANDSCAPE_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact "$(jq -nc \
  --arg title "{topic} Landscape" --arg path "$LANDSCAPE_PATH" \
  --arg preview "$PREVIEW" --arg ts "$(date -u +%FT%TZ)" --arg sid "${DOS_SESSION_ID:-}" \
  '{workflow:"DeepInvestigation",title:$title,path:$path,contentPreview:$preview,sessionId:$sid,timestamp:$ts}')" \
  >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

**Produce ENTITIES.md:**

```markdown
# Entity Catalog

## Status Legend
- **PENDING** — Discovered, not yet researched
- **RESEARCHED** — Full profile created in vault
- **SKIP** — Evaluated as not worth deep research

## Value Legend
- **CRITICAL** — Defines the domain. Must research.
- **HIGH** — Major player. Research if time allows.
- **MEDIUM** — Notable. Research in later iterations.
- **LOW** — Minor. Skip unless specifically relevant.

## Effort Legend
- **EASY** — Abundant public information
- **MODERATE** — Good web presence, some digging needed
- **HARD** — Limited public info, requires deep searching

---

| Entity | Category | Status | Value | Effort | Profile |
|--------|----------|--------|-------|--------|---------|
| [name] | [category] | PENDING | — | — | — |
```

After saving ENTITIES.md, log the artifact via the golden-tested renderer:

```bash
VAULT_DIR="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{topic-slug}"
ENTITIES_PATH="$VAULT_DIR/ENTITIES.md"
PREVIEW="$(head -c 200 "$ENTITIES_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact "$(jq -nc \
  --arg title "{topic} Entity Catalog" --arg path "$ENTITIES_PATH" \
  --arg preview "$PREVIEW" --arg ts "$(date -u +%FT%TZ)" --arg sid "${DOS_SESSION_ID:-}" \
  '{workflow:"DeepInvestigation",title:$title,path:$path,contentPreview:$preview,sessionId:$sid,timestamp:$ts}')" \
  >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

**Produce INDEX.md:**

```markdown
# {Topic} Research Vault

**Created:** {date}
**Domain Template:** {template name}
**Status:** IN PROGRESS

## Navigation
- [Landscape](LANDSCAPE.md)
- [Entity Catalog](ENTITIES.md)

## Profiles
[Updated as profiles are created]

## Coverage
- Categories: 0/{N} complete
- Entities: 0 RESEARCHED / {N} total
- CRITICAL/HIGH: 0 RESEARCHED / {N} pending
```

After saving INDEX.md, log the artifact via the golden-tested renderer:

```bash
VAULT_DIR="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{topic-slug}"
INDEX_PATH="$VAULT_DIR/INDEX.md"
PREVIEW="$(head -c 200 "$INDEX_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact "$(jq -nc \
  --arg title "{topic} Research Vault Index" --arg path "$INDEX_PATH" \
  --arg preview "$PREVIEW" --arg ts "$(date -u +%FT%TZ)" --arg sid "${DOS_SESSION_ID:-}" \
  '{workflow:"DeepInvestigation",title:$title,path:$path,contentPreview:$preview,sessionId:$sid,timestamp:$ts}')" \
  >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

---

### Step 2: Evaluate (Score Entities)

**For each PENDING entity without a VALUE score:**

Assess on two dimensions:

**VALUE (Market/Domain Impact):**
- **CRITICAL** — Market leaders, category definers, essential to understanding the domain
- **HIGH** — Major players, significantly influence the domain
- **MEDIUM** — Notable contributors with specialized focus
- **LOW** — Minor players, marginal impact

**EFFORT (Information Accessibility):**
- **EASY** — Public companies, abundant documentation, press coverage
- **MODERATE** — Good web presence, some proprietary info
- **HARD** — Limited public info, stealth-mode, minimal coverage

**Priority Order for Investigation:**
1. CRITICAL + EASY (highest ROI)
2. CRITICAL + HARD (must-have despite difficulty)
3. HIGH + EASY (good ROI)
4. HIGH + HARD (worthwhile if time allows)
5. MEDIUM+ only after all CRITICAL/HIGH done

**Update ENTITIES.md** with VALUE and EFFORT scores.

---

### Step 3: Discover (Expand Coverage)

**Goal:** Find entities in undercovered categories.

Identify the undercovered ("thin") categories — those with fewer than 3
entities — via the tested owner (the `< 3` floor is the gate that drifts, so it
lives in code, oracle-tested):

```bash
# entities = JSON array parsed from ENTITIES.md
bun ~/.claude/skills/research/Tools/ResearchVaultGates.ts thin-categories '<entities-json>'
# -> JSON array of thin category names, in first-seen order
```

For each thin category returned:

**Run a targeted discovery spawn (re-routed 2026-07-10, Tailor Gen 59 — the intent API is a
Phase-1 stub until RFC-0015 §15 Phase 3):**
```
Task(subagent_type="PerplexityResearcher", description="Discover {entity_category} in {domain}",
     prompt="Find 3-5 notable {entity_category} in the {domain} space.
             For each: name, one-line description, why they matter.
             Already known: {list existing entities in this category}.
             Find NEW ones not in that list.
             Return findings in DOS output format with cited source URLs.")
```

**Add discoveries to ENTITIES.md** with status PENDING, then run Step 2 (Evaluate) on them.

---

### Step 4: Investigate (Deep Dive — One Entity)

**Goal:** Create a comprehensive profile of ONE entity. Quality over quantity.

**Select the highest-priority PENDING entity** via the tested owner — the sort
key (VALUE CRITICAL-first, then EFFORT EASY-first, PENDING-only) is deterministic
and oracle-tested, so it doesn't get re-derived by hand each iteration:

```bash
# entities = JSON array parsed from ENTITIES.md
bun ~/.claude/skills/research/Tools/ResearchVaultGates.ts next-entity '<entities-json>'
# -> JSON of the selected entity (or null if nothing PENDING)
```

**Load the profile template** from the domain template pack for this entity's category.

**Run focused research via the intent API (three distinct sub-queries
collapse into a single umbrella call; router dispatches count=3 providers
across distinct api_backends for diversity):**

**Spawn three researchers in one message (re-routed 2026-07-10, Tailor Gen 59 — restores the
pre-migration per-sub-question isolation the umbrella collapse had removed; the intent API is a
Phase-1 stub until RFC-0015 §15 Phase 3):**

```
Task(subagent_type="ClaudeResearcher",     description="Profile {entity_name}: core attributes",
     prompt="Deep profile of {entity_name} in {domain} — core attributes per template:
             {template_fields_for_this_category}
             (context: {1-paragraph from LANDSCAPE.md about this entity's category}).
             Return findings in DOS output format with citations.")
Task(subagent_type="PerplexityResearcher", description="Profile {entity_name}: recent developments",
     prompt="Recent developments for {entity_name} — last 12 months funding, product
             launches, key hires, partnerships. Cited current-web sources required.
             Return findings in DOS output format.")
Task(subagent_type="GeminiResearcher",     description="Profile {entity_name}: competitive position",
     prompt="Competitive position of {entity_name} in {domain} — strengths, weaknesses,
             comparison with {list 2-3 related entities from ENTITIES.md}. What makes
             them distinctive? Return findings in DOS output format.")
```

Backend fit: Claude = academic/template depth, Perplexity = cited recency, Gemini =
cross-domain comparison — the same coverage the umbrella prompt promised, with real isolation.

**Produce entity profile** using the domain template:

Save to: `vault/{Category}/{entity-slug}.md`

**Add cross-links:** Reference related entities discovered during research using `[Entity Name](../Category/entity-slug.md)` links.

**Update ENTITIES.md:** Mark entity as RESEARCHED, add profile link.

**Update INDEX.md:** Add profile to navigation.

After saving the entity profile, log the artifact via the golden-tested renderer:

```bash
VAULT_DIR="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{topic-slug}"
PROFILE_PATH="$VAULT_DIR/{Category}/{entity-slug}.md"
PREVIEW="$(head -c 200 "$PROFILE_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact "$(jq -nc \
  --arg title "{entity_name} Profile — {domain}" --arg path "$PROFILE_PATH" \
  --arg preview "$PREVIEW" --arg ts "$(date -u +%FT%TZ)" --arg sid "${DOS_SESSION_ID:-}" \
  '{workflow:"DeepInvestigation",title:$title,path:$path,contentPreview:$preview,sessionId:$sid,timestamp:$ts}')" \
  >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

---

### Step 5: Progress Check (Loop Gate)

**Two gates must BOTH pass to exit.** Both are deterministic predicates over the
parsed entity rows, with one oracle-tested owner each (the `>= 3` floor and the
CRITICAL/HIGH completion rule are exactly the thresholds that silently drift in
prose). Evaluate them via the CLI:

**Breadth Gate** — every category has >= 3 entities with status != SKIP:
```bash
bun ~/.claude/skills/research/Tools/ResearchVaultGates.ts breadth-gate '<entities-json>'
# -> "true" (PASS) / "false" (FAIL)
```

**Depth Gate** — every CRITICAL/HIGH entity is RESEARCHED or SKIP (none PENDING):
```bash
bun ~/.claude/skills/research/Tools/ResearchVaultGates.ts depth-gate '<entities-json>'
# -> "true" (PASS) / "false" (FAIL)
```

**Gate Results:**

```
IF both gates PASS:
  → Produce SUMMARY.md (executive synthesis of all findings)
  → Update INDEX.md with final statistics
  → Log SUMMARY.md artifact (see below)
  → Report completion to Algorithm's VERIFY phase

IF either gate FAILS:
  → Report to Algorithm's VERIFY phase: "Coverage incomplete"
  → The Algorithm's loop mode will trigger next iteration
  → Next iteration re-enters this workflow at Step 0 (which detects continuation)
```

When SUMMARY.md is produced (gates pass), log the artifact via the golden-tested renderer:

```bash
VAULT_DIR="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{topic-slug}"
SUMMARY_PATH="$VAULT_DIR/SUMMARY.md"
PREVIEW="$(head -c 200 "$SUMMARY_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact "$(jq -nc \
  --arg title "{topic} Investigation Summary" --arg path "$SUMMARY_PATH" \
  --arg preview "$PREVIEW" --arg ts "$(date -u +%FT%TZ)" --arg sid "${DOS_SESSION_ID:-}" \
  '{workflow:"DeepInvestigation",title:$title,path:$path,contentPreview:$preview,sessionId:$sid,timestamp:$ts}')" \
  >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

**The workflow does NOT control the loop.** It reports pass/fail. The Algorithm decides whether to iterate.

---

## Single-Run vs Loop Mode

| Aspect | Single-Run | Loop Mode |
|--------|-----------|-----------|
| Iterations | 1 | Algorithm-controlled (N turns) |
| Coverage | Landscape + first deep dive | Full breadth + depth gates |
| Exit | After Step 4 completes | After Step 5 gates pass |
| Best for | Quick overview + top entity | Comprehensive investigation |
| Time | 3-5 minutes | 15-60 minutes (varies by domain) |

**In single-run mode:** Complete Steps 1-4 (landscape through one deep dive), then report what was accomplished and what remains PENDING for a future loop-mode run.

**In loop mode:** The Algorithm iterates. Each iteration enters at Step 0, detects state, and does the next unit of work. Typical iteration pattern:
- Iteration 1: Steps 1-4 (landscape, discover, evaluate, first deep dive)
- Iteration 2-N: Steps 0→4 (detect state, maybe discover more, evaluate, deep dive next)
- Final iteration: Step 0→5 (detect state, gates pass, produce summary)

---

## Domain Template Packs

Templates live at `~/.claude/skills/research/Templates/{DomainName}.md`

Each template pack defines:
1. **Entity categories** for this domain (what types of things to discover)
2. **Profile templates** per category (what fields to research for each type)
3. **Evaluation criteria** (what makes something CRITICAL vs LOW in this domain)
4. **Search strategies** (domain-specific search tips for researchers)

**Available packs:**
- `MarketResearch.md` — Companies, Products, People, Technologies, Trends
- `ThreatLandscape.md` — Threat Actors, Campaigns, TTPs, Vulnerabilities

**No template match?** The workflow dynamically creates entity categories based on the landscape research in Step 1. Templates improve quality but aren't required.

---

## Output Artifacts

After a complete investigation, the vault contains:

```
{vault}/
  INDEX.md                  — Navigation hub with coverage stats
  LANDSCAPE.md              — Broad domain analysis (created once, referenced often)
  ENTITIES.md               — Master catalog with status tracking
  SUMMARY.md                — Executive synthesis (created on completion)
  Companies/                — Entity profiles by category
    company-a.md
    company-b.md
  Products/
    product-x.md
  People/
    person-y.md
  ...
```

All profiles are cross-linked. The vault is self-contained and readable as a standalone knowledge base.

## Intent-to-Flag Mapping

The only CLIs this workflow shells out to are deterministic DOS Research plumbing. There is no intent-to-flag table because no flag varies by operator intent — each invocation is fully determined by the workflow step:

- `bun ~/.claude/skills/research/Tools/ResearchVaultGates.ts <iteration-state|thin-categories|next-entity|breadth-gate|depth-gate>` — pure predicates over the parsed ENTITIES.md rows (Steps 0, 3, 4, 5). The subcommand is fixed by the step and the sole argument is JSON *data* (entity rows / artifact-existence booleans), not a user-selectable option.
- `bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact <json>` — renders one byte-identical `artifacts.jsonl` line. The subcommand is fixed and the argument is the artifact payload, not an intent flag.

The deep-search dispatch in Steps 3-4 runs through Task-spawned researcher subagents whose agent prompts bind the provider CLIs with fixed flags, so no operator-variable provider flags surface in this file. Contrast `StandardResearch.md` / `ClaudeResearch.md`, whose provider CLIs (`Perplexity.ts`, `BraveSearch.ts`, …) expose operator-variable flags (`--model`, `--recency`, `--reasoning`, `--search-mode`) that genuinely map to research intent and therefore carry a real table.