---
name: Standard Research
description: Default research mode — 4 parallel metered researcher subagents (Perplexity, Claude, Gemini, Brave) with URL verification
status: STABLE
bestPath:
  - title: "Umbrella Query"
    description: "One focused query capturing the user's intent."
  - title: "Spawn 4 Researchers"
    description: "Single Task batch: Claude, Gemini, Perplexity, Brave — all metered via Studio."
  - title: "URL Verification"
    description: "Every cited URL gated through verify-urls."
  - title: "Synthesize & Sync"
    description: "Merge the four perspectives; save + sync the report."
---

# Standard Research Workflow

**Mode:** 4 diverse perspectives via parallel metered subagents | **Timeout:** 1 minute

## 🚨 CRITICAL: URL Verification Required

**BEFORE delivering any research results with URLs:**
1. Verify EVERY URL using WebFetch or curl
2. Confirm the content matches what you're citing
3. NEVER include unverified URLs - research agents HALLUCINATE URLs
4. A single broken link is a CATASTROPHIC FAILURE

**Before delivery, run the verify-urls gate (`bun ~/.claude/skills/research/Tools/verify-urls.ts`) over all citations — a flagged URL must be annotated, never silently shipped.**

See `SKILL.md` for full URL Verification Protocol.

## When to Use

- Default mode for most research requests
- User says "do research" or "research this"
- Need multiple perspectives quickly

## Workflow

### Step 1: Craft One Umbrella Query

Create ONE focused query that captures the user's intent. The four perspectives are the `count=4 diversity=high` selection from the single-owner provider pool `Router.DEFAULT_RESEARCH_POOL` (`Packs/research/src/Router.ts` — the SoT roster of six providers: claude, perplexity, gemini, brave, grok, codex). For Standard mode that selection resolves to the first four distinct backends:
- **ClaudeResearcher** (anthropic): academic depth via Claude WebSearch
- **PerplexityResearcher** (perplexity): real-time web with inline Sonar citations
- **GeminiResearcher** (google): multi-perspective synthesis, cross-domain
- **BraveResearcher** (brave): source-first search with independent index

### Step 2: Spawn 4 metered subagents in parallel (single Task batch — METERED via Studio)

**INVOKE THIS NOW via the Task tool — issue all 4 spawns in a SINGLE message with 4 parallel Task tool_use blocks. Each subagent's prompt at `~/.claude/agents/{Name}.md` already contains the binding instruction to invoke its provider's metered CLI (`bun ~/.claude/skills/research/Tools/{Perplexity,BraveSearch,Gemini,...}.ts`), which routes through the Studio gateway and meters credits.**

Spawn shape (one tool call per researcher, all in the same message):

```
Task(subagent_type="ClaudeResearcher",     description="Standard research on X",
     prompt="<umbrella query + 'Return findings in DOS output format'>")
Task(subagent_type="GeminiResearcher",     description="Standard research on X", ...)
Task(subagent_type="PerplexityResearcher", description="Standard research on X", ...)
Task(subagent_type="BraveResearcher",      description="Standard research on X", ...)
```

**Why subagents, not `Research.searchPerspectives`:** the `searchPerspectives` router is a Phase 1 stub (`Packs/research/src/Tools/SearchPerspectives.ts` calls `stubProviderCall()` which returns empty perspectives and charges zero credits — provider wiring is deferred to RFC-0015 §15 Phase 3). Until that lands, the subagent fan-out is the only path that actually hits the metered gateway.

**Direct CLI alternative (skip subagents, fewer tokens but lose persona/triple-check rigor):** invoke the four CLIs directly in a single Bash batch. The four
command strings (and their flag conventions — model, recency, type, count) have
one tested owner so they don't drift across workflows; print them with the query
interpolated via:

```bash
bun ~/.claude/skills/research/Tools/ResearchCli.ts standard-clis "<query>"
```

which emits, byte-identical:

```bash
bun ~/.claude/skills/research/Tools/Perplexity.ts --model sonar --recency week --json-only "<query>"
bun ~/.claude/skills/research/Tools/BraveSearch.ts --type web --count 10 --extra-snippets --json-only "<query>"
bun ~/.claude/skills/research/Tools/Gemini.ts --json-only "<query>"
bun ~/.claude/skills/research/Tools/Grok.ts --json-only "<query>"
```

Run them as four parallel Bash tool calls in a single message for ~4× wall-clock speedup. Each CLI emits structured JSON to stdout with `chargedCredits` reported.

