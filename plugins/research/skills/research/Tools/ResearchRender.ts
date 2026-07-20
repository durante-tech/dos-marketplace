#!/usr/bin/env bun
/**
 * ResearchRender - pure markdown/JSONL render helpers for the research pack.
 *
 * This module owns the deterministic render templates that were previously
 * hand-typed as markdown skeletons and bash `printf` blocks inside the
 * Research workflows (RFC-0126 section 9 B1/B2 render-family remediation).
 * Each helper is a PURE function: structured input -> exact output bytes.
 * Relocating the templates here gives one golden-tested owner instead of N
 * drifting hand-typed copies.
 *
 * Precedent: Sentinel's renderDuranteNative() in SentinelScan.ts - a pure
 * exported render function returning a template literal, fronted by a CLI
 * subcommand.
 *
 * SUBCOMMANDS
 * -----------
 *   log-artifact <json>
 *     Read an ArtifactEntryInput JSON object and print the canonical
 *     artifacts.jsonl line (no trailing newline). Replaces the per-workflow
 *     printf '{...}' >> artifacts.jsonl bash blocks.
 *
 *   render-report <json>
 *     Read a ResearchReportInput JSON object and print the markdown research
 *     report (quick / standard / extensive / interview / ai-trends / docs /
 *     extract-knowledge modes). Replaces the inline markdown skeletons.
 *
 * USAGE
 * -----
 *   bun ResearchRender.ts log-artifact '{"workflow":"QuickResearch",...}'
 *   bun ResearchRender.ts render-report '{"mode":"standard",...}'
 *
 * EXIT CODES
 * ----------
 *   0  success
 *   1  CLI usage error (unknown subcommand) or malformed JSON
 */

// ---------------------------------------------------------------------------
// Artifact JSONL line (shared by Quick / Standard / Extensive / DeepInvestigation)
// ---------------------------------------------------------------------------

/**
 * The structured fields the artifacts.jsonl line is built from. The line shape
 * is fixed (pack is always "Research", type is always "research") so callers
 * only vary the few fields below. Key ORDER in the emitted line is load-bearing
 * - it must byte-match the prior hand-typed printf blocks.
 */
export interface ArtifactEntryInput {
  workflow: string;
  title: string;
  path: string;
  /** First ~200 chars of the file, newlines already collapsed to spaces. */
  contentPreview: string;
  /** ISO-8601 UTC timestamp (e.g. 2026-05-31T12:00:00Z). */
  timestamp: string;
  /** Defaults to "" - matches the prior bash wing:"" literal. */
  wing?: string;
  /** Defaults to "" - matches the prior bash ${DOS_SESSION_ID:-} expansion. */
  sessionId?: string;
}

/**
 * Render one artifacts.jsonl line from structured artifact fields.
 *
 * Byte-identical to the prior per-workflow bash block:
 *   printf '%s\n' "{\"pack\":\"Research\",\"workflow\":\"...\",\"type\":\"research\",
 *     \"title\":<jq -Rs>,\"path\":\"...\",\"contentPreview\":<jq -Rs>,
 *     \"wing\":\"\",\"sessionId\":\"...\",\"timestamp\":\"...\"}"
 *
 * The key order (pack, workflow, type, title, path, contentPreview, wing,
 * sessionId, timestamp) and the constant pack/type values reproduce the
 * existing line exactly. JSON.stringify escapes string values identically to
 * `jq -Rs .` for the representative inputs these blocks see (ASCII text with
 * newlines already collapsed by `tr`). Returns the line WITHOUT a trailing
 * newline; the caller appends "\n" when writing.
 */
export function logResearchArtifact(input: ArtifactEntryInput): string {
  const entry = {
    pack: "Research",
    workflow: input.workflow,
    type: "research",
    title: input.title,
    path: input.path,
    contentPreview: input.contentPreview,
    wing: input.wing ?? "",
    sessionId: input.sessionId ?? "",
    timestamp: input.timestamp,
  };
  return JSON.stringify(entry);
}

// ---------------------------------------------------------------------------
// Research report markdown skeletons
// ---------------------------------------------------------------------------

/** Common saved-report inputs shared across the markdown-report modes. */
export interface ResearchReportInput {
  mode:
    | "quick"
    | "standard"
    | "extensive"
    | "interview"
    | "ai-trends"
    | "docs"
    | "extract-knowledge";
  /** YYYY-MM-DD. */
  date: string;
  /** Body field interpolations, mode-specific (see each render branch). */
  [field: string]: string | undefined;
}

