/**
 * Durante Studio Media Gateway Shim
 *
 * Drop-in replacement for `import Replicate from "replicate"` that routes
 * through Studio's pooled-key gateway when STUDIO_API_URL + STUDIO_API_KEY
 * are configured, and falls back to the real Replicate SDK otherwise.
 *
 * Migration: change one line per tool file
 *   - import Replicate from "replicate";
 *   + import Replicate from "../../Lib/gateway.ts";
 *
 * Env:
 *   STUDIO_API_URL       e.g. https://www.duranteos.com — gateway mode
 *   STUDIO_API_KEY       bearer token from Studio dashboard
 */

import { fetchStudioOutput } from "./gateway-shared.ts";

type ReplicateConstructorOptions = { auth?: string };
type RunInput = { input: Record<string, unknown> };
type ModelId = `${string}/${string}` | `${string}/${string}:${string}`;

const POLL_INITIAL_MS = 1000;
const POLL_MAX_MS = 5000;
const POLL_BACKOFF = 1.5;
const WALL_CLOCK_MS = 10 * 60 * 1000;

const FETCH_RETRIES = 3;
const FETCH_BACKOFF_MS = [500, 1500, 4000];

/**
 * FileOutput-compatible wrapper. Existing replicateResultToBuffer() in
 * Packs/media/src/Lib/replicate.ts checks `typeof result.url === "function"`
 * and expects an absolute http(s) URL. Studio may return a relative storage
 * path (e.g. `/storage.dev/gateway/...`) in dev, so we resolve against the
 * configured STUDIO_API_URL origin at construction time.
 */
class StudioFileOutput {
  private readonly _absoluteUrl: string;
  private readonly _studioOrigin: string;
  private readonly _studioKey: string;

  constructor(rawUrl: string, studioOrigin: string, studioKey: string) {
    this._absoluteUrl = resolveAgainstOrigin(rawUrl, studioOrigin);
    this._studioOrigin = studioOrigin;
    this._studioKey = studioKey;
  }
  url(): string {
    return this._absoluteUrl;
  }
  async blob(): Promise<Blob> {
    const response = await fetchStudioOutput(this._absoluteUrl, this._studioOrigin, this._studioKey);
    if (!response.ok) {
      throw new Error(`Failed to fetch gateway output ${this._absoluteUrl}: ${response.status}`);
    }
    return response.blob();
  }
}

