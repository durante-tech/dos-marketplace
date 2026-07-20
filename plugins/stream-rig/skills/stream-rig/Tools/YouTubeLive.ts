#!/usr/bin/env bun
/**
 * YouTubeLive.ts — YouTube Data API v3 LIVE write client for StreamRig GoLive.
 *
 * Programmatically creates a scheduled live broadcast, binds an ingestion
 * stream, sets a thumbnail, and writes category/tags — everything the GoLive
 * workflow needs to "provision the YouTube side" of a build-in-public stream.
 *
 * Zero npm dependencies — Bun built-ins only (fetch, crypto, Bun.serve).
 *
 * Commands:
 *   auth                       One-time: browser OAuth (PKCE loopback), stores refresh token.
 *   whoami                     Print the authenticated channel title + id.
 *   create-broadcast           Create broadcast (+stream +bind +thumbnail +meta). See flags.
 *   set-thumbnail              Upload a thumbnail to an existing broadcast/video.
 *   update-meta                Set category + tags (videos.update PUT) on a video.
 *   help
 *
 * create-broadcast flags:
 *   --title "<str>"            (required) 1-100 chars
 *   --description "<str>"      (optional) up to 5000 chars; use $'...\n...' for newlines
 *   --start <RFC3339>          (optional) future ISO time; default = now + 120s
 *   --visibility public|unlisted|private   (default public)
 *   --tags "a,b,c"             (optional) comma-separated
 *   --category <id>            (default 28 = Science & Technology)
 *   --thumbnail <path>         (optional) JPEG/PNG <=2MB, ideally 1280x720
 *   --auto-start               contentDetails.enableAutoStart = true (go live when OBS pushes)
 *   --no-stream                skip stream create+bind (use OBS's own YouTube auth / Path B)
 *   --latency normal|low|ultraLow   (default low)
 *   --json                     emit a machine-readable JSON result on stdout
 *   --dry-run                  print the request bodies, call nothing
 *
 * Credentials (precedence):
 *   1. env YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET
 *   2. ~/.config/streamrig/youtube.json  { client_id, client_secret, refresh_token }
 *   1Password: if YT_OP_ITEM set (e.g. "op://Personal/YouTube API"), reads
 *   client_id/client_secret/refresh_token fields via `op read`.
 *
 * Scope: https://www.googleapis.com/auth/youtube.force-ssl
 *
 * @version 1.0.0  (spec verified against developers.google.com YouTube Data API v3)
 */

import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3";
const CONFIG_PATH = `${homedir()}/.config/streamrig/youtube.json`;

// ---------- tiny ANSI ----------
const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m", cyan: "\x1b[36m", red: "\x1b[31m",
};
const log = (s: string) => process.stdout.write(s + "\n");
const err = (s: string) => process.stderr.write(s + "\n");
function die(msg: string): never { err(`${c.red}Error:${c.reset} ${msg}`); process.exit(1); }

// ---------- base64url ----------
function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- config ----------
type Config = { client_id?: string; client_secret?: string; refresh_token?: string };

function opRead(ref: string): string | undefined {
  const r = spawnSync("op", ["read", ref], { encoding: "utf8" });
  if (r.status === 0) return r.stdout.trim();
  return undefined;
}

function loadConfig(): Config {
  const cfg: Config = {};
  if (existsSync(CONFIG_PATH)) {
    try { Object.assign(cfg, JSON.parse(readFileSync(CONFIG_PATH, "utf8"))); } catch {}
  }
  const opItem = process.env.YT_OP_ITEM; // e.g. op://Personal/YouTube API
  if (opItem) {
    cfg.client_id ??= opRead(`${opItem}/client_id`);
    cfg.client_secret ??= opRead(`${opItem}/client_secret`);
    cfg.refresh_token ??= opRead(`${opItem}/refresh_token`);
  }
  if (process.env.YOUTUBE_CLIENT_ID) cfg.client_id = process.env.YOUTUBE_CLIENT_ID;
  if (process.env.YOUTUBE_CLIENT_SECRET) cfg.client_secret = process.env.YOUTUBE_CLIENT_SECRET;
  return cfg;
}

function saveConfig(cfg: Config): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  // writeArtifact:exempt — writes the OAuth refresh token to ~/.config/streamrig (mode 0600 credential file), not a DOS artifact
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 }); // 0600 atomically — never a world-readable window for the secret
  chmodSync(CONFIG_PATH, 0o600); // belt-and-suspenders for a pre-existing file
}

