---
name: SentinelScan
description: Full codebase analysis pipeline — static analysis, pattern recognition, architecture artifacts (ADRs, C4, module map, tech debt score), MemPalace population, CLAUDE.md generation, and project registration.
status: STABLE
bestPath:
  - title: "Static Analysis"
    description: "Gather factual codebase data (stack, structure, git metadata) into a scan report."
  - title: "Pattern Recognition & Convergence"
    description: "Infer conventions and architecture artifacts, ground them against upstream canon, and tier findings."
  - title: "MemPalace Population"
    description: "Write KG facts and drawers for the project wing in one robust batch."
  - title: "Documentation Generation"
    description: "Write Docs/Sentinel/SNAPSHOT.md and the CLAUDE.md slim summary."
  - title: "Registration"
    description: "Register the project in PROJECTS.md, .dos-projects.json, and Studio."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Sentinel Scan workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Sentinel Scan workflow has bespoke Output section with workflow-specific shape"
---

# Sentinel Scan — The Awakening

Analyzes a codebase and populates all DOS knowledge systems. Run once per repo (or periodically to refresh).

<!-- partial: _workflow-voice.md skill_name=Sentinel workflow_name=Scan action_phrase=" to analyze this codebase" -->

## When to Use

- Triggered by "sentinel scan", "analyze repo", "discover conventions", "initialize", "scan codebase".
- Fits the cold-start/refresh case: analyze a codebase once (or periodically) and populate every DOS knowledge system from it.
- NOT for an empty project with no code yet — Scan auto-branches to Bootstrap when it detects < 3 source files, no CLAUDE.md, and no dependencies.

## Intent-to-Flag Mapping

| User Says | Tool | Flag | When to Use |
|-----------|------|------|-------------|
| "sentinel scan" | SentinelScan.ts | `"$(pwd)"` | Scan current repo (default) |
| "scan /path/to/repo" | SentinelScan.ts | `/path/to/repo` | Scan a specific directory |
| "sentinel scan --help" | SentinelScan.ts | `--help` | Show tool usage info |

## Pipeline (6 Phases)

### Progressive Narration (MANDATORY)

Output brief status lines BETWEEN phases so the user sees real-time progress. Don't be silent for 30 seconds. Each phase starts with a narration line:

```
Phase 1: Scanning project structure...
Phase 2 + 2c: Analyzing patterns + fetching upstream conventions (concurrent)...
Phase 2b: Generating architecture artifacts...
Phase 2d: Converging local vs upstream, tiering findings...
Phase 3: Writing discoveries to MemPalace...
Phase 4: Writing SNAPSHOT.md + CLAUDE.md slim summary...
Phase 5: Registering project...
Phase 6: Scan complete.
```

After each phase, report what was found:
- Phase 1: "Found {N} files across {N} directories. Stack: {lang} + {framework} on {runtime}"
- Phase 2: "Discovered {N} conventions (confidence >= 0.7)"
- Phase 2c: "Fetched {N} upstream-canonical conventions for {framework}"
- Phase 2b: "Generated {N} ADRs, module map, C4 diagrams. Health: {N}%"
- Phase 2d: "Converged: {N} matches, {N} diverges, {N} upstream-gap, {N} local-only. Tiered: {N}🔴 {N}🟠 {N}🟡 {N}🟢"
- Phase 3: "Filed {N} KG facts and {N} drawers in wing '{wing}'"
- Phase 4: "{Created|Updated} Docs/Sentinel/SNAPSHOT.md ({N} lines) + CLAUDE.md slim summary"
- Phase 5: "Project registered in PROJECTS.md"

### Phase 1: Static Analysis

Run the SentinelScan tool to gather factual data about the codebase:

```bash
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts "$(pwd)"
```

This produces a `ScanReport` JSON at `.sentinel/scan-report.json` with:
- Project metadata (name, path, description)
- Directory structure and entry points
- Tech stack (language, framework, runtime, dependencies)
- Git metadata (commits, contributors, branches)
- File statistics (counts by extension, test files)
- Existing tooling (CLAUDE.md, ESLint, Prettier, CI)

**Read the output** and store it for the next phases.

### Empty Project Detection (after Phase 1)

Check the scan report for `isEmptyProject: true`. This field is computed by SentinelScan.ts when ALL of these are true:
- `files.totalFiles < 3`
- `existing.hasClaudeMd === false`
- `stack.dependencies` is empty
- `stack.devDependencies` is empty

**If `isEmptyProject` is true:**

```
Sentinel detected an empty project. Switching to Bootstrap Mode...
```

**Stop the normal scan pipeline.** Load and follow `Workflows/Bootstrap.md` instead. Bootstrap handles everything: interview, scaffold, registration, MemPalace, and a re-scan of the scaffolded structure.

**If `isEmptyProject` is false:** Continue with the normal Discovery Mode below.

### Phase 1b: Project Structure Scaffold

**Goal:** Create the project-level directory structure DOS uses for memory, plans, and artifacts.

These directories enable project-level memory resolution — hooks write data WITH the project instead of to the global `~/.claude/MEMORY/` directory. The resolver in `hooks/lib/paths.ts` checks for project-level dirs first, falling back to global only when they don't exist.

```bash
# Project-eligible memory + plans dirs — the canonical set lives in
# scaffoldProjectDirs() in SentinelScan.ts (tested), so this prose never hand-types
# the mkdir list (no drift from what the tool creates). STATE/, VOICE/, RELATIONSHIP/
# are deliberately excluded (global-only). Idempotent — skips dirs that already exist.
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts scaffold-dirs "$(pwd)"

# DLQ bootstrap — creates .pending/ + .quarantine/ for every sync-eligible
# subdir (mode 0600, principal UID), adds macOS Time Machine exclusions,
# and refuses bootstrap on iCloud/Dropbox/OneDrive roots.
# Required by Plans/Specs/studio-sync-resilience.md (bootstrap gate).
bun ~/.claude/skills/sentinel/Tools/BootstrapDlqDirs.ts
```

**Skip if all directories already exist.** Report: "Project scaffold: {N} directories created; DLQ bootstrap: {created+existing} dirs, {refused} refused."

**Note:** STATE/, VOICE/, RELATIONSHIP/ are NOT created at project level — they are global-only (session coordination, infrastructure, personal notes). BootstrapDlqDirs handles them at the install level.

**Bootstrap refusal:** If `BootstrapDlqDirs` exits non-zero with a "refused" message, MEMORY/ lives under a cloud-sync root. Move the project off iCloud/Dropbox/OneDrive or set `DOS_DIR=/absolute/local/path` before continuing. The DLQ requires `rename(2)` atomicity, which advisory-lock cloud filesystems silently no-op.

### Phase 1c: Durante-Native Inventory (gated — Durante projects only)

**Goal:** When the scanned repo is Durante-instrumented, surface its native primitives —
workflows, the PRD corpus, the RFC corpus, roadmaps/DAG, agent packs, skills — as
first-class architecture. This is the substrate the `version-council-review` reconciler
reads (intended-vs-actual). On a non-Durante repo this phase is a silent no-op (graceful
degradation).

**Gate:** SentinelScan.ts (Phase 1) already populated `durante` in
`.sentinel/scan-report.json` — deterministic file reads, no inference, no extra cost.
Read `durante.isDuranteProject`:

- **false** → skip this phase entirely. Do not narrate. Continue to the inference stage.
- **true** → narrate `Phase 1c: Durante-native project detected ({N} signals) — inventorying...` and continue below.

**Report:** "Durante-native: {W} workflows · {P} PRDs · {R} RFCs · {RM} roadmaps · {A} agent packs · {S} skills"

**Run the deterministic artifact writer** — the `DURANTE-NATIVE.md` render and the Phase-3
KG-op construction are PURE transforms of the `durante` block (zero judgment), so they live
in CODE (`renderDuranteNative` / `buildDuranteKgOps`, unit-tested in SentinelScan.test.ts),
NOT in this prose. This step is a single CLI call, not agent templating:

