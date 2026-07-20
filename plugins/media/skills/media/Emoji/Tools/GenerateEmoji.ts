#!/usr/bin/env bun

/**
 * generate-emoji - Emoji Generation CLI
 *
 * Generate custom emoji-style images using SDXL Emoji model.
 * Part of the DOS Emoji Collection.
 *
 * Usage:
 *   generate-emoji --prompt "a happy cat" --output ~/Downloads/emoji.png
 *
 * @see Packs/media/src/Emoji/SKILL.md
 */

import Replicate from "../../Lib/gateway.ts";
import { readFile, writeFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { resolve, extname } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import { EMOJI_MODEL, runRef } from "../../Lib/catalog.ts";

// ============================================================================
// Configuration
// ============================================================================

const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

// Model id + version pin sourced from Lib/catalog.ts (single source of truth).
const MODEL_ID = runRef(EMOJI_MODEL);

const DEFAULTS = {
  output: `${process.env.HOME}/Downloads/emoji.png`,
  width: 1024,
  height: 1024,
};

const EMOJI_PREFIXES = [
  "an emoji", "emoji", "a emoji", "the emoji",
  "an emoticon", "emoticon", "a emoticon",
];

// ============================================================================
// Types
// ============================================================================

interface CLIArgs {
  prompt: string;
  width: number;
  height: number;
  numOutputs?: number;
  negativePrompt?: string;
  seed?: number;
  output: string;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
generate-emoji - Emoji Generation CLI

Generate custom emoji-style images using SDXL Emoji model.
Part of the DOS Emoji Collection.

USAGE:
  generate-emoji --prompt <text> [OPTIONS]

REQUIRED:
  --prompt <text>            Description of the emoji to generate

OPTIONS:
  --width <int>              Image width in pixels (default: 1024)
  --height <int>             Image height in pixels (default: 1024)
  --num-outputs <int>        Number of emoji variants to generate
  --negative-prompt <text>   Things to avoid in the generation
  --seed <int>               Random seed for reproducible results
  --output <path>            Output file path (default: ~/Downloads/emoji.png)
  --help, -h                 Show this help message

NOTES:
  The prompt is auto-prefixed with "An emoji of " if it doesn't already
  start with emoji-related terms, to ensure the model produces emoji-style output.

EXAMPLES:
  # Generate a cat emoji
  generate-emoji --prompt "a happy cat"

  # Generate with custom size
  generate-emoji --prompt "a rocket ship" --width 512 --height 512

  # Generate multiple variants
  generate-emoji --prompt "a fire-breathing dragon" --num-outputs 4

  # Reproducible generation with seed
  generate-emoji --prompt "a smiling sun" --seed 42

  # Avoid certain elements
  generate-emoji --prompt "a dog" --negative-prompt "aggressive, scary"

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN    Required

MORE INFO:
  Documentation: ${DOS_DIR}/skills/media/Emoji/SKILL.md
  Source: ${DOS_DIR}/skills/media/Emoji/Tools/GenerateEmoji.ts
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
    width: DEFAULTS.width,
    height: DEFAULTS.height,
    output: DEFAULTS.output,
  };

  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;

    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}. Flags must start with --`);
    }

    const key = flag.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }

    switch (key) {
      case "prompt":
        parsed.prompt = value;
        i++;
        break;
      case "width": {
        const w = parseInt(value, 10);
        if (isNaN(w) || w < 64) throw new CLIError(`Invalid width: ${value}. Must be >= 64`);
        parsed.width = w;
        i++;
        break;
      }
      case "height": {
        const h = parseInt(value, 10);
        if (isNaN(h) || h < 64) throw new CLIError(`Invalid height: ${value}. Must be >= 64`);
        parsed.height = h;
        i++;
        break;
      }
      case "num-outputs": {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1) throw new CLIError(`Invalid num-outputs: ${value}. Must be >= 1`);
        parsed.numOutputs = n;
        i++;
        break;
      }
      case "negative-prompt":
        parsed.negativePrompt = value;
        i++;
        break;
      case "seed": {
        parsed.seed = parseInt(value, 10);
        i++;
        break;
      }
      case "output":
        parsed.output = value;
        i++;
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.prompt) throw new CLIError("Missing required argument: --prompt");

  return parsed as CLIArgs;
}

// ============================================================================
// Prompt Preparation
// ============================================================================

function preparePrompt(rawPrompt: string): string {
  const lower = rawPrompt.toLowerCase().trim();
  const hasEmojiPrefix = EMOJI_PREFIXES.some((prefix) => lower.startsWith(prefix));
  if (hasEmojiPrefix) {
    return rawPrompt;
  }
  return `An emoji of ${rawPrompt}`;
}

// ============================================================================
// Provider
// ============================================================================

async function generateEmoji(args: CLIArgs): Promise<string> {
  const prompt = preparePrompt(args.prompt);

  const input: Record<string, unknown> = {
    prompt,
    width: args.width,
    height: args.height,
    ...(args.numOutputs !== undefined && { num_outputs: args.numOutputs }),
    ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
    ...(args.seed !== undefined && { seed: args.seed }),
  };

  console.log(`\uD83C\uDFA8 Generating emoji: "${prompt}"...`);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(MODEL_ID as `${string}/${string}:${string}`, { input });

  const outputBuffer = await replicateResultToBuffer(result);
  await writeArtifact(args.output, outputBuffer, {
    pack: "Media/Emoji",
    workflow: "GenerateEmoji",
    artifactType: "image",
  });
  console.log(`\u2705 Emoji saved to ${args.output}`);
  return args.output;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);
    await generateEmoji(args);
  } catch (error) {
    handleError(error);
  }
}

main();
