---
name: SessionAutopsy
description: Cadenced 5-agent council audit over a rolling 7-day window — files findings, diffs prior audits, surfaces recurring patterns. USE WHEN session autopsy, cadenced audit, audit routine, council audit, post-mortem, retrospective, recurring patterns, weekly review, biweekly review, RFC-0024 audit, capability utilization.
role: analyzer
accepts:
  - text
icon: ScanSearch
colorVar: secondary
colorHex: "#6b6f7a"
tier: secondary
category: Engineering
displayLabel: SessionAutopsy
marketingDescription: Cadenced council-audit routine over recent sessions — surfaces patterns, diffs prior audits, files findings.
elevator: 5-agent council, rolling 7-day window, fortnightly cadence.
highlightWorkflows:
  - name: Cadenced Audit
    technicalName: CadencedAudit
roots:
  - PROJECT.WORK
  - MEMORY.WORK
visibility: beta
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/SessionAutopsy/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SessionAutopsy

RFC-0024 §5.8 cadenced council audit. A 5-agent council reviews the previous 7 days of sessions, files findings, and diffs against the most recent prior audit to surface new recurring patterns.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **CadencedAudit** | "session autopsy", "council audit", "weekly review" | `Routines/cadenced-audit.md` |

## Examples

**Example 1: Scheduled cadence**
```
Cron fires every 14 days at 9am → bun src/Tools/run-audit.ts → spawn-plan written
→ orchestrating skill session reads plan, spawns 5 council agents
→ findings filed at MEMORY/WORK/YYYYMMDD-council-audit-auto/findings.md
→ diff against most recent prior audit appended
```

**Example 2: Manual invocation**
```
User: "run session autopsy"
→ Routines/cadenced-audit.md drives the routine
→ 5-agent council reviews last 7 days
→ findings + diff written to MEMORY/WORK/{slug}/
```

## Components

- `src/Prompts/{reflections,session,signals-failures,work-palace,capability-utilization}.md` — per-agent prompt seeds
- `src/Routines/cadenced-audit.md` — human-facing routine doc; **documented cadence (cron `0 9 */14 * *`) is NOT currently installed** (no launchd/cron entry and no auto-registered `/schedule` job on the operator host). The pack runs in **manual-invocation mode** (`bun Tools/run-audit.ts`) until the cadence is registered at install — `INSTALL.md` Phase 4.4 now registers a `/schedule` cadence cron (`0 9 */14 * *`), degrading to a documented-manual crontab instruction where `/schedule`/cron is unavailable. A fresh install fires the "Cadenced" self-audit fortnightly without a human remembering; the operator host predates this wiring and must re-run INSTALL.md Phase 4.4 to activate it. The `visibility: beta` flag stays until the specialist-agent deploy (Copy-4) also lands.
- `src/Tools/run-audit.ts` — CLI scaffolding runner; writes spawn-plan JSON for the orchestrating session
- `src/extension.yaml` — RFC-0002 manifest declaring this pack as a routine-invoked analyzer

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"SessionAutopsy","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/session-autopsy/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/session-autopsy/` — active release submodule (versioned)
3. `Packs/*/src/SessionAutopsy/` — pack source (distributable)
4. `Packs/agents/SessionAutopsy/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