```bash
bun ~/.claude/skills/sentinel/Tools/sentinel-durante-artifact.ts "$(pwd)"
```

It writes `{DOCS_DIR}/DURANTE-NATIVE.md` (the full inventory; DOCS_DIR = `Docs/Sentinel` if
`Docs/` exists, else `.sentinel/docs`) and `.sentinel/durante-kg-ops.json` (the Durante-native
KG ops that Phase 3 Step 3e merges — `has_component` / `intends_status` / `governed_by_rfc`
facts + the `durante-native` drawer; caps — PRDs 40 active-first, RFCs 60 — bound the
queryable FACTS only, the drawer carries the full record, so nothing is silently
truncated). On a non-Durante project it is a silent no-op. **Report the summary line it
prints.** Do NOT hand-write the artifact — the tool is the source of truth, and do NOT
hand-construct fact ops under legacy predicate names (`prd_intent`/`rfc`/`has_workflow`/
`has_agent_pack`): the gate rejects them (the 60-op loss of 2026-07-07).

**Failure handling (mirrors Phase 2):** if `sentinel-durante-artifact.ts` is absent or
errors, log a warning, skip the durante-native artifact + the Step-3e merge, and continue
the pipeline — never block the scan on the durante extension.

The `durante` block still feeds **Phase 2b** (RFCs as the authoritative ADR source — the one
genuine-inference use of the inventory, which stays in prose because it requires judgment).

### Inference Stage — Concurrency (Phases 2, 2b, 2c, 2d)

The inference stage runs four sub-phases on this dependency DAG — **not a strict
sequence**:

```
Phase 2  (conventions) ──┬──> Phase 2b (architecture artifacts)
                         └──> Phase 2d (convergence & tiering)
Phase 2c (upstream)  ────────> Phase 2d
```

**Launch Phase 2 and Phase 2c concurrently.** In a single message, issue Phase 2's
`bun Inference.ts` Bash call and Phase 2c's Research `Task` call together — they share
no data dependency, so both run at once. Phase 2b starts once Phase 2's result
returns; **Phase 2d starts once Phase 2 has returned AND Phase 2c has returned or been
skipped** (Phase 2c self-skips on an unknown stack — see its "When to run"). Running
the two concurrently cuts the inference stage's wall-clock time.

(The sub-phase letters are documentation order, not execution order — the DAG above is
the authority.)

### Phase 2: Pattern Recognition (Inference)

**Goal:** Use LLM analysis to discover conventions, architecture patterns, and key decisions.

