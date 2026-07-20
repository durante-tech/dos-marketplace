/**
 * catalog.ts — DOS Media model catalog (single source of truth)
 *
 * Centralizes the VOLATILE, syncable model facts — Replicate model id, version pin,
 * provider routing, and capability flags — that go stale as providers ship new
 * versions. Before this file, every Media sub-tool (Generate.ts, Render.ts, Speak.ts,
 * ...) owned its own inline registry; the data was scattered across 9 files.
 *
 * Each tool imports its domain slice (IMAGE_MODELS, VIDEO_MODELS, ...) and attaches
 * its own buildInput() behavior. buildInput stays in the tool on purpose: it is
 * coupled to that tool's local CLIArgs shape, so moving it here would create a
 * circular import. The split is by change-rate — volatile *data* lives here;
 * stable per-call *behavior* lives in the tool.
 *
 * The drift detector Tools/media-catalog-check.ts reads this file's pure data and
 * compares each Replicate entry against the Replicate API (latest_version) to flag
 * stale pins and dead ids.
 *
 * FIELD CONTRACT
 *   id           Provider model id. Replicate: "owner/model". Others: provider-native.
 *   versionPin   Replicate version hash. REQUIRED for community models (Replicate
 *                rejects them unpinned); OMITTED for official models (auto-latest).
 *   provider     Routing target. Drives which gateway the tool calls.
 *   description  Human one-liner (mirrors the tool's --help model line).
 *   lastVerified ISO date (YYYY-MM-DD) the id/version was last confirmed against the
 *                provider. The drift detector and curation passes update this.
 */

export type Provider =
  | "replicate"
  | "gemini"
  | "openai"
  | "elevenlabs"
  | "removebg-api";

/** Fields every catalog entry carries, regardless of domain. */
export interface CatalogBase {
  id: string;
  versionPin?: string;
  provider: Provider;
  description: string;
  lastVerified: string;
}

/**
 * Compose the runtime model reference a Replicate call expects.
 * Community models carry a versionPin and resolve to "owner/model:hash";
 * official models omit the pin and resolve to "owner/model" (auto-latest).
 * Tools call this when building their registry so the drift detector can keep
 * id and versionPin normalized here, while runtime behavior is unchanged.
 */
export function runRef(m: { id: string; versionPin?: string }): string {
  return m.versionPin ? `${m.id}:${m.versionPin}` : m.id;
}

// ============================================================================
// IMAGE — consumed by Art/Tools/Generate.ts
// ============================================================================

export interface ImageModelData extends CatalogBase {
  supportsRefImages: boolean;
  refImageParam: string;
  maxRefImages: number;
  supportsOutputFormat: boolean;
}

/**
 * Replicate-backed image models. The two non-Replicate image paths
 * (nano-banana-pro via Gemini, gpt-image-1 via OpenAI) are routed directly by
 * Generate.ts and intentionally not in this registry — they have no Replicate id
 * to drift-check.
 */
