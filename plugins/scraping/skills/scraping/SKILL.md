---
name: Scraping
description: Web scraping via progressive escalation (Bright Data proxy) and social media platform actors (Apify). USE WHEN scraping, Bright Data, proxy, crawl, scrape URL, Twitter scraping, Instagram scraping, LinkedIn scraping, TikTok scraping, YouTube scraping, Facebook scraping, Google Maps, Amazon scraping, Apify, bot detection, CAPTCHA, spider, four tier scrape, site blocking.
role: extractor
accepts:
  - text
icon: Globe
colorVar: tertiary
colorHex: "#ffb95a"
tier: secondary
category: Engineering
displayLabel: Scraping
marketingDescription: "Progressive scraping: WebFetch, Firecrawl, Bright Data proxies"
elevator: Progressive scraping with proxy escalation
highlightWorkflows:
  - name: Web Fetch
    technicalName: WebFetch
  - name: Firecrawl
    technicalName: Firecrawl
  - name: Bright Data Scrape
    technicalName: BrightDataScrape
roots: []
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Scraping/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Scraping

Unified skill for web scraping workflows.

## Programmatic Intent API (RFC-0015 §5)

Scraping is the platform's **web-data-acquisition substrate** — consumed by 5+ packs (Research, Investigation, Bdr, ContentAnalysis, Security). Beyond the conversational vendor routing below, it exposes a stable **`Scrape` intent-API** (`src/index.ts`, RFC-0015 §5): five verbs over a module-singleton router with a 4-tier escalation ladder (WebFetch → Firecrawl → Bright Data → Apify) and metered BYOK/Studio gateways.

| Verb | Call | Returns |
|---|---|---|
| `fetch` | `Scrape.fetch(url, opts?)` | clean page content / markdown |
| `search` | `Scrape.search(query, opts?)` | web search results |
| `extract` | `Scrape.extract(urls, schema, opts?)` | structured data matching `schema` |
| `profile` | `Scrape.profile(entity, opts)` | a social / business profile |
| `sitemap` | `Scrape.sitemap(domain, opts?)` | discovered URLs for a domain |

**Consume it by consumer-type** (do not "switch everyone to a Skill invocation" — the verb-import IS the designed RFC-0015 §5 model):

- **TS-Tool consumers** (a pack's `Tools/*.ts`) import the verbs directly — `import { Scrape } from "<scraping-specifier>"` then `await Scrape.fetch(url)`; no adapter wiring at the call site. *(A stable installable `@durante/scraping` specifier is being formalized; until it lands the import resolves via the monorepo at repo-root cwd — do NOT hardcode the dev path `Packs/scraping/src` in shipped consumer docs.)*
- **Markdown-workflow consumers** (a workflow's `.md` prose, which cannot execute a TS `import`) use the CLI Port instead — `bun Tools/dos-scrape.ts <url>` (fetch/scrape today; the full 5-verb CLI surface is being extended).

**Intent-cache (freshness contract, `Router.ts` `SCRAPE_INTENT_TTL_SECONDS`):** `fetch` 24h · `search` 7d · `extract` 30d · `profile` 24h · `sitemap` 7d — each verb is cached by intent, so repeat calls within the TTL are free.

**Metering / BYOK:** the vendor gateways (Bright Data / Firecrawl / Apify) route through **Studio** when `STUDIO_API_URL` + `STUDIO_API_KEY` are set, else **direct BYOK** with your own vendor keys. NOTE: the Studio intent-routes are **flag-gated OFF by default** (`STUDIO_INTENT_ROUTES`, `Router.ts`), so the live path today is the adapter-fallback branch.

## Workflow Routing

**Sub-component routing:** references to `<Sub>/SKILL.md` in this skill are FILE PATHS relative to this skill's directory — load them with the Read tool and follow their instructions. Sub-components (Firecrawl/, BrightData/, Apify/) are NOT separately registered skills: never invoke `Skill("scraping:<Component>")` — it fails with "Unknown skill".

| Request Pattern | Route To |
|---|---|
| Bright Data, scrape URL, proxy, crawl, progressive scraping, Chrome headers | `BrightData/SKILL.md` |
| Firecrawl, firecrawl scrape, crawl site, map site, extract data, structured extraction, web search scrape | `Firecrawl/SKILL.md` |
| Twitter, Instagram, LinkedIn, TikTok, YouTube, Facebook, Google Maps, Amazon scraping, Apify | `Apify/SKILL.md` |

## User-Agent Convention

DOS scraping respects Anthropic's User-Agent convention: Claude Code's built-in `WebFetch` tool sends `User-Agent: Claude-User` (Anthropic v2.1.83+). Partner sites that wish to allowlist Claude-driven fetches can match this UA in robots.txt or their CDN rules. Downstream tiers (Firecrawl, Bright Data, Apify actors) use their own UA strategies for bot-evasion — only the WebFetch fast-path carries the `Claude-User` identifier.

## Examples

**Example 1: Progressive escalation through proxy tiers**
```
User: "Scrape this product page — Cloudflare keeps blocking me: https://example-shop.com/widget"
→ Routes to BrightData/SKILL.md for proxy escalation
→ Tries WebFetch → Firecrawl → Bright Data residential proxy with rotating Chrome headers until one succeeds
→ User gets parsed page content with the tier that worked logged for future runs
```

**Example 2: Structured extraction across a whole site**
```
User: "Crawl all blog posts from https://blog.example.com and extract title, author, date"
→ Routes to Firecrawl/SKILL.md for site-wide structured extraction
→ Maps the site, fetches each post in parallel, applies the structured schema to each page
→ User gets a JSON array of {title, author, date} objects with one row per discovered post
```

**Example 3: Social media platform actor**
```
User: "Pull the last 100 tweets from a specific Twitter account"
→ Routes to Apify/SKILL.md for platform-specific actor
→ Selects the appropriate Twitter scraper actor, runs it with the handle as input, polls until complete
→ User gets the latest 100 tweets with metadata (likes, retweets, timestamps) ready for downstream analysis
```

**Example 4: Programmatic intent-API call (a Tool or workflow consuming Scraping)**
```
A pack's Tool needs clean markdown for a URL — it calls the Scrape verb directly (RFC-0015 §5):
  import { Scrape } from "<scraping-specifier>"
  const { content } = await Scrape.fetch("https://example.com/article")
A markdown workflow (no TS import) uses the CLI Port instead:
  bun Tools/dos-scrape.ts "https://example.com/article"
→ The Router escalates WebFetch → Firecrawl → Bright Data automatically; the result is intent-cached (fetch: 24h)
```

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Scraping","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/scraping/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/scraping/` — active release submodule (versioned)
3. `Packs/*/src/Scraping/` — pack source (distributable)
4. `Packs/agents/Scraping/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