**Step 2a — Select representative files:**
Read these files from the repo (skip any that don't exist):

1. **3 most-changed files** — the deterministic git-churn ranking lives in
   `mostChangedFiles()` (SentinelScan.ts, tested), exposed as a subcommand so the
   prose never re-types the `git log | sort | uniq -c | sort -rn` pipe (transcription
   drift). Read the files it prints:
   ```bash
   bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts most-changed 3 "$(pwd)"
   ```
2. **1 config file** — tsconfig.json or the primary config from the scan report
3. **1 test file** — First test file from `ScanReport.files.testFiles`
4. **1 component/page file** — First `.tsx` file from `src/components/` or `src/app/` or `app/`
5. **1 API route/handler** — First file from `src/api/`, `app/api/`, `src/routes/`, or `pages/api/`
6. **1 utility file** — First file from `src/utils/`, `src/lib/`, `lib/`, or `utils/`
7. **README.md** (if exists)
8. **Existing CLAUDE.md** (if exists) — slim `## Sentinel Conventions` section + project context
9. **Existing `Docs/Sentinel/SNAPSHOT.md`** (if exists) — full prior-scan body, primary signal for "what changed"

**Step 2b — Run inference:**

<!-- inference-schema: v1 — SoT is Tools/inference-schema.v1.ts (INFERENCE_SCHEMA_JSON).
     The OUTPUT SCHEMA block below MUST stay byte-identical to that artifact; the
     parity test inference-schema.v1.test.ts fails on drift so the prompt and the
     Phase-3 parser can never silently disagree on field names (ISC-32). -->

Use Inference.ts at `standard` level (Sonnet):

```bash
bun ~/.claude/DOS/Tools/Inference.ts --level standard --json --timeout 120000 \
  "You are analyzing a codebase to discover conventions, patterns, and architecture decisions. Output strict JSON matching the schema provided." \
  "SCAN REPORT:
$(cat .sentinel/scan-report.json)

REPRESENTATIVE FILES:
[Include the content of each selected file, prefixed with its path]

OUTPUT SCHEMA:
{
  \"architecture_pattern\": \"monolith|monorepo|microservices|modular\",
  \"conventions\": [{
    \"category\": \"naming|file_organization|imports|error_handling|testing|api|database|state_management|styling|other\",
    \"pattern\": \"description of the convention\",
    \"evidence\": \"where this was observed\",
    \"confidence\": 0.0-1.0,
    \"enforceable\": true/false,
    \"regex\": \"OPTIONAL — JS regex (without delimiters) that MUST appear in conformant files. Omit if not regex-enforceable.\",
    \"negative_regex\": \"OPTIONAL — JS regex (without delimiters) that MUST NOT appear in conformant files. Omit if not regex-enforceable.\",
    \"applies_to\": [\"OPTIONAL — glob patterns like *.ts, *.tsx, package.json, *.md. Omit to default to *.ts/*.tsx.\"]
  }],
  \"key_decisions\": [{
    \"decision\": \"description\",
    \"reasoning\": \"why this was chosen\",
    \"evidence_file\": \"path\"
  }],
  \"tech_stack_summary\": \"2-3 sentences\",
  \"setup_commands\": {\"install\": \"...\", \"dev\": \"...\", \"build\": \"...\", \"test\": \"...\", \"lint\": \"...\"},
  \"architecture_overview\": \"3-5 sentences\"
}"
```

**Parse the JSON response** as a `ConventionReport`.

**IMPORTANT:** If inference fails or returns invalid JSON, log the error and continue with only the static analysis data. Do not block the pipeline — BUT set the run's `degraded` flag and record the cause ("inference unavailable — static data only"). The `## Output` step MUST then render the `renderDegradedBanner` and mark the inference-derived sections (Conventions, Health) as placeholders / `n/a`. Silently continuing as if the scan were complete is the dark-pattern this guards against (ISC-37/38).

### Phase 2b: Architecture Artifacts (Second Inference Call)

**Goal:** Generate high-value architecture documentation — ADRs, C4 diagrams, module map, and tech debt score.

**This is a SEPARATE inference call** from Phase 2 (conventions). This keeps each call focused and within token limits.

**Step 2b-i — Gather additional context for artifact generation:**

Read these additional sources:
- `git log --oneline --since="6 months ago" --diff-filter=M -- "*.config.*" "*.json" "*schema*" "*migration*"` — config/schema changes that signal decisions
- `git log --oneline --since="6 months ago" --grep="refactor\|migrate\|switch\|replace\|upgrade\|deprecate"` — decision-signal commits
- The directory tree (from ScanReport.structure)
- Import graph: For the top 10 most-imported files, which modules import them

**Step 2b-ii — Run inference for architecture artifacts:**

```bash
bun ~/.claude/DOS/Tools/Inference.ts --level standard --json --timeout 120000 \
  "You are a senior architect analyzing a codebase to produce architecture documentation. Output strict JSON." \
  "SCAN REPORT (summary):
{Minimal scan report — name, stack, monorepo, packages, top dirs}

DECISION-SIGNAL COMMITS:
{git log output from Step 2b-i}

CONVENTIONS DISCOVERED (Phase 2):
{Convention list from Phase 2}

DIRECTORY STRUCTURE:
{Top-level tree}

Generate these artifacts as JSON:
{
  \"module_map\": {
    \"mermaid\": \"graph TD; A[module-a] --> B[module-b]; ...\"
    \"description\": \"1-2 sentences about the dependency structure\"
  },
  \"c4_context\": {
    \"mermaid\": \"C4Context; title System Context; Person(...); System(...); ...\"
    \"description\": \"1-2 sentences about the system boundaries\"
  },
  \"c4_container\": {
    \"mermaid\": \"C4Container; title Container; Container(...); ...\"
    \"description\": \"1-2 sentences about the container architecture\"
  },
  \"adrs\": [
    {
      \"id\": \"ADR-001\",
      \"title\": \"Use Supabase for auth and database\",
      \"status\": \"accepted\",
      \"date\": \"2026-01-15\",
      \"context\": \"Why this decision was needed\",
      \"decision\": \"What was decided\",
      \"consequences\": \"What follows from this decision\",
      \"evidence\": \"commit hash or file that proves this\"
    }
  ],
  \"tech_debt_indicators\": [
    {
      \"category\": \"string\",
      \"description\": \"string\",
      \"severity\": \"low|medium|high\",
      \"files_affected\": [\"path\"]
    }
  ]
}

RULES:
- Module map: show actual packages/modules, not abstract boxes. Use graph TD (top-down) Mermaid syntax.
- C4 Context: show the system, its users, and external systems it integrates with. Use C4-PlantUML Mermaid syntax if possible, otherwise plain graph.
- C4 Container: show the main deployable units (web app, API, database, queue, etc.). Stay at container level — NO component or code level.
- ADRs: extract 3-8 real decisions. **Authoritative source on Durante projects:** if `durante.isDuranteProject` is true and `durante.rfcs` is non-empty, derive ADRs from the RFC corpus FIRST (each RFC is an authored, decision-grade record — `id`, `title`, `status`) — git-commit archaeology is the FALLBACK, used only to fill gaps or when no RFCs exist. On non-Durante repos, git archaeology is the primary source. Each ADR must have real evidence (the RFC path, or a commit hash). Use the Nygard template (Context, Decision, Status, Consequences). Do not re-infer a decision the RFC corpus already records — cite the RFC.
- Tech debt: identify patterns that violate the project's own conventions or show inconsistency. Be specific about which files."
```

**Step 2b-iii — Write artifacts to the docs directory:**

Determine the output directory via the SAME deterministic rule the durante artifact tool
uses — `resolveDocsDir(root)` in SentinelScan.ts (unit-tested, single source of truth):
`Docs/Sentinel/` when a `Docs/` directory exists, else `.sentinel/docs/`. (A `docs_path`
user-customization hook is NOT implemented — do not assume it resolves anywhere else, or
the `Docs/Sentinel/DURANTE-NATIVE.md` pointer in SNAPSHOT.md would dangle.)

```bash
# Single source of truth — resolveDocsDir() in SentinelScan.ts, exposed as a CLI
# subcommand so this prose never re-derives the rule (no shell-vs-code drift).
DOCS_DIR=$(bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts resolve docs-dir "$(pwd)")
mkdir -p "$DOCS_DIR"
```

Write each artifact as a separate markdown file:

**`{DOCS_DIR}/MODULE-MAP.md`:**
```markdown
# Module Map
<!-- Auto-generated by sentinel scan on {DATE} -->

{module_map.description}

```mermaid
{module_map.mermaid}
```

```

**`{DOCS_DIR}/C4-CONTEXT.md`:**
```markdown
# System Context (C4 Level 1)
<!-- Auto-generated by sentinel scan on {DATE} -->

{c4_context.description}

```mermaid
{c4_context.mermaid}
```

```

**`{DOCS_DIR}/C4-CONTAINER.md`:**
```markdown
# Container Diagram (C4 Level 2)
<!-- Auto-generated by sentinel scan on {DATE} -->

{c4_container.description}

```mermaid
{c4_container.mermaid}
```

```

**`{DOCS_DIR}/ADRS.md`:** (all ADRs in one file)
```markdown
# Architecture Decision Records
<!-- Auto-generated by sentinel scan on {DATE} -->

{For each ADR:}
## {adr.id}: {adr.title}

**Status:** {adr.status}
**Date:** {adr.date}

### Context
{adr.context}

### Decision
{adr.decision}

### Consequences
{adr.consequences}

**Evidence:** {adr.evidence}

---
{end for}
```

**`{DOCS_DIR}/TECH-DEBT.md`:** — NOT written here. It renders Phase 2d's Tiering, so
it is written in **Phase 2d Step 2d-iii** (after the tiers exist). The other four
artifacts above are written here in 2b-iii as normal.

**Step 2b-iv — Calculate the Health Score (LIVE conformance sweep — measured, never git-mined):**

The health score is the share of tracked conventions with NO current violation in the
live tree, computed by the tested `calculateHealthScore(violations, total)` helper in
SentinelScan.ts (it guards the empty-corpus case and clamps to 0-100).

> **What `violations` means (corrected 2026-07-07):** the count of conventions with
> ≥1 CURRENT hit in the live tree — a per-convention binary, MEASURED now. It is
> NOT the Phase-2b `tech_debt_indicators` count: those are mined from
> `git log --grep="refactor|migrate|…"`, so every debt-PAYING commit reads as debt
> OWED (studio 2026-07-07: git-mined scoring said 65% while live drift was 87%).
> Git-mined indicators feed the Phase-2d tiers only after the staleness probe
> (Step 2b-v) — they NEVER enter this ratio.

Derive `violations` in two halves:

1. **Mechanical half** — after the Convention Cache exists (run
   `bun ~/.claude/skills/sentinel/Tools/ConventionCache.ts` first if this scan hasn't yet):
   ```bash
   bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts sweep-conventions "$(pwd)"
   ```
   The JSON reports per-rule verdicts (`violated`, full `hit_count`, sample `hits`),
   the ignore-set-guarded `files_scanned`, and a `coverage` line
   (`N/M rules mechanically sweepable`). Only `negative_regex`-backed rules are
   mechanical (Guard semantics — a positive regex describes conformity; its absence
   in one file is not a violation).
2. **Judgment half** — for EVERY rule in the sweep's `unsweepable` list, run a
   targeted live check with rg/fd against the convention's own terms (e.g. for
   "server data access lives in *.service.ts, no direct db from route handlers":
   `rg "from ['\"]@kit/database" apps/web/app/api --files-with-matches`). Record the
   probe command + hit count per convention. A convention is `violated` iff the probe
   finds ≥1 current hit.

`violations` = mechanically-violated + judgment-violated (each convention counted
once). `total` = tracked conventions. NEVER report the mechanical half alone as the
score when unsweepable rules exist — the coverage line exists precisely so a partial
sweep is not totalized. **Review mechanical hits for rule-scope mismatches** before
counting: a production-hygiene rule (e.g. "no console.log in production") whose
`applies_to` is a bare `*.ts` will hit test fixtures and CLI tools that legitimately
print — the fix is to tighten the rule's `applies_to`/regex in the convention (and
regenerate the cache), never to hand-discount hits while leaving the rule wrong. If
the CLI printed a TRUNCATED warning, the corpus was capped — do not write a
`method: "live-sweep"` score from that run alone.

```bash
# Single source of truth for the ratio — round((total - violations) / total * 100).
SCORE=$(bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts health-score "$VIOLATIONS" "$TOTAL")
```

Express as: "{SCORE}% healthy ({violations} of {total} conventions show live drift)".

Write the score to `.sentinel/health.json` — the `method` field is REQUIRED so
downstream readers (Status, ConventionCache freshness refresh) can distinguish a
measured score from an unmeasured freshness stub:
```json
{
  "score": 87,
  "method": "live-sweep",
  "healthy_conventions": 20,
  "drifting_conventions": 3,
  "total_conventions": 23,
  "mechanical_coverage": "3/23 rules regex-backed; 20 agent-probed",
  "generated": "2026-07-07T14:30:00Z",
  "violations": [{ "category": "...", "probe": "rg ...", "hit_count": 56 }]
}
```

