---
name: Web Scraping
description: Web scraping and crawling via the Scrape intent API — router-managed adapter escalation, rate limiting, ethical practices
status: STABLE
bestPath:
  - title: "Choose Mode"
    description: "Scrape.fetch for pages, Scrape.profile for social actors."
  - title: "Fetch & Parse"
    description: "Router escalates WebFetch to proxy tiers as needed; parse the HTML/markdown."
  - title: "Respect Limits"
    description: "Rate limiting, robots.txt, server courtesy."
  - title: "Deliver"
    description: "Return structured content; persist research-grade output to the vault."
---

# Web Scraping Workflow

## When to Use

- User says "scrape", "crawl", or needs structured content from pages that resist WebFetch
- Social-platform actor profiles (Scrape.profile)
- Single ordinary pages usually need only Retrieve


Web scraping and crawling via the Scrape intent API (RFC-0015): `Scrape.fetch` for general pages (router handles WebFetch → proxy-tier escalation), `Scrape.profile` for social-platform actors. Includes HTML parsing, rate limiting, and best practices for ethical scraping.

## 🎯 Load Full DOS Context

**Before starting any task with this skill, load complete DOS context:**

`read ~/.claude/DOS/SKILL.md`

This provides access to:
- Complete contact list (Angela, Bunny, Saša, Greg, team members)
- Stack preferences (TypeScript>Python, bun>npm, uv>pip)
- Security rules and repository safety protocols
- Response format requirements (structured emoji format)
- Voice IDs for agent routing (ElevenLabs)
- Personal preferences and operating instructions

## When to Activate This Skill
- Scrape web pages
- Extract data from websites
- Crawl multiple pages
- Collect web data
- Extract links or content
- Data extraction tasks

## Decision Tree

1. **General page?** → `Scrape.fetch(url)` — default mode tries WebFetch then escalates to the proxy tier on bot-detection signals (§7.1)
2. **Known CAPTCHA / anti-bot domain?** → `Scrape.fetch(url, { mode: 'deep' })` — full ladder including semantic cleanup tier
3. **Social profile / specialized actor?** → `Scrape.profile(entity, { kind, platform })` — routes to the matching Apify actor per §5.4
4. **Structured data extraction?** → `Scrape.extract(url, schema)` — §5.3
5. **Site mapping / URL discovery?** → `Scrape.sitemap(domain)` — §5.5
6. **Search results?** → `Scrape.search(query)` — §5.2

## Common Tasks

### Extract All Links from Page
1. `Scrape.fetch(url)` — router returns markdown + metadata
2. Parse for link patterns
3. Extract hrefs

### Scrape Product Listings
1. `Scrape.fetch(url)` for HTML, or `Scrape.extract(url, schema)` when the product shape is known
2. Parse for product containers (or receive typed data from extract)
3. Extract data (title, price, image, etc.)

### Crawl Multiple Pages
1. `Scrape.sitemap(domain)` to discover URL set
2. Filter detail pages
3. `Scrape.fetch(url)` per page (router serves cache when available — §9 TTL table)
4. Extract data from each

## Best Practices

### Do's
✅ Check robots.txt first
✅ Add delays between requests
✅ Handle errors gracefully
✅ Use appropriate tool for site
✅ Cache results when possible

### Don'ts
❌ Don't scrape too fast
❌ Don't ignore rate limits
❌ Don't scrape personal data without permission
❌ Don't bypass security maliciously

## Rate Limiting
- Add delays between requests (`sleep 1`)
- Respect robots.txt
- Don't overwhelm servers

## Supplementary Resources
For the full adapter/router surface: `Packages/@durante/scraping` (import
`{ Scrape }` from `@durante/scraping`) and the scraping pack SKILL at
`Packs/scraping/src/SKILL.md`.