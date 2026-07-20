#!/usr/bin/env bun

/**
 * swap - Face Swap CLI
 *
 * Swap faces between two images using AI.
 * Part of the DOS FaceSwap Collection.
 *
 * Usage:
 *   swap --target photo.jpg --source face.jpg --output ~/Downloads/face-swapped.png
 *
 * @see Packs/media/src/FaceSwap/SKILL.md
 */

import Replicate from "../../Lib/gateway.ts";
import { readFile, writeFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { resolve, extname } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { enforceConsent } from "../../Lib/consent-gate.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import { FACESWAP_MODEL, runRef } from "../../Lib/catalog.ts";

// ============================================================================
// Configuration
// ============================================================================

const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

// Model id + version pin sourced from Lib/catalog.ts (single source of truth).
const MODEL_ID = runRef(FACESWAP_MODEL);

const DEFAULTS = {
  output: `${process.env.HOME}/Downloads/face-swapped.png`,
};

// ============================================================================
// Types
// ============================================================================

interface CLIArgs {
  target: string;
  source: string;
  output: string;
  /** content-safety: affirmative deepfake-consent attestation (--consent-attested) */
  consentAttested?: boolean;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
swap - Face Swap CLI

Swap faces between two images using AI.
Part of the DOS FaceSwap Collection.

USAGE:
  swap --target <path|url> --source <path|url> [OPTIONS]

REQUIRED:
  --target <path|url>    Target image (the body/scene to keep)
  --source <path|url>    Source image (the face to swap in)

OPTIONS:
  --output <path>        Output file path (default: ~/Downloads/face-swapped.png)
  --help, -h             Show this help message

EXAMPLES:
  # Swap face from source onto target
  swap --target ~/Downloads/photo.jpg --source ~/Downloads/face.jpg

  # Swap face with custom output path
  swap --target ~/Downloads/target.png --source ~/Downloads/source.png --output ~/Downloads/result.png

  # Use URL inputs
  swap --target https://example.com/target.jpg --source https://example.com/face.jpg

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN    Required

MORE INFO:
  Documentation: ${DOS_DIR}/skills/media/FaceSwap/SKILL.md
  Source: ${DOS_DIR}/skills/media/FaceSwap/Tools/Swap.ts
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
    output: DEFAULTS.output,
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
      case "target":
        parsed.target = value;
        i++;
        break;
      case "source":
        parsed.source = value;
        i++;
        break;
      case "output":
        parsed.output = value;
        i++;
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.target) throw new CLIError("Missing required argument: --target");
  if (!parsed.source) throw new CLIError("Missing required argument: --source");

  return parsed as CLIArgs;
}

// ============================================================================
// Helper: Local file to data URI
// ============================================================================

async function toDataURI(imagePath: string): Promise<string> {
  if (imagePath.startsWith("http") || imagePath.startsWith("data:")) {
    return imagePath;
  }
  const imageBuffer = await readFile(resolve(imagePath));
  const ext = extname(imagePath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${imageBuffer.toString("base64")}`;
}

// ============================================================================
// Provider
// ============================================================================

async function swapFace(args: CLIArgs): Promise<string> {
  // Content-safety gate (deepfake) — BEFORE any gateway work. Blocks without an
  // affirmative --consent-attested flag; returns an attestation to audit-log.
  const attestation = enforceConsent("deepfake", {}, args.consentAttested ?? false);

  const targetInput = await toDataURI(args.target);
  const sourceInput = await toDataURI(args.source);

  const input = {
    input_image: targetInput,
    swap_image: sourceInput,
  };

  console.log("\uD83D\uDD04 Swapping face...");

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(MODEL_ID as `${string}/${string}:${string}`, { input });

  const outputBuffer = await replicateResultToBuffer(result);
  await writeArtifact(args.output, outputBuffer, {
    pack: "Media/FaceSwap",
    workflow: "Swap",
    artifactType: "image",
    ...(attestation ?? {}),
  });
  console.log(`\u2705 Face-swapped image saved to ${args.output}`);
  return args.output;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);
    await swapFace(args);
  } catch (error) {
    handleError(error);
  }
}

main();
