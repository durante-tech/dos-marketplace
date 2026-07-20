---
name: Research
description: Comprehensive research and content extraction — quick/standard/extensive/deep modes with multi-agent parallel research, content retrieval, AI trends analysis, library/SDK docs lookup via Ref, and 242+ Fabric patterns. USE WHEN research, do research, quick research, extensive research, deep investigation, find information, investigate, extract alpha, analyze content, retrieve content, use fabric, AI trends, Claude research, extract knowledge, interview research, web scraping, YouTube extraction, standard research, docs lookup, library docs, framework docs, SDK docs, API docs, lookup documentation. NOT for a single library/SDK/API doc lookup (use Ref) or a deep multi-source cited-report harness (use deep-research).
role: extractor
accepts:
  - text
icon: Search
colorVar: tertiary
colorHex: "#ffb95a"
tier: primary
category: Research
displayLabel: Research
marketingDescription: Multi-agent parallel research with 12 agents, YouTube extraction, and 242 Fabric patterns.
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
elevator: 12 parallel agents, 4 depth modes, 242+ Fabric patterns
highlightWorkflows:
  - name: Quick Research
    technicalName: QuickResearch
  - name: Deep Research
    technicalName: ExtensiveResearch
  - name: Investigation Vault
    technicalName: DeepInvestigation
roots:
  - PROJECT.RESEARCH
  - PROJECT.ARTIFACTS
visibility: public
feature_capabilities:
  - Parallel agents drawn from the provider pool in Router.DEFAULT_RESEARCH_POOL (SoT) — claude, perplexity, gemini, brave, grok, codex; codex is agent-only (no direct-CLI adapter yet)
  - 242+ Fabric analysis patterns
  - Quick/standard/extensive/deep depth modes
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## ⚠️ MANDATORY TRIGGER

**When user says "research" (in any form), ALWAYS invoke this skill.**

| User Says | Action |
|-----------|--------|
| "research" / "do research" / "research this" + A TOPIC | → Standard mode (4 agents) |
| bare "research" / no topic given | → ASK for the topic first — NEVER fan out metered agents on an unspecified subject |
| "quick research" / "minor research" | → Quick mode (1 agent) |
| "extensive research" / "deep research" | → Extensive mode (12 agents) |
| "deep investigation" / "investigate [topic]" / "map the [X] landscape" | → Deep Investigation (iterative) |

**"Research" alone = Standard mode. No exceptions.**

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Research/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Research Skill

Comprehensive research, analysis, and content extraction system.

## MANDATORY: URL Verification

**READ:** `UrlVerificationProtocol.md` - Every URL must be verified before delivery.

Research agents hallucinate URLs. A single broken link is a catastrophic failure.

---

## Workflow Routing

Route to the appropriate workflow based on the request.

**CRITICAL:** For due diligence, company/person background checks, or vetting -> **INVOKE THE Investigation SKILL INSTEAD**

### Ref vs Research (stop at first match — R12, 2026-07-08)

1. **One library/SDK/API documentation lookup** → **Ref**. STOP.
2. Anything needing **multiple sources, synthesis, or verification** → **Research** (this skill).

Category match, not style preference: "the docs might be incomplete" is not a category mismatch — a single-library question starts at Ref; escalate to Research only when Ref actually comes back insufficient.

### Research Modes (Primary Workflows)
- Quick/minor research (1 Perplexity, 1 query) -> `Workflows/QuickResearch.md`
- Standard research - DEFAULT (4 agents: Claude + Perplexity + Gemini + Brave — the count=4 diversity=high selection from Router.DEFAULT_RESEARCH_POOL) -> `Workflows/StandardResearch.md`
- Extensive research (4 types x 3 threads = 12 agents) -> `Workflows/ExtensiveResearch.md`
- Deep investigation / iterative research (progressive deepening, loop-compatible) -> `Workflows/DeepInvestigation.md`

### Documentation Lookup (named library / framework / SDK / API)
- **PREFER** `Workflows/DocsLookup.md` over general web research whenever the request names a specific library, framework, SDK, CLI, or cloud service AND wants current authoritative docs. Routes to the ref skill (credit-metered via Studio gateway, 1 credit flat per call).
- Trigger phrases: "look up X docs", "find the X API for Y", "Prisma docs for Z", "Next.js docs for Z", "Stripe SDK …", "what does the X documentation say about Y".

### Deep Content Analysis
- Extract alpha / deep analysis / highest-alpha insights -> `Workflows/ExtractAlpha.md`

### Content Retrieval
- Difficulty accessing content (CAPTCHA, bot detection, blocking) -> `Workflows/Retrieve.md`
- YouTube URL extraction (use `fabric -y URL` immediately) -> `Workflows/YoutubeExtraction.md`
- Web scraping -> `Workflows/WebScraping.md`

