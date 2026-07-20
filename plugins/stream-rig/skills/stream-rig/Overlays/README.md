# StreamRig Overlays

HTML overlay templates deferred to v0.0.1 implementation. Five overlays land here for the podcast preset:

- **`Intro.html`** — Pre-show splash with episode N, title, guest, topics. Query params: `n`, `title`, `guest?`, `topics?`.
- **`Outro.html`** — Wrap card with shipped/highlights, runtime, next-episode preview. Query params: `n`, `runtime?`, `highlights?`, `nextEp?`.
- **`PodcastDualFrame.html`** — Host webcam left, guest webcam right, lower-third bottom. Query params: `phase`.
- **`LowerThird.html`** — Talking-head overlay (name + handle + topic). Query params: `name`, `handle?`, `topic?`.
- **`Brb.html`** — Be-right-back card with timer. Query params: `backIn?` (default 5 min).

**Authoring discipline:**
- All styling via CSS custom properties from `~/.config/streamrig/brand/theme.css`
- No hardcoded colors, fonts, or sizes in HTML
- Self-contained — no external JS dependencies; vanilla DOM + minimal inline JS

**Lift reference**: `~/Durante/Overlays/` (Lucas's existing terminal-frame, webcam-frame, lower-third).

Full preset wiring: `Presets/podcast.yaml`. Full schema: `MEMORY/WORK/20260512-160000_streamrig-v01-spec/DATAMODEL.md § Overlay`.