function requireClient(cfg: Config): { id: string; secret: string } {
  if (!cfg.client_id || !cfg.client_secret) {
    die(
      "No OAuth client credentials. Set YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET, " +
      `or put {client_id,client_secret} in ${CONFIG_PATH}. See SETUP-YouTube.md.`
    );
  }
  return { id: cfg.client_id, secret: cfg.client_secret };
}

// ---------- OAuth ----------
async function getAccessToken(cfg: Config): Promise<string> {
  const { id, secret } = requireClient(cfg);
  if (!cfg.refresh_token) die("Not authorized yet. Run: bun YouTubeLive.ts auth");
  const body = new URLSearchParams({
    client_id: id, client_secret: secret,
    refresh_token: cfg.refresh_token, grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data: any = await res.json();
  if (!res.ok) die(`Token refresh failed (${res.status}): ${data.error_description || data.error || "unknown"}. Re-run 'auth' if the grant was revoked.`);
  return data.access_token;
}

async function cmdAuth(cfg: Config): Promise<void> {
  const { id, secret } = requireClient(cfg);
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(16));

  let resolveCode!: (code: string) => void;
  let rejectCode!: (e: Error) => void;
  const codeP = new Promise<string>((res, rej) => { resolveCode = res; rejectCode = rej; });

  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/") return new Response("not found", { status: 404 });
      const code = url.searchParams.get("code");
      const gotState = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      if (error) { rejectCode(new Error(`OAuth error: ${error}`)); return htmlResp("Authorization failed. You can close this tab."); }
      if (gotState !== state) { rejectCode(new Error("state mismatch (possible CSRF)")); return htmlResp("State mismatch. Close this tab and retry."); }
      if (code) { resolveCode(code); return htmlResp("StreamRig is authorized. You can close this tab and return to the terminal."); }
      return htmlResp("Waiting for authorization code…");
    },
  });
  const redirectUri = `http://127.0.0.1:${server.port}`;
  const authUrl = `${AUTH_URL}?${new URLSearchParams({
    client_id: id, redirect_uri: redirectUri, response_type: "code", scope: SCOPE,
    access_type: "offline", prompt: "consent", code_challenge: challenge,
    code_challenge_method: "S256", state,
  })}`;

  log(`${c.cyan}Opening browser for YouTube authorization…${c.reset}`);
  log(`${c.dim}If it doesn't open, visit:${c.reset}\n${authUrl}\n`);
  spawnSync("open", [authUrl]); // macOS

  let code: string;
  try { code = await Promise.race([codeP, timeout(180_000, "OAuth timed out after 3 min")]); }
  finally { server.stop(true); }

  const body = new URLSearchParams({
    code, client_id: id, client_secret: secret, redirect_uri: redirectUri,
    grant_type: "authorization_code", code_verifier: verifier,
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data: any = await res.json();
  if (!res.ok) die(`Code exchange failed (${res.status}): ${data.error_description || data.error}`);
  if (!data.refresh_token) die("No refresh_token returned. Re-run 'auth' (ensure prompt=consent and the Google account is added as a Test user).");

  cfg.client_id = id; cfg.client_secret = secret; cfg.refresh_token = data.refresh_token;
  saveConfig(cfg);
  log(`${c.green}✓ Authorized.${c.reset} Refresh token saved to ${CONFIG_PATH} (mode 600).`);
  await cmdWhoami(cfg);
}

function htmlResp(msg: string): Response {
  return new Response(`<!doctype html><meta charset=utf-8><body style="font:16px/1.5 -apple-system,system-ui;background:#0b0b0f;color:#e6e6e6;padding:3rem"><h2 style="color:#22d3ee">StreamRig</h2><p>${msg}</p></body>`, { headers: { "Content-Type": "text/html" } });
}
function timeout<T>(ms: number, msg: string): Promise<T> {
  return new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms));
}

// ---------- API helpers ----------
async function api(method: string, path: string, token: string, body?: any): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || "";
    const message = data?.error?.message || `HTTP ${res.status}`;
    die(`${method} ${path} failed: ${message}${reason ? ` [${reason}]` : ""}${mapHint(reason)}`);
  }
  return data;
}
function mapHint(reason: string): string {
  const hints: Record<string, string> = {
    liveStreamingNotEnabled: " — enable live streaming once at youtube.com/features (can take ~24h after phone verification).",
    liveBroadcastNotAllowed: " — channel not permitted to go live yet.",
    insufficientPermissions: " — scope youtube.force-ssl not granted; re-run 'auth'.",
    invalidScheduledStartTime: " — --start must be future-dated RFC3339.",
    forbidden: " — custom thumbnails may be verification-gated on this channel.",
  };
  return hints[reason] || "";
}