/** quick / standard / extensive / interview / ai-trends / docs / knowledge report. */
export function renderResearchReport(input: ResearchReportInput): string {
  switch (input.mode) {
    case "quick":
      return renderQuickReport(input);
    case "standard":
      return renderStandardReport(input);
    case "extensive":
      return renderExtensiveReport(input);
    case "interview":
      return renderInterviewReport(input);
    case "ai-trends":
      return renderTrendReport(input);
    case "docs":
      return renderDocsLookupReport(input);
    case "extract-knowledge":
      return renderKnowledgeReport(input);
    default:
      throw new Error(`renderResearchReport: unknown mode '${(input as { mode: string }).mode}'`);
  }
}

export function renderQuickReport(d: ResearchReportInput): string {
  return `---
mode: quick
date: ${d.date}
topic: ${d.topic}
providers: 1 (perplexity)
---

# ${d.topic} — Quick Research

## Findings
[Key findings from the perspective returned by \`Research.searchPerspectives\`]

## Sources
[Verified URLs only]
`;
}

export function renderStandardReport(d: ResearchReportInput): string {
  return `---
mode: standard
date: ${d.date}
topic: ${d.topic}
perspectives: 4 (claude, gemini, perplexity, brave)
---

# ${d.topic} — Standard Research

## Synthesis
[From result.synthesis: agree / conflicts / gaps across perspectives]

## Perspective: claude
[Key findings — anthropic backend]

## Perspective: gemini
[Key findings — google backend]

## Perspective: perplexity
[Key findings — perplexity backend with cited source URLs]

## Perspective: brave
[Key findings — brave backend with URLs from independent index]

## Sources
[Verified URLs only]
`;
}

export function renderExtensiveReport(d: ResearchReportInput): string {
  return `---
mode: extensive
date: ${d.date}
topic: ${d.topic}
perspectives: 9 (3 angle groups × 3 provider perspectives each)
---

# ${d.topic} — Extensive Research

## Executive Summary
[2-3 sentence overview]

## Key Findings by Theme
### [Theme 1]
[Findings with per-provider attribution]

### [Theme 2]
[Findings with per-provider attribution]

## Unique Insights by Provider
- **claude backend**: [analytical depth]
- **gemini backend**: [cross-domain connections]
- **grok backend**: [contrarian perspectives]

## Conflicts & Uncertainties
[Disagreements from result.synthesis.conflicts]

## Sources
[Verified URLs only]
`;
}

export function renderInterviewReport(d: ResearchReportInput): string {
  return `---
mode: interview-research
date: ${d.date}
topic: Interview Research — ${d.company_name}
agents: standard research agents
---

# Interview Research — ${d.company_name}

## Company Summary
[2-3 paragraph summary]

## Interview Questions
[All 10 Tyler Cowen-style questions with Why and Follow-up]

## Key Research Findings
[Notable discoveries about the company]

## Sources
[Verified URLs only]
`;
}

export function renderTrendReport(d: ResearchReportInput): string {
  return `---
mode: ai-trends
date: ${d.date}
topic: AI Industry Trend Analysis
agents: 1 (Gemini)
period: ${d.first_date} to ${d.latest_date}
sources: ${d.sources} news digests
---

# AI Industry Trend Analysis — ${d.date}

## Analysis Period
{First Date} to {Latest Date} ({N} sources)

## Top Trends
[Key evolving trends and trajectory]

## Emerging Winners
[Models, tools, approaches gaining momentum]

## Predictions
[Future predictions based on trend data]

## Key Insights
[3-5 most important actionable insights]
`;
}

export function renderDocsLookupReport(d: ResearchReportInput): string {
  return `---
mode: docs-lookup
date: ${d.date}
library: ${d.library}
version: ${d.version}
providers: 1 (ref.tools via Studio gateway)
credits_charged: ${d.credits_charged}
---

# ${d.library} — ${d.topic}

## Answer
{Verbatim excerpt or synthesis}

## Sources
- {Canonical docs URL #1}
- {Canonical docs URL #2}
`;
}

export function renderKnowledgeReport(d: ResearchReportInput): string {
  return `---
mode: extract-knowledge
date: ${d.date}
topic: ${d.source_title}
domain: ${d.detected_domain}
quality: ${d.rating}/10
---

# Knowledge Extraction — ${d.source_title}

## Summary
{2-3 sentence summary}

## Key Insights
{Top insights extracted}

## Signal Points
{Key signal points}

## Actionable Recommendations
{Top recommendations}
`;
}

// ---------------------------------------------------------------------------
// ExtractKnowledge console "Structure Output" skeleton
// ---------------------------------------------------------------------------

/**
 * The fixed console skeleton emitted by ExtractKnowledge Step 4. The bracketed
 * body slots (<source>, <insight 1>, ...) are filled by the agent's analysis;
 * the headings, emoji, rule lines, section order, and the two optional domain
 * blocks are the deterministic skeleton this helper pins.
 */