export const IMAGE_MODELS = {
  "flux": {
    id: "black-forest-labs/flux-1.1-pro",
    provider: "replicate",
    description: "Flux 1.1 Pro — high quality, fast, reliable baseline",
    lastVerified: "2026-06-07",
    supportsRefImages: false, refImageParam: "", maxRefImages: 0,
    supportsOutputFormat: true,
  },
  "flux-2-pro": {
    id: "black-forest-labs/flux-2-pro",
    provider: "replicate",
    description: "Flux 2 Pro — next-gen, up to 8 reference images, JSON prompts",
    lastVerified: "2026-06-07",
    supportsRefImages: true, refImageParam: "input_images", maxRefImages: 8,
    supportsOutputFormat: true,
  },
  "flux-2-max": {
    id: "black-forest-labs/flux-2-max",
    provider: "replicate",
    description: "Flux 2 Max — highest quality Flux, up to 8 refs, cinematic",
    lastVerified: "2026-06-07",
    supportsRefImages: true, refImageParam: "input_images", maxRefImages: 8,
    supportsOutputFormat: true,
  },
  "nano-banana": {
    id: "google/nano-banana",
    provider: "replicate",
    description: "Nano Banana — lightweight Google model",
    lastVerified: "2026-06-07",
    supportsRefImages: false, refImageParam: "", maxRefImages: 0,
    supportsOutputFormat: true,
  },
  "nano-banana-replicate": {
    id: "google/nano-banana-pro",
    provider: "replicate",
    description: "Nano Banana Pro (Replicate) — 4K, up to 14 refs, multilingual",
    lastVerified: "2026-06-07",
    supportsRefImages: true, refImageParam: "image_input", maxRefImages: 14,
    supportsOutputFormat: true,
  },
  "nano-banana-2": {
    id: "google/nano-banana-2",
    provider: "replicate",
    description: "Nano Banana 2 — Gemini 3.1 Flash Image, multi-image fusion, up to 14 refs",
    lastVerified: "2026-06-08",
    supportsRefImages: true, refImageParam: "image_input", maxRefImages: 14,
    supportsOutputFormat: true,
  },
  "seedream": {
    id: "bytedance/seedream-4.5",
    provider: "replicate",
    description: "SeDream 4.5 — cinematic, up to 14 refs, sequential gen",
    lastVerified: "2026-06-07",
    supportsRefImages: true, refImageParam: "image_input", maxRefImages: 14,
    supportsOutputFormat: false,
  },
  "seedream-5-lite": {
    id: "bytedance/seedream-5-lite",
    provider: "replicate",
    description: "SeDream 5 Lite — newer gen, multi-image blend, up to 14 refs, 3K",
    lastVerified: "2026-06-08",
    supportsRefImages: true, refImageParam: "image_input", maxRefImages: 14,
    supportsOutputFormat: false,
  },
  "imagen-4-ultra": {
    id: "google/imagen-4-ultra",
    provider: "replicate",
    description: "Imagen 4 Ultra — fine detail, typography, style versatility",
    lastVerified: "2026-06-07",
    supportsRefImages: false, refImageParam: "", maxRefImages: 0,
    supportsOutputFormat: true,
  },
  "grok-imagine": {
    id: "xai/grok-imagine-image",
    provider: "replicate",
    description: "Grok Imagine — xAI, text rendering, ~4s, single image edit",
    lastVerified: "2026-06-07",
    supportsRefImages: true, refImageParam: "image", maxRefImages: 1,
    supportsOutputFormat: false,
  },
} satisfies Record<string, ImageModelData>;

export type ImageModelKey = keyof typeof IMAGE_MODELS;

// ============================================================================
// VIDEO — consumed by Video/Tools/Render.ts
// ============================================================================

export interface VideoModelData extends CatalogBase {
  supportsImage: boolean;
  supportsLastFrame: boolean;
  supportsRefImages: boolean;
  maxRefImages: number;
  supportsAudio: boolean;
  supportsNegPrompt: boolean;
  imageParamName: string;
  lastFrameParamName: string;
}

