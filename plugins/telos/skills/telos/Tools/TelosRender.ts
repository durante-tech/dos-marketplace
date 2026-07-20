#!/usr/bin/env bun
/**
 * TelosRender - pure render helpers for the Telos WriteReport workflow.
 *
 * RFC-0126 section 9 B1/B2 render-family remediation: the WriteReport workflow
 * (Step 3) carried an inline TypeScript template that read the five assessment
 * artifacts (findings/recommendations/roadmap/methodology/narrative) and
 * assembled a fixed-schema `ReportData` object, then wrote it to
 * `{output_dir}/lib/report-data.ts`. That assembly is a deterministic transform
 * of structured input into a fixed-schema source file — it belongs in code, not
 * in workflow prose. This module owns the transform; the workflow now points at
 * the `render-report-data` subcommand below.
 *
 * The output is BYTE-IDENTICAL to the `lib/report-data.ts` shape the template
 * produced: same `export const reportData: ReportData = {...}` literal, same
 * field mappings, same fallback chains (e.g. keyFindings falls back to the first
 * five finding titles), same default meta values.
 *
 * Usage (CLI):
 *   bun TelosRender.ts render-report-data <artifacts_dir> [--client <name>] \
 *     [--title <title>] [--date <date>] [--classification <text>]
 *
 * Reads <artifacts_dir>/{findings,recommendations,roadmap,methodology,narrative}.json
 * and prints the assembled lib/report-data.ts source to stdout.
 */

import { readFileSync } from "fs";
import { join } from "path";

export interface Finding {
  id: string;
  title: string;
  description: string;
  evidence: string;
  source: string;
  severity: "critical" | "high" | "medium" | "low";
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "immediate" | "short-term" | "long-term";
}

export interface TimelinePhase {
  phase: string;
  title: string;
  description: string;
  duration: string;
}

export interface Methodology {
  interviewCount: number;
  roles: string[];
}

export interface FindingsArtifact {
  findings: Finding[];
}

export interface RecommendationsArtifact {
  recommendations: Recommendation[];
}

export interface RoadmapArtifact {
  phases: TimelinePhase[];
}

export interface NarrativeArtifact {
  context: string;
  clientAsk: string;
  currentState: string;
  whyNow: string;
  existentialRisks: string[];
  competitiveThreats: string[];
  timelinePressures: string;
  goodNews: string;
  requirements: string[];
  targetStateDescription: string;
  keyCapabilities: string[];
  successMetrics: string[];
  immediateSteps: string[];
  decisionPoints: string[];
  commitmentRequired: string;
  // Optional overrides honoured by the original template's fallback chains.
  keyFindings?: string[];
  expectedOutcomes?: string[];
}

export interface ReportArtifacts {
  findings: FindingsArtifact;
  recommendations: RecommendationsArtifact;
  roadmap: RoadmapArtifact;
  methodology: Methodology;
  narrative: NarrativeArtifact;
}

export interface ReportMeta {
  clientName: string;
  reportTitle: string;
  reportDate: string;
  classification: string;
}

export const DEFAULT_REPORT_TITLE =
  "Strategic Assessment & Transformation Roadmap";
export const DEFAULT_CLASSIFICATION = "CONFIDENTIAL";

export interface ReportData {
  clientName: string;
  reportTitle: string;
  reportDate: string;
  classification: string;
  executiveSummary: {
    context: string;
    methodology: Methodology;
    keyFindings: string[];
    primaryRecommendation: string;
    expectedOutcomes: string[];
  };
  situationAssessment: {
    currentState: string;
    clientAsk: string;
    whyNow: string;
  };
  findings: Finding[];
  riskAnalysis: {
    existentialRisks: string[];
    competitiveThreats: string[];
    timelinePressures: string;
  };
  strategicOpportunity: {
    goodNews: string;
    requirements: string[];
  };
  recommendations: Recommendation[];
  targetState: {
    description: string;
    keyCapabilities: string[];
    successMetrics: string[];
  };
  roadmap: TimelinePhase[];
  callToAction: {
    immediateSteps: string[];
    decisionPoints: string[];
    commitmentRequired: string;
  };
}

