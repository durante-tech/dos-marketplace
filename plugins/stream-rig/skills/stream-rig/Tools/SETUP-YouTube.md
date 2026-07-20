# SETUP — YouTube Live API (one-time, ~5 minutes)

`YouTubeLive.ts` provisions YouTube live broadcasts via the YouTube Data API v3.
Writing to your channel requires **your** OAuth grant — this is the single manual
step. Do it once; every GoLive after is hands-off.

## 0. Prerequisite (one-time, on YouTube)
Enable live streaming on the channel: <https://youtube.com/features> → "Live streaming".
Needs a verified phone; a fresh enable can take ~24h to activate. Without this,
the API fails with `liveStreamingNotEnabled`.

## 1. Create a Google Cloud OAuth client
1. Go to <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → Library →** enable **"YouTube Data API v3"**.
3. **APIs & Services → OAuth consent screen →** User type **External**. Fill the
   minimum app name + your email. Under **Scopes** you can leave it; we request the
   scope at runtime. Under **Test users**, add the Google account that owns the
   channel (while the app is in "Testing", this keeps the refresh token from
   expiring in 7 days).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID →**
   Application type **"Desktop app"**. Copy the **Client ID** and **Client secret**.

## 2. Give the CLI the client creds (pick one)

**Option A — env (quick):**
```bash
export YOUTUBE_CLIENT_ID="xxxx.apps.googleusercontent.com"
export YOUTUBE_CLIENT_SECRET="GOCSPX-xxxx"
```

**Option B — config file (persistent):**
```bash
mkdir -p ~/.config/streamrig
cat > ~/.config/streamrig/youtube.json <<'JSON'
{ "client_id": "xxxx.apps.googleusercontent.com", "client_secret": "GOCSPX-xxxx" }
JSON
chmod 600 ~/.config/streamrig/youtube.json
```

**Option C — 1Password:** store the two fields in an item and
`export YT_OP_ITEM="op://Personal/YouTube API"` (fields `client_id`, `client_secret`,
and later `refresh_token`).

## 3. Authorize (browser, once)
```bash
bun ~/.claude/skills/stream-rig/Tools/YouTubeLive.ts auth
```
A browser opens → pick the channel's Google account → approve. The CLI captures the
code on a loopback port, exchanges it, and writes the **refresh token** to
`~/.config/streamrig/youtube.json` (mode 600). Confirm with:
```bash
bun ~/.claude/skills/stream-rig/Tools/YouTubeLive.ts whoami
```

## 4. Done
GoLive now creates broadcasts unattended. Scope used:
`https://www.googleapis.com/auth/youtube.force-ssl`. Quota: a full
create→bind→thumbnail→meta run is ~200 units of the 10,000/day default (≈40 streams/day).

### Troubleshooting
- `insufficientPermissions` → the grant didn't include the scope; re-run `auth`.
- `No refresh_token returned` → ensure the account is a **Test user** and re-run `auth` (it forces `prompt=consent`).
- `forbidden` on thumbnail → custom thumbnails are verification-gated; verify the channel.
- Token refresh fails after working before → the grant was revoked or the test-app 7-day window lapsed; re-run `auth`.
