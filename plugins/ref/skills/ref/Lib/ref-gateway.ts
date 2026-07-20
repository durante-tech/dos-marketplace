/**
 * Ref Gateway Client — DOS Pack side
 *
 * Thin client that routes all traffic through Studio's gateway:
 *   POST {STUDIO_API_URL}/api/v1/inference/ref/search
 *   POST {STUDIO_API_URL}/api/v1/inference/ref/read
 *
 * NO BYOK IN THE PACK — this client never reads a REF_API_KEY; it authenticates
 * only with STUDIO_API_URL + STUDIO_API_KEY (via requireStudioEnv). Studio's pool key
 * (STUDIO_POOL_REF_API_KEY) is server-side only, so all calls are credit-metered through
 * Studio's double-entry ledger. (A separate, operator-only fallback CLI does exist and is
 * BYOK — it reads REF_API_KEY — but it is NOT part of this pack and is never this client's
 * path; see the gateway-down handling below for how customers degrade gracefully without it.)
 *
 * Mirrors the Studio route's request surface 1:1 — additions to the
 * passthrough field set need to be mirrored in both places. See
 * Platform/studio/apps/web/lib/gateway/ref-worker.ts for the
 * canonical type definitions; the client redeclares them here so the
 * Pack stays standalone without importing Studio types.
 */

import { requireStudioEnv } from "./env.ts";

// ──────────────────────────────────────────────────────────────────────
// Request / response types
// ──────────────────────────────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  refSrc?: "public" | "private" | "all";
}

export interface SearchResultEntry {
  url: string;
  overview?: string;
  moduleId?: string;
}

export interface SearchSuccess {
  generationId: string;
  status: "succeeded";
  results: SearchResultEntry[];
  totalResults: number;
  chargedCredits: number;
  actualCostCents: number;
  cacheHit: boolean;
}

export interface ReadRequest {
  url: string;
}

export interface ReadSuccess {
  generationId: string;
  status: "succeeded";
  content: string;
  url: string;
  chargedCredits: number;
  actualCostCents: number;
  cacheHit: boolean;
}

// ──────────────────────────────────────────────────────────────────────
// Error
// ──────────────────────────────────────────────────────────────────────

export class RefGatewayError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    public readonly body: unknown = null,
  ) {
    super(message);
    this.name = "RefGatewayError";
  }
}

// ──────────────────────────────────────────────────────────────────────
// Call options
// ──────────────────────────────────────────────────────────────────────

export interface CallOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function postGateway<TReq, TRes>(
  path: string,
  body: TReq,
  options: CallOptions,
): Promise<TRes> {
  const { apiUrl, apiKey } = requireStudioEnv();
  const url = `${apiUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new RefGatewayError(
      503,
      "network_error",
      `Network error contacting Studio gateway: ${message}`,
    );
  }

  const rawText = await response.text();
  let parsed: unknown = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = rawText;
  }

  if (!response.ok) {
    const errorCode =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error?: unknown }).error ?? "http_error")
        : "http_error";
    const message =
      (parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as { message?: unknown }).message ?? response.statusText)
        : response.statusText) || `HTTP ${response.status}`;

    if (response.status === 401) {
      throw new RefGatewayError(
        401,
        "unauthorized",
        `${message} — verify Studio credentials in ~/.claude/.gateway.env`,
        parsed,
      );
    }
    if (response.status === 404) {
      throw new RefGatewayError(
        404,
        "route_not_found",
        `${message} — Ref gateway route not found. Verify STUDIO_API_URL in ~/.claude/.gateway.env points at a Studio that exposes /api/v1/inference/ref, or contact your operator. (Operators running the full Durante repo have an operator-only BYOK fallback at bun ~/Durante/Tools/ref.ts — this is NOT shipped with the pack, so it is unavailable on a standalone install.)`,
        parsed,
      );
    }
    throw new RefGatewayError(response.status, errorCode, message, parsed);
  }

  return parsed as TRes;
}

// ──────────────────────────────────────────────────────────────────────
// Search
// ──────────────────────────────────────────────────────────────────────

export async function searchDocumentation(
  request: SearchRequest,
  options: CallOptions = {},
): Promise<SearchSuccess> {
  return postGateway<SearchRequest, SearchSuccess>(
    "/api/v1/inference/ref/search",
    request,
    options,
  );
}

// ──────────────────────────────────────────────────────────────────────
// Read
// ──────────────────────────────────────────────────────────────────────

export async function readUrl(
  request: ReadRequest,
  options: CallOptions = {},
): Promise<ReadSuccess> {
  return postGateway<ReadRequest, ReadSuccess>(
    "/api/v1/inference/ref/read",
    request,
    options,
  );
}
