#!/usr/bin/env bun

/**
 * Login — LinkedIn OAuth CLI for the social-media pack.
 *
 * Runs a local HTTP server on http://localhost:<port>/callback, opens the
 * LinkedIn authorization URL in the browser, captures the authorization
 * code, exchanges it for an access token, calls /v2/userinfo to resolve
 * the authenticated member's Person URN, and stores credentials in
 * ~/.claude/.env (chmod 600).
 *
 * Prerequisites (user must do this once per LinkedIn app):
 *   1. Create app at https://www.linkedin.com/developers/apps
 *   2. Products tab → add "Sign In with LinkedIn using OpenID Connect"
 *   3. Products tab → add "Share on LinkedIn"
 *   4. Auth tab → add redirect URL http://localhost:53682/callback
 *   5. Put LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in ~/.claude/.env
 *
 * Usage:
 *   bun Login.ts
 *   bun Login.ts --port 53682
 *
 * @see https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 * @see https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
 * @see https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
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
  LINKEDIN_OAUTH_BASE,
  LINKEDIN_SCOPES,
  LINKEDIN_VERSION,
  buildAuthUrl,
  linkedinFetch,
} from "../../Lib/linkedin.ts";

// ============================================================================
// Types & Constants
// ============================================================================

interface CLIArgs {
  port: number;
}

const DEFAULT_PORT = 53682;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type?: string;
}

interface UserInfoResponse {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

function redirectUriFor(port: number): string {
  return `http://localhost:${port}/callback`;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
Login - LinkedIn OAuth CLI (REST version ${LINKEDIN_VERSION})

Walks you through the LinkedIn OAuth 2.0 flow and stores a 60-day
member access token plus your Person URN in ~/.claude/.env (chmod 600).

USAGE:
  bun Login.ts
  bun Login.ts --port 53682

OPTIONS:
  --port <n>          Local callback server port (default ${DEFAULT_PORT})
  --help, -h          Show this help message

PREREQUISITES (one-time per LinkedIn app):

  1. Create an app at:
       https://www.linkedin.com/developers/apps
     (or reuse an existing app you control)

  2. On the app's "Products" tab, add BOTH of these (self-serve, instant):
       - Sign In with LinkedIn using OpenID Connect
       - Share on LinkedIn

  3. On the app's "Auth" tab, add this redirect URL (character-for-character):
       http://localhost:${DEFAULT_PORT}/callback

  4. From the Auth tab, copy your Client ID and Client Secret.

  5. Put them in ~/.claude/.env:
       LINKEDIN_CLIENT_ID=your_client_id
       LINKEDIN_CLIENT_SECRET=your_client_secret

SCOPES REQUESTED (${LINKEDIN_SCOPES.length}):
  ${LINKEDIN_SCOPES.join(", ")}

OUTPUT (written to ~/.claude/.env):
  LINKEDIN_ACCESS_TOKEN         60-day member access token
  LINKEDIN_PERSON_URN           urn:li:person:{sub}
  LINKEDIN_TOKEN_EXPIRES_AT     Unix epoch seconds when token expires

NOTES:
  - LinkedIn member tokens expire after 60 days and do NOT refresh
    automatically. Re-run this tool every ~60 days.
  - LinkedIn does not support PKCE, so your client secret lives in
    ~/.claude/.env (chmod 600).
`);
  process.exit(0);
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
  }

  const parsed: CLIArgs = { port: DEFAULT_PORT };
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
      case "port": {
        const n = parseInt(value, 10);
        if (Number.isNaN(n) || n < 1 || n > 65535) {
          throw new CLIError(`Invalid --port: ${value} (must be 1-65535)`);
        }
        parsed.port = n;
        i++;
        break;
      }
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }
  return parsed;
}

// ============================================================================
// Prereq check
// ============================================================================

function printPrereqWalkthrough(port: number): void {
  console.error(`
❌ LinkedIn credentials are not set up yet.

Before running Login.ts, you must create a LinkedIn developer app and
put its Client ID and Client Secret in ~/.claude/.env.

One-time setup:

  1. Go to https://www.linkedin.com/developers/apps and create a new app
     (or open an existing one you control).

  2. On the "Products" tab, add BOTH of these — they are self-serve and
     provision instantly:
         • Sign In with LinkedIn using OpenID Connect
         • Share on LinkedIn

  3. On the "Auth" tab, under "OAuth 2.0 settings → Authorized redirect
     URLs", add EXACTLY this URL:
         http://localhost:${port}/callback

  4. From the same Auth tab, copy your "Client ID" and "Client Secret"
     (visible under "Application credentials").

  5. Add them to ~/.claude/.env (create the file if it doesn't exist):
         LINKEDIN_CLIENT_ID=your_client_id_here
         LINKEDIN_CLIENT_SECRET=your_client_secret_here

Then re-run:  bun Login.ts
`);
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
 * Start a local HTTP server on `port` and wait for LinkedIn to redirect
 * back with ?code=... (or ?error=...). Validates that ?state matches the
 * provided expected value, resolves with the code, then stops the server.
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
            `LinkedIn returned: <code>${escapeHtml(decoded)}</code>. You can close this tab.`,
            "#ef4444",
          );
        }

        const state = url.searchParams.get("state");
        if (state !== expectedState) {
          setTimeout(() => {
            server.stop(true);
            reject(new CLIError(`OAuth state mismatch — possible CSRF, aborting. Expected ${expectedState}, got ${state}`));
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
          "#0a66c2",
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
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("redirect_uri", redirectUri);

  const response = await fetch(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CLIError(
      `LinkedIn token endpoint returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }
  if (!response.ok) {
    const err = json as { error?: string; error_description?: string };
    throw new CLIError(
      `LinkedIn token exchange failed (HTTP ${response.status}): ${err.error ?? "unknown"} — ${err.error_description ?? text}`,
    );
  }
  return json as TokenResponse;
}

async function fetchUserInfo(accessToken: string): Promise<UserInfoResponse> {
  const result = await linkedinFetch<UserInfoResponse>("/v2/userinfo", {
    method: "GET",
    token: accessToken,
  });
  if (!result.body.sub) {
    throw new CLIError(
      `LinkedIn /v2/userinfo did not return a 'sub' field. Ensure the "Sign In with LinkedIn using OpenID Connect" product is added to your app.`,
    );
  }
  return result.body;
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
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    await loadEnv();
    const args = parseArgs(process.argv);

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      printPrereqWalkthrough(args.port);
      process.exit(1);
    }

    const redirectUri = redirectUriFor(args.port);
    const state = randomBytes(16).toString("hex");

    const rl = createInterface({ input, output });
    try {
      const authUrl = buildAuthUrl({
        clientId,
        redirectUri,
        scopes: LINKEDIN_SCOPES,
        state,
      });

      console.log(`\n📍 Redirect URI: ${redirectUri}`);
      console.log(
        `   Make sure this is registered under Auth → Authorized redirect URLs`,
      );
      console.log(`   in your LinkedIn app dashboard before continuing.`);
      console.log(`\n🔑 Requesting ${LINKEDIN_SCOPES.length} scope(s): ${LINKEDIN_SCOPES.join(", ")}`);
      console.log(`🌐 Starting local callback server on port ${args.port}...`);
      const callbackPromise = waitForCallback(args.port, state);

      console.log(`🔐 Opening LinkedIn OAuth dialog in your browser...`);
      console.log(`\nIf the browser does not open, visit this URL manually:\n${authUrl}\n`);
      openInBrowser(authUrl);

      console.log(`⏳ Waiting for callback on ${redirectUri} ...`);
      const { code } = await callbackPromise;
      console.log(`✅ Authorization code received\n`);

      console.log(`🔄 Exchanging code for access token...`);
      const tokenResponse = await exchangeCodeForToken(
        code,
        clientId,
        clientSecret,
        redirectUri,
      );
      console.log(`✅ Access token obtained (expires in ${tokenResponse.expires_in}s)\n`);

      console.log(`🔄 Fetching member profile (/v2/userinfo)...`);
      const userInfo = await fetchUserInfo(tokenResponse.access_token);
      const personUrn = `urn:li:person:${userInfo.sub}`;
      console.log(`✅ Member URN: ${personUrn}`);
      if (userInfo.name) console.log(`   Name: ${userInfo.name}`);
      if (userInfo.email) console.log(`   Email: ${userInfo.email}`);

      const expiresAt = Math.floor(Date.now() / 1000) + tokenResponse.expires_in;

      const updates: Record<string, string> = {
        LINKEDIN_ACCESS_TOKEN: tokenResponse.access_token,
        LINKEDIN_PERSON_URN: personUrn,
        LINKEDIN_TOKEN_EXPIRES_AT: String(expiresAt),
      };
      const savedPath = await saveCredentials(updates, rl);

      const expiryDate = new Date(expiresAt * 1000).toISOString();
      console.log(`\n✅ Credentials written to ${savedPath} (chmod 600)`);
      console.log(`\nPerson URN:   ${personUrn}`);
      console.log(`Expires at:   ${expiryDate}`);
      console.log(`Token type:   60-day member access token (no refresh — re-run Login in ~60 days)`);
      console.log(`\nNext steps:`);
      console.log(`  bun Publish.ts --message "hello from DOS"`);
    } finally {
      rl.close();
    }
  } catch (error) {
    handleError(error);
  }
}

main();
