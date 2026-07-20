---
name: Deep Research (multi-perspective)
description: Multi-angle research synthesized across 12 Task-spawned metered researcher subagents (3 angle groups x 4 backends)
status: STABLE
featured: true
successRate: 94.2
icon: Search
bestPath:
  - title: "Query Decomposition"
    description: "Break the research question into themed angle groups."
  - title: "Multi-Angle Perspective Fan-Out"
    description: "Spawn the 4 research-skill researchers per angle group (12 parallel Task spawns)."
  - title: "Cross-Source Synthesis"
    description: "Merge and deduplicate findings across all perspective results."
  - title: "Structured Report"
    description: "Compile final report with citations, confidence scores, and key insights."
---

# Extensive Research Workflow

**Mode:** 3 angle groups × 4 metered researcher subagents each (12 Task spawns) | **Timeout:** 5 minutes

## 🚨 CRITICAL: URL Verification Required

**BEFORE delivering any research results with URLs:**
1. Verify EVERY URL using WebFetch or curl
2. Confirm the content matches what you're citing
3. NEVER include unverified URLs - research agents HALLUCINATE URLs
4. A single broken link is a CATASTROPHIC FAILURE

See `SKILL.md` for full URL Verification Protocol.

## When to Use

- User says "extensive research" or "do extensive research"
- Deep-dive analysis needed
- Comprehensive multi-domain coverage required
- The "big daddy" research mode

## Workflow

### Step 0: Generate Angle Groups (deep thinking)

**Use deep thinking to generate three themed angle groups:**

Think deeply about the research topic:
- Explore multiple unusual perspectives and domains
- Question assumptions about what's relevant
- Make unexpected connections across fields
- Consider edge cases, controversies, emerging trends

Generate 3 angle groups — one per theme:
- **Group A — Academic / analytical:** scholarly depth, peer-reviewed sources
- **Group B — Multi-perspective / cross-domain:** synthesis across fields
- **Group C — Contrarian / fact-based:** unbiased, data-driven, controversy-tolerant

### Step 1: Fan Out via Task-spawned researcher subagents (METERED via Studio)

> Re-routed 2026-07-10 (Tailor Gen 59, operator-signed): this workflow previously called
> `Research.searchPerspectives()`, a Phase-1 stub that returns empty perspectives. Until the
> intent router ships real provider dispatch (RFC-0015 §15 Phase 3), extensive mode uses the
> same Task-spawn pattern as `StandardResearch.md` Step 2 — scaled to 3 angle groups.

**INVOKE THIS NOW via the Task tool — 12 spawns in a SINGLE message (3 angle groups × the 4
research-skill researchers). Each researcher's agent prompt already binds it to its metered
CLI (Studio gateway, credits metered).** Per group, give all 4 researchers the group's angle
prompt; vary only the angle framing between groups:

```
# Group A — academic / analytical
Task(subagent_type="ClaudeResearcher",     description="Extensive research A on X",
     prompt="<[topic] — academic/analytical angle: [angle-group A prompt] + 'Return findings in DOS output format'>")
Task(subagent_type="PerplexityResearcher", description="Extensive research A on X", ...)
Task(subagent_type="GeminiResearcher",     description="Extensive research A on X", ...)
Task(subagent_type="BraveResearcher",      description="Extensive research A on X", ...)

# Group B — multi-perspective / cross-domain   (same 4 researchers, B prompt)
# Group C — contrarian / fact-based            (same 4 researchers, C prompt)
```

**Contract:**
- 12 parallel subagents; each returns findings + sources in DOS output format
- Every researcher hits its own metered provider CLI — 4 distinct backends per group
- URL verification (the protocol above) applies to every returned source

### Step 2: Collect Results (5 MINUTE TIMEOUT)

- The 12 Task spawns run in parallel (single message, 12 tool_use blocks)
- Most researchers resolve within 30-90 seconds
- **HARD TIMEOUT: 5 minutes** — treat any researcher still running as timed out
- Note any researcher that returned no findings (backend timeout or empty search)

### Step 3: Comprehensive Synthesis

**Synthesis requirements:**
- Identify themes across all 3 angle groups × 4 researchers each
- Cross-validate findings across the 4 distinct backends within each group
- Highlight unique insights per researcher (Claude depth, Perplexity citations,
  Gemini cross-domain, Brave independent index)
- Note where researchers agree; flag conflicts and gaps YOURSELF — synthesis is
  the primary agent's job (no router synthesis envelope exists)

**Report structure:**
```markdown
## Executive Summary
[2-3 sentence overview]

## Key Findings
### [Theme 1]
- Finding (confirmed by: ClaudeResearcher, GeminiResearcher)
- Finding (source: BraveResearcher)

### [Theme 2]
...

## Unique Insights by Provider
- **claude backend**: [analytical depth]
- **gemini backend**: [cross-domain connections]
- **grok backend**: [contrarian perspectives]

## Conflicts & Uncertainties
[Note disagreements you identified across researchers]
```

### Step 4: VERIFY ALL URLs (MANDATORY)

**Before delivering results, verify EVERY URL:**

