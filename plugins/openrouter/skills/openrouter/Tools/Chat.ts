#!/usr/bin/env bun

/**
 * Chat — OpenRouter multi-vendor chat completions CLI
 *
 * Routes through Studio's credit-metered gateway. No BYOK.
 *
 * Usage:
 *   Chat.ts --model anthropic/claude-opus-4-8 --prompt "What is tensor rank?"
 *   Chat.ts --model openai/gpt-5.2 --system "You are terse" --input-file prompt.md
 *   Chat.ts --model google/gemini-2.5-pro --prompt "Describe" --images photo.jpg
 *   Chat.ts --model deepseek/deepseek-r1 --prompt "Prove it" --reasoning high
 *   Chat.ts --model anthropic/claude-sonnet-4-6 --prompt "JSON only" --json
 *
 * @see ~/.claude/skills/openrouter/SKILL.md
 */

import { readFile, appendFile, mkdir } from "node:fs/promises";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";

import { loadEnv } from "../Lib/env.ts";
import { CLIError, handleError } from "../Lib/cli.ts";
import {
  chatCompletions,
  OpenRouterGatewayError,
  type ChatCompletionsRequest,
  type ChatCompletionsSuccess,
  type OpenRouterContentPart,
  type OpenRouterImagePart,
  type OpenRouterToolDefinition,
} from "../Lib/openrouter-gateway.ts";

// ──────────────────────────────────────────────────────────────────────
// Argv parsing
// ──────────────────────────────────────────────────────────────────────

interface CLIArgs {
  model: string;
  prompt?: string;
  inputFile?: string;
  system?: string;
  images: string[];
  tools?: string; // path to JSON file with tool definitions
  toolChoice?: string;
  reasoning?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  providerOrder?: string[];
  idempotencyKey?: string;
  output?: string; // stdout | <path>
  verbose?: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: Partial<CLIArgs> = { images: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) {
        throw new CLIError(`Missing value for ${arg}`);
      }
      i++;
      return v;
    };
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      case "--model":
        args.model = next();
        break;
      case "--prompt":
        args.prompt = next();
        break;
      case "--input-file":
        args.inputFile = next();
        break;
      case "--system":
        args.system = next();
        break;
      case "--images":
        args.images = next()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--tools":
        args.tools = next();
        break;
      case "--tool-choice":
        args.toolChoice = next();
        break;
      case "--reasoning":
        args.reasoning = next();
        break;
      case "--json":
        args.json = true;
        break;
      case "--max-tokens":
        args.maxTokens = Number.parseInt(next(), 10);
        break;
      case "--temperature":
        args.temperature = Number.parseFloat(next());
        break;
      case "--top-p":
        args.topP = Number.parseFloat(next());
        break;
      case "--stream":
        args.stream = true;
        break;
      case "--provider-order":
        args.providerOrder = next()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--idempotency-key":
        args.idempotencyKey = next();
        break;
      case "--output":
        args.output = next();
        break;
      case "--verbose":
      case "-v":
        args.verbose = true;
        break;
      default:
        throw new CLIError(`Unknown flag: ${arg}`);
    }
  }

  if (!args.model) {
    throw new CLIError(
      "Required flag: --model <id> (e.g., anthropic/claude-opus-4-8)",
    );
  }

  return args as CLIArgs;
}

function printHelp(): void {
  console.log(`\
OpenRouter Chat — multi-vendor LLM inference via Studio gateway

Usage:
  Chat.ts --model <id> --prompt <text> [flags]

Required:
  --model <id>             OpenRouter model (e.g., anthropic/claude-opus-4-8)

Input (one of):
  --prompt <text>          User message
  --input-file <path>      Read user message from file
  (or pipe via stdin)

Optional:
  --system <text>          System prompt
  --images <p1,p2,...>     Base64-encoded image parts from local files
  --tools <path>           OpenAI-compat tools[] JSON file
  --tool-choice <value>    auto | none | required | {"type":"function","function":{"name":"X"}}
  --reasoning <effort>     xhigh | high | medium | low | minimal | none
  --json                   Force JSON object response (response_format)
  --max-tokens <n>         Output token cap
  --temperature <0..2>
  --top-p <0..1>
  --stream                 SSE delta stream (Phase 1B.2 — NOT yet on gateway)
  --provider-order <p1,p2> Comma-separated preferred provider slugs
  --idempotency-key <uuid> Replay-safe retry key
  --output <stdout|path>   Default stdout; path writes response body
  --verbose                Print full response metadata to stderr
  --help, -h               This help
`);
}

