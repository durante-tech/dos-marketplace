#!/usr/bin/env bun

/**
 * Login — Facebook OAuth CLI for the social-media pack.
 *
 * Runs a local HTTP server on http://localhost:<port>/callback, opens the
 * Facebook OAuth dialog in the browser, captures the authorization code
 * from the callback, exchanges it for a long-lived user token, fetches
 * the list of Pages the user administers, prompts selection, and stores
 * the non-expiring Page access token in ~/.claude/.env (chmod 600).
 *
 * Before running: register http://localhost:8765/callback (or your chosen
 * --port) in your Meta app's Facebook Login → Settings → Valid OAuth
 * Redirect URIs. This is a one-time setup step per app.
 *
 * Usage:
 *   bun Login.ts --app-id <APP_ID> --app-secret <APP_SECRET>
 *   bun Login.ts --app-id <APP_ID> --app-secret <APP_SECRET> --port 9123
 *
 * @see https://developers.facebook.com/docs/facebook-login/guides/access-tokens/
 * @see https://developers.facebook.com/docs/pages/access-tokens/
 */

import { randomBytes } from "node:crypto";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { exec } from "node:child_process";
import {
  loadEnv,
  readExistingEnv,
  diffEnvKeys,
  writeMergedEnv,
} from "../../Lib/env.ts";
import { CLIError, handleError } from "../../Lib/cli.ts";
import {
  graph,
  buildAuthUrl,
  REQUIRED_SCOPES,
  GRAPH_VERSION,
} from "../../Lib/graph.ts";

// ============================================================================
// Types & Constants
// ============================================================================

interface CLIArgs {
  appId: string;
  appSecret: string;
  port: number;
  scopes: string[];
}

const DEFAULT_PORT = 8765;

/**
 * The only two scopes Meta enables on every app by default. Use this
 * subset with --scopes to verify the OAuth flow end-to-end before you
 * enable the other 11 via Use Cases in your app dashboard.
 */
const BOOTSTRAP_SCOPES = ["pages_show_list", "business_management"];

interface Page {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

function redirectUriFor(port: number): string {
  return `http://localhost:${port}/callback`;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
Login - Facebook OAuth CLI (Graph API ${GRAPH_VERSION})

Walks you through the Facebook OAuth flow and stores a long-lived,
non-expiring Page access token in ~/.claude/.env (chmod 600).

USAGE:
  bun Login.ts --app-id <APP_ID> --app-secret <APP_SECRET>

REQUIRED:
  --app-id <id>         Meta app ID from https://developers.facebook.com/apps/
  --app-secret <secret> Meta app secret (keep private)

OPTIONS:
  --port <n>            Local callback server port (default ${DEFAULT_PORT})
  --scopes <csv>        Override the requested scope list. Use --scopes bootstrap
                        to request only the two scopes Meta enables by default
                        (${BOOTSTRAP_SCOPES.join(", ")})
                        — useful for verifying OAuth end-to-end before adding
                        the remaining permissions to your app.
  --revoke              Revoke + log out: best-effort server-side deauthorization
                        (Graph DELETE /me/permissions with the stored Page token)
                        plus clearing the FACEBOOK_* credentials from ~/.claude/.env.
                        Standalone mode — ignores --app-id / --app-secret.
  --help, -h            Show this help message

PREREQUISITES:
  1. Your Meta app is in Development Mode (default for new apps)
  2. You are added as admin, developer, or tester in App Roles
  3. You administer at least one Facebook Page
  4. You have registered the callback URL in your app's Facebook Login settings:
     - Visit https://developers.facebook.com/apps/<APP_ID>/fb-login/settings/
     - Under "Valid OAuth Redirect URIs", add: http://localhost:${DEFAULT_PORT}/callback
     - Click "Save changes"
     - (If you use --port, register that port's URL instead)
  5. You have added the requested permissions to your app via Use Cases:
     - App Dashboard → Use cases → Customize
     - Enable "Manage a Facebook Page" → adds pages_* scopes
     - Enable "Manage Instagram on a Facebook Page" → adds instagram_* scopes
     - Enable "Read Facebook Ads data" → adds ads_read
     - Alternative (older path): App Review → Permissions and Features → Add to app
     - ⚠️ If Facebook shows "Invalid scopes", run with --scopes bootstrap first
       to confirm the flow works, then enable permissions and re-run.

OUTPUT (written to ~/.claude/.env):
  FACEBOOK_APP_ID
  FACEBOOK_PAGE_ID
  FACEBOOK_PAGE_TOKEN     Long-lived, non-expiring Page token
  FACEBOOK_IG_USER_ID     Instagram Business user ID (only if Page has linked IG)
  (FACEBOOK_APP_SECRET is no longer persisted — pass --app-secret each run.)

SCOPES REQUESTED (${REQUIRED_SCOPES.length}):
  ${REQUIRED_SCOPES.join(", ")}

In Development Mode, all 13 scopes are available on your own assets
without App Review.
`);
  process.exit(0);
}

// ============================================================================
// Argument Parsing
// ============================================================================

export function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
  }

  const parsed: Partial<CLIArgs> = {
    port: DEFAULT_PORT,
    scopes: REQUIRED_SCOPES,
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}. Flags must start with --`);
    }
    const key = flag.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }
    switch (key) {
      case "app-id":
        parsed.appId = value;
        i++;
        break;
      case "app-secret":
        parsed.appSecret = value;
        i++;
        break;
      case "port": {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n < 1 || n > 65535) {
          throw new CLIError(`Invalid --port: ${value} (must be 1-65535)`);
        }
        parsed.port = n;
        i++;
        break;
      }
      case "scopes": {
        if (value === "bootstrap") {
          parsed.scopes = BOOTSTRAP_SCOPES;
        } else {
          parsed.scopes = value.split(",").map((s) => s.trim()).filter(Boolean);
          if (parsed.scopes.length === 0) {
            throw new CLIError(`--scopes must be 'bootstrap' or a non-empty csv list`);
          }
        }
        i++;
        break;
      }
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  if (!parsed.appId) throw new CLIError("Missing required argument: --app-id");
  if (!parsed.appSecret) throw new CLIError("Missing required argument: --app-secret");
  return parsed as CLIArgs;
}

