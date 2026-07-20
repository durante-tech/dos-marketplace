/**
 * ElevenLabs TTS Gateway Shim — Phase 1 Chunk B
 *
 * Drop-in replacement for direct ElevenLabs API calls from DOS pack
 * tools. Detects STUDIO_API_URL + STUDIO_API_KEY via loadEnv() and
 * routes through the Studio gateway (`/api/v1/media/elevenlabs/synthesis`)
 * when both are set. Otherwise falls back to calling api.elevenlabs.io
 * directly using ELEVENLABS_API_KEY (BYOK).
 *
 * Mirrors the Packs/media/src/Lib/gateway.ts pattern for Replicate. The
 * shim reuses GatewayError from that file so callers handle a single
 * error taxonomy across both shims.
 *
 * Usage:
 *
 *   import { synthesizeElevenLabs } from "../../Lib/elevenlabs-gateway.ts";
 *
 *   const { audioBuffer, chargedCredits, mode } = await synthesizeElevenLabs({
 *     text: "Entering the think phase.",
 *     voiceId: "fTtv3eikoepIosk8dTZ5",
 *     modelId: "eleven_turbo_v2_5",
 *     voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
 *   });
 *
 * The caller is responsible for writing `audioBuffer` to disk.
 *
 * Env:
 *   STUDIO_API_URL          enables gateway mode
 *   STUDIO_API_KEY          bearer token
 *   ELEVENLABS_API_KEY      BYOK fallback (ignored in gateway mode)
 *
 * See also:
 *   Packs/media/src/Lib/gateway.ts           — Replicate shim (template)
 *   Packs/media/src/Lib/env.ts               — loadEnv()
 *   Plans/dos-gateway-monetization-roadmap-2026-04-12.md — Phase 1
 */

import { loadEnv } from "./env.ts";
import { GatewayError, mapStudioError, parseStudioErrorBody, resolveAgainstOrigin, fetchStudioOutput } from "./gateway-shared.ts";
export { GatewayError } from "./gateway-shared.ts";
export type { GatewayErrorCode } from "./gateway-shared.ts";

export type ElevenLabsMode = "studio";

/**
 * Loose voice-settings shape. Accepts either snake_case (the native
 * ElevenLabs API style — used by Speak.ts today) or camelCase (the
 * Studio Zod schema style). The shim translates before sending.
 */
export type ElevenLabsVoiceSettings = Record<string, number | boolean>;

export interface SynthesizeElevenLabsOptions {
  text: string;
  voiceId: string;
  /** Defaults to `eleven_turbo_v2_5`. */
  modelId?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
}

export interface SynthesizeElevenLabsResult {
  audioBuffer: Buffer;
  /** Only set in gateway mode. */
  chargedCredits?: number;
  /** Only set in gateway mode. */
  cacheHit?: boolean;
  mode: ElevenLabsMode;
}

const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";
const STUDIO_ROUTE = "/api/v1/media/elevenlabs/synthesis";

export async function synthesizeElevenLabs(
  options: SynthesizeElevenLabsOptions,
): Promise<SynthesizeElevenLabsResult> {
  await loadEnv();

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_ORG_API_KEY ?? process.env.STUDIO_API_KEY ?? null;

  if (!studioUrl || !studioKey) {
    throw new GatewayError("unauthorized", 401, "Studio gateway not configured. Run: durante configure");
  }
  return synthesizeViaGateway(options, studioUrl, studioKey);
}

// ──────────────────────────────────────────────────────────────────────
// Gateway path — Studio
// ──────────────────────────────────────────────────────────────────────

async function synthesizeViaGateway(
  options: SynthesizeElevenLabsOptions,
  studioUrl: string,
  studioKey: string,
): Promise<SynthesizeElevenLabsResult> {
  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
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
      modelId,
      voiceId: options.voiceId,
      text: options.text,
      voiceSettings: toCamelCase(options.voiceSettings),
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
    cacheHit?: boolean;
  };

  if (!result.output) {
    throw new GatewayError(
      "provider_failure",
      502,
      `Studio gateway returned no output URL for generation ${result.generationId ?? "?"}`,
    );
  }

  // Dev storage can return relative paths (e.g. `/storage.dev/...`); resolve
  // them against the Studio origin so the audio fetch below works.
  const absoluteAudioUrl = resolveAgainstOrigin(result.output, cleanOrigin);

  const audioResponse = await fetchStudioOutput(absoluteAudioUrl, cleanOrigin, studioKey);
  if (!audioResponse.ok) {
    throw new GatewayError(
      "provider_failure",
      audioResponse.status,
      `Failed to fetch stored audio from ${absoluteAudioUrl}: ${audioResponse.status}`,
    );
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  return {
    audioBuffer,
    chargedCredits: result.chargedCredits,
    cacheHit: result.cacheHit,
    mode: "studio",
  };
}

// ──────────────────────────────────────────────────────────────────────
// voice_settings case translation
//
// Speak.ts passes settings in snake_case (similarity_boost,
// use_speaker_boost) because it originally targeted the raw ElevenLabs
// API. The Studio route expects camelCase (similarityBoost,
// useSpeakerBoost) per its Zod schema. The shim translates so callers
// can use either convention.
// ──────────────────────────────────────────────────────────────────────

function toCamelCase(
  raw: ElevenLabsVoiceSettings | undefined,
): Record<string, number | boolean> | undefined {
  if (!raw) return undefined;
  const out: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    switch (key) {
      case "stability":
        out.stability = value as number;
        break;
      case "similarity_boost":
      case "similarityBoost":
        out.similarityBoost = value as number;
        break;
      case "style":
        out.style = value as number;
        break;
      case "use_speaker_boost":
      case "useSpeakerBoost":
        out.useSpeakerBoost = value as boolean;
        break;
      case "speed":
        out.speed = value as number;
        break;
      // Unknown keys are dropped — the Studio Zod schema would strip
      // them anyway, so silently dropping keeps callers from hitting
      // mysterious 400s on typos.
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

