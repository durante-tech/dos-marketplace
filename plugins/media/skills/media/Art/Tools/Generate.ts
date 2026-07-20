#!/usr/bin/env bun

/**
 * generate - Image Generation CLI
 *
 * Generate {YOUR_BUSINESS_NAME} branded images using Flux 1.1 Pro, Nano Banana, Nano Banana Pro, or GPT-image-1.
 * Follows llcli pattern for deterministic, composable CLI design.
 *
 * Usage:
 *   generate --model nano-banana-pro --prompt "..." --size 16:9 --output /tmp/image.png
 *
 * @see ~/.claude/skills/media/Art/README.md
 */

import Replicate from "../../Lib/gateway.ts";
import { generateOpenAIImage } from "../../Lib/openai-image-gateway.ts";
import { generateGeminiImage } from "../../Lib/gemini-image-gateway.ts";
import { removeBackgroundViaGateway } from "../../Lib/removebg-gateway.ts";
import { writeFile, readFile } from "node:fs/promises";
import { writeArtifact } from "../../Lib/writeArtifact";
import { extname, resolve } from "node:path";
import { loadEnv } from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import { enforceConsent } from "../../Lib/consent-gate.ts";
import { replicateResultToBuffer } from "../../Lib/replicate.ts";
import { IMAGE_MODELS, runRef, type ImageModelData, type ImageModelKey } from "../../Lib/catalog.ts";

// ============================================================================
// Types
// ============================================================================

// Model keys + data are sourced from Lib/catalog.ts (single source of truth).
type ReplicateModel = ImageModelKey;

type Model = ReplicateModel | "nano-banana-pro" | "gpt-image-1" | "gpt-image-1.5";

type ReplicateSize = "1:1" | "16:9" | "3:2" | "2:3" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "21:9";
type OpenAISize = "1024x1024" | "1536x1024" | "1024x1536";
type GeminiSize = "1K" | "2K" | "4K";
type Size = ReplicateSize | OpenAISize | GeminiSize;

interface CLIArgs {
  model: Model;
  prompt: string;
  size: Size;
  output: string;
  creativeVariations?: number;
  aspectRatio?: ReplicateSize;
  transparent?: boolean;
  referenceImages?: string[];
  /** content-safety: affirmative real-person-image consent attestation (--consent-attested) */
  consentAttested?: boolean;
  removeBg?: boolean;
  addBg?: string;
  thumbnail?: boolean;
}

// ============================================================================
// Model Registry — each adapter knows its model's exact API schema
// ============================================================================

interface ReplicateImageModelSpec extends ImageModelData {
  buildInput: (prompt: string, size: ReplicateSize, args: CLIArgs) => Record<string, unknown>;
}

// buildInput factories — per-call behavior stays in the tool because it is coupled
// to this tool's local CLIArgs shape. Model data (id, version pin, capability flags)
// lives in Lib/catalog.ts. Keys are validated against the catalog by the Record type.
const IMAGE_BUILDERS: Record<ReplicateModel, ReplicateImageModelSpec["buildInput"]> = {
  "flux": (prompt, size) => ({
    prompt,
    aspect_ratio: size,
    output_format: "png",
    output_quality: 95,
    prompt_upsampling: false,
  }),
  "flux-2-pro": (prompt, size, args) => ({
    prompt,
    aspect_ratio: size,
    output_format: "png",
    output_quality: 95,
    ...(args.referenceImages?.length && { input_images: args.referenceImages }),
  }),
  "flux-2-max": (prompt, size, args) => ({
    prompt,
    aspect_ratio: size,
    output_format: "png",
    output_quality: 95,
    ...(args.referenceImages?.length && { input_images: args.referenceImages }),
  }),
  "nano-banana": (prompt, size) => ({
    prompt,
    aspect_ratio: size,
    output_format: "png",
  }),
  "nano-banana-replicate": (prompt, size, args) => ({
    prompt,
    aspect_ratio: size,
    output_format: "png",
    ...(args.referenceImages?.length && { image_input: args.referenceImages }),
  }),
  "nano-banana-2": (prompt, size, args) => ({
    prompt,
    aspect_ratio: size,
    output_format: "png",
    ...(args.referenceImages?.length && { image_input: args.referenceImages }),
  }),
  "seedream": (prompt, size, args) => ({
    prompt,
    aspect_ratio: size,
    ...(args.referenceImages?.length && { image_input: args.referenceImages }),
  }),
  "seedream-5-lite": (prompt, size, args) => ({
    prompt,
    aspect_ratio: size,
    ...(args.referenceImages?.length && { image_input: args.referenceImages }),
  }),
  "imagen-4-ultra": (prompt, size) => ({
    prompt,
    aspect_ratio: size,
    output_format: "png",
  }),
  "grok-imagine": (prompt, size, args) => ({
    prompt,
    aspect_ratio: size,
    ...(args.referenceImages?.[0] && { image: args.referenceImages[0] }),
  }),
};

