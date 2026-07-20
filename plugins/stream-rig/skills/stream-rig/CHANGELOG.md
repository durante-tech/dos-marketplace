# StreamRig Changelog

## v0.0.2 — 2026-06-09

GoLive — provision a YouTube live broadcast + configure OBS from an operator's subject.

### Shipped

- `Workflows/GoLive.md` — from a live subject: preflight → ≤4-question interview → metadata + thumbnail → YouTube broadcast → set overlays on the LIVE OBS sources (no rebuild) → announcements + show-notes + episode memory → ready-to-stream summary.
- `Tools/YouTubeLive.ts` — YouTube Data API v3 write client (Bun, zero-dep): OAuth2 PKCE loopback `auth`, `create-broadcast` (insert + liveStream create/bind + thumbnail + category/tags via videos.update), `set-thumbnail`, `update-meta`, `whoami`, `--dry-run`. Scope `youtube.force-ssl`. Creds via env / `~/.config/streamrig/youtube.json` / 1Password; no inline secrets.
- `Tools/SETUP-YouTube.md` — one-time Google Cloud OAuth client setup guide.
- `Presets/build-in-public.yaml` — mirrors the live DuranteOS 5-scene collection (01_Intro..05_Outro), the `~/Durante/Overlays` query-param contract, scene + algo phases, and a `golive:` block (YouTube metadata + thumbnail + announcement templates).
- SKILL.md: GoLive routing + USE WHEN triggers; "go live" moved off PreShow to resolve the collision; deps + example updated.

### Design notes

- Reuses the operator's on-PATH `obs` + `dos-stream` CLIs rather than lifting copies — avoids the live-vs-builder drift found in the 2026-06-09 stack sweep. The standalone `Tools/Obs.ts`/`Stream.ts`/`StreamdeckBuild.ts` distribution-lift stays deferred.
- GoLive sets overlay params on EXISTING sources and never runs `obs-scene-build` (anti-clobber).

### Still deferred to v0.0.3+

- `Tools/Obs.ts` / `Tools/Stream.ts` / `Tools/StreamdeckBuild.ts` standalone lift; `Overlays/*.html` templates; gaming/tutorial/pomodoro/variety presets; cross-episode MemPalace tunnels; Linux/Windows adapters.

## v0.0.1 — 2026-05-12

Initial scaffold. Orchestrator skill for creator livestreams — composes Brand, DesignSystem, Media, ContentAnalysis, Dispatch, SocialMedia, MemPalace.

### Shipped

- SKILL.md (partials-mode authoring source + generated canonical)
- 6 workflow specs: InitRig, PreShow, EndShow, PostStream, EpisodeMemory, RefreshBrand
- Presets/podcast.yaml — v0.1 reference preset (6 phases, 4 scenes, 5 overlays, 6 assets, Stream Deck Standard layout)
- 4-file distribution contract (plugin.json, INSTALL.md, README.md, VERIFY.md)
- RFC-0002 extension manifest (src/extension.yaml)
- MemPalace registration (KG fact + skills-room drawer)

### Deferred to v0.0.2

- `Tools/Obs.ts` — lift from `dotfiles/scripts/scripts/obs.ts` (OBS WebSocket v5 CLI)
- `Tools/Stream.ts` — lift from `dotfiles/scripts/scripts/dos-stream.ts` (runtime control plane)
- `Tools/StreamdeckBuild.ts` — lift from `dotfiles/scripts/scripts/streamdeck-build.ts` (profile builder)
- `Overlays/*.html` — 5 HTML templates (Intro, Outro, PodcastDualFrame, LowerThird, Brb) with CSS-custom-property tokens

### Deferred to v0.0.3+

- `Presets/build-in-public.yaml`, `gaming.yaml`, `tutorial.yaml`, `pomodoro.yaml`, `variety.yaml`
- Cross-episode MemPalace tunnels
- CinematicLanding + PitchDeck integrations in PostStream
- Custom phase authoring + free-form vibe authoring
- Linux / Windows adapters
