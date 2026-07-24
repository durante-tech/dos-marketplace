---
name: Dispatch
description: Blog post, weekly dispatch, and newsletter authoring with mandatory metered research as Step 1. Every post starts with a research skill invocation so claims are citation-backed and credit-metered, not hallucinated from training data. USE WHEN write blog post, dispatch, weekly dispatch, newsletter, draft post, publish post, write article, blog, blog draft, dispatch post, weekly post, content writing.
role: extractor
accepts:
  - text
icon: PenLine
colorVar: tertiary
colorHex: "#ffb95a"
tier: primary
category: Content
displayLabel: Dispatch
marketingDescription: Authoring with mandatory metered research — every claim citation-backed.
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
elevator: Mandatory-research-first authoring for blogs, dispatches, and newsletters
highlightWorkflows:
  - name: Weekly Dispatch
    technicalName: WeeklyDispatch
  - name: Blog Post
    technicalName: BlogPost
  - name: Newsletter
    technicalName: Newsletter
roots:
  - PROJECT.RESEARCH
  - PROJECT.ARTIFACTS
visibility: public
feature_capabilities:
  - Mandatory research skill invocation as Step 1
  - Citation-backed claims with verified URLs
  - Hero image generation via media skill
  - Studio-metered providers throughout (Perplexity, Brave, Firecrawl, BrightData, Apify)
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Dispatch/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Dispatch — Citation-Backed Authoring

Authoring skill for blog posts, weekly dispatches, and newsletters. **Step 1 of every workflow is a mandatory metered Research-skill invocation** so claims rest on cited primary sources, not on training-data recall.

## Why this skill exists

Authoring sessions that bypass metered research produce dispatch posts where:
1. Claims about events past the Claude knowledge cutoff are at risk of confabulation
2. Cited URLs may be hallucinated (a single broken link is a CATASTROPHIC FAILURE — see Research/UrlVerificationProtocol.md)
3. Studio metering shows zero credits — the operator cannot tell research happened
4. There is no `MEMORY/RESEARCH/` vault to reuse for follow-up posts in the same series

This skill enforces metered research as the FIRST step. The agent cannot draft prose until research has produced a vault file at `MEMORY/RESEARCH/{YYYY-MM}/{slug}.md` with cited sources.

## ⚠️ MANDATORY TRIGGER

**When user asks to "write a blog post", "write a dispatch", "draft a newsletter", or any equivalent — INVOKE this skill, not bare Edit/Write on the .mdoc file.**

| User Says | Action |
|-----------|--------|
| "weekly dispatch" / "this week's dispatch" / "weekend dispatch" | → `Workflows/WeeklyDispatch.md` |
| "write a blog post" / "draft a blog" / "blog post about X" | → `Workflows/BlogPost.md` |
| "newsletter" / "this week's newsletter" / "send out a newsletter" | → `Workflows/Newsletter.md` |

**The MANDATORY first step in all three workflows is `Skill("research", "...")`. No exceptions for "I already know this topic" — even known topics get freshness-checked against the live web because (a) the cutoff lags real events and (b) Studio metering is the visible telemetry that research happened.**

## Workflow Routing

Route to the appropriate workflow based on the request type. All three share Step 1 (mandatory Research) and differ in voice/structure/length downstream.

| Request Pattern | Route To |
|---|---|
| "weekly dispatch", "this week's dispatch", "weekend dispatch" | `Workflows/WeeklyDispatch.md` |
| "write a blog post", "draft a blog", "blog post on X" | `Workflows/BlogPost.md` |
| "newsletter", "this week's newsletter", "send a newsletter" | `Workflows/Newsletter.md` |
| Any other "write about X" with no clear cadence signal | Default to `Workflows/BlogPost.md` |

## Examples

