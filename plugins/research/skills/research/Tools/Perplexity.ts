#!/usr/bin/env bun
/**
 * perplexity - Perplexity Sonar API research tool
 *
 * DOS Research Pack tool for real-time web research via Perplexity's
 * Sonar models. Drop-in replacement for the ad-hoc WebSearch + fetch
 * pattern the researcher subagents use today — returns citations + search
 * results the subagent can cite directly in its output.
 *
 * ROUTING
 * -------
 *   All requests route through the Studio gateway
 *   (/api/v1/inference/perplexity/messages). Studio holds the Perplexity
 *   pool key server-side, meters credits, and returns the authoritative
 *   cost. STUDIO_API_URL + STUDIO_API_KEY must be set; if either is missing
 *   the tool exits with "Studio gateway not configured" (no direct-API path).
 *
 * USAGE
 * -----
 *   bun Perplexity.ts "What are the latest GPT-5 benchmarks?"
 *   bun Perplexity.ts --model <id> --max-tokens 2048 "query"   # --help lists ids
 *   bun Perplexity.ts --search-mode academic --recency week "query"
 *   bun Perplexity.ts --system "You are a fact-checker..." "query"
 *   bun Perplexity.ts --json-only "query"   # stdout only, no status messages
 *
 * OPTIONS
 * -------
 *   --model <id>           model id (run --help for the current list)
 *   --max-tokens <n>       max completion tokens (default: 1024)
 *   --temperature <n>      0.0–2.0 (default: provider default)
 *   --system <text>        system prompt (default: research-mode preamble)
 *   --search-mode <mode>   web | academic | sec
 *   --recency <period>     hour | day | week | month | year
 *   --disable-search       pure LLM mode, no web search
 *   --reasoning <level>    minimal | low | medium | high (reasoning-pro models only)
 *   --related              return related follow-up questions
 *   --json-only            suppress status lines on stderr; only the JSON result goes to stdout
 *
 * OUTPUT (stdout, always JSON)
 * ----------------------------
 *   {
 *     "content": "Based on current sources...",
 *     "citations": ["https://...", ...],
 *     "searchResults": [{ title, url, snippet, date }, ...],
 *     "relatedQuestions": ["..."],   // optional
 *     "usage": { "promptTokens": 123, "completionTokens": 456 },
 *     "mode": "studio",
 *     "chargedCredits": 42,
 *     "actualCostCents": 3
 *   }
 *
 * EXIT CODES
 * ----------
 *   0  success
 *   1  CLI usage error (missing args, bad flag)
 *   2  configuration error (missing env, invalid model)
 *   3  provider error (Perplexity API failure, insufficient credits)
 *
 * @see Packs/research/src/SKILL.md
 */

import { randomUUID } from "node:crypto";
import { loadEnv } from '../Lib/env';
import { PERPLEXITY_MODELS, PERPLEXITY_DEFAULT_MODEL, type PerplexityModel } from "./model-pins";

// ──────────────────────────────────────────────────────────────────────
// Inlined env loader (duplicated from Packs/media/src/Lib/env.ts to keep
// the research pack independent of Media; extract to a shared Lib/env.ts
// when route #3 in the research pack ships — Marcus's "no factory before
// Route #3" rule applies).
// ──────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

type Model = PerplexityModel;

const VALID_MODELS = PERPLEXITY_MODELS;

type SearchMode = "web" | "academic" | "sec";
type Recency = "hour" | "day" | "week" | "month" | "year";
type Reasoning = "minimal" | "low" | "medium" | "high";

export interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QueryOptions {
  query: string;
  systemPrompt?: string;
  model?: Model;
  maxTokens?: number;
  temperature?: number;
  searchMode?: SearchMode;
  recency?: Recency;
  disableSearch?: boolean;
  reasoning?: Reasoning;
  returnRelatedQuestions?: boolean;
}

export interface QueryResult {
  content: string;
  citations: string[];
  searchResults: Array<{
    title: string;
    url: string;
    snippet?: string;
    date?: string | null;
    lastUpdated?: string | null;
    source?: "web" | "attachment";
  }>;
  relatedQuestions?: string[];
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  mode: "studio" | "byok";
  /** Only set in studio mode. */
  chargedCredits?: number;
  /** Only set in studio mode. */
  actualCostCents?: number;
}

// ──────────────────────────────────────────────────────────────────────
// CLI helpers
// ──────────────────────────────────────────────────────────────────────

class CLIError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "CLIError";
  }
}

const DEFAULT_SYSTEM_PROMPT =
  "You are an investigative research assistant. Answer the user's question " +
  "using current web sources. Cite every factual claim inline. Favor primary " +
  "sources over aggregators. When sources conflict, flag the disagreement.";

