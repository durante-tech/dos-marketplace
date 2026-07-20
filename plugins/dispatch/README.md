---
name: Dispatch
pack-id: durante-dispatch-v1.0.0
version: 1.0.0
author: durante-tech
description: Blog post, weekly dispatch, and newsletter authoring with mandatory metered research as Step 1 — every post starts with a research skill invocation so claims are citation-backed and credit-metered, not hallucinated from training data
type: skill
purpose-type: [content, blogging, dispatch, newsletter, authoring]
platform: claude-code
dependencies: [Research, Media]
keywords: [blog, dispatch, weekly-dispatch, newsletter, content, authoring, citation, research, metered]
---

# Dispatch

> Authoring with mandatory metered research — every claim citation-backed, every post a credit-metered audit trail.

---

## The Problem

Authoring blog posts, dispatches, and newsletters from a long-running Claude session has a structural failure mode:

- **Claims drift past the cutoff.** Posts cover events past the model's knowledge cutoff, but research is skipped, and the prose recalls (or fabricates) details from training data.
- **URLs hallucinate.** Without a research vault to anchor citations, links get invented. A single broken link is a catastrophic failure for editorial trust.
- **Studio metering shows zero.** When Research, Brave, Perplexity, Firecrawl, BrightData, and Apify never get called, operators have no telemetry that research happened. The session looks free; the content is unaudited.
- **No reusable vault.** Each post starts from scratch instead of building on a `MEMORY/RESEARCH/` corpus that follow-up posts in the same series could draw on.

The fundamental issue: authoring sessions tend to grab `Edit` and `Write` directly, bypassing the metered research pipeline that exists for exactly this purpose.

---

## The Solution

The dispatch pack is an authoring skill that **gates every post behind a mandatory research skill invocation as Step 1**. The agent cannot draft prose until research has produced a vault file with verified citations.

**What's included:**

1. **WeeklyDispatch** — Sunday-style retrospective covering 5-day windows
2. **BlogPost** — Standalone post, not part of a weekly cadence
3. **Newsletter** — Curated list of 5-15 items with brief annotations

**Key design:**
- **Research-first** — Step 1 of every workflow is `Skill("research", "...")`, no exceptions
- **Citation-anchored** — every external claim cites a URL from the research vault, never an invented one
- **Metered by default** — routes through Studio gateway metering across Perplexity, Brave, Firecrawl, BrightData, Claude WebSearch, Gemini
- **Hero images via Media** — `Skill("media", ...)` for headers so image generation is also metered
- **Vault-reusable** — research lands at `MEMORY/RESEARCH/{YYYY-MM}/{slug}.md`, available to follow-up posts and synced to Studio

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill Definition | `src/SKILL.md` | Routing, triggers, hard rules |
| WeeklyDispatch | `src/Workflows/WeeklyDispatch.md` | Sunday-style retrospective workflow |
| BlogPost | `src/Workflows/BlogPost.md` | Standalone blog post workflow |
| Newsletter | `src/Workflows/Newsletter.md` | Curated newsletter workflow |
| Extension manifest | `src/extension.yaml` | RFC-0002 extension registration |

**Summary:**
- **Workflows:** 3
- **TypeScript tools:** 0 (markdown-only authoring skill)
- **Python files:** 0
- **Dependencies:** research pack, media pack

---

## What Makes This Different

This is not a "writing assistant." It is a structural enforcement mechanism for the citation-backed authoring discipline. Every workflow refuses to draft prose before metered research has produced a vault.

- **Mandatory Step 1 = research skill** — the workflow halts if you skip it
- **No invented URLs** — every link must trace to a vault citation
- **media skill for hero images** — image generation is metered, not bypassed
- **Reusable vault** — `MEMORY/RESEARCH/` builds up across posts in the same series

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "Write this week's dispatch on X" | WeeklyDispatch: Step 1 invokes Standard Research → vault → outline → draft → URL verify → publish |
| "Draft a blog post about X" | BlogPost: Step 1 invokes Standard Research → vault → outline → draft → URL verify → publish |
| "Create this week's newsletter" | Newsletter: Step 1 invokes Extensive Research (12 agents) → curate 5-15 items → annotate → URL verify → publish |
| "Write about X" with no clear cadence | Routes to BlogPost by default |

---

## Configuration

The dispatch pack requires the Research and Media packs to be installed and the Studio gateway configured for metering.

| Setting | Required | Default | Description |
|---------|----------|---------|-------------|
| research pack | Yes | Installed by default | Step 1 of every workflow |
| media pack | Yes | Installed by default | Hero image generation |
| `STUDIO_API_URL` + `STUDIO_API_KEY` | Yes | From `~/.claude/.env` | Gateway metering for Research and Media |
| `apps/web/content/posts/` | Yes | Studio public-blog path | Final output destination |
| Project-level `MEMORY/RESEARCH/` | Recommended | Auto-created on first use | Research vault root |

---

## Customization

### Recommended Customization

- Match your dispatch cadence (weekly / bi-weekly / monthly) by editing the `label` and `order` fields in workflow frontmatter examples
- Customize the `image` path convention in workflow Step 5 to match your Studio site image directory
- Adjust the URL verification protocol per your editorial trust level (`Research/UrlVerificationProtocol.md`)

### Optional Customization

| Customization | File | Description |
|---------------|------|-------------|
| Voice / tone | `src/SKILL.partials.md` | Adjust the editorial voice of the workflow body |
| Research mode default | `src/Workflows/{WeeklyDispatch,BlogPost,Newsletter}.md` | Change Standard → Quick / Extensive depending on post type |
| Frontmatter shape | `src/Workflows/*.md` Step 5 | Match your Studio's `.mdoc` schema if it differs |
| Hard rules | `src/SKILL.partials.md` "Hard Rules" section | Tighten or loosen the citation-required rule |

---

## Credits

- **Architecture:** Investigation finding that ~30 dispatch posts were authored with zero metered research calls (PRD `MEMORY/WORK/20260501-203457_investigate-missing-studio-token-telemetry/`)
- **Pipeline design:** Lucas Gertel / DuranteOS

---

## Related Work

- [research pack](../Research/README.md) — the metered research engine that Dispatch's Step 1 invokes
- [media pack](../Media/README.md) — hero image generation
- [bdr pack](../Bdr/README.md) — sibling internal pack with the same 4-file distribution contract

---

## Works Well With

- **Research** — mandatory Step 1 dependency
- **Media** — hero image generation for every post
- **SocialMedia** — distribute the published post to LinkedIn / Facebook / Instagram after publishing
- **MemPalace** — research vault content lands in the knowledge graph

---

## Changelog

### 1.0.0 - 2026-05-01
- Initial release
- 3 workflows: WeeklyDispatch, BlogPost, Newsletter
- Mandatory Research-first invocation in every workflow
- Hard rules: no fabricated URLs, every external claim traceable to research vault, hero images via `Skill("media", ...)`
- Internal pack registration (gitignore exception for `extension.yaml`)