export const VIDEO_MODELS = {
  "seedance": {
    id: "bytedance/seedance-2.0",
    provider: "replicate",
    description: "ByteDance Seedance 2.0 — high-quality video with audio, reference images",
    lastVerified: "2026-06-07",
    supportsImage: true, supportsLastFrame: true, supportsRefImages: true, maxRefImages: 9,
    supportsAudio: true, supportsNegPrompt: false,
    imageParamName: "image", lastFrameParamName: "last_frame_image",
  },
  "grok-video": {
    id: "xai/grok-imagine-video",
    provider: "replicate",
    description: "xAI Grok Imagine Video — text/image-to-video with editing support",
    lastVerified: "2026-06-07",
    supportsImage: true, supportsLastFrame: false, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: false, supportsNegPrompt: false,
    imageParamName: "image", lastFrameParamName: "",
  },
  "gen-4.5": {
    id: "runwayml/gen-4.5",
    provider: "replicate",
    description: "Runway Gen-4.5 — cinematic quality, image-to-video",
    lastVerified: "2026-06-07",
    supportsImage: true, supportsLastFrame: false, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: false, supportsNegPrompt: false,
    imageParamName: "image", lastFrameParamName: "",
  },
  "kling-v3": {
    id: "kwaivgi/kling-v3-video",
    provider: "replicate",
    description: "Kling V3 — high-quality with start/end frame, audio, negative prompt",
    lastVerified: "2026-06-07",
    supportsImage: true, supportsLastFrame: true, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: true, supportsNegPrompt: true,
    imageParamName: "start_image", lastFrameParamName: "end_image",
  },
  "kling-turbo": {
    id: "kwaivgi/kling-v2.5-turbo-pro",
    provider: "replicate",
    description: "Kling V2.5 Turbo Pro — fast generation with start/end frame",
    lastVerified: "2026-06-07",
    supportsImage: true, supportsLastFrame: true, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: false, supportsNegPrompt: true,
    imageParamName: "start_image", lastFrameParamName: "end_image",
  },
  "veo-fast": {
    id: "google/veo-3.1-fast",
    provider: "replicate",
    description: "Google Veo 3.1 Fast — quick generation with audio, negative prompt",
    lastVerified: "2026-06-07",
    supportsImage: true, supportsLastFrame: true, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: true, supportsNegPrompt: true,
    imageParamName: "image", lastFrameParamName: "last_frame",
  },
  "veo": {
    id: "google/veo-3.1",
    provider: "replicate",
    description: "Google Veo 3.1 — highest quality, reference images, audio, negative prompt",
    lastVerified: "2026-06-07",
    supportsImage: true, supportsLastFrame: true, supportsRefImages: true, maxRefImages: 3,
    supportsAudio: true, supportsNegPrompt: true,
    imageParamName: "image", lastFrameParamName: "last_frame",
  },
  "wan-i2v": {
    id: "wan-video/wan-2.2-i2v-fast",
    provider: "replicate",
    description: "Wan 2.2 I2V Fast — image-to-video (image required), frame control",
    lastVerified: "2026-06-07",
    supportsImage: true, supportsLastFrame: true, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: false, supportsNegPrompt: false,
    imageParamName: "image", lastFrameParamName: "last_image",
  },
  "sora-2": {
    id: "openai/sora-2",
    provider: "replicate",
    description: "OpenAI Sora 2 — t2v/i2v with synced audio (start-frame via input_reference)",
    lastVerified: "2026-06-08",
    supportsImage: true, supportsLastFrame: false, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: false, supportsNegPrompt: false,
    imageParamName: "input_reference", lastFrameParamName: "",
  },
  "sora-2-pro": {
    id: "openai/sora-2-pro",
    provider: "replicate",
    description: "OpenAI Sora 2 Pro — higher-quality tier with selectable resolution",
    lastVerified: "2026-06-08",
    supportsImage: true, supportsLastFrame: false, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: false, supportsNegPrompt: false,
    imageParamName: "input_reference", lastFrameParamName: "",
  },
  "kling-omni": {
    id: "kwaivgi/kling-v3-omni-video",
    provider: "replicate",
    description: "Kling V3 Omni — multimodal, start/end frame, up to 7 refs, native audio",
    lastVerified: "2026-06-08",
    supportsImage: true, supportsLastFrame: true, supportsRefImages: true, maxRefImages: 7,
    supportsAudio: true, supportsNegPrompt: false,
    imageParamName: "start_image", lastFrameParamName: "end_image",
  },
  "hailuo-2.3": {
    id: "minimax/hailuo-2.3",
    provider: "replicate",
    description: "MiniMax Hailuo 2.3 — t2v/i2v, 768p/1080p (image via first_frame_image)",
    lastVerified: "2026-06-08",
    supportsImage: true, supportsLastFrame: false, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: false, supportsNegPrompt: false,
    imageParamName: "first_frame_image", lastFrameParamName: "",
  },
  "grok-video-1.5": {
    id: "xai/grok-imagine-video-1.5",
    provider: "replicate",
    description: "xAI Grok Imagine Video 1.5 — image-to-video with synced audio",
    lastVerified: "2026-06-08",
    supportsImage: true, supportsLastFrame: false, supportsRefImages: false, maxRefImages: 0,
    supportsAudio: false, supportsNegPrompt: false,
    imageParamName: "image", lastFrameParamName: "",
  },
} satisfies Record<string, VideoModelData>;