// Compose the runtime registry: catalog data + local buildInput behavior.
// id resolves through runRef so any future version-pinned image model Just Works.
const REPLICATE_IMAGE_MODELS = Object.fromEntries(
  (Object.keys(IMAGE_MODELS) as ReplicateModel[]).map((key) => [
    key,
    { ...IMAGE_MODELS[key], id: runRef(IMAGE_MODELS[key]), buildInput: IMAGE_BUILDERS[key] },
  ]),
) as Record<ReplicateModel, ReplicateImageModelSpec>;

const REPLICATE_MODEL_KEYS = Object.keys(REPLICATE_IMAGE_MODELS) as ReplicateModel[];

// ============================================================================
// Configuration
// ============================================================================

const VALID_MODELS: Model[] = [...REPLICATE_MODEL_KEYS, "nano-banana-pro", "gpt-image-1", "gpt-image-1.5"];

const DEFAULTS = {
  model: "flux" as Model,
  size: "16:9" as Size,
  output: `${process.env.HOME}/Downloads/generated-image.png`,
};

const REPLICATE_SIZES: ReplicateSize[] = ["1:1", "16:9", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "21:9"];
// Per-model unsupported ratios — API rejects at runtime. Keep in sync with provider schemas.
const REPLICATE_UNSUPPORTED_SIZES: Partial<Record<ReplicateModel, ReplicateSize[]>> = {
  seedream: ["4:5", "5:4"],
};
const OPENAI_SIZES: OpenAISize[] = ["1024x1024", "1536x1024", "1024x1536"];
const GEMINI_SIZES: GeminiSize[] = ["1K", "2K", "4K"];
const GEMINI_ASPECT_RATIOS: ReplicateSize[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

// ============================================================================
// Image Format Detection
// ============================================================================

/**
 * Detect actual image format from magic bytes.
 * Prevents MIME type mismatch when API returns different format than requested.
 */
function detectImageFormat(data: Buffer | Uint8Array): { format: string; ext: string; mime: string } | null {
  if (data.length < 12) return null;
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47)
    return { format: "png", ext: ".png", mime: "image/png" };
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return { format: "jpeg", ext: ".jpg", mime: "image/jpeg" };
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50)
    return { format: "webp", ext: ".webp", mime: "image/webp" };
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46)
    return { format: "gif", ext: ".gif", mime: "image/gif" };
  return null;
}

/**
 * Save image data with correct file extension based on actual content format.
 * Returns the final path (may differ from requested if format mismatch detected).
 */