> **Roster note (single owner):** this direct-CLI set is the same `Router.DEFAULT_RESEARCH_POOL` (SoT), filtered to the pool members that ship a `Tools/*.ts` CLI adapter. That is why it diverges from the subagent set on two principled points, not by accident:
> - **Claude** has no metered CLI — its researcher uses Claude's built-in WebSearch tool, not a `Tools/Claude.ts` — so Claude is covered by the subagent path only; the direct-CLI fallback fills that slot with **Grok**, the next pool member that ships an adapter.
> - **Codex** (pool member #6, `apiBackend: openai`) has a `CodexResearcher` agent but **no `Tools/Codex.ts` adapter yet**, so it is agent-only and appears in neither Standard-mode list. Operator action: build `Tools/Codex.ts` before listing codex as a working CLI.

<!-- partial: _intent-to-flag-table.md skill_name=Research workflow_name=StandardResearch -->

## Intent-to-Flag Mapping

For the **direct CLI alternative** (Step 2 fallback path), each provider's flags map to user intent as follows:

CLI: `bun ~/.claude/skills/research/Tools/Perplexity.ts`

| User Intent | Flag Combination |
|-------------|------------------|
| Standard perspective (default) | `--model sonar --recency week --json-only "X"` |
| Deep / nuanced angle | `--model sonar-pro --json-only "X"` |
| Strategic synthesis pass | `--model sonar-reasoning-pro --reasoning high --json-only "X"` |
| Academic-source angle | `--model sonar --search-mode academic --json-only "X"` |

CLI: `bun ~/.claude/skills/research/Tools/BraveSearch.ts`

| User Intent | Flag Combination |
|-------------|------------------|
| Standard web sources (default) | `--type web --count 10 --extra-snippets --json-only "X"` |
| Current events angle | `--type news --freshness pw --json-only "X"` |
| Wider net (cast broad) | `--type web --count 20 --extra-snippets --json-only "X"` |
| Country-targeted sources | add `--country <2-letter-code>` |

CLI: `bun ~/.claude/skills/research/Tools/Gemini.ts`

| User Intent | Flag Combination |
|-------------|------------------|
| Multi-perspective synthesis (default) | `--json-only "X"` |
| Cross-domain angle | `--json-only "X"` |

CLI: `bun ~/.claude/skills/research/Tools/Grok.ts`

| User Intent | Flag Combination |
|-------------|------------------|
| Contrarian / fact-based angle (default) | `--json-only "X"` |

**Subagent path (Step 2 primary):** when spawning `PerplexityResearcher` / `BraveResearcher` / `ClaudeResearcher` / `GeminiResearcher` via Task, those agents' system prompts already encode the right flag conventions per query type — pass plain English in the `prompt` field.

### Step 3: Quick Synthesis

The `result.synthesis` envelope already contains `agree / conflicts / gaps`
arrays. Additional caller-side synthesis:
- Note where perspectives agree (high confidence)
- Note unique contributions from each provider
- Flag any conflicts surfaced by the router
- Prefer perspectives from the Perplexity backend when confirming factual claims (inline citations)

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

**Then run the verify-urls gate over every citation as the delivery checkpoint:**

```bash
bun ~/.claude/skills/research/Tools/verify-urls.ts <report-file-or-urls>
```

A flagged URL must be annotated, never silently shipped.

**If URL fails verification:**
- Remove it from results
- Find alternative source via WebSearch
- Verify the replacement URL
- NEVER include unverified URLs

### Step 5: Save Research Report (MANDATORY)

**Persist findings to disk so the research counter tracks it.**

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write report to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_{topic-slug}.md`

The report skeleton (frontmatter + per-perspective headings + empty-state slots)
is rendered by the golden-tested owner — do not hand-type it; fill the bracketed
body slots with each perspective's findings:

```bash
bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report \
  "$(jq -nc --arg date "$(date +%F)" --arg topic "{topic}" \
     '{mode:"standard",date:$date,topic:$topic}')"
```

This emits, byte-identical:

```markdown
---
mode: standard
date: {YYYY-MM-DD}
topic: {topic}
perspectives: 4 (claude, gemini, perplexity, brave)
---

# {Topic} — Standard Research

## Synthesis
[From result.synthesis: agree / conflicts / gaps across perspectives]

## Perspective: claude
[Key findings — anthropic backend]

## Perspective: gemini
[Key findings — google backend]

## Perspective: perplexity
[Key findings — perplexity backend with cited source URLs]

## Perspective: brave
[Key findings — brave backend with URLs from independent index]

## Sources
[Verified URLs only]
```

### Step 5b: Sync to Studio

The research file lands in `MEMORY/RESEARCH/{YYYY-MM}/` and is automatically
synced to Studio at SessionEnd via `SaveResearchVaultsToStudio.ts` (one of the
16 fire-and-forget sync tools). No explicit per-file sync invocation is
needed — the orchestrator scans all RESEARCH dirs (project-level + global) and
ships them to `/api/v1/research`. Silently skips when `STUDIO_API_URL` is not set.

### Step 5c: Log Artifact Entry

Immediately after the file is written, append one entry to `artifacts.jsonl` so
`SaveArtifactsToStudio` can ship it. The JSONL line is rendered by the
golden-tested owner (`ResearchRender.ts log-artifact`) so the schema and key
order stay byte-identical across all workflows:

```bash
VAULT_PATH="$RESEARCH_BASE/$(date +%Y-%m)/$(date +%Y-%m-%d)_{topic-slug}.md"
PREVIEW="$(head -c 200 "$VAULT_PATH" 2>/dev/null | tr '\n' ' ')"
mkdir -p "$DOS_DIR/MEMORY/ARTIFACTS"
bun ~/.claude/skills/research/Tools/ResearchRender.ts log-artifact "$(jq -nc \
  --arg title "{topic} — Standard Research" --arg path "$VAULT_PATH" \
  --arg preview "$PREVIEW" --arg ts "$(date -u +%FT%TZ)" --arg sid "${DOS_SESSION_ID:-}" \
  '{workflow:"StandardResearch",title:$title,path:$path,contentPreview:$preview,sessionId:$sid,timestamp:$ts}')" \
  >> "$DOS_DIR/MEMORY/ARTIFACTS/artifacts.jsonl"
```

### Step 6: Return Results

```markdown
📋 SUMMARY: Research on [topic]
🔍 ANALYSIS: [Key findings from 2 perspectives]
⚡ ACTIONS: 4 researcher subagents spawned via Task (Perplexity, Claude, Gemini, Brave — Step 2 pattern; searchPerspectives stub bypassed)
✅ RESULTS: [Synthesized answer]
📊 STATUS: Standard mode - 4 perspectives, 1 umbrella query
📁 CAPTURE: [Key facts]
➡️ NEXT: [Suggest extensive if more depth needed]
📖 STORY EXPLANATION: [5-8 numbered points]
🎯 COMPLETED: Research on [topic] complete
```

## Speed Target

~15-30 seconds for results