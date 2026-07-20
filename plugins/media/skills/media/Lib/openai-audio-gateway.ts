/**
 * OpenAI Audio Gateway Shim — TTS + Whisper Transcription
 *
 * Drop-in replacement for direct OpenAI Audio API calls from DOS pack
 * tools and DOS system tools. Detects STUDIO_API_URL + STUDIO_API_KEY
 * via loadEnv() and routes through the Studio gateway when both are set.
 * Otherwise falls back to calling api.openai.com directly using
 * OPENAI_API_KEY (BYOK).
 *
 * Two functions:
 *   synthesizeOpenAITTS()  — text-to-speech (Speak.ts)
 *   transcribeWithWhisper() — speech-to-text (ExtractTranscript.ts, SplitAndTranscribe.ts)
 *
 * Env:
 *   STUDIO_API_URL          enables gateway mode
 *   STUDIO_API_KEY          bearer token
 *   OPENAI_API_KEY          BYOK fallback (ignored in gateway mode)
 *
 * See also:
 *   Packs/media/src/Lib/gateway-shared.ts — shared utilities
 *   Plans/dos-gateway-monetization-roadmap-2026-04-12.md — Phase 3
 */

import { loadEnv } from "./env.ts";
import {
  GatewayError,
  mapStudioError,
  parseStudioErrorBody,
  resolveAgainstOrigin,
  fetchStudioOutput,
} from "./gateway-shared.ts";

export { GatewayError } from "./gateway-shared.ts";
export type { GatewayErrorCode } from "./gateway-shared.ts";

// ──────────────────────────────────────────────────────────────────────
// TTS
// ──────────────────────────────────────────────────────────────────────

export type OpenAIAudioMode = "studio";

export interface SynthesizeOpenAITTSOptions {
  text: string;
  voice?: string;
  model?: string;
  speed?: number;
  responseFormat?: string;
}

export interface SynthesizeOpenAITTSResult {
  audioBuffer: Buffer;
  chargedCredits?: number;
  mode: OpenAIAudioMode;
}

const TTS_STUDIO_ROUTE = "/api/v1/media/openai/tts";

export async function synthesizeOpenAITTS(
  options: SynthesizeOpenAITTSOptions,
): Promise<SynthesizeOpenAITTSResult> {
  await loadEnv();

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_ORG_API_KEY ?? process.env.STUDIO_API_KEY ?? null;

  if (!studioUrl || !studioKey) {
    throw new GatewayError("unauthorized", 401, "Studio gateway not configured. Run: durante configure");
  }
  return ttsViaGateway(options, studioUrl, studioKey);
}

async function ttsViaGateway(
  options: SynthesizeOpenAITTSOptions,
  studioUrl: string,
  studioKey: string,
): Promise<SynthesizeOpenAITTSResult> {
  const model = options.model ?? "tts-1-hd";
  const voice = options.voice ?? "alloy";
  const speed = options.speed ?? 1;
  const responseFormat = options.responseFormat ?? "mp3";
  const idempotencyKey = crypto.randomUUID();
  const cleanOrigin = studioUrl.replace(/\/+$/, "");

  const response = await fetch(`${cleanOrigin}${TTS_STUDIO_ROUTE}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studioKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      model,
      voice,
      text: options.text,
      speed,
      responseFormat,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const errBody = parseStudioErrorBody(errText);
    throw mapStudioError(response.status, errBody);
  }

  const result = (await response.json()) as {
    generationId?: string;
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
  const audioResponse = await fetchStudioOutput(absoluteUrl, cleanOrigin, studioKey);
  if (!audioResponse.ok) {
    throw new GatewayError(
      "provider_failure",
      audioResponse.status,
      `Failed to fetch stored audio from ${absoluteUrl}: ${audioResponse.status}`,
    );
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  return {
    audioBuffer,
    chargedCredits: result.chargedCredits,
    mode: "studio",
  };
}

// ──────────────────────────────────────────────────────────────────────
// Whisper Transcription
// ──────────────────────────────────────────────────────────────────────

export interface TranscribeWhisperOptions {
  audioBuffer: Buffer;
  language?: string;
  responseFormat?: string;
  fileName?: string;
}

export interface TranscribeWhisperResult {
  transcript: string;
  chargedCredits?: number;
  mode: OpenAIAudioMode;
}

const TRANSCRIPTION_STUDIO_ROUTE = "/api/v1/media/openai/transcriptions";

export async function transcribeWithWhisper(
  options: TranscribeWhisperOptions,
): Promise<TranscribeWhisperResult> {
  await loadEnv();
// studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.

  // studioClient:exempt — BYOK gateway routing (Studio-or-direct), separate migration pass.
  const studioUrl = process.env.STUDIO_API_URL ?? null;
  const studioKey = process.env.STUDIO_ORG_API_KEY ?? process.env.STUDIO_API_KEY ?? null;

  if (!studioUrl || !studioKey) {
    throw new GatewayError("unauthorized", 401, "Studio gateway not configured. Run: durante configure");
  }
  return transcribeViaGateway(options, studioUrl, studioKey);
}

async function transcribeViaGateway(
  options: TranscribeWhisperOptions,
  studioUrl: string,
  studioKey: string,
): Promise<TranscribeWhisperResult> {
  const idempotencyKey = crypto.randomUUID();
  const cleanOrigin = studioUrl.replace(/\/+$/, "");
  const audioBase64 = options.audioBuffer.toString("base64");

  const response = await fetch(`${cleanOrigin}${TRANSCRIPTION_STUDIO_ROUTE}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studioKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      model: "whisper-1",
      audioBase64,
      language: options.language,
      responseFormat: options.responseFormat ?? "text",
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const errBody = parseStudioErrorBody(errText);
    throw mapStudioError(response.status, errBody);
  }

  const result = (await response.json()) as {
    generationId?: string;
    output?: string;
    chargedCredits?: number;
    transcript?: string;
  };

  // The worker stores the transcript in storage and returns the URL,
  // but also returns the transcript inline for convenience.
  let transcript = result.transcript ?? "";
  if (!transcript && result.output) {
    const absoluteUrl = resolveAgainstOrigin(result.output, cleanOrigin);
    const textResponse = await fetchStudioOutput(absoluteUrl, cleanOrigin, studioKey);
    if (textResponse.ok) {
      transcript = await textResponse.text();
    }
  }

  return {
    transcript,
    chargedCredits: result.chargedCredits,
    mode: "studio",
  };
}
