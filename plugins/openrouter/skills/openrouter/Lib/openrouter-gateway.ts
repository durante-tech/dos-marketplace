/**
 * OpenRouter Gateway Client — DOS Pack side
 *
 * Thin client that routes all traffic through Studio's gateway:
 *   POST {STUDIO_API_URL}/api/v1/inference/openrouter/chat/completions
 *   GET  {STUDIO_API_URL}/api/v1/inference/openrouter/models
 *
 * NO BYOK FALLBACK — by PRD D1 + ISC-A1. The Pack never holds an
 * OpenRouter API key. Studio's pool key (STUDIO_POOL_OPENROUTER_API_KEY)
 * is server-side only, so all inference is credit-metered through
 * Studio's double-entry ledger.
 *
 * Mirrors the Studio route's request surface 1:1 — additions to the
 * passthrough field set need to be mirrored in both places. See
 * Platform/studio/apps/web/lib/gateway/openrouter-worker.ts for the
 * canonical type definitions; the client redeclares them here so the
 * Pack stays standalone without importing Studio types.
 */

import { requireStudioApiUrl, requireStudioEnv } from "./env.ts";

// ──────────────────────────────────────────────────────────────────────
// Request / response types — mirror studio/openrouter-worker.ts
// ──────────────────────────────────────────────────────────────────────

export type OpenRouterRole = "system" | "user" | "assistant" | "tool";

export interface OpenRouterTextPart {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export interface OpenRouterImagePart {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
}

export interface OpenRouterFilePart {
  type: "file";
  file: { filename?: string; file_data: string };
}

export type OpenRouterContentPart =
  | OpenRouterTextPart
  | OpenRouterImagePart
  | OpenRouterFilePart;

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string | OpenRouterContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface OpenRouterToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface OpenRouterReasoningConfig {
  effort?: "xhigh" | "high" | "medium" | "low" | "minimal" | "none";
  max_tokens?: number;
  exclude?: boolean;
  enabled?: boolean;
}

export interface OpenRouterProviderConfig {
  order?: string[];
  allow_fallbacks?: boolean;
  require_parameters?: boolean;
  data_collection?: "allow" | "deny";
  zdr?: boolean;
  enforce_distillable_text?: boolean;
  only?: string[];
  ignore?: string[];
  quantizations?: string[];
  sort?: string;
  max_price?: { prompt?: number; completion?: number };
}

export interface ChatCompletionsRequest {
  modelId: string;
  messages: OpenRouterMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stop?: string | string[];
  seed?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  logitBias?: Record<string, number>;
  topLogprobs?: number;
  minP?: number;
  topA?: number;
  user?: string;
  prediction?: { type: "content"; content: string };
  tools?: OpenRouterToolDefinition[];
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; function: { name: string } };
  responseFormat?:
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: Record<string, unknown> };
  reasoning?: OpenRouterReasoningConfig;
  provider?: OpenRouterProviderConfig;
  models?: string[];
  route?: "fallback";
  cacheControl?: { type: "ephemeral"; ttl?: "5m" | "1h" };
  transforms?: string[];
  plugins?: Record<string, unknown>[];
}

export interface ChatCompletionsSuccess {
  generationId: string;
  status: "succeeded";
  model: string;
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  reasoning?: string;
  chargedCredits: number;
  actualCostCents: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    reasoningTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  provider: string | null;
  finishReason: string | null;
  output: string;
  cacheHit: boolean;
}

export interface ModelsCatalogue {
  data: OpenRouterModel[];
  cachedAt: string;
  upstreamModelCount: number;
  stale?: boolean;
  upstreamError?: string;
}

export interface OpenRouterModel {
  id: string;
  canonical_slug?: string;
  name: string;
  created?: number;
  description?: string;
  context_length: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    request?: string;
    image?: string;
    audio?: string;
    web_search?: string;
    internal_reasoning?: string;
    input_cache_read?: string;
    input_cache_write?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  supported_parameters?: string[];
  default_parameters?: Record<string, unknown> | null;
  expiration_date?: string | null;
}

// ──────────────────────────────────────────────────────────────────────
// Error
// ──────────────────────────────────────────────────────────────────────

export class OpenRouterGatewayError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    public readonly body: unknown = null,
  ) {
    super(message);
    this.name = "OpenRouterGatewayError";
  }
}

// ──────────────────────────────────────────────────────────────────────
// Chat completions
// ──────────────────────────────────────────────────────────────────────

export interface ChatCallOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function chatCompletions(
  request: ChatCompletionsRequest,
  options: ChatCallOptions = {},
): Promise<ChatCompletionsSuccess> {
  const { apiUrl, apiKey } = requireStudioEnv();
  const url = `${apiUrl}/api/v1/inference/openrouter/chat/completions`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new OpenRouterGatewayError(
      503,
      "network_error",
      `Network error contacting Studio gateway: ${message}`,
    );
  }

  const rawText = await response.text();
  let body: unknown = null;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    body = rawText;
  }

  if (!response.ok) {
    const errorCode =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error?: unknown }).error ?? "http_error")
        : "http_error");
    const message =
      (body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message ?? response.statusText)
        : response.statusText) ||
      `HTTP ${response.status}`;
    throw new OpenRouterGatewayError(
      response.status,
      errorCode,
      message,
      body,
    );
  }

  return body as ChatCompletionsSuccess;
}

// ──────────────────────────────────────────────────────────────────────
// Models catalogue
// ──────────────────────────────────────────────────────────────────────

export async function listModels(
  options: { signal?: AbortSignal } = {},
): Promise<ModelsCatalogue> {
  const apiUrl = requireStudioApiUrl();
  const url = `${apiUrl}/api/v1/inference/openrouter/models`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: options.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new OpenRouterGatewayError(
      503,
      "network_error",
      `Network error contacting Studio gateway: ${message}`,
    );
  }

  const rawText = await response.text();
  let body: unknown = null;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    body = rawText;
  }

  if (!response.ok) {
    throw new OpenRouterGatewayError(
      response.status,
      "http_error",
      `Model catalogue fetch failed: HTTP ${response.status}`,
      body,
    );
  }

  return body as ModelsCatalogue;
}
