#!/usr/bin/env bun

/**
 * compose - Music Generation CLI
 *
 * Generate music using multiple AI models.
 * Part of the DOS Music Collection.
 *
 * Usage:
 *   compose --model elevenlabs --prompt "upbeat electronic jingle" --output ~/Downloads/track.mp3
 *
 * @see Packs/media/src/Music/SKILL.md
 */

import Replicate from "../../Lib/gateway.ts";
import { readFile, writeFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { resolve, extname } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { enforceConsent } from "../../Lib/consent-gate.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import { MUSIC_MODELS, runRef, type MusicModelData, type MusicModelKey } from "../../Lib/catalog.ts";

// ============================================================================
// Model Registry — model data sourced from Lib/catalog.ts (single source of truth)
// ============================================================================

type Model = MusicModelKey;

interface ModelSpec extends MusicModelData {
  buildInput: (args: CLIArgs) => Record<string, unknown>;
}

// buildInput factories — behavior stays in the tool (coupled to local CLIArgs).
const MUSIC_BUILDERS: Record<Model, ModelSpec["buildInput"]> = {
  "elevenlabs": (args) => ({
    prompt: args.prompt,
    ...(args.duration !== undefined && { music_length_ms: args.duration * 1000 }),
    ...(args.instrumental !== undefined && { force_instrumental: args.instrumental }),
    ...(args.outputFormat && { output_format: args.outputFormat }),
  }),
  "minimax": (args) => {
    if (!args.lyrics) {
      throw new CLIError("minimax model requires --lyrics (use structure tags: [intro][verse][chorus][bridge][outro])");
    }
    return {
      prompt: args.prompt,
      lyrics: args.lyrics,
      ...(args.outputFormat && { audio_format: args.outputFormat }),
    };
  },
  "ace-step": (args) => ({
    tags: args.prompt,
    ...(args.lyrics && { lyrics: args.lyrics }),
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
  // MiniMax Music 2.5: lyrics required; length derived from lyrics (no duration).
  "minimax-2.5": (args) => {
    if (!args.lyrics) {
      throw new CLIError("minimax-2.5 model requires --lyrics (use structure tags: [Intro][Verse][Chorus][Bridge][Outro])");
    }
    return {
      lyrics: args.lyrics,
      ...(args.prompt && { prompt: args.prompt }),
      ...(args.outputFormat && { audio_format: args.outputFormat }),
    };
  },
  // Lyria 2: instrumental from prompt; no lyrics, no duration. Seedable.
  "lyria": (args) => ({
    prompt: args.prompt,
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
  // Stable Audio 2.5: prompt + duration in seconds (<=190). Seedable.
  "stable-audio": (args) => ({
    prompt: args.prompt,
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
};

// Compose the runtime registry: catalog data + local buildInput behavior.
const MODEL_REGISTRY = Object.fromEntries(
  (Object.keys(MUSIC_MODELS) as Model[]).map((key) => [
    key,
    { ...MUSIC_MODELS[key], id: runRef(MUSIC_MODELS[key]), buildInput: MUSIC_BUILDERS[key] },
  ]),
) as Record<Model, ModelSpec>;

const VALID_MODELS: Model[] = Object.keys(MUSIC_MODELS) as Model[];

// ============================================================================
// Configuration
// ============================================================================

const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

const DEFAULTS = {
  model: "elevenlabs" as Model,
  output: `${process.env.HOME}/Downloads/generated-music.mp3`,
};

// ============================================================================
// Types
// ============================================================================

interface CLIArgs {
  model: Model;
  prompt: string;
  output: string;
  lyrics?: string;
  duration?: number;
  instrumental?: boolean;
  outputFormat?: string;
  seed?: number;
  /** content-safety: affirmative copyright/style-mimicry acknowledgment (--consent-attested) */
  consentAttested?: boolean;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
compose - Music Generation CLI

Generate music using multiple AI models.
Part of the DOS Music Collection.

USAGE:
  compose --model <model> --prompt "<description>" [OPTIONS]

REQUIRED:
  --model <model>        Music model: elevenlabs, minimax, ace-step
  --prompt <text>        Music description (elevenlabs/minimax) or genre/mood tags (ace-step)

MODELS:
  elevenlabs             ElevenLabs Music — high quality, instrumental or vocal, multiple formats
  minimax                MiniMax Music 1.5 — lyrics with structure tags, high quality
  ace-step               ACE-Step — open source, genre/mood tags, optional lyrics, variable duration
  minimax-2.5            MiniMax Music 2.5 — lyrics with structure tags, full-length songs
  lyria                  Google Lyria 2 — 48kHz stereo instrumental from a prompt
  stable-audio           Stable Audio 2.5 — music + SFX, duration up to 190s, seedable

COMMON OPTIONS:
  --output <path>            Output file path (default: ~/Downloads/generated-music.mp3)
  --lyrics <text>            Song lyrics with structure tags [intro][verse][chorus][bridge][outro]
                             (REQUIRED for minimax, optional for ace-step)
  --duration <seconds>       Duration in seconds (elevenlabs: converted to ms, ace-step: direct)
  --output-format <fmt>      Audio format (elevenlabs: mp3_standard, mp3_high_quality, wav_cd_quality)
                             (minimax: audio format string)

ELEVENLABS OPTIONS:
  --instrumental             Force instrumental (no vocals)

ACE-STEP OPTIONS:
  --seed <number>            Random seed for reproducible results

EXAMPLES:
  # ElevenLabs — instrumental jingle
  compose --model elevenlabs --prompt "upbeat electronic jingle, 120 BPM" --instrumental --duration 30

  # ElevenLabs — high quality format
  compose --model elevenlabs --prompt "cinematic orchestral intro" --output-format wav_cd_quality

  # MiniMax — full song with lyrics
  compose --model minimax --prompt "indie folk ballad, acoustic guitar" \\
    --lyrics "[verse]Walking down the road again[chorus]Take me home tonight"

  # ACE-Step — genre tags with lyrics
  compose --model ace-step --prompt "pop,female vocal,upbeat,synth" \\
    --lyrics "[verse]Stars above the city lights[chorus]We dance until the dawn" --duration 120

  # ACE-Step — random duration instrumental
  compose --model ace-step --prompt "lo-fi,chill,hip-hop,instrumental" --seed 42

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN    Required for all models

MORE INFO:
  Documentation: ${DOS_DIR}/skills/media/Music/SKILL.md
  Source: ${DOS_DIR}/skills/media/Music/Tools/Compose.ts
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
  };

  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;

    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}. Flags must start with --`);
    }

    const key = flag.slice(2);

    if (key === "instrumental") { parsed.instrumental = true; continue; }
    if (key === "consent-attested") { parsed.consentAttested = true; continue; }

    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }

    switch (key) {
      case "model":
        if (!VALID_MODELS.includes(value as Model)) {
          throw new CLIError(`Invalid model: ${value}. Must be: ${VALID_MODELS.join(", ")}`);
        }
        parsed.model = value as Model;
        i++;
        break;
      case "prompt":
        parsed.prompt = value;
        i++;
        break;
      case "output":
        parsed.output = value;
        i++;
        break;
      case "lyrics":
        parsed.lyrics = value;
        i++;
        break;
      case "duration": {
        const d = parseFloat(value);
        if (isNaN(d) || d <= 0) {
          throw new CLIError(`Invalid duration: ${value}. Must be a positive number (seconds)`);
        }
        parsed.duration = d;
        i++;
        break;
      }
      case "output-format":
        parsed.outputFormat = value;
        i++;
        break;
      case "seed": {
        parsed.seed = parseInt(value, 10);
        i++;
        break;
      }
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.prompt) {
    throw new CLIError("Missing required argument: --prompt");
  }

  return parsed as CLIArgs;
}

// ============================================================================
// Provider
// ============================================================================

function ensureExtension(path: string, targetExt: ".mp3" | ".wav"): string {
  const current = extname(path).toLowerCase();
  if (current === targetExt) return path;
  const replaced = path.replace(/\.[^.]+$/, targetExt);
  return replaced === path ? path + targetExt : replaced;
}

async function generateMusic(args: CLIArgs): Promise<string> {
  // Content-safety gate (music-style) — fires only when the prompt mimics a named
  // artist's style (copyright / right-of-publicity risk); generic prompts pass through.
  const attestation = enforceConsent(
    "music-style",
    { prompt: args.prompt },
    args.consentAttested ?? false,
  );

  const spec = MODEL_REGISTRY[args.model];
  const input = spec.buildInput(args);

  console.log(`\uD83C\uDFB5 Generating music with ${spec.id.split(":")[0]}...`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(spec.id as `${string}/${string}` | `${string}/${string}:${string}`, { input });

  const audioBuffer = await replicateResultToBuffer(result);
  const finalPath = ensureExtension(args.output, spec.outputExt);
  await writeArtifact(finalPath, audioBuffer, {
    pack: "Media/Music",
    workflow: "Compose",
    artifactType: "audio",
    ...(attestation ?? {}),
  });
  console.log(`\u2705 Music saved to ${finalPath}`);
  return finalPath;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);
    await generateMusic(args);
  } catch (error) {
    handleError(error);
  }
}

main();