// ============================================================================
// OAuth Flow Helpers
// ============================================================================

function openInBrowser(url: string): void {
  const opener =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "start" :
    "xdg-open";
  // shell-safe: opener is a hardcoded platform literal (open/start/xdg-open); url is an internal OAuth URL
  exec(`${opener} "${url}"`, (err) => {
    if (err) {
      console.error(
        `\n⚠️  Could not open a browser automatically (${err.message}).`,
      );
      console.error(`Please visit this URL manually:\n${url}\n`);
    }
  });
}

interface CallbackResult {
  code: string;
}

/**
 * Pure CSRF guard: returns null when the callback's `state` parameter
 * matches the value we generated for this authorization request, or an
 * error message when it does not (missing or mismatched → possible CSRF).
 * Extracted from waitForCallback so the rejection path is unit-testable
 * without binding a port.
 */
export function validateCallbackState(
  receivedState: string | null,
  expectedState: string,
): string | null {
  if (receivedState !== expectedState) {
    return `OAuth state mismatch — possible CSRF, aborting. Expected ${expectedState}, got ${receivedState}`;
  }
  return null;
}

/**
 * Start a local HTTP server on `port` and wait for Facebook to redirect
 * back with ?code=... (or ?error=...). Validates that ?state matches the
 * provided expected value (CSRF guard), resolves with the code once
 * received, then shuts the server down.
 */
function waitForCallback(port: number, expectedState: string): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const server = Bun.serve({
      port,
      hostname: "127.0.0.1",
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/callback") {
          return new Response("Not found — waiting on /callback", { status: 404 });
        }

        const error =
          url.searchParams.get("error_description") ??
          url.searchParams.get("error");
        if (error) {
          const decoded = decodeURIComponent(error);
          setTimeout(() => {
            server.stop(true);
            reject(new CLIError(`OAuth denied: ${decoded}`));
          }, 50);
          return htmlResponse(
            "OAuth denied",
            `Facebook returned: <code>${escapeHtml(decoded)}</code>. You can close this tab.`,
            "#ef4444",
          );
        }

        const stateError = validateCallbackState(
          url.searchParams.get("state"),
          expectedState,
        );
        if (stateError) {
          setTimeout(() => {
            server.stop(true);
            reject(new CLIError(stateError));
          }, 50);
          return htmlResponse(
            "State mismatch",
            "The <code>state</code> parameter did not match. This may indicate a CSRF attempt; aborting.",
            "#ef4444",
          );
        }

        const code = url.searchParams.get("code");
        if (!code) {
          return htmlResponse(
            "Missing code",
            "No <code>?code=</code> parameter in callback. Check your OAuth app configuration.",
            "#ef4444",
          );
        }

        setTimeout(() => {
          server.stop(true);
          resolve({ code });
        }, 50);
        return htmlResponse(
          "Authentication complete",
          "You can close this tab and return to your terminal.",
          "#10b981",
        );
      },
      error() {
        return new Response("Internal error", { status: 500 });
      },
    });
  });
}

