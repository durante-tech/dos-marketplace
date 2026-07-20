#!/usr/bin/env bun
/**
 * SentinelStatus — deterministic helpers for the Sentinel Status workflow.
 *
 * Holds logic that was previously hand-typed in Status.md prose so it is computed
 * once and unit-tested:
 *   - classifyCadence:            Memory Hygiene reconcile cadence (green/yellow/red).
 *   - checkArchitectureArtifacts: file-existence probe + DOCS_DIR resolution.
 *   - renderStatus:               the full Status markdown report (RFC-0126 B2 render).
 *
 * Usage (CLI):
 *   bun SentinelStatus.ts cadence <daysSince>     → prints green | yellow | red
 *   bun SentinelStatus.ts render <status.json>    → prints the Status markdown report
 */

import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

// Memory Hygiene reconcile cadence thresholds (Status.md "Memory Hygiene" section).
// Named consts so the 7d/14d boundaries live in code, not prose. Inclusive lower
// band, exclusive upper: <=7d green, >7d and <=14d yellow, >14d red.
export const CADENCE_GREEN_MAX_DAYS = 7;
export const CADENCE_YELLOW_MAX_DAYS = 14;

export type Cadence = "green" | "yellow" | "red";

/**
 * classifyCadence — maps "days since last reconcile" to a traffic-light cadence.
 *
 *   daysSince <= 7      -> green
 *   7  < daysSince <= 14 -> yellow
 *   daysSince > 14      -> red
 *
 * Non-finite or negative input is treated as 0 days (green) — a never-negative
 * "just reconciled" reading rather than throwing inside a read-only status pass.
 */
export function classifyCadence(daysSince: number): Cadence {
  const d = Number.isFinite(daysSince) ? Math.max(daysSince, 0) : 0;
  if (d <= CADENCE_GREEN_MAX_DAYS) return "green";
  if (d <= CADENCE_YELLOW_MAX_DAYS) return "yellow";
  return "red";
}

// ---------------------------------------------------------------------------
// Architecture Artifacts table (Status.md "### Architecture Artifacts", B1)
// ---------------------------------------------------------------------------

// The five rows of the Architecture Artifacts table and the on-disk filename each
// probes inside DOCS_DIR. Kept here (not in prose) so the label/filename pairing is
// the single source of truth for the table render. Order matters — it is the table
// row order operators see.
export const ARCHITECTURE_ARTIFACTS: Array<{ label: string; file: string }> = [
  { label: "Module Map", file: "MODULE-MAP.md" },
  { label: "C4 Context", file: "C4-CONTEXT.md" },
  { label: "C4 Container", file: "C4-CONTAINER.md" },
  { label: "ADRs", file: "ADRS.md" },
  { label: "Tech Debt", file: "TECH-DEBT.md" },
];

export interface ArtifactStatus {
  label: string;
  exists: boolean;
  /** YYYY-MM-DD of last modification, or null when the file is missing. */
  generated: string | null;
}

// Resolve DOCS_DIR the same way Scan.md / SentinelScan.resolveDocsDir does: prefer
// the DOS-pattern Docs/Sentinel/ directory, fall back to .sentinel/docs/. Duplicated
// here only to keep SentinelStatus free of a cross-tool import; the resolution rule is
// identical and pinned by the golden test.
export function resolveDocsDir(root: string): string {
  return existsSync(join(root, "Docs")) ? join(root, "Docs", "Sentinel") : join(root, ".sentinel", "docs");
}

/**
 * checkArchitectureArtifacts — probe the five architecture artifacts in DOCS_DIR.
 *
 * Replaces the hand-applied "look for Docs/Sentinel/ first, then .sentinel/docs/"
 * file-existence prose (Status.md lines 89-98). Returns one ArtifactStatus per row
 * in ARCHITECTURE_ARTIFACTS order: exists flag + last-modified date (UTC YYYY-MM-DD)
 * or null when absent.
 */
export function checkArchitectureArtifacts(docsDir: string): ArtifactStatus[] {
  return ARCHITECTURE_ARTIFACTS.map(({ label, file }) => {
    const path = join(docsDir, file);
    if (!existsSync(path)) return { label, exists: false, generated: null };
    const generated = statSync(path).mtime.toISOString().slice(0, 10);
    return { label, exists: true, generated };
  });
}

