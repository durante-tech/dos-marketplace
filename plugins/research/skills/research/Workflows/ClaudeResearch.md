---
name: Claude Research
description: Academic-depth single-researcher mode via Claude WebSearch with the mandatory URL-verification gate
status: STABLE
bestPath:
  - title: "Query Decomposition"
    description: "Break the question into parallel WebSearch sub-queries."
  - title: "Parallel Search"
    description: "Execute the sub-queries and collect scholarly-grade sources."
  - title: "URL Verification"
    description: "Gate every citation through verify-urls before shipping."
  - title: "Synthesis & Vault"
    description: "Synthesize findings and persist the report to MEMORY/RESEARCH."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
---

# Claude Web Research Workflow

**Mode:** Claude built-in WebSearch (no API keys, free) | Single agent, multi-query decomposition

Free web research using Claude's native WebSearch tool. Decomposes a research
question into up to 8 targeted sub-queries, runs them in parallel, and
synthesizes the findings. No API keys, no metered credits — this is the
no-cost path, and the slot the metered direct-CLI fallback can't cover (Claude
has no `Tools/*.ts` CLI adapter; see `StandardResearch.md`).

## 🚨 CRITICAL: URL Verification Required

**BEFORE delivering any research results with URLs:**
1. Verify EVERY URL using WebFetch or curl
2. Confirm the content matches what you're citing
3. NEVER include unverified URLs - research agents HALLUCINATE URLs
4. A single broken link is a CATASTROPHIC FAILURE

**Before delivery, run the verify-urls gate (`bun ~/.claude/skills/research/Tools/verify-urls.ts`) over all citations — a flagged URL must be annotated, never silently shipped.**

See `SKILL.md` for full URL Verification Protocol.

## When to Use

- Claude WebSearch only (free, no API keys) — routed here from `SKILL.md` Workflow Routing
- Metered provider CLIs unavailable, or credit-free research is preferred
- A quick decomposed web sweep using Claude's built-in reasoning

## Workflow

### Step 1: Decompose the question into search queries

Do NOT hand-write the decomposition, and do NOT mirror its logic here. Call the
single tested owner — `generateSearchQueries()` in
`Packs/research/src/Tools/ResearchCli.ts` (oracle-tested in `ResearchCli.test.ts`) —
via its CLI entry point, so this workflow can never drift from the canonical
query logic:

```bash
bun ~/.claude/skills/research/Tools/ResearchCli.ts search-queries "<your research question>"
```

This emits the targeted sub-queries (capped at 8) as the single source of truth.
Read them from stdout — they are the queries to execute in Step 2.

### Step 2: Execute searches via Claude WebSearch

For each query emitted in Step 1, run Claude's built-in **WebSearch** tool. Issue
them in a single message so they run in parallel:

```
WebSearch: "<query 1>"
WebSearch: "<query 2>"
...
```

Run iterative follow-up searches when the initial findings surface new threads
worth chasing.

### Step 3: Synthesize

Combine the findings across all queries into one coherent answer:
- Lead with the headline finding
- Note where independent queries corroborate (high confidence)
- Flag gaps or conflicts between sources
- Collect every cited URL for the verification gate in Step 4

### Step 4: VERIFY ALL URLs (MANDATORY)

**Before delivering results, verify EVERY URL, then run the verify-urls gate as
the delivery checkpoint:**

```bash
# For each cited URL:
curl -s -o /dev/null -w "%{http_code}" -L "URL"   # must return 200

# Then run the gate over all citations:
bun ~/.claude/skills/research/Tools/verify-urls.ts '["https://url1", "https://url2"]'
# (single JSON arg — bare array or {"urls":[...]}; also accepts the same JSON on stdin)
```

A flagged URL must be annotated, never silently shipped. Remove or replace any
URL that fails verification (find an alternative via WebSearch and re-verify).

### Step 5: Save Research Report (MANDATORY)

Persist findings to disk so the research counter tracks the run. Resolve the
project-level RESEARCH dir via the same tested owner the other workflows call
(mirrors `getMemorySubdir`, project -> cwd -> global):

```bash
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

Write the report to `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_{topic-slug}.md` with
frontmatter (`mode: claude-websearch`, `date`, `topic`), the executed queries,
and the synthesized findings. The file lands in `MEMORY/RESEARCH/{YYYY-MM}/` and
is auto-synced to Studio at SessionEnd via `SaveResearchVaultsToStudio.ts` — no
explicit per-file sync is needed.

### Step 6: Return Results

```markdown
📋 SUMMARY: Claude WebSearch research on [topic]
🔍 ANALYSIS: [Key findings across the decomposed queries]
⚡ ACTIONS: N WebSearch queries (decomposed via ResearchCli), all URLs verified
✅ RESULTS: [Synthesized answer]
📊 STATUS: Claude WebSearch mode — 1 agent, N queries
📁 CAPTURE: [Key facts]
➡️ NEXT: [Suggest standard / extensive if more depth needed]
🎯 COMPLETED: Claude WebSearch research on [topic] complete
```

## Intent-to-Flag Mapping

Claude WebSearch is a **native tool, not a flagged CLI** — the decomposed query
string is its only input, so there are no provider flags to tune per intent. The
helper CLIs this workflow shells out to are fixed-subcommand (no intent-variant
flags); depth/breadth is controlled by the query decomposition in Step 1, which
is owned by `ResearchCli`, not by per-call flags.

| Step / Intent | Invocation (fixed — nothing to tune per intent) |
|---------------|--------------------------------------------------|
| Decompose the question | `bun ~/.claude/skills/research/Tools/ResearchCli.ts search-queries "<question>"` |
| Run each sub-query | Claude built-in `WebSearch: "<query>"` (native tool, no flags) |
| Verify citations before delivery | `bun ~/.claude/skills/research/Tools/verify-urls.ts '["https://url1", "https://url2"]'
# (single JSON arg — bare array or {"urls":[...]}; also accepts the same JSON on stdin)` |
| Resolve the RESEARCH dir | `bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir` |

## Advantages

- Uses Claude's built-in WebSearch — no API keys, no metered credits
- Free and unlimited
- Integrated with Claude's reasoning and knowledge

## Notes

- This workflow has no metered CLI adapter: Claude WebSearch is a native tool,
  not a `Tools/*.ts` CLI. In `StandardResearch.md`'s direct-CLI fallback the
  Claude slot is therefore covered by the subagent path only — consistent with
  the single-owner roster in `Router.DEFAULT_RESEARCH_POOL`.
