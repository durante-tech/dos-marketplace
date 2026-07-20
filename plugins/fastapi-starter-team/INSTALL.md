# FastAPIStarterTeam v0.5.0 — Installation Guide

**This guide is designed for AI agents installing this pack into a user's infrastructure.**

---

## AI Agent Instructions

**This is a wizard-style installation.** Use Claude Code's native tools to guide the user through installation:

1. **AskUserQuestion** — for user decisions and confirmations
2. **TodoWrite** — for progress tracking
3. **Bash/Read/Write** — for actual installation
4. **VERIFY.md** — for final validation

### Welcome Message

Before starting, greet the user:

```
"I'm installing FastAPIStarterTeam v0.5.0 — Orchestrates a 13-agent delivery team (PM, SM, API DX, Schema, Architect, Agent Engineer, Backend, DB, Security, QA, E2E, DevOps, Writer) for the dos-fastapi-starter Python API framework.

This pack installs ~30 files across 3 directories.

Let me analyze your system and guide you through installation."
```

---

## Phase 1: System Analysis

**Execute this analysis BEFORE any file operations.**

### 1.1 Run These Commands

```bash
CLAUDE_DIR="$HOME/.claude"
echo "Claude directory: $CLAUDE_DIR"

if [ -d "$CLAUDE_DIR/skills/FastAPIStarterTeam" ]; then
  echo "WARNING Existing fastapi-starter-team skill found at: $CLAUDE_DIR/skills/FastAPIStarterTeam"
  ls -la "$CLAUDE_DIR/skills/fastapi-starter-team/" 2>/dev/null
else
  echo "OK No existing fastapi-starter-team skill (clean install)"
fi

if [ -d "$CLAUDE_DIR/skills/FastAPIStarter" ]; then
  echo "INFO Legacy FastAPIStarter skill found — will not be modified, but you may want to remove it after verifying FastAPIStarterTeam"
fi

if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "OK Skills directory exists at: $CLAUDE_DIR/skills"
else
  echo "INFO Skills directory does not exist (will be created)"
fi

if command -v bun &> /dev/null; then
  echo "OK Bun runtime available: $(bun --version)"
else
  echo "WARNING Bun runtime not found (install: curl -fsSL https://bun.sh/install | bash)"
fi

if command -v uv &> /dev/null; then
  echo "OK uv runtime available: $(uv --version)"
else
  echo "WARNING uv runtime not found — required for the dos-fastapi-starter MCP server (install: curl -LsSf https://astral.sh/uv/install.sh | sh)"
fi
```

### 1.2 Present Findings

Tell the user what you found, including the legacy `FastAPIStarter` notice if present.

---

## Phase 2: User Questions

### Question 1: Conflict Resolution (only if existing skill found)

```json
{
  "header": "Conflict",
  "question": "An existing fastapi-starter-team skill was found. How should I proceed?",
  "multiSelect": false,
  "options": [
    {"label": "Backup and Replace (Recommended)", "description": "Creates timestamped backup, then installs new version"},
    {"label": "Replace Without Backup", "description": "Overwrites existing skill"},
    {"label": "Abort Installation", "description": "Cancel installation, keep existing skill"}
  ]
}
```

### Question 2: Final Confirmation

```json
{
  "header": "Install",
  "question": "Ready to install FastAPIStarterTeam v0.5.0?",
  "multiSelect": false,
  "options": [
    {"label": "Yes, install now (Recommended)", "description": "Copies skill files to ~/.claude/skills/fastapi-starter-team/"},
    {"label": "Show me what will change", "description": "Lists all files and directories that will be created"},
    {"label": "Cancel", "description": "Abort installation"}
  ]
}
```

---

## Phase 3: Backup (If Needed)

**Only execute if user chose "Backup and Replace":**

```bash
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/Backups/fastapistarterteam-skill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
[ -d "$CLAUDE_DIR/skills/FastAPIStarterTeam" ] && cp -r "$CLAUDE_DIR/skills/FastAPIStarterTeam" "$BACKUP_DIR/FastAPIStarterTeam"
echo "Backup created at: $BACKUP_DIR"
```

---

## Phase 4: Installation

### 4.1 Create Skill Directory Structure

```bash
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR/skills/FastAPIStarterTeam"
mkdir -p "$CLAUDE_DIR/skills/fastapi-starter-team/Data"
mkdir -p "$CLAUDE_DIR/skills/fastapi-starter-team/Tools"
mkdir -p "$CLAUDE_DIR/skills/fastapi-starter-team/Workflows"
echo "Created fastapi-starter-team skill directory structure"
```

