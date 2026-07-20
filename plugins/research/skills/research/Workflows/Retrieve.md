---
name: Retrieve
description: Content retrieval through the Scrape router — WebFetch to BrightData/Firecrawl escalation — with vault persistence
status: STABLE
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Research Retrieve workflow has bespoke Output section with workflow-specific shape"
bestPath:
  - title: "Route Retrieval"
    description: "Scrape.fetch picks the cheapest adapter that serves the page."
  - title: "Escalate If Blocked"
    description: "Anti-bot pages escalate through the proxy tiers automatically."
  - title: "Extract & Verify"
    description: "Pull the target content; verify completeness against the request."
  - title: "Vault Persistence"
    description: "Save final content + adapter metadata to MEMORY/RESEARCH."
---

# Retrieve Workflow

Difficult content retrieval via the Scrape intent API (RFC-0015). A single call — `Scrape.fetch(url, { mode })` — hands the URL to the scraping pack's router, which owns adapter selection, anti-bot escalation, and cleanup. USE ONLY WHEN user indicates difficulty: 'can't get this', 'having trouble', 'site is blocking', 'protected site', 'keeps giving CAPTCHA', 'won't let me scrape'. DO NOT use for simple 'read this page' or 'get content from' without indication of difficulty.

## Load Full DOS Context

**Before starting any task with this skill, load complete DOS context:**

`read ~/.claude/DOS/SKILL.md`

This provides access to:
- Complete contact list (Angela, Bunny, Saša, Greg, team members)
- Stack preferences (TypeScript>Python, bun>npm, uv>pip)
- Security rules and repository safety protocols
- Response format requirements (structured emoji format)
- Voice IDs for agent routing (ElevenLabs)
- Personal preferences and operating instructions

## When to Use This Skill

**IMPORTANT:** This skill is for CHALLENGING content retrieval only, not routine fetching.

**DO USE this skill when user indicates difficulty:**
- "I can't get this content"
- "Having trouble retrieving this"
- "Site is blocking me"
- "Protected site" / "CloudFlare protected"
- "Keeps giving me CAPTCHA"
- "Won't let me scrape this"
- "Bot detection blocking me"
- "Rate limited when trying to get this"
- "Tried to fetch but failed"
- "Need advanced scraping for this"

**DO NOT use this skill for simple requests:**
- "Read this page" → Use WebFetch directly
- "Get content from [URL]" → Use WebFetch directly
- "What does this site say" → Use WebFetch directly
- "Fetch this article" → Use WebFetch directly
- "Check this URL" → Use WebFetch directly

**Simple rule:** Only activate when user signals DIFFICULTY, not for routine content requests.

**NOT for research questions** — use the research skill instead for "research X" or "find information about X".

## Retrieval Strategy — Single Call, Router Escalation

The workflow collapses to one decision: **which mode to pass to `Scrape.fetch`**. The router inside the scraping pack owns the old Layer 1/2/3 ladder (RFC-0015 §7.1):

```
Scrape.fetch(url, { mode })
  │
  ├─ DOMAIN HEURISTIC (runs first)
  │    Known anti-bot domain (LinkedIn, X, Instagram, Cloudflare-protected list)?
  │    → route directly to proxy tier, skip WebFetch
  │
  └─ ESCALATION LADDER by mode
       Tier 1 — WebFetch (all modes)
       Tier 2 — Proxy tier (mode: standard, deep)
       Tier 3 — Semantic cleanup (mode: deep only)
```

### Mode Selection

Pass the mode that matches the caller's tolerance for escalation:

- **`mode: "fast"`** — WebFetch only. No escalation on failure; returns an error instead. Use for low-latency or volume operations where a missed scrape is acceptable.
- **`mode: "standard"`** (default) — WebFetch → proxy tier on bot-detection / 403 / 429. No semantic cleanup. The pragmatic default for most "I'm blocked" cases.
- **`mode: "deep"`** — Full ladder: WebFetch → proxy tier → semantic cleanup. Use for OSINT, enrichment, and "this must work" workflows where latency is secondary.

### Invocation

```typescript
import { Scrape } from "@durante/scraping"

const { markdown, metadata, adapter, cached, latencyMs, costCredits } =
  await Scrape.fetch(url, { mode: "deep" })

// adapter tells you which tier actually served the response
// ("webfetch" | "firecrawl" | "brightdata")
```

When `STUDIO_INTENT_ROUTES=1` the call POSTs to `/api/v1/scraping/fetch`; otherwise the client-side router (`Packs/scraping/src/Router.ts`) falls back to the existing adapters directly. Either way, callers use the same `Scrape.fetch` surface.

## Adjacent Intent Verbs

The router exposes siblings for cases `fetch` doesn't cover:

- **`Scrape.search(query)`** — search results, no page content fetch (§5.2)
- **`Scrape.extract(url, schema)`** — structured data extraction against a schema (§5.3)
- **`Scrape.profile(entity, { kind, platform })`** — platform-specific actor (LinkedIn / Instagram / Amazon / Google Maps) (§5.4)
- **`Scrape.sitemap(domain)`** — URL discovery across a domain (§5.5)

Use the sibling that matches the intent. Routing difficulty-reclassifying pages through `Scrape.search` or `Scrape.profile` does not belong in this skill.

## Complete Retrieval Examples

### Example 1: Retrieve an article behind bot detection

**User request:** "I can't get the content from https://example.com/article — it keeps blocking me"