async function saveImage(
  data: Buffer | Uint8Array | any,
  requestedPath: string,
  extraMeta: Record<string, unknown> = {},
): Promise<string> {
  const buffer = data instanceof Buffer ? data : Buffer.from(data as any);
  const detected = detectImageFormat(buffer);
  if (detected) {
    const requestedExt = extname(requestedPath).toLowerCase();
    if (requestedExt && requestedExt !== detected.ext) {
      const correctedPath = requestedPath.replace(/\.[^.]+$/, detected.ext);
      console.warn(`⚠️ API returned ${detected.format.toUpperCase()} data (requested ${requestedExt.slice(1).toUpperCase()}). Saving as ${correctedPath}`);
      await writeArtifact(correctedPath, buffer, {
        pack: "Media/Art",
        workflow: "Generate",
        artifactType: "image",
        ...extraMeta,
      });
      return correctedPath;
    }
  }
  await writeArtifact(requestedPath, buffer, {
    pack: "Media/Art",
    workflow: "Generate",
    artifactType: "image",
    ...extraMeta,
  });
  return requestedPath;
}

/**
 * Detect MIME type from image file content (magic bytes), falling back to extension.
 */
async function detectMimeType(filePath: string): Promise<string> {
  try {
    const data = await readFile(filePath);
    const detected = detectImageFormat(data);
    if (detected) return detected.mime;
  } catch {
    // Fall through to extension-based detection
  }
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    default: throw new CLIError(`Unsupported image format: ${ext}. Supported: .png, .jpg, .jpeg, .webp`);
  }
}

// ============================================================================
// Help Text
// ============================================================================

// DOS directory for documentation paths
const DOS_DIR = process.env.DOS_DIR || `${process.env.HOME}/.claude`;