function htmlResponse(title: string, body: string, accent: string): Response {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)} — DOS SocialMedia</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { max-width: 480px; padding: 48px; background: #1e293b; border-radius: 12px; border-left: 4px solid ${accent}; text-align: center; }
  h1 { color: ${accent}; margin: 0 0 16px; font-size: 24px; }
  p { line-height: 1.6; color: #cbd5e1; }
  code { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
</style></head>
<body><div class="card"><h1>${escapeHtml(title)}</h1><p>${body}</p></div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === '"' ? "&quot;" : "&#39;",
  );
}

async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string,
): Promise<TokenResponse> {
  return graph<TokenResponse>("/oauth/access_token", {
    method: "GET",
    token: "",
    params: {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    },
  });
}

async function exchangeForLongLivedUserToken(
  shortToken: string,
  appId: string,
  appSecret: string,
): Promise<TokenResponse> {
  return graph<TokenResponse>("/oauth/access_token", {
    method: "GET",
    token: "",
    params: {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    },
  });
}

async function fetchPages(userToken: string): Promise<Page[]> {
  const response = await graph<{ data: Page[] }>("/me/accounts", {
    method: "GET",
    token: userToken,
    params: { fields: "id,name,access_token,instagram_business_account" },
  });
  return response.data ?? [];
}

async function selectPage(rl: Interface, pages: Page[]): Promise<Page> {
  if (pages.length === 0) {
    throw new CLIError(
      [
        "No Pages returned by /me/accounts. Common causes:",
        "  1. You do not administer any Facebook Page — create or claim one in Facebook Business Suite.",
        "  2. The 'pages_show_list' scope was not granted — re-run Login.ts and approve all requested permissions.",
        "  3. Your user account is not an admin of the Page — check App Roles and Page Roles.",
        "  4. The app is not in Development Mode with you listed as admin/developer/tester.",
      ].join("\n"),
    );
  }
  if (pages.length === 1) {
    const only = pages[0]!;
    console.log(`\n→ One Page found: ${only.name} (${only.id})`);
    return only;
  }
  console.log("\nPages you administer:\n");
  pages.forEach((p, i) => {
    const ig = p.instagram_business_account ? " [IG linked]" : "";
    console.log(`  ${i + 1}. ${p.name} (${p.id})${ig}`);
  });
  const answer = (await rl.question(`\nSelect a Page [1-${pages.length}]: `)).trim();
  const idx = parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= pages.length) {
    throw new CLIError(`Invalid selection: ${answer}`);
  }
  return pages[idx]!;
}

async function saveCredentials(
  updates: Record<string, string>,
  rl: Interface,
): Promise<string> {
  const existing = await readExistingEnv();
  const conflicts = diffEnvKeys(existing, updates);
  if (conflicts.length > 0) {
    console.log(
      `\n⚠️  The following keys already exist in ~/.claude/.env with different values:`,
    );
    for (const key of conflicts) console.log(`   - ${key}`);
    const answer = (await rl.question(`\nOverwrite? [y/N]: `)).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      throw new CLIError("Aborted — existing values preserved.");
    }
  }
  return writeMergedEnv({ ...existing, ...updates });
}

// ============================================================================
// Revoke
// ============================================================================

/**
 * `--revoke` — deauthorize the app and strip stored Facebook credentials.
 *
 * Best-effort server-side revoke: DELETE /me/permissions with the stored Page token.
 * With only a Page token persisted we cannot guarantee a full app-level revoke (that
 * needs the user token), so a failure here is surfaced but never blocks the guaranteed
 * local credential clear below — the inverse of the Login flow (solo:8 / #143 F6).
 */
