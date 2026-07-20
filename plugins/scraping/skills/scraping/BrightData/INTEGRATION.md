# Bright Data Integration Guide

**Status:** Production Ready
**Token Savings:** ~90-98% vs MCP approach
**Phase:** 4 of DOS Gateway Monetization Roadmap

## Migration from MCP to Code-First

### Before (Legacy MCP Approach — removed)

```
# Legacy: MCP tool calls returned FULL unfiltered page content (~50,000+ tokens)
# These MCP tools no longer exist — replaced by code-first client below
# Total tokens per scrape: ~50,000 (unfiltered HTML/markdown + metadata)
```

### After (Code-First Approach)

```typescript
import { BrightData } from "~/.claude/skills/scraping/BrightData/index.ts";

const client = new BrightData(); // Uses BRIGHTDATA_API_TOKEN env

// Single URL — returns ONLY filtered markdown content
const markdown = await client.scrapeAsMarkdown("https://example.com");
// ~500-5,000 tokens (filtered)

// Batch — concurrent with bounded parallelism (5 max)
const results = await client.batchScrape(["url1", "url2", ...]);
// Each result: { url, content, error? }

// SERP search — structured results only
const results = await client.searchEngine("pizza restaurants", {
  engine: "google",
  country: "us",
});
// Returns: Array<{ title, url, description }>

// Crawl — async via Dataset API
const snapshotId = await client.startCrawl("https://docs.example.com", {
  depth: 3,
  urlFilter: "https://docs\\.example\\.com/.*",
});
// Poll: const status = await client.getCrawlStatus(snapshotId);
// Get results: const pages = await client.getCrawlResults(snapshotId);
```

### Via Gateway Shim (Studio-Metered)

```typescript
import { scrapeUrl, batchScrape } from "../../Lib/brightdata-gateway.ts";

// Auto-routes through Studio when STUDIO_API_URL + STUDIO_API_KEY set
const { content, chargedCredits, mode } = await scrapeUrl({
  url: "https://example.com",
  dataFormat: "markdown",
});
// mode: 'studio' (metered) or 'byok' (direct API)
```

## Legacy → Code-First Mapping

| Legacy Operation | Code-First Method | Gateway Route |
|----------|------------------|---------------|
| Single page scrape | `BrightData.scrapeAsMarkdown()` | `/api/v1/scraping/brightdata/scrape` |
| Batch scrape | `BrightData.batchScrape()` | `/api/v1/scraping/brightdata/batch` |
| SERP search | `BrightData.searchEngine()` | — (BYOK only) |
| Batch SERP search | `BrightData.searchEngineBatch()` | — (BYOK only) |
| URL discovery | Use `searchEngine` with intent | — (BYOK only) |
| Crawl | `BrightData.startCrawl()` | `/api/v1/scraping/brightdata/crawl` |

## Token Savings

| Operation | MCP Tokens | Code-First Tokens | Savings |
|-----------|-----------|-------------------|---------|
| Single page scrape | ~50,000 | ~500-5,000 | 90-98% |
| Batch (5 URLs) | ~250,000 | ~2,500-25,000 | 90-98% |
| SERP search | ~10,000 | ~2,000 | 80% |
| Crawl (50 pages) | N/A (manual) | ~25,000-250,000 | N/A |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BRIGHTDATA_API_TOKEN` | Yes (BYOK) | Bright Data API bearer token |
| `BRIGHTDATA_ZONE` | No | Web Unlocker zone (default: `web_unlocker1`) |
| `BRIGHTDATA_SERP_ZONE` | No | SERP API zone (default: `serp1`) |
| `BRIGHTDATA_CRAWL_DATASET_ID` | For crawl | Dataset ID for crawl jobs |
| `STUDIO_API_URL` | For Studio | Studio gateway base URL |
| `STUDIO_API_KEY` | For Studio | Studio API bearer token |
| `STUDIO_POOL_BRIGHTDATA_API_TOKEN` | Server-side | Pooled Bright Data token (Studio) |

## Studio Gateway Routes

| Route | Method | Pattern | Pricing |
|-------|--------|---------|---------|
| `/api/v1/scraping/brightdata/scrape` | POST | Sync | 1¢/request |
| `/api/v1/scraping/brightdata/batch` | POST | Sync (concurrent) | 1¢/URL |
| `/api/v1/scraping/brightdata/crawl` | POST | Async (after()) | 0.15¢/page |

## Workflow Changes

- **FourTierScrape.md**: Tier 4 now uses code-first `scrapeUrl()` via gateway shim
- **Crawl.md**: Changed from MCP `scrape_batch` + curl to code-first `batchScrape()` and `startCrawl()`
- **SKILL.md**: Updated integration points from MCP to code-first client and gateway shim

## Error Handling

The code-first client handles errors automatically:

1. **Rate limiting (429)** → Exponential backoff, up to 3 retries
2. **Connection errors** → Retry with linear backoff
3. **Auth failure (401)** → Clear error: check `BRIGHTDATA_API_TOKEN`
4. **Zone not found** → Check `BRIGHTDATA_ZONE` env var
5. **Crawl timeout** → 10-minute max, then error

## Related Files

- **Code-first client:** `Packs/scraping/src/BrightData/index.ts`
- **Gateway shim:** `Packs/scraping/src/BrightData/Lib/brightdata-gateway.ts`
- **Scrape worker:** `Platform/studio/apps/web/lib/gateway/brightdata-scrape-worker.ts`
- **Crawl worker:** `Platform/studio/apps/web/lib/gateway/brightdata-crawl-worker.ts`
- **Routes:** `Platform/studio/apps/web/app/api/v1/scraping/brightdata/{scrape,batch,crawl}/route.ts`
- **Pricing:** `Platform/studio/packages/database/src/services/gateway-pricing.service.ts`
- **Contract test:** `Platform/studio/packages/database/src/services/gateway-metering.contract.test.ts`
- **Apify template:** `Packs/scraping/src/Apify/INTEGRATION.md` (the migration recipe this followed)