(ConventionCache.ts refreshes freshness fields on this file but never authors
`score` — score authorship belongs to this step alone.)

**Step 2b-v — Staleness probe for git-mined indicators (verify-before-count):**

Every Phase-2b `tech_debt_indicator` is a HYPOTHESIS mined from git archaeology, not
a finding. Before any indicator enters the Phase-2d tiers, probe it against the live
tree:

- **File probe** — every path in `files_affected` still exists (`test -e` / `fd`).
- **Defect probe** — the described defect still reproduces (targeted rg / config
  read / migration-status check appropriate to the claim).

Disposition rules (fail toward COUNTED — a probe that cannot run conclusively does
NOT demote the indicator):
- Both probes confirm → the indicator is **live**: it tiers normally in Step 2d-ii.
- Any probe REFUTES it (file deleted, migration committed, gate now enforced) → tag
  it **historical (verified fixed)**: it appears ONLY in TECH-DEBT.md's Historical
  section, never in a tier, never in any tally.
- Probe inconclusive → keep it **live** (counted) with a `(probe inconclusive)` note.

Record each probe + disposition; the TECH-DEBT.md template (Step 2d-iii) renders the
split.

### Phase 2c: Upstream Convention Grounding (External Baseline)

**Goal:** Inference in Phase 2 is *pure local-file analysis* — it surfaces patterns observed in this repo but cannot tell us whether those patterns are upstream-canonical (matching the framework's published conventions) or locally-divergent (this team's house style). Phase 2c adds a single fast Research call that fetches upstream convention docs for the detected stack. Phase 3's KG writes then carry a **convention-baseline grounding signal** alongside the locally-observed conventions.

**When to run:** Always, when `ScanReport.stack.framework` or `ScanReport.stack.language` is populated. Skip silently if the stack is unknown / empty.

**Spawn pattern:** `QuickResearch` because it's fast (~10-15s), single-query, and the target signal is a tight summary not a deep dive. The grounding signal is advisory — never blocking.

```ts
Task({
  subagent_type: "general-purpose",
  description: "Sentinel grounding — upstream conventions",
  prompt: "Invoke the research skill, QuickResearch workflow. Query: 'Canonical conventions for {FRAMEWORK} {VERSION} on {LANGUAGE}: file organization, naming, imports, testing patterns, state management. What does the official style guide or framework documentation specify?' Return: tight bullet list (8-12 bullets) of upstream-canonical conventions. Each bullet carries (a) one citation URL (official docs, style guide, or canonical RFC) and (b) a category tag from exactly this enum: naming|file_organization|imports|error_handling|testing|api|database|state_management|styling|other. Under 400 words."
})
```

**Substitute `{FRAMEWORK}`, `{VERSION}`, `{LANGUAGE}` from `ScanReport.stack`.** Examples:
- Next.js 15 + TypeScript → "Canonical conventions for Next.js 15 on TypeScript..."
- FastAPI + Python → "Canonical conventions for FastAPI on Python..."
- Bun + TypeScript monorepo → "Canonical conventions for Bun on TypeScript monorepos..."

**Parse and persist:** Save the returned bullets to `.sentinel/upstream-conventions.json`:

```json
{
  "framework": "Next.js",
  "version": "15.x",
  "language": "TypeScript",
  "generated": "2026-05-15T...",
  "upstream_conventions": [
    { "category": "file_organization", "rule": "App Router file-based routing", "citation": "https://nextjs.org/docs/app" },
    { "category": "state_management", "rule": "Server Components by default", "citation": "https://nextjs.org/docs/app/building-your-application/rendering/server-components" }
  ]
}
```

The `category` field is REQUIRED per entry and MUST use the same enum as Phase 2's
convention categories (`naming|file_organization|imports|error_handling|testing|api|database|state_management|styling|other`) —
Step 2d-i's classifier promotes a 1-shared-token match only on category agreement,
so a category-less upstream list silently degrades the matcher to bare ≥2-token
overlap and re-manufactures false upstream-gaps.

**Failure handling:** If Research returns empty or errors, write an empty array and continue. Phase 3 must not block on grounding-signal absence — the locally-observed conventions are still written verbatim.

**Cost:** 1 QuickResearch call per scan. Fire-and-forget on failure.

### Phase 2d: Convergence & Tiering — Local vs Upstream

**Goal:** the **bifocal collision** — the highest-signal step of the scan. Phase 2
surfaced *locally-observed* conventions; Phase 2c fetched *upstream-canonical* ones.
Phase 2d converges the two and ranks every finding into tiers. Without this step the
two Surfaces are merely stored side by side and never compared.

**Depends on:** Phase 2 (`conventions`) AND Phase 2c (`upstream_conventions`) — run
after both return. Skip the convergence half silently if Phase 2c produced an empty
upstream list (unknown stack, or the upstream fetch failed); the tiering half still
runs on local findings alone.

**Step 2d-i — Converge.** For each local convention from Phase 2, classify it against
the Phase 2c `upstream_conventions` list:

| `kind` | Meaning |
|---|---|
| `matches` | Local convention agrees with upstream canon — healthy |
| `diverges` | Local convention contradicts an upstream-canonical one — house style vs canon |
| `local-only` | A local convention with no upstream counterpart — unverified, neither good nor bad |
| `upstream-gap` | An upstream rule NO tracked local convention matched — a set-membership FACT, not yet a compliance verdict (see the probe below) |

The **structural set math** (`matches` / `local-only` / `upstream-gap` — token-overlap
classification by category + normalized substring) is the deterministic
`classifyConventions(local, upstream)` helper in SentinelScan.ts (unit-tested), so this
prose never hand-applies the match rule per run. Invoke it as
`bun SentinelScan.ts classify-conventions <local.json> <upstream.json>` (writes the local
+ upstream convention arrays to temp JSON, prints the `{matches, localOnly, upstreamGap}`
classification) rather than re-deriving the token-overlap rule by hand. (Match rule since
2026-07-07: ≥2 shared tokens, OR 1 shared token + same category — upstream entries
should carry their `category` field from `.sentinel/upstream-conventions.json` so the
category branch can fire.) The `diverges` tag is the one
judgment call left here — it needs an inferred same-category *contradiction* signal that
the set math cannot supply — so tag those rows from the inference output, not from the
helper. Emit one **divergence finding** per non-`matches` row:
`{kind, local_pattern, upstream_canon, citation, severity}`.

**MANDATORY — probe every `upstream-gap` row against the repo before tiering.** Each
gap entry ships `probe: "unverified"`: it means *no tracked local convention matched
this upstream rule*, which is NOT the same as *the repo doesn't follow it* — the repo
may follow the practice without Phase 2 having surfaced it as a tracked convention
(4 of 5 gaps on the 2026-07-07 studio scan were exactly this false negative:
`import 'server-only'`, pnpm catalogs, route-group colocation, RSC data-down). Author
ONE targeted READ-ONLY probe per gap against the rule's own terms (a query whose MATCH
means "the repo follows this practice" — e.g. `rg "import 'server-only'" packages -l`,
`rg "catalog:" pnpm-workspace.yaml`, `fd "^\(" apps/web/app --type d`), write them to
`.sentinel/gap-probes.json` as `[{"rule": ..., "probe_cmd": ...}]`, and run the
MECHANIZED prober (it executes each probe and emits receipts — a skipped probe stays
visible as a still-unverified gap, never a silent prose omission):

```bash
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts probe-gaps .sentinel/gap-probes.json "$(pwd)"
```

Apply its receipts to upgrade each gap's field:

- **`refuted`** — the probe shows the practice IS followed → the row collapses into
  `matches` (annotated `probe-verified`) or, when the practice is followed but no
  local convention tracks it, into a 🟢 LOW "tracked-convention coverage gap" note.
- **`confirmed`** — the probe confirms the repo does NOT follow it → tier 🟠 HIGH
  `(probe confirmed)`.