### Specific Research Types
- Claude WebSearch only (free, no API keys) -> `Workflows/ClaudeResearch.md`
- Perplexity API research (use Quick for single-agent) -> `Workflows/QuickResearch.md`
- Interview preparation (Tyler Cowen style) -> `Workflows/InterviewResearch.md`
- AI trends analysis -> `Workflows/AnalyzeAiTrends.md`

### Fabric Pattern Processing
- Use Fabric patterns (242+ specialized prompts) -> `Workflows/Fabric.md`

### Content Enhancement
- Extract knowledge from content -> `Workflows/ExtractKnowledge.md`

---

## Examples

**Example 1: Quick Perplexity scan for a single fact**
```
User: "Quick research the latest Anthropic safety paper"
→ Invokes QuickResearch workflow (1 Perplexity agent, 1 query)
→ Returns a tight 5-10 line digest with verified URLs in ~10-15 seconds
→ User gets the headline finding plus links, no agent fan-out
```

**Example 2: Standard 4-agent research (default mode)**
```
User: "Research the AI agent market for me"
→ Invokes StandardResearch workflow (Claude WebSearch + Perplexity + Gemini + Brave in parallel)
→ Cross-validates findings across 4 independent agents, verifies every URL before delivery
→ User gets a synthesized report with consensus signal and disagreement flags
```

**Example 3: Iterative deep investigation with persistent vault**
```
User: "Do a deep investigation of the AI agent market and map the landscape"
→ Invokes DeepInvestigation workflow with MarketResearch template
→ Builds entity graph (companies, products, people, technologies), scores priority, deep-dives top entities one per iteration
→ User gets a vault at MEMORY/RESEARCH/{date}_{topic}/ that survives across sessions and grows with each loop
```

---

## Quick Reference

**READ:** `QuickReference.md` for detailed examples and mode comparison.

| Trigger | Mode | Speed |
|---------|------|-------|
| "look up X docs" / library named | Docs Lookup (ref skill) | ~5-15s |
| "quick research" | 1 Perplexity agent | ~10-15s |
| "do research" + topic | 4 agents (default) | ~15-30s |
| "extensive research" | 12 agents | ~60-90s |
| "deep investigation" | Progressive iteration | ~3-60min |

---

## Integration

### Feeds Into
- **Dispatch** - Research feeding blog posts / newsletters (Dispatch invokes Research as its mandatory Step 1)

### Uses
- **Ref** - MANDATORY routing for library/framework/SDK/API docs lookup (`Workflows/DocsLookup.md` → `Ref/Tools/Search.ts` + `Ref/Tools/Read.ts`)
- **Thinking** - BeCreative / deep-thinking workflows for extract alpha
- **Investigation** - MANDATORY for company/people comprehensive research
- **BrightData code-first client** - CAPTCHA solving, advanced scraping
- **Apify code-first client** - RAG browser, specialized site scrapers

---

## Deep Investigation Mode

**Progressive iterative research** that builds a persistent knowledge vault. Works in both single-run (one cycle) and loop mode (Algorithm-driven iterations).

**Concept:** Broad landscape → discover entities → score importance/effort → deep-dive one at a time → loop until coverage complete.

**Domain template packs** customize the investigation for specific domains:
- `Templates/MarketResearch.md` — Companies, Products, People, Technologies, Trends, Investors
- `Templates/ThreatLandscape.md` — Threat Actors, Campaigns, TTPs, Vulnerabilities, Tools, Defenders
- No template? The workflow creates entity categories dynamically from the landscape research.

**Example invocation:**
```
"Do a deep investigation of the AI agent market"
→ Loads MarketResearch.md template
→ Iteration 1: Broad landscape + first entity deep-dive
→ Loop mode: Each iteration deep-dives the next highest-priority entity
→ Exit: When all CRITICAL/HIGH entities researched + all categories covered
```

**Artifacts persist** at `MEMORY/RESEARCH/{date}_{topic}/` (project-level if available, global fallback) — the vault survives across sessions.

See `Workflows/DeepInvestigation.md` for full workflow details.

---

## File Organization

**Working files (temporary work artifacts):** `MEMORY/WORK/{current_work}/`
- Read `MEMORY/STATE/current-work.json` to get the `work_dir` value (falls back to `~/.claude/MEMORY/STATE/current-work.json`)
- All iterative work artifacts go in the current work item directory
- This ties research artifacts to the work item for learning and context

**Research vault (permanent):** `MEMORY/RESEARCH/{YYYY-MM}/{YYYY-MM-DD}_{topic-slug}/` (project-level, global fallback)

**Four-copy note:** this skill exists in multiple copies — after editing any file here, verify parity with `bun ~/Durante/Tools/sync-check.ts` (full rule: Durante/CLAUDE.md "The Four Copies"). Artifact writes are auto-logged by ArtifactAutoLogger.hook.ts.