// ---------------------------------------------------------------------------
// renderStatus — full Status report markdown (Status.md Step 4, B2)
// ---------------------------------------------------------------------------

export interface StatusKg {
  stackTech: number;
  conventions: number;
  decisions: number;
  patterns: number;
  total: number;
}

export interface StatusConventionCategory {
  category: string;
  count: number;
}

export interface StatusMemoryHygiene {
  /** Present when MEMORY/STATE/last-reconcile.json existed. */
  lastReconcile?: { date: string; daysAgo: number };
}

export interface StatusFourCopy {
  totalFiles: number;
  drift: number;
  missing: number;
}

export interface StatusData {
  projectName: string;
  wing: string;
  lastScan: { date: string; daysAgo: number };
  kg: StatusKg;
  conventionCategories: StatusConventionCategory[];
  /** true when CLAUDE.md has a `## Sentinel Conventions` section. */
  hasClaudeMdSection: boolean;
  /** Enforceable-rule count from .sentinel/conventions.json, or null when absent. */
  conventionCacheRules: number | null;
  artifacts: ArtifactStatus[];
  /** Present when .sentinel/health.json existed. `score: null` = health.json
   *  exists but carries no measured score (method:"unmeasured" — e.g. only a
   *  ConventionCache freshness refresh has run, never a measured scan sweep). */
  health?: { score: number | null; method?: string; clean: number; total: number; drifting: string[] };
  memoryHygiene: StatusMemoryHygiene;
  fourCopy: StatusFourCopy;
}

// Cadence recommendation line shared by the Memory Hygiene "Cadence" cell.
function cadenceCell(daysAgo: number): string {
  const c = classifyCadence(daysAgo);
  if (c === "green") return "green";
  return `${c} — recommend \`bun ~/Durante/Packs/mem-palace/src/Tools/MemoryHygiene.ts --reconcile\``;
}

/**
 * renderStatus — the Sentinel Status report (Status.md Step 4 template).
 *
 * Pure StatusData -> markdown transform. Byte-identical to the inlined fenced
 * template: same headings, the KG / Conventions-by-Category / CLAUDE.md / Convention
 * Cache / Architecture Artifacts / Health Score / Memory Hygiene / Four-Copy Parity /
 * Recommendations sections, same empty-state phrasing, same trailing newline. The
 * conditional one-line sections (CLAUDE.md present/absent, cache present/absent,
 * health present/absent, reconcile present/absent, Recommendations) reproduce the
 * prose branches exactly.
 */
