#!/usr/bin/env bun

/**
 * upscale - Image Upscaling CLI
 *
 * Upscale and enhance image resolution using multiple AI models.
 * Part of the DOS Image Upscale Collection.
 *
 * Usage:
 *   upscale --model recraft --image photo.jpg --output ~/Downloads/upscaled.png
 *
 * @see Packs/media/src/ImageUpscale/SKILL.md
 */

import Replicate from "../../Lib/gateway.ts";
import { readFile, writeFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { resolve, extname } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import { UPSCALE_MODELS, runRef, type CatalogBase, type UpscaleModelKey } from "../../Lib/catalog.ts";

// ============================================================================
// Model Registry — model data sourced from Lib/catalog.ts (single source of truth)
// ============================================================================

type Model = UpscaleModelKey;

interface ReplicateModelSpec extends CatalogBase {
  buildInput: (args: CLIArgs) => Record<string, unknown>;
}

// buildInput factories — behavior stays in the tool (coupled to local CLIArgs).
const UPSCALE_BUILDERS: Record<Model, ReplicateModelSpec["buildInput"]> = {
  "recraft": (args) => ({
    image: args.image,
  }),
  "google": (args) => ({
    image: args.image,
    ...(args.scale !== undefined && { upscale_factor: `${args.scale}x` }),
    ...(args.quality !== undefined && { compression_quality: args.quality }),
  }),
  "real-esrgan": (args) => ({
    image: args.image,
    ...(args.scale !== undefined && { scale: args.scale }),
    ...(args.faceEnhance && { face_enhance: true }),
  }),
  "clarity": (args) => ({
    image: args.image,
    ...(args.prompt && { prompt: args.prompt }),
    ...(args.scale !== undefined && { scale_factor: args.scale }),
    ...(args.dynamic !== undefined && { dynamic: args.dynamic }),
    ...(args.creativity !== undefined && { creativity: args.creativity }),
    ...(args.resemblance !== undefined && { resemblance: args.resemblance }),
    ...(args.outputFormat && { output_format: args.outputFormat }),
  }),
  // Pruna: --scale drives factor mode; otherwise model defaults (target 4MP).
  "pruna": (args) => ({
    image: args.image,
    ...(args.scale !== undefined && { upscale_mode: "factor", factor: args.scale }),
    ...(args.quality !== undefined && { output_quality: args.quality }),
    ...(args.outputFormat && { output_format: args.outputFormat }),
  }),
  // Clarity Pro: scale_factor enum 2/4/8/16; creativity -10..10.
  "clarity-pro": (args) => ({
    image: args.image,
    ...(args.scale !== undefined && { scale_factor: args.scale }),
    ...(args.creativity !== undefined && { creativity: args.creativity }),
    ...(args.outputFormat && { output_format: args.outputFormat }),
  }),
};

// Compose the runtime registry: catalog data + local buildInput behavior.
const MODEL_REGISTRY = Object.fromEntries(
  (Object.keys(UPSCALE_MODELS) as Model[]).map((key) => [
    key,
    { ...UPSCALE_MODELS[key], id: runRef(UPSCALE_MODELS[key]), buildInput: UPSCALE_BUILDERS[key] },
  ]),
) as Record<Model, ReplicateModelSpec>;

const VALID_MODELS: Model[] = Object.keys(UPSCALE_MODELS) as Model[];

// ============================================================================
// Configuration
// ============================================================================

const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

const DEFAULTS = {
  model: "recraft" as Model,
  output: `${process.env.HOME}/Downloads/upscaled.png`,
};

// ============================================================================
// Types
// ============================================================================

interface CLIArgs {
  model: Model;
  image: string;
  output: string;
  scale?: number;
  faceEnhance?: boolean;
  quality?: number;
  prompt?: string;
  creativity?: number;
  resemblance?: number;
  dynamic?: number;
  outputFormat?: string;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
upscale - Image Upscaling CLI

Upscale and enhance image resolution using multiple AI models.
Part of the DOS Image Upscale Collection.

USAGE:
  upscale --model <model> --image <path|url> [OPTIONS]

REQUIRED:
  --model <model>          Upscale model: recraft, google, real-esrgan, clarity
  --image <path|url>       Input image (local path or URL)

MODELS:
  recraft                  Recraft Crisp Upscale — simple, high quality, just image in
  google                   Google Upscaler — 2x or 4x, compression quality control
  real-esrgan              Real-ESRGAN — scalable upscale, optional face enhancement (GFPGAN)
  clarity                  Clarity Upscaler — prompt-guided, HDR, creativity/resemblance
  pruna                    Pruna P-Image — very fast, up to 128MP (--scale = factor)
  clarity-pro              Clarity Pro — identity-preserving, --scale 2/4/8/16, --creativity

COMMON OPTIONS:
  --output <path>            Output file path (default: ~/Downloads/upscaled.png)
  --scale <number>           Scale factor (google: 2 or 4, real-esrgan: number, clarity: number)

GOOGLE OPTIONS:
  --quality <1-100>          Compression quality (1-100, higher = less compression)

REAL-ESRGAN OPTIONS:
  --face-enhance             Run GFPGAN face enhancement (boolean flag, no value)

CLARITY OPTIONS:
  --prompt <text>            Guidance prompt for upscaling direction
  --creativity <0.3-0.9>     Creative freedom (lower = more faithful)
  --resemblance <0.3-1.6>   Resemblance to original (higher = more faithful)
  --dynamic <3-9>            HDR effect intensity
  --output-format <fmt>      Output format (png, jpg, webp)

EXAMPLES:
  # Recraft — simple high quality upscale
  upscale --model recraft --image ~/Downloads/photo.jpg

  # Google — 4x upscale with quality control
  upscale --model google --image ~/Downloads/small.png --scale 4 --quality 90

  # Real-ESRGAN — upscale with face enhancement
  upscale --model real-esrgan --image ~/Downloads/portrait.jpg --scale 4 --face-enhance

  # Clarity — creative upscale with prompt guidance
  upscale --model clarity --image ~/Downloads/landscape.jpg \\
    --prompt "sharp detailed landscape, 8k" --scale 2 --creativity 0.5

  # Clarity — HDR enhancement
  upscale --model clarity --image ~/Downloads/photo.jpg \\
    --dynamic 6 --resemblance 1.2 --output-format webp

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN    Required for all models

MORE INFO:
  Documentation: ${DOS_DIR}/skills/media/ImageUpscale/SKILL.md
  Source: ${DOS_DIR}/skills/media/ImageUpscale/Tools/Upscale.ts
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

    if (key === "face-enhance") { parsed.faceEnhance = true; continue; }

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
      case "image":
        parsed.image = value;
        i++;
        break;
      case "output":
        parsed.output = value;
        i++;
        break;
      case "scale": {
        const s = parseFloat(value);
        if (isNaN(s) || s < 1) {
          throw new CLIError(`Invalid scale: ${value}. Must be >= 1`);
        }
        parsed.scale = s;
        i++;
        break;
      }
      case "quality": {
        const q = parseInt(value, 10);
        if (isNaN(q) || q < 1 || q > 100) {
          throw new CLIError(`Invalid quality: ${value}. Must be between 1 and 100`);
        }
        parsed.quality = q;
        i++;
        break;
      }
      case "prompt":
        parsed.prompt = value;
        i++;
        break;
      case "creativity": {
        const c = parseFloat(value);
        if (isNaN(c) || c < 0.3 || c > 0.9) {
          throw new CLIError(`Invalid creativity: ${value}. Must be between 0.3 and 0.9`);
        }
        parsed.creativity = c;
        i++;
        break;
      }
      case "resemblance": {
        const r = parseFloat(value);
        if (isNaN(r) || r < 0.3 || r > 1.6) {
          throw new CLIError(`Invalid resemblance: ${value}. Must be between 0.3 and 1.6`);
        }
        parsed.resemblance = r;
        i++;
        break;
      }
      case "dynamic": {
        const d = parseInt(value, 10);
        if (isNaN(d) || d < 3 || d > 9) {
          throw new CLIError(`Invalid dynamic: ${value}. Must be between 3 and 9`);
        }
        parsed.dynamic = d;
        i++;
        break;
      }
      case "output-format":
        parsed.outputFormat = value;
        i++;
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.image) {
    throw new CLIError("Missing required argument: --image");
  }

  return parsed as CLIArgs;
}

// ============================================================================
// Provider
// ============================================================================

async function upscaleImage(args: CLIArgs): Promise<string> {
  const spec = MODEL_REGISTRY[args.model];

  // Convert local files to data URIs for Replicate
  let imageInput = args.image;
  if (!args.image.startsWith("http") && !args.image.startsWith("data:")) {
    const imageBuffer = await readFile(resolve(args.image));
    const ext = extname(args.image).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : ext === ".webp" ? "image/webp" : "image/png";
    imageInput = `data:${mime};base64,${imageBuffer.toString("base64")}`;
  }

  const input = spec.buildInput({ ...args, image: imageInput });
  console.log(`\uD83D\uDD0D Upscaling with ${spec.id.split(":")[0]}...`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(spec.id as `${string}/${string}` | `${string}/${string}:${string}`, { input });

  const outputBuffer = await replicateResultToBuffer(result);
  await writeArtifact(args.output, outputBuffer, {
    pack: "Media/ImageUpscale",
    workflow: "Upscale",
    artifactType: "image",
  });
  console.log(`\u2705 Upscaled image saved to ${args.output}`);
  return args.output;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);
    await upscaleImage(args);
  } catch (error) {
    handleError(error);
  }
}

main();
