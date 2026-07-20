---
name: Firecrawl
description: Web scraping, crawling, site mapping, structured extraction, and search via Firecrawl v2 API. Code-first with Studio gateway metering or BYOK fallback. USE WHEN firecrawl, scrape URL, crawl site, map site, extract data, structured extraction, web search scrape.
role: extractor
accepts:
  - url
roots: []
visibility: public
capabilities:
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Firecrawl/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there.

## Workflow Routing

**Single URL scrape (default):**
```typescript
import { Firecrawl } from './index.ts'
const client = await Firecrawl.create()
const result = await client.scrape('https://example.com')
// result.markdown, result.metadata
```

**Crawl a site (async — returns job, poll for results):**
```typescript
const job = await client.crawl('https://docs.example.com', { limit: 50 })
let status = await client.getCrawlStatus(job.id)
while (status.status === 'scraping') {
  await new Promise(r => setTimeout(r, 5000))
  status = await client.getCrawlStatus(job.id)
}
// status.data — array of { markdown, metadata }
```

**Map a site (discover URLs without scraping content):**
```typescript
const links = await client.map('https://example.com', { limit: 1000 })
// links: Array<{ url, title, description }>
```

**Search + scrape:**
```typescript
const results = await client.search('query', { limit: 5 })
// results: Array<{ url, title, description, markdown }>
```

**Extract structured data (async):**
```typescript
const result = await client.extract(['https://...'], { title: 'string', price: 'number' })
// result.id — poll for completion
```

## CLI Tool

```bash
bun FirecrawlScrape.ts --url "https://example.com"
bun FirecrawlScrape.ts --crawl --url "https://docs.example.com" --limit 50
bun FirecrawlScrape.ts --map --url "https://example.com"
bun FirecrawlScrape.ts --search "query" --limit 5
bun FirecrawlScrape.ts --extract --url "https://..." --schema '{"title":"string"}'
```

## Core Capabilities

- **Scrape**: Single URL to markdown with metadata
- **Crawl**: Async multi-page crawl with depth control
- **Map**: Fast URL discovery (sitemap + link extraction)
- **Extract**: Structured data extraction with JSON schema
- **Search**: Query → relevant URLs → scraped content

## Gateway Mode

When `STUDIO_API_URL` + `STUDIO_API_KEY` are set, all calls route through Studio gateway:
- `/api/v1/scraping/firecrawl/scrape` — sync
- `/api/v1/scraping/firecrawl/crawl` — async (poll via /api/v1/media/generations/{id})
- `/api/v1/scraping/firecrawl/map` — sync
- `/api/v1/scraping/firecrawl/extract` — async
- `/api/v1/scraping/firecrawl/search` — sync

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIRECRAWL_API_KEY` | Yes (BYOK) | Firecrawl API bearer token |
| `STUDIO_API_URL` | For Studio | Studio gateway base URL |
| `STUDIO_API_KEY` | For Studio | Studio API bearer token |

**Last Updated:** 2026-04-13