```bash
# For each URL returned by agents:
curl -s -o /dev/null -w "%{http_code}" -L "URL"
# Must return 200

# Then verify content:
WebFetch(url, "Confirm article exists and summarize main point")
# Must return actual content, not error
```

**If URL fails verification:**
- Remove it from results
- Find alternative source via WebSearch
- Verify the replacement URL
- NEVER include unverified URLs

**Extensive mode generates MANY URLs - allocate time for verification.**

### Step 5: Save Research Report (MANDATORY)

**Persist findings to disk so the research counter tracks it.**

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write report to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_{topic-slug}.md`

The report skeleton (frontmatter + theme/provider headings + empty-state slots)
is rendered by the golden-tested owner — do not hand-type it; fill the bracketed
body slots with the synthesized findings:

```bash
bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report \
  "$(jq -nc --arg date "$(date +%F)" --arg topic "{topic}" \
     '{mode:"extensive",date:$date,topic:$topic}')"
```

This emits, byte-identical:

```markdown
---
mode: extensive
date: {YYYY-MM-DD}
topic: {topic}
perspectives: 9 (3 angle groups × 3 provider perspectives each)
---

# {Topic} — Extensive Research

## Executive Summary
[2-3 sentence overview]

## Key Findings by Theme
### [Theme 1]
[Findings with per-provider attribution]

### [Theme 2]
[Findings with per-provider attribution]

## Unique Insights by Provider
- **claude backend**: [analytical depth]
- **gemini backend**: [cross-domain connections]
- **grok backend**: [contrarian perspectives]

## Conflicts & Uncertainties
[Disagreements identified across researchers]

## Sources
[Verified URLs only]
```

### Step 5b: Sync to Studio

The research file (or vault directory) lands in `MEMORY/RESEARCH/{YYYY-MM}/`
and is automatically synced to Studio at SessionEnd via
`SaveResearchVaultsToStudio.ts` (one of the 16 fire-and-forget sync tools).
No explicit per-file sync invocation is needed — the orchestrator scans all
RESEARCH dirs (project-level + global), packages directory-mode entries with
their full vaultFiles tree, and ships them to `/api/v1/research`. Silently
skips when `STUDIO_API_URL` is not set.

### Step 5c: Log Artifact Entry

Immediately after the file is written, append one entry to `artifacts.jsonl` so
`SaveArtifactsToStudio` can ship it. The JSONL line is rendered by the
golden-tested owner (`ResearchRender.ts log-artifact`) — fixed schema, fixed key
order, byte-identical across workflows:

```bash
VAULT_PATH="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{topic-slug}.md"
PREVIEW="$(head -c 200 "$VAULT_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact "$(jq -nc \
  --arg title "{topic} — Extensive Research" --arg path "$VAULT_PATH" \
  --arg preview "$PREVIEW" --arg ts "$(date -u +%FT%TZ)" --arg sid "${DOS_SESSION_ID:-}" \
  '{workflow:"ExtensiveResearch",title:$title,path:$path,contentPreview:$preview,sessionId:$sid,timestamp:$ts}')" \
  >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

### Step 6: Return Results

```markdown
📋 SUMMARY: Extensive research on [topic]
🔍 ANALYSIS: [Comprehensive findings by theme]
⚡ ACTIONS: 12 researcher subagents (3 angle groups × 4 backends), all metered
✅ RESULTS: [Full synthesized report]
📊 STATUS: Extensive mode - 9 perspectives, 5 min timeout
📁 CAPTURE: [Key discoveries]
➡️ NEXT: [Follow-up recommendations]
📖 STORY EXPLANATION: [8 numbered points]
🎯 COMPLETED: Extensive research on [topic] complete

📈 RESEARCH METRICS:
- Total Perspectives: 9 (3 angle groups × 3 each)
- Provider Backends: anthropic / google / perplexity / brave / xai (router picks per §7.4)
- Confidence Level: [%]
```

## Speed Target

~60-90 seconds for results (parallel execution)

## Intent-to-Flag Mapping

This workflow exposes no operator-variable, intent-mapped CLI flags, so there is no intent->flag table. The research fan-out runs through Task-spawned researcher subagents (Step 1) whose agent prompts bind the provider CLIs with fixed flags. Every CLI this file does shell out to is deterministic pack plumbing — the invocation is fully fixed by the workflow step, and no flag varies by user intent:

- `bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir` (Step 5) — fixed subcommand; resolves the project RESEARCH dir, takes no flags.
- `bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report '<json>'` (Step 5) — fixed subcommand; the JSON argument carries data (mode/date/topic), not intent flags.
- `bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact '<json>'` (Step 5c) — fixed subcommand; the JSON argument carries artifact metadata, not intent flags.
- `curl -s -o /dev/null -w "%{http_code}" -L "URL"` (Step 4) — fixed URL-liveness probe; flags are constant, not intent-selected.

Contrast `StandardResearch.md`, whose direct-CLI fallback shells the provider adapters (`Perplexity.ts`, `BraveSearch.ts`, `Gemini.ts`, `Grok.ts`) that DO expose operator-variable flags (`--model`, `--recency`, `--reasoning`, `--search-mode`) mapped to user intent — that file carries a real intent->flag table; this one structurally cannot.