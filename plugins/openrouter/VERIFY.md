# OpenRouter v1.0.0 - Verification

Run after installing the pack into `~/.claude/skills/OpenRouter`.

```bash
set -euo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
TARGET="$CLAUDE_DIR/skills/OpenRouter"

test -f "$TARGET/SKILL.md"
test -f "$TARGET/SKILL.partials.md"
test -f "$TARGET/extension.yaml"
test -f "$TARGET/Lib/env.ts"
test -f "$TARGET/Lib/openrouter-gateway.ts"
test -f "$TARGET/Lib/cli.ts"
test -f "$TARGET/Tools/Chat.ts"
test -f "$TARGET/Tools/Models.ts"
test -f "$TARGET/Tools/package.json"
test -f "$TARGET/Tools/tsconfig.json"
test -f "$TARGET/Workflows/MultiVendorInference.md"

grep -q "^name: OpenRouter" "$TARGET/SKILL.md"
grep -q "declaration_only: false" "$TARGET/extension.yaml"

(cd "$TARGET/Tools" && bun install)
bun "$TARGET/Tools/Models.ts" --help >/tmp/openrouter-models-help.txt
bun "$TARGET/Tools/Chat.ts" --help >/tmp/openrouter-chat-help.txt

if [ -x "$TARGET/Tools/node_modules/.bin/tsc" ]; then
  "$TARGET/Tools/node_modules/.bin/tsc" -p "$TARGET/Tools/tsconfig.json" --noEmit
else
  echo "INFO TypeScript binary missing after bun install; skip local typecheck"
fi

echo "OpenRouter verification passed"
```
