#!/usr/bin/env bun
/**
 * RunApify - Apify actor execution CLI
 *
 * DOS Scraping/Apify pack tool for executing Apify actors via the Studio
 * gateway (metered, with credit accounting). Mirrors the Perplexity.ts /
 * BraveSearch.ts / FirecrawlScrape.ts CLI shape so subagents and workflows
 * can shell out via a single Bash call instead of authoring inline TypeScript.
 *
 * STUDIO MODE (required):
 *   Routes through /api/v1/scraping/apify/run. Studio holds the pooled
 *   APIFY_TOKEN server-side; the gateway meters every call. The CLI polls
 *   /api/v1/media/generations/{id} until the run completes, then fetches
 *   and prints the dataset items.
 *
 * USAGE
 * -----
 *   bun RunApify.ts <actorId> --input <json>
 *   bun RunApify.ts <actorId> --input-file <path>
 *   bun RunApify.ts apify/instagram-scraper --input '{"usernames":["nasa"],"resultsLimit":10}'
 *   bun RunApify.ts apify/google-maps-scraper --input '{"searchStringsArray":["restaurants in SF"]}' --json-only
 *
 * OPTIONS
 * -------
 *   <actorId>              Apify actor identifier (e.g. apify/web-scraper)
 *   --input <json>         JSON-encoded actor input
 *   --input-file <path>    Read JSON input from file (alternative to --input)
 *   --memory <mb>          Actor memory (128|256|512|1024|2048|4096|8192)
 *   --timeout <secs>       Run timeout (default: 300)
 *   --build <id>           Actor build ID (default: latest)
 *   --wait-secs <n>        Max seconds to wait for completion (default: 300)
 *   --json-only            Suppress stderr status; only JSON to stdout
 *
 * OUTPUT (stdout, always JSON)
 * ----------------------------
 *   {
 *     "actorId": "apify/instagram-scraper",
 *     "items": [...],         // dataset items returned by the actor
 *     "itemCount": 10,
 *     "chargedCredits": 1200, // credits metered by Studio
 *     "mode": "studio",
 *     "generationId": "uuid"
 *   }
 *
 * EXIT CODES
 * ----------
 *   0  success
 *   1  CLI usage error
 *   2  configuration error (Studio not configured, invalid input JSON)
 *   3  provider error (gateway 4xx/5xx, run failed, run timed out)
 *
 * @see Packs/scraping/src/Apify/SKILL.md
 * @see Packs/scraping/src/Apify/Lib/apify-gateway.ts
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runActor, GatewayError } from "@durante/scraping/Apify";

class CLIError extends Error {
  constructor(message: string, public readonly exitCode: number = 1) {
    super(message);
    this.name = "CLIError";
  }
}

interface CLIArgs {
  actorId: string;
  input: Record<string, unknown>;
  memory?: number;
  timeout?: number;
  build?: string;
  waitSecs?: number;
  jsonOnly: boolean;
}

async function parseArgs(argv: string[]): Promise<CLIArgs> {
  let actorId = "";
  let inputJson: string | undefined;
  let inputFile: string | undefined;
  let memory: number | undefined;
  let timeout: number | undefined;
  let build: string | undefined;
  let waitSecs: number | undefined;
  let jsonOnly = false;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--input":
        if (!next) throw new CLIError("--input requires a value", 1);
        inputJson = next;
        i++;
        break;
      case "--input-file":
        if (!next) throw new CLIError("--input-file requires a value", 1);
        inputFile = next;
        i++;
        break;
      case "--memory":
        if (!next) throw new CLIError("--memory requires a value", 1);
        memory = parseInt(next, 10);
        if (Number.isNaN(memory)) throw new CLIError(`Invalid --memory: ${next}`, 1);
        i++;
        break;
      case "--timeout":
        if (!next) throw new CLIError("--timeout requires a value", 1);
        timeout = parseInt(next, 10);
        if (Number.isNaN(timeout)) throw new CLIError(`Invalid --timeout: ${next}`, 1);
        i++;
        break;
      case "--build":
        if (!next) throw new CLIError("--build requires a value", 1);
        build = next;
        i++;
        break;
      case "--wait-secs":
        if (!next) throw new CLIError("--wait-secs requires a value", 1);
        waitSecs = parseInt(next, 10);
        if (Number.isNaN(waitSecs)) throw new CLIError(`Invalid --wait-secs: ${next}`, 1);
        i++;
        break;
      case "--json-only":
        jsonOnly = true;
        break;
      case "--help":
      case "-h":
        throw new CLIError("__HELP__", 0);
      default:
        if (a?.startsWith("--")) throw new CLIError(`Unknown flag: ${a}`, 1);
        if (a) positional.push(a);
    }
  }

  if (positional.length === 0) {
    throw new CLIError("No actorId provided. First positional argument must be the Apify actor ID (e.g. apify/web-scraper).", 1);
  }
  actorId = positional[0]!;

  let input: Record<string, unknown> = {};
  if (inputJson && inputFile) {
    throw new CLIError("Use either --input or --input-file, not both", 1);
  }
  if (inputFile) {
    const path = resolve(inputFile);
    const raw = await readFile(path, "utf8");
    try {
      input = JSON.parse(raw);
    } catch (err) {
      throw new CLIError(`Invalid JSON in --input-file ${path}: ${(err as Error).message}`, 2);
    }
  } else if (inputJson) {
    try {
      input = JSON.parse(inputJson);
    } catch (err) {
      throw new CLIError(`Invalid JSON in --input: ${(err as Error).message}`, 2);
    }
  }

  return { actorId, input, memory, timeout, build, waitSecs, jsonOnly };
}

function printHelp(): void {
  console.log(`run-apify - Apify actor execution via Studio gateway

Usage:
  bun RunApify.ts <actorId> [--input <json> | --input-file <path>] [options]

Arguments:
  <actorId>              Apify actor identifier (e.g. apify/web-scraper)

Options:
  --input <json>         JSON-encoded actor input
  --input-file <path>    Read JSON input from file
  --memory <mb>          Actor memory (128|256|512|1024|2048|4096|8192)
  --timeout <secs>       Run timeout (default: 300)
  --build <id>           Actor build ID (default: latest)
  --wait-secs <n>        Max seconds to wait for completion (default: 300)
  --json-only            Suppress status lines; only JSON to stdout
  --help                 This message

Env:
  STUDIO_API_URL         enables gateway mode (required)
  STUDIO_API_KEY         bearer token for Studio (required)

Examples:
  bun RunApify.ts apify/instagram-scraper \\
    --input '{"usernames":["nasa"],"resultsLimit":10}'

  bun RunApify.ts apify/google-maps-scraper \\
    --input '{"searchStringsArray":["restaurants in SF"]}' --json-only

  bun RunApify.ts apify/web-scraper --input-file ./web-scraper-input.json
`);
}

async function main(): Promise<void> {
  let args: CLIArgs;
  try {
    args = await parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CLIError && error.message === "__HELP__") {
      printHelp();
      process.exit(0);
    }
    if (error instanceof CLIError) {
      console.error(`Error: ${error.message}`);
      process.exit(error.exitCode);
    }
    throw error;
  }

  if (!args.jsonOnly) {
    console.error(`🎬 Running Apify actor: ${args.actorId} (waiting up to ${args.waitSecs ?? 300}s)...`);
  }

  try {
    const result = await runActor({
      actorId: args.actorId,
      input: args.input,
      memory: args.memory,
      timeout: args.timeout,
      build: args.build,
      waitSecs: args.waitSecs,
    });

    process.stdout.write(JSON.stringify({
      actorId: args.actorId,
      items: result.items,
      itemCount: result.itemCount,
      chargedCredits: result.chargedCredits,
      mode: result.mode,
      generationId: result.generationId,
    }, null, 2) + "\n");

    if (!args.jsonOnly) {
      const credits = result.chargedCredits != null ? `${result.chargedCredits} credits` : "no charge reported";
      console.error(`✅ ${result.itemCount} items returned — ${credits} via Studio`);
    }
  } catch (error) {
    if (error instanceof GatewayError) {
      const code = error.code;
      let exitCode = 3;
      if (code === "unauthorized") exitCode = 2;
      if (code === "insufficient_credits") exitCode = 3;
      console.error(`❌ Gateway error (${code}): ${error.message}`);
      process.exit(exitCode);
    }
    if (error instanceof CLIError) {
      console.error(`❌ ${error.message}`);
      process.exit(error.exitCode);
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Unexpected error: ${message}`);
    process.exit(3);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(3);
  });
}
