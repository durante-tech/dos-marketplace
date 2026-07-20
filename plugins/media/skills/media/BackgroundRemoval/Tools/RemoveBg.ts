#!/usr/bin/env bun

/**
 * removebg - Background Removal CLI
 *
 * Remove backgrounds from images using multiple providers.
 * Part of the DOS Background Removal Collection.
 *
 * Usage:
 *   removebg --model 851-labs --image input.png --output ~/Downloads/transparent.png
 *
 * @see Packs/media/src/BackgroundRemoval/SKILL.md
 */

import Replicate from "../../Lib/gateway.ts";
import { removeBackgroundViaGateway } from "../../Lib/removebg-gateway.ts";
import { writeFile, readFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { resolve, extname } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import { BG_MODELS, runRef, type CatalogBase, type BgModelKey } from "../../Lib/catalog.ts";

// ============================================================================
// Model Registry — model data sourced from Lib/catalog.ts (single source of truth).
// "removebg-api" is an external cloud service (remove.bg), routed directly below
// and intentionally not in the Replicate catalog.
// ============================================================================

type Model = BgModelKey | "removebg-api";

interface ReplicateModelSpec extends CatalogBase {
  buildInput: (args: CLIArgs) => Record<string, unknown>;
}

// buildInput factories — behavior stays in the tool (coupled to local CLIArgs).
const BG_BUILDERS: Record<BgModelKey, ReplicateModelSpec["buildInput"]> = {
  "851-labs": (args) => ({
    image: args.image,
    ...(args.threshold !== undefined && { threshold: args.threshold }),
    ...(args.reverse && { reverse: true }),
    ...(args.backgroundType && { background_type: args.backgroundType }),
    format: "png",
  }),
  "remove-bg": (args) => ({
    image: args.image,
  }),
  "bria": (args) => ({
    image: args.image,
  }),
};

// Compose the runtime registry: catalog data + local buildInput behavior.
const REPLICATE_MODELS = Object.fromEntries(
  (Object.keys(BG_MODELS) as BgModelKey[]).map((key) => [
    key,
    { ...BG_MODELS[key], id: runRef(BG_MODELS[key]), buildInput: BG_BUILDERS[key] },
  ]),
) as Record<string, ReplicateModelSpec>;

const VALID_MODELS: Model[] = ["851-labs", "remove-bg", "bria", "removebg-api"];

// ============================================================================
// Configuration
// ============================================================================

const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

const DEFAULTS = {
  model: "851-labs" as Model,
  output: `${process.env.HOME}/Downloads/transparent.png`,
};

// ============================================================================
// Types
// ============================================================================

interface CLIArgs {
  model: Model;
  image: string;
  output: string;
  threshold?: number;
  reverse?: boolean;
  backgroundType?: string;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
removebg - Background Removal CLI

Remove backgrounds from images using multiple providers.
Part of the DOS Background Removal Collection.

USAGE:
  removebg --model <model> --image <path|url> [OPTIONS]

REQUIRED:
  --model <model>        Provider: 851-labs, remove-bg, removebg-api
  --image <path|url>     Input image (local path or URL)

MODELS:
  851-labs               851 Labs — soft alpha, green/blur/custom bg, reverse mode
  remove-bg              Lucataco Remove BG — fast (~2s), clean edges
  bria                   Bria Remove Background — commercial-grade matting, alpha
  removebg-api           remove.bg API — existing cloud service (50 free/mo)

OPTIONS:
  --output <path>            Output file path (default: ~/Downloads/transparent.png)
  --threshold <number>       Hard segmentation threshold 0.0-1.0 (851-labs only, 0.0 = soft alpha)
  --reverse                  Remove foreground instead of background (851-labs only)
  --background-type <type>   Background replacement (851-labs only):
                             rgba (transparent), map, green, white, blur, overlay,
                             or [R,G,B] array like "[255,0,0]" for red
  --help, -h                 Show this help message

EXAMPLES:
  # Fast transparent background
  removebg --model remove-bg --image ~/Downloads/photo.png

  # Soft alpha with 851-labs
  removebg --model 851-labs --image ~/Downloads/product.jpg --output ~/Downloads/product-clean.png

  # Green screen background
  removebg --model 851-labs --image photo.jpg --background-type green

  # Blur background (keep subject sharp)
  removebg --model 851-labs --image portrait.jpg --background-type blur

  # Custom color background
  removebg --model 851-labs --image logo.png --background-type "[234,233,223]"

  # Remove foreground (keep background only)
  removebg --model 851-labs --image scene.jpg --reverse

  # Using remove.bg API (existing cloud service)
  removebg --model removebg-api --image ~/Downloads/photo.png

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN    Required for 851-labs and remove-bg models
  REMOVEBG_API_KEY       Required for removebg-api model

MORE INFO:
  Documentation: ${DOS_DIR}/skills/media/BackgroundRemoval/SKILL.md
  Source: ${DOS_DIR}/skills/media/BackgroundRemoval/Tools/RemoveBg.ts
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

    if (key === "reverse") {
      parsed.reverse = true;
      continue;
    }

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
      case "threshold": {
        const t = parseFloat(value);
        if (isNaN(t) || t < 0 || t > 1) {
          throw new CLIError(`Invalid threshold: ${value}. Must be between 0.0 and 1.0`);
        }
        parsed.threshold = t;
        i++;
        break;
      }
      case "background-type":
        parsed.backgroundType = value;
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
// Providers
// ============================================================================

async function removeWithReplicate(modelKey: string, args: CLIArgs): Promise<string> {
  const spec = REPLICATE_MODELS[modelKey];
  if (!spec) throw new CLIError(`Unknown Replicate model: ${modelKey}`);

  // If image is a local path, read it and convert to data URI
  let imageInput = args.image;
  if (!args.image.startsWith("http") && !args.image.startsWith("data:")) {
    const imageBuffer = await readFile(resolve(args.image));
    const ext = extname(args.image).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : ext === ".webp" ? "image/webp" : "image/png";
    imageInput = `data:${mime};base64,${imageBuffer.toString("base64")}`;
  }

  const input = spec.buildInput({ ...args, image: imageInput });
  console.log(`\uD83D\uDD32 Removing background with ${spec.id.split(":")[0]}...`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(spec.id as `${string}/${string}:${string}`, { input });

  const outputBuffer = await replicateResultToBuffer(result);
  await writeArtifact(args.output, outputBuffer, {
    pack: "Media/BackgroundRemoval",
    workflow: "RemoveBg",
    artifactType: "image",
  });
  console.log(`\u2705 Saved to ${args.output}`);
  return args.output;
}

async function removeWithAPI(args: CLIArgs): Promise<string> {
  console.log("\uD83D\uDD32 Removing background with remove.bg API...");

  const imageBuffer = await readFile(resolve(args.image));
  const result = await removeBackgroundViaGateway({ imageBuffer: Buffer.from(imageBuffer) });

  await writeArtifact(args.output, result.imageBuffer, {
    pack: "Media/BackgroundRemoval",
    workflow: "RemoveBg.viaGateway",
    artifactType: "image",
  });
  if (result.chargedCredits) {
    console.log(`\u2705 Saved to ${args.output} (${result.chargedCredits} credits via Studio)`);
  } else {
    console.log(`\u2705 Saved to ${args.output}`);
  }
  return args.output;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);

    if (args.model === "removebg-api") {
      await removeWithAPI(args);
    } else {
      await removeWithReplicate(args.model, args);
    }
  } catch (error) {
    handleError(error);
  }
}

main();