const STUDIO_ROUTE = "/api/v1/inference/perplexity/messages";

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

// ──────────────────────────────────────────────────────────────────────
// Core entry point — programmatic + CLI both call this
// ──────────────────────────────────────────────────────────────────────

export async function queryPerplexity(
  options: QueryOptions,
): Promise<QueryResult> {
  await loadEnv();

  const model = options.model ?? PERPLEXITY_DEFAULT_MODEL;
  if (!VALID_MODELS.includes(model)) {
    throw new CLIError(
      `Invalid model: ${model}. Valid: ${VALID_MODELS.join(", ")}`,
      2,
    );
  }

  const messages: PerplexityMessage[] = [];
  messages.push({
    role: "system",
    content: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
  });
  messages.push({ role: "user", content: options.query });

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_API_KEY ?? null;

  if (!studioUrl || !studioKey) {
    throw new CLIError("Studio gateway not configured. Run: durante configure", 2);
  }
  return queryViaGateway(model, messages, options, studioUrl, studioKey);
}

// ──────────────────────────────────────────────────────────────────────
// Gateway path
// ──────────────────────────────────────────────────────────────────────

async function queryViaGateway(
  model: Model,
  messages: PerplexityMessage[],
  options: QueryOptions,
  studioUrl: string,
  studioKey: string,
): Promise<QueryResult> {
  const cleanOrigin = studioUrl.replace(/\/+$/, "");
  const endpoint = `${cleanOrigin}${STUDIO_ROUTE}`;

  const body: Record<string, unknown> = {
    modelId: model,
    messages,
  };
  if (options.maxTokens !== undefined) body.maxTokens = options.maxTokens;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.searchMode !== undefined) body.searchMode = options.searchMode;
  if (options.recency !== undefined) body.searchRecencyFilter = options.recency;
  if (options.disableSearch !== undefined) body.disableSearch = options.disableSearch;
  if (options.reasoning !== undefined) body.reasoningEffort = options.reasoning;
  if (options.returnRelatedQuestions !== undefined) {
    body.returnRelatedQuestions = options.returnRelatedQuestions;
  }

  const timeoutMs = resolveGatewayTimeoutMs();
  let response: Response;
  try {
    response = await fetch(endpoint, {
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
    // Defensive error-body parse — Studio errors are usually JSON with
    // { error, message, ... } but we've seen `null` bodies on some error
    // paths (response.json() resolves to null, doesn't reject, so
    // `.catch(() => ({}))` doesn't help). Read as text first, attempt
    // JSON parse, coerce to object, fall back to raw text as the message.
    const errText = await response.text().catch(() => "");
    let errBody: Record<string, unknown> = {};
    if (errText) {
      try {
        const parsed = JSON.parse(errText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          errBody = parsed as Record<string, unknown>;
        }
      } catch {
        // non-JSON body — keep errBody empty, fall through to errText
      }
    }
    const message =
      (errBody.message as string | undefined) ??
      (errText || `Studio gateway ${response.status}`);

    if (response.status === 402) {
      throw new CLIError(
        `Insufficient Studio credits: ${message}${
          errBody.needed != null && errBody.balance != null
            ? ` (need ${errBody.needed}, have ${errBody.balance})`
            : ""
        }`,
        3,
      );
    }
    if (response.status === 401) {
      throw new CLIError(
        `Invalid STUDIO_API_KEY: ${message}`,
        2,
      );
    }
    if (response.status === 503) {
      throw new CLIError(
        `Studio gateway temporarily disabled: ${message}`,
        3,
      );
    }
    if (response.status === 400) {
      throw new CLIError(
        `Invalid request: ${message}`,
        1,
      );
    }
    throw new CLIError(
      `Studio gateway error ${response.status}: ${message}`,
      3,
    );
  }

  const payload = (await response.json()) as {
    content: string;
    citations: string[];
    searchResults: Array<{
      title: string;
      url: string;
      snippet?: string;
      date?: string | null;
      lastUpdated?: string | null;
      source?: "web" | "attachment";
    }>;
    relatedQuestions?: string[];
    chargedCredits: number;
    actualCostCents: number;
    usage: { promptTokens: number; completionTokens: number };
  };

  return {
    content: payload.content ?? "",
    citations: payload.citations ?? [],
    searchResults: payload.searchResults ?? [],
    relatedQuestions: payload.relatedQuestions,
    // RSCH-05: a 200 without `usage` must not crash the status-line path.
    usage: payload.usage ?? { promptTokens: 0, completionTokens: 0 },
    mode: "studio",
    chargedCredits: payload.chargedCredits,
    actualCostCents: payload.actualCostCents,
  };
}

// ──────────────────────────────────────────────────────────────────────
// CLI argument parser
// ──────────────────────────────────────────────────────────────────────

interface CLIArgs extends QueryOptions {
  jsonOnly: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    query: "",
    jsonOnly: false,
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--model":
        if (!next) throw new CLIError("--model requires a value", 1);
        args.model = next as Model;
        i++;
        break;
      case "--max-tokens":
        if (!next) throw new CLIError("--max-tokens requires a value", 1);
        args.maxTokens = parseInt(next, 10);
        if (Number.isNaN(args.maxTokens)) {
          throw new CLIError(`Invalid --max-tokens: ${next}`, 1);
        }
        i++;
        break;
      case "--temperature":
        if (!next) throw new CLIError("--temperature requires a value", 1);
        args.temperature = parseFloat(next);
        if (Number.isNaN(args.temperature)) {
          throw new CLIError(`Invalid --temperature: ${next}`, 1);
        }
        i++;
        break;
      case "--system":
        if (!next) throw new CLIError("--system requires a value", 1);
        args.systemPrompt = next;
        i++;
        break;
      case "--search-mode":
        if (!next) throw new CLIError("--search-mode requires a value", 1);
        args.searchMode = next as SearchMode;
        i++;
        break;
      case "--recency":
        if (!next) throw new CLIError("--recency requires a value", 1);
        args.recency = next as Recency;
        i++;
        break;
      case "--disable-search":
        args.disableSearch = true;
        break;
      case "--reasoning":
        if (!next) throw new CLIError("--reasoning requires a value", 1);
        args.reasoning = next as Reasoning;
        i++;
        break;
      case "--related":
        args.returnRelatedQuestions = true;
        break;
      case "--json-only":
        args.jsonOnly = true;
        break;
      case "--help":
      case "-h":
        throw new CLIError("__HELP__", 0);
      default:
        if (a?.startsWith("--")) {
          throw new CLIError(`Unknown flag: ${a}`, 1);
        }
        if (a) positional.push(a);
    }
  }

  if (positional.length === 0) {
    throw new CLIError("No query provided. Pass the query as the last positional argument.", 1);
  }
  args.query = positional.join(" ");
  return args;
}