// ──────────────────────────────────────────────────────────────────────
// Input collection
// ──────────────────────────────────────────────────────────────────────

async function readPromptContent(args: CLIArgs): Promise<string> {
  if (args.prompt) return args.prompt;
  if (args.inputFile) {
    try {
      return await readFile(args.inputFile, "utf-8");
    } catch (err) {
      throw new CLIError(
        `Failed to read --input-file ${args.inputFile}: ${(err as Error).message}`,
      );
    }
  }
  // Fallback: read stdin if not a TTY.
  if (!process.stdin.isTTY) {
    return await Bun.stdin.text();
  }
  throw new CLIError(
    "No prompt provided. Use --prompt <text>, --input-file <path>, or pipe via stdin.",
  );
}

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

async function encodeImage(path: string): Promise<OpenRouterImagePart> {
  const ext = extname(path).toLowerCase();
  const mime = IMAGE_MIME[ext];
  if (!mime) {
    throw new CLIError(
      `Unsupported image extension ${ext || "(none)"} for ${path}. Supported: ${Object.keys(IMAGE_MIME).join(", ")}`,
    );
  }
  const buffer = await readFile(path);
  const b64 = buffer.toString("base64");
  return {
    type: "image_url",
    image_url: { url: `data:${mime};base64,${b64}` },
  };
}

async function readToolDefinitions(
  path: string,
): Promise<OpenRouterToolDefinition[]> {
  let text: string;
  try {
    text = await readFile(path, "utf-8");
  } catch (err) {
    throw new CLIError(
      `Failed to read --tools file ${path}: ${(err as Error).message}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new CLIError(
      `--tools file is not valid JSON: ${(err as Error).message}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new CLIError(
      `--tools file must be a JSON array of tool definitions`,
    );
  }
  return parsed as OpenRouterToolDefinition[];
}

// ──────────────────────────────────────────────────────────────────────
// Request building
// ──────────────────────────────────────────────────────────────────────

function parseToolChoice(
  raw: string,
): ChatCompletionsRequest["toolChoice"] | undefined {
  if (raw === "auto" || raw === "none" || raw === "required") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new CLIError(
      `Invalid --tool-choice: ${raw}. Use auto|none|required or JSON.`,
    );
  }
}

function parseReasoning(
  raw: string,
): ChatCompletionsRequest["reasoning"] | undefined {
  const valid = new Set(["xhigh", "high", "medium", "low", "minimal", "none"]);
  if (!valid.has(raw)) {
    throw new CLIError(
      `Invalid --reasoning: ${raw}. Use xhigh|high|medium|low|minimal|none.`,
    );
  }
  return { effort: raw as "xhigh" | "high" | "medium" | "low" | "minimal" | "none" };
}

async function buildRequest(
  args: CLIArgs,
  prompt: string,
): Promise<ChatCompletionsRequest> {
  const imageParts = await Promise.all(args.images.map(encodeImage));

  const userContent: string | OpenRouterContentPart[] =
    imageParts.length > 0
      ? [{ type: "text", text: prompt }, ...imageParts]
      : prompt;

  const messages: ChatCompletionsRequest["messages"] = [];
  if (args.system) {
    messages.push({ role: "system", content: args.system });
  }
  messages.push({ role: "user", content: userContent });

  const request: ChatCompletionsRequest = {
    modelId: args.model,
    messages,
  };
  if (args.maxTokens !== undefined) request.maxTokens = args.maxTokens;
  if (args.temperature !== undefined) request.temperature = args.temperature;
  if (args.topP !== undefined) request.topP = args.topP;
  if (args.json) request.responseFormat = { type: "json_object" };
  if (args.reasoning) request.reasoning = parseReasoning(args.reasoning);
  if (args.tools) request.tools = await readToolDefinitions(args.tools);
  if (args.toolChoice) request.toolChoice = parseToolChoice(args.toolChoice);
  if (args.providerOrder && args.providerOrder.length > 0) {
    request.provider = { order: args.providerOrder };
  }
  return request;
}

