#!/usr/bin/env bun
/**
 * brave-search - Brave Web + News Search tool
 *
 * DOS Research Pack tool for structured web and news search via the
 * Brave Search API. Unlike the LLM-based researchers (Perplexity,
 * Gemini, Grok), Brave returns RAW search results — titles, URLs,
 * snippets, dates — not generated prose. The BraveResearcher subagent
 * uses these results as source material and synthesizes with its own
 * Claude inference (free subscription).
 *
 * ROUTING
 * -------
 *   All requests route through the Studio gateway
 *   (/api/v1/search/brave/web). Studio holds the Brave key server-side and
 *   meters credits. STUDIO_API_URL + STUDIO_API_KEY must be set; if either
 *   is missing the tool exits with "Studio gateway not configured" (no
 *   direct-API path).
 *
 * USAGE
 * -----
 *   bun BraveSearch.ts "latest quantum computing breakthroughs"
 *   bun BraveSearch.ts --type news --freshness pw "AI regulation 2026"
 *   bun BraveSearch.ts --count 10 --extra-snippets "topic"
 *   bun BraveSearch.ts --json-only "query"
 *
 * OUTPUT (stdout, always JSON)
 * ----------------------------
 *   {
 *     "results": [
 *       { "title": "...", "url": "...", "description": "...", "age": "...", "extraSnippets": [...] }
 *     ],
 *     "query": "original query",
 *     "totalResults": 20,
 *     "searchType": "web" | "news"
 *   }
 *
 * @see Packs/research/src/SKILL.md
 */

import { loadEnv } from '../Lib/env';

type SearchType = "web" | "news";
type Freshness = "pd" | "pw" | "pm" | "py";

export interface SearchOptions {
  query: string;
  type?: SearchType;
  count?: number;
  freshness?: Freshness;
  extraSnippets?: boolean;
  country?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  extraSnippets?: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
  searchType: SearchType;
}

class CLIError extends Error {
  constructor(message: string, public readonly exitCode: number = 1) {
    super(message);
    this.name = "CLIError";
  }
}

/**
 * Gateway request timeout (ms). Bun `fetch` has no default timeout, so a
 * stalled/half-open Studio gateway would hang programmatic callers forever
 * (RSCH-01). Default 60s; override via RESEARCH_GATEWAY_TIMEOUT_MS (read at
 * call time so tests can inject a tiny value).
 */
function resolveGatewayTimeoutMs(): number {
  const raw = Number(process.env.RESEARCH_GATEWAY_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60_000;
}

export async function braveSearch(options: SearchOptions): Promise<SearchResponse> {
  await loadEnv();

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_API_KEY ?? null;
  const searchType = options.type ?? "web";

  if (!studioUrl || !studioKey) {
    throw new CLIError("Studio gateway not configured. Run: durante configure", 2);
  }
  return braveSearchViaGateway(options, searchType, studioUrl, studioKey);
}

async function braveSearchViaGateway(
  options: SearchOptions,
  searchType: SearchType,
  studioUrl: string,
  studioKey: string,
): Promise<SearchResponse> {
  const { randomUUID } = await import("node:crypto");
  const cleanOrigin = studioUrl.replace(/\/+$/, "");
  const body = {
    query: options.query,
    searchType,
    count: options.count,
    freshness: options.freshness,
    extraSnippets: options.extraSnippets,
    country: options.country,
  };

  const timeoutMs = resolveGatewayTimeoutMs();
  let response: Response;
  try {
    response = await fetch(`${cleanOrigin}/api/v1/search/brave/web`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studioKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new CLIError(`Studio gateway timed out after ${timeoutMs}ms`, 3);
    }
    throw err;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let errBody: Record<string, unknown> = {};
    if (errText) {
      try {
        const parsed = JSON.parse(errText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          errBody = parsed as Record<string, unknown>;
        }
      } catch { /* non-JSON */ }
    }
    const message = (errBody.message as string | undefined) ?? (errText || `Studio gateway ${response.status}`);
    if (response.status === 402) throw new CLIError(`Insufficient credits: ${message}`, 3);
    if (response.status === 401) throw new CLIError(`Invalid STUDIO_API_KEY: ${message}`, 2);
    throw new CLIError(`Studio gateway ${response.status}: ${message}`, 3);
  }

  const payload = (await response.json()) as {
    results: SearchResult[];
    totalResults: number;
    chargedCredits?: number;
  };

  return {
    results: payload.results ?? [],
    query: options.query,
    totalResults: payload.totalResults ?? payload.results?.length ?? 0,
    searchType,
  };
}

// CLI
function parseArgs(argv: string[]): SearchOptions & { jsonOnly: boolean } {
  const args: SearchOptions & { jsonOnly: boolean } = { query: "", jsonOnly: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; const next = argv[i + 1];
    switch (a) {
      case "--type": if (!next) throw new CLIError("--type requires value", 1); args.type = next as SearchType; i++; break;
      case "--count": if (!next) throw new CLIError("--count requires value", 1); args.count = parseInt(next, 10); i++; break;
      case "--freshness": if (!next) throw new CLIError("--freshness requires value", 1); args.freshness = next as Freshness; i++; break;
      case "--extra-snippets": args.extraSnippets = true; break;
      case "--country": if (!next) throw new CLIError("--country requires value", 1); args.country = next; i++; break;
      case "--json-only": args.jsonOnly = true; break;
      case "--help": case "-h":
        console.log(`brave-search - Brave Web + News Search

Usage: bun BraveSearch.ts [options] "<query>"

Options:
  --type web|news       Search type (default: web)
  --count <n>           Results per page (max 20)
  --freshness pd|pw|pm|py  Filter by recency (day/week/month/year)
  --extra-snippets      Include additional excerpts per result
  --country <code>      2-char country code
  --json-only           Suppress status lines
  --help                This message

Env:
  STUDIO_API_URL        Studio gateway origin (required)
  STUDIO_API_KEY        bearer token for Studio (required)
`);
        process.exit(0);
      default: if (a?.startsWith("--")) throw new CLIError(`Unknown flag: ${a}`, 1); if (a) positional.push(a);
    }
  }
  if (positional.length === 0) throw new CLIError("No query provided.", 1);
  args.query = positional.join(" ");
  return args;
}

async function main(): Promise<void> {
  let args: ReturnType<typeof parseArgs>;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) {
    if (error instanceof CLIError) { console.error(`Error: ${error.message}`); process.exit(error.exitCode); }
    throw error;
  }
  if (!args.jsonOnly) console.error(`🔎 Brave ${args.type ?? "web"} search: "${args.query}"...`);
  try {
    const result = await braveSearch(args);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!args.jsonOnly) {
      console.error(`✅ ${result.totalResults} results for "${result.query}"`);
    }
  } catch (error) {
    if (error instanceof CLIError) { console.error(`❌ ${error.message}`); process.exit(error.exitCode); }
    console.error(`❌ ${error instanceof Error ? error.message : error}`);
    process.exit(3);
  }
}

if (import.meta.main) main().catch((err) => { console.error(err); process.exit(3); });
