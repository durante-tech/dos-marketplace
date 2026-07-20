/**
 * Anthropic Gateway Shim — Studio/BYOK branch for Anthropic Messages API
 *
 * TWO MODES:
 *   Studio (STUDIO_API_URL + STUDIO_API_KEY set):
 *     Routes through /api/v1/inference/anthropic/messages. Studio meters
 *     credits via pooled STUDIO_POOL_ANTHROPIC_API_KEY.
 *
 *   BYOK (fallback):
 *     Calls api.anthropic.com/v1/messages directly with ANTHROPIC_API_KEY
 *     from ~/.claude/.env. No metering.
 *
 * This file has ZERO provider SDK imports — only uses fetch + shared
 * utilities from gateway-shared.ts. Safe to import from any Pack.
 */

import { randomUUID } from "node:crypto";
import { loadEnv } from "./env.ts";
import {
  GatewayError,
  mapStudioError,
  parseStudioErrorBody,
} from "./gateway-shared.ts";

export { GatewayError };

const STUDIO_ROUTE = "/api/v1/inference/anthropic/messages";

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicRequestOptions {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface AnthropicResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
  mode: "studio";
  /** Only set in studio mode. */
  chargedCredits?: number;
  /** Only set in studio mode. */
  actualCostCents?: number;
}

/**
 * Send a message to Anthropic's Messages API via Studio gateway.
 */
export async function anthropicMessages(
  options: AnthropicRequestOptions,
): Promise<AnthropicResponse> {
  await loadEnv();

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_ORG_API_KEY ?? process.env.STUDIO_API_KEY ?? null;

  if (!studioUrl || !studioKey) {
    throw new GatewayError("unauthorized", 401, "Studio gateway not configured. Run: durante configure");
  }
  return callViaGateway(options, studioUrl, studioKey);
}

// ──────────────────────────────────────────────────────────────────────
// Gateway path
// ──────────────────────────────────────────────────────────────────────

async function callViaGateway(
  options: AnthropicRequestOptions,
  studioUrl: string,
  studioKey: string,
): Promise<AnthropicResponse> {
  const cleanOrigin = studioUrl.replace(/\/+$/, "");
  const endpoint = `${cleanOrigin}${STUDIO_ROUTE}`;

  const body: Record<string, unknown> = {
    modelId: options.model,
    messages: options.messages,
  };
  if (options.system !== undefined) body.system = options.system;
  if (options.maxTokens !== undefined) body.maxTokens = options.maxTokens;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.topP !== undefined) body.topP = options.topP;
  if (options.topK !== undefined) body.topK = options.topK;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studioKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const errBody = parseStudioErrorBody(errText);
    throw mapStudioError(response.status, errBody);
  }

  const payload = (await response.json()) as {
    content: string;
    chargedCredits: number;
    actualCostCents: number;
    usage: { inputTokens: number; outputTokens: number };
    stopReason: string | null;
  };

  return {
    content: payload.content,
    inputTokens: payload.usage?.inputTokens ?? 0,
    outputTokens: payload.usage?.outputTokens ?? 0,
    stopReason: payload.stopReason ?? null,
    mode: "studio",
    chargedCredits: payload.chargedCredits,
    actualCostCents: payload.actualCostCents,
  };
}

