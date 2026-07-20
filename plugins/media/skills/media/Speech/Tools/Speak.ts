#!/usr/bin/env bun

/**
 * speak - Speech Generation CLI
 *
 * Generate speech audio using multiple TTS providers and models.
 * Follows the same Collections pattern as Generate.ts (image generation).
 *
 * Providers: ElevenLabs, OpenAI TTS, Replicate (5 sub-models)
 *
 * Usage:
 *   speak --model elevenlabs --text "Hello world" --output /tmp/speech.mp3
 *   speak --model replicate-minimax-turbo --text "Hello" --voice-id Deep_Voice_Man
 *
 * @see Packs/media/src/Speech/SKILL.md
 */

import Replicate from "../../Lib/gateway.ts";
import { synthesizeElevenLabs } from "../../Lib/elevenlabs-gateway.ts";
import { synthesizeOpenAITTS } from "../../Lib/openai-audio-gateway.ts";
import { writeFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { readFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { enforceConsent } from "../../Lib/consent-gate.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import {
  loadPronunciationRules,
  applyPronunciations,
} from "../Lib/pronunciations.ts";
import { SPEECH_MODELS, SPEECH_NATIVE, runRef, type SpeechModelData } from "../../Lib/catalog.ts";

// ============================================================================
// Model Registry — model data sourced from Lib/catalog.ts (single source of truth)
// ============================================================================

type Model =
  | "elevenlabs"
  | "openai-tts"
  | "replicate-minimax-turbo"
  | "replicate-minimax-hd"
  | "replicate-chatterbox"
  | "replicate-qwen"
  | "replicate-clone"
  | "replicate-inworld"
  | "replicate-gemini-tts"
  | "replicate-elevenlabs-v3";

interface ReplicateModelSpec extends SpeechModelData {
  buildInput: (args: CLIArgs) => Record<string, unknown>;
}

// buildInput factories — behavior stays in the tool (coupled to local CLIArgs).
const SPEECH_BUILDERS: Record<keyof typeof SPEECH_MODELS, ReplicateModelSpec["buildInput"]> = {
  "replicate-minimax-turbo": (args) => ({
    text: args.text,
    ...(args.voiceId && { voice_id: args.voiceId }),
    ...(args.speed && { speed: args.speed }),
    ...(args.emotion && { emotion: args.emotion }),
    ...(args.language && { language: args.language }),
  }),
  "replicate-minimax-hd": (args) => ({
    text: args.text,
    ...(args.voiceId && { voice_id: args.voiceId }),
    ...(args.speed && { speed: args.speed }),
    ...(args.emotion && { emotion: args.emotion }),
    ...(args.language && { language: args.language }),
  }),
  "replicate-chatterbox": (args) => ({
    text: args.text,
    ...(args.refAudio && { audio_prompt: args.refAudio }),
    ...(args.exaggeration !== undefined && { exaggeration: args.exaggeration }),
    ...(args.cfgWeight !== undefined && { cfg_weight: args.cfgWeight }),
  }),
  "replicate-qwen": (args) => ({
    text: args.text,
    language: args.language ?? "Auto",
    ...(args.voice !== "main" && { speaker: args.voice }),
    ...(args.instruct && { instruct: args.instruct }),
    ...(args.refAudio && { ref_audio: args.refAudio }),
    ...(args.refText && { ref_text: args.refText }),
  }),
  "replicate-clone": (args) => ({
    ...(args.refAudio && { audio: args.refAudio }),
  }),
  // Inworld: speed maps to `speaking_rate`; steering is inline brackets in text.
  "replicate-inworld": (args) => ({
    text: args.text,
    ...(args.voiceId && { voice_id: args.voiceId }),
    ...(args.language && { language: args.language }),
    ...(args.speed && { speaking_rate: args.speed }),
  }),
  // Gemini TTS: speaker is `voice`; steering is a separate top-level `prompt`; language is `language_code`.
  "replicate-gemini-tts": (args) => ({
    text: args.text,
    ...(args.voice !== "main" && { voice: args.voice }),
    ...(args.instruct && { prompt: args.instruct }),
    ...(args.language && { language_code: args.language }),
  }),
  // ElevenLabs v3: the spoken text field is `prompt` (not `text`); language is `language_code`.
  "replicate-elevenlabs-v3": (args) => ({
    prompt: args.text,
    ...(args.voice !== "main" && { voice: args.voice }),
    ...(args.speed && { speed: args.speed }),
    ...(args.language && { language_code: args.language }),
  }),
};

// Compose the runtime registry: catalog data + local buildInput behavior.
const REPLICATE_MODELS = Object.fromEntries(
  (Object.keys(SPEECH_MODELS) as Array<keyof typeof SPEECH_MODELS>).map((key) => [
    key,
    { ...SPEECH_MODELS[key], id: runRef(SPEECH_MODELS[key]), buildInput: SPEECH_BUILDERS[key] },
  ]),
) as Record<string, ReplicateModelSpec>;

const VALID_MODELS: Model[] = [
  "elevenlabs",
  "openai-tts",
  "replicate-minimax-turbo",
  "replicate-minimax-hd",
  "replicate-chatterbox",
  "replicate-qwen",
  "replicate-clone",
  "replicate-inworld",
  "replicate-gemini-tts",
  "replicate-elevenlabs-v3",
];

const ELEVENLABS_MODEL_ID = SPEECH_NATIVE.elevenlabs.id;
const OPENAI_TTS_MODEL = SPEECH_NATIVE["openai-tts"].id;

// ============================================================================
// Types
// ============================================================================

const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

const DEFAULTS = {
  model: "elevenlabs" as Model,
  output: `${process.env.HOME}/Downloads/generated-speech.mp3`,
  voice: "main",
  speed: 1.0,
  stability: 0.5,
  similarityBoost: 0.75,
};

interface CLIArgs {
  model: Model;
  text: string;
  output: string;
  voice: string;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
  language?: string;
  voiceId?: string;
  emotion?: string;
  refAudio?: string;
  refText?: string;
  instruct?: string;
  /** content-safety: affirmative voice-owner-consent attestation (--consent-attested) */
  consentAttested?: boolean;
  exaggeration?: number;
  cfgWeight?: number;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
speak - Speech Generation CLI

Generate speech audio using multiple TTS providers and models.
Part of the DOS Speech Collection (peer to Art/Generate.ts for images).

USAGE:
  speak --model <model> --text "<text>" [OPTIONS]

REQUIRED:
  --model <model>      TTS provider/model (see MODELS below)
  --text <text>        Text to synthesize (quote if contains spaces)

MODELS:
  elevenlabs                Highest quality, voice cloning, emotional presets (MP3)
  openai-tts                OpenAI tts-1-hd, 10 built-in voices, fast (MP3)
  replicate-minimax-turbo   MiniMax Speech 2.8 Turbo — fast, 17 voices, emotions (MP3)
  replicate-minimax-hd      MiniMax Speech 2.8 HD — audiobooks, 32 languages (MP3)
  replicate-chatterbox      Chatterbox Turbo — voice clone from 5s, paralinguistic tags (WAV)
  replicate-qwen            Qwen3-TTS — multilingual, voice design from text (WAV)
  replicate-clone           MiniMax Voice Cloning — create voice_id from audio (utility)
  replicate-inworld         Inworld Realtime TTS 2 — steering, 90+ langs, low latency (MP3)
  replicate-gemini-tts      Google Gemini 3.1 Flash TTS — 30 voices, 86 langs, --instruct steering (WAV)
  replicate-elevenlabs-v3   ElevenLabs v3 — flagship TTS, audio-tag delivery (MP3)

COMMON OPTIONS:
  --output <path>            Output file path (default: ~/Downloads/generated-speech.mp3)
  --voice <id|name>          Voice name (ElevenLabs: settings.json, OpenAI: alloy/nova/etc, Qwen: preset)
  --speed <number>           Speed multiplier 0.25-4.0 (ElevenLabs, OpenAI, MiniMax)
  --language <code>          Language code (MiniMax: 32 langs, Qwen: Auto/en/zh/etc)

ELEVENLABS OPTIONS:
  --stability <number>       Voice stability 0.0-1.0 (default: 0.5)
  --similarity-boost <num>   Voice similarity boost 0.0-1.0 (default: 0.75)

MINIMAX OPTIONS (replicate-minimax-turbo, replicate-minimax-hd):
  --voice-id <id>            MiniMax voice: Deep_Voice_Man, Lively_Girl, Elegant_Man, etc.
  --emotion <type>           happy, calm, sad, angry, fearful, disgusted, surprised

CHATTERBOX OPTIONS (replicate-chatterbox):
  --ref-audio <url>          Reference audio URL for voice cloning (5-10s)
  --exaggeration <number>    Expressiveness 0.0-1.0 (default: 0.5)
  --cfg-weight <number>      Guidance weight 0.0-1.0 (default: 0.5)

QWEN OPTIONS (replicate-qwen):
  --instruct <text>          Natural language style instruction (e.g., "speak slowly and warmly")
  --ref-audio <url>          Reference audio for voice cloning
  --ref-text <text>          Transcript of reference audio

CLONE OPTIONS (replicate-clone):
  --ref-audio <url>          Audio file URL (5s+ for best results)

EXAMPLES:
  # ElevenLabs
  speak --model elevenlabs --text "Welcome to DOS" --voice fox

  # OpenAI TTS
  speak --model openai-tts --text "Algorithm complete" --voice nova --speed 1.1

  # MiniMax Turbo with emotion
  speak --model replicate-minimax-turbo --text "Great news!" --voice-id Lively_Girl --emotion happy

  # MiniMax HD in Portuguese
  speak --model replicate-minimax-hd --text "Bem-vindo" --language pt

  # Chatterbox voice clone
  speak --model replicate-chatterbox --text "Hello world" --ref-audio https://example.com/voice.wav

  # Qwen with voice design
  speak --model replicate-qwen --text "Hello" --instruct "speak slowly, deep male voice"

  # Qwen voice clone
  speak --model replicate-qwen --text "Clone this" --ref-audio https://example.com/ref.wav --ref-text "Original text"

ENVIRONMENT VARIABLES:
  ELEVENLABS_API_KEY     Required for elevenlabs
  OPENAI_API_KEY         Required for openai-tts
  REPLICATE_API_TOKEN    Required for all replicate-* models

MORE INFO:
  Documentation: ${DOS_DIR}/skills/media/Speech/SKILL.md
  Source: ${DOS_DIR}/skills/media/Speech/Tools/Speak.ts
`);
  process.exit(0);
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
  }

  const parsed: Partial<CLIArgs> = {
    model: DEFAULTS.model,
    output: DEFAULTS.output,
    voice: DEFAULTS.voice,
  };

  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;

    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}. Flags must start with --`);
    }

    const key = flag.slice(2);
    if (key === "consent-attested") {
      parsed.consentAttested = true;
      continue; // boolean flag — consumes no value
    }
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }

    switch (key) {
      case "model":
        if (!VALID_MODELS.includes(value as Model)) {
          throw new CLIError(
            `Invalid model: ${value}. Must be: ${VALID_MODELS.join(", ")}`,
          );
        }
        parsed.model = value as Model;
        i++;
        break;
      case "text":
        parsed.text = value;
        i++;
        break;
      case "output":
        parsed.output = value;
        i++;
        break;
      case "voice":
        parsed.voice = value;
        i++;
        break;
      case "speed": {
        const speed = parseFloat(value);
        if (isNaN(speed) || speed < 0.25 || speed > 4.0) {
          throw new CLIError(`Invalid speed: ${value}. Must be between 0.25 and 4.0`);
        }
        parsed.speed = speed;
        i++;
        break;
      }
      case "stability": {
        const stability = parseFloat(value);
        if (isNaN(stability) || stability < 0 || stability > 1) {
          throw new CLIError(`Invalid stability: ${value}. Must be between 0.0 and 1.0`);
        }
        parsed.stability = stability;
        i++;
        break;
      }
      case "similarity-boost": {
        const boost = parseFloat(value);
        if (isNaN(boost) || boost < 0 || boost > 1) {
          throw new CLIError(`Invalid similarity-boost: ${value}. Must be between 0.0 and 1.0`);
        }
        parsed.similarityBoost = boost;
        i++;
        break;
      }
      case "language":
        parsed.language = value;
        i++;
        break;
      case "voice-id":
        parsed.voiceId = value;
        i++;
        break;
      case "emotion":
        parsed.emotion = value;
        i++;
        break;
      case "ref-audio":
        parsed.refAudio = value;
        i++;
        break;
      case "ref-text":
        parsed.refText = value;
        i++;
        break;
      case "instruct":
        parsed.instruct = value;
        i++;
        break;
      case "exaggeration": {
        const ex = parseFloat(value);
        if (isNaN(ex) || ex < 0 || ex > 1) {
          throw new CLIError(`Invalid exaggeration: ${value}. Must be between 0.0 and 1.0`);
        }
        parsed.exaggeration = ex;
        i++;
        break;
      }
      case "cfg-weight": {
        const cw = parseFloat(value);
        if (isNaN(cw) || cw < 0 || cw > 1) {
          throw new CLIError(`Invalid cfg-weight: ${value}. Must be between 0.0 and 1.0`);
        }
        parsed.cfgWeight = cw;
        i++;
        break;
      }
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.text && parsed.model !== "replicate-clone") {
    throw new CLIError("Missing required argument: --text");
  }

  if (parsed.model === "replicate-clone" && !parsed.refAudio) {
    throw new CLIError("replicate-clone requires --ref-audio");
  }

  return parsed as CLIArgs;
}

