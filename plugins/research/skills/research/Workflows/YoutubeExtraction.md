---
name: YouTube Analysis
description: Transcript extraction, metadata analysis, and wisdom mining from YouTube videos
status: STABLE
featured: true
successRate: 97.5
icon: Film
bestPath:
  - title: "URL Extraction"
    description: "Validate YouTube URL and extract video metadata and identifiers."
  - title: "Transcript Processing"
    description: "Retrieve and clean transcript with timestamp alignment."
  - title: "Wisdom Mining"
    description: "Extract key insights, quotes, and actionable takeaways from content."
  - title: "Structured Output"
    description: "Format findings into structured report with depth-calibrated sections."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
---

# YouTube Extraction Workflow

## When to Use

- User provides a YouTube URL for content extraction/analysis
- Transcript-based processing through Fabric patterns (-y + -p)
- Downstream analysis chains to ExtractAlpha or ExtractKnowledge


Extract content from YouTube videos using Fabric CLI. Automatically downloads, transcribes, and processes video content with optional pattern application for analysis and summarization.

## 🎯 Load Full DOS Context

**Before starting any task with this skill, load complete DOS context:**

`read ~/.claude/DOS/SKILL.md`

This provides access to:
- Complete contact list (Angela, Bunny, Saša, Greg, team members)
- Stack preferences (TypeScript>Python, bun>npm, uv>pip)
- Security rules and repository safety protocols
- Response format requirements (structured emoji format)
- Voice IDs for agent routing (ElevenLabs)
- Personal preferences and operating instructions

## When to Activate This Skill
- Extract content from YouTube video
- Get YouTube transcript
- Analyze YouTube video
- Summarize YouTube content
- Process YouTube video text

## The Command

Extract content from any YouTube video:

```bash
fabric -y "YOUTUBE_URL"
```

## With Pattern Processing

Process extracted content through Fabric pattern:

```bash
fabric -y "YOUTUBE_URL" -p extract_wisdom
```

## Critical Facts

- **NEVER** use yt-dlp or youtube-dl
- **NEVER** use web scraping for YouTube
- **NEVER** use transcription APIs directly
- **Fabric handles everything**: Download, transcription, extraction automatically
- **Output**: Clean text content from video

## Common Patterns

- `extract_wisdom` - Extract key insights
- `summarize` - Create concise summary
- `extract_main_idea` - Get core message
- `create_summary` - Detailed summary

## Example Usage

```bash
# Extract raw content
fabric -y "https://www.youtube.com/watch?v=VIDEO_ID"

# Extract wisdom
fabric -y "https://www.youtube.com/watch?v=VIDEO_ID" -p extract_wisdom

# Summarize video
fabric -y "https://www.youtube.com/watch?v=VIDEO_ID" -p summarize
```

## How It Works
1. Fabric downloads video
2. Fabric extracts audio
3. Fabric transcribes audio
4. Fabric returns clean text
5. If pattern specified, processes through pattern

## Save Research Report (MANDATORY)

**Persist findings to disk so the research counter tracks it.**

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write report to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_youtube-{video-slug}.md`

```markdown
---
mode: youtube-extraction
date: {YYYY-MM-DD}
topic: {video_title}
url: {youtube_url}
pattern: {fabric_pattern_used or "raw"}
---

# YouTube Extraction — {Video Title}

## Source
{YouTube URL}

## Pattern Applied
{Pattern name or "Raw extraction"}

## Key Content
[Summary of extracted content or pattern output]
```

## Supplementary Resources
For Fabric patterns: `Workflows/Fabric.md` (242+ patterns; `fabric --listpatterns` for the live inventory).

## Intent-to-Flag Mapping

This workflow shells one third-party CLI that carries an operator-variable flag: `fabric -y "<URL>"` performs the YouTube extraction, and its `-p <pattern>` flag selects the Fabric processing pattern by user intent. `-y "URL"` is fixed (it is what makes this the YouTube path); `-p` is the only intent-mapped lever (patterns enumerated under "Common Patterns").

CLI: `fabric -y "<YOUTUBE_URL>"`

| User Intent | Flag Combination |
|-------------|------------------|
| Raw transcript / clean text (default) | `fabric -y "URL"` (no `-p`) |
| Key insights / takeaways | `fabric -y "URL" -p extract_wisdom` |
| Concise summary | `fabric -y "URL" -p summarize` |
| Core message only | `fabric -y "URL" -p extract_main_idea` |
| Detailed summary | `fabric -y "URL" -p create_summary` |

The other CLI invoked here — `bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir` — is deterministic pack plumbing: it resolves the project-level RESEARCH directory, its subcommand is fixed by the workflow step, and it exposes no operator-variable flags, so it has no intent→flag mapping.