- **still `unverified`** (probe skipped / inconclusive) — the row STAYS 🟠 HIGH,
  annotated `(probe pending — unverified)`, and is counted in the `## Output`
  "Unverified gap probes" line. A skipped probe must remain visible — silently
  demoting unprobed gaps would hide real upstream drift (fail toward visibility).

The probe command + result per gap ride into TECH-DEBT.md with the finding.

**Step 2d-ii — Tier every scan finding.** Merge three finding streams — LIVE
convention violations (the Step 2b-iv sweep — mechanical + judgment halves),
LIVE-verified tech-debt indicators (Phase 2b, AFTER the Step 2b-v staleness probe —
historical/refuted indicators never tier), and the divergence findings (Step 2d-i) —
and bucket each into one of four tiers:

| Tier | Contents |
|---|---|
| 🔴 CRITICAL | A live convention violation or live debt indicator that is also a correctness or security risk |
| 🟠 HIGH | An upstream divergence (`diverges`, or an `upstream-gap` whose probe is `confirmed` OR still `unverified` — annotate which), or a high-severity LIVE debt indicator |
| 🟡 MEDIUM | Live convention drift (a tracked convention slipping), or a medium-severity live debt indicator |
| 🟢 LOW | Style-only nits, low-severity live debt, `local-only` conventions (awareness), probe-`refuted` gap rows already collapsed to matches |

The interestingness ordering of *discoveries* (what's notable) is not the priority
ordering of these *tiers* (what to fix first) — keep them distinct.

**Step 2d-iii — Write `TECH-DEBT.md` and carry the findings forward.**

First, write the tiered tech-debt artifact (deferred from Phase 2b-iii — it needs the
tiers that only exist now):

**`{DOCS_DIR}/TECH-DEBT.md`:**
```markdown
# Tech Debt Report
<!-- Auto-generated by sentinel scan on {DATE} -->

## Score: {violations}/{total_conventions} conventions with live drift ({percentage}% healthy)
<!-- Score = the Step 2b-iv LIVE sweep (method: live-sweep). It counts current
     violations only; the tiers below also include live-verified tech-debt
     indicators and upstream divergences. Historical indicators are quarantined
     in their own section — they are receipts, not debt. -->

Findings bucketed by the Phase 2d tiers (definitions: Step 2d-ii) — highest-impact
first within each tier.

### 🔴 CRITICAL
{For each 🔴 finding:} **{category}: {description}** — Files: {files_affected}

### 🟠 HIGH
{For each 🟠 finding:} **{category}: {description}** — Files: {files_affected}
{upstream-gap rows carry their probe status: (probe confirmed) or (probe pending — unverified)}

### 🟡 MEDIUM
{For each 🟡 finding:} **{category}: {description}** — Files: {files_affected}

### 🟢 LOW
{For each 🟢 finding:} **{category}: {description}** — Files: {files_affected}

### ✅ Historical — verified fixed (Step 2b-v probe receipts; not debt, not counted)
{For each refuted indicator:} **{category}: {description}** — refuted by: {probe evidence}
```

The Tiering also feeds:
- the `## Output` summary's Findings block (bare tier labels — definitions stay in Step 2d-ii),
- the `conventions` drawer written in Phase 3 Step 3c — the divergence findings ride there as prose (**no new KG predicate**).

The health `%` (Phase 2b-iv) is unchanged — it stays the headline metric; the Tiering
is its *actionable* companion.

**Step 2d-iv — Delta vs the last scan.** Phase 2a read the prior
`Docs/Sentinel/SNAPSHOT.md` (if one existed). The New / Drifted / Resolved diff is the
deterministic `compareScans(current, prior)` helper in SentinelScan.ts (unit-tested),
invoked as `bun SentinelScan.ts compare-scans <current.json> <prior.json>` (prints the
`{added, drifted, resolved}` delta) — the prose never hand-applies the category +
normalized-substring match rule:
- **New** — conventions / divergences present now, absent last scan
- **Drifted** — match conventions across scans by `category` + a normalized substring of `pattern`; a convention is Drifted when the same category's pattern text differs non-trivially
- **Resolved** — debt indicators / divergences present last scan, absent now

If no prior SNAPSHOT existed, the delta is "First scan — no prior baseline." This
delta feeds the SNAPSHOT.md "Changes Since Last Scan" section (Phase 4) and the
`## Output` summary.

### Phase 3: MemPalace Population

**Goal:** Write discoveries to the knowledge graph and semantic memory.

**Step 3a — Determine the project wing:**

Use the project resolver to find the wing name:
- Check `~/.claude/DOS/USER/PROJECTS/PROJECTS.md` for a matching path
- If not found, derive wing from directory name (lowercase, kebab-case) — use the SAME
  `deriveWing(project.wing, root)` rule the durante artifact tool uses (`kebab(basename)`),
  so the Step-3e durante facts key to the identical `project:WING` subject (no split-brain)

#### CRITICAL — robust write pattern (read before Step 3b)

**Failure mode this prevents (2026-05-08, altyaa-agents scan):** an
earlier version of this workflow used a `for fact in $facts` shell loop
with `uv run --with mempalace python ... add_kg_fact 'JSON' | tail -1`.
Three things conspired to silently lose 36 of 36 KG facts and 8 of 10
drawers:

1. **The bridge always exits 0** — even on error. Per its own help text:
   *"ALL errors return JSON on stdout with status='error'. Exit code is
   always 0. Callers must check the status field, not the exit code."*
2. **Pretty-printed JSON ends in `}` for both success and error**, so
   `tail -1` cannot distinguish the two.
3. **Each `uv run` spawns a fresh interpreter + new SQLite connection
   (~70-100 ms)**. Fan-out of 36 spawns races background hooks
   (IntelFirstGuard, MemPalaceLearn) that hammer the bridge with
   `kg_stats`/`fact_check` calls every few seconds — SQLite WAL
   contention silently rolls writes back.

**Prescribed pattern: a single `batch` call.** The bridge ships a
`batch` action explicitly designed for this:

> *"Execute multiple operations in a single subprocess call. Dramatically
> reduces overhead for bulk operations (e.g. sentinel scan writing 16 KG
> triples + 5 drawers). Shares ONE ChromaDB client and ONE KG connection
> across all operations."* — `_bridge_palace.py:batch.__doc__`

Build ONE JSON `operations` list containing every KG fact and every
drawer (Steps 3b/3c/3d below), then submit it once:

```bash
# Build the operations list (heredoc — no fan-out, no shell loop)
cat > /tmp/sentinel-batch.json <<'EOF'
{
  "operations": [
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "path_is", "object": "ABSOLUTE_PROJECT_PATH", "valid_from": "TODAY"}},
    {"action": "add_kg_fact", "args": {"subject": "project:WING", "predicate": "uses", "object": "FRAMEWORK_NAME", "valid_from": "TODAY"}},
    {"action": "add_drawer",  "args": {"wing": "WING", "room": "architecture", "content": "ARCHITECTURE_OVERVIEW", "source_file": "sentinel-scan", "added_by": "sentinel"}}
  ]
}
EOF

# Submit — ONE Python process, ONE SQLite connection, ONE WAL transaction
RESPONSE=$(uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py batch "$(cat /tmp/sentinel-batch.json)")

# MANDATORY: parse the status, do NOT trust exit code or tail -1. The bridge ALWAYS
# exits 0 (errors arrive as status='error' in the body), so the parse + ok/total/error
# tally + all-ok verdict lives in the tested parseBatchResponse() helper (SentinelScan.ts),
# exposed as `parse-batch`. It prints "batch: status=.. ok=N/T errors=E" and exits non-zero
# unless EVERY op succeeded — so a partial write aborts the scan instead of claiming success.
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts parse-batch "$RESPONSE" \
  || { echo 'Phase 3 batch FAILED — abort scan, do not claim success'; exit 1; }
```

**MANDATORY post-write verification.** Even with `status: ok`, confirm
persistence by reading SQLite directly — the source of truth:

```bash
# Direct SQLite count for KG facts about this project
sqlite3 ~/.mempalace/knowledge_graph.sqlite3 \
  "SELECT COUNT(*) FROM triples WHERE subject='project:WING'"
# Expected: matches the count of add_kg_fact ops in the batch

# Direct count for drawers in this wing
sqlite3 ~/.mempalace/wing_index.db \
  "SELECT COUNT(*) FROM wing_index WHERE wing='WING'"
# Expected: matches the count of add_drawer ops in the batch
```

If either count is below expected, the SCAN MUST report partial failure
in its final summary. NEVER claim "N facts written, M drawers filed"
without these counts. Quote the SQLite numbers, not the bridge response.

#### Step 3b — KG triples to include in the batch

For each discovery, append an `add_kg_fact` op to the batch operations
list. Use the `subject:"project:WING"` format consistently (the `project:`
prefix is what the drift loader matches on).

Example triples (all go into the SAME batch as Step 3c/3d):

All predicates below are PREDICATES.md §1 canonical — emit them verbatim, never
the legacy aliases (`uses`/`runtime`→`uses_framework`, `architecture`→`is_a`,
`decision`→`decided`). The bridge would alias them at write time, but emitting
the canonical form keeps R19/R64 (which Sentinel itself owns) self-consistent.

```
project:WING → path_is → ABSOLUTE_PROJECT_PATH   ← REQUIRED for drift detection
project:WING → uses_framework → Next.js
project:WING → uses_framework → TypeScript
project:WING → uses_framework → Node
project:WING → is_a → monorepo
project:WING → tested_with → Vitest
project:WING → convention → camelCase for functions
project:WING → convention → @/ path alias for imports
project:WING → convention → upstream-canon [https://nextjs.org/docs/app]: App Router file-based routing   ← from Phase 2c grounding
project:WING → convention → upstream-canon [https://nextjs.org/docs/...]: Server Components by default    ← from Phase 2c grounding
project:WING → decided → Prisma ORM for database
project:WING → scanned_by_sentinel → YYYY-MM-DD
```

**Grounding-signal provenance (RFC-0140 form):** PREDICATES.md v3.3 REJECTED a
dedicated `upstream_convention` predicate — the ratified form is "`convention` +
provenance". Write each bullet from `.sentinel/upstream-conventions.json` (Phase
2c output) as a `convention` triple whose object carries the provenance prefix:

