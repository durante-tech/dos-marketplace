# OpenRouter v1.0.0 - Installation Guide

This guide is for AI agents installing the openrouter pack into a DOS-compatible `~/.claude` tree.

---

## Preconditions

- `bun` is installed.
- `STUDIO_API_URL` and `STUDIO_API_KEY` are configured in `~/.claude/.gateway.env`.
- Studio has OpenRouter pricing rows and `STUDIO_POOL_OPENROUTER_API_KEY` configured for chat completions.

---

## System Check

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if command -v bun >/dev/null 2>&1; then
  bun --version
else
  echo "ERROR Bun is required"
  exit 1
fi

if [ -d "$CLAUDE_DIR/skills/OpenRouter" ]; then
  echo "WARNING Existing openrouter skill found at $CLAUDE_DIR/skills/OpenRouter"
else
  echo "OK Clean OpenRouter install target"
fi
```

---

## Backup Existing Install

Run this before replacing an existing skill directory:

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/openrouter-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/OpenRouter" ] && cp -R "$CLAUDE_DIR/skills/OpenRouter" "$BACKUP_DIR/OpenRouter"
echo "Backup created at $BACKUP_DIR"
```

---

## Install

Run from `Packs/OpenRouter`:

```bash
set -euo pipefail

PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/OpenRouter"

mkdir -p "$TARGET/Lib" "$TARGET/Tools" "$TARGET/Workflows"

cp "$PACK_DIR/src/SKILL.md" "$TARGET/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md" "$TARGET/SKILL.partials.md"
cp "$PACK_DIR/src/extension.yaml" "$TARGET/extension.yaml"
cp "$PACK_DIR/src/Lib/"*.ts "$TARGET/Lib/"
cp "$PACK_DIR/src/Tools/"*.ts "$TARGET/Tools/"
cp "$PACK_DIR/src/Tools/package.json" "$TARGET/Tools/package.json"
cp "$PACK_DIR/src/Tools/tsconfig.json" "$TARGET/Tools/tsconfig.json"
[ -f "$PACK_DIR/src/Tools/bun.lock" ] && cp "$PACK_DIR/src/Tools/bun.lock" "$TARGET/Tools/bun.lock"
cp "$PACK_DIR/src/Workflows/"*.md "$TARGET/Workflows/"

(cd "$TARGET/Tools" && bun install)
```

Do not copy `node_modules` from the pack source. Dependencies belong to the target `Tools` directory and are installed there.

---

## Verify

Run `VERIFY.md` after installation:

```bash
bash VERIFY.md
```
