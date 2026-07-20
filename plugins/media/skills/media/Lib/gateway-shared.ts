/**
 * Gateway Shared Utilities — extracted from 4 identical copies across
 * elevenlabs-gateway.ts, openai-image-gateway.ts, gemini-image-gateway.ts,
 * and removebg-gateway.ts.
 *
 * This file has ZERO external imports beyond ./env.ts — it cannot
 * transitively pull in any provider SDK. That was the original reason
 * for duplicating GatewayError across shims (see lesson #3 in
 * feedback_gateway_architecture.md). A shared file with no SDK imports
 * resolves the duplication without reintroducing the transitive dep.
 */

// ──────────────────────────────────────────────────────────────────────
// GatewayError
// ──────────────────────────────────────────────────────────────────────

export type GatewayErrorCode =
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

// ──────────────────────────────────────────────────────────────────────
// Studio error mapping
// ──────────────────────────────────────────────────────────────────────

/**
 * Parse a Studio error response body defensively. response.json() can
 * resolve to null on some error paths, so we read as text first.
 */
export function parseStudioErrorBody(errText: string): Record<string, unknown> {
  let errBody: Record<string, unknown> = {};
  if (errText) {
    try {
      const parsed = JSON.parse(errText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        errBody = parsed as Record<string, unknown>;
      }
    } catch { /* non-JSON */ }
  }
  if (!errBody.message && errText) {
    errBody.message = errText;
  }
  return errBody;
}

/**
 * Map a Studio HTTP error status + body into a typed GatewayError.
 */
export function mapStudioError(
  status: number,
  body: Record<string, unknown>,
): GatewayError {
  const message = (body.message as string) ?? `Studio gateway error ${status}`;
  if (status === 401) return new GatewayError("unauthorized", 401, message);
  if (status === 402) return new GatewayError("insufficient_credits", 402, message, { needed: body.needed, balance: body.balance });
  if (status === 400) return new GatewayError("invalid_request", 400, message);
  if (status === 429) return new GatewayError("rate_limited", 429, message);
  if (status === 503) return new GatewayError("server_error", 503, message);
  if (status >= 500) return new GatewayError("server_error", status, message);
  return new GatewayError("provider_failure", status, message);
}

// ──────────────────────────────────────────────────────────────────────
// URL resolution
// ──────────────────────────────────────────────────────────────────────

/**
 * Dev storage can return relative paths (e.g. `/storage.dev/...`);
 * resolve them against the Studio origin.
 */
export function resolveAgainstOrigin(rawUrl: string, origin: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
  const cleanOrigin = origin.replace(/\/+$/, "");
  const cleanPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${cleanOrigin}${cleanPath}`;
}

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

/**
 * Download a gateway output URL. The create/poll round-trips authenticate with
 * the bearer token, but the output URL is a SEPARATE fetch. When Studio returns
 * a same-origin storage path (resolved against the Studio origin), that route
 * requires the SAME bearer — so attach it. Third-party presigned/CDN URLs (a
 * different origin) are left unauthenticated so their own signatures stay valid.
 */
export async function fetchStudioOutput(
  absoluteUrl: string,
  studioOrigin: string,
  studioKey: string,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (isSameOrigin(absoluteUrl, studioOrigin)) {
    headers.Authorization = `Bearer ${studioKey}`;
  }
  return fetch(absoluteUrl, { headers });
}