export type VideoModelKey = keyof typeof VIDEO_MODELS;

// ============================================================================
// SPEECH — consumed by Speech/Tools/Speak.ts
// ============================================================================

export interface SpeechModelData extends CatalogBase {
  outputExt: ".mp3" | ".wav";
}

/** Replicate-backed TTS models. The ElevenLabs/OpenAI native ids are below. */
export const SPEECH_MODELS = {
  "replicate-minimax-turbo": {
    id: "minimax/speech-2.8-turbo",
    provider: "replicate",
    description: "Fast general TTS, 17 voices, interjections, emotions",
    lastVerified: "2026-06-07",
    outputExt: ".mp3",
  },
  "replicate-minimax-hd": {
    id: "minimax/speech-2.8-hd",
    provider: "replicate",
    description: "High-quality audiobooks/podcasts, 32 languages, full audio control",
    lastVerified: "2026-06-07",
    outputExt: ".mp3",
  },
  "replicate-chatterbox": {
    id: "resemble-ai/chatterbox-turbo",
    provider: "replicate",
    description: "Fast voice cloning from 5s audio, paralinguistic tags",
    lastVerified: "2026-06-07",
    outputExt: ".wav",
  },
  "replicate-qwen": {
    id: "qwen/qwen3-tts",
    provider: "replicate",
    description: "Multilingual TTS, voice design from text, voice cloning",
    lastVerified: "2026-06-07",
    outputExt: ".wav",
  },
  "replicate-clone": {
    id: "minimax/voice-cloning",
    provider: "replicate",
    description: "Create reusable voice_id from 5s+ reference audio",
    lastVerified: "2026-06-07",
    outputExt: ".wav",
  },
  "replicate-inworld": {
    id: "inworld/realtime-tts-2",
    provider: "replicate",
    description: "Inworld Realtime TTS 2 — natural-language steering, 90+ langs, low latency",
    lastVerified: "2026-06-08",
    outputExt: ".mp3",
  },
  "replicate-gemini-tts": {
    id: "google/gemini-3.1-flash-tts",
    provider: "replicate",
    description: "Google Gemini 3.1 Flash TTS — 30 voices, 86 languages, prompt steering",
    lastVerified: "2026-06-08",
    outputExt: ".wav",
  },
  "replicate-elevenlabs-v3": {
    id: "elevenlabs/v3",
    provider: "replicate",
    description: "ElevenLabs v3 — flagship TTS, audio-tag delivery control (text via prompt)",
    lastVerified: "2026-06-08",
    outputExt: ".mp3",
  },
} satisfies Record<string, SpeechModelData>;

export type SpeechModelKey = keyof typeof SPEECH_MODELS;

/** Non-Replicate native TTS model ids (provider-routed by the gateways). */
export const SPEECH_NATIVE = {
  elevenlabs: {
    id: "eleven_turbo_v2_5",
    provider: "elevenlabs",
    description: "ElevenLabs Turbo v2.5 — low-latency multilingual TTS",
    lastVerified: "2026-06-07",
  },
  "openai-tts": {
    id: "tts-1-hd",
    provider: "openai",
    description: "OpenAI TTS-1-HD — high-fidelity speech",
    lastVerified: "2026-06-07",
  },
} satisfies Record<string, CatalogBase>;

