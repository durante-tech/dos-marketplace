---
name: BrightData
description: 4-tier progressive URL scraping and multi-page crawling — WebFetch, then Chrome-header curl, then Playwright browser, then Bright Data proxy. Auto-escalates when lower tiers fail. USE WHEN Bright Data, scrape URL, web scraping, site blocking me, can't access, bot detection, crawl site, crawl pages, spider, CAPTCHA, four tier scrape, progressive scraping, Chrome headers.
role: extractor
accepts:
  - url
roots: []
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/BrightData/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **Brightdata** skill to ACTION...
```

**Route to the appropriate workflow based on the request.**

**When user requests scraping/fetching a single URL:**
Examples: "scrape this URL", "fetch this page", "get content from [URL]", "pull content from this site", "retrieve [URL]", "can't access this site", "this site is blocking me", "use Bright Data to fetch"
→ **READ:** Workflows/FourTierScrape.md
→ **EXECUTE:** Four-tier progressive scraping workflow (WebFetch → Curl → Browser Automation → Bright Data code-first client)

**When user requests crawling multiple pages from a site:**
Examples: "crawl this site", "crawl all pages under /docs", "spider this domain", "map this website", "get all pages from", "crawl [URL]", "scrape the whole site", "extract all pages"
→ **READ:** Workflows/Crawl.md
→ **EXECUTE:** Crawl workflow (Light Crawl for <50 pages, Full Crawl via Bright Data Crawl API for larger sites)

---

## When to Activate This Skill

### Direct Scraping Requests (Categories 1-4)
- "scrape this URL", "scrape [URL]", "scrape this page"
- "fetch this URL", "fetch [URL]", "fetch this page", "fetch content from"
- "pull content from [URL]", "pull this page", "pull from this site"
- "get content from [URL]", "retrieve [URL]", "retrieve this page"
- "do scraping on [URL]", "run scraper on [URL]"
- "basic scrape", "quick scrape", "simple fetch"
- "comprehensive scrape", "deep scrape", "full content extraction"

### Access & Bot Detection Issues (Categories 5-7)
- "can't access this site", "site is blocking me", "getting blocked"
- "bot detection", "CAPTCHA", "access denied", "403 error"
- "need to bypass bot detection", "get around blocking"
- "this URL won't load", "can't fetch this page"
- "use Bright Data", "use the scraper", "use advanced scraping"

### Result-Oriented Requests (Category 8)
- "get me the content from [URL]"
- "extract text from [URL]"
- "download this page content"
- "convert [URL] to markdown"
- "need the HTML from this site"

### Crawling Requests (Categories 9-11)
- "crawl this site", "crawl [URL]", "spider this domain"
- "map this website", "get all pages from [URL]", "scrape the whole site"
- "crawl all pages under /docs", "extract all pages from", "site crawl"
- "get every page on this site", "full site extraction"
- "crawl depth 3", "crawl up to 50 pages"

### Use Case Indicators
- User needs web content for research or analysis
- Standard methods (WebFetch) are failing
- Site has bot detection or rate limiting
- Need reliable content extraction
- Converting web pages to structured format (markdown)
- User needs multiple pages from a site, not just one
- User wants to map a site's structure or extract a section

---

## Core Capabilities

**Progressive Escalation Strategy:**
1. **Tier 1: WebFetch** - Fast, simple, built-in Claude Code tool
2. **Tier 2: Customized Curl** - Chrome-like browser headers to bypass basic bot detection
3. **Tier 3: Browser Automation** - Full browser automation using Playwright for JavaScript-heavy sites
4. **Tier 4: Bright Data code-first client** - Professional scraping service that handles CAPTCHA and advanced bot detection

**Key Features:**
- Automatic fallback between tiers
- Preserves content in markdown format
- Handles bot detection and CAPTCHA
- Works with any URL
- Efficient resource usage (only escalates when needed)

---

## Workflow Overview

**FourTierScrape.md** - Complete URL content scraping with four-tier fallback strategy
- **When to use:** Any single URL content retrieval request
- **Process:** Start with WebFetch → If fails, use curl with Chrome headers → If fails, use Browser Automation → If fails, use Bright Data code-first client
- **Output:** URL content in markdown format

**Crawl.md** - Multi-page crawling with link discovery and site mapping
- **When to use:** Crawling multiple pages from a site, mapping site structure, extracting a section
- **Process:** Light Crawl (MCP scrape_batch + link extraction loop, up to 50 pages) or Full Crawl (Bright Data Crawl API for entire sites)
- **Output:** Site map + page contents in markdown, with crawl stats and cost summary

---

## Extended Context

**Integration Points:**
- **WebFetch Tool** - Built-in Claude Code tool for basic URL fetching
- **Bash Tool** - For executing curl commands with custom headers
- **Browser Automation** - Playwright-based browser automation for JavaScript rendering
- **Bright Data Code-First Client** - `BrightData.scrapeAsMarkdown()` and `batchScrape()` for advanced scraping (98% token savings vs MCP)
- **Bright Data Gateway Shim** - `Lib/brightdata-gateway.ts` for Studio-metered or BYOK scraping
- **Bright Data Crawl API** - `BrightData.startCrawl()` for full-site crawls via Dataset API

**When Each Tier Is Used:**
- **Tier 1 (WebFetch):** Simple sites, public content, no bot detection
- **Tier 2 (Curl):** Sites with basic user-agent checking, simple bot detection
- **Tier 3 (Browser Automation):** Sites requiring JavaScript execution, dynamic content loading
- **Tier 4 (Bright Data):** Sites with CAPTCHA, advanced bot detection, residential proxy requirements

**Configuration:**
No configuration required - all tools are available by default in Claude Code

---

## Examples

**Example 1: Simple Public Website**

User: "Scrape https://example.com"

Skill Response:
1. Routes to three-tier-scrape.md
2. Attempts Tier 1 (WebFetch)
3. Success → Returns content in markdown
4. Total time: <5 seconds

**Example 2: Site with JavaScript Requirements**

User: "Can't access this site https://dynamic-site.com"

Skill Response:
1. Routes to four-tier-scrape.md
2. Attempts Tier 1 (WebFetch) → Fails (blocked)
3. Attempts Tier 2 (Curl with Chrome headers) → Fails (JavaScript required)
4. Attempts Tier 3 (Browser Automation) → Success
5. Returns content in markdown
6. Total time: ~15-20 seconds

**Example 3: Site with Advanced Bot Detection**

User: "Scrape https://protected-site.com"

Skill Response:
1. Routes to four-tier-scrape.md
2. Attempts Tier 1 (WebFetch) → Fails (blocked)
3. Attempts Tier 2 (Curl) → Fails (advanced detection)
4. Attempts Tier 3 (Browser Automation) → Fails (CAPTCHA)
5. Attempts Tier 4 (Bright Data code-first client) → Success
6. Returns content in markdown
7. Total time: ~30-40 seconds

**Example 4: Explicit Bright Data Request**

User: "Use Bright Data to fetch https://difficult-site.com"

Skill Response:
1. Routes to four-tier-scrape.md
2. User explicitly requested Bright Data
3. Goes directly to Tier 4 (Bright Data code-first client) → Success
4. Returns content in markdown
5. Total time: ~5-10 seconds

---

**Related Documentation:**
- `~/.claude/DOS/SkillSystem.md` - Canonical structure guide
- `~/.claude/DOS/CONSTITUTION.md` - Overall DOS philosophy

**Last Updated:** 2026-04-13

## Migration Note (Phase 4 — 2026-04-13)

Bright Data migrated from MCP-only (`@brightdata/mcp`) to code-first REST client.
- **Code-first client:** `Packs/scraping/src/BrightData/index.ts` — all 5 MCP tools replaced
- **Gateway shim:** `Packs/scraping/src/BrightData/Lib/brightdata-gateway.ts` — Studio/BYOK routing
- **Studio routes:** `/api/v1/scraping/brightdata/{scrape,batch,crawl}` — metered gateway
- **Token savings:** ~98% vs MCP (content filtered in code before returning to model context)
- **MCP removed:** `@brightdata/mcp` entry removed from `~/.claude/.mcp.json`