async function revokeCredentials(): Promise<void> {
  const existing = await readExistingEnv();
  const token = existing.FACEBOOK_PAGE_TOKEN;
  if (!token) {
    throw new CLIError(
      "No FACEBOOK_PAGE_TOKEN in ~/.claude/.env — nothing to revoke. Run Login.ts first.",
    );
  }
  try {
    console.log("🔄 Revoking app permissions (Graph DELETE /me/permissions)...");
    await graph("/me/permissions", { method: "DELETE", token });
    console.log("✅ Server-side app permissions revoked.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`⚠️  Server-side revoke did not complete (${msg}).`);
    console.error(
      "   Finish revoking at facebook.com → Settings → Business Integrations.",
    );
  }
  const FB_KEYS = [
    "FACEBOOK_APP_ID",
    "FACEBOOK_APP_SECRET",
    "FACEBOOK_PAGE_ID",
    "FACEBOOK_PAGE_TOKEN",
    "FACEBOOK_IG_USER_ID",
  ];
  const remaining = Object.fromEntries(
    Object.entries(existing).filter(([k]) => !FB_KEYS.includes(k)),
  );
  const savedPath = await writeMergedEnv(remaining);
  console.log(`✅ Facebook credentials cleared from ${savedPath}`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    if (process.argv.includes("--revoke")) {
      await revokeCredentials();
      return;
    }
    const args = parseArgs(process.argv);
    const redirectUri = redirectUriFor(args.port);
    const state = randomBytes(16).toString("hex");

    const rl = createInterface({ input, output });
    try {
      const authUrl = buildAuthUrl({
        appId: args.appId,
        redirectUri,
        scopes: args.scopes,
        state,
      });

      console.log(`\n📍 Redirect URI: ${redirectUri}`);
      console.log(
        `   Make sure this is registered under Facebook Login → Settings → Valid OAuth Redirect URIs`,
      );
      console.log(`   in your Meta app dashboard before continuing.`);
      console.log(`\n🔑 Requesting ${args.scopes.length} scope(s): ${args.scopes.join(", ")}`);
      if (args.scopes === BOOTSTRAP_SCOPES) {
        console.log(
          `   ⚠️  Bootstrap mode — only pages_show_list and business_management will be requested.`,
        );
        console.log(
          `   After a successful bootstrap login, enable the remaining scopes via Use Cases in`,
        );
        console.log(`   your app dashboard, then re-run without --scopes.\n`);
      } else {
        console.log(
          `   If Facebook shows "Invalid scopes", re-run with --scopes bootstrap to verify the`,
        );
        console.log(
          `   flow works, then enable the missing permissions in your app's Use Cases.\n`,
        );
      }
      console.log(`🌐 Starting local callback server on port ${args.port}...`);
      const callbackPromise = waitForCallback(args.port, state);

      console.log(`🔐 Opening Facebook OAuth dialog in your browser...`);
      console.log(`\nIf the browser does not open, visit this URL manually:\n${authUrl}\n`);
      openInBrowser(authUrl);

      console.log(`⏳ Waiting for callback on ${redirectUri} ...`);
      const { code } = await callbackPromise;
      console.log(`✅ Authorization code received\n`);

      console.log(`🔄 Exchanging code for short-lived user token...`);
      const shortToken = await exchangeCodeForToken(
        code,
        args.appId,
        args.appSecret,
        redirectUri,
      );
      console.log(`✅ Short-lived user token obtained\n`);

      // Step 3: Exchange for long-lived user token (60 days).
      console.log(`🔄 Exchanging for long-lived user token (60 days)...`);
      const longToken = await exchangeForLongLivedUserToken(
        shortToken.access_token,
        args.appId,
        args.appSecret,
      );
      console.log(`✅ Long-lived user token obtained\n`);

      // Step 4: Fetch Pages, prompt selection.
      console.log(`🔄 Fetching Pages you administer...`);
      const pages = await fetchPages(longToken.access_token);
      const page = await selectPage(rl, pages);
      console.log(`✅ Selected: ${page.name} (${page.id})`);

      // Step 5: Merge credentials into ~/.claude/.env with overwrite guard.
      const updates: Record<string, string> = {
        FACEBOOK_APP_ID: args.appId,
        // FACEBOOK_APP_SECRET is intentionally NOT persisted: Login always requires
        // --app-secret on the CLI, so a stored copy is never read back — keeping a
        // long-lived app secret on disk is a credential-hardening liability, not a
        // convenience (solo:8 / #143 F6).
        FACEBOOK_PAGE_ID: page.id,
        FACEBOOK_PAGE_TOKEN: page.access_token,
      };
      if (page.instagram_business_account) {
        updates.FACEBOOK_IG_USER_ID = page.instagram_business_account.id;
      }
      const savedPath = await saveCredentials(updates, rl);

      // Summary.
      console.log(`\n✅ Credentials written to ${savedPath} (chmod 600)`);
      console.log(`\nPage:         ${page.name}`);
      console.log(`Page ID:      ${page.id}`);
      console.log(
        `Token type:   long-lived Page token (non-expiring while your admin role persists)`,
      );
      if (page.instagram_business_account) {
        console.log(`IG Business:  ${page.instagram_business_account.id} (linked)`);
      } else {
        console.log(`IG Business:  not linked to this Page`);
      }
      console.log(`\nNext steps:`);
      console.log(`  bun Publish.ts --message "hello world"`);
      console.log(`  bun Fetch.ts --type insights`);
    } finally {
      rl.close();
    }
  } catch (error) {
    handleError(error);
  }
}

if (import.meta.main) {
  main();
}
