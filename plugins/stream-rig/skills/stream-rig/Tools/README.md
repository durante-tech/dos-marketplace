# StreamRig Tools

Tools are deferred to v0.0.1 implementation. Three tools land here:

- **`Obs.ts`** — OBS WebSocket v5 CLI. Lift target: `dotfiles/scripts/scripts/obs.ts`.
- **`Stream.ts`** — Runtime control plane (phase/preshow/endshow/marker/session-start/status). Lift target: `dotfiles/scripts/scripts/dos-stream.ts`.
- **`StreamdeckBuild.ts`** — Stream Deck profile builder. Lift target: `dotfiles/scripts/scripts/streamdeck-build.ts`.

**Lift discipline:**
- Rename Lucas-specific paths (`~/Durante/Overlays/` → `~/.config/streamrig/brand/`, `~/.config/dos-stream/` → `~/.config/streamrig/`)
- Replace hardcoded scene list with preset YAML reads
- Replace hardcoded design tokens with DESIGN.md token reads
- Preserve CLI surface (verbs and flags) — already canonical

Full spec: `MEMORY/WORK/20260512-160000_streamrig-v01-spec/ARCHITECTURE.md`.