**Example 1: Weekly Dispatch**
```
User: "Write this week's dispatch — Anthropic shipped Mythos under Project Glasswing"
→ Workflows/WeeklyDispatch.md
→ Step 1: Skill("research", "Anthropic Mythos Project Glasswing release this week — sources, partners, capabilities, reactions") — produces MEMORY/RESEARCH/{YYYY-MM}/anthropic-mythos-glasswing.md with verified citations
→ Step 2-N: Author the dispatch using only sources in the research vault, with verified URLs only
→ Step 5: Skill("media", "header image for Project Glasswing dispatch") — metered hero generation
```

**Example 2: Blog Post**
```
User: "Blog post on the credit-metered gateway pattern we shipped"
→ Workflows/BlogPost.md
→ Step 1: Skill("research", "credit-metered gateway pattern in AI SaaS — comparable approaches, prior art, current discourse")
→ Step 2-N: Author with research vault as substrate, every external claim cites a vault URL
```

**Example 3: Newsletter**
```
User: "This week's newsletter — top 5 AI news for indie founders"
→ Workflows/Newsletter.md
→ Step 1: Skill("research", "top AI news this week relevant to indie founders") with extensive mode (12 agents)
→ Curate down to 5-15 items, annotate, verify every URL, publish
```

## Hard Rules

- **No prose written before Step 1 completes.** If the agent skips Research, the workflow has failed. Re-invoke Research before continuing.
- **Every URL in the post MUST appear in the research vault.** No fabricated URLs. Use the research skill's `UrlVerificationProtocol.md` if any source is uncertain.
- **Every external claim MUST be traceable to a research-vault citation.** Internal claims about your own work/codebase are exempt.
- **Hero image generation goes through `Skill("media", "...")`** — NEVER through inline `bun` commands or non-metered routes. Media metering is how operators see image-generation activity.

> **Studio-meter advisory.** Every workflow charges Studio credits: Research metering at Step 1 (Perplexity / Brave / Firecrawl / BrightData) and Media metering at Step 5 (`/api/v1/media/*`). A run that reports zero credits charged is a signal the metered path was bypassed — treat it as a failed run, not a free one.

## Integration

### Feeds Into
- `Skill("social-media", "...")` — distribute the published post to LinkedIn / Facebook / Instagram
- Studio public blog at `apps/web/content/posts/*.mdoc` — final output destination

### Uses
- `Skill("research", "...")` — mandatory Step 1 in every workflow (Perplexity / Brave / Firecrawl / BrightData / Claude / Gemini)
- `Skill("media", "header image for...")` — hero image generation
- `Skill("content-analysis", "extract wisdom from...")` — when the dispatch is a content-derived essay

### Declared Dependencies (contract)

Dispatch declares one **hard** dependency and three **soft** ones. Hard deps MUST be invoked for a workflow run to be valid; soft deps are invoked conditionally.

| Skill | Kind | Invariant |
|---|---|---|
| `research` | hard | Step 1 of every workflow — the research-vault gate (`Tools/VerifyResearchVault.ts`) mechanically enforces it (non-zero exit BLOCKS the draft) |
| `media` | soft | Hero-image generation (Step 5); metered via `/api/v1/media/*` |
| `content-analysis` | soft | Only when the dispatch is a content-derived essay |
| `social-media` | soft | Downstream — distribute the published post |

## File Organization

**Working drafts:** `MEMORY/WORK/{YYYYMMDD-HHMMSS}_dispatch-{slug}/`
- Drafts, outline iterations, source-pull notes
- Edit log + revision history

**Research vault (Step 1 output):** `MEMORY/RESEARCH/{YYYY-MM}/{YYYY-MM-DD}_{slug}.md`
- Citation-backed source corpus
- Synced to Studio at SessionEnd via SaveResearchVaultsToStudio

**Final output:** `apps/web/content/posts/{slug}.mdoc` (Studio public blog)
- Frontmatter: title, label, description, categories, tags, image, publishedAt, status, order
- Body: prose with inline `[link](url)` citations, callouts, headings

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Dispatch","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/dispatch/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/dispatch/` — active release submodule (versioned)
3. `Packs/*/src/Dispatch/` — pack source (distributable)
4. `Packs/agents/Dispatch/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.