### 4.2 Copy Skill Files

```bash
PACK_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"
DEST="$CLAUDE_DIR/skills/FastAPIStarterTeam"

cp "$PACK_DIR/src/SKILL.md"             "$DEST/SKILL.md"
cp "$PACK_DIR/src/SKILL.partials.md"    "$DEST/SKILL.partials.md"
cp "$PACK_DIR/src/CHANGELOG.md"         "$DEST/CHANGELOG.md"
cp "$PACK_DIR/src/FrameworkDigest.md"   "$DEST/FrameworkDigest.md"
cp "$PACK_DIR/src/extension.yaml"       "$DEST/extension.yaml"

cp "$PACK_DIR/src/Data/Roster.json"     "$DEST/Data/Roster.json"
cp "$PACK_DIR/src/Data/McpToolMap.json" "$DEST/Data/McpToolMap.json"

cp "$PACK_DIR/src/Tools/"*.ts           "$DEST/Tools/"

cp "$PACK_DIR/src/Workflows/"*.md       "$DEST/Workflows/"

echo "Copied FastAPIStarterTeam files"
ls -la "$DEST" "$DEST/Data" "$DEST/Tools" "$DEST/Workflows"
```

### 4.3 Install Tool Dependencies (if applicable)

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/fastapi-starter-team/Tools/package.json" ]; then
  cd "$CLAUDE_DIR/skills/fastapi-starter-team/Tools" && bun install
  echo "Tool dependencies installed"
fi
```

---

## Phase 5: Verification

**Execute all checks from VERIFY.md.**

---

## Success/Failure Messages

### On Success

```
"FastAPIStarterTeam v0.5.0 installed successfully.

What's available:
- BugFix, CodeReview, DeliverFeature, DesignReview, DocsRefresh
- ExecuteOpenTodos, ExploreFeature, QuickFix, Refactor
- ReviewOpenPRs, ReviewSinglePR, SecurityAudit, ShowRoster, TestAndValidate

To wire the starter's MCP server (recommended), add to your project .mcp.json:
{
  \"mcpServers\": {
    \"dos-fastapi\": {
      \"command\": \"uv\",
      \"args\": [\"run\", \"--directory\", \"~/Developer/dos-fastapi-starter/tooling/mcp_server\", \"python\", \"-m\", \"dos_fastapi_mcp\"]
    }
  }
}

Customization: Add your own overrides at:
  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/FastAPIStarterTeam/"
```

### On Failure

```
"Installation encountered issues. Here's what to check:
1. Ensure ~/.claude/ directory exists
2. Check write permissions on ~/.claude/skills/
3. Run the verification commands in VERIFY.md
Need help? Open an issue at https://github.com/durante-tech/dos/issues"
```

---

## What's Included

- `src/SKILL.md`
- `src/SKILL.partials.md`
- `src/CHANGELOG.md`
- `src/FrameworkDigest.md`
- `src/extension.yaml`
- `src/Data/Roster.json`
- `src/Data/McpToolMap.json`
- `src/Tools/BuildBrief.ts`
- `src/Tools/InvokeAgent.ts`
- `src/Tools/ParsePrTodos.ts`
- `src/Tools/ClassifyPrShape.ts`
- `src/Tools/RenderTodoComment.ts`
- `src/Tools/_shared.ts`
- `src/Workflows/BugFix.md`
- `src/Workflows/CodeReview.md`
- `src/Workflows/DeliverFeature.md`
- `src/Workflows/DesignReview.md`
- `src/Workflows/DocsRefresh.md`
- `src/Workflows/ExecuteOpenTodos.md`
- `src/Workflows/ExploreFeature.md`
- `src/Workflows/QuickFix.md`
- `src/Workflows/Refactor.md`
- `src/Workflows/ReviewOpenPRs.md`
- `src/Workflows/ReviewSinglePR.md`
- `src/Workflows/SecurityAudit.md`
- `src/Workflows/ShowRoster.md`
- `src/Workflows/TestAndValidate.md`
- `src/Workflows/_test-pyramid-gate.md` (shared partial)
- `src/Workflows/_algorithm-team-spawn.md` (shared partial)
- `src/Workflows/_commit-merge.md` (shared partial)
- `src/Workflows/_github-collaboration.md` (shared partial)
- `src/Workflows/_pr-loop-shared.md` (shared partial)
- `plugin.json` — RFC-0011 §5.2 distribution manifest