function resolveAgainstOrigin(rawUrl: string, origin: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  // Strip trailing slash from origin, ensure leading slash on path.
  const cleanOrigin = origin.replace(/\/+$/, "");
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${cleanOrigin}${cleanPath}`;
}

type GatewayErrorCode =
  | "insufficient_credits"
  | "unauthorized"
  | "rate_limited"
  | "provider_failure"
  | "generation_timeout"
  | "server_error"
  | "network_error"
  | "invalid_request";

export class GatewayError extends Error {
  constructor(
    public readonly code: GatewayErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

interface CreatePredictionResponse {
  generationId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  output?: string | null;
  chargedCredits?: number | null;
  reservedCredits?: number | null;
  cacheHit?: boolean;
  balance?: number | null;
}

interface PollResponse {
  generationId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "released";
  output?: string | null;
  chargedCredits?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export default class Replicate {
  private readonly studioUrl: string;
  private readonly studioKey: string;

  constructor(_options: ReplicateConstructorOptions = {}) {
    // studioClient:exempt — BYOK gateway routing (Studio-or-direct), not the silent-skip auth guard pattern. Migration to getStudioConfig() is a separate pass.
    const url = process.env.STUDIO_API_URL ?? null;
    const key = process.env.STUDIO_ORG_API_KEY ?? process.env.STUDIO_API_KEY ?? null;

    if (!url || !key) {
      throw new GatewayError("unauthorized", 401, "Studio gateway not configured. Run: durante configure");
    }
    this.studioUrl = url;
    this.studioKey = key;
  }

  async run(modelId: ModelId, options: RunInput): Promise<unknown> {
    return this.runViaGateway(modelId, options);
  }

  private async runViaGateway(
    modelId: string,
    options: RunInput,
  ): Promise<StudioFileOutput> {
    const idempotencyKey = crypto.randomUUID();

    const createResp = (await this.fetchStudio(
      "POST",
      "/api/v1/media/replicate/predictions",
      {
        body: { modelId, input: options.input },
        idempotencyKey,
      },
    )) as CreatePredictionResponse;

    if (createResp.status === "succeeded") {
      if (!createResp.output) {
        throw new GatewayError(
          "provider_failure",
          502,
          "Gateway returned succeeded but no output URL",
        );
      }
      return new StudioFileOutput(createResp.output, this.studioUrl!, this.studioKey);
    }

    return this.pollUntilDone(createResp.generationId);
  }

  private async pollUntilDone(generationId: string): Promise<StudioFileOutput> {
    const startedAt = Date.now();
    let intervalMs = POLL_INITIAL_MS;

    while (true) {
      if (Date.now() - startedAt > WALL_CLOCK_MS) {
        throw new GatewayError(
          "generation_timeout",
          504,
          `Generation ${generationId} exceeded 10-minute wall clock`,
        );
      }

      await sleep(intervalMs);
      intervalMs = Math.min(intervalMs * POLL_BACKOFF, POLL_MAX_MS);

      const poll = (await this.fetchStudio(
        "GET",
        `/api/v1/media/generations/${generationId}`,
        {},
      )) as PollResponse;

      if (poll.status === "succeeded") {
        if (!poll.output) {
          throw new GatewayError(
            "provider_failure",
            502,
            "Gateway reported success but no output URL",
          );
        }
        return new StudioFileOutput(poll.output, this.studioUrl!, this.studioKey);
      }
      if (poll.status === "failed" || poll.status === "released") {
        throw new GatewayError(
          "provider_failure",
          502,
          poll.errorMessage ?? "Provider failed",
          { providerCode: poll.errorCode ?? undefined },
        );
      }
      // queued | running → continue polling
    }
  }

  private async fetchStudio(
    method: "GET" | "POST",
    path: string,
    opts: { body?: unknown; idempotencyKey?: string },
  ): Promise<unknown> {
    const url = `${this.studioUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.studioKey}`,
      Accept: "application/json",
    };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (opts.idempotencyKey) {
      headers["Idempotency-Key"] = opts.idempotencyKey;
    }

    const init: RequestInit = {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    };

    let lastError: unknown = null;
    for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
      try {
        const response = await fetch(url, init);

        if (response.ok) {
          return await response.json();
        }

        // Parse error body
        let errorBody: Record<string, unknown> = {};
        try {
          errorBody = (await response.json()) as Record<string, unknown>;
        } catch {
          /* non-JSON error */
        }

        // Non-retryable 4xx → throw immediately
        if (response.status === 401) {
          throw new GatewayError(
            "unauthorized",
            401,
            (errorBody.message as string) ??
              "Invalid STUDIO_API_KEY — check ~/.claude/.env",
          );
        }
        if (response.status === 402) {
          throw new GatewayError(
            "insufficient_credits",
            402,
            (errorBody.message as string) ?? "Insufficient Studio credits",
            {
              balance: errorBody.balance,
              needed: errorBody.needed,
            },
          );
        }
        if (response.status === 400) {
          throw new GatewayError(
            "invalid_request",
            400,
            (errorBody.message as string) ?? "Invalid request",
          );
        }
        if (response.status === 404) {
          throw new GatewayError(
            "invalid_request",
            404,
            (errorBody.message as string) ?? "Not found",
          );
        }
        if (response.status === 429) {
          // Retryable with backoff
          lastError = new GatewayError(
            "rate_limited",
            429,
            "Rate limited, retrying",
          );
        } else if (response.status >= 500) {
          lastError = new GatewayError(
            "server_error",
            response.status,
            (errorBody.message as string) ?? `Studio server error ${response.status}`,
          );
        } else {
          throw new GatewayError(
            "server_error",
            response.status,
            (errorBody.message as string) ?? `Unexpected status ${response.status}`,
          );
        }
      } catch (error) {
        if (error instanceof GatewayError && !isRetryable(error)) {
          throw error;
        }
        lastError = error;
      }

      // Backoff before next attempt
      if (attempt < FETCH_RETRIES - 1) {
        await sleep(FETCH_BACKOFF_MS[attempt] ?? 4000);
      }
    }

    if (lastError instanceof GatewayError) throw lastError;
    throw new GatewayError(
      "network_error",
      0,
      lastError instanceof Error ? lastError.message : "Network error",
    );
  }
}

function isRetryable(error: GatewayError): boolean {
  return (
    error.code === "rate_limited" ||
    error.code === "server_error" ||
    error.code === "network_error"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
