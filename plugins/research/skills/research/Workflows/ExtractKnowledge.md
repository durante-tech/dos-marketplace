---
name: Extract Knowledge
description: Domain-classified knowledge extraction from URLs or content — security/business/research/wisdom briefs with Scrape fallback
status: STABLE
bestPath:
  - title: "Acquire Content"
    description: "fabric -u first; Scrape router fallback for anti-bot pages."
  - title: "Classify Domain"
    description: "Route to the security/business/research/wisdom/general brief."
  - title: "Extract Knowledge"
    description: "Direct inference per the domain brief (rubrics stated)."
  - title: "Structured Output"
    description: "Emit the knowledge summary with sources and ratings."
---

# extract-knowledge

## When to Use

- User says "extract knowledge" from a URL/document
- Domain-shaped briefs wanted (security/business/research/wisdom)
- NOT for alpha-insight distillation (ExtractAlpha) or plain retrieval (Retrieve)


This command intelligently extracts knowledge and signal points from any input source (URLs, YouTube videos, PDFs, presentations, research papers, etc.). It automatically detects content type, fetches content using appropriate methods, analyzes the domain focus, and generates structured insights with actionable recommendations.

## Usage

```
/extract-knowledge <source> [--focus=<domain>]
```

**Examples:**
- `/extract-knowledge https://example.com/article` - Extract from web article
- `/extract-knowledge https://youtube.com/watch?v=abc123` - Extract from YouTube video
- `/extract-knowledge /path/to/document.pdf` - Extract from PDF
- `/extract-knowledge https://presentation.com/slides --focus=security` - Extract security insights
- `/extract-knowledge "direct text content"` - Analyze text directly

**Focus domains:** security, business, research, wisdom, general (auto-detected if not specified)

## Implementation

When this command is invoked:

### Step 1: Detect Source Type and Fetch Content

**YouTube Videos** (youtube.com, youtu.be):
```bash
fabric --youtube "<url>"
```

**Web URLs** (http/https):
```typescript
// Try fabric first
// $ fabric -u "<url>"
// If that fails or the page is anti-bot protected, call the Scrape router:
import { Scrape } from "@durante/scraping"
const { markdown, metadata, adapter } = await Scrape.fetch(url, { mode: "deep" })
// Router escalates WebFetch → BrightData → Firecrawl per RFC-0015 §7.1
```

**PDFs and Files**:
```
Read the file directly using the Read tool
```

**Research Papers** (arxiv, doi):
Treat as web content but mark as research domain

### Step 2: Analyze Content Domain

If `--focus` is not specified, auto-detect from content. The keyword classifier
is deterministic (first-match-wins on a fixed precedence order) and has one
tested owner — call it instead of re-applying the keyword list by hand:

```bash
bun ~/.claude/skills/research/Tools/ResearchCli.ts detect-domain "<content excerpt>"
# -> Security | Business | research | Wisdom | General
```

The keyword sets it matches (for reference — do not re-implement):
- **Security**: vulnerability, hack, exploit, cybersecurity, attack, defense
- **Business**: money, revenue, profit, market, strategy, business
- **Research**: study, experiment, methodology, findings, academic
- **Wisdom**: philosophy, principle, life, wisdom, insight, experience
- **General**: everything else

### Step 3: Extract Knowledge Using DOS Services

Extraction is direct inference over the retrieved content — no MCP extraction
server exists (the former `mcp__pai__*` tool references were unmigrated PAI
inheritance, removed 2026-07-10; Fabric patterns via `Workflows/Fabric.md`
remain available when a named pattern fits better than the briefs below).

**For Security Content:** extract the primary problem and primary solution;
attack vectors, vulnerabilities, defensive measures; technical security
recommendations.

**For Business Content:** extract the primary problem and primary solution;
revenue opportunities, market insights, growth strategies; business action items.

**For Research Content:** extract key findings, methodology insights, technical
details; rate research quality and reproducibility (state your rubric).

**For Wisdom Content:** extract life principles, philosophical insights,
practical wisdom; distill memorable quotes and aphorisms (Aphorisms pack can
store them).

**For General Content:** produce an expanded summary; extract key concepts,
important facts, learning opportunities; rate usefulness (state your rubric).

### Step 4: Structure Output

Generate structured knowledge extraction. The output skeleton (emoji headings,
rule lines, section order, and the two optional domain blocks) is rendered by
the golden-tested owner — do not hand-type it; fill each `<...>` slot with the
extracted analysis:

```bash
bun ~/.claude/skills/research/Tools/ResearchRender.ts knowledge-result
```

