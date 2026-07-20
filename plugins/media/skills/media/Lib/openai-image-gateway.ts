/**
 * OpenAI Image Gateway Shim — Phase 3
 *
 * Drop-in replacement for direct OpenAI Images API calls from DOS pack
 * tools. Detects STUDIO_API_URL + STUDIO_API_KEY via loadEnv() and
 * routes through the Studio gateway (`/api/v1/media/openai/images`)
 * when both are set. Otherwise falls back to calling api.openai.com
 * directly using OPENAI_API_KEY (BYOK).
 *
 * Usage:
 *
 *   import { generateOpenAIImage } from "../../Lib/openai-image-gateway.ts";
 *
 *   const { imageBuffer, chargedCredits, mode } = await generateOpenAIImage({
 *     prompt: "A cat wearing a hat",
 *     size: "1024x1024",
 *   });
 *
 * Env:
 *   STUDIO_API_URL          enables gateway mode
 *   STUDIO_API_KEY          bearer token
 *   OPENAI_API_KEY          BYOK fallback (ignored in gateway mode)
 *
 * See also:
 *   Packs/media/src/Lib/elevenlabs-gateway.ts — template
 *   Plans/dos-gateway-monetization-roadmap-2026-04-12.md — Phase 3
 */

import { loadEnv } from "./env.ts";
import { GatewayError, mapStudioError, parseStudioErrorBody, resolveAgainstOrigin, fetchStudioOutput } from "./gateway-shared.ts";
export { GatewayError } from "./gateway-shared.ts";
export type { GatewayErrorCode } from "./gateway-shared.ts";

export type OpenAIImageMode = "studio";

export interface GenerateOpenAIImageOptions {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  model?: string;
}

export interface GenerateOpenAIImageResult {
  imageBuffer: Buffer;
  chargedCredits?: number;
  mode: OpenAIImageMode;
}

const STUDIO_ROUTE = "/api/v1/media/openai/images";

export async function generateOpenAIImage(
  options: GenerateOpenAIImageOptions,
): Promise<GenerateOpenAIImageResult> {
  await loadEnv();

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_ORG_API_KEY ?? process.env.STUDIO_API_KEY ?? null;

  if (!studioUrl || !studioKey) {
    throw new GatewayError("unauthorized", 401, "Studio gateway not configured. Run: durante configure");
  }
  return generateViaGateway(options, studioUrl, studioKey);
}

// ──────────────────────────────────────────────────────────────────────
// Gateway path — Studio
// ──────────────────────────────────────────────────────────────────────

async function generateViaGateway(
  options: GenerateOpenAIImageOptions,
  studioUrl: string,
  studioKey: string,
): Promise<GenerateOpenAIImageResult> {
  const model = options.model ?? "gpt-image-1";
  const size = options.size ?? "1024x1024";
  const idempotencyKey = crypto.randomUUID();

  const cleanOrigin = studioUrl.replace(/\/+$/, "");
  const studioEndpoint = `${cleanOrigin}${STUDIO_ROUTE}`;

  const response = await fetch(studioEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studioKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ model, prompt: options.prompt, size }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const errBody = parseStudioErrorBody(errText);
    throw mapStudioError(response.status, errBody);
  }

  const result = (await response.json()) as {
    generationId?: string;
    status?: string;
    output?: string;
    chargedCredits?: number;
  };

  if (!result.output) {
    throw new GatewayError(
      "provider_failure",
      502,
      `Studio gateway returned no output URL for generation ${result.generationId ?? "?"}`,
    );
  }

  const absoluteUrl = resolveAgainstOrigin(result.output, cleanOrigin);
  const imageResponse = await fetchStudioOutput(absoluteUrl, cleanOrigin, studioKey);
  if (!imageResponse.ok) {
    throw new GatewayError(
      "provider_failure",
      imageResponse.status,
      `Failed to fetch stored image from ${absoluteUrl}: ${imageResponse.status}`,
    );
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  return {
    imageBuffer,
    chargedCredits: result.chargedCredits,
    mode: "studio",
  };
}

