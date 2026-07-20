# Ref v1.0.0 - Verification

Run after installing the pack into `~/.claude/skills/Ref`.

```bash
set -euo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
TARGET="$CLAUDE_DIR/skills/Ref"

test -f "$TARGET/SKILL.md"
test -f "$TARGET/SKILL.partials.md"
test -f "$TARGET/extension.yaml"
test -f "$TARGET/Lib/env.ts"
test -f "$TARGET/Lib/ref-gateway.ts"
test -f "$TARGET/Lib/cli.ts"
test -f "$TARGET/Tools/Search.ts"
test -f "$TARGET/Tools/Read.ts"
test -f "$TARGET/Tools/package.json"
test -f "$TARGET/Tools/tsconfig.json"
test -f "$TARGET/Workflows/DocsLookup.md"

grep -q "^name: Ref" "$TARGET/SKILL.md"
grep -q "declaration_only: false" "$TARGET/extension.yaml"

(cd "$TARGET/Tools" && bun install)
bun "$TARGET/Tools/Search.ts" --help >/tmp/ref-search-help.txt
bun "$TARGET/Tools/Read.ts" --help >/tmp/ref-read-help.txt

if [ -x "$TARGET/Tools/node_modules/.bin/tsc" ]; then
  "$TARGET/Tools/node_modules/.bin/tsc" -p "$TARGET/Tools/tsconfig.json" --noEmit
else
  echo "INFO TypeScript binary missing after bun install; skip local typecheck"
fi

echo "Ref verification passed"
```
