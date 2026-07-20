# iOSStarter v0.1.0 — Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

Mirrors the wizard-style pattern from `makerkit-team` and the sibling
`FastAPIStarter`. Currently a TODO scaffold — flesh out before publishing.

---

## Phase 1: System Analysis

```bash
CLAUDE_DIR="$HOME/.claude"

if [ -d "$CLAUDE_DIR/skills/iOSStarter" ]; then
  echo "WARNING Existing ios-starter skill found at: $CLAUDE_DIR/skills/iOSStarter"
  ls -la "$CLAUDE_DIR/skills/ios-starter/" 2>/dev/null
else
  echo "OK No existing ios-starter skill (clean install)"
fi

if command -v tuist &> /dev/null; then
  echo "OK tuist available: $(tuist version)"
else
  echo "WARNING tuist not found (install: brew install tuist)"
fi

if command -v xcodebuild &> /dev/null; then
  echo "OK xcodebuild available: $(xcodebuild -version | head -1)"
else
  echo "WARNING xcodebuild not found (install Xcode from the App Store)"
fi

if command -v swift-openapi-generator &> /dev/null; then
  echo "OK swift-openapi-generator available"
else
  echo "INFO swift-openapi-generator not yet installed (install when wiring a backend spec: brew install swift-openapi-generator)"
fi
```

## Phase 2: User Questions

TODO — pattern from `MakerkitTeam/INSTALL.md` Phase 2 (conflict resolution +
final confirmation).

## Phase 3: Backup

TODO.

## Phase 4: Installation

```bash
CLAUDE_DIR="$HOME/.claude"
PACK_DIR="$(pwd)"
mkdir -p "$CLAUDE_DIR/skills/iOSStarter"
mkdir -p "$CLAUDE_DIR/skills/ios-starter/Workflows"

cp "$PACK_DIR/src/SKILL.md" "$CLAUDE_DIR/skills/ios-starter/SKILL.md"
cp "$PACK_DIR/src/extension.yaml" "$CLAUDE_DIR/skills/ios-starter/extension.yaml"

echo "Copied iOSStarter scaffold (workflows TBD)"
```

## Phase 5: Verification

See `VERIFY.md`.

---

## What's Included (v0.1.0 scaffold)

- `src/SKILL.md` — entry card with frontmatter
- `src/extension.yaml` — extension manifest
- `plugin.json` — RFC-0011 §5.2 distribution manifest
- `INSTALL.md` — this file
- `VERIFY.md` — verification checks
- `README.md` — pack overview

Workflows directory is empty in v0.1.0 — to be populated in v0.2.0+.
