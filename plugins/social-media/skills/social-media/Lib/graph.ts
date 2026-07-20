/**
 * Meta Graph API client — shared HTTP layer for Facebook and Instagram tools.
 *
 * Pins the social-media pack to Graph API v24.0. To bump the version, change
 * GRAPH_VERSION below. See changelog:
 * https://developers.facebook.com/docs/graph-api/changelog/versions/
 */

import { CLIError } from "./cli.ts";

export const GRAPH_VERSION = "v24.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const FACEBOOK_OAUTH_BASE = `https://www.facebook.com/${GRAPH_VERSION}`;

/**
 * The 13 scopes required by the social-media pack for Facebook Pages +
 * Instagram Business. Requested once during Login.ts OAuth flow.
 */
export const REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "pages_manage_metadata",
  "pages_read_user_content",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "read_insights",
  "ads_read",
];

export interface GraphError {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

/**
 * Typed Graph API failure. Inherits CLIError so handleError() prints and
 * exits with the right code. `isAuthError` identifies token expiry / revoke.
 */
export class GraphAPIError extends CLIError {
  constructor(
    public graphError: GraphError,
    public httpStatus: number,
    public path: string,
  ) {
    const code = graphError.code ?? 0;
    const subcode = graphError.error_subcode ? `/${graphError.error_subcode}` : "";
    super(
      `Graph API ${GRAPH_VERSION} ${path} failed (HTTP ${httpStatus}, code ${code}${subcode}): ${graphError.message}`,
      1,
    );
    this.name = "GraphAPIError";
  }

  /** Token invalid, expired, or revoked — user must re-run Login.ts. */
  get isAuthError(): boolean {
    return this.graphError.code === 190 || this.graphError.code === 102;
  }
}

type ParamValue = string | number | boolean | undefined | null;

export interface GraphRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  /** Pass "" to skip the access_token parameter entirely (used by OAuth exchanges). */
  token: string;
  params?: Record<string, ParamValue>;
  /** If set, overrides form-encoded params with a JSON body (POST only). */
  body?: Record<string, unknown>;
}

export interface GraphListResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
    previous?: string;
  };
}

/**
 * Execute a single Graph API request. Returns parsed JSON.
 * Throws GraphAPIError on non-2xx responses or when the body contains `error`.
 */
export async function graph<T = unknown>(
  path: string,
  options: GraphRequestOptions,
): Promise<T> {
  const method = options.method ?? "GET";
  const init: RequestInit = { method };
  let url: string;

  if (method === "GET") {
    const params: Record<string, ParamValue> = { ...(options.params ?? {}) };
    if (options.token) params.access_token = options.token;
    url = buildUrl(path, params);
  } else {
    if (options.body) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(options.body);
      const tokenParams: Record<string, ParamValue> = {};
      if (options.token) tokenParams.access_token = options.token;
      url = buildUrl(path, tokenParams);
    } else {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(options.params ?? {})) {
        if (v === undefined || v === null) continue;
        form.set(k, String(v));
      }
      if (options.token) form.set("access_token", options.token);
      init.headers = { "Content-Type": "application/x-www-form-urlencoded" };
      init.body = form.toString();
      url = buildUrl(path, {});
    }
  }

  return rawFetch<T>(url, init, path);
}

/**
 * Paginate through a cursor-based list endpoint, capped at maxPages
 * (default 10). Subsequent pages use the signed `next` URL verbatim so
 * the access_token embedded by Meta is preserved.
 */
export async function* graphPaginate<T = unknown>(
  path: string,
  options: GraphRequestOptions & { maxPages?: number },
): AsyncGenerator<T, void, unknown> {
  const maxPages = options.maxPages ?? 10;
  let page: GraphListResponse<T> = await graph<GraphListResponse<T>>(path, {
    method: "GET",
    token: options.token,
    params: options.params,
  });

  let pageCount = 1;
  while (true) {
    if (page.data) {
      for (const item of page.data) yield item;
    }
    if (pageCount >= maxPages || !page.paging?.next) return;
    page = await rawFetch<GraphListResponse<T>>(
      page.paging.next,
      { method: "GET" },
      path,
    );
    pageCount++;
  }
}

/** Build the Facebook OAuth authorization dialog URL. */
export function buildAuthUrl(params: {
  appId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
}): string {
  const url = new URL(`${FACEBOOK_OAUTH_BASE}/dialog/oauth`);
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes.join(","));
  url.searchParams.set("response_type", "code");
  if (params.state) url.searchParams.set("state", params.state);
  return url.toString();
}

function buildUrl(path: string, params: Record<string, ParamValue>): string {
  const base = path.startsWith("http")
    ? path
    : `${GRAPH_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function rawFetch<T>(
  url: string,
  init: RequestInit,
  path: string,
): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CLIError(
      `Graph API ${GRAPH_VERSION} ${path} returned non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }

  const maybeError = (json as { error?: GraphError }).error;
  if (!response.ok || maybeError) {
    const errObj = maybeError ?? { message: `HTTP ${response.status}` };
    throw new GraphAPIError(errObj, response.status, path);
  }

  return json as T;
}
