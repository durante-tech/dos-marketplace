# iOSStarter v0.1.0 — Verification

Run these checks after `INSTALL.md` Phase 4 completes.

## Required files

```bash
CLAUDE_DIR="$HOME/.claude"

test -f "$CLAUDE_DIR/skills/ios-starter/SKILL.md" && echo "OK SKILL.md" || echo "FAIL SKILL.md missing"
test -f "$CLAUDE_DIR/skills/ios-starter/extension.yaml" && echo "OK extension.yaml" || echo "FAIL extension.yaml missing"
test -d "$CLAUDE_DIR/skills/ios-starter/Workflows" && echo "OK Workflows/" || echo "FAIL Workflows/ missing"
```

## Skill discovery

The skill should be discoverable via Claude Code's skill registry:

```bash
ls "$CLAUDE_DIR/skills/" | grep iOSStarter
```

## Frontmatter parse

```bash
head -20 "$CLAUDE_DIR/skills/ios-starter/SKILL.md"
```

Expected: YAML frontmatter with `name: iOSStarter`, `version: 0.1.0`,
`platform: claude-code`.

## Source repo presence (recommended, not required)

```bash
test -d ~/Developer/dos-ios-starter && echo "OK source repo present" || echo "INFO source repo not cloned (clone with: git clone https://github.com/durante-tech/dos-ios-starter ~/Developer/dos-ios-starter)"
```

## Toolchain presence (recommended)

```bash
command -v tuist >/dev/null 2>&1 && echo "OK tuist on PATH" || echo "INFO tuist missing (brew install tuist)"
command -v xcodebuild >/dev/null 2>&1 && echo "OK xcodebuild on PATH" || echo "INFO xcodebuild missing (install Xcode)"
```

## Pass/fail summary

All `OK` → installation successful.
Any `FAIL` → re-run INSTALL.md Phase 4.
