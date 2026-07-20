#!/usr/bin/env bun

/**
 * Search — Ref documentation search CLI
 *
 * Routes through Studio's credit-metered gateway. No BYOK.
 *
 * Usage:
 *   Search.ts --query "Prisma transaction timeout option"
 *   Search.ts --query "Next.js app router dynamic routes" --json
 *   Search.ts --input-file query.txt --idempotency-key abc-123
 *   echo "what is tensor rank" | Search.ts
 *
 * @see ~/.claude/skills/ref/SKILL.md
 */

import { readFile, appendFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { loadEnv } from "../Lib/env.ts";
import { CLIError, handleError } from "../Lib/cli.ts";
import {
  searchDocumentation,
  RefGatewayError,
  type SearchSuccess,
} from "../Lib/ref-gateway.ts";

interface CLIArgs {
  query?: string;
  inputFile?: string;
  refSrc?: "public" | "private" | "all";
  idempotencyKey?: string;
  json?: boolean;
  verbose?: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {};

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
      case "--query":
        args.query = next();
        break;
      case "--input-file":
        args.inputFile = next();
        break;
      case "--ref-src": {
        const v = next();
        if (v !== "public" && v !== "private" && v !== "all") {
          throw new CLIError(
            `Invalid --ref-src: ${v}. Use public|private|all.`,
          );
        }
        args.refSrc = v;
        break;
      }
      case "--idempotency-key":
        args.idempotencyKey = next();
        break;
      case "--json":
        args.json = true;
        break;
      case "--verbose":
      case "-v":
        args.verbose = true;
        break;
      default:
        throw new CLIError(`Unknown flag: ${arg}`);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`\
Ref Search — documentation search via Studio gateway

Usage:
  Search.ts --query <text> [flags]

Required (one of):
  --query <text>           Search query
  --input-file <path>      Read query from file
  (or pipe via stdin)

Optional:
  --ref-src <scope>        public | private | all (default: public)
  --idempotency-key <uuid> Replay-safe retry key
  --json                   Emit raw API JSON
  --verbose, -v            Print response metadata to stderr
  --help, -h               This help
`);
}

async function readQueryContent(args: CLIArgs): Promise<string> {
  if (args.query) return args.query.trim();
  if (args.inputFile) {
    try {
      const content = await readFile(args.inputFile, "utf-8");
      return content.trim();
    } catch (err) {
      throw new CLIError(
        `Failed to read --input-file ${args.inputFile}: ${(err as Error).message}`,
      );
    }
  }
  if (!process.stdin.isTTY) {
    return (await Bun.stdin.text()).trim();
  }
  throw new CLIError(
    "No query provided. Use --query <text>, --input-file <path>, or pipe via stdin.",
  );
}

function renderResults(response: SearchSuccess, query?: string): string {
  if (response.results.length === 0) {
    return query
      ? `No results found for "${query}". Try a more specific library or API name, or --ref-src all/private if entitled.`
      : "No results found.";
  }
  return response.results
    .map((r) =>
      [
        r.overview ? `overview: ${r.overview}` : null,
        `url: ${r.url}`,
        r.moduleId ? `moduleId: ${r.moduleId}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n---\n");
}

function printMetadata(response: SearchSuccess): void {
  const meta = {
    generationId: response.generationId,
    chargedCredits: response.chargedCredits,
    actualCostCents: response.actualCostCents,
    cacheHit: response.cacheHit,
    totalResults: response.totalResults,
  };
  console.error(JSON.stringify(meta, null, 2));
}

async function logArtifact(
  query: string,
  response: SearchSuccess,
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
      pack: "Ref",
      workflow: "DocsLookup",
      type: "documentation_search",
      title: `search — ${query.slice(0, 80)}`,
      path: `ephemeral://ref/search/${response.generationId}`,
      generationId: response.generationId,
      chargedCredits: response.chargedCredits,
      actualCostCents: response.actualCostCents,
      cacheHit: response.cacheHit,
      totalResults: response.totalResults,
      contentPreview: renderResults(response, query).slice(0, 200),
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

async function main(): Promise<void> {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const query = await readQueryContent(args);
  if (!query) {
    throw new CLIError("Query is empty after trimming.");
  }
  const idempotencyKey = args.idempotencyKey ?? randomUUID();

  let response: SearchSuccess;
  try {
    response = await searchDocumentation(
      { query, refSrc: args.refSrc },
      { idempotencyKey },
    );
  } catch (err) {
    if (err instanceof RefGatewayError) {
      throw new CLIError(
        `Gateway ${err.httpStatus} ${err.code}: ${err.message}`,
        err.httpStatus >= 500 ? 3 : err.httpStatus === 404 ? 3 : 1,
      );
    }
    throw err;
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(response, null, 2) + "\n");
  } else {
    process.stdout.write(renderResults(response, query) + "\n");
  }
  if (args.verbose) printMetadata(response);
  await logArtifact(query, response);
}

main().catch(handleError);