```
upstream-canon [<citation-url>]: <rule text>
```

This distinguishes locally-observed conventions (bare `convention` objects, from
Phase 2 inference) from upstream-canonical ones (`upstream-canon [`-prefixed
objects, from Phase 2c Research). Convention-drift queries ask *"which of our
local conventions diverge from upstream?"* by partitioning `convention` facts on
the object prefix — one predicate, two provenance classes. Do NOT emit an
`upstream_convention` predicate; the gate rejects it (12 ops lost on the
2026-07-07 studio scan before the re-emit in this form).

The `path_is` triple is REQUIRED. Without it, the drift loader at
`~/.claude/hooks/loaders/project.ts:78` returns early and silently no-ops
key-file mtime checks — sessions never see "Run sentinel scan" warnings
when CLAUDE.md or schema.prisma drift after the last scan.

#### Step 3c — Drawers to include in the batch

For each institutional artifact, append an `add_drawer` op to the same
batch operations list:

```
{wing: WING, room: "architecture",  content: ARCHITECTURE_OVERVIEW, source_file: "sentinel-scan", added_by: "sentinel"}
{wing: WING, room: "conventions",   content: CONVENTIONS_LIST + the Phase 2d divergence findings (as prose), source_file: "sentinel-scan", added_by: "sentinel"}
{wing: WING, room: "decisions",     content: DECISIONS_LIST,        source_file: "sentinel-scan", added_by: "sentinel"}
{wing: WING, room: "setup",         content: SETUP_COMMANDS,        source_file: "sentinel-scan", added_by: "sentinel"}
{wing: WING, room: "stack",         content: TECH_STACK_SUMMARY,    source_file: "sentinel-scan", added_by: "sentinel"}
```

#### Step 3d — Phase-2b artifact ops to include in the batch (v1.1)

```
# For each ADR generated in Phase 2b:
{action: "add_kg_fact", args: {subject: "project:WING", predicate: "decided", object: ADR_TITLE, valid_from: ADR_DATE}}

# Full ADRs document as a drawer:
{action: "add_drawer", args: {wing: WING, room: "adrs", content: FULL_ADRS_CONTENT, source_file: "sentinel-scan-artifacts", added_by: "sentinel"}}

# Module map as a drawer:
{action: "add_drawer", args: {wing: WING, room: "architecture", content: MODULE_MAP_MERMAID, source_file: "sentinel-scan-artifacts", added_by: "sentinel"}}

# Tech debt health: persisted as the tech-debt drawer above + the Sentinel JSON
# artifacts. The legacy `health_score` KG fact is NOT emitted — deprecated per
# Council 2026-05-17 (_bridge_kg.py _TRIPWIRE_DOOMED_PREDICATES, zero consumers);
# add_kg_fact denies it as telemetry-deprecated, so writing it only failed.
```

#### Step 3e — Durante-native facts to include in the batch (gated)

**Only when `durante.isDuranteProject` is true.** Phase 1c already built these ops
DETERMINISTICALLY (`buildDuranteKgOps`, unit-tested) and wrote them to
`.sentinel/durante-kg-ops.json` — `has_component` facts with typed object prefixes
(`workflow: <name>`, `agent-pack: <name>`), `intends_status` facts (the reconciler's
intended-status left half, active-first cap 40), `governed_by_rfc` facts (cap 60) + the
`durante-native` drawer, keyed to the resolved `wing`. **MERGE that file's `operations`
array into the SAME batch** as Steps 3b/3c/3d. Do NOT hand-construct these ops — read
them from the file (the construction is tested code, not prose to be re-derived here).
The tool emits ONLY predicates in its `CANONICAL_SCAN_PREDICATES` allowlist,
parity-tested against PREDICATES.md §1 (all three ratified — `intends_status` and
`governed_by_rfc` operator-ratified 2026-07-07, v3.5; never emit the legacy
`prd_intent`/`rfc`/`has_workflow`/`has_agent_pack` names, the gate rejects them).

```bash
cat .sentinel/durante-kg-ops.json | python3 -c "import json,sys; print(len(json.load(sys.stdin)['operations']), 'durante-native ops to merge')"
```

Submit Steps 3b + 3c + 3d (+ 3e on Durante projects) as ONE batch (typically 16-25 KG
facts + 8-12 drawers; more on Durante repos). Verify counts in SQLite per the prelude.
Anti-pattern: splitting into multiple batches "to keep payloads small" — defeats the
shared-connection benefit AND re-introduces the race window.

### Phase 4: CLAUDE.md + SNAPSHOT.md Generation

**Goal:** Write discovered conventions as enforceable rules — **split across two files** to keep CLAUDE.md prompt weight low.

**Split (changed 2026-05-18 to slim CLAUDE.md):**

- **Full body** (Tech Stack + Architecture + Conventions + Key Decisions + Setup + Health) → `Docs/Sentinel/SNAPSHOT.md`
- **5-line summary + pointer** → CLAUDE.md `## Sentinel Conventions` section

**Step 4a — Write SNAPSHOT.md (full body):**

Target path: `Docs/Sentinel/SNAPSHOT.md` (project-relative). Create the `Docs/Sentinel/` directory if missing. Use the **Write tool** — replace the file entirely on each scan (it is the auto-generated artifact).

**SNAPSHOT.md template:**