// ============================================================================
// MUSIC — consumed by Music/Tools/Compose.ts
// ============================================================================

export interface MusicModelData extends CatalogBase {
  outputExt: ".mp3" | ".wav";
}

export const MUSIC_MODELS = {
  "elevenlabs": {
    id: "elevenlabs/music",
    provider: "replicate",
    description: "ElevenLabs Music — high quality, instrumental or vocal, multiple formats",
    lastVerified: "2026-06-07",
    outputExt: ".mp3",
  },
  "minimax": {
    id: "minimax/music-1.5",
    provider: "replicate",
    description: "MiniMax Music 1.5 — lyrics with structure tags, high quality audio",
    lastVerified: "2026-06-07",
    outputExt: ".mp3",
  },
  "ace-step": {
    id: "lucataco/ace-step",
    versionPin: "280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1",
    provider: "replicate",
    description: "ACE-Step — open source, genre/mood tags, optional lyrics, variable duration",
    lastVerified: "2026-06-07",
    outputExt: ".mp3",
  },
  "minimax-2.5": {
    id: "minimax/music-2.5",
    provider: "replicate",
    description: "MiniMax Music 2.5 — lyrics with structure tags, full-length songs",
    lastVerified: "2026-06-08",
    outputExt: ".mp3",
  },
  "lyria": {
    id: "google/lyria-2",
    provider: "replicate",
    description: "Google Lyria 2 — 48kHz stereo instrumental music from a prompt",
    lastVerified: "2026-06-08",
    outputExt: ".wav",
  },
  "stable-audio": {
    id: "stability-ai/stable-audio-2.5",
    provider: "replicate",
    description: "Stable Audio 2.5 — music + SFX, duration up to 190s, seedable",
    lastVerified: "2026-06-08",
    outputExt: ".wav",
  },
} satisfies Record<string, MusicModelData>;

export type MusicModelKey = keyof typeof MUSIC_MODELS;

// ============================================================================
// UPSCALE — consumed by ImageUpscale/Tools/Upscale.ts
// ============================================================================

export const UPSCALE_MODELS = {
  "recraft": {
    id: "recraft-ai/recraft-crisp-upscale",
    provider: "replicate",
    description: "Recraft Crisp Upscale — simple, high quality, just image in",
    lastVerified: "2026-06-07",
  },
  "google": {
    id: "google/upscaler",
    provider: "replicate",
    description: "Google Upscaler — 2x or 4x, compression quality control",
    lastVerified: "2026-06-07",
  },
  "real-esrgan": {
    id: "nightmareai/real-esrgan",
    provider: "replicate",
    description: "Real-ESRGAN — scalable upscale, optional GFPGAN face enhancement",
    lastVerified: "2026-06-07",
  },
  "clarity": {
    id: "philz1337x/clarity-upscaler",
    versionPin: "dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e",
    provider: "replicate",
    description: "Clarity Upscaler — prompt-guided, HDR, creativity/resemblance controls",
    lastVerified: "2026-06-07",
  },
  "pruna": {
    id: "prunaai/p-image-upscale",
    provider: "replicate",
    description: "Pruna P-Image Upscale — very fast, up to 128MP, target/factor modes",
    lastVerified: "2026-06-08",
  },
  "clarity-pro": {
    id: "philz1337x/clarity-pro-upscaler",
    provider: "replicate",
    description: "Clarity Pro Upscaler — identity-preserving, scale 2/4/8/16, creativity control",
    lastVerified: "2026-06-08",
  },
} satisfies Record<string, CatalogBase>;

export type UpscaleModelKey = keyof typeof UPSCALE_MODELS;

// ============================================================================
// RESTORE — consumed by ImageRestoration/Tools/Restore.ts
// ============================================================================

export interface RestoreModelData extends CatalogBase {
  imageParamName: string;
}

