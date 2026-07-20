#!/usr/bin/env bun
/**
 * Firecrawl CLI Tool — code-first scraping via Firecrawl v2 API
 *
 * Usage:
 *   bun FirecrawlScrape.ts --url "https://example.com"
 *   bun FirecrawlScrape.ts --url "https://example.com" --format markdown
 *   bun FirecrawlScrape.ts --crawl --url "https://docs.example.com" --limit 50
 *   bun FirecrawlScrape.ts --map --url "https://example.com"
 *   bun FirecrawlScrape.ts --search "query" --limit 5
 *   bun FirecrawlScrape.ts --extract --url "https://..." --schema '{"title":"string"}'
 *
 * JSON output to stdout. Status messages to stderr.
 */

import { Firecrawl } from '@durante/scraping/Firecrawl'

async function main() {
  const args = process.argv.slice(2)

  const getFlag = (name: string): boolean => args.includes(`--${name}`)
  const getValue = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`)
    return idx !== -1 ? args[idx + 1] : undefined
  }

  const url = getValue('url')
  const query = getValue('search') || getValue('query')
  const limit = getValue('limit') ? parseInt(getValue('limit')!, 10) : undefined

  const client = await Firecrawl.create()

  const mode = client.isStudioMode ? 'studio' : 'byok'
  process.stderr.write(`[firecrawl] mode=${mode}\n`)

  if (getFlag('crawl') && url) {
    process.stderr.write(`[firecrawl] crawling ${url} (limit=${limit ?? 'default'})...\n`)
    const job = await client.crawl(url, { limit })
    process.stderr.write(`[firecrawl] crawl started, jobId=${job.id}\n`)

    // Poll until complete
    let status = await client.getCrawlStatus(job.id)
    while (status.status === 'scraping') {
      await new Promise(r => setTimeout(r, 5000))
      status = await client.getCrawlStatus(job.id)
      process.stderr.write(`[firecrawl] crawl progress: ${status.completed}/${status.total}\n`)
    }

    console.log(JSON.stringify({
      operation: 'crawl',
      jobId: job.id,
      status: status.status,
      pageCount: status.completed,
      pages: status.data.map(p => ({
        markdown: p.markdown?.slice(0, 2000),
        metadata: p.metadata,
      })),
    }, null, 2))
    return
  }

  if (getFlag('map') && url) {
    process.stderr.write(`[firecrawl] mapping ${url}...\n`)
    const links = await client.map(url, { limit })
    console.log(JSON.stringify({ operation: 'map', url, linkCount: links.length, links }, null, 2))
    return
  }

  if (query || getFlag('search')) {
    const q = query || getValue('url') || ''
    process.stderr.write(`[firecrawl] searching "${q}"...\n`)
    const results = await client.search(q, { limit })
    console.log(JSON.stringify({ operation: 'search', query: q, resultCount: results.length, results }, null, 2))
    return
  }

  if (getFlag('extract') && url) {
    const schemaStr = getValue('schema')
    const schema = schemaStr ? JSON.parse(schemaStr) : undefined
    const prompt = getValue('prompt')
    process.stderr.write(`[firecrawl] extracting from ${url}...\n`)
    const result = await client.extract([url], schema, prompt)
    console.log(JSON.stringify({ operation: 'extract', id: result.id }, null, 2))
    return
  }

  if (url) {
    process.stderr.write(`[firecrawl] scraping ${url}...\n`)
    const result = await client.scrape(url)
    console.log(JSON.stringify({
      operation: 'scrape',
      url,
      markdownLength: result.markdown.length,
      markdown: result.markdown,
      metadata: result.metadata,
    }, null, 2))
    return
  }

  process.stderr.write(`Usage:
  bun FirecrawlScrape.ts --url "https://example.com"
  bun FirecrawlScrape.ts --crawl --url "https://docs.example.com" --limit 50
  bun FirecrawlScrape.ts --map --url "https://example.com"
  bun FirecrawlScrape.ts --search "query" --limit 5
  bun FirecrawlScrape.ts --extract --url "https://..." --schema '{"title":"string"}'
`)
  process.exit(1)
}

main().catch(err => {
  process.stderr.write(`[firecrawl] error: ${err.message}\n`)
  process.exit(1)
})