```markdown
# Sentinel Snapshot
<!-- Auto-generated by sentinel scan on {DATE}. Edit freely — sentinel evolve will reconcile. -->

## Tech Stack
{tech_stack_summary from inference}

## Architecture
{architecture_overview from inference}

## Conventions
{For each convention with confidence >= 0.7:}
- **{category}** (conf {confidence}): {pattern}

## Key Decisions
{For each key_decision:}
- **{decision}** — {reasoning}

## Setup
- Install: `{setup_commands.install}`
- Dev: `{setup_commands.dev}`
- Build: `{setup_commands.build}`
- Test: `{setup_commands.test}`
- Lint: `{setup_commands.lint}`

## Health
- Score: **{health_score}%** ({healthy_count} healthy / {total_count} conventions, {debt_count} debt indicators)
- Architecture artifacts: `Docs/Sentinel/MODULE-MAP.md`, `C4-CONTEXT.md`, `C4-CONTAINER.md`, `ADRS.md`, `TECH-DEBT.md`
- Open debt: {debt_summary}

## Durante-Native
{Only when durante.isDuranteProject — else omit this section entirely.}
- {W} workflows · {P} PRDs · {R} RFCs · {RM} roadmaps · {A} agent packs · {S} skills
- Full inventory: [`Docs/Sentinel/DURANTE-NATIVE.md`](Docs/Sentinel/DURANTE-NATIVE.md)

## Changes Since Last Scan
{From Phase 2d Step 2d-iv. If no prior SNAPSHOT: "First scan — no prior baseline."}
- **New:** {N} — {new conventions / divergences}
- **Drifted:** {N} — {conventions whose pattern changed}
- **Resolved:** {N} — {debt indicators / divergences cleared since last scan}
```

**Step 4b — Write/update CLAUDE.md slim summary:**

**If CLAUDE.md exists:** Replace the `## Sentinel Conventions` section (append if missing)
via the tested `updateClaudeMdSection(content, newSection)` helper in `SentinelScan.ts` —
the SAME transform Evolve.md Step 4 uses (single source of truth for this find-and-replace;
it preserves all content outside the section byte-for-byte, so the NEVER-modify-outside
guarantee is enforced in code, not by hand):

```bash
# Tested section-replace helper (SentinelScan.ts updateClaudeMdSection) via a portable
# subcommand — create-or-replace the `## Sentinel Conventions` block, byte-preserving the rest.
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts update-claude-md CLAUDE.md "$NEW_SENTINEL_CONVENTIONS_SECTION"
```

Where `$NEW_SENTINEL_CONVENTIONS_SECTION` is the rendered slim-section template below.

**If CLAUDE.md does not exist:** Create one with the full slim-section template below as a standalone file (or pass an empty-string base to `updateClaudeMdSection`, which appends the section create-or-replace style).

**CLAUDE.md slim-section template:**

```markdown
## Sentinel Conventions
<!-- Auto-generated body lives in Docs/Sentinel/SNAPSHOT.md. Next sentinel scan writes there, not back into this section. -->

- **Stack:** {one-sentence stack summary, derived from tech_stack_summary}
- **Test:** `{setup_commands.test}`. **Lint:** `{setup_commands.lint}`. **Sync verify:** `{setup_commands.sync_verify}` (mandatory after multi-copy edits if the project has the four-copy invariant).
- **Health:** {health_score}% ({healthy_count} healthy / {total_count} conventions, {debt_count} debt indicators) — last scan {DATE}.
- **Full snapshot** (Tech Stack, Architecture, Conventions, Key Decisions, Setup, Health, open debt): [`Docs/Sentinel/SNAPSHOT.md`](Docs/Sentinel/SNAPSHOT.md).
- **Architecture artifacts:** `Docs/Sentinel/MODULE-MAP.md`, `C4-CONTEXT.md`, `C4-CONTAINER.md`, `ADRS.md`, `TECH-DEBT.md`.
```

**Idempotency:** Both files are replaced/updated on every scan. SNAPSHOT.md is wholesale-rewritten; CLAUDE.md is surgically Edit'd within the `## Sentinel Conventions` block.

### Phase 5: Project Registration (renumbered from original Phase 5 due to 2b insertion)

Two registries must be updated — the prose registry (PROJECTS.md, for
humans) and the canonical machine-readable registry (.dos-projects.json,
for the project-context resolver, statusline, and KG drift loader).
Failing to update .dos-projects.json is what makes statusline render
`[no project · run /sentinel]` even after a successful scan.

**Step 5a — Update PROJECTS.md (human-readable):**

If the project is NOT already in `~/.claude/DOS/USER/PROJECTS/PROJECTS.md`:

1. Determine wing name (directory name, lowercase)
2. Append a new row to the PROJECTS.md table:
   ```
   | {project_name} | {path} | `{wing}` | - | {stack_summary} | Customer project |
   ```

If it already exists, skip this step.

**Step 5b — Upsert .dos-projects.json (canonical):**

The registry is resolved by `~/.claude/hooks/lib/project-context.ts:resolveProjectSlug`
along the RFC-0168 D1 chain: `DOS_PROJECTS_REGISTRY` env override →
`~/.claude/DOS/projects/registry.json` (install-class canonical — the fork-day home)
→ `~/Durante/{Tools/,}.dos-projects.json` (maintainer legacy, kept indefinitely).
Without an entry here, the statusline cannot resolve the project from cwd
and the toolbar cannot show "current project" for sessions in the wing.

Read the file, dedup by `id`, append a new entry only when not present,
write back. Idempotent — re-running the scan must NOT duplicate.

The dedup-by-id append is the tested `upsertProjectEntry(registry, entry)` helper in
SentinelScan.ts, exposed as the `register-project` subcommand (atomic tmp+rename write).
It NEVER overwrites an existing id's fields — re-running the scan is a no-op when the id
is present — so the prose never re-derives the jq `if any(.[]; .id==$id)` one-liner (no
shell-vs-code drift, and no jq dependency):

```bash
# RFC-0168 A1 target selection: write where the resolver will read.
# Maintainer machines (~/Durante/Tools exists) keep the legacy file as SoT
# (lineage.ts regenerates it); every other machine uses the install-class home.
if [ -d "$HOME/Durante/Tools" ]; then
  PROJECTS_JSON="$HOME/Durante/Tools/.dos-projects.json"
else
  PROJECTS_JSON="${DOS_DIR:-$HOME/.claude}/DOS/projects/registry.json"   # parent auto-created; same seam the resolver reads
fi
WING="{wing}"
NAME="{project_name}"
PATH_FIELD="{project_path}"   # absolute path, no tilde
DESCRIPTION="{description from inference, optional}"

bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts register-project \
  "$PROJECTS_JSON" "$WING" "$NAME" "$WING" "$PATH_FIELD" "$DESCRIPTION"
# prints "register-project: upserted '<id>'" or "'<id>' exists (no-op)"
```

Never write a duplicate id; never overwrite an existing entry's `root_path` (those edits
go through manual review, not automated scan) — both invariants are enforced in the tested
helper, not by hand.

### Phase 6: Studio Registration

If `STUDIO_API_URL` and `STUDIO_API_KEY` are set, register the project in Studio:

```bash
bun ~/.claude/skills/sentinel/Tools/SaveProjectToStudio.ts \
  --name "{project_name}" \
  --slug "{wing}" \
  --repo "{git_remote_org/repo}" \
  --path "{project_path}" \
  --stack "{comma-separated stack from scan}"
```

Alternatively, if `.sentinel/scan-report.json` exists:

```bash
bun ~/.claude/skills/sentinel/Tools/SaveProjectToStudio.ts --from-scan .sentinel/scan-report.json
```

This is fire-and-forget — silently skips when Studio env is not set. The project appears in Studio's `/projects` section immediately.

**Step 6b — Push Sentinel intelligence to Studio:**

After project registration, push the convention report, health score, and architecture data:

```bash
bun ~/.claude/skills/research/Tools/SaveConventionsToStudio.ts \
  --project-path "$(pwd)" \
  --slug "{wing}"
```

This PATCHes the project's sentinel data in Studio: conventions (full report), health score, architecture pattern, stack, and last scanned timestamp. Fire-and-forget — silently skips when Studio env is not set.