// ──────────────────────────────────────────────────────────────────────
// Output
// ──────────────────────────────────────────────────────────────────────

async function writeContent(args: CLIArgs, content: string): Promise<void> {
  if (!args.output || args.output === "stdout") {
    process.stdout.write(content);
    if (!content.endsWith("\n")) process.stdout.write("\n");
    return;
  }
  const { writeFile } = await import("node:fs/promises");
  // writeArtifact:exempt — user-specified output path via --output flag; artifact tracking happens separately in logArtifact()
  await writeFile(args.output, content, "utf-8");
  console.error(`✓ wrote ${content.length} bytes to ${args.output}`);
}

function printMetadata(response: ChatCompletionsSuccess): void {
  const meta = {
    generationId: response.generationId,
    model: response.model,
    provider: response.provider,
    finishReason: response.finishReason,
    chargedCredits: response.chargedCredits,
    actualCostCents: response.actualCostCents,
    usage: response.usage,
    cacheHit: response.cacheHit,
    toolCalls: response.toolCalls?.length ?? 0,
    hasReasoning: !!response.reasoning,
  };
  console.error(JSON.stringify(meta, null, 2));
}

// ──────────────────────────────────────────────────────────────────────
// Artifact logging — MEMORY/ARTIFACTS/artifacts.jsonl
// ──────────────────────────────────────────────────────────────────────

async function logArtifact(
  args: CLIArgs,
  response: ChatCompletionsSuccess,
): Promise<void> {
  try {
    const home = process.env.HOME;
    if (!home) return;
    const projectDir = process.env.CLAUDE_PROJECT_DIR;
    const artifactsDir = projectDir
      ? `${projectDir.replace(/^~(?=\/|$)/, home)}/MEMORY/ARTIFACTS`
      : `${home}/.claude/MEMORY/ARTIFACTS`;
    await mkdir(artifactsDir, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      pack: "OpenRouter",
      workflow: "ChatCompletion",
      type: "inference",
      title: `${args.model} — ${(args.prompt ?? "(stdin)").slice(0, 60)}`,
      path: `ephemeral://openrouter/chat/${response.generationId}`,
      generationId: response.generationId,
      model: response.model,
      provider: response.provider,
      actualCostCents: response.actualCostCents,
      chargedCredits: response.chargedCredits,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      cacheHit: response.cacheHit,
      contentPreview: response.content.slice(0, 200),
      wing: process.env.DOS_WING ?? null,
      sessionId: process.env.CLAUDE_SESSION_ID ?? null,
    };
    await appendFile(
      `${artifactsDir}/artifacts.jsonl`,
      JSON.stringify(entry) + "\n",
      "utf-8",
    );
  } catch {
    // Best-effort only.
  }
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (args.stream) {
    throw new CLIError(
      "--stream is not yet supported. The streaming sibling route (Phase 1B.2) " +
        "is pending. Drop --stream for now; non-streaming inference works end-to-end.",
    );
  }

  const prompt = await readPromptContent(args);
  const request = await buildRequest(args, prompt);
  const idempotencyKey = args.idempotencyKey ?? randomUUID();

  let response: ChatCompletionsSuccess;
  try {
    response = await chatCompletions(request, { idempotencyKey });
  } catch (err) {
    if (err instanceof OpenRouterGatewayError) {
      throw new CLIError(
        `Gateway ${err.httpStatus} ${err.code}: ${err.message}`,
        err.httpStatus >= 500 ? 2 : 1,
      );
    }
    throw err;
  }

  await writeContent(args, response.content);
  if (args.verbose) printMetadata(response);
  await logArtifact(args, response);
}

main().catch(handleError);
