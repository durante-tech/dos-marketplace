# Firecrawl Integration Guide

**Status:** Production Ready
**Token Savings:** ~90-98% vs MCP approach
**Phase:** Firecrawl migration of DOS Gateway Monetization Roadmap

## Migration from MCP to Code-First

### Before (Legacy MCP Approach — removed)

```
# Legacy: MCP tool calls returned FULL unfiltered page content (~50,000+ tokens)
# These MCP tools no longer exist — replaced by code-first client below
# Total tokens per scrape: ~50,000 (unfiltered HTML/markdown + metadata)
```

### After (Code-First Approach)

```typescript
import { Firecrawl } from "~/.claude/skills/scraping/Firecrawl/index.ts";

const client = await Firecrawl.create(); // Auto-detects Studio or BYOK

// Single URL — returns ONLY markdown + metadata
const { markdown, metadata } = await client.scrape("https://example.com");
// ~500-5,000 tokens (filtered)

// Site map — fast URL discovery
const links = await client.map("https://example.com", { limit: 1000 });
// Returns: Array<{ url, title, description }>

// Search + scrape
const results = await client.search("query", { limit: 5 });
// Returns: Array<{ url, title, description, markdown }>

// Crawl (async)
const job = await client.crawl("https://docs.example.com", { limit: 50 });
const status = await client.getCrawlStatus(job.id);
```

### Via CLI Tool

```bash
bun FirecrawlScrape.ts --url "https://example.com"
bun FirecrawlScrape.ts --crawl --url "https://docs.example.com" --limit 50
bun FirecrawlScrape.ts --map --url "https://example.com"
bun FirecrawlScrape.ts --search "query" --limit 5
```

## Legacy → Code-First Mapping

| Legacy Operation | Code-First Method | Gateway Route |
|----------|------------------|---------------|
| Page scrape | `Firecrawl.scrape()` | `/api/v1/scraping/firecrawl/scrape` |
| Site crawl | `Firecrawl.crawl()` | `/api/v1/scraping/firecrawl/crawl` |
| URL discovery | `Firecrawl.map()` | `/api/v1/scraping/firecrawl/map` |
| Structured extraction | `Firecrawl.extract()` | `/api/v1/scraping/firecrawl/extract` |
| Search + scrape | `Firecrawl.search()` | `/api/v1/scraping/firecrawl/search` |

## Token Savings

| Operation | MCP Tokens | Code-First Tokens | Savings |
|-----------|-----------|-------------------|---------|
| Single page scrape | ~50,000 | ~500-5,000 | 90-98% |
| Site map (100 URLs) | ~20,000 | ~3,000 | 85% |
| Search (5 results) | ~30,000 | ~5,000 | 83% |
| Crawl (50 pages) | N/A (manual) | ~25,000-250,000 | N/A |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIRECRAWL_API_KEY` | Yes (BYOK) | Firecrawl API bearer token |
| `STUDIO_API_URL` | For Studio | Studio gateway base URL |
| `STUDIO_API_KEY` | For Studio | Studio API bearer token |
| `STUDIO_POOL_FIRECRAWL_API_KEY` | Server-side | Pooled Firecrawl token (Studio) |

## Studio Gateway Routes

| Route | Method | Pattern | Pricing |
|-------|--------|---------|---------|
| `/api/v1/scraping/firecrawl/scrape` | POST | Sync | 0.1¢/request |
| `/api/v1/scraping/firecrawl/crawl` | POST | Async (after()) | 0.1¢/page |
| `/api/v1/scraping/firecrawl/map` | POST | Sync | 0.05¢/request |
| `/api/v1/scraping/firecrawl/extract` | POST | Async (after()) | 0.5¢/extraction |
| `/api/v1/scraping/firecrawl/search` | POST | Sync | 0.4¢/search |

## Related Files

- **Code-first client:** `Packs/scraping/src/Firecrawl/index.ts`
- **CLI tool:** `Packs/scraping/src/Firecrawl/Tools/FirecrawlScrape.ts`
- **Workers:** `Platform/studio/apps/web/lib/gateway/firecrawl-{scrape,crawl,map,extract,search}-worker.ts`
- **Routes:** `Platform/studio/apps/web/app/api/v1/scraping/firecrawl/{scrape,crawl,map,extract,search}/route.ts`
- **Pricing:** `Platform/studio/packages/database/src/services/gateway-pricing.service.ts`
- **Contract test:** `Platform/studio/packages/database/src/services/gateway-metering.contract.test.ts`