function showHelp(): void {
  console.log(`
generate - Image Generation & Editing CLI

Generate images using multiple providers and models.
Part of the DOS Image Collection (peer to Speech/Speak.ts for audio).

USAGE:
  generate --model <model> --prompt "<prompt>" [OPTIONS]

REQUIRED:
  --model <model>      Model to use (see MODELS below)
  --prompt <text>      Image generation prompt (quote if contains spaces)

MODELS (Replicate):
  flux                 Flux 1.1 Pro — high quality, fast, reliable baseline
  flux-2-pro           Flux 2 Pro — next-gen, reference images, JSON prompts
  flux-2-max           Flux 2 Max — highest quality Flux, cinematic detail
  nano-banana          Nano Banana — lightweight Google model
  nano-banana-replicate Nano Banana Pro via Replicate — 4K, multilingual text
  nano-banana-2        Nano Banana 2 — Gemini 3.1 Flash Image, multi-image fusion
  seedream             SeDream 4.5 — cinematic film-like visuals (ByteDance)
  seedream-5-lite      SeDream 5 Lite — newer gen, multi-image blend, 3K
  imagen-4-ultra       Imagen 4 Ultra — fine detail, typography (Google)
  grok-imagine         Grok Imagine — xAI, text rendering, ~4s generation

MODELS (Other Providers):
  nano-banana-pro      Nano Banana Pro via Gemini API — reference images, 4K
  gpt-image-1          GPT-image-1 via OpenAI — versatile, good text rendering
  gpt-image-1.5        GPT-image-1.5 via OpenAI — newer, improved fidelity

OPTIONS:
  --size <size>              Replicate: 1:1, 16:9, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 21:9
                             OpenAI: 1024x1024, 1536x1024, 1024x1536
                             Gemini: 1K, 2K, 4K
  --aspect-ratio <ratio>     Aspect ratio for Gemini nano-banana-pro (default: 16:9)
  --output <path>            Output file path (default: ~/Downloads/generated-image.png)
  --reference-image <path>   Reference image (Nano Banana Pro Gemini only, up to 14)
  --transparent              Add transparency instructions to prompt
  --remove-bg                Remove background via remove.bg API
  --add-bg <hex>             Add background color (e.g., "#EAE9DF")
  --thumbnail                Generate transparent + thumbnail versions
  --creative-variations <n>  Generate N variations (1-10)
  --help, -h                 Show this help message

EXAMPLES:
  # Flux 2 Max — highest quality
  generate --model flux-2-max --prompt "Cinematic still life..." --size 16:9

  # SeDream — film-like visuals
  generate --model seedream --prompt "A fox in a neon city..." --size 1:1

  # Imagen 4 Ultra — fine detail
  generate --model imagen-4-ultra --prompt "Macro of dewdrop..." --size 3:2

  # Grok Imagine — fast with text
  generate --model grok-imagine --prompt "Poster: Intelligence that compounds" --size 16:9

  # Nano Banana Pro (Gemini) with references
  generate --model nano-banana-pro --prompt "Character..." --size 2K --aspect-ratio 16:9 \\
    --reference-image face1.jpg --reference-image face2.jpg

  # GPT-image-1 with variations
  generate --model gpt-image-1 --prompt "..." --size 1024x1024 --creative-variations 3

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN  Required for all Replicate models
  OPENAI_API_KEY       Required for gpt-image-1
  GOOGLE_API_KEY       Required for nano-banana-pro (Gemini)
  REMOVEBG_API_KEY     Required for --remove-bg

MORE INFO:
  Documentation: ${DOS_DIR}/skills/media/Art/README.md
  Source: ${DOS_DIR}/skills/media/Art/Tools/Generate.ts
`);
  process.exit(0);
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);

  // Check for help flag
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
  }

  const parsed: Partial<CLIArgs> = {
    model: DEFAULTS.model,
    output: DEFAULTS.output,
  };

  // Collect reference images into array
  const referenceImages: string[] = [];

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];

    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}. Flags must start with --`);
    }

    const key = flag.slice(2);

    // Handle boolean flags (no value)
    if (key === "transparent") {
      parsed.transparent = true;
      continue;
    }
    if (key === "consent-attested") {
      parsed.consentAttested = true;
      continue;
    }
    if (key === "remove-bg") {
      parsed.removeBg = true;
      continue;
    }
    if (key === "thumbnail") {
      parsed.thumbnail = true;
      parsed.removeBg = true; // Thumbnail mode requires remove-bg
      continue;
    }

    // Handle flags with values
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
        i++; // Skip next arg (value)
        break;
      case "prompt":
        parsed.prompt = value;
        i++; // Skip next arg (value)
        break;
      case "size":
        parsed.size = value as Size;
        i++; // Skip next arg (value)
        break;
      case "aspect-ratio":
        parsed.aspectRatio = value as ReplicateSize;
        i++; // Skip next arg (value)
        break;
      case "output":
        parsed.output = value;
        i++; // Skip next arg (value)
        break;
      case "reference-image":
        // Collect multiple reference images into array
        referenceImages.push(value);
        i++; // Skip next arg (value)
        break;
      case "creative-variations":
        const variations = parseInt(value, 10);
        if (isNaN(variations) || variations < 1 || variations > 10) {
          throw new CLIError(`Invalid creative-variations: ${value}. Must be 1-10`);
        }
        parsed.creativeVariations = variations;
        i++; // Skip next arg (value)
        break;
      case "add-bg":
        // Validate hex color format
        if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
          throw new CLIError(`Invalid hex color: ${value}. Must be in format #RRGGBB (e.g., #EAE9DF)`);
        }
        parsed.addBg = value;
        i++; // Skip next arg (value)
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  // Assign collected reference images if any
  if (referenceImages.length > 0) {
    parsed.referenceImages = referenceImages;
  }

  // Validate required arguments
  if (!parsed.prompt) {
    throw new CLIError("Missing required argument: --prompt");
  }

  if (!parsed.model) {
    throw new CLIError("Missing required argument: --model");
  }

  // Validate reference images against model capabilities
  if (parsed.referenceImages && parsed.referenceImages.length > 0) {
    // Content-safety gate (real-person-image) — a reference image can depict a real,
    // identifiable person. Block without an affirmative --consent-attested flag, before
    // ANY generation path (Replicate or Gemini) runs. Non-bypassable.
    enforceConsent("real-person-image", { hasReferenceImage: true }, parsed.consentAttested ?? false);

    const model = parsed.model!;
    const replicateSpec = REPLICATE_IMAGE_MODELS[model as ReplicateModel];
    const isGemini = model === "nano-banana-pro";

    if (replicateSpec && !replicateSpec.supportsRefImages) {
      throw new CLIError(`--reference-image is not supported with --model ${model}`);
    }
    if (!replicateSpec && !isGemini) {
      throw new CLIError(`--reference-image is not supported with --model ${model}`);
    }

    const maxRefs = replicateSpec?.maxRefImages ?? 14;
    if (parsed.referenceImages.length > maxRefs) {
      throw new CLIError(`Too many reference images for ${model}: ${parsed.referenceImages.length}. Maximum is ${maxRefs}`);
    }
  }

  const isGptImage = parsed.model === "gpt-image-1" || parsed.model === "gpt-image-1.5";

  if (!parsed.size) {
    if (isGptImage) {
      parsed.size = "1024x1024";
    } else if (parsed.model === "nano-banana-pro") {
      parsed.size = "2K";
    } else {
      parsed.size = "16:9";
    }
  }

  if (isGptImage) {
    if (!OPENAI_SIZES.includes(parsed.size as OpenAISize)) {
      throw new CLIError(`Invalid size for ${parsed.model}: ${parsed.size}. Must be: ${OPENAI_SIZES.join(", ")}`);
    }
  } else if (parsed.model === "nano-banana-pro") {
    if (!GEMINI_SIZES.includes(parsed.size as GeminiSize)) {
      throw new CLIError(`Invalid size for nano-banana-pro: ${parsed.size}. Must be: ${GEMINI_SIZES.join(", ")}`);
    }
    if (parsed.aspectRatio && !GEMINI_ASPECT_RATIOS.includes(parsed.aspectRatio)) {
      throw new CLIError(`Invalid aspect-ratio for nano-banana-pro: ${parsed.aspectRatio}. Must be: ${GEMINI_ASPECT_RATIOS.join(", ")}`);
    }
    if (!parsed.aspectRatio) {
      parsed.aspectRatio = "16:9";
    }
  } else {
    if (!REPLICATE_SIZES.includes(parsed.size as ReplicateSize)) {
      throw new CLIError(`Invalid size for ${parsed.model}: ${parsed.size}. Must be: ${REPLICATE_SIZES.join(", ")}`);
    }
    const unsupported = REPLICATE_UNSUPPORTED_SIZES[parsed.model as ReplicateModel];
    if (unsupported?.includes(parsed.size as ReplicateSize)) {
      const supported = REPLICATE_SIZES.filter((s) => !unsupported.includes(s));
      throw new CLIError(`Size ${parsed.size} is not supported by ${parsed.model}. Supported: ${supported.join(", ")}. Try 3:4 for portrait social (Instagram/LinkedIn/Facebook) or switch --model flux-2-max for true 4:5.`);
    }
  }

  return parsed as CLIArgs;
}