This emits, byte-identical:

```
🎯 KNOWLEDGE EXTRACTION RESULTS
══════════════════════════════════════════════════
📍 Source: <source>
🔍 Type: <detected_type>
🎯 Domain: <detected_domain>
⭐ Quality Rating: <1-10>/10
🎯 Confidence: <1-10>/10

📋 CONTENT SUMMARY:
<2-3 sentence summary>

💡 KEY INSIGHTS:
• <insight 1>
• <insight 2>
• <insight 3>

📡 SIGNAL POINTS:
• <signal point 1>
• <signal point 2>
• <signal point 3>

⚡ ACTIONABLE RECOMMENDATIONS:
✅ <recommendation 1>
✅ <recommendation 2>
✅ <recommendation 3>

🔗 RELATED CONCEPTS:
<comma-separated list of key terms>

[Optional sections based on domain:]
🧠 EXTRACTED WISDOM: (for wisdom content)
"<key quotes and insights>"

🛠️ TECHNICAL DETAILS: (for security/research content)
• <technical detail 1>
• <technical detail 2>

══════════════════════════════════════════════════
```

## Domain-Specific Signal Points

**Security Domain:**
- New attack vectors identified
- Defensive strategies recommended
- Vulnerability assessment techniques
- Security tools and frameworks mentioned

**Business Domain:**
- Revenue opportunities identified
- Market insights discovered
- Business strategies outlined
- Growth tactics documented

**Research Domain:**
- Research findings summarized
- Methodology insights extracted
- Key contributions identified
- Future work directions noted

**Wisdom Domain:**
- Life principles identified
- Philosophical insights extracted
- Practical wisdom discovered
- Universal truths highlighted

## Save Research Report (MANDATORY)

**Persist findings to disk so the research counter tracks it.**

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write report to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_knowledge-{topic-slug}.md`

The report skeleton (frontmatter + section headings + empty-state slots) is
rendered by the golden-tested owner — do not hand-type it; fill the slots with
the extracted analysis:

```bash
bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report \
  "$(jq -nc --arg date "$(date +%F)" --arg title "{source_title}" \
     --arg domain "{detected_domain}" --arg rating "{rating}" \
     '{mode:"extract-knowledge",date:$date,source_title:$title,detected_domain:$domain,rating:$rating}')"
```

This emits, byte-identical:

```markdown
---
mode: extract-knowledge
date: {YYYY-MM-DD}
topic: {source_title}
domain: {detected_domain}
quality: {rating}/10
---

# Knowledge Extraction — {Source Title}

## Summary
{2-3 sentence summary}

## Key Insights
{Top insights extracted}

## Signal Points
{Key signal points}

## Actionable Recommendations
{Top recommendations}
```

## Quality Rating Criteria

- **9-10**: Comprehensive, actionable, high-value insights
- **7-8**: Good insights with clear recommendations
- **5-6**: Moderate value, some useful information
- **3-4**: Limited insights, basic information
- **1-2**: Poor quality or insufficient content

## Intent-to-Flag Mapping

This workflow shells the DOS Research plumbing CLIs (`ResearchCli.ts`, `ResearchRender.ts`) plus `fabric`, but none of them expose operator-variable, intent-mapped flags — so there is **no intent→flag table**. The invocation of every CLI below is fully determined by the workflow step, not by what the operator is trying to accomplish (contrast `StandardResearch.md`, whose provider CLIs like `Perplexity.ts` expose `--model` / `--recency` / `--reasoning` that genuinely map to user intent).

- `bun ResearchCli.ts detect-domain "<excerpt>"` — fixed subcommand; the content excerpt is a positional argument, no flags (deterministic first-match-wins keyword classifier).
- `bun ResearchCli.ts resolve-dir` — fixed subcommand, no flags (resolves the project-level RESEARCH dir, mirrors `getMemorySubdir`).
- `bun ResearchRender.ts knowledge-result` — fixed subcommand, no flags (emits the byte-identical output skeleton).
- `bun ResearchRender.ts render-report "<json>"` — fixed subcommand; the JSON payload is interpolated data, not flag selection.
- `fabric --youtube "<url>"` vs `fabric -u "<url>"` — the `--youtube`/`-u` choice is selected deterministically by Step 1 source-type detection (YouTube vs web URL), not by user intent, so it is not an intent-mapped flag.

The `--focus=<domain>` token in the Usage section is a slash-command argument, not a CLI flag — it overrides the deterministic `detect-domain` classifier and is never passed as a flag to any shelled CLI.