export const RESTORE_MODELS = {
  "flux-restore": {
    id: "flux-kontext-apps/restore-image",
    provider: "replicate",
    description: "Flux Restore — general image restoration, denoising, enhancement",
    lastVerified: "2026-06-07",
    imageParamName: "input_image",
  },
  "codeformer": {
    id: "sczhou/codeformer",
    versionPin: "cc4956dd26fa5a7185d5660cc9100fab1b8070a1d1654a8bb5eb6d443b020bb2",
    provider: "replicate",
    description: "CodeFormer — face restoration, background enhance, upscale",
    lastVerified: "2026-06-07",
    imageParamName: "image",
  },
  "gfpgan": {
    id: "tencentarc/gfpgan",
    versionPin: "0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c",
    provider: "replicate",
    description: "GFPGAN — face restoration, v1.3 (quality) or v1.4 (detail + identity)",
    lastVerified: "2026-06-07",
    imageParamName: "img",
  },
  "flux-kontext-pro": {
    id: "black-forest-labs/flux-kontext-pro",
    provider: "replicate",
    description: "Flux Kontext Pro — instruction-based editor (needs --prompt + image)",
    lastVerified: "2026-06-08",
    imageParamName: "input_image",
  },
  "bria-eraser": {
    id: "bria/eraser",
    provider: "replicate",
    description: "Bria Eraser — masked object removal (needs --mask)",
    lastVerified: "2026-06-08",
    imageParamName: "image",
  },
  "bria-genfill": {
    id: "bria/genfill",
    provider: "replicate",
    description: "Bria GenFill — generative fill into a masked region (needs --mask + --prompt)",
    lastVerified: "2026-06-08",
    imageParamName: "image",
  },
} satisfies Record<string, RestoreModelData>;

export type RestoreModelKey = keyof typeof RESTORE_MODELS;

// ============================================================================
// BACKGROUND REMOVAL — consumed by BackgroundRemoval/Tools/RemoveBg.ts
// ============================================================================

/**
 * Replicate-backed background removers. The third option in RemoveBg.ts,
 * "removebg-api", is an external cloud service (remove.bg) with no Replicate
 * model id and is routed directly by the tool — intentionally not cataloged.
 */
export const BG_MODELS = {
  "851-labs": {
    id: "851-labs/background-remover",
    versionPin: "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc",
    provider: "replicate",
    description: "851 Labs — soft alpha, green screen, blur, custom bg color, reverse mode",
    lastVerified: "2026-06-07",
  },
  "remove-bg": {
    id: "lucataco/remove-bg",
    versionPin: "95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
    provider: "replicate",
    description: "Lucataco Remove BG — fast (~2s), clean edges, simple",
    lastVerified: "2026-06-07",
  },
  "bria": {
    id: "bria/remove-background",
    provider: "replicate",
    description: "Bria Remove Background — commercial-grade matting, alpha preservation",
    lastVerified: "2026-06-08",
  },
} satisfies Record<string, CatalogBase>;

export type BgModelKey = keyof typeof BG_MODELS;

// ============================================================================
// FACE SWAP — consumed by FaceSwap/Tools/Swap.ts (single model)
// ============================================================================

export const FACESWAP_MODEL = {
  id: "codeplugtech/face-swap",
  versionPin: "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34",
  provider: "replicate",
  description: "CodePlugTech Face Swap — realism-focused single-face swap",
  lastVerified: "2026-06-07",
} satisfies CatalogBase;

// ============================================================================
// EMOJI — consumed by Emoji/Tools/GenerateEmoji.ts (single model)
// ============================================================================

export const EMOJI_MODEL = {
  id: "fofr/sdxl-emoji",
  versionPin: "dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e",
  provider: "replicate",
  description: "SDXL Emoji — fofr fine-tune for emoji-style images",
  lastVerified: "2026-06-07",
} satisfies CatalogBase;