function printHelp(): void {
  console.log(`perplexity - Perplexity Sonar research tool

Usage:
  bun Perplexity.ts [options] "<query>"

Options:
  --model <id>           ${PERPLEXITY_MODELS.join(" | ")} (default: ${PERPLEXITY_DEFAULT_MODEL})
  --max-tokens <n>       max completion tokens (default: 1024)
  --temperature <n>      0.0-2.0
  --system <text>        system prompt (default: research assistant preamble)
  --search-mode <mode>   web | academic | sec
  --recency <period>     hour | day | week | month | year
  --disable-search       pure LLM mode, no web search
  --reasoning <level>    minimal | low | medium | high (reasoning-pro only)
  --related              include related follow-up questions
  --json-only            suppress status lines; only JSON to stdout
  --help                 this message

Env:
  STUDIO_API_URL         Studio gateway origin (required)
  STUDIO_API_KEY         bearer token for Studio (required)

Examples:
  bun Perplexity.ts "What are the latest GPT-5 benchmarks?"
  bun Perplexity.ts --model <id> --recency week "news about AI regulation"
  bun Perplexity.ts --search-mode academic --max-tokens 2048 "renewable grid storage research"
`);
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let args: CLIArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CLIError && error.message === "__HELP__") {
      printHelp();
      process.exit(0);
    }
    if (error instanceof CLIError) {
      console.error(`Error: ${error.message}`);
      process.exit(error.exitCode);
    }
    throw error;
  }

  if (!args.jsonOnly) {
    console.error(`🔎 Querying Perplexity (model: ${args.model ?? PERPLEXITY_DEFAULT_MODEL})...`);
  }

  try {
    const result = await queryPerplexity(args);

    // JSON result always goes to stdout so shell consumers can pipe.
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");

    if (!args.jsonOnly) {
      const mode = result.mode === "studio" ? "via Studio" : "via BYOK";
      const charge =
        result.mode === "studio" && result.chargedCredits !== undefined
          ? ` — ${result.chargedCredits} credits ${mode}`
          : ` — ${mode}`;
      console.error(
        `✅ ${result.citations.length} citations, ${result.usage.promptTokens}+${result.usage.completionTokens} tokens${charge}`,
      );
    }
  } catch (error) {
    if (error instanceof CLIError) {
      console.error(`❌ ${error.message}`);
      process.exit(error.exitCode);
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Unexpected error: ${message}`);
    process.exit(3);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(3);
  });
}
