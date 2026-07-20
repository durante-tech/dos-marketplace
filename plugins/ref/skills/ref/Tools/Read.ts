#!/usr/bin/env bun

/**
 * Read — Ref documentation URL fetch CLI (returns markdown)
 *
 * Routes through Studio's credit-metered gateway. No BYOK.
 *
 * Usage:
 *   Read.ts --url "https://www.prisma.io/docs/orm/reference/prisma-client-reference#transactionoptions"
 *   Read.ts --url "https://nextjs.org/docs/..." --json
 *   Read.ts --url "..." --idempotency-key abc-123
 *
 * @see ~/.claude/skills/ref/SKILL.md
 */

import { appendFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { loadEnv } from "../Lib/env.ts";
import { CLIError, handleError } from "../Lib/cli.ts";
import {
  readUrl,
  RefGatewayError,
  type ReadSuccess,
} from "../Lib/ref-gateway.ts";

interface CLIArgs {
  url?: string;
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
      case "--url":
        args.url = next();
        break;
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
Ref Read — fetch URL as markdown via Studio gateway

Usage:
  Read.ts --url <http-url> [flags]

Required:
  --url <http-url>         URL to fetch (must start with http:// or https://)

Optional:
  --idempotency-key <uuid> Replay-safe retry key
  --json                   Emit raw API JSON instead of markdown content
  --verbose, -v            Print response metadata to stderr
  --help, -h               This help
`);
}

function printMetadata(response: ReadSuccess): void {
  const meta = {
    generationId: response.generationId,
    chargedCredits: response.chargedCredits,
    actualCostCents: response.actualCostCents,
    cacheHit: response.cacheHit,
    contentLength: response.content.length,
  };
  console.error(JSON.stringify(meta, null, 2));
}

async function logArtifact(
  url: string,
  response: ReadSuccess,
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
      type: "documentation_read",
      title: `read — ${url.slice(0, 80)}`,
      path: `ephemeral://ref/read/${response.generationId}`,
      generationId: response.generationId,
      chargedCredits: response.chargedCredits,
      actualCostCents: response.actualCostCents,
      cacheHit: response.cacheHit,
      contentLength: response.content.length,
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

async function main(): Promise<void> {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    throw new CLIError("Required flag: --url <http-url>");
  }
  if (!/^https?:\/\//.test(args.url)) {
    throw new CLIError(
      `--url requires an http(s) URL, got: ${args.url}`,
    );
  }
  const idempotencyKey = args.idempotencyKey ?? randomUUID();

  let response: ReadSuccess;
  try {
    response = await readUrl({ url: args.url }, { idempotencyKey });
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
    process.stdout.write(response.content);
    if (!response.content.endsWith("\n")) process.stdout.write("\n");
  }
  if (args.verbose) printMetadata(response);
  await logArtifact(args.url, response);
}

main().catch(handleError);
