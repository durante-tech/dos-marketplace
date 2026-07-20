#!/usr/bin/env bun
/**
 * sentinel-durante-artifact — IO shell for the Durante-native deterministic transforms.
 *
 * Reads .sentinel/scan-report.json (the `durante` block produced by SentinelScan.ts) and
 * writes two deterministic artifacts:
 *   - {DOCS_DIR}/DURANTE-NATIVE.md      (the full inventory; renderDuranteNative)
 *   - .sentinel/durante-kg-ops.json     (the Phase-3 Step-3e KG ops; buildDuranteKgOps)
 *
 * This is the "first step" extended: the render + op-construction that used to live as
 * UNPROVABLE prose in Scan.md Phase 1c / Step 3e now run as tested code. Scan.md Phase 1c
 * becomes a single CLI call; Step 3e merges the ops file. Silent no-op on non-Durante repos.
 *
 * Usage: bun sentinel-durante-artifact.ts [/path/to/repo]   (default: cwd)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { renderDuranteNative, buildDuranteKgOps, deriveWing, resolveDocsDir } from "./SentinelScan.ts";

function main(): void {
  const root = resolve(process.argv[2] || ".");
  const reportPath = join(root, ".sentinel", "scan-report.json");
  if (!existsSync(reportPath)) {
    console.error(`No scan-report.json at ${reportPath} — run SentinelScan.ts first`);
    process.exit(1);
  }

  let report: Record<string, any>;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf-8"));
  } catch (e) {
    console.error(`scan-report.json is not valid JSON: ${(e as Error).message}`);
    process.exit(1);
  }

  const durante = report.durante;
  if (!durante || durante.isDuranteProject !== true) {
    console.log("durante-artifact: not a Durante project — no-op");
    return;
  }

  const date = new Date().toISOString().slice(0, 10); // CLI may use Date (the ban is workflow-script-only)
  const docsDir = resolveDocsDir(root);
  mkdirSync(docsDir, { recursive: true });

  const body = renderDuranteNative(durante, date);
  const artifactPath = join(docsDir, "DURANTE-NATIVE.md");
  // writeArtifact:exempt — operator doc write; artifact logging owned by the Sentinel scan workflow step
  writeFileSync(artifactPath, body);

  // deriveWing = the SAME wing the scan's Phase-3 prose resolves (registry wing, else
  // kebab(basename)), so Step 3e durante facts key to the same project:WING subject as
  // Steps 3b/3d — closes the wing split-brain (review major).
  const wing = deriveWing(report.project?.wing, root);
  const ops = buildDuranteKgOps(durante, wing, body, date);
  const opsPath = join(root, ".sentinel", "durante-kg-ops.json");
  // writeArtifact:exempt — .sentinel/ kg-ops state (path via join)
  writeFileSync(opsPath, JSON.stringify({ wing, generated: date, operations: ops }, null, 2));

  console.log(
    `durante-artifact: wrote ${artifactPath} + ${ops.length} kg-ops -> ${opsPath} ` +
    `(${durante.workflows.length}w/${durante.prds.length}p/${durante.rfcs.length}r/${durante.agentPacks.length}a/${durante.skills.length}s)`,
  );
}

if (import.meta.main) main();
