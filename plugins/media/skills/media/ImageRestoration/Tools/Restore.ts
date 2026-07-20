#!/usr/bin/env bun

/**
 * restore - Image Restoration CLI
 *
 * Restore, enhance, and upscale images using multiple AI models.
 * Part of the DOS Image Restoration Collection.
 *
 * Usage:
 *   restore --model codeformer --image old-photo.jpg --output ~/Downloads/restored.png
 *
 * @see Packs/media/src/ImageRestoration/SKILL.md
 */

import Replicate from "../../Lib/gateway.ts";
import { readFile, writeFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { resolve, extname } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import { RESTORE_MODELS, runRef, type RestoreModelData, type RestoreModelKey } from "../../Lib/catalog.ts";

// ============================================================================
// Model Registry — model data sourced from Lib/catalog.ts (single source of truth)
// ============================================================================

type Model = RestoreModelKey;

interface ReplicateModelSpec extends RestoreModelData {
  buildInput: (args: CLIArgs) => Record<string, unknown>;
}

// buildInput factories — behavior stays in the tool (coupled to local CLIArgs).
const RESTORE_BUILDERS: Record<Model, ReplicateModelSpec["buildInput"]> = {
  "flux-restore": (args) => {
    let imageInput = args.image;
    if (!imageInput.startsWith("http") && !imageInput.startsWith("data:")) {
      // Will be converted to data URI in the provider function
    }
    return {
      input_image: imageInput,
      ...(args.outputFormat && { output_format: args.outputFormat }),
      ...(args.seed !== undefined && { seed: args.seed }),
    };
  },
  "codeformer": (args) => ({
    image: args.image,
    ...(args.fidelity !== undefined && { codeformer_fidelity: args.fidelity }),
    ...(args.backgroundEnhance && { background_enhance: true }),
    ...(args.faceUpsample && { face_upsample: true }),
    ...(args.upscale !== undefined && { upscale: args.upscale }),
  }),
  "gfpgan": (args) => ({
    img: args.image,
    ...(args.version && { version: args.version }),
    ...(args.scale !== undefined && { scale: args.scale }),
  }),
  // Flux Kontext Pro: instruction editor — prompt (required) + input_image.
  "flux-kontext-pro": (args) => ({
    prompt: args.prompt,
    ...(args.image && { input_image: args.image }),
    ...(args.outputFormat && { output_format: args.outputFormat }),
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
  // Bria Eraser: image + mask (required); object removal, no prompt.
  "bria-eraser": (args) => ({
    image: args.image,
    ...(args.mask && { mask: args.mask }),
  }),
  // Bria GenFill: image + mask + prompt (all required); returns an array (unwrapped downstream).
  "bria-genfill": (args) => ({
    image: args.image,
    ...(args.mask && { mask: args.mask }),
    prompt: args.prompt,
    ...(args.seed !== undefined && { seed: args.seed }),
  }),
};

// Compose the runtime registry: catalog data + local buildInput behavior.
const REPLICATE_MODELS = Object.fromEntries(
  (Object.keys(RESTORE_MODELS) as Model[]).map((key) => [
    key,
    { ...RESTORE_MODELS[key], id: runRef(RESTORE_MODELS[key]), buildInput: RESTORE_BUILDERS[key] },
  ]),
) as Record<Model, ReplicateModelSpec>;

const VALID_MODELS: Model[] = Object.keys(RESTORE_MODELS) as Model[];

// ============================================================================
// Configuration
// ============================================================================

const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

const DEFAULTS = {
  model: "codeformer" as Model,
  output: `${process.env.HOME}/Downloads/restored.png`,
};

// ============================================================================
// Types
// ============================================================================

interface CLIArgs {
  model: Model;
  image: string;
  output: string;
  fidelity?: number;
  backgroundEnhance?: boolean;
  faceUpsample?: boolean;
  upscale?: number;
  version?: string;
  scale?: number;
  outputFormat?: string;
  seed?: number;
  mask?: string;    // editors (bria-eraser, bria-genfill): region to edit
  prompt?: string;  // editors (flux-kontext-pro, bria-genfill): edit instruction
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
restore - Image Restoration CLI

Restore, enhance, and upscale images using multiple AI models.
Part of the DOS Image Restoration Collection.

USAGE:
  restore --model <model> --image <path|url> [OPTIONS]

REQUIRED:
  --model <model>          Restoration model: flux-restore, codeformer, gfpgan
  --image <path|url>       Input image (local path or URL)

MODELS:
  flux-restore             Flux Restore — general image restoration, denoising
  codeformer               CodeFormer — face restoration, bg enhance, upscale (recommended)
  gfpgan                   GFPGAN — face restoration, v1.3 quality / v1.4 detail
  flux-kontext-pro         Flux Kontext Pro — instruction editor (requires --prompt)
  bria-eraser              Bria Eraser — masked object removal (requires --mask)
  bria-genfill             Bria GenFill — generative fill (requires --mask + --prompt)

COMMON OPTIONS:
  --output <path>          Output file path (default: ~/Downloads/restored.png)

EDITOR OPTIONS (flux-kontext-pro / bria-eraser / bria-genfill):
  --prompt <text>          Edit instruction (flux-kontext-pro, bria-genfill)
  --mask <path|url>        Mask of the region to edit (bria-eraser, bria-genfill)

CODEFORMER OPTIONS:
  --fidelity <number>      Quality vs fidelity balance 0.0-1.0 (lower = quality, higher = fidelity)
  --background-enhance     Enhance background with Real-ESRGAN
  --face-upsample          Upsample restored faces for high-res output
  --upscale <number>       Final upscaling factor (e.g., 2 for 2x)

GFPGAN OPTIONS:
  --version <v1.3|v1.4>    v1.3 = better quality, v1.4 = more detail + identity
  --scale <number>         Rescaling factor for output

FLUX RESTORE OPTIONS:
  --output-format <fmt>    Output format (png, jpg, webp)
  --seed <number>          Random seed for reproducible results

EXAMPLES:
  # Restore old photo (face-focused)
  restore --model codeformer --image ~/Downloads/old-photo.jpg --fidelity 0.5

  # Restore + upscale with background enhancement
  restore --model codeformer --image damaged.jpg --background-enhance --face-upsample --upscale 2

  # Quick face fix with GFPGAN
  restore --model gfpgan --image blurry-face.jpg --version v1.4 --scale 2

  # General image restoration
  restore --model flux-restore --image noisy-image.png

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN    Required for all models

MORE INFO:
  Documentation: ${DOS_DIR}/skills/media/ImageRestoration/SKILL.md
  Source: ${DOS_DIR}/skills/media/ImageRestoration/Tools/Restore.ts
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

    if (key === "background-enhance") { parsed.backgroundEnhance = true; continue; }
    if (key === "face-upsample") { parsed.faceUpsample = true; continue; }

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
      case "fidelity": {
        const f = parseFloat(value);
        if (isNaN(f) || f < 0 || f > 1) throw new CLIError(`Invalid fidelity: ${value}. Must be 0.0-1.0`);
        parsed.fidelity = f;
        i++;
        break;
      }
      case "upscale": {
        const u = parseInt(value, 10);
        if (isNaN(u) || u < 1 || u > 8) throw new CLIError(`Invalid upscale: ${value}. Must be 1-8`);
        parsed.upscale = u;
        i++;
        break;
      }
      case "version":
        parsed.version = value;
        i++;
        break;
      case "scale": {
        const s = parseFloat(value);
        if (isNaN(s) || s < 1) throw new CLIError(`Invalid scale: ${value}. Must be >= 1`);
        parsed.scale = s;
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
      case "mask":
        parsed.mask = value;
        i++;
        break;
      case "prompt":
        parsed.prompt = value;
        i++;
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.image) throw new CLIError("Missing required argument: --image");

  // Editor models require their edit inputs.
  if (parsed.model === "flux-kontext-pro" && !parsed.prompt) {
    throw new CLIError("flux-kontext-pro requires --prompt (the edit instruction)");
  }
  if (parsed.model === "bria-eraser" && !parsed.mask) {
    throw new CLIError("bria-eraser requires --mask (image of the region to erase)");
  }
  if (parsed.model === "bria-genfill" && (!parsed.mask || !parsed.prompt)) {
    throw new CLIError("bria-genfill requires --mask (region) and --prompt (what to generate)");
  }

  return parsed as CLIArgs;
}

// ============================================================================
// Provider
// ============================================================================

async function restoreImage(args: CLIArgs): Promise<string> {
  const spec = REPLICATE_MODELS[args.model];

  // Convert local files to data URIs for Replicate (image, and mask for editor models)
  const toDataUri = async (p: string): Promise<string> => {
    if (p.startsWith("http") || p.startsWith("data:")) return p;
    const buf = await readFile(resolve(p));
    const ext = extname(p).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : ext === ".webp" ? "image/webp" : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  };
  const imageInput = await toDataUri(args.image);
  const maskInput = args.mask ? await toDataUri(args.mask) : undefined;

  const input = spec.buildInput({ ...args, image: imageInput, ...(maskInput && { mask: maskInput }) });
  console.log(`\uD83D\uDD27 Restoring with ${spec.id.split(":")[0]}...`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(spec.id as `${string}/${string}` | `${string}/${string}:${string}`, { input });

  const outputBuffer = await replicateResultToBuffer(result);
  await writeArtifact(args.output, outputBuffer, {
    pack: "Media/ImageRestoration",
    workflow: "Restore",
    artifactType: "image",
  });
  console.log(`\u2705 Restored image saved to ${args.output}`);
  return args.output;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);
    await restoreImage(args);
  } catch (error) {
    handleError(error);
  }
}

main();
