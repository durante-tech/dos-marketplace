/**
 * LinkedIn REST API client — shared HTTP layer for LinkedIn tools.
 *
 * Pins the social-media pack to LinkedIn-Version 202511 (latest 2025 GA).
 * To bump the version, change LINKEDIN_VERSION below. Versions rotate
 * annually — LinkedIn sunsets each monthly version ~12 months after release.
 * See: https://learn.microsoft.com/en-us/linkedin/marketing/versioning
 */

import { CLIError } from "./cli.ts";

export const LINKEDIN_VERSION = "202511";
export const LINKEDIN_API_BASE = "https://api.linkedin.com";
export const LINKEDIN_OAUTH_BASE = "https://www.linkedin.com/oauth/v2";
export const LINKEDIN_RESTLI_PROTOCOL = "2.0.0";

/**
 * The four scopes required for personal member publishing.
 * - openid, profile, email → "Sign In with LinkedIn using OpenID Connect" product
 * - w_member_social         → "Share on LinkedIn" product
 * Both products are self-serve in the LinkedIn Developer Portal.
 */
export const LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
];

export interface LinkedInErrorBody {
  message?: string;
  status?: number;
  code?: string;
  serviceErrorCode?: number;
}

/**
 * Typed LinkedIn REST API failure. Inherits CLIError so handleError() prints
 * and exits with the right code. `isAuthError` identifies token expiry, scope
 * denial, or ACCESS_DENIED — situations that require the user to re-run Login.
 */
export class LinkedInAPIError extends CLIError {
  constructor(
    public linkedinError: LinkedInErrorBody,
    public httpStatus: number,
    public path: string,
  ) {
    const code = linkedinError.code ?? "";
    const svc = linkedinError.serviceErrorCode ? `/svc:${linkedinError.serviceErrorCode}` : "";
    super(
      `LinkedIn REST ${path} failed (HTTP ${httpStatus}${code ? ` ${code}` : ""}${svc}): ${linkedinError.message ?? "unknown error"}`,
      1,
    );
    this.name = "LinkedInAPIError";
  }

  /** Token missing/expired, scope denied, or ACCESS_DENIED — re-run Login.ts. */
  get isAuthError(): boolean {
    if (this.httpStatus === 401) return true;
    if (this.httpStatus === 403) return true;
    return false;
  }

  /** LinkedIn-Version header rejected — upgrade LINKEDIN_VERSION constant. */
  get isVersionError(): boolean {
    return this.httpStatus === 426;
  }
}

export interface LinkedInFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Bearer token. Pass "" to skip the Authorization header. */
  token: string;
  /** Parsed JSON body to send. Sets Content-Type: application/json. */
  body?: unknown;
  /** Query-string params. */
  params?: Record<string, string | number | boolean | undefined>;
  /** Extra headers to merge (overrides defaults). */
  headers?: Record<string, string>;
}

export interface LinkedInFetchResult<T> {
  body: T;
  /**
   * Value of the `x-restli-id` response header when present. LinkedIn returns
   * newly-created resource URNs here rather than in the body (e.g., post URN
   * after POST /rest/posts, image URN after PUT to DMS upload URL).
   */
  restliId?: string;
  /** HTTP status code. */
  status: number;
}

/**
 * Execute a single LinkedIn REST API request with all required versioned
 * headers auto-injected. Returns parsed JSON (or empty object on 204/empty
 * body) plus the x-restli-id header when present.
 *
 * Throws LinkedInAPIError on non-2xx responses.
 *
 * Use for:
 *  - POST /rest/posts        (creates a post)
 *  - POST /rest/images?action=initializeUpload
 *  - POST /rest/videos?action=initializeUpload
 *  - GET  /v2/userinfo       (LinkedIn-Version header is ignored on /v2/)
 *
 * Do NOT use for the binary PUT to DMS upload URLs — those are presigned
 * and must not carry Authorization or LinkedIn-Version headers. Use the
 * `putToUploadUrl` helper for that step.
 */
export async function linkedinFetch<T = unknown>(
  path: string,
  options: LinkedInFetchOptions,
): Promise<LinkedInFetchResult<T>> {
  const method = options.method ?? "GET";
  const base = path.startsWith("http") ? path : `${LINKEDIN_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const url = new URL(base);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": LINKEDIN_RESTLI_PROTOCOL,
  };
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.headers) Object.assign(headers, options.headers);

  const init: RequestInit = { method, headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);

  const response = await fetch(url.toString(), init);
  const text = await response.text();
  const restliId = response.headers.get("x-restli-id") ?? undefined;

  let json: unknown = {};
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new CLIError(
          `LinkedIn REST ${path} returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`,
        );
      }
      json = {};
    }
  }

  if (!response.ok) {
    const errBody = (json as LinkedInErrorBody) ?? {};
    throw new LinkedInAPIError(errBody, response.status, path);
  }

  return { body: json as T, restliId, status: response.status };
}

/**
 * PUT raw bytes to a LinkedIn DMS upload URL. Used as step 2 of the
 * /rest/images initializeUpload flow. The upload URL is presigned, so we
 * must NOT send LinkedIn-Version or X-Restli-Protocol-Version headers.
 * Authorization with the member bearer token IS required.
 */
export async function putToUploadUrl(
  uploadUrl: string,
  bytes: ArrayBuffer,
  token: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: bytes,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new CLIError(
      `LinkedIn DMS upload failed (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }
}

/**
 * Build the LinkedIn OAuth 2.0 authorization URL.
 */
export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const url = new URL(`${LINKEDIN_OAUTH_BASE}/authorization`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", params.scopes.join(" "));
  return url.toString();
}
