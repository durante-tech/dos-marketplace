---
name: FeatureDelivery
description: Stack-agnostic feature delivery pipeline — classification tiers, structured specs, council decision gates, multi-perspective review, ship automation. For kit-scaffolded repos prefer MakerkitTeam (Prisma SaaS Kit) or FastAPIStarterTeam (dos-fastapi-starter) which carry stack-specific roster awareness; this skill is the fallback for repos with no matching kit-team. USE WHEN user wants to build a feature end-to-end in a non-kit-scaffolded repo, deliver a feature without a stack-specific team, classify feature complexity, generate implementation spec, council review, code review, commit and PR. NOT for kit-scaffolded repos — use MakerkitTeam (Prisma SaaS kit) or FastAPIStarterTeam (dos-fastapi-starter); this is the non-kit fallback.
role: analyzer
accepts:
  - text
icon: GitBranch
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Engineering
displayLabel: Feature Delivery
marketingDescription: Feature pipeline with complexity tiers and council gates
elevator: Feature pipeline with council decision gates
highlightWorkflows:
  - name: Classify Feature
    technicalName: ClassifyFeature
  - name: Spec Build
    technicalName: SpecBuild
  - name: Ship Feature
    technicalName: ShipFeature
roots:
  - PROJECT.WORK
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# Feature Delivery

Interactive feature delivery pipeline that enriches the development workflow with classification, structured specs, council decision gates, review, and ship automation.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/FeatureDelivery/`

If this directory exists, load and apply:
- `PREFERENCES.md` - User preferences and configuration
- Additional files specific to the skill

These define user-specific preferences. If the directory does not exist, proceed with skill defaults.

## Tools

| Tool | Purpose |
|------|---------|
| Agent tool | Council gates (architect, engineer, designer, pentester perspectives) |
| Bash | Git operations, project analysis, build/test commands |
| Read | Analyze project structure, read changed files |
| Edit/Write | Generate specs, update files |
| Grep/Glob | Search codebase for patterns and conventions |

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Classify** | "build a feature", "deliver a feature", "classify this feature" | `Workflows/Classify.md` |
| **Spec** | "spec this feature", "write a spec", "implementation plan" | `Workflows/Spec.md` |
| **CouncilGate** | "council review", "council gate", "should we proceed" | `Workflows/CouncilGate.md` |
| **Review** | "review the code", "code review" | `Workflows/Review.md` |
| **Ship** | "ship it", "commit and PR", "push and PR" | `Workflows/Ship.md` |

## Tier Behavior

| Tier | Worktree | Spec | Council Gates | Review |
|------|----------|------|---------------|--------|
| Simple | No | No | None | Quick |
| Medium | Yes | Yes | Quick (1 round) at plan | Standard |
| Complex | Yes | Yes | Full debate (3 rounds) at plan + review | Thorough |

## Pipeline Phases

For full feature delivery, the pipeline proceeds through these phases:

```
1. CLASSIFY  →  Assess complexity tier
2. SPEC      →  Generate implementation plan (medium/complex only)
3. PLAN GATE →  Council debate on plan (medium/complex only)
4. BUILD     →  Implement the feature
5. REVIEW    →  Multi-perspective code review
6. SHIP GATE →  Council review before ship (complex only)
7. SHIP      →  Commit, push, PR
```

## Prerequisites

- Git repository with remote origin
- `gh` CLI installed (for PR creation)
- Project detected (for worktree isolation)

## Examples

**Example 1: Simple feature**
```
User: "Add a loading spinner to the dashboard page"
Route: Workflows/Classify.md → tier: simple → skip spec/council → build → quick review → Workflows/Ship.md
Action: Single file change, no spec needed, quick review, commit and PR
```

**Example 2: Medium feature**
```
User: "Build a notification preferences page"
Route: Workflows/Classify.md → tier: medium → Workflows/Spec.md → quick council → build → standard review → Workflows/Ship.md
Action: Multi-file change, spec generated, 1-round council at plan gate, standard 10-point review, ship
```

**Example 3: Complex feature**
```
User: "Implement RBAC with role-based permissions across all API routes"
Route: Workflows/Classify.md → tier: complex → Workflows/Spec.md → Workflows/CouncilGate.md (full debate) → build → Workflows/Review.md (thorough) → Workflows/CouncilGate.md (review gate) → Workflows/Ship.md
Action: Schema changes, multi-package, auth-sensitive — full spec, 3-round council debate at plan and review, thorough 10-point review with pentester, comprehensive PR
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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"FeatureDelivery","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/feature-delivery/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/feature-delivery/` — active release submodule (versioned)
3. `Packs/*/src/FeatureDelivery/` — pack source (distributable)
4. `Packs/agents/FeatureDelivery/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
