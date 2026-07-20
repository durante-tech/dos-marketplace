---
name: RefreshBrand
description: Re-skin overlays + regenerate stale assets after DESIGN.md token edits
status: STABLE
bestPath:
  - title: "Token Read"
    description: "Extract the current DESIGN.md token bag via design-system."
  - title: "Diff Detection"
    description: "Compare current tokens against the last-known cache to find drift."
  - title: "Selective Regeneration"
    description: "Regenerate only assets whose regenTrigger tokens intersect the changed set."
  - title: "Overlay & Deck Re-skin"
    description: "Rewrite overlay CSS variables and rebuild the Stream Deck profile if relevant tokens changed."
  - title: "Cache Update"
    description: "Update last-tokens.json so the next diff is accurate."
---

# RefreshBrand Workflow

## When to Use

- Trigger phrases: "refresh brand", "re-skin", "regen assets", "DESIGN.md changed"
- Brand tokens changed on an already-built rig and overlays/assets/Stream Deck need to catch up
- NOT for first-time rig setup — use InitRig; RefreshBrand only re-skins an already-built rig

**Purpose:** Re-skin the stream rig after brand-token changes. Compares current DESIGN.md tokens against the last-known cache; regenerates only assets whose `regenTrigger` tokens have changed. Cheap and selective.

**Budget:** ~3-10 min, ~10-25 credits depending on token drift breadth.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=RefreshBrand action_phrase="refresh the stream brand" -->


**Purpose:** Re-skin the stream rig after brand-token changes. Compares current DESIGN.md tokens against the last-known cache; regenerates only assets whose `regenTrigger` tokens have changed. Cheap and selective.

**Budget:** ~3-10 min, ~10-25 credits depending on token drift breadth.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=RefreshBrand action_phrase="refresh the stream brand" -->

## Inputs

- Optional `--asset <name>` — force-regen one specific asset
- Optional `--all` — bypass token cache, regenerate everything

## Prerequisites

- DESIGN.md exists at `~/.claude/MEMORY/BRAND/DESIGN.md` (or project-local)
- `~/.config/streamrig/last-tokens.json` exists (created by InitRig)

## Steps

### 1. Read current DESIGN.md tokens

```
Skill("design-system", "extract tokens from DESIGN.md as JSON")
```

Returns a token bag (`--primary`, `--accent`, `--bg`, `--font-display`, etc.).

### 2. Diff against last-tokens.json

```bash
CURRENT=$(mktemp)
echo "$TOKENS_JSON" > "$CURRENT"
LAST=~/.config/streamrig/last-tokens.json
CHANGED_TOKENS=$(diff <(jq -S . "$LAST") <(jq -S . "$CURRENT") | grep -E '^[<>]' | awk '{print $2}' | tr -d ':,"')
```

If `CHANGED_TOKENS` empty and `--all`/`--asset` not passed → no-op, exit with "no token changes detected."

### 3. Regenerate affected assets

For each asset in active preset whose `regenTrigger[]` intersects `CHANGED_TOKENS`:
```
Skill("media", "regenerate asset <assetName> using prompt-template <template> with new tokens <tokens>")
```

Run in parallel up to ~6 concurrent.

### 4. Re-skin overlays

Overlays are static HTML using CSS custom properties. Re-skinning is just rewriting the embedded `:root` token block — no Media call needed.

```bash
THEME_CSS=~/.config/streamrig/brand/theme.css
# Write generated CSS variable block from DESIGN.md tokens
cat > "$THEME_CSS" <<EOF
:root {
  --primary: $PRIMARY;
  --accent: $ACCENT;
  --bg: $BG;
  --font-display: $FONT_DISPLAY;
  /* ... full token bundle ... */
}
EOF
```

OBS Browser Sources cache `theme.css`; force a no-cache reload of every browser
overlay source via the on-PATH `obs` CLI (`RefreshBrowserSources` is not a real
obs-websocket request — the per-source `refreshnocache` button is):
```bash
obs raw GetInputList | jq -r '.inputs[] | select(.inputKind|test("browser")) | .inputName' | \
while IFS= read -r name; do
  obs raw PressInputPropertiesButton "$(jq -nc --arg n "$name" '{inputName:$n,propertyName:"refreshnocache"}')"
done
```

### 5. Rebuild Stream Deck profile (if icon-driving tokens changed)

If `--primary`, `--bg`, or `--font-display` are in `CHANGED_TOKENS`, re-skin via the
on-PATH `streamdeck-build` CLI. It takes positional `<source.streamDeckProfile>
<output.streamDeckProfile>` — it CLONES the source profile and re-skins icons from
the current brand tokens (DESIGN.md), so point it at your existing profile:
```bash
SRC=~/.config/streamrig/streamrig-current.streamDeckProfile
[ -f "$SRC" ] && streamdeck-build "$SRC" "$SRC.new" && mv "$SRC.new" "$SRC" \
  || echo "NOTE: no source .streamDeckProfile at $SRC — create one in the Stream Deck app first, then re-run."
```

Surface the path; operator double-clicks to re-install.

### 6. Update token cache

```bash
cp "$CURRENT" "$LAST"
```

<!-- partial: _intent-to-flag-table.md skill_name=StreamRig workflow_name=RefreshBrand -->
## Intent-to-Flag Mapping

### Scope

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Token-diff-driven; selective regen |
| "everything", "force all" | `--all` | Bypass cache; regenerate every asset |
| "just the wordmark", "only X" | `--asset <name>` | Regenerate exactly one asset |

### Mode

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Standard quality regen |
| "preview", "what would change" | `--dry-run` | Print diff + asset list; no Media calls |

<!-- partial: _workflow-output-shape.md skill_name=StreamRig workflow_name=RefreshBrand -->
## Output

- N assets regenerated in `~/.config/streamrig/brand/`
- `theme.css` rewritten with current tokens
- OBS Browser Sources refreshed
- Stream Deck profile rebuilt if relevant tokens changed
- `last-tokens.json` updated

## Done

Brand refresh complete. Overlays and Stream Deck reflect current DESIGN.md.
