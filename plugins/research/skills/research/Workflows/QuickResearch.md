---
name: Quick Research
description: Single-agent web lookup in 10-15 seconds
status: STABLE
featured: true
successRate: 96.8
icon: Search
bestPath:
  - title: "Query Formation"
    description: "Refine user intent into targeted search queries."
  - title: "Single-Agent Web Search"
    description: "Execute focused web search with source quality filtering."
  - title: "Result Synthesis"
    description: "Synthesize findings into a concise, structured answer."
---

# Quick Research Workflow

**Mode:** Single-perspective research via the metered Perplexity CLI | **Timeout:** 30 seconds

## When to Use

- User says "quick research" or "minor research"
- Simple, straightforward queries
- Time-sensitive requests
- Just need a fast answer

## Workflow

### Step 1: Invoke the Perplexity CLI directly (METERED via Studio)

**INVOKE THIS NOW via the Bash tool — do not paraphrase, do not re-render as TypeScript.** This single Bash call routes through the Studio gateway at `/api/v1/inference/perplexity/messages`, which meters credits and returns real-time web results with inline citations.

```bash
bun ~/.claude/skills/research/Tools/Perplexity.ts \
  --model sonar \
  --recency week \
  --json-only \
  "<the user's query, properly quoted>"
```

**Parse the JSON output:** stdout is a single JSON object — `{ content, citations[], searchResults[], usage, mode, chargedCredits, actualCostCents }`. Pipe through `jq` if you need just one field. NEVER use built-in WebFetch or WebSearch as a substitute — those are unmetered and produce no citation provenance.

**Why a CLI, not `Research.searchPerspectives`:** the `searchPerspectives` router is a Phase 1 stub (returns empty perspectives, charges zero credits — see `Packs/research/src/Tools/SearchPerspectives.ts`). Until Phase 3 wires real provider calls, the CLI is the only path that actually hits the metered gateway.

**Useful flags:**
- `--model sonar-pro` — escalate when default `sonar` is shallow
- `--recency hour|day|week|month` — narrow to recent sources
- `--search-mode academic|sec` — scholarly papers / SEC filings
- `--related` — request follow-up questions for next-iteration seeding

**Optional: spawn the PerplexityResearcher subagent instead** — when the query benefits from triple-verified, multi-citation synthesis with persona, use the Task tool to spawn `PerplexityResearcher` (Ava Chen) which runs 2-5 sub-queries through the same CLI and synthesizes:

```
Task(subagent_type="PerplexityResearcher", description="Quick research on X",
     prompt="<query + context>")
```

The subagent prompt at `~/.claude/agents/PerplexityResearcher.md` already contains the binding instruction to invoke `bun ~/.claude/skills/research/Tools/Perplexity.ts ...` — Studio will meter every CLI call it makes.

### Step 2: Save Research Report (MANDATORY)

**Persist findings to disk so the research counter tracks it.**

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write report to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_{topic-slug}.md`

The report skeleton (frontmatter + section headings + empty-state slots) is
rendered by the golden-tested owner — do not hand-type it; fill the bracketed
body slots with your findings:

```bash
bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report \
  "$(jq -nc --arg date "$(date +%F)" --arg topic "{topic}" \
     '{mode:"quick",date:$date,topic:$topic}')"
```

This emits, byte-identical:

```markdown
---
mode: quick
date: {YYYY-MM-DD}
topic: {topic}
providers: 1 (perplexity)
---

# {Topic} — Quick Research

## Findings
[Key findings from the Perplexity CLI call (`Tools/Perplexity.ts` — Step 1; searchPerspectives stub bypassed)]

## Sources
[Verified URLs only]
```

### Step 2b: Sync to Studio

The research file lands in `MEMORY/RESEARCH/{YYYY-MM}/` and is automatically
synced to Studio at SessionEnd via `SaveResearchVaultsToStudio.ts` (one of the
16 fire-and-forget sync tools). No explicit per-file sync invocation is
needed — the orchestrator scans all RESEARCH dirs (project-level + global) and
ships them to `/api/v1/research`. Silently skips when `STUDIO_API_URL` is not set.

### Step 2c: Log Artifact Entry

Immediately after the file is written, append one entry to `artifacts.jsonl` so
`SaveArtifactsToStudio` can ship it. The JSONL line is rendered by the
golden-tested owner (`ResearchRender.ts log-artifact`) so the schema and key
order stay byte-identical across all workflows:

```bash
VAULT_PATH="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{topic-slug}.md"
PREVIEW="$(head -c 200 "$VAULT_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact "$(jq -nc \
  --arg title "{topic} — Quick Research" --arg path "$VAULT_PATH" \
  --arg preview "$PREVIEW" --arg ts "$(date -u +%FT%TZ)" --arg sid "${DOS_SESSION_ID:-}" \
  '{workflow:"QuickResearch",title:$title,path:$path,contentPreview:$preview,sessionId:$sid,timestamp:$ts}')" \
  >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

<!-- partial: _intent-to-flag-table.md skill_name=Research workflow_name=QuickResearch -->

## Intent-to-Flag Mapping

CLI: `bun ~/.claude/skills/research/Tools/Perplexity.ts`

| User Intent | Flag Combination |
|-------------|------------------|
| "Quick research on X" (default) | `--model sonar --json-only "X"` |
| "What's the latest on X" | `--model sonar --recency week --json-only "X"` |
| "Has anything happened today on X" | `--model sonar --recency day --json-only "X"` |
| "Research X with sources we can cite" | `--model sonar --recency week --related --json-only "X"` |
| "Deep one-shot — sonar feels shallow" | `--model sonar-pro --json-only "X"` |
| "Strategic / multi-hop reasoning on X" | `--model sonar-reasoning-pro --reasoning high --json-only "X"` |
| "Academic angle on X" | `--model sonar --search-mode academic --json-only "X"` |
| "SEC filings only for X" | `--model sonar --search-mode sec --json-only "X"` |
| "Cap to N tokens" | add `--max-tokens N` |
| "Pure LLM, no web" (rare) | add `--disable-search` |

### Step 3: Return Results

Report findings using standard format:

```markdown
📋 SUMMARY: Quick research on [topic]
🔍 ANALYSIS: [Key findings]
⚡ ACTIONS: 1 perspective via the Perplexity CLI (searchPerspectives stub bypassed)
✅ RESULTS: [Answer]
📊 STATUS: Quick mode - 1 perspective, 1 query
📁 CAPTURE: [Key facts]
➡️ NEXT: [Suggest standard research if more depth needed]
📖 STORY EXPLANATION: [3-5 numbered points - keep brief]
🎯 COMPLETED: Quick answer on [topic]
```

## Speed Target

~10-15 seconds for results