/**
 * Pure transform: assemble the ReportData object from the five parsed
 * assessment artifacts plus report meta. Mirrors the inline template field
 * mappings and fallback chains exactly.
 */
export function assembleReportData(
  artifacts: ReportArtifacts,
  meta: ReportMeta,
): ReportData {
  const { findings, recommendations, roadmap, methodology, narrative } =
    artifacts;

  return {
    clientName: meta.clientName,
    reportTitle: meta.reportTitle,
    reportDate: meta.reportDate,
    classification: meta.classification,
    executiveSummary: {
      context: narrative.context,
      methodology: methodology,
      keyFindings:
        narrative.keyFindings ||
        findings.findings.slice(0, 5).map((f) => f.title),
      primaryRecommendation:
        recommendations.recommendations[0]?.description || "",
      expectedOutcomes: narrative.expectedOutcomes || [],
    },
    situationAssessment: {
      currentState: narrative.currentState,
      clientAsk: narrative.clientAsk,
      whyNow: narrative.whyNow,
    },
    findings: findings.findings,
    riskAnalysis: {
      existentialRisks: narrative.existentialRisks,
      competitiveThreats: narrative.competitiveThreats,
      timelinePressures: narrative.timelinePressures,
    },
    strategicOpportunity: {
      goodNews: narrative.goodNews,
      requirements: narrative.requirements,
    },
    recommendations: recommendations.recommendations,
    targetState: {
      description: narrative.targetStateDescription,
      keyCapabilities: narrative.keyCapabilities,
      successMetrics: narrative.successMetrics,
    },
    roadmap: roadmap.phases,
    callToAction: {
      immediateSteps: narrative.immediateSteps,
      decisionPoints: narrative.decisionPoints,
      commitmentRequired: narrative.commitmentRequired,
    },
  };
}

/**
 * Pure render: emit the `lib/report-data.ts` TypeScript source string for a
 * ReportData object. This is the file the WriteReport workflow writes to
 * `{output_dir}/lib/report-data.ts`. The interface block matches the template
 * shipped in ReportTemplate/Lib/report-data.ts; the data literal is a
 * deterministic JSON.stringify of the assembled object with a `reportData`
 * binding and an explicit `ReportData` type annotation.
 */
export function renderReportData(
  artifacts: ReportArtifacts,
  meta: ReportMeta,
): string {
  const data = assembleReportData(artifacts, meta);
  const literal = JSON.stringify(data, null, 2);

  return `// TELOS Report Data Structure
// This file is auto-generated from TELOS analysis artifacts by TelosRender.
// Do not edit by hand — edit the source artifacts and regenerate.

export interface Finding {
  id: string
  title: string
  description: string
  evidence: string
  source: string
  severity: "critical" | "high" | "medium" | "low"
}

export interface Recommendation {
  id: string
  title: string
  description: string
  priority: "immediate" | "short-term" | "long-term"
}

export interface TimelinePhase {
  phase: string
  title: string
  description: string
  duration: string
}

export interface ReportData {
  // Meta
  clientName: string
  reportTitle: string
  reportDate: string
  classification: string

  // Executive Summary
  executiveSummary: {
    context: string
    methodology: {
      interviewCount: number
      roles: string[]
    }
    keyFindings: string[]
    primaryRecommendation: string
    expectedOutcomes: string[]
  }

  // Situation Assessment (from Opening Context)
  situationAssessment: {
    currentState: string
    clientAsk: string
    whyNow: string
  }

  // Key Findings (from Evidence section)
  findings: Finding[]

  // Risk Analysis (from Stakes section)
  riskAnalysis: {
    existentialRisks: string[]
    competitiveThreats: string[]
    timelinePressures: string
  }

  // The Pivot - Strategic Opportunity
  strategicOpportunity: {
    goodNews: string
    requirements: string[]
  }

  // Recommendations (from Requirements section)
  recommendations: Recommendation[]

  // Vision (from Vision section)
  targetState: {
    description: string
    keyCapabilities: string[]
    successMetrics: string[]
  }

  // Implementation Roadmap
  roadmap: TimelinePhase[]

  // Call to Action (from Close section)
  callToAction: {
    immediateSteps: string[]
    decisionPoints: string[]
    commitmentRequired: string
  }
}

export const reportData: ReportData = ${literal}
`;
}

