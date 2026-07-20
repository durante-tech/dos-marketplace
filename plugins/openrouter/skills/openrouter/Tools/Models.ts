#!/usr/bin/env bun

/**
 * Models — OpenRouter model catalogue CLI
 *
 * Fetches the 24h-cached model catalogue from Studio's
 * GET /api/v1/inference/openrouter/models route and prints a filtered
 * table or JSON dump.
 *
 * Usage:
 *   Models.ts                                   # all models, table
 *   Models.ts --author anthropic
 *   Models.ts --min-context 100000 --max-price 0.003
 *   Models.ts --format json > catalogue.json
 */

import { loadEnv } from "../Lib/env.ts";
import { CLIError, handleError } from "../Lib/cli.ts";
import {
  listModels,
  OpenRouterGatewayError,
  type OpenRouterModel,
} from "../Lib/openrouter-gateway.ts";

// ──────────────────────────────────────────────────────────────────────
// Argv
// ──────────────────────────────────────────────────────────────────────

interface CLIArgs {
  author?: string;
  minContext?: number;
  maxPrice?: number;
  modality?: string;
  format: "table" | "json";
  limit?: number;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = { format: "table" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) throw new CLIError(`Missing value for ${arg}`);
      i++;
      return v;
    };
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      case "--author":
        args.author = next().toLowerCase();
        break;
      case "--min-context":
        args.minContext = Number.parseInt(next(), 10);
        break;
      case "--max-price":
        args.maxPrice = Number.parseFloat(next());
        break;
      case "--modality":
        args.modality = next().toLowerCase();
        break;
      case "--format":
        {
          const v = next();
          if (v !== "table" && v !== "json") {
            throw new CLIError(`--format must be 'table' or 'json', got ${v}`);
          }
          args.format = v;
        }
        break;
      case "--limit":
        args.limit = Number.parseInt(next(), 10);
        break;
      default:
        throw new CLIError(`Unknown flag: ${arg}`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`\
OpenRouter Models — live catalogue of 300+ models

Usage:
  Models.ts [flags]

Filters:
  --author <name>           Vendor prefix (anthropic, openai, google, meta-llama, …)
  --min-context <tokens>    Minimum context window (e.g. 100000)
  --max-price <usd-per-mtok> Max input price in USD per million tokens
  --modality <text|image>   Require an input modality
  --limit <n>               Cap results after filtering

Output:
  --format <table|json>     Default table
  --help, -h

Cache:
  Studio's /api/v1/inference/openrouter/models route serves a 24h-cached
  proxy of OpenRouter's upstream catalogue. No Bearer needed; public
  rate-limited at the IP layer.
`);
}

// ──────────────────────────────────────────────────────────────────────
// Filtering
// ──────────────────────────────────────────────────────────────────────

function pricePerMTok(raw: string | undefined): number | null {
  if (!raw) return null;
  // OpenRouter returns pricing as USD-per-token strings; multiply by 1M
  // to get USD-per-million-tokens (the unit humans shop with).
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return n * 1_000_000;
}

function filterModels(
  models: OpenRouterModel[],
  args: CLIArgs,
): OpenRouterModel[] {
  let filtered = models;

  if (args.author) {
    filtered = filtered.filter((m) =>
      m.id.toLowerCase().startsWith(`${args.author}/`),
    );
  }
  if (args.minContext !== undefined) {
    const min = args.minContext;
    filtered = filtered.filter((m) => m.context_length >= min);
  }
  if (args.maxPrice !== undefined) {
    const max = args.maxPrice;
    filtered = filtered.filter((m) => {
      const price = pricePerMTok(m.pricing.prompt);
      return price !== null && price <= max;
    });
  }
  if (args.modality) {
    const want = args.modality;
    filtered = filtered.filter((m) =>
      (m.architecture?.input_modalities ?? []).some(
        (x) => x.toLowerCase() === want,
      ),
    );
  }
  if (args.limit !== undefined) {
    filtered = filtered.slice(0, args.limit);
  }
  return filtered;
}

// ──────────────────────────────────────────────────────────────────────
// Output
// ──────────────────────────────────────────────────────────────────────

function formatTable(models: OpenRouterModel[]): string {
  if (models.length === 0) return "(no models match filter)\n";

  const rows = models.map((m) => {
    const inPrice = pricePerMTok(m.pricing.prompt);
    const outPrice = pricePerMTok(m.pricing.completion);
    return {
      id: m.id,
      ctx: m.context_length.toLocaleString(),
      in: inPrice === null ? "?" : `$${inPrice.toFixed(2)}`,
      out: outPrice === null ? "?" : `$${outPrice.toFixed(2)}`,
    };
  });

  const widths = {
    id: Math.max(8, ...rows.map((r) => r.id.length)),
    ctx: Math.max(7, ...rows.map((r) => r.ctx.length)),
    in: Math.max(10, ...rows.map((r) => r.in.length)),
    out: Math.max(10, ...rows.map((r) => r.out.length)),
  };

  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
  const sep =
    "─".repeat(widths.id) +
    " ┼ " +
    "─".repeat(widths.ctx) +
    " ┼ " +
    "─".repeat(widths.in) +
    " ┼ " +
    "─".repeat(widths.out);

  const header =
    `${pad("model", widths.id)} │ ${pad("ctx", widths.ctx)} │ ${pad("$/Mtok in", widths.in)} │ ${pad("$/Mtok out", widths.out)}`;

  const body = rows
    .map(
      (r) =>
        `${pad(r.id, widths.id)} │ ${pad(r.ctx, widths.ctx)} │ ${pad(r.in, widths.in)} │ ${pad(r.out, widths.out)}`,
    )
    .join("\n");

  return `${header}\n${sep.replaceAll("┼", "┼")}\n${body}\n\n${models.length} model(s) shown\n`;
}

function formatJson(models: OpenRouterModel[]): string {
  return JSON.stringify(models, null, 2) + "\n";
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));

  let catalogue;
  try {
    catalogue = await listModels();
  } catch (err) {
    if (err instanceof OpenRouterGatewayError) {
      throw new CLIError(
        `Gateway ${err.httpStatus}: ${err.message}`,
        err.httpStatus >= 500 ? 2 : 1,
      );
    }
    throw err;
  }

  if (catalogue.stale) {
    console.error(
      `⚠ serving stale catalogue from ${catalogue.cachedAt} — upstream error: ${catalogue.upstreamError ?? "unknown"}`,
    );
  }

  const models = filterModels(catalogue.data, args);
  const output =
    args.format === "json" ? formatJson(models) : formatTable(models);
  process.stdout.write(output);
}

main().catch(handleError);