// ============================================================================
// Prompt Enhancement
// ============================================================================

function enhancePromptForTransparency(prompt: string): string {
  const transparencyPrefix = "CRITICAL: Transparent background (PNG with alpha channel) - NO background color, pure transparency. Object floating in transparent space. ";
  return transparencyPrefix + prompt;
}

// ============================================================================
// Background Removal
// ============================================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ============================================================================
// Background Operations
// ============================================================================

/**
 * Add a solid background color to a transparent PNG image
 * Uses ImageMagick to composite the transparent image onto a colored background
 */
async function addBackgroundColor(inputPath: string, outputPath: string, hexColor: string): Promise<void> {
  console.log(`🎨 Adding background color ${hexColor} to image...`);

  // Use ImageMagick to composite the transparent image onto a colored background
  // -background sets the fill color, -flatten composites onto that background
  try {
    await execFileAsync("magick", [inputPath, "-background", hexColor, "-flatten", outputPath]);
    console.log(`✅ Thumbnail saved to ${outputPath}`);
  } catch (error) {
    throw new CLIError(`Failed to add background color: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function removeBackground(imagePath: string): Promise<void> {
  console.log("🔲 Removing background with remove.bg API...");

  const imageBuffer = await readFile(imagePath);
  const result = await removeBackgroundViaGateway({ imageBuffer: Buffer.from(imageBuffer) });

  await writeArtifact(imagePath, result.imageBuffer, {
    pack: "Media/Art",
    workflow: "Generate.removeBackground",
    artifactType: "image",
  });
  if (result.chargedCredits) {
    console.log(`✅ Background removed successfully (${result.chargedCredits} credits via Studio)`);
  } else {
    console.log("✅ Background removed successfully");
  }
}

// ============================================================================
// Replicate Response Handling
// ============================================================================

// ============================================================================
// Image Generation
// ============================================================================

async function generateWithReplicateImage(
  modelKey: ReplicateModel,
  prompt: string,
  size: ReplicateSize,
  output: string,
  args: CLIArgs,
): Promise<string> {
  const spec = REPLICATE_IMAGE_MODELS[modelKey];
  const input = spec.buildInput(prompt, size, args);

  const refCount = args.referenceImages?.length ?? 0;
  const refInfo = refCount > 0 ? ` with ${refCount} reference image(s)` : "";
  console.log(`\uD83C\uDFA8 Generating with ${spec.id}${refInfo}...`);

  // Gateway shim routes through Studio when STUDIO_API_URL+STUDIO_API_KEY are set,
  // falls back to REPLICATE_API_TOKEN for BYOK. Let the shim decide.
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const result = await replicate.run(spec.id as `${string}/${string}`, { input });

  const imageBuffer = await replicateResultToBuffer(result);
  // Audit-log the real-person-image consent attestation on the artifact (ISC-7) when a
  // reference image was used; the block already ran at parse time.
  const consentMeta =
    args.referenceImages?.length && args.consentAttested
      ? { consentAttested: true, consentModality: "real-person-image" }
      : {};
  const finalPath = await saveImage(imageBuffer, output, consentMeta);
  console.log(`\u2705 Image saved to ${finalPath}`);
  return finalPath;
}

async function generateWithGPTImage(
  prompt: string,
  size: OpenAISize,
  output: string,
  model: "gpt-image-1" | "gpt-image-1.5" = "gpt-image-1",
): Promise<string> {
  console.log(`🤖 Generating with ${model}...`);

  const result = await generateOpenAIImage({ prompt, size, model });
  const finalPath = await saveImage(result.imageBuffer, output);

  if (result.chargedCredits) {
    console.log(`✅ Image saved to ${finalPath} (${result.chargedCredits} credits via Studio)`);
  } else {
    console.log(`✅ Image saved to ${finalPath}`);
  }
  return finalPath;
}

async function generateWithNanoBananaPro(
  prompt: string,
  size: GeminiSize,
  aspectRatio: ReplicateSize,
  output: string,
  referenceImages?: string[],
  consentAttested?: boolean
): Promise<string> {
  if (referenceImages && referenceImages.length > 0) {
    console.log(`🍌✨ Generating with Nano Banana Pro (Gemini 3 Pro) at ${size} ${aspectRatio} with ${referenceImages.length} reference image(s)...`);
  } else {
    console.log(`🍌✨ Generating with Nano Banana Pro (Gemini 3 Pro) at ${size} ${aspectRatio}...`);
  }

  // Build reference image data for the shim
  let refImages: Array<{ mimeType: string; data: string }> | undefined;
  if (referenceImages && referenceImages.length > 0) {
    refImages = [];
    for (const referenceImage of referenceImages) {
      const imageBuffer = await readFile(referenceImage);
      const imageBase64 = imageBuffer.toString("base64");
      const mimeType = await detectMimeType(referenceImage);
      refImages.push({ mimeType, data: imageBase64 });
    }
  }

  const result = await generateGeminiImage({
    prompt,
    aspectRatio,
    imageSize: size,
    referenceImages: refImages,
  });

  // Audit-log the real-person-image consent attestation on the artifact (ISC-7) when a
  // reference image was used; the block already ran at parse time. Mirrors the Replicate path.
  const consentMeta =
    referenceImages?.length && consentAttested
      ? { consentAttested: true, consentModality: "real-person-image" }
      : {};
  const finalPath = await saveImage(result.imageBuffer, output, consentMeta);
  if (result.chargedCredits) {
    console.log(`✅ Image saved to ${finalPath} (${result.chargedCredits} credits via Studio)`);
  } else {
    console.log(`✅ Image saved to ${finalPath}`);
  }
  return finalPath;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    // Load API keys from ${DOS_DIR}/.env
    await loadEnv();

    const args = parseArgs(process.argv);

    // Enhance prompt for transparency if requested
    const finalPrompt = args.transparent
      ? enhancePromptForTransparency(args.prompt)
      : args.prompt;

    if (args.transparent) {
      console.log("🔲 Transparent background mode enabled");
      console.log("💡 Note: Not all models support transparency natively; may require post-processing\n");
    }

    // Dispatch helper — routes to the correct provider
    async function generateOne(prompt: string, model: Model, size: Size, output: string): Promise<string> {
      if (model === "nano-banana-pro") {
        return generateWithNanoBananaPro(prompt, size as GeminiSize, args.aspectRatio!, output, args.referenceImages, args.consentAttested);
      } else if (model === "gpt-image-1" || model === "gpt-image-1.5") {
        return generateWithGPTImage(prompt, size as OpenAISize, output, model);
      } else {
        return generateWithReplicateImage(model as ReplicateModel, prompt, size as ReplicateSize, output, args);
      }
    }

    if (args.creativeVariations && args.creativeVariations > 1) {
      console.log(`\uD83C\uDFA8 Creative Mode: Generating ${args.creativeVariations} variations...`);

      const basePath = args.output.replace(/\.[^.]+$/, "");
      const promises: Promise<string>[] = [];

      for (let i = 1; i <= args.creativeVariations; i++) {
        const varOutput = `${basePath}-v${i}.png`;
        console.log(`Variation ${i}/${args.creativeVariations}: ${varOutput}`);
        promises.push(generateOne(finalPrompt, args.model, args.size, varOutput));
      }

      const actualPaths = await Promise.all(promises);
      console.log(`\n\u2705 Generated ${args.creativeVariations} variations`);
      console.log(`   Files: ${actualPaths.join(", ")}`);
      return;
    }

    let actualOutput = await generateOne(finalPrompt, args.model, args.size, args.output);

    // Remove background if requested (use actual output path)
    if (args.removeBg) {
      await removeBackground(actualOutput);
    }

    // Add background color if requested (standalone mode)
    if (args.addBg && !args.thumbnail) {
      // For standalone --add-bg, modify the image in place
      const tempPath = actualOutput.replace(/\.[^.]+$/, "-temp.png");
      await addBackgroundColor(actualOutput, tempPath, args.addBg);
      // Replace original with the one with background
      const { rename } = await import("node:fs/promises");
      await rename(tempPath, actualOutput);
    }

    // Generate thumbnail with background color if requested (blog header mode)
    if (args.thumbnail) {
      const thumbPath = actualOutput.replace(/\.[^.]+$/, "-thumb.png");
      const THUMBNAIL_BG_COLOR = "#EAE9DF"; // Brand background color for social previews
      await addBackgroundColor(actualOutput, thumbPath, THUMBNAIL_BG_COLOR);
      console.log(`\n📸 Blog header mode: Created both versions`);
      console.log(`   Transparent: ${actualOutput}`);
      console.log(`   Thumbnail:   ${thumbPath}`);
    }
  } catch (error) {
    handleError(error);
  }
}

main();
