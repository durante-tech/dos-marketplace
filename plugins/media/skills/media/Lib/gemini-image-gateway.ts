/**
 * Gemini Image Generation Gateway Shim — Phase 3
 *
 * Drop-in replacement for direct GoogleGenAI image generation calls
 * from DOS pack tools. Detects STUDIO_API_URL + STUDIO_API_KEY via
 * loadEnv() and routes through the Studio gateway
 * (`/api/v1/media/google/image-generation`) when both are set.
 * Otherwise falls back to calling generativelanguage.googleapis.com
 * directly using GOOGLE_API_KEY (BYOK).
 *
 * NOTE: This is for IMAGE generation only (responseModalities: ["IMAGE"]).
 * The Gemini TEXT route lives at `/api/v1/inference/google/messages` and
 * is handled by `Packs/research/src/Tools/Gemini.ts`.
 *
 * Usage:
 *
 *   import { generateGeminiImage } from "../../Lib/gemini-image-gateway.ts";
 *
 *   const { imageBuffer, chargedCredits, mode } = await generateGeminiImage({
 *     prompt: "A futuristic city",
 *     model: "gemini-3-pro-image-preview",
 *     aspectRatio: "16:9",
 *     imageSize: "2K",
 *   });
 *
 * Env:
 *   STUDIO_API_URL          enables gateway mode
 *   STUDIO_API_KEY          bearer token
 *   GOOGLE_API_KEY          BYOK fallback (ignored in gateway mode)
 *
 * See also:
 *   Packs/media/src/Lib/elevenlabs-gateway.ts — template
 *   Plans/dos-gateway-monetization-roadmap-2026-04-12.md — Phase 3
 */

import { loadEnv } from "./env.ts";
import { GatewayError, mapStudioError, parseStudioErrorBody, resolveAgainstOrigin, fetchStudioOutput } from "./gateway-shared.ts";
export { GatewayError } from "./gateway-shared.ts";
export type { GatewayErrorCode } from "./gateway-shared.ts";

export type GeminiImageMode = "studio";

export interface GeminiReferenceImage {
  mimeType: string;
  data: string; // base64
}

export interface GenerateGeminiImageOptions {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  referenceImages?: GeminiReferenceImage[];
}

export interface GenerateGeminiImageResult {
  imageBuffer: Buffer;
  chargedCredits?: number;
  mode: GeminiImageMode;
}

const STUDIO_ROUTE = "/api/v1/media/google/image-generation";

export async function generateGeminiImage(
  options: GenerateGeminiImageOptions,
): Promise<GenerateGeminiImageResult> {
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
  options: GenerateGeminiImageOptions,
  studioUrl: string,
  studioKey: string,
): Promise<GenerateGeminiImageResult> {
  const model = options.model ?? "gemini-3-pro-image-preview";
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
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      aspectRatio: options.aspectRatio ?? "1:1",
      imageSize: options.imageSize ?? "1K",
      referenceImages: options.referenceImages,
    }),
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