**Step 6c — Refresh palace-cache for the wing:**

Write `~/.claude/MEMORY/STATE/palace-cache-{wing}.sh` with current
drawer counts so the statusline can render `Drwr:N` immediately for
the wing. Source of truth is `mempalace_bridge.py status` (returns
`{total_drawers: N, wings: {<wing>: {total: N, rooms: {...}}}}`):

The bridge `status` query is I/O (stays here); the jq extraction
(`.wings[$w].total`, `.total_drawers`) + cache-file render is the tested
`renderPalaceCache(wing, statusJson)` helper in SentinelScan.ts, exposed as the
`palace-cache` subcommand. It degrades to `0/0` on missing/unparseable status, so the
prose never re-types the jq selectors:

```bash
WING="{wing}"
STATUS=$(uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py status 2>/dev/null || echo '{}')

# Tested render (SentinelScan.ts renderPalaceCache) — extracts wing + total drawers,
# fail-open to 0/0, prints the cache file body. Overwrite in place (never append).
bun ~/.claude/skills/sentinel/Tools/SentinelScan.ts palace-cache "$WING" "$STATUS" \
  > "$HOME/.claude/MEMORY/STATE/palace-cache-${WING}.sh"
```

Idempotent — overwrites in place, never appends. If `status` errors
or jq is missing, the file is still written with `0`/`0` so the
statusline sees a real cache (renders `Drwr:0`) rather than a missing
cache (renders `Drwr:—`). Bridge unavailability degrades gracefully.

**Step 6d — Push commitments and deferrals (if any):**

If the session extracted commitments or deferrals (via MemoryHarvest), sync them:

```bash
bun ~/.claude/skills/research/Tools/SaveCommitmentsToStudio.ts --import-all
bun ~/.claude/skills/research/Tools/SaveDeferralsToStudio.ts --import-all
```

These read from the KG and push any `committed_to` and `deferred` facts to Studio. Fire-and-forget.

## Output

After all phases complete, output a summary. Open EVERY run with the shared
`renderReportHeader` band (`Tools/render-report.ts`), and — **the single most
dangerous output bug this guards** — if inference was unavailable (Step 2b
"continue with static data only") OR the Phase-3 bridge write degraded, open with
`renderDegradedBanner` FIRST and render the inference-derived sections as explicit
placeholders with Health `n/a`. A degraded scan must NEVER render identically to a
healthy repo (empty Conventions + a clean Health %) — absent findings are not
"clean" when the analyzer never ran (ISC-37/38).

```
── Sentinel Scan · {name} · wing {wing} · {UTC} · {OK|DEGRADED} ──

{if DEGRADED, the renderDegradedBanner block here naming the cause —
 e.g. "inference unavailable — static data only"}

## Sentinel Scan Complete

**Project:** {name}
**Path:** {path}
**Stack:** {language} + {framework} on {runtime}
**Architecture:** {architecture_pattern}

### Discoveries
{Counts come from the Phase-3 direct-SQLite read-back (Step 3 verify), NOT the
 batch request size — the bridge exits 0 even when writes roll back. If the
 verified `ok` count is below the attempted `total`, render a partial-failure
 line and do NOT claim full success (ISC-39).}
- **{N} conventions** discovered (confidence >= 0.7)   {or `n/a — inference degraded`}
- **{N} key decisions** documented                     {or `n/a — inference degraded`}
- **{ok}/{total} KG triples** persisted (verified by SQLite count)
- **{ok}/{total} drawers** filed in wing `{wing}` (verified by SQLite count)
- {if ok < total:} ⚠️ **PARTIAL WRITE — {total-ok} of {total} ops did not persist; re-run Phase 3 before trusting this scan.**

### Architecture Artifacts
- **Module Map:** `{DOCS_DIR}/MODULE-MAP.md` (Mermaid dependency diagram)
- **C4 Context:** `{DOCS_DIR}/C4-CONTEXT.md` (system boundary diagram)
- **C4 Container:** `{DOCS_DIR}/C4-CONTAINER.md` (deployable units diagram)
- **ADRs:** `{DOCS_DIR}/ADRS.md` ({N} decisions — RFC corpus on Durante projects, else git history)
- **Tech Debt:** `{DOCS_DIR}/TECH-DEBT.md` (health score: {X}%)
{Only when durante.isDuranteProject:}
- **Durante-Native:** `{DOCS_DIR}/DURANTE-NATIVE.md` ({W} workflows · {P} PRDs · {R} RFCs · {A} agent packs · {S} skills)

### Conventions
{List each convention: category + pattern}

### Findings — Tiered (Phase 2d)
Each tier states its action-meaning inline so a reader knows what the count
*obligates* without cross-referencing Step 2d-ii (ISC-44):
- 🔴 CRITICAL: {N} — block: fix before the next ship — {one line each}
- 🟠 HIGH: {N} — schedule: address this sprint — {one line each}
- 🟡 MEDIUM: {N} — track: log as tech-debt, revisit
- 🟢 LOW: {N} — note: advisory only, no action required
- ⏳ Unverified gap probes: {N} — upstream-gap rows still `probe: "unverified"` (they
  tier HIGH until probed — a skipped probe must stay visible, never silently drop)
- ✅ Historical (verified fixed): {N} — Step 2b-v refuted indicators, receipts in TECH-DEBT.md

Health: **{health_score}% ({healthy} of {total} conventions clean — live sweep,
{mechanical_coverage})** — headline metric (`renderPercent`, denominator always
shown; method is the Step 2b-iv LIVE sweep, never the git-mined indicator count).
When the scan is DEGRADED, render Health as `n/a — inference unavailable`, never a
number, so a partial run is not mistaken for a healthy one (ISC-41).

### Changes Since Last Scan
{N} new · {N} drifted · {N} resolved   (or "First scan — no prior baseline")

### CLAUDE.md + SNAPSHOT.md
- `Docs/Sentinel/SNAPSHOT.md` — {Created | Updated} with full conventions body ({N} lines)
- CLAUDE.md `## Sentinel Conventions` — {Created | Updated} with 5-line summary + pointer

### Studio Sync
{Synced | Skipped (no API key)} — conventions, health score, architecture pushed to Studio

### Next Steps
- Run `sentinel guard` to check staged changes against these conventions
- Run `sentinel status` to see convention health anytime
- Run `sentinel evolve` if you intentionally change a pattern
- Review `{DOCS_DIR}/` for architecture documentation (Docs/Sentinel/ or .sentinel/docs/)
```

## Convention Cache

After Phase 2, also generate `.sentinel/conventions.json` for the optional Guard hook:

```bash
bun ~/.claude/skills/sentinel/Tools/ConventionCache.ts
```

This reads `.sentinel/scan-report.json` + the inference output and generates a JSON cache of enforceable conventions with regex patterns. The Guard hook reads this for fast (<2s) static checks.

## Error Handling

- If SentinelScan.ts fails: report error, stop pipeline
- If Inference fails: continue with static data only (skip Phase 2 conventions, Phase 3 still writes stack facts)
- If bridge.py fails on a single call: log warning, continue with next call
- If CLAUDE.md or `Docs/Sentinel/SNAPSHOT.md` write fails: log warning, report in output (the two writes are independent — partial success is OK)
- If PROJECTS.md update fails: log warning, report in output

## Timing

- Phase 1 (static): 2-5 seconds
- Phase 2 + 2c (inference + upstream grounding — run concurrently): 10-20 seconds
- Phase 2b (architecture artifacts): 10-15 seconds
- Phase 2d (convergence & tiering): 3-6 seconds
- Phase 3 (MemPalace): 5-10 seconds (sequential bridge calls)
- Phase 4 (CLAUDE.md + SNAPSHOT.md): 1-2 seconds
- Phase 5 (registration): 1 second
- **Total: ~35-60 seconds** (Phase 2 ∥ Phase 2c overlaps the upstream fetch)