// ============================================================================
// Voice Resolution (ElevenLabs)
// ============================================================================

interface VoiceEntry {
  voiceId: string;
  voiceName?: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
  volume: number;
}

function resolveVoice(
  voiceArg: string,
  overrides: { speed?: number; stability?: number; similarityBoost?: number },
): { voiceId: string; settings: Record<string, number | boolean> } {
  const settingsPath = resolve(process.env.HOME!, ".claude", "settings.json");
  let voices: Record<string, VoiceEntry> = {};

  try {
    const settingsText = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(settingsText);
    const voicesSection = settings.daidentity?.voices || {};

    for (const [name, config] of Object.entries(voicesSection)) {
      const entry = config as any;
      if (entry.voiceId) {
        voices[name] = {
          voiceId: entry.voiceId,
          voiceName: entry.voiceName,
          stability: entry.stability ?? 0.5,
          similarity_boost: entry.similarity_boost ?? entry.similarityBoost ?? 0.75,
          style: entry.style ?? 0.0,
          speed: entry.speed ?? 1.0,
          use_speaker_boost: entry.use_speaker_boost ?? entry.useSpeakerBoost ?? true,
          volume: entry.volume ?? 1.0,
        };
      }
    }
  } catch {
    // No settings.json or parse error
  }

  function entryToResult(entry: VoiceEntry) {
    return {
      voiceId: entry.voiceId,
      settings: {
        stability: overrides.stability ?? entry.stability,
        similarity_boost: overrides.similarityBoost ?? entry.similarity_boost,
        style: entry.style,
        speed: overrides.speed ?? entry.speed,
        use_speaker_boost: entry.use_speaker_boost,
      },
    };
  }

  const namedVoice = voices[voiceArg];
  if (namedVoice) return entryToResult(namedVoice);

  for (const entry of Object.values(voices)) {
    if (entry.voiceId === voiceArg) return entryToResult(entry);
  }

  return {
    voiceId: voiceArg,
    settings: {
      stability: overrides.stability ?? DEFAULTS.stability,
      similarity_boost: overrides.similarityBoost ?? DEFAULTS.similarityBoost,
      style: 0.0,
      speed: overrides.speed ?? DEFAULTS.speed,
      use_speaker_boost: true,
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function ensureExtension(path: string, targetExt: ".mp3" | ".wav"): string {
  const current = extname(path).toLowerCase();
  if (current === targetExt) return path;
  const replaced = path.replace(/\.[^.]+$/, targetExt);
  return replaced === path ? path + targetExt : replaced;
}

// ============================================================================
// Providers
// ============================================================================

async function generateWithElevenLabs(
  text: string,
  voiceId: string,
  voiceSettings: Record<string, number | boolean>,
  output: string,
): Promise<string> {
  console.log(
    `\uD83C\uDFA4 Generating with ElevenLabs (voice: ${voiceId}, speed: ${voiceSettings.speed})...`,
  );

  try {
    const result = await synthesizeElevenLabs({
      text,
      voiceId,
      modelId: ELEVENLABS_MODEL_ID,
      voiceSettings,
    });

    const finalPath = ensureExtension(output, ".mp3");
    await writeArtifact(finalPath, result.audioBuffer, {
      pack: "Media/Speech",
      workflow: "Speak",
      artifactType: "audio",
    });

    // Make the billing event visible when routing through Studio. This
    // is the "demo IS the billing event" UX — every voice notification
    // shows its own ledger tick.
    if (result.mode === "studio" && result.chargedCredits !== undefined) {
      const cache = result.cacheHit ? " (cache)" : "";
      console.log(
        `\u2705 Speech saved to ${finalPath} \u2014 ${result.chargedCredits} credits${cache} via Studio`,
      );
    } else {
      console.log(`\u2705 Speech saved to ${finalPath}`);
    }

    return finalPath;
  } catch (error) {
    // Translate the shim's GatewayError into a CLIError so the CLI
    // surface stays consistent with the rest of Speak.ts.
    const message = error instanceof Error ? error.message : String(error);
    throw new CLIError(`ElevenLabs synthesis failed: ${message}`);
  }
}

const OPENAI_TTS_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer",
];

async function generateWithOpenAITTS(
  text: string,
  voice: string,
  speed: number,
  output: string,
): Promise<string> {
  const ttsVoice = OPENAI_TTS_VOICES.includes(voice) ? voice : "alloy";
  if (!OPENAI_TTS_VOICES.includes(voice) && voice !== "main") {
    console.warn(`\u26A0\uFE0F Voice "${voice}" unavailable for OpenAI TTS. Using "${ttsVoice}".`);
  }

  console.log(`\uD83E\uDD16 Generating with OpenAI TTS (voice: ${ttsVoice}, speed: ${speed})...`);

  const result = await synthesizeOpenAITTS({
    text,
    voice: ttsVoice,
    model: OPENAI_TTS_MODEL,
    speed,
    responseFormat: "mp3",
  });

  const finalPath = ensureExtension(output, ".mp3");
  await writeArtifact(finalPath, result.audioBuffer, {
    pack: "Media/Speech",
    workflow: "Speak",
    artifactType: "audio",
  });
  if (result.chargedCredits) {
    console.log(`\u2705 Speech saved to ${finalPath} (${result.chargedCredits} credits via Studio)`);
  } else {
    console.log(`\u2705 Speech saved to ${finalPath}`);
  }
  return finalPath;
}

async function generateWithReplicate(
  modelKey: string,
  args: CLIArgs,
): Promise<string> {
  const spec = REPLICATE_MODELS[modelKey];
  if (!spec) {
    throw new CLIError(`Unknown Replicate model: ${modelKey}`);
  }

  // Content-safety gate (voice-clone) — fires only when a reference voice sample is
  // present (biometric cloning); plain TTS passes through untouched.
  const attestation = enforceConsent(
    "voice-clone",
    { hasVoiceSample: !!args.refAudio },
    args.consentAttested ?? false,
  );

  const input = spec.buildInput(args);
  console.log(`\uD83D\uDD01 Generating with Replicate ${spec.id}...`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(spec.id as `${string}/${string}`, { input });

  const audioBuffer = await replicateResultToBuffer(result);
  const finalPath = ensureExtension(args.output, spec.outputExt);
  await writeArtifact(finalPath, audioBuffer, {
    pack: "Media/Speech",
    workflow: "Speak",
    artifactType: "audio",
    ...(attestation ?? {}),
  });
  console.log(`\u2705 Speech saved to ${finalPath}`);
  return finalPath;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();

    const args = parseArgs(process.argv);

    const pronunciationsPath = resolve(DOS_DIR, "VoiceServer", "pronunciations.json");
    const rules = loadPronunciationRules(pronunciationsPath);
    if (rules.length > 0) {
      console.log(`\uD83D\uDCD6 Loaded ${rules.length} pronunciation rules`);
    }

    const processedText = applyPronunciations(args.text, rules);
    if (processedText !== args.text) {
      console.log(`\uD83D\uDCD6 Pronunciation: "${args.text}" \u2192 "${processedText}"`);
    }
    args.text = processedText;

    if (args.model === "elevenlabs") {
      const { voiceId, settings } = resolveVoice(args.voice, {
        speed: args.speed,
        stability: args.stability,
        similarityBoost: args.similarityBoost,
      });
      await generateWithElevenLabs(args.text, voiceId, settings, args.output);
    } else if (args.model === "openai-tts") {
      await generateWithOpenAITTS(args.text, args.voice, args.speed ?? DEFAULTS.speed, args.output);
    } else if (args.model.startsWith("replicate-")) {
      await generateWithReplicate(args.model, args);
    }
  } catch (error) {
    handleError(error);
  }
}

main();
