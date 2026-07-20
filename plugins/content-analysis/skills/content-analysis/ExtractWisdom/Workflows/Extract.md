---
name: Extract
description: 
status: STABLE
---

# Extract Workflow

Extract dynamic, content-adaptive wisdom from any content source.

## Input Sources

| Source | Method |
|--------|--------|
| YouTube URL | `fabric -y "URL"` for the transcript — with a fallback when `fabric` is absent (see Step 1) |
| Article URL | `WebFetch` to get content (optionally enriched via the scraping skill — below) |
| File path | Read the file directly |
| Pasted text | Use directly |

**Optional enrichment via the scraping skill (not a path-import).** For cleaner article content, invoke the **Scraping** skill via its RFC-0015 §7.1 intent surface — `Skill("scraping", "fetch clean markdown with metadata for <url>")` — which returns clean markdown and escalates `WebFetch → Firecrawl → Bright Data` on anti-bot pages automatically. This is **OPTIONAL**: if the scraping skill is not installed, fall back to plain `WebFetch` (above) and proceed. Do **not** `import { Scrape } from "Packs/scraping/src"` — that monorepo path does not resolve in an installed `~/.claude/skills/` tree, and Scraping is delivered as a Skill, not a TS export. (One shared Scrape-consumer contract with Bdr.)

## Execution Steps

### Step 1: Get the Content

Obtain the full text/transcript. For YouTube, use `fabric -y "URL"` to extract the transcript.

**Fabric fallback (when `fabric` is not installed).** `fabric` (danielmiessler/fabric) is an external CLI and may be absent on a fresh install. If `fabric` is missing or errors, degrade gracefully rather than breaking the YouTube path: (1) `WebFetch` the YouTube watch page and pull the transcript/description and title; or (2) use an available transcript API/MCP if one is present; or (3) as a last resort, tell the operator the YouTube path needs `fabric` installed (or a pasted transcript) — a clear, actionable message, never a silent failure. The non-YouTube sources (article → WebFetch/Scraping, file → Read, pasted text) do not depend on `fabric`.

Save to a working file if large.

### Step 2: Deep Read

Read the entire content. Don't extract yet. Notice:
- What domains of wisdom are present?
- What made you stop and think?
- What's genuinely novel vs. commonly known?
- What would {PRINCIPAL.NAME} highlight if he were reading this?
- What quotes land perfectly?

### Step 3: Select Dynamic Sections

Based on your deep read, pick 5-12 section names. Rules:
- Section names must be conversational, not academic
- Each must have at least 3 quality bullets
- Always include "Quotes That Hit Different" if source has quotable moments
- Always include "First-Time Revelations" if genuinely new ideas exist
<!-- brand-voice:exempt — quoted as meta-example of conversational section naming, not product voice -->
- Be SPECIFIC — "Agentic Engineering Philosophy" not "Technology Insights"

### Step 4: Extract Per Section

For each section, extract 3-15 bullets. Apply the tone rules from this skill's `SKILL.md` (the sibling `ExtractWisdom/SKILL.md`, NOT the top `ContentAnalysis/SKILL.md` router):
- 8-20 words, flexible for clarity
- Specific details, not vague summaries
- Speaker's words when they're good
- No hedging language
- Every bullet worth telling someone about

### Step 5: Add Closing Sections

Always append:
1. **One-Sentence Takeaway** (15-20 words)
2. **If You Only Have 2 Minutes** (5-7 essential points)
3. **References & Rabbit Holes** (people, projects, books, tools mentioned)

### Step 6: Quality Check

Run the quality checklist from this skill's `SKILL.md` (the sibling `ExtractWisdom/SKILL.md`) before delivering.

### Step 7: Output

Present the complete extraction in the format specified in this skill's `SKILL.md` (the sibling `ExtractWisdom/SKILL.md`).

**Carry the source through (provenance for the Dispatch handoff).** Populate the output's `source_url` with the original source: the YouTube/article URL, the file path for a local file, or `pasted — no URL` for pasted text. ContentAnalysis feeds Dispatch, which enforces a cite-real-URLs / never-invent-a-URL discipline — so the source must survive the handoff or a downstream post cannot attribute it. This complements (does not duplicate) the existing "References & Rabbit Holes" and "Quotes That Hit Different" provenance.