```typescript
import { Scrape } from "@durante/scraping"

const { markdown, adapter } = await Scrape.fetch(
  "https://example.com/article",
  { mode: "deep" },
)

// If the domain is on the anti-bot list the router picks the proxy tier
// directly; otherwise WebFetch is tried first and escalated on failure.
```

### Example 2: Search + scrape top results

**User request:** "Get content about React 19 from the top 5 search results, the sites keep blocking me"

```typescript
const { results } = await Scrape.search("React 19 features documentation", {
  provider: "auto",
  limit: 5,
})

const pages = await Promise.all(
  results.map(r => Scrape.fetch(r.url, { mode: "standard" })),
)
```

### Example 3: CloudFlare-protected site

**User request:** "Scrape this CloudFlare-protected site"

```typescript
// CloudFlare-protected domains live on the anti-bot list;
// mode: "standard" is enough — the router skips the failing WebFetch.
const { markdown } = await Scrape.fetch(
  "https://cloudflare-protected-site.com",
  { mode: "standard" },
)
```

## Mode Comparison

| Mode | Tiers attempted | Bot-detection bypass | When to use |
|---|---|---|---|
| `fast` | WebFetch only | No | Low-latency, low-stakes fetches |
| `standard` | WebFetch → proxy tier | Yes (on failure or anti-bot list) | Default "I'm blocked" case |
| `deep` | WebFetch → proxy → semantic cleanup | Yes | OSINT, enrichment, must-succeed |

## Error Handling

`Scrape.fetch` fails closed when all tiers in the selected mode are exhausted. The returned error carries `{ code, attempted, lastError }` so callers can log which tiers were tried.

**On failure, report to user:**
- All configured tiers exhausted for the selected mode
- Site may be technically impossible to scrape without login
- Legal/ethical considerations (robots.txt, ToS)

Escalation between tiers is the router's job, not the caller's. Do not hand-code adapter-specific retry logic in this skill.

## Working Files → History Pattern

**Working Directory:** `MEMORY/WORK/{current_work}/`

**Getting Current Work Directory:**
1. Read `MEMORY/STATE/current-work.json` (falls back to `~/.claude/MEMORY/STATE/current-work.json`)
2. Extract the `work_dir` value
3. Use `MEMORY/WORK/{work_dir}/` for temporary artifacts

**Process:**

1. **Working Files (Temporary):**
   - All retrieval work artifacts go in current work item directory
   - Store raw scraped content (HTML, markdown, JSON)
   - Keep intermediate processing notes
   - Save error logs and retry attempts
   - Draft extracted data and transformations
   - **Ties retrieval artifacts to work item for learning**

2. **Research vault (permanent):**
   - Save the final report to `MEMORY/RESEARCH/{YYYY-MM}/` (project-first via
     `getMemorySubdir('RESEARCH')` — the convention every other research
     workflow uses; synced by SaveResearchVaultsToStudio)
   - Include: final extracted content + source metadata (URL, title, date)

3. **Verification (MANDATORY):**
   - Confirm the report file exists under `MEMORY/RESEARCH/{YYYY-MM}/`
   - Log the artifact (ArtifactAutoLogger captures write-class calls
     automatically; `ResearchRender.ts log-artifact` for manual entries)
   - **Note:** Working artifacts remain tied to work item (don't delete)

**File Structure Example:**

**Working files (in current work item directory):**
```
MEMORY/WORK/20260111-172408_retrieve-react19-docs/
├── raw-content/
│   ├── page1.md (Scrape.fetch output)
│   ├── page2.md (Scrape.fetch output)
│   └── page3.md (Scrape.fetch output)
├── processed/
│   ├── combined-content.md
│   └── extracted-features.json
├── metadata.json (URLs, modes used, adapters that served, timestamps)
└── errors.log (failed attempts, attempted-tiers)
```

**Research vault (permanent):**
```
MEMORY/RESEARCH/2026-07/react19-documentation/
├── README.md (retrieval documentation)
├── content.md (final extracted content)
├── metadata.json (sources, modes used, adapters that served, timestamps)
└── summary.md (key extracted information)
```

**README.md Template:**
```markdown
# Retrieval: [Site/Topic]

**Date:** YYYY-MM-DD
**Target:** [URLs or site description]
**Modes Used:** fast / standard / deep

## Retrieval Request
[Original request]

## URLs Retrieved
- URL 1
- URL 2
- URL 3

## Modes & Adapters Used
- `Scrape.fetch(..., { mode: "standard" })` — served by webfetch / proxy / semantic
- `Scrape.search(...)` — provider: brave / firecrawl

## Challenges Encountered
- Bot detection: Yes/No
- CAPTCHA: Yes/No
- JavaScript rendering: Yes/No
- Rate limiting: Yes/No

## Output Files
- content.md: Final extracted content
- metadata.json: Source tracking
- summary.md: Key information extracted

## Notes
[Any limitations, challenges, or follow-up needed]
```

## Quick Reference Card

**Which mode?**
- Simple public webpage → `mode: "fast"` (or WebFetch directly — skip this skill)
- Blocked / CAPTCHA / rate-limited → `mode: "standard"` (default)
- OSINT / enrichment / must-succeed → `mode: "deep"`

**Which verb?**
- Page content → `Scrape.fetch`
- Search results → `Scrape.search`
- Structured schema extraction → `Scrape.extract`
- Social / platform profile → `Scrape.profile`
- URL discovery across a domain → `Scrape.sitemap`

**Remember:**
- One call, router escalates. Don't hand-code adapter choice.
- Mode is the only knob; surface the wrong mode and callers over- or under-pay.
- Work artifacts go in current work item directory
- Final valuable content goes to history
- Working artifacts stay tied to work item for learning
