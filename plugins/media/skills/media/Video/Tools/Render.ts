#!/usr/bin/env bun

/**
 * render - AI Video Generation CLI
 *
 * Generate videos using multiple AI video models via Replicate.
 * Follows the same Collections pattern as Generate.ts (images) and Speak.ts (speech).
 *
 * Models: Seedance, Grok Video, Gen-4.5, Kling V3, Kling Turbo, Veo Fast, Veo, Wan I2V
 *
 * Usage:
 *   render --model seedance --prompt "A cat walking on the moon" --output /tmp/video.mp4
 *   render --model veo --prompt "Ocean waves at sunset" --image /tmp/frame.png --generate-audio
 *
 * @see Packs/media/src/Video/SKILL.md
 */

import Replicate from "../../Lib/gateway.ts";
import { writeFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { resolve, extname } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import { VIDEO_MODELS as VIDEO_CATALOG, runRef, type VideoModelData, type VideoModelKey } from "../../Lib/catalog.ts";

// ============================================================================
// Model Registry — model data sourced from Lib/catalog.ts (single source of truth)
// ============================================================================

type Model = VideoModelKey;

const VALID_MODELS: Model[] = Object.keys(VIDEO_CATALOG) as Model[];

interface CLIArgs {
  model: Model;
  prompt: string;
  output: string;
  image?: string;
  lastFrame?: string;
  referenceImages?: string[];
  video?: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
  generateAudio?: boolean;
  noAudio?: boolean;
  negativePrompt?: string;
  seed?: number;
  numFrames?: number;
}

interface ReplicateVideoModelSpec extends VideoModelData {
  buildInput: (args: CLIArgs) => Record<string, unknown>;
}

// ============================================================================
// Audio Control Helper
// ============================================================================

function resolveAudioFlag(args: CLIArgs, supportsAudio: boolean): boolean | undefined {
  if (!supportsAudio) return undefined;
  if (args.noAudio) return false;
  return true; // default: audio enabled
}

// ============================================================================
// Model Definitions
// ============================================================================

// buildInput factories — behavior stays in the tool (coupled to local CLIArgs).
// Model data (id, capability flags, version) lives in Lib/catalog.ts.
const VIDEO_BUILDERS: Record<Model, ReplicateVideoModelSpec["buildInput"]> = {
  seedance: (args) => ({
    prompt: args.prompt,
    ...(args.image && { image: args.image }),
    ...(args.lastFrame && { last_frame_image: args.lastFrame }),
    ...(args.referenceImages && args.referenceImages.length > 0 && {
      reference_images: args.referenceImages.slice(0, 9),
    }),
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    generate_audio: resolveAudioFlag(args, true) ?? true,
    ...(args.resolution && { resolution: args.resolution }),
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
  "grok-video": (args) => ({
    prompt: args.prompt,
    ...(args.image && { image: args.image }),
    ...(args.video && { video: args.video }),
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.resolution && { resolution: args.resolution }),
  }),
  "gen-4.5": (args) => ({
    prompt: args.prompt,
    ...(args.image && { image: args.image }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
  "kling-v3": (args) => ({
    prompt: args.prompt,
    ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
    ...(args.image && { start_image: args.image }),
    ...(args.lastFrame && { end_image: args.lastFrame }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.duration !== undefined && { duration: args.duration }),
    generate_audio: resolveAudioFlag(args, true) ?? true,
  }),
  "kling-turbo": (args) => ({
    prompt: args.prompt,
    ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
    ...(args.image && { start_image: args.image }),
    ...(args.lastFrame && { end_image: args.lastFrame }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.duration !== undefined && { duration: args.duration }),
  }),
  "veo-fast": (args) => ({
    prompt: args.prompt,
    ...(args.image && { image: args.image }),
    ...(args.lastFrame && { last_frame: args.lastFrame }),
    ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.resolution && { resolution: args.resolution }),
    generate_audio: resolveAudioFlag(args, true) ?? true,
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
  veo: (args) => ({
    prompt: args.prompt,
    ...(args.image && { image: args.image }),
    ...(args.lastFrame && { last_frame: args.lastFrame }),
    ...(args.referenceImages && args.referenceImages.length > 0 && {
      reference_images: args.referenceImages.slice(0, 3),
    }),
    ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.resolution && { resolution: args.resolution }),
    generate_audio: resolveAudioFlag(args, true) ?? true,
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
  "wan-i2v": (args) => ({
    prompt: args.prompt,
    image: args.image!,
    ...(args.lastFrame && { last_image: args.lastFrame }),
    ...(args.numFrames !== undefined && { num_frames: args.numFrames }),
    ...(args.resolution && { resolution: args.resolution }),
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
  // Sora: start frame is `input_reference`, duration key is `seconds`, audio is automatic.
  "sora-2": (args) => ({
    prompt: args.prompt,
    ...(args.image && { input_reference: args.image }),
    ...(args.duration !== undefined && { seconds: args.duration }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
  }),
  "sora-2-pro": (args) => ({
    prompt: args.prompt,
    ...(args.image && { input_reference: args.image }),
    ...(args.duration !== undefined && { seconds: args.duration }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.resolution && { resolution: args.resolution }),
  }),
  // Kling Omni: start/end frame, up to 7 refs, generate_audio toggle (resolution is `mode`, left default).
  "kling-omni": (args) => ({
    prompt: args.prompt,
    ...(args.image && { start_image: args.image }),
    ...(args.lastFrame && { end_image: args.lastFrame }),
    ...(args.referenceImages && args.referenceImages.length > 0 && {
      reference_images: args.referenceImages.slice(0, 7),
    }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.duration !== undefined && { duration: args.duration }),
    generate_audio: resolveAudioFlag(args, true) ?? true,
  }),
  // Hailuo: start frame is `first_frame_image`; aspect ratio is image-inferred (no key).
  "hailuo-2.3": (args) => ({
    prompt: args.prompt,
    ...(args.image && { first_frame_image: args.image }),
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.resolution && { resolution: args.resolution }),
  }),
  // Grok 1.5: image-to-video (start image is `image`), audio is automatic.
  "grok-video-1.5": (args) => ({
    prompt: args.prompt,
    ...(args.image && { image: args.image }),
    ...(args.duration !== undefined && { duration: args.duration }),
    ...(args.aspectRatio && { aspect_ratio: args.aspectRatio }),
    ...(args.resolution && { resolution: args.resolution }),
  }),
};

// Compose the runtime registry: catalog data + local buildInput behavior.
const VIDEO_MODELS = Object.fromEntries(
  (Object.keys(VIDEO_CATALOG) as Model[]).map((key) => [
    key,
    { ...VIDEO_CATALOG[key], id: runRef(VIDEO_CATALOG[key]), buildInput: VIDEO_BUILDERS[key] },
  ]),
) as Record<Model, ReplicateVideoModelSpec>;

// ============================================================================
// Defaults
// ============================================================================

const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

const DEFAULTS = {
  model: "seedance" as Model,
  output: `${process.env.HOME}/Downloads/generated-video.mp4`,
};

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
render - AI Video Generation CLI

Generate videos using multiple AI video models via Replicate.
Part of the DOS Video Collection (peer to Art/Generate.ts for images, Speech/Speak.ts for audio).

USAGE:
  render --model <model> --prompt "<prompt>" [OPTIONS]

REQUIRED:
  --model <model>        Video model (see MODELS below)
  --prompt <text>        Text prompt describing the video

MODELS:
  seedance               ByteDance Seedance 2.0 — high-quality with audio, ref images (max 9)
  grok-video             xAI Grok Imagine Video — text/image-to-video with editing
  gen-4.5                Runway Gen-4.5 — cinematic quality, image-to-video
  kling-v3               Kling V3 — start/end frame, audio, negative prompt (3-15s)
  kling-turbo            Kling V2.5 Turbo Pro — fast, start/end frame
  veo-fast               Google Veo 3.1 Fast — quick with audio, negative prompt
  veo                    Google Veo 3.1 — highest quality, ref images (max 3), audio
  wan-i2v                Wan 2.2 I2V Fast — image-to-video (image REQUIRED)
  sora-2                 OpenAI Sora 2 — t2v/i2v with synced audio
  sora-2-pro             OpenAI Sora 2 Pro — higher quality, selectable resolution
  kling-omni             Kling V3 Omni — multimodal, start/end frame, refs (max 7), audio
  hailuo-2.3             MiniMax Hailuo 2.3 — t2v/i2v, 768p/1080p
  grok-video-1.5         xAI Grok Imagine Video 1.5 — image-to-video with synced audio

COMMON OPTIONS:
  --output <path>        Output file path (default: ~/Downloads/generated-video.mp4)
  --image <url|path>     First frame / input image
  --last-frame <url>     Last frame image (seedance, kling-v3, veo, veo-fast, wan-i2v)
  --duration <seconds>   Video duration in seconds
  --aspect-ratio <r>     Aspect ratio (e.g., 16:9, 9:16, 1:1)
  --resolution <res>     Resolution (480p, 720p, 1080p)
  --seed <number>        Random seed for reproducibility

AUDIO OPTIONS (seedance, kling-v3, veo, veo-fast):
  --generate-audio       Enable audio generation (default: enabled)
  --no-audio             Disable audio generation

NEGATIVE PROMPT (kling-v3, kling-turbo, veo, veo-fast):
  --negative-prompt <t>  What to exclude from the video

REFERENCE IMAGES:
  --ref-images <urls>    Comma-separated reference image URLs
                         seedance: max 9, veo: max 3

MODEL-SPECIFIC OPTIONS:
  --video <url>          Input video for editing (grok-video only)
  --num-frames <n>       Number of frames (wan-i2v only)

EXAMPLES:
  # Text-to-video with Seedance
  render --model seedance --prompt "A fox running through autumn forest"

  # Image-to-video with Veo 3.1
  render --model veo --prompt "Camera slowly zooms out" --image https://example.com/frame.png

  # Kling V3 with start and end frames
  render --model kling-v3 --prompt "Smooth transition" --image start.png --last-frame end.png

  # Fast generation without audio
  render --model veo-fast --prompt "Abstract patterns" --no-audio

  # Grok video editing
  render --model grok-video --prompt "Add cinematic color grade" --video https://example.com/input.mp4

  # Wan image-to-video (image required)
  render --model wan-i2v --prompt "Gentle breeze" --image https://example.com/photo.jpg --num-frames 81

  # With reference images
  render --model veo --prompt "Style transfer" --ref-images img1.png,img2.png,img3.png

  # Custom output and resolution
  render --model gen-4.5 --prompt "Ocean waves" --resolution 1080p --output /tmp/ocean.mp4

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN    Required for all models

MORE INFO:
  Source: ${DOS_DIR}/skills/media/Video/Tools/Render.ts
`);
  process.exit(0);
}

// ============================================================================
// Helpers
// ============================================================================

function ensureExtension(path: string, targetExt: string): string {
  const current = extname(path).toLowerCase();
  if (current === targetExt) return path;
  const replaced = path.replace(/\.[^.]+$/, targetExt);
  return replaced === path ? path + targetExt : replaced;
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

    // Boolean flags (no value)
    if (key === "no-audio") {
      parsed.noAudio = true;
      continue;
    }
    if (key === "generate-audio") {
      parsed.generateAudio = true;
      continue;
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
      case "prompt":
        parsed.prompt = value;
        i++;
        break;
      case "output":
        parsed.output = value;
        i++;
        break;
      case "image":
        parsed.image = value;
        i++;
        break;
      case "last-frame":
        parsed.lastFrame = value;
        i++;
        break;
      case "ref-images":
        parsed.referenceImages = value.split(",").map((s) => s.trim());
        i++;
        break;
      case "video":
        parsed.video = value;
        i++;
        break;
      case "duration": {
        const dur = parseFloat(value);
        if (isNaN(dur) || dur <= 0) {
          throw new CLIError(`Invalid duration: ${value}. Must be a positive number`);
        }
        parsed.duration = dur;
        i++;
        break;
      }
      case "aspect-ratio":
        parsed.aspectRatio = value;
        i++;
        break;
      case "resolution":
        parsed.resolution = value;
        i++;
        break;
      case "negative-prompt":
        parsed.negativePrompt = value;
        i++;
        break;
      case "seed": {
        const seed = parseInt(value, 10);
        if (isNaN(seed)) {
          throw new CLIError(`Invalid seed: ${value}. Must be an integer`);
        }
        parsed.seed = seed;
        i++;
        break;
      }
      case "num-frames": {
        const nf = parseInt(value, 10);
        if (isNaN(nf) || nf <= 0) {
          throw new CLIError(`Invalid num-frames: ${value}. Must be a positive integer`);
        }
        parsed.numFrames = nf;
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

  // wan-i2v requires image
  if (parsed.model === "wan-i2v" && !parsed.image) {
    throw new CLIError("wan-i2v requires --image (image-to-video model)");
  }

  // Validate ref images count
  if (parsed.referenceImages && parsed.model) {
    const spec = VIDEO_MODELS[parsed.model as Model];
    if (!spec.supportsRefImages) {
      throw new CLIError(`Model ${parsed.model} does not support --ref-images`);
    }
    if (parsed.referenceImages.length > spec.maxRefImages) {
      console.warn(
        `\u26A0\uFE0F ${parsed.model} supports max ${spec.maxRefImages} reference images. Truncating.`,
      );
    }
  }

  return parsed as CLIArgs;
}

// ============================================================================
// Video Generation
// ============================================================================

async function generateVideo(args: CLIArgs): Promise<string> {
  const spec = VIDEO_MODELS[args.model];
  if (!spec) {
    throw new CLIError(`Unknown model: ${args.model}`);
  }

  const input = spec.buildInput(args);
  console.log(`\uD83C\uDFAC Generating video with ${spec.id}...`);
  console.log(`   Prompt: "${args.prompt.slice(0, 80)}${args.prompt.length > 80 ? "..." : ""}"`);
  if (args.image) console.log(`   Image: ${args.image}`);
  if (args.duration) console.log(`   Duration: ${args.duration}s`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(spec.id as `${string}/${string}`, { input });

  const videoBuffer = await replicateResultToBuffer(result);
  const finalPath = ensureExtension(args.output, ".mp4");
  await writeArtifact(finalPath, videoBuffer, {
    pack: "Media/Video",
    workflow: "Render",
    artifactType: "video",
  });
  console.log(`\u2705 Video saved to ${finalPath}`);
  return finalPath;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);
    await generateVideo(args);
  } catch (error) {
    handleError(error);
  }
}

main();