export function renderStatus(d: StatusData): string {
  const out: string[] = [];
  out.push(`## Sentinel Status — ${d.projectName}`);
  out.push("");
  out.push(`**Last scan:** ${d.lastScan.date} (${d.lastScan.daysAgo} days ago)`);
  out.push(`**Wing:** \`${d.wing}\``);
  out.push("");
  out.push("### Knowledge Graph");
  out.push(`- ${d.kg.stackTech} stack technologies tracked`);
  out.push(`- ${d.kg.conventions} conventions tracked`);
  out.push(`- ${d.kg.decisions} decisions documented`);
  out.push(`- ${d.kg.patterns} patterns detected`);
  out.push(`- ${d.kg.total} KG triples total`);
  out.push("");
  out.push("### Conventions by Category");
  out.push("| Category | Count |");
  out.push("|----------|-------|");
  for (const c of d.conventionCategories) out.push(`| ${c.category} | ${c.count} |`);
  out.push("");
  out.push("### CLAUDE.md");
  out.push(d.hasClaudeMdSection ? "Has Sentinel Conventions section" : "No Sentinel Conventions section — run `sentinel scan`");
  out.push("");
  out.push("### Convention Cache");
  out.push(
    d.conventionCacheRules !== null
      ? `\`.sentinel/conventions.json\` exists with ${d.conventionCacheRules} enforceable rules`
      : "No cache — run `sentinel scan`",
  );
  out.push("");
  out.push("### Architecture Artifacts");
  out.push("");
  out.push("| Artifact | Status | Generated |");
  out.push("|----------|--------|-----------|");
  for (const a of d.artifacts) {
    const status = a.exists ? "exists" : "missing";
    const generated = a.generated ?? "—";
    out.push(`| ${a.label} | ${status} | ${generated} |`);
  }
  out.push("");
  out.push("### Health Score");
  if (d.health && d.health.score !== null && d.health.score !== undefined) {
    out.push(`- **Score:** ${d.health.score}% healthy (${d.health.clean}/${d.health.total} conventions clean)`);
    out.push(`- **Drifting:** ${d.health.drifting.length ? d.health.drifting.join(", ") : "none"}`);
  } else if (d.health) {
    // health.json exists but no measured score — never render "undefined% healthy"
    // and never let the sub-80 debt trigger silently pass on a scoreless file.
    out.push(`- **Score:** unmeasured (${d.health.method ?? "no measured sweep recorded"}) — run \`sentinel scan\` for a measured live-conformance score`);
  } else {
    out.push("No `.sentinel/health.json` — run `sentinel scan`");
  }
  out.push("");
  out.push("### Memory Hygiene");
  out.push("");
  out.push("| Memory Health | Status |");
  out.push("|--------------|--------|");
  if (d.memoryHygiene.lastReconcile) {
    const r = d.memoryHygiene.lastReconcile;
    out.push(`| Last reconcile | ${r.date} (${r.daysAgo} days ago) |`);
    out.push(`| Cadence | ${cadenceCell(r.daysAgo)} |`);
  } else {
    out.push("| Last reconcile | never run |");
    out.push("| Cadence | reconcile never run — recommend `bun ~/Durante/Packs/mem-palace/src/Tools/MemoryHygiene.ts --reconcile` |");
  }
  out.push("");
  out.push("### Four-Copy Parity");
  out.push("");
  out.push("| Four-Copy Sync | Status |");
  out.push("|---------------|--------|");
  out.push(`| Total files | ${d.fourCopy.totalFiles} identical |`);
  out.push(
    `| Drift | ${d.fourCopy.drift === 0 ? "0 drift" : `${d.fourCopy.drift} drift — recommend \`bun ~/Durante/Tools/sync-check.ts --fix --dry-run\``} |`,
  );
  out.push(`| Missing | ${d.fourCopy.missing === 0 ? "0 missing" : `${d.fourCopy.missing} missing`} |`);
  out.push("");
  out.push("### Recommendations");
  const recs: string[] = [];
  if (d.lastScan.daysAgo > 30) recs.push("Run `sentinel scan` to refresh conventions and artifacts");
  if (d.health && typeof d.health.score === "number" && d.health.score < 80) recs.push("Tech debt accumulating — review `.sentinel/docs/TECH-DEBT.md`");
  if (d.health && (d.health.score === null || d.health.score === undefined)) recs.push("Health is unmeasured — run `sentinel scan` (Phase 2b-iv live sweep) for a real score");
  if (recs.length === 0) recs.push("All systems healthy. Run `sentinel guard` to check current changes.");
  for (const r of recs) out.push(`- ${r}`);
  out.push("");
  return out.join("\n");
}

function printHelp(): void {
  console.log(`SentinelStatus — deterministic Status-workflow helpers

USAGE
  bun SentinelStatus.ts cadence <daysSince>
  bun SentinelStatus.ts render <status.json>

SUBCOMMANDS
  cadence <daysSince>   Print the reconcile cadence color (green|yellow|red)
                        for the given integer day delta. Thresholds:
                        <=${CADENCE_GREEN_MAX_DAYS}d green, <=${CADENCE_YELLOW_MAX_DAYS}d yellow, else red.
  render <status.json>  Read a StatusData JSON file and print the Status markdown
                        report (Status.md Step 4 render).`);
}

function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const sub = process.argv[2];
  if (sub === "cadence") {
    const days = Number(process.argv[3]);
    if (!Number.isFinite(days)) {
      console.error("Error: cadence requires a numeric <daysSince> argument");
      process.exit(1);
    }
    console.log(classifyCadence(days));
    return;
  }
  if (sub === "render") {
    const path = process.argv[3];
    if (!path) {
      console.error("Error: render requires a <status.json> path argument");
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(path, "utf8")) as StatusData;
    process.stdout.write(renderStatus(data));
    return;
  }
  console.error(`Error: unknown subcommand '${sub ?? ""}'. Expected: cadence | render`);
  process.exit(1);
}

if (import.meta.main) {
  main();
}
