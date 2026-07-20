# Apify Integration Guide

**Status:** Production Ready (Code-First + Studio Gateway)
**Token Savings:** 90-98% vs traditional MCP approach
**Execution Time:** ~10 seconds typical

## Architecture

### Two Modes

The `Apify` class in `index.ts` supports two execution modes, detected automatically from env vars:

| Mode | Detection | How it works |
|------|-----------|-------------|
| **Studio (gateway)** | `STUDIO_API_URL` + `STUDIO_API_KEY` set | Routes `callActor`/`waitForRun`/`getDataset` through Studio's metered gateway at `/api/v1/scraping/apify/run`. Pooled `STUDIO_POOL_APIFY_TOKEN` on server. |
| **BYOK** | `APIFY_TOKEN` or `APIFY_API_KEY` set | Calls `api.apify.com/v2` directly with the user's own key. |

### Env Vars

```bash
# Gateway mode (metered through Studio)
STUDIO_API_URL=http://localhost:3000   # or production Studio URL
STUDIO_API_KEY=sk-studio-...           # Studio API key

# BYOK mode (direct to Apify)
APIFY_TOKEN=apify_api_...              # or APIFY_API_KEY
```

All vars are loaded from `~/.claude/.env` via `loadEnv()` at runtime.

### Usage

```typescript
import { Apify } from "./index.ts"

// Use the async factory to ensure env is loaded
const apify = await Apify.create()

// In Studio mode: routes through gateway, metered
// In BYOK mode: calls api.apify.com directly
const run = await apify.callActor("apify/web-scraper", {
  startUrls: [{ url: "https://example.com" }],
  maxPagesPerCrawl: 10,
})

await apify.waitForRun(run.id)
const dataset = apify.getDataset(run.defaultDatasetId)
const items = await dataset.listItems({ limit: 100 })
```

### Gateway Shim (Lib/apify-gateway.ts)

A standalone gateway shim is also available at `Lib/apify-gateway.ts` for direct use without the class:

```typescript
import { runActor } from "./Lib/apify-gateway.ts"

const { items, chargedCredits, mode } = await runActor({
  actorId: "apify/web-scraper",
  input: { startUrls: [{ url: "https://example.com" }] },
})
```

## Integration with DOS Skills

### Social Skill Integration

**Location:** `~/.claude/skills/social/SKILL.md`

The social skill uses code-based Apify scripts for Twitter operations.

**Trigger -> Script Mapping:**

| User Says | Script to Run |
|-----------|---------------|
| "my latest tweet" | `get-latest-tweet.ts` |
| "my latest thread" | `get-latest-thread.ts` |
| "get tweets from @user" | `get-user-tweets.ts user 5` |
| "what has @user been talking about" | `get-user-tweets.ts user 10` |

### BDR/Sales Integration

**Location:** `~/.claude/skills/bdr/`

BDR workflows use the Apify code-first client for LinkedIn and Crunchbase scraping. The `Apify.create()` factory ensures Studio gateway routing when configured.

## Migration History

### Phase 1: MCP -> Code-First

Replaced legacy MCP tool calls with direct REST API calls via the `Apify` class. **Token savings: 90-98%.**

### Phase 2: Code-First -> Studio Gateway (2026-04-13)

Added Studio gateway branch to the `Apify` class in `index.ts`. When `STUDIO_API_URL` + `STUDIO_API_KEY` are set, all `callActor()` calls route through `/api/v1/scraping/apify/run` -- metered, with pooled keys, spend caps, and kill switch protection. ALL downstream consumers auto-route because they all use the `Apify` class.

### Phase 3: MCP Removal (2026-04-13)

- Removed `apify` entry from `~/.claude/.mcp.json` (saves ~3s MCP server startup per session)
- Purged all legacy MCP references from BDR and Scraping workflows
- `APIFY_TOKEN` remains in `~/.claude/.env` for BYOK fallback

## Available Scripts

| Script | Purpose | Tokens |
|--------|---------|--------|
| `skills/get-user-tweets.ts` | Any user's recent tweets | ~800/tweet |
| `actors/web/web-scraper.ts` | General web scraping | varies |
| `actors/business/google-maps.ts` | Google Maps data | varies |
| `actors/social-media/twitter.ts` | Twitter/X scraping | varies |
| `actors/social-media/instagram.ts` | Instagram scraping | varies |
| `actors/social-media/linkedin.ts` | LinkedIn scraping | varies |

## Studio Gateway Pricing

| Model ID | Display Name | Cost |
|----------|-------------|------|
| `apify-web-scraper` | Apify Web Scraper | ~$2.50/1K runs |
| `apify-google-maps` | Apify Google Maps | ~$5/1K runs |
| `apify-social-media` | Apify Social Media | ~$5/1K runs |
| `apify-custom` | Apify Custom Actor | ~$5/1K runs |

## Best Practices

- Use `Apify.create()` (async factory) instead of `new Apify()` to ensure env is loaded
- Use the existing actor wrappers in `actors/` when available
- Filter data in code before returning to model context (the 98% token win)
- Check `apify.isStudioMode` to log which mode is active
