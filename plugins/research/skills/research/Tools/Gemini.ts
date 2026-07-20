#!/usr/bin/env bun
/**
 * gemini - Google Gemini API research tool
 *
 * DOS Research Pack tool for text generation + web-grounded research
 * via Google's Gemini API. Google Search grounding is enabled by default,
 * returning cited web sources alongside the model's answer.
 *
 * ROUTING
 * -------
 *   All requests route through the Studio gateway
 *   (/api/v1/inference/google/messages). Studio holds the Google pool key
 *   server-side, meters credits, and returns the authoritative cost.
 *   STUDIO_API_URL + STUDIO_API_KEY must be set; if either is missing the
 *   tool exits with "Studio gateway not configured" (no direct-API path).
 *
 * USAGE
 * -----
 *   bun Gemini.ts "What are the latest developments in quantum computing?"
 *   bun Gemini.ts --model <id> --max-tokens 2048 "query"   # --help lists ids
 *   bun Gemini.ts --no-grounding "query"  # disable web search
 *   bun Gemini.ts --system "You are a fact-checker..." "query"
 *   bun Gemini.ts --thinking high "complex analysis query"
 *
 * OUTPUT (stdout, always JSON)
 * ----------------------------
 *   {
 *     "content": "Based on current research...",
 *     "groundingChunks": [{ "uri": "https://...", "title": "..." }],
 *     "usage": { "promptTokens": 123, "completionTokens": 456 },
 *     "mode": "studio",
 *     "chargedCredits": 42,
 *     "actualCostCents": 1
 *   }
 *
 * @see Packs/research/src/SKILL.md
 */

import { randomUUID } from "node:crypto";
import { loadEnv } from '../Lib/env';
import { GEMINI_MODELS, GEMINI_DEFAULT_MODEL, type GeminiModel } from "./model-pins";

// ──────────────────────────────────────────────────────────────────────
// Inlined env loader (same as Perplexity.ts — extract to Lib/env.ts
// when the third Research tool ships, per "no factory before Route #3")
// ──────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

type Model = GeminiModel;
const VALID_MODELS = GEMINI_MODELS;
type ThinkingLevel = "low" | "medium" | "high";

export interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface QueryOptions {
  query: string;
  systemPrompt?: string;
  model?: Model;
  maxTokens?: number;
  temperature?: number;
  enableGrounding?: boolean;
  thinkingLevel?: ThinkingLevel;
}

export interface GroundingChunk {
  uri: string;
  title: string;
}

export interface QueryResult {
  content: string;
  groundingChunks: GroundingChunk[];
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
  "You are a multi-perspective research analyst. Answer with cross-domain " +
  "connections and synthesize information from diverse sources. When Google " +
  "Search grounding is active, cite the grounded sources inline.";

const STUDIO_ROUTE = "/api/v1/inference/google/messages";

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
// Core entry point
// ──────────────────────────────────────────────────────────────────────

export async function queryGemini(options: QueryOptions): Promise<QueryResult> {
  await loadEnv();

  const model = options.model ?? GEMINI_DEFAULT_MODEL;
  if (!VALID_MODELS.includes(model)) {
    throw new CLIError(`Invalid model: ${model}. Valid: ${VALID_MODELS.join(", ")}`, 2);
  }

  const contents: GeminiContent[] = [
    { role: "user", parts: [{ text: options.query }] },
  ];

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_API_KEY ?? null;

  if (!studioUrl || !studioKey) {
    throw new CLIError("Studio gateway not configured. Run: durante configure", 2);
  }
  return queryViaGateway(model, contents, options, studioUrl, studioKey);
}

// ──────────────────────────────────────────────────────────────────────
// Gateway path
// ──────────────────────────────────────────────────────────────────────

async function queryViaGateway(
  model: Model,
  contents: GeminiContent[],
  options: QueryOptions,
  studioUrl: string,
  studioKey: string,
): Promise<QueryResult> {
  const cleanOrigin = studioUrl.replace(/\/+$/, "");

  const body: Record<string, unknown> = {
    modelId: model,
    contents,
  };
  if (options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT) {
    body.systemInstruction = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }
  if (options.maxTokens !== undefined) body.maxOutputTokens = options.maxTokens;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.enableGrounding !== undefined) body.enableGrounding = options.enableGrounding;
  if (options.thinkingLevel !== undefined) body.thinkingLevel = options.thinkingLevel;

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
    groundingChunks: GroundingChunk[];
    chargedCredits: number;
    actualCostCents: number;
    usage: { promptTokens: number; completionTokens: number };
  };

  return {
    content: payload.content ?? "",
    groundingChunks: payload.groundingChunks ?? [],
    // RSCH-05: a 200 without `usage` must not crash the status-line path.
    usage: payload.usage ?? { promptTokens: 0, completionTokens: 0 },
    mode: "studio",
    chargedCredits: payload.chargedCredits,
    actualCostCents: payload.actualCostCents,
  };
}

// ──────────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────────

interface CLIArgs extends QueryOptions {
  jsonOnly: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = { query: "", jsonOnly: false, enableGrounding: true };
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
        i++;
        break;
      case "--temperature":
        if (!next) throw new CLIError("--temperature requires a value", 1);
        args.temperature = parseFloat(next);
        i++;
        break;
      case "--system":
        if (!next) throw new CLIError("--system requires a value", 1);
        args.systemPrompt = next;
        i++;
        break;
      case "--no-grounding":
        args.enableGrounding = false;
        break;
      case "--thinking":
        if (!next) throw new CLIError("--thinking requires a value", 1);
        args.thinkingLevel = next as ThinkingLevel;
        i++;
        break;
      case "--json-only":
        args.jsonOnly = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        if (a?.startsWith("--")) throw new CLIError(`Unknown flag: ${a}`, 1);
        if (a) positional.push(a);
    }
  }

  if (positional.length === 0) {
    throw new CLIError("No query provided.", 1);
  }
  args.query = positional.join(" ");
  return args;
}

function printHelp(): void {
  console.log(`gemini - Google Gemini research tool

Usage:
  bun Gemini.ts [options] "<query>"

Options:
  --model <id>           ${GEMINI_MODELS.join(" | ")}
  --max-tokens <n>       max output tokens (default: 1024)
  --temperature <n>      0.0-2.0
  --system <text>        system prompt
  --no-grounding         disable Google Search grounding
  --thinking <level>     low | medium | high (extended reasoning)
  --json-only            suppress status lines; only JSON to stdout
  --help                 this message

Env:
  STUDIO_API_URL         Studio gateway origin (required)
  STUDIO_API_KEY         bearer token for Studio (required)
`);
}

async function main(): Promise<void> {
  let args: CLIArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CLIError) {
      console.error(`Error: ${error.message}`);
      process.exit(error.exitCode);
    }
    throw error;
  }

  if (!args.jsonOnly) {
    console.error(`🔎 Querying Gemini (model: ${args.model ?? GEMINI_DEFAULT_MODEL})...`);
  }

  try {
    const result = await queryGemini(args);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");

    if (!args.jsonOnly) {
      const mode = result.mode === "studio" ? "via Studio" : "via BYOK";
      const charge =
        result.mode === "studio" && result.chargedCredits !== undefined
          ? ` — ${result.chargedCredits} credits ${mode}`
          : ` — ${mode}`;
      console.error(
        `✅ ${result.groundingChunks.length} grounded sources, ${result.usage.promptTokens}+${result.usage.completionTokens} tokens${charge}`,
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
