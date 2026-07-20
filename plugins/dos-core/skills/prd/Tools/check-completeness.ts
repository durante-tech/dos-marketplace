#!/usr/bin/env bun
/**
 * check-completeness.ts — the executable harness for the PRD completeness
 * contract. THIS is the forcing function the CheckCompleteness workflow lacked:
 * the verdict is COMPUTED from the 13 doctrine gates, never asserted by an AI
 * eyeballing the PRD. The denominator bug that shipped in campaign firing #3
 * (`progress: 0/66` against 67 ISC) is now caught here, mechanically.
 *
 * USAGE:
 *   bun check-completeness.ts <path/to/PRD.md> [--json]
 *
 * EXIT CODES:
 *   0  COMPLETE (every gate pass or not_applicable)
 *   1  INCOMPLETE or PARTIAL-CHECK (any block gate failed or could not run)
 */

import { checkCompleteness, type GateStatus, type CompletenessReport } from "../Doctrine/index.ts";

const GLYPH: Record<GateStatus, string> = {
  pass: "✓",
  fail: "✗",
  inconclusive: "⚠",
  not_applicable: "—",
};

/** Render the computed report verdict-first (ISC-43/44/46/47). */
export function renderReport(r: CompletenessReport, path: string): string {
  const lines: string[] = [];
  const blocked = r.verdict !== "COMPLETE";
  lines.push(
    `${blocked ? "🔴" : "🟢"} ${r.verdict} — ${r.pass}/${r.gatesTotal} gates pass ` +
      `(${r.fail} fail · ${r.inconclusive} inconclusive · ${r.na} n/a)`,
  );
  lines.push(`   contract: ${r.contract} · target: ${path}`);
  lines.push("");
  for (const f of r.findings) {
    const head = `${GLYPH[f.status]} ${f.id} ${f.rule} [${f.severity}]`;
    if (f.status === "fail" || f.status === "inconclusive") {
      lines.push(`${head} — ${f.evidence}`);
      if (f.fix) lines.push(`     fix: ${f.fix}`);
      if (f.authority) lines.push(`     also rejected by: ${f.authority}`);
    } else {
      lines.push(`${head}${f.status === "not_applicable" ? ` (${f.evidence})` : ""}`);
    }
  }
  lines.push("");
  if (r.verdict === "COMPLETE") {
    lines.push("All enforced gates pass — a downstream gate will not block this PRD.");
  } else if (r.verdict === "PARTIAL-CHECK") {
    lines.push("⚠ A gate could not be evaluated (fail-closed) — COMPLETE is withheld until it runs.");
  } else {
    lines.push("Fix the ✗ gates above; each names the downstream authority that will also reject it.");
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) {
    console.error("usage: bun check-completeness.ts <path/to/PRD.md> [--json]");
    process.exit(2);
  }
  let report: CompletenessReport;
  try {
    report = checkCompleteness(path);
  } catch (e) {
    console.error(`check-completeness: could not evaluate ${path}: ${(e as Error).message}`);
    process.exit(2);
  }
  if (json) {
    console.log(JSON.stringify({ path, ...report }, null, 2));
  } else {
    console.log(renderReport(report, path));
  }
  // Exit 1 on any non-COMPLETE verdict (block fail OR fail-closed inconclusive).
  process.exit(report.verdict === "COMPLETE" ? 0 : 1);
}
