---
name: Analyze Ai Trends
description: Deep trend analysis across the research vault's historical AI-news logs — evolving trends, recurring themes, trajectory shifts
status: STABLE
bestPath:
  - title: "Load Historical Logs"
    description: "Enumerate the MEMORY/RESEARCH vault chronologically via ResearchCli load-news-files."
  - title: "Cross-Log Synthesis"
    description: "GeminiResearcher deep analysis over all logs: trends, themes, trajectories, paradigm shifts."
  - title: "Trend Report"
    description: "Byte-stable report skeleton from ResearchRender trend-console, filled with the synthesis."
  - title: "Vault Persistence"
    description: "Save the trend report to MEMORY/RESEARCH with artifact logging."
---


You are executing the analyze-ai-trends command to perform deep trend analysis across historical AI news logs.

## When to Use

- User says "analyze AI trends" or "what are the AI trends"
- Cross-log/longitudinal questions ("what changed over the last months?")
- Requires ≥3 historical AI-news logs in the research vault to be meaningful


**Your task:**

### Step 1: Load All Historical AI-News Research
   - List the research logs in chronological order via the tested owner — the
     directory listing + chronological sort is deterministic, so do not
     hand-roll it (the YYYY-MM-DD filename prefix makes lexicographic ==
     chronological; that invariant is pinned by the unit test):
     ```bash
     bun ~/.claude/skills/research/Tools/ResearchCli.ts load-news-files
     # -> absolute paths from the MEMORY/RESEARCH vault ({YYYY-MM} layout), oldest first
     ```
   - Files may be in various formats: analysis.md, comprehensive-analysis.md, etc.
     The CLI returns all `*.md` logs sorted; apply your judgment to keep only the
     AI-news-relevant ones before reading them.

### Step 2: Analyze Trends Across All Logs
   - Spawn the synthesis researcher (re-routed 2026-07-10, Tailor Gen 60 — the intent router is a Phase-1 stub until RFC-0015 §15 Phase 3): `Task(subagent_type="GeminiResearcher", description="AI-trends cross-log synthesis", prompt="<all-logs context + the trend questions below> Return findings in DOS output format.")`
   - Prompt the perspective to identify:
     - **EVOLVING TRENDS**: What patterns are emerging, strengthening, or weakening over time?
     - **RECURRING THEMES**: What topics, companies, or technologies keep appearing?
     - **TRAJECTORY ANALYSIS**: Where is the industry heading based on the progression of developments?
     - **PARADIGM SHIFTS**: What major changes or inflection points can be identified?
     - **COMPETITIVE LANDSCAPE**: How are different companies, models, or approaches competing?
     - **INNOVATION VELOCITY**: Is the pace of innovation accelerating, stabilizing, or slowing?
     - **EMERGING WINNERS**: Which models, tools, or approaches are gaining momentum?
     - **DECLINING AREAS**: What's becoming less relevant or being abandoned?
     - **SURPRISING PATTERNS**: What unexpected trends or correlations emerge?
     - **FUTURE PREDICTIONS**: Based on trends, what's likely to happen next?

### Step 3: Present the Comprehensive Trend Report

 The report skeleton (emoji section
   headings + section order) is rendered by the golden-tested owner — do not
   hand-type it; fill each bracketed body slot with the Gemini synthesis:

   ```bash
   bun ~/.claude/skills/research/Tools/ResearchRender.ts trend-console
   ```

   This emits, byte-identical, the section skeleton:

```
📊 AI INDUSTRY TREND ANALYSIS

📅 Analysis Period: [First Date] to [Latest Date]
📁 Sources Analyzed: [Number] news digests

🔥 EVOLVING TRENDS
[Detailed analysis of how trends are changing over time]

🔄 RECURRING THEMES
- [Theme 1]: [Frequency and significance]
- [Theme 2]: [Frequency and significance]

📈 TRAJECTORY ANALYSIS
[Analysis of where the industry is heading]

💫 PARADIGM SHIFTS
- [Shift 1]: [What changed and when]
- [Shift 2]: [What changed and when]

⚔️ COMPETITIVE LANDSCAPE
[Analysis of competition between models, tools, companies]

⚡ INNOVATION VELOCITY
[Analysis of pace of change]

🏆 EMERGING WINNERS
- [Winner 1]: [Why they're succeeding]
- [Winner 2]: [Why they're succeeding]

📉 DECLINING AREAS
- [Area 1]: [Why it's declining]

🎯 SURPRISING PATTERNS
- [Pattern 1]: [Why it's unexpected]

🔮 FUTURE PREDICTIONS
- [Prediction 1]: [Based on which trends]
- [Prediction 2]: [Based on which trends]
- [Prediction 3]: [Based on which trends]

📌 KEY INSIGHTS
1. [Most important insight]
2. [Second most important insight]
3. [Third most important insight]

💡 ACTIONABLE RECOMMENDATIONS
- [Action 1]: [Based on trend analysis]
- [Action 2]: [Based on trend analysis]
```

**Important:**
- Read ALL log files in chronological order
- Look for patterns across multiple entries, not just individual items
- Identify both obvious and subtle trends
- Focus on actionable insights
- Use a GeminiResearcher Task spawn for deep analysis with context from all logs
- If fewer than 3 log files exist, note that trend analysis is limited
- Emphasize what's changing over time, not just what's happening

## Intent-to-Flag Mapping

This workflow shells out only to deterministic Research-pack plumbing CLIs, so there is no intent→flag table: no flag varies by user intent. Every invocation is a fixed subcommand fully determined by the workflow step.

- `ResearchCli.ts load-news-files` — lists the MEMORY/RESEARCH vault's `*.md` oldest-first, {YYYY-MM}-aware (no flags)
- `ResearchCli.ts resolve-dir` — resolves the project-level RESEARCH dir, mirroring `getMemorySubdir` (no flags)
- `ResearchRender.ts trend-console` — emits the byte-identical trend-report console skeleton (no flags)
- `ResearchRender.ts render-report '<json>'` — emits the byte-identical vault frontmatter + skeleton; the JSON is data (`mode`/`date`/`first_date`/`latest_date`/`sources`), not intent-mapped flags

Contrast `StandardResearch.md` / `ClaudeResearch.md`, whose provider CLIs (`Perplexity.ts --model/--recency/--reasoning`, `BraveSearch.ts --type/--freshness/--count`) expose flags that DO vary by user intent and therefore carry a real intent→flag table. The single deep cross-log synthesis here goes through a GeminiResearcher Task spawn (agent prompt binds the metered CLI with fixed flags), not a flagged CLI in this file.

## Save Research Report (MANDATORY)

**Persist findings to disk so the research counter tracks it.**

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write report to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_ai-trends-analysis.md`

The report skeleton (frontmatter + section headings + empty-state slots) is
rendered by the golden-tested owner — do not hand-type it; fill the bracketed
body slots with the trend synthesis:

```bash
bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report \
  "$(jq -nc --arg date "$(date +%F)" --arg first "{first_date}" \
     --arg latest "{latest_date}" --arg n "{number}" \
     '{mode:"ai-trends",date:$date,first_date:$first,latest_date:$latest,sources:$n}')"
```

This emits, byte-identical:

```markdown
---
mode: ai-trends
date: {YYYY-MM-DD}
topic: AI Industry Trend Analysis
agents: 1 (Gemini)
period: {first_date} to {latest_date}
sources: {number} news digests
---

# AI Industry Trend Analysis — {YYYY-MM-DD}

## Analysis Period
{First Date} to {Latest Date} ({N} sources)

## Top Trends
[Key evolving trends and trajectory]

## Emerging Winners
[Models, tools, approaches gaining momentum]

## Predictions
[Future predictions based on trend data]

## Key Insights
[3-5 most important actionable insights]
```

Execute this workflow now.