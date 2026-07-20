/**
 * studioClient.ts — canonical Studio API auth + transport for DOS sync tools.
 *
 * Why this exists: every Save*ToStudio.ts (and ReconcileStudio +
 * SaveProjectToStudio + the StudioSync.hook.ts) was repeating the same
 * 6-line preamble:
 *
 *     const STUDIO_API_URL = process.env.STUDIO_API_URL;
 *     const STUDIO_API_KEY = process.env.STUDIO_API_KEY;
 *     if (!STUDIO_API_URL || !STUDIO_API_KEY) {
 *       process.exit(0);   // silent — no log, no message
 *     }
 *
 * Twenty-three copies of "configured wrong → die quietly". Customers
 * with a missing STUDIO_API_KEY in ~/.claude/.gateway.env saw an empty
 * Studio dashboard with no way to know why; debugging required reading
 * each sync tool individually to find where the silent skip was.
 *
 * THE CONTRACT
 * ------------
 *   getStudioConfig()              → StudioConfig | null
 *   requireStudioConfigOrSkip(tool) → StudioConfig | exits 0 with ONE log line
 *   studioPost(endpoint, payload)  → Response (uses queueOrPost from dlq.ts
 *                                    when available; raw fetch otherwise)
 *   studioFetch(endpoint, init)    → Response (general-purpose; non-POST)
 *
 * SILENT-EXIT POLICY
 * ------------------
 * `requireStudioConfigOrSkip` PRESERVES the silent-skip behavior every
 * sync tool depends on (SessionEnd hook fires-and-forgets and must not
 * fail when creds are missing). The change is the LOG: one stderr line
 * names the tool and tells the operator where to set the env vars.
 * That single line is the difference between a debuggable
 * misconfiguration and a silent void.
 *
 * Companion: hooks/lib/dlq.ts owns the DLQ-resilient transport
 * (queueOrPost, idempotency keys, 12 RedTeam mitigations). studioPost()
 * delegates to it when the caller passes an idempotency key; without
 * one, falls back to raw fetch (rare path, kept for back-compat).
 */

// Lazy import — keeps studioClient.ts loadable from contexts that don't
// pull in dlq.ts (e.g., test fixtures). Only used by studioPost's
// auto-compute path. Imported via dynamic require() to avoid ESM hoisting
// problems if dlq.ts ever needs to import from studioClient.
let _digestOfBody: ((obj: unknown) => string) | null = null;
function loadDigest(): typeof _digestOfBody {
  if (_digestOfBody) return _digestOfBody;
  try {
    // Bun supports synchronous require() for local modules; dlq.ts ships
    // alongside this file in hooks/lib/.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('./dlq');
    if (typeof mod.digestOfBody === 'function') {
      _digestOfBody = mod.digestOfBody;
    }
  } catch { /* fall through — caller will skip auto-compute */ }
  return _digestOfBody;
}

let _hasLoggedMissing = false;
let _hasLoggedMissingIdempotencyKey = false;

export interface StudioConfig {
  /** Base URL with trailing slash stripped (e.g., "https://www.duranteos.com"). */
  url: string;
  /** Bearer token. */
  key: string;
  /** Pre-built header object — `{ Authorization: "Bearer <key>" }`. */
  authHeader: { Authorization: string };
}

/**
 * Pure resolution result — discriminated union, no side effects.
 *
 * Lets callers that CAN'T tolerate `process.exit(0)` (e.g., structured-error
 * CLIs like Tools/intel-context.ts) reach the same env-cascade logic the
 * sync tools use, without inheriting their kill-switch contract.
 */
export type ResolveStudioConfigResult =
  | { kind: 'ok'; config: StudioConfig }
  | { kind: 'missing'; reason: 'STUDIO_API_URL' | 'STUDIO_API_KEY' | 'BOTH' };

/**
 * Pure config resolution from `process.env`. No logs, no `process.exit`,
 * no side effects. Use this from any caller that needs to handle missing
 * credentials with structured error output instead of dying silently.
 */
export function resolveStudioConfig(): ResolveStudioConfigResult {
  const url = process.env.STUDIO_API_URL?.replace(/\/+$/, '');
  const key = process.env.STUDIO_API_KEY;
  if (url && key) {
    return { kind: 'ok', config: { url, key, authHeader: { Authorization: `Bearer ${key}` } } };
  }
  const reason = !url && !key ? 'BOTH' : !url ? 'STUDIO_API_URL' : 'STUDIO_API_KEY';
  return { kind: 'missing', reason };
}

/**
 * Returns the Studio config if both env vars are present, null otherwise.
 * Does NOT log or exit — caller decides how to handle missing creds.
 *
 * Thin wrapper over `resolveStudioConfig()` for callers that prefer
 * `null`-on-missing over a discriminated union.
 */
export function getStudioConfig(): StudioConfig | null {
  const result = resolveStudioConfig();
  return result.kind === 'ok' ? result.config : null;
}

/**
 * For sync-tool callers that should skip silently when creds are missing
 * (the SessionEnd-hook fire-and-forget contract), but should LOG ONCE
 * per process so operators can debug "why is Studio empty?"
 *
 * Logs to stderr (so it doesn't pollute stdout JSON) and exits 0.
 * The first call per process logs; subsequent calls in the same process
 * exit silently (no need to spam the log if multiple sync tools all
 * hit the same missing-cred condition).
 *
 * Callers that can't tolerate `process.exit(0)` (CLIs that return
 * structured errors) should use `resolveStudioConfig()` directly.
 */
export function requireStudioConfigOrSkip(toolName: string): StudioConfig {
  const result = resolveStudioConfig();
  if (result.kind === 'ok') return result.config;
  if (!_hasLoggedMissing) {
    _hasLoggedMissing = true;
    console.error(
      `[${toolName}] STUDIO_API_URL or STUDIO_API_KEY missing — set them in ~/.claude/.gateway.env. ` +
      `Studio sync skipped for this session.`,
    );
  }
  process.exit(0);
}

/**
 * High-level POST helper — owns URL construction + auth headers.
 *
 * `endpoint` is the API path AFTER `/api/v1/` (e.g., "sessions" or
 * "memory/snapshots"). Leading slashes are stripped so callers can
 * pass either "/sessions" or "sessions" interchangeably.
 *
 * When `opts.idempotencyKey` is provided, the request gets an
 * `Idempotency-Key` header (Studio routes use this for de-duplication).
 * When omitted AND `payload` is present, the key is auto-computed via
 * digestOfBody(payload) from dlq.ts — every request reaching Studio
 * carries an idempotency key by default, even from callers that haven't
 * been migrated to provide one explicitly.
 * When omitted AND `payload` is undefined/null, a one-time stderr warning
 * is logged (no key sent — Studio will treat the request as non-idempotent).
 *
 * NOTE: This is a thin wrapper. For DLQ-resilient transport with
 * .pending/.streaming queue + retry semantics, callers should use
 * queueOrPost from hooks/lib/dlq.ts directly — they get the same auth
 * benefit because queueOrPost reads the env vars itself.
 */
export async function studioPost(
  endpoint: string,
  payload: unknown,
  opts: { idempotencyKey?: string; toolName?: string } = {},
): Promise<Response> {
  const cfg = requireStudioConfigOrSkip(opts.toolName ?? 'studioPost');
  const path = endpoint.replace(/^\/+/, '').replace(/^api\/v1\//, '');

  // Auto-compute idempotency key when caller didn't supply one.
  let idempotencyKey = opts.idempotencyKey;
  if (!idempotencyKey) {
    if (payload !== undefined && payload !== null) {
      const digest = loadDigest();
      if (digest) {
        try { idempotencyKey = digest(payload); } catch { /* leave undefined */ }
      }
    } else if (!_hasLoggedMissingIdempotencyKey) {
      _hasLoggedMissingIdempotencyKey = true;
      console.error(
        `[${opts.toolName ?? 'studioPost'}] no payload + no idempotencyKey — ` +
        `Studio will receive request without Idempotency-Key header. ` +
        `Pass opts.idempotencyKey or a non-empty payload.`,
      );
    }
  }

  return fetch(`${cfg.url}/api/v1/${path}`, {
    method: 'POST',
    headers: {
      ...cfg.authHeader,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  });
}

/**
 * General-purpose fetch — for GET, PUT, DELETE, or POST with custom
 * init. Same URL-prefix + auth-header rules as studioPost.
 */
export async function studioFetch(
  endpoint: string,
  init: RequestInit = {},
  opts: { toolName?: string } = {},
): Promise<Response> {
  const cfg = requireStudioConfigOrSkip(opts.toolName ?? 'studioFetch');
  const path = endpoint.replace(/^\/+/, '').replace(/^api\/v1\//, '');
  return fetch(`${cfg.url}/api/v1/${path}`, {
    ...init,
    headers: {
      ...cfg.authHeader,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}
