#!/usr/bin/env bun
/**
 * SentinelReview — deterministic render helper for the Sentinel Review workflow.
 *
 * Extracts the Review "Step 4: Output" markdown template (Review.md lines 42-62,
 * RFC-0126 B1 render-family) into a pure ReviewOutput -> markdown transform. Review
 * extends Guard, so the violations/evolutions/passing body is rendered by the SAME
 * renderGuardReport helper (the template's "{Same violations/evolutions/passing
 * sections as Guard}" line) — one render path, no drift between the two workflows.
 *
 * The deterministic skeleton extracted here: the branch header (comparing line, files
 * changed, line counts), the Branch-Level Observations bullet list, and the
 * Recommendation verdict + reasoning. The CONTENT of the observations and the verdict
 * choice is the agent's judgment (supplied as data); this helper only renders that
 * judgment into the fixed report shape.
 *
 * Usage (CLI): bun SentinelReview.ts render <review-output.json>
 */

import { readFileSync } from "fs";
import { renderGuardReport, type GuardReport } from "./SentinelGuard.ts";

export type ReviewVerdict = "APPROVE" | "APPROVE WITH NOTES" | "REQUEST CHANGES";

export interface ReviewOutput {
  branchName: string;
  branch: string;
  defaultBranch: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  /** Guard-shaped body (violations / evolutions / passing) rendered via renderGuardReport. */
  guard: GuardReport;
  /** Agent-authored branch-level observation bullets (cross-file, organization, impact). */
  branchObservations: string[];
  recommendation: ReviewVerdict;
  /** One-line reasoning for the verdict (agent judgment). */
  reasoning: string;
}

/**
 * renderReviewOutput — the Sentinel Review report (Review.md Step 4 template).
 *
 * Byte-identical to the inlined template: the `## Sentinel Review — Branch:` header,
 * the Comparing / Files changed / Lines line, the embedded Guard body (same render as
 * the Guard workflow), the Branch-Level Observations bullet list, and the
 * Recommendation verdict + reasoning. The Guard body is embedded by stripping the Guard
 * report's own leading `## Sentinel Guard Report` heading + blank line and its leading
 * `**Project:** ...` line, leaving the violations/evolutions/passing sections (the
 * template's "{Same violations/evolutions/passing sections as Guard}").
 */
export function renderReviewOutput(r: ReviewOutput): string {
  const out: string[] = [];
  out.push(`## Sentinel Review — Branch: ${r.branchName}`);
  out.push("");
  out.push(`**Comparing:** ${r.branch} → ${r.defaultBranch}`);
  out.push(`**Files changed:** ${r.filesChanged} | **Lines:** +${r.linesAdded} / -${r.linesRemoved}`);
  out.push("");

  // Embed the Guard sections (violations / evolutions / passing). renderGuardReport
  // emits its own `## Sentinel Guard Report` + `**Project:** ...` header; Review wants
  // only the sections, so drop those two prefix lines and reattach the body verbatim.
  const guardBody = renderGuardReport(r.guard)
    .replace(/^## Sentinel Guard Report\n\n\*\*Project:\*\*[^\n]*\n\n/, "")
    .replace(/\n+$/, "");
  out.push(guardBody);
  out.push("");

  out.push("### Branch-Level Observations");
  for (const o of r.branchObservations) out.push(`- ${o}`);
  out.push("");
  out.push("### Recommendation");
  out.push(r.recommendation);
  out.push(r.reasoning);
  out.push("");
  return out.join("\n");
}

function printHelp(): void {
  console.log(`SentinelReview — deterministic Review-report render helper

USAGE
  bun SentinelReview.ts render <review-output.json>

SUBCOMMANDS
  render <review-output.json>   Read a ReviewOutput JSON file and print the Review
                                markdown report (Review.md Step 4 render).`);
}

function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const sub = process.argv[2];
  if (sub === "render") {
    const path = process.argv[3];
    if (!path) {
      console.error("Error: render requires a <review-output.json> path argument");
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(path, "utf8")) as ReviewOutput;
    process.stdout.write(renderReviewOutput(data));
    return;
  }
  console.error(`Error: unknown subcommand '${sub ?? ""}'. Expected: render`);
  process.exit(1);
}

if (import.meta.main) {
  main();
}