async function cmdWhoami(cfg: Config): Promise<void> {
  const token = await getAccessToken(cfg);
  const data = await api("GET", "/channels?part=snippet&mine=true", token);
  const ch = data.items?.[0];
  if (!ch) die("No channel for this account.");
  log(`${c.green}Channel:${c.reset} ${ch.snippet.title}  ${c.dim}(${ch.id})${c.reset}`);
}

// ---------- create-broadcast ----------
type Flags = Record<string, string | boolean>;
function parseFlags(args: string[]): Flags {
  const f: Flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) { f[key] = true; }
      else { f[key] = next; i++; }
    }
  }
  return f;
}

async function cmdCreateBroadcast(cfg: Config, f: Flags): Promise<void> {
  const title = f.title as string;
  if (!title) die("--title required.");
  const visibility = (f.visibility as string) || "public";
  if (!["public", "unlisted", "private"].includes(visibility)) die("--visibility must be public|unlisted|private.");
  if (f.thumbnail !== undefined && typeof f.thumbnail !== "string") die("--thumbnail requires a file path (none given) — fix before we create an orphaned broadcast.");
  const start = (f.start as string) || new Date(Date.now() + 120_000).toISOString();
  const description = (f.description as string) || "";
  const tags = f.tags ? (f.tags as string).split(",").map((t) => t.trim()).filter(Boolean) : [];
  const categoryId = (f.category as string) || "28";
  const latency = (f.latency as string) || "low";
  const dry = !!f["dry-run"];
  const wantJson = !!f.json;

  const broadcastBody = {
    snippet: { title, description, scheduledStartTime: start },
    status: { privacyStatus: visibility, selfDeclaredMadeForKids: false },
    contentDetails: {
      enableAutoStart: !!f["auto-start"],
      enableAutoStop: !!f["auto-start"],
      latencyPreference: latency,
      monitorStream: { enableMonitorStream: false },
    },
  };
  const streamBody = {
    snippet: { title: `${title} — ingestion` },
    cdn: { ingestionType: "rtmp", resolution: "variable", frameRate: "variable" },
    contentDetails: { isReusable: true },
  };

  if (dry) {
    log(`${c.yellow}DRY RUN — no API calls.${c.reset}`);
    log(`${c.bold}POST /liveBroadcasts?part=snippet,status,contentDetails${c.reset}\n${JSON.stringify(broadcastBody, null, 2)}`);
    if (!f["no-stream"]) log(`${c.bold}POST /liveStreams?part=snippet,cdn,contentDetails${c.reset}\n${JSON.stringify(streamBody, null, 2)}`);
    log(`${c.bold}videos.update PUT${c.reset} id=<broadcastId> snippet.categoryId=${categoryId} tags=${JSON.stringify(tags)}`);
    if (f.thumbnail) log(`${c.bold}thumbnails.set${c.reset} videoId=<broadcastId> file=${f.thumbnail}`);
    return;
  }

  const token = await getAccessToken(cfg);

  // 2. create broadcast
  const b = await api("POST", "/liveBroadcasts?part=snippet,status,contentDetails", token, broadcastBody);
  const broadcastId: string = b.id;
  log(`${c.green}✓ broadcast${c.reset} ${broadcastId}`);

  // 3+4. stream + bind (unless OBS owns its own auth)
  let ingestion: { address?: string; key?: string; backup?: string } = {};
  if (!f["no-stream"]) {
    const s = await api("POST", "/liveStreams?part=snippet,cdn,contentDetails", token, streamBody);
    const streamId: string = s.id;
    ingestion = {
      address: s.cdn?.ingestionInfo?.ingestionAddress,
      key: s.cdn?.ingestionInfo?.streamName,
      backup: s.cdn?.ingestionInfo?.backupIngestionAddress,
    };
    await api("POST", `/liveBroadcasts/bind?id=${broadcastId}&streamId=${streamId}&part=id,contentDetails`, token);
    log(`${c.green}✓ stream bound${c.reset} ${streamId}`);
  }

  // 5. thumbnail
  if (f.thumbnail) {
    await uploadThumbnail(token, broadcastId, f.thumbnail as string);
    log(`${c.green}✓ thumbnail set${c.reset}`);
  }

  // 6. category + tags (videos.update PUT — must re-send title)
  await api("PUT", "/videos?part=snippet", token, { id: broadcastId, snippet: { title, categoryId, description, tags } });
  log(`${c.green}✓ category ${categoryId} + ${tags.length} tags${c.reset}`);

  const watch = `https://www.youtube.com/watch?v=${broadcastId}`;
  const studio = `https://studio.youtube.com/video/${broadcastId}/livestreaming`;
  const result = { broadcastId, watch, studio, visibility, scheduledStartTime: start, ingestion };

  if (wantJson) { log(JSON.stringify(result)); return; }
  log("");
  log(`${c.bold}Watch:${c.reset}  ${watch}`);
  log(`${c.bold}Studio:${c.reset} ${studio}`);
  if (ingestion.address) {
    log(`${c.bold}OBS Server:${c.reset}  ${ingestion.address}`);
    log(`${c.bold}OBS Key:${c.reset}     ${ingestion.key}`);
    log(`${c.dim}(Set OBS → Settings → Stream → Custom with the above, or pick this broadcast in OBS Manage Broadcast.)${c.reset}`);
  }
}

