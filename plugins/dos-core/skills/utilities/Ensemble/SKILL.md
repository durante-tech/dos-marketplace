---
disable-model-invocation: true
name: Ensemble
description: Generate a self-contained session-prompt + DAG-structured rollout-state from any DOS artifact (RFC, spec, brief, PRD), ready for a Conductor to orchestrate an inferred ensemble of named teammates via SendMessage. USE WHEN ensemble, artifact to team, delivery team, team from spec, team from rfc, conductor, ensemble plan, ensemble emit, orchestrate team, multi-teammate delivery, spec to team, brief to team, plan ensemble, emit ensemble.
role: executor
accepts:
  - file:md
  - text
icon: Users
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
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Ensemble/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Ensemble

Turn any DOS artifact (RFC, spec, brief, PRD) into a session-prompt + DAG-structured rollout-state that a Conductor session uses to orchestrate a named-teammate ensemble to delivery.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Plan** | "artifact to delivery plan, plan team, plan ensemble, extract roles and waves" | `Workflows/Plan.md` |
| **Emit** | "emit session prompt, emit rollout state, render delivery prompt, render ensemble prompt" | `Workflows/Emit.md` |

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Ensemble","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/utilities/Ensemble/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/utilities/Ensemble/` — active release submodule (versioned)
3. `Packs/*/src/Ensemble/` — pack source (distributable)
4. `Packs/agents/Ensemble/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
