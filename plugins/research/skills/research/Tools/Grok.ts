#!/usr/bin/env bun
/**
 * grok - xAI Grok API research tool
 *
 * DOS Research Pack tool for text generation + web-grounded research
 * via xAI's Grok API. Live web search with citations enabled by default.
 * Supports reasoning models that expose chain-of-thought via
 * reasoning_content in the response.
 *
 * ROUTING
 * -------
 *   All requests route through the Studio gateway
 *   (/api/v1/inference/xai/messages). Studio holds the xAI pool key
 *   server-side, meters credits, and returns the authoritative cost.
 *   STUDIO_API_URL + STUDIO_API_KEY must be set; if either is missing the
 *   tool exits with "Studio gateway not configured" (no direct-API path).
 *
 * USAGE
 * -----
 *   bun Grok.ts "What are the latest AI policy developments?"
 *   bun Grok.ts --model <id> "quick lookup"   # --help lists ids
 *   bun Grok.ts --no-search "pure LLM query without web search"
 *   bun Grok.ts --json-only "query"
 *
 * @see Packs/research/src/SKILL.md
 */

import { randomUUID } from "node:crypto";
import { loadEnv } from '../Lib/env';
import { GROK_MODELS, GROK_DEFAULT_MODEL, type GrokModel } from "./model-pins";


type Model = GrokModel;
const VALID_MODELS = GROK_MODELS;

export interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QueryOptions {
  query: string;
  systemPrompt?: string;
  model?: Model;
  maxTokens?: number;
  temperature?: number;
  /** Enable live web search via xAI tools API. Default true. */
  enableSearch?: boolean;
}

export interface GrokCitation {
  url: string;
  title?: string;
}

export interface QueryResult {
  content: string;
  citations: GrokCitation[];
  reasoningContent?: string;
  usage: { promptTokens: number; completionTokens: number };
  mode: "studio" | "byok";
  chargedCredits?: number;
  actualCostCents?: number;
}

class CLIError extends Error {
  constructor(message: string, public readonly exitCode: number = 1) {
    super(message);
    this.name = "CLIError";
  }
}

const DEFAULT_SYSTEM_PROMPT =
  "You are a contrarian, fact-based research analyst. Focus on unbiased analysis, " +
  "long-term truth over short-term trends. When web search is active, cite your " +
  "sources. Flag where mainstream consensus may be wrong and why.";

const STUDIO_ROUTE = "/api/v1/inference/xai/messages";

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

export async function queryGrok(options: QueryOptions): Promise<QueryResult> {
  loadEnv();

  const model = options.model ?? GROK_DEFAULT_MODEL;
  if (!VALID_MODELS.includes(model)) {
    throw new CLIError(`Invalid model: ${model}. Valid: ${VALID_MODELS.join(", ")}`, 2);
  }

  const messages: GrokMessage[] = [];
  messages.push({ role: "system", content: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT });
  messages.push({ role: "user", content: options.query });

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_API_KEY ?? null;

  if (!studioUrl || !studioKey) {
    throw new CLIError("Studio gateway not configured. Run: durante configure", 2);
  }
  return queryViaGateway(model, messages, options, studioUrl, studioKey);
}

async function queryViaGateway(
  model: Model, messages: GrokMessage[], options: QueryOptions,
  studioUrl: string, studioKey: string,
): Promise<QueryResult> {
  const cleanOrigin = studioUrl.replace(/\/+$/, "");
  const body: Record<string, unknown> = { modelId: model, messages };
  if (options.maxTokens !== undefined) body.maxTokens = options.maxTokens;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.enableSearch !== undefined) body.enableSearch = options.enableSearch;

  const timeoutMs = resolveGatewayTimeoutMs();
  let response: Response;
  try {
    response = await fetch(`${cleanOrigin}${STUDIO_ROUTE}`, {
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
    if (response.status === 503) throw new CLIError(`Studio disabled: ${message}`, 3);
    if (response.status === 400) throw new CLIError(`Invalid request: ${message}`, 1);
    throw new CLIError(`Studio gateway ${response.status}: ${message}`, 3);
  }

  const payload = (await response.json()) as {
    content: string;
    citations: GrokCitation[];
    reasoningContent?: string;
    chargedCredits: number;
    actualCostCents: number;
    usage: { promptTokens: number; completionTokens: number };
  };

  return {
    content: payload.content ?? "",
    citations: payload.citations ?? [],
    reasoningContent: payload.reasoningContent,
    // RSCH-05: a 200 without `usage` must not crash the status-line path.
    usage: payload.usage ?? { promptTokens: 0, completionTokens: 0 },
    mode: "studio",
    chargedCredits: payload.chargedCredits,
    actualCostCents: payload.actualCostCents,
  };
}

// CLI
interface CLIArgs extends QueryOptions { jsonOnly: boolean }

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = { query: "", jsonOnly: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; const next = argv[i + 1];
    switch (a) {
      case "--model": if (!next) throw new CLIError("--model requires value", 1); args.model = next as Model; i++; break;
      case "--max-tokens": if (!next) throw new CLIError("--max-tokens requires value", 1); args.maxTokens = parseInt(next, 10); i++; break;
      case "--temperature": if (!next) throw new CLIError("--temperature requires value", 1); args.temperature = parseFloat(next); i++; break;
      case "--system": if (!next) throw new CLIError("--system requires value", 1); args.systemPrompt = next; i++; break;
      case "--no-search": args.enableSearch = false; break;
      case "--json-only": args.jsonOnly = true; break;
      case "--help": case "-h": printHelp(); process.exit(0);
      default: if (a?.startsWith("--")) throw new CLIError(`Unknown flag: ${a}`, 1); if (a) positional.push(a);
    }
  }
  if (positional.length === 0) throw new CLIError("No query provided.", 1);
  args.query = positional.join(" ");
  return args;
}

function printHelp(): void {
  console.log(`grok - xAI Grok research tool

Usage:
  bun Grok.ts [options] "<query>"

Options:
  --model <id>        ${GROK_MODELS.join(" | ")} (default: ${GROK_DEFAULT_MODEL})
  --max-tokens <n>    max output tokens (default: 1024)
  --temperature <n>   0.0-2.0
  --system <text>     system prompt
  --no-search         disable web search (default: search enabled)
  --json-only         suppress status lines; only JSON to stdout
  --help              this message

Env:
  STUDIO_API_URL      Studio gateway origin (required)
  STUDIO_API_KEY      bearer token for Studio (required)
`);
}

async function main(): Promise<void> {
  let args: CLIArgs;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) {
    if (error instanceof CLIError) { console.error(`Error: ${error.message}`); process.exit(error.exitCode); }
    throw error;
  }
  if (!args.jsonOnly) console.error(`🔎 Querying Grok (model: ${args.model ?? GROK_DEFAULT_MODEL})...`);
  try {
    const result = await queryGrok(args);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!args.jsonOnly) {
      const mode = result.mode === "studio" ? "via Studio" : "via BYOK";
      const charge = result.mode === "studio" && result.chargedCredits !== undefined
        ? ` — ${result.chargedCredits} credits ${mode}` : ` — ${mode}`;
      console.error(`✅ ${result.citations.length} citations, ${result.usage.promptTokens}+${result.usage.completionTokens} tokens${charge}`);
    }
  } catch (error) {
    if (error instanceof CLIError) { console.error(`❌ ${error.message}`); process.exit(error.exitCode); }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Unexpected error: ${message}`);
    process.exit(3);
  }
}

if (import.meta.main) main().catch((err) => { console.error(err); process.exit(3); });
