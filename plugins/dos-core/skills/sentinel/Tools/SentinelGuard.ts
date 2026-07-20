#!/usr/bin/env bun
/**
 * SentinelGuard — deterministic render helper for the Sentinel Guard workflow.
 *
 * Extracts the Guard "Step 4: Output Report" markdown template (Guard.md lines
 * 114-142, RFC-0126 B1 render-family) into a pure GuardReport -> markdown transform
 * so the report skeleton is rendered once and pinned by a golden test, not re-typed
 * per run. The agent still owns the judgment that produces the GuardReport (the
 * VIOLATION / EVOLUTION / PASS classification from the Step 3 inference call); this
 * helper only renders that structured verdict into the operator-facing report.
 *
 * Usage (CLI): bun SentinelGuard.ts render <guard-report.json>
 *   Reads a GuardReport JSON file and prints the markdown report.
 */

import { readFileSync } from "fs";

export interface GuardViolation {
  category: string;
  file: string;
  /** Short one-line description shown on the violation header line. */
  description: string;
  convention: string;
  actual: string;
  fix: string;
  confidence: number;
}

export interface GuardEvolution {
  category: string;
  file: string;
  /** Short one-line description shown on the evolution header line. */
  description: string;
  oldPattern: string;
  newPattern: string;
}

export interface GuardReport {
  projectName: string;
  conventionsChecked: number;
  changesAnalyzed: number;
  violations: GuardViolation[];
  evolutions: GuardEvolution[];
  passing: number;
}

// Confidence is rendered to two decimals (the template shows {0.XX}).
function fmtConfidence(c: number): string {
  return c.toFixed(2);
}

/**
 * renderGuardReport — the Sentinel Guard report (Guard.md Step 4 template).
 *
 * Pure GuardReport -> markdown. Byte-identical to the inlined fenced template: the
 * header line, the numbered Violations and Potential Evolutions blocks (one entry per
 * finding, 1-indexed), and the Summary. Empty violation/evolution lists render the
 * header with a (0 ...) count and no entries, matching the template's "{For each ...}"
 * loop over an empty collection. The clean-bill-of-health note (template: "If zero
 * violations") is emitted when there are no violations.
 */
export function renderGuardReport(r: GuardReport): string {
  const out: string[] = [];
  out.push("## Sentinel Guard Report");
  out.push("");
  out.push(`**Project:** ${r.projectName} | **Conventions checked:** ${r.conventionsChecked} | **Changes analyzed:** ${r.changesAnalyzed}`);
  out.push("");
  out.push(`### Violations (${r.violations.length} found)`);
  r.violations.forEach((v, i) => {
    out.push(`${i + 1}. **[${v.category}]** \`${v.file}\` — ${v.description}`);
    out.push(`   - **Convention:** ${v.convention}`);
    out.push(`   - **Found:** ${v.actual}`);
    out.push(`   - **Fix:** ${v.fix}`);
    out.push(`   - **Confidence:** ${fmtConfidence(v.confidence)}`);
  });
  out.push("");
  out.push(`### Potential Evolutions (${r.evolutions.length} detected)`);
  r.evolutions.forEach((e, i) => {
    out.push(`${i + 1}. **[${e.category}]** \`${e.file}\` — ${e.description}`);
    out.push(`   - **Current convention:** ${e.oldPattern}`);
    out.push(`   - **New pattern:** ${e.newPattern}`);
    out.push("   - **Action:** Run `sentinel evolve` to update if intentional");
  });
  out.push("");
  out.push("### Summary");
  out.push(`- ${r.passing} conventions passing`);
  out.push(`- ${r.violations.length} violations found`);
  out.push(`- ${r.evolutions.length} potential evolutions detected`);
  if (r.violations.length === 0) {
    out.push("");
    out.push("Clean bill of health — no violations found.");
  }
  out.push("");
  return out.join("\n");
}

function printHelp(): void {
  console.log(`SentinelGuard — deterministic Guard-report render helper

USAGE
  bun SentinelGuard.ts render <guard-report.json>

SUBCOMMANDS
  render <guard-report.json>   Read a GuardReport JSON file and print the Guard
                               markdown report (Guard.md Step 4 render).`);
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
      console.error("Error: render requires a <guard-report.json> path argument");
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(path, "utf8")) as GuardReport;
    process.stdout.write(renderGuardReport(data));
    return;
  }
  console.error(`Error: unknown subcommand '${sub ?? ""}'. Expected: render`);
  process.exit(1);
}

if (import.meta.main) {
  main();
}
