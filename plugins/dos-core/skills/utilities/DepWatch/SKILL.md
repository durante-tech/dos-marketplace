---
disable-model-invocation: true
name: DepWatch
description: Surface Crunch over dependency releases, CVEs and breaking changes in a project dependency tree — enumerates Surfaces, fans out parallel extraction Threads under tight contracts, and converges findings into a 4-tier ranked report. USE WHEN dependency check, dep watch, what dependencies changed, CVE scan for my deps, security advisories for dependencies, breaking changes in dependencies, dependency upgrade check, outdated packages, npm audit crunch, dependency health, supply chain check.
role: analyzer
accepts:
  - text
roots:
  - INSTALL
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
<!-- minted-by: CrunchScaffold v0.1.0 | brief-hash: f2904c | 2026-05-20T15:02:51Z -->

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DepWatch/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# DepWatch

A **Surface Crunch** skill over dependency releases, CVEs and breaking changes in a project dependency tree. It enumerates Surfaces, fans out parallel
extraction Threads under tight Extraction Contracts, and converges their findings
into a **4-tier prioritized report** mapped to concrete Targets.

Pattern reference: `MEMORY/CANONICAL/surface-crunch-pattern.md`. This skill is a
Surface Crunch *instance* — it shares the family's ubiquitous language (Surface,
Thread, Extraction Contract, Convergence, Tier, Target).

**Bifocal mode:** `yes`. Inward Surface — the repo package.json and lockfile (the installed dependency set). Outward Surface — npm and GitHub security advisories; dependency GitHub releases and changelogs; deprecation notices.

## Workflow Routing

| Workflow | Trigger | File |
|---|---|---|
| **Survey** | "dependency check on X", "dep watch X", "what changed in my dependencies", "CVE scan" | `Workflows/Survey.md` |

## Examples

**Example 1: Full Crunch**
```
User: "Run a dependency check on the dos-prisma-saas-kit repo"
→ Invokes Survey workflow
→ Enumerates the installed dependency set, then fans out parallel extraction Threads (up to 6 per Outward Surface) across advisories, releases, and deprecations
→ Converges into a 4-tier ranked report
→ User gets prioritized, package-mapped findings — new since last run
```

**Example 2: Security-only quick crunch**
```
User: "DepWatch — CVEs only on this repo"
→ Runs only the advisory Outward Threads (skips releases, changelogs, deprecations)
→ Converges into just the 🔴 CRITICAL tier
→ User gets a fast security-exposure list — advisories new since the last run
```

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"DepWatch","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/utilities/DepWatch/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/utilities/DepWatch/` — active release submodule (versioned)
3. `Packs/*/src/DepWatch/` — pack source (distributable)
4. `Packs/agents/DepWatch/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