export function renderKnowledgeExtractionResult(): string {
  return `🎯 KNOWLEDGE EXTRACTION RESULTS
══════════════════════════════════════════════════
📍 Source: <source>
🔍 Type: <detected_type>
🎯 Domain: <detected_domain>
⭐ Quality Rating: <1-10>/10
🎯 Confidence: <1-10>/10

📋 CONTENT SUMMARY:
<2-3 sentence summary>

💡 KEY INSIGHTS:
• <insight 1>
• <insight 2>
• <insight 3>

📡 SIGNAL POINTS:
• <signal point 1>
• <signal point 2>
• <signal point 3>

⚡ ACTIONABLE RECOMMENDATIONS:
✅ <recommendation 1>
✅ <recommendation 2>
✅ <recommendation 3>

🔗 RELATED CONCEPTS:
<comma-separated list of key terms>

[Optional sections based on domain:]
🧠 EXTRACTED WISDOM: (for wisdom content)
"<key quotes and insights>"

🛠️ TECHNICAL DETAILS: (for security/research content)
• <technical detail 1>
• <technical detail 2>

══════════════════════════════════════════════════`;
}

// ---------------------------------------------------------------------------
// AnalyzeAiTrends console "comprehensive trend report" skeleton
// ---------------------------------------------------------------------------

/**
 * The fixed console skeleton emitted by AnalyzeAiTrends Step 3. The bracketed
 * body slots ([Theme 1], [Shift 1], ...) are filled by the Gemini synthesis;
 * the emoji headings and section order are the deterministic skeleton.
 */
export function renderTrendReportConsole(): string {
  return `📊 AI INDUSTRY TREND ANALYSIS

📅 Analysis Period: [First Date] to [Latest Date]
📁 Sources Analyzed: [Number] news digests

🔥 EVOLVING TRENDS
[Detailed analysis of how trends are changing over time]

🔄 RECURRING THEMES
- [Theme 1]: [Frequency and significance]
- [Theme 2]: [Frequency and significance]

📈 TRAJECTORY ANALYSIS
[Analysis of where the industry is heading]

💫 PARADIGM SHIFTS
- [Shift 1]: [What changed and when]
- [Shift 2]: [What changed and when]

⚔️ COMPETITIVE LANDSCAPE
[Analysis of competition between models, tools, companies]

⚡ INNOVATION VELOCITY
[Analysis of pace of change]

🏆 EMERGING WINNERS
- [Winner 1]: [Why they're succeeding]
- [Winner 2]: [Why they're succeeding]

📉 DECLINING AREAS
- [Area 1]: [Why it's declining]

🎯 SURPRISING PATTERNS
- [Pattern 1]: [Why it's unexpected]

🔮 FUTURE PREDICTIONS
- [Prediction 1]: [Based on which trends]
- [Prediction 2]: [Based on which trends]
- [Prediction 3]: [Based on which trends]

📌 KEY INSIGHTS
1. [Most important insight]
2. [Second most important insight]
3. [Third most important insight]

💡 ACTIONABLE RECOMMENDATIONS
- [Action 1]: [Based on trend analysis]
- [Action 2]: [Based on trend analysis]`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv: string[]): number {
  const [subcommand, ...rest] = argv;

  switch (subcommand) {
    case "log-artifact": {
      let parsed: ArtifactEntryInput;
      try {
        parsed = JSON.parse(rest[0] ?? "") as ArtifactEntryInput;
      } catch {
        process.stderr.write("ResearchRender: log-artifact requires a JSON object argument.\n");
        return 1;
      }
      process.stdout.write(logResearchArtifact(parsed) + "\n");
      return 0;
    }
    case "render-report": {
      let parsed: ResearchReportInput;
      try {
        parsed = JSON.parse(rest[0] ?? "") as ResearchReportInput;
      } catch {
        process.stderr.write("ResearchRender: render-report requires a JSON object argument.\n");
        return 1;
      }
      process.stdout.write(renderResearchReport(parsed));
      return 0;
    }
    case "trend-console": {
      // Fixed AnalyzeAiTrends Step 3 console skeleton (no interpolation).
      process.stdout.write(renderTrendReportConsole() + "\n");
      return 0;
    }
    case "knowledge-result": {
      // Fixed ExtractKnowledge Step 4 console skeleton (no interpolation).
      process.stdout.write(renderKnowledgeExtractionResult() + "\n");
      return 0;
    }
    default:
      process.stderr.write(
        `ResearchRender: unknown subcommand '${subcommand ?? ""}'.\n` +
          `Usage: bun ResearchRender.ts log-artifact <json> | render-report <json> | trend-console | knowledge-result\n`,
      );
      return 1;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
