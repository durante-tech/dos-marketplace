---
disable-model-invocation: true
name: RfcToLoop
description: Generate a self-contained /loop prompt + pre-committed PRD stub from any RFC slice, so a fresh Claude Code session can paste the block and deliver end-to-end. USE WHEN rfc to loop, rfc-to-loop, generate loop prompt, rfc delivery prompt, rfc slice, next rfc slice, prepare rfc session, pack rfc for loop, ship rfc slice, rfc loop block.
role: executor
accepts:
  - text
icon: Waypoints
tier: secondary
category: Engineering
roots: []
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - memory.read
  - memory.write
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/RfcToLoop/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# RfcToLoop

Turn any RFC slice into a self-contained `/loop` prompt plus a pre-committed PRD stub. Paste the emitted block into a fresh Claude Code session and the Algorithm delivers the slice end-to-end — no tribal knowledge required.

Encapsulates the pattern proven across RFC-0007 §10.3 and RFC-0011 rollouts: RFC → slice extraction → ISC derivation → constitutional rails → completion gates → reflection JSONL.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Generate** | "rfc to loop, rfc slice to loop prompt, pack rfc for delivery, next rfc slice" | `Workflows/Generate.md` |

## Quick Reference

```bash
bun ~/Durante/Packs/utilities/src/RfcToLoop/Tools/GeneratePrompt.ts \
  --rfc <name-or-id> \
  [--slice <heading-fragment-or-phase-id>] \
  [--effort standard|extended|advanced|deep|xhigh|comprehensive] \
  [--out <work-dir>] \
  [--dry-run]
```

- **--rfc**: fuzzy resolves against `Plans/Specs/RFC-*.md` (filename → prefix → title substring).
- **--slice**: optional heading fragment; omit to auto-pick the first unfinished section.
- **--out**: defaults to `$CLAUDE_PROJECT_DIR/MEMORY/WORK/` (falls back to cwd, then `~/.claude`).
- **--dry-run**: emit the prompt to stdout without writing PRD.md / PROMPT.md.

## Emitted Artifacts

- **stdout** — the complete `/loop` block (RFC slice inlined, ISC checklist, four-copy + sync-check rails, completion gates, reflection JSONL command).
- **`<out>/{slug}/PRD.md`** — frontmatter-only stub (`phase: observe`, `progress: 0/N`).
- **`<out>/{slug}/PROMPT.md`** — the emitted block saved for reference.

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"RfcToLoop","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/utilities/RfcToLoop/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/utilities/RfcToLoop/` — active release submodule (versioned)
3. `Packs/*/src/RfcToLoop/` — pack source (distributable)
4. `Packs/agents/RfcToLoop/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
