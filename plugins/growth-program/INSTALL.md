# GrowthProgram v0.1.0 — Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through install.

### Step 1 — Place the skill

Copy `src/` to the user's skills directory as `growth-program`:

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/GrowthProgram"
cp -R src/* "$CLAUDE_DIR/skills/growth-program/"
```

Under the DOS plugin distribution (v0.0.23+), prefer `/plugin install growth-program@durante` — the
marketplace emitter ships this pack as a Claude Code plugin and there is no manual copy step.

### Step 2 — Configure (optional)

Set `studio_api_key` (and `studio_api_url`) via the plugin `userConfig` prompt so the metered `research`
and `media` calls route through the Studio gateway. Without a key, those phases degrade to direct SDKs
where available.

### Step 3 — Verify

Run the checklist in `VERIFY.md`.

## Dependencies (composed, informational)

`brand`, `dispatch`, `media`, `social-media`, `stream-rig`, `research`, `sentinel`, `mem-palace`. The pack
degrades gracefully when a composed skill is absent (it reports the gap rather than failing).