async function uploadThumbnail(token: string, videoId: string, file: string): Promise<void> {
  if (!existsSync(file)) die(`Thumbnail not found: ${file}`);
  const bytes = readFileSync(file);
  if (bytes.length > 2 * 1024 * 1024) die("Thumbnail exceeds 2MB.");
  const mime = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const res = await fetch(`${UPLOAD}/thumbnails/set?videoId=${videoId}&uploadType=media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": mime },
    body: bytes,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) die(`thumbnails.set failed: ${data?.error?.message || res.status}${mapHint(data?.error?.errors?.[0]?.reason || "")}`);
}

async function cmdSetThumbnail(cfg: Config, f: Flags): Promise<void> {
  const videoId = f.video as string;
  const file = f.file as string;
  if (!videoId || !file) die("Usage: set-thumbnail --video <id> --file <path>");
  const token = await getAccessToken(cfg);
  await uploadThumbnail(token, videoId, file);
  log(`${c.green}✓ thumbnail set on ${videoId}${c.reset}`);
}

async function cmdUpdateMeta(cfg: Config, f: Flags): Promise<void> {
  const videoId = f.video as string;
  const title = f.title as string;
  if (!videoId || !title) die("Usage: update-meta --video <id> --title <str> [--category 28] [--tags a,b]");
  const categoryId = (f.category as string) || "28";
  const tags = f.tags ? (f.tags as string).split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  const token = await getAccessToken(cfg);
  // videos.update is a full-replace PUT — read the current snippet first and merge,
  // or this wipes description (and tags, unless overridden).
  const cur = await api("GET", `/videos?part=snippet&id=${videoId}`, token);
  const curSnippet = cur.items?.[0]?.snippet ?? {};
  const snippet: any = { ...curSnippet, title, categoryId };
  if (tags) snippet.tags = tags;
  await api("PUT", "/videos?part=snippet", token, { id: videoId, snippet });
  log(`${c.green}✓ meta updated on ${videoId}${c.reset}`);
}

function showHelp(): void {
  log(`${c.bold}YouTubeLive.ts${c.reset} — YouTube live broadcast provisioning for StreamRig GoLive\n`);
  log(`  ${c.cyan}auth${c.reset}                       one-time browser OAuth (PKCE), stores refresh token`);
  log(`  ${c.cyan}whoami${c.reset}                     print authorized channel`);
  log(`  ${c.cyan}create-broadcast${c.reset} --title "X" [--description ... --start RFC3339 --visibility public|unlisted|private`);
  log(`                              --tags a,b --category 28 --thumbnail path --auto-start --no-stream --json --dry-run]`);
  log(`  ${c.cyan}set-thumbnail${c.reset} --video <id> --file <path>`);
  log(`  ${c.cyan}update-meta${c.reset} --video <id> --title "X" [--category 28 --tags a,b]`);
  log(`\nSetup: see SETUP-YouTube.md. Creds via env or ${CONFIG_PATH}.`);
}

// ---------- main ----------
const [cmd, ...rest] = process.argv.slice(2);
const cfg = loadConfig();
try {
  switch (cmd) {
    case "auth": await cmdAuth(cfg); break;
    case "whoami": await cmdWhoami(cfg); break;
    case "create-broadcast": await cmdCreateBroadcast(cfg, parseFlags(rest)); break;
    case "set-thumbnail": await cmdSetThumbnail(cfg, parseFlags(rest)); break;
    case "update-meta": await cmdUpdateMeta(cfg, parseFlags(rest)); break;
    case "help": case "-h": case "--help": case undefined: showHelp(); break;
    default: err(`Unknown command: ${cmd}`); showHelp(); process.exit(1);
  }
} catch (e: any) {
  die(e?.message || String(e));
}
