# SocialMedia Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Authentication checks are informational — Login.ts can be run later.

---

## File Verification

### Check SKILL.md files exist

```bash
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

[ -f "$TARGET/SKILL.md" ] && echo "OK SocialMedia SKILL.md" || echo "MISSING SocialMedia SKILL.md"
[ -f "$TARGET/Facebook/SKILL.md" ] && echo "OK Facebook SKILL.md" || echo "MISSING Facebook SKILL.md"
[ -f "$TARGET/Instagram/SKILL.md" ] && echo "OK Instagram SKILL.md" || echo "MISSING Instagram SKILL.md"
```

**Expected:** All three SKILL.md files present.

### Check shared Lib

```bash
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

for f in env.ts cli.ts graph.ts; do
  [ -f "$TARGET/Lib/$f" ] && echo "OK Lib/$f" || echo "MISSING Lib/$f"
done
```

**Expected:** All three Lib files present.

### Check Facebook tools

```bash
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

for f in Login.ts Publish.ts Fetch.ts package.json tsconfig.json; do
  [ -f "$TARGET/Facebook/Tools/$f" ] && echo "OK Facebook/Tools/$f" || echo "MISSING Facebook/Tools/$f"
done
```

**Expected:** All five files present.

### Check Instagram tools

```bash
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

for f in Publish.ts Fetch.ts package.json tsconfig.json; do
  [ -f "$TARGET/Instagram/Tools/$f" ] && echo "OK Instagram/Tools/$f" || echo "MISSING Instagram/Tools/$f"
done
```

**Expected:** All four files present.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

for skill_file in \
  "$TARGET/SKILL.md" \
  "$TARGET/Facebook/SKILL.md" \
  "$TARGET/Instagram/SKILL.md"; do
  if [ -f "$skill_file" ]; then
    basename_dir=$(echo "$skill_file" | sed "s|$TARGET/||")
    head -1 "$skill_file" | grep -q "^---" && echo "OK $basename_dir frontmatter" || echo "ERROR $basename_dir missing frontmatter"
    grep -q "^name:" "$skill_file" && echo "OK $basename_dir has name field" || echo "ERROR $basename_dir missing name field"
    grep -q "^description:" "$skill_file" && echo "OK $basename_dir has description" || echo "ERROR $basename_dir missing description"
  fi
done
```

**Expected:** All three SKILL.md files have valid YAML frontmatter with name and description fields.

### Check Graph API version is pinned

```bash
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

grep -q 'GRAPH_VERSION = "v24.0"' "$TARGET/Lib/graph.ts" \
  && echo "OK Graph API v24.0 pinned" \
  || echo "ERROR Graph API version mismatch"
```

**Expected:** `GRAPH_VERSION = "v24.0"` present in Lib/graph.ts.

### Check shebangs on tools

```bash
CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

for tool in \
  "$TARGET/Facebook/Tools/Login.ts" \
  "$TARGET/Facebook/Tools/Publish.ts" \
  "$TARGET/Facebook/Tools/Fetch.ts" \
  "$TARGET/Instagram/Tools/Publish.ts" \
  "$TARGET/Instagram/Tools/Fetch.ts"; do
  if [ -f "$tool" ]; then
    head -1 "$tool" | grep -q "^#!/usr/bin/env bun" && echo "OK $(basename $tool) shebang" || echo "WARN $(basename $tool) missing shebang"
  fi
done
```

**Expected:** All five tools start with `#!/usr/bin/env bun`.

---

## Dependency Checks (Informational)

```bash
echo "Dependencies:"

if command -v bun &>/dev/null; then
  echo "  AVAILABLE bun $(bun --version)"
else
  echo "  UNAVAILABLE bun (install: curl -fsSL https://bun.sh/install | bash)"
fi

CLAUDE_DIR="$HOME/.claude"
TARGET="$CLAUDE_DIR/skills/SocialMedia"

if [ -d "$TARGET/Facebook/Tools/node_modules" ]; then
  echo "  AVAILABLE Facebook/Tools @types/bun installed"
else
  echo "  UNAVAILABLE Facebook/Tools @types/bun (run: cd $TARGET/Facebook/Tools && bun install)"
fi

if [ -d "$TARGET/Instagram/Tools/node_modules" ]; then
  echo "  AVAILABLE Instagram/Tools @types/bun installed"
else
  echo "  UNAVAILABLE Instagram/Tools @types/bun (run: cd $TARGET/Instagram/Tools && bun install)"
fi
```

---

## Authentication Checks (Informational)

```bash
CLAUDE_DIR="$HOME/.claude"

if [ -f "$CLAUDE_DIR/.env" ]; then
  if grep -q "^FACEBOOK_PAGE_TOKEN=" "$CLAUDE_DIR/.env"; then
    echo "  AVAILABLE FACEBOOK_PAGE_TOKEN (Login.ts has run)"
  else
    echo "  INFO FACEBOOK_PAGE_TOKEN not set — run Login.ts to authenticate"
  fi
  if grep -q "^FACEBOOK_IG_USER_ID=" "$CLAUDE_DIR/.env"; then
    echo "  AVAILABLE FACEBOOK_IG_USER_ID (Instagram tools enabled)"
  else
    echo "  INFO FACEBOOK_IG_USER_ID not set — Instagram tools will not work"
  fi
else
  echo "  INFO ~/.claude/.env does not exist — Login.ts will create it"
fi
```

---

## Functional Tests (Manual)

Mark each as complete once user has tested:

```markdown
### Files
- [ ] SocialMedia SKILL.md installed at ~/.claude/skills/social-media/SKILL.md
- [ ] Facebook SKILL.md installed
- [ ] Instagram SKILL.md installed
- [ ] All SKILL.md files have valid YAML frontmatter
- [ ] Lib/env.ts, Lib/cli.ts, Lib/graph.ts all present
- [ ] Facebook/Tools/ contains Login.ts, Publish.ts, Fetch.ts, package.json, tsconfig.json
- [ ] Instagram/Tools/ contains Publish.ts, Fetch.ts, package.json, tsconfig.json
- [ ] GRAPH_VERSION = "v24.0" present in Lib/graph.ts

### Dependencies
- [ ] bun runtime available
- [ ] @types/bun installed in Facebook/Tools (node_modules present)
- [ ] @types/bun installed in Instagram/Tools (node_modules present)

### Help Text Smoke Test
- [ ] bun Facebook/Tools/Login.ts --help (exits 0)
- [ ] bun Facebook/Tools/Publish.ts --help (exits 0)
- [ ] bun Facebook/Tools/Fetch.ts --help (exits 0)
- [ ] bun Instagram/Tools/Publish.ts --help (exits 0)
- [ ] bun Instagram/Tools/Fetch.ts --help (exits 0)

### Authentication (optional, after Meta app created)
- [ ] Login.ts opens the OAuth dialog and accepts the pasted redirect URL
- [ ] Long-lived Page token written to ~/.claude/.env (chmod 600)
- [ ] FACEBOOK_IG_USER_ID written if Page has linked IG Business

### End-to-end (optional)
- [ ] Facebook Publish.ts creates a real post on an authorized test Page
- [ ] Facebook Fetch.ts --type insights returns data
- [ ] Instagram Publish.ts succeeds with a public test image URL
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "social-media skill installation verified successfully"
2. **Recommend:** "Run Login.ts with your Meta app credentials to complete authentication"
3. **Note:** "Credentials are stored in ~/.claude/.env with chmod 600 — never committed to git"
