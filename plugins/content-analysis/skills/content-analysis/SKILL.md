---
name: ContentAnalysis
description: Content extraction and analysis — wisdom extraction from videos, podcasts, articles, and YouTube. USE WHEN extract wisdom, content analysis, analyze content, insight report, analyze video, analyze podcast, extract insights, key takeaways, what did I miss, extract from YouTube.
role: extractor
accepts:
  - text
icon: FileText
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Content
displayLabel: Content Analysis
marketingDescription: Wisdom extraction from videos, podcasts, articles
elevator: Extract wisdom from any content source
highlightWorkflows:
  - name: Wisdom Extraction
    technicalName: ExtractWisdom
  - name: Analyze Content
    technicalName: AnalyzeContent
  - name: Insight Report
    technicalName: InsightReport
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# ContentAnalysis

Content extraction and analysis -- wisdom extraction from videos, podcasts, articles, and YouTube with dynamic section generation.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ContentAnalysis/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Sub-Component Routing

**Sub-component routing:** references to `<Sub>/SKILL.md` in this skill are FILE PATHS relative to this skill's directory — load them with the Read tool and follow their instructions. Sub-components (ExtractWisdom/) are NOT separately registered skills: never invoke `Skill("content-analysis:<Component>")` — it fails with "Unknown skill".

## Sub-Skill Routing

| Sub-Skill | Trigger | Route |
|-----------|---------|-------|
| ExtractWisdom | Extract wisdom, content analysis, insight report, analyze content, key takeaways, analyze video, analyze podcast, extract from YouTube | `ExtractWisdom/SKILL.md` |

## Examples

**Example 1: Extract wisdom from a YouTube video**
```
User: "extract wisdom from https://youtube.com/watch?v=..."
-> Routes to ExtractWisdom/Extract
-> Fetches transcript, detects wisdom domains, builds dynamic sections
-> Produces Level 3 conversational insight report
```

**Example 2: Quick analysis of a podcast**
```
User: "extract wisdom (fast) from this podcast transcript"
-> Routes to ExtractWisdom/Extract at Fast depth
-> 3 sections, 3 bullets each, no closing sections
```

**Example 3: Comprehensive deep dive**
```
User: "extract wisdom at comprehensive level from this interview"
-> Routes to ExtractWisdom/Extract at Comprehensive depth
-> 10-15 sections, Themes & Connections, full closing sections
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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"ContentAnalysis","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/content-analysis/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/content-analysis/` — active release submodule (versioned)
3. `Packs/*/src/ContentAnalysis/` — pack source (distributable)
4. `Packs/agents/ContentAnalysis/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