/**
 * Wisdom-research dispatch (RFC-0126 section 9 B5 remediation).
 *
 * The Update workflow Step 2b routes a WISDOM.md enrichment to one of two
 * Research-skill workflows depending on whether the agent judges the quote to be
 * attributable to *canonical wisdom literature* (philosophy, stoicism, religious
 * texts, well-known authors). That judgment is semantic inference the agent makes
 * by reading the quote — it stays in workflow prose and is NOT encoded here.
 *
 * What WAS encoded in prose (and is the drift-risk this helper removes) is the
 * routing target for each branch: canonical → Ref(DocsLookup); aphorism or doubt
 * → Research(QuickResearch). The prose hard-coded which skill/workflow each branch
 * spawns, so a routing change had to be hand-mirrored in prose. This pure map is
 * the single source of truth for that boolean→workflow decision; the workflow now
 * points at the `select-wisdom-research` subcommand below.
 *
 * Effect-identical to the prose: `isCanonical === true` selects DocsLookup; any
 * other input (false — aphorism, ambiguous, or "when in doubt") selects
 * QuickResearch, preserving the prose default ("prefer QuickResearch").
 */
export interface WisdomResearchDispatch {
  skill: "Ref" | "Research";
  workflow: "DocsLookup" | "QuickResearch";
}

export function selectWisdomResearch(
  isCanonical: boolean,
): WisdomResearchDispatch {
  return isCanonical
    ? { skill: "Ref", workflow: "DocsLookup" }
    : { skill: "Research", workflow: "QuickResearch" };
}

function parseMetaFlags(argv: string[]): ReportMeta {
  const meta: ReportMeta = {
    clientName: "[CLIENT NAME]",
    reportTitle: DEFAULT_REPORT_TITLE,
    reportDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    classification: DEFAULT_CLASSIFICATION,
  };
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === "--client" && next) meta.clientName = next;
    if (argv[i] === "--title" && next) meta.reportTitle = next;
    if (argv[i] === "--date" && next) meta.reportDate = next;
    if (argv[i] === "--classification" && next) meta.classification = next;
  }
  return meta;
}

function loadArtifacts(dir: string): ReportArtifacts {
  const read = <T>(name: string): T =>
    JSON.parse(readFileSync(join(dir, name), "utf-8")) as T;
  return {
    findings: read<FindingsArtifact>("findings.json"),
    recommendations: read<RecommendationsArtifact>("recommendations.json"),
    roadmap: read<RoadmapArtifact>("roadmap.json"),
    methodology: read<Methodology>("methodology.json"),
    narrative: read<NarrativeArtifact>("narrative.json"),
  };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "render-report-data") {
    const artifactsDir = rest[0];
    if (!artifactsDir) {
      console.error(
        "Usage: TelosRender.ts render-report-data <artifacts_dir> [--client <name>] [--title <title>] [--date <date>] [--classification <text>]",
      );
      process.exit(1);
    }
    const artifacts = loadArtifacts(artifactsDir);
    const meta = parseMetaFlags(rest.slice(1));
    process.stdout.write(renderReportData(artifacts, meta));
    return;
  }

  if (command === "select-wisdom-research") {
    const flag = rest[0];
    if (flag !== "--canonical" && flag !== "--aphorism") {
      console.error(
        "Usage: TelosRender.ts select-wisdom-research (--canonical | --aphorism)",
      );
      process.exit(1);
    }
    const dispatch = selectWisdomResearch(flag === "--canonical");
    process.stdout.write(JSON.stringify(dispatch) + "\n");
    return;
  }

  console.error(
    "Unknown command. Available: render-report-data <artifacts_dir> | select-wisdom-research (--canonical | --aphorism)",
  );
  process.exit(1);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
