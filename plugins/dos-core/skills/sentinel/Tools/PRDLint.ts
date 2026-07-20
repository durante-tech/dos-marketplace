#!/usr/bin/env bun
/**
 * PRDLint.ts — Sentinel/PRDLint workflow backing tool.
 *
 * Walks every MEMORY/WORK PRD.md — recursing the RFC-0037 active/ + archived/
 * buckets AND the legacy flat layout (shared prd-doctrine SoT) — and applies:
 *   1. Frontmatter completeness — vNext 8 base fields (R17 parity)
 *   2. ISC count vs effort floor — `- [ ] ISC-N:` checkboxes at TierConfig floors (R18 parity)
 *   3. DATETIME parity slug↔frontmatter (R20)
 *   4. DAG Pre-Delegation Contract presence (R24)
 *   5. Stale-archive eligibility (info)
 *   6. Verification section presence on completes
 *   7. parent_rfc presence (R44 parity — warning, vNext + effort >= standard)
 *
 * REQUIRED_FIELDS + TIER_FLOORS are imported from ConformanceChecks/lib/
 * prd-doctrine.ts (single source of truth) so they cannot re-drift from the
 * conformance handlers (R17/R18) that enforce the same doctrine.
 *
 * Flags:
 *   --json                       emit JSON
 *   --severity {critical|warning|info}  filter findings
 *   --auto-archive               surface archive command for stale completes
 *   --help                       show usage
 *
 * Exit codes:
 *   0 = no critical findings
 *   1 = any critical finding
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import {
  REQUIRED_FIELDS_VNEXT,
  TIER_FLOORS_VNEXT,
  STANDARD_PLUS_EFFORT,
  countVNextIscs,
  listPrdPaths,
  isPreIscFloorCutoff,
} from "./ConformanceChecks/lib/prd-doctrine.ts";
import { isPreCutoffISO } from "./ConformanceChecks/lib/grandfather.ts";

// R44 parent_rfc cutoff (RFC-0080 acceptance) — mirrored here so PRDLint's
// parent_rfc surfacing is scoped EXACTLY like the R44 conformance handler
// (ISC-13): vNext (format_version: 3), effort >= standard, started >= cutoff.
const PARENT_RFC_CUTOFF_ISO = "2026-05-12";

// ───────────────────────────────────────────────────────────────────────────
// CLI
// ───────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const FLAG_JSON = argv.includes("--json");
const FLAG_HELP = argv.includes("--help") || argv.includes("-h");
const FLAG_AUTO_ARCHIVE = argv.includes("--auto-archive");
const sevIdx = argv.indexOf("--severity");
const SEV_FILTER = sevIdx !== -1 ? argv[sevIdx + 1] : null;

if (FLAG_HELP) {
  console.log(
    [
      "PRDLint.ts — lint WORK PRDs against doctrine obligations",
      "",
      "USAGE:",
      "  bun ~/.claude/skills/sentinel/Tools/PRDLint.ts [flags]",
      "",
      "FLAGS:",
      "  --json                              JSON output",
      "  --severity {critical|warning|info}  Filter findings",
      "  --auto-archive                      Print archive cmd for stale completes",
      "  --help                              Show this help",
      "",
      "EXIT CODES:",
      "  0   no critical findings",
      "  1   one or more critical findings",
    ].join("\n"),
  );
  process.exit(0);
}

const HOME = homedir();
const ts = new Date().toISOString();

// ───────────────────────────────────────────────────────────────────────────
// PRD discovery
// ───────────────────────────────────────────────────────────────────────────

function resolveWorkDirs(): string[] {
  const candidates = [
    process.env.CLAUDE_PROJECT_DIR
      ? `${process.env.CLAUDE_PROJECT_DIR}/MEMORY/WORK`
      : null,
    `${HOME}/Durante/MEMORY/WORK`,
    `${HOME}/.claude/MEMORY/WORK`,
  ].filter(Boolean) as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    try {
      const real = require("node:fs").realpathSync(c);
      if (seen.has(real) || !existsSync(real)) continue;
      seen.add(real);
      out.push(real);
    } catch {
      /* skip */
    }
  }
  return out;
}

function listPrds(): string[] {
  // Recurse the RFC-0037 active/ + archived/ buckets AND the legacy flat layout
  // via the shared prd-doctrine SoT (ISC-12). Pre-fix this did a flat readdir of
  // MEMORY/WORK/{slug} only, silently skipping every bucketed PRD.
  const prds: string[] = [];
  for (const d of resolveWorkDirs()) prds.push(...listPrdPaths(d));
  return prds;
}

// ───────────────────────────────────────────────────────────────────────────
// Frontmatter parser (zero-dep)
// ───────────────────────────────────────────────────────────────────────────

function parseFrontmatter(text: string): { fm: Record<string, string>; body: string } {
  if (!text.startsWith("---")) return { fm: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { fm: {}, body: text };
  const fmBlock = text.slice(3, end).trim();
  const body = text.slice(end + 4);
  const fm: Record<string, string> = {};
  for (const line of fmBlock.split("\n")) {
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (m) fm[m[1]!] = (m[2] ?? "").replace(/^["']|["']$/g, "").trim();
  }
  return { fm, body };
}

// ───────────────────────────────────────────────────────────────────────────
// Per-PRD checks
// ───────────────────────────────────────────────────────────────────────────

type Severity = "critical" | "warning" | "info";

type Finding = {
  slug: string;
  severity: Severity;
  category: string;
  message: string;
  auto_fix_command: string | null;
};

// Frontmatter required-field set + ISC tier floors are imported from the
// shared prd-doctrine SoT (REQUIRED_FIELDS_VNEXT, TIER_FLOORS_VNEXT). PRDLint
// drifted to a stale `domain/complexity/intent/outcome` + `light/standard/heavy/
// hardcore` table precisely because these lived in a private copy here; the
// import makes the floors/fields un-driftable (ISC-7/8/10).

export function lintPrd(path: string): Finding[] {
  const findings: Finding[] = [];
  const slug = path.split("/").slice(-2, -1)[0]!;
  const text = readFileSync(path, "utf8");
  const { fm, body } = parseFrontmatter(text);

  // 1. Frontmatter completeness — vNext 8 base fields (mirrors R17 exactly).
  for (const f of REQUIRED_FIELDS_VNEXT) {
    if (!fm[f] || fm[f]!.length === 0) {
      findings.push({
        slug,
        severity: "critical",
        category: "frontmatter",
        message: `missing frontmatter field: ${f}`,
        auto_fix_command: null,
      });
    }
  }

  // 2. ISC count vs effort floor — count `- [ ] ISC-N:` checkboxes (vNext),
  //    not `## ISC-*` headings, at the TierConfig floors (R18 parity). PRDs
  //    scaffolded before the R18 cutoff (2026-05-05) are exempt EXACTLY as the
  //    R18 handler exempts them, so PRDLint and conformance agree on scope.
  const iscCount = countVNextIscs(body);
  const effort = (fm.effort || "").toLowerCase();
  const floor = TIER_FLOORS_VNEXT[effort];
  if (floor !== undefined && iscCount < floor && !isPreIscFloorCutoff(slug)) {
    findings.push({
      slug,
      severity: "critical",
      category: "isc_floor",
      message: `ISC count ${iscCount} below ${effort} floor (${floor})`,
      auto_fix_command: null,
    });
  }

  // 3. DATETIME parity slug↔frontmatter (±30s)
  const slugMatch = slug.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/);
  if (slugMatch && fm.started) {
    const [_, Y, M, D, h, m, s] = slugMatch;
    const slugDate = new Date(`${Y}-${M}-${D}T${h}:${m}:${s}Z`);
    const fmDate = new Date(fm.started);
    if (!isNaN(fmDate.getTime())) {
      const driftSec = Math.abs(slugDate.getTime() - fmDate.getTime()) / 1000;
      if (driftSec > 30) {
        findings.push({
          slug,
          severity: "warning",
          category: "datetime_parity",
          message: `slug↔frontmatter drift ${driftSec.toFixed(0)}s (>30s) — slug=${slug.split("_")[0]} frontmatter=${fm.started}`,
          auto_fix_command: null,
        });
      }
    }
  }

  // 4. DAG Pre-Delegation Contract (heuristic stream count)
  // Stream signal: distinct "stream:" tags inside body, OR ISC subgroup headings
  const streamTags = new Set<string>();
  for (const m of body.matchAll(/^\s*[-*]?\s*stream\s*:\s*([A-Za-z0-9_-]+)/gim)) {
    streamTags.add(m[1]!.toLowerCase());
  }
  // Fallback: count distinct "## Stream " headings if no inline tags
  if (streamTags.size === 0) {
    for (const m of body.matchAll(/^##\s+Stream\s+([A-Za-z0-9_-]+)/gm)) {
      streamTags.add(m[1]!.toLowerCase());
    }
  }
  const streamCount = streamTags.size;
  if (iscCount >= 4 && streamCount >= 2) {
    const hasContract = /pre[-\s]?delegation\s+contract/i.test(body);
    if (!hasContract) {
      findings.push({
        slug,
        severity: "critical",
        category: "dag_contract",
        message: `${iscCount} ISCs across ${streamCount} streams but no Pre-Delegation Contract section`,
        auto_fix_command: null,
      });
    }
  }

  // 5. Stale-archive eligibility (info)
  const phase = (fm.phase || "").toLowerCase();
  if (phase === "complete") {
    const mtimeAge = (Date.now() - statSync(path).mtime.getTime()) / 86_400_000;
    if (mtimeAge >= 7) {
      const archiveCmd = FLAG_AUTO_ARCHIVE
        ? `bun ~/Durante/Tools/archive-completed-prds.ts --slug ${slug}`
        : null;
      findings.push({
        slug,
        severity: "info",
        category: "stale_complete",
        message: `phase=complete, ${mtimeAge.toFixed(0)}d old — eligible for archive`,
        auto_fix_command: archiveCmd,
      });
    }
  }

  // 6. Verification section on completes
  if (phase === "complete") {
    const verIdx = body.search(/^##\s+Verification\b/im);
    if (verIdx === -1) {
      findings.push({
        slug,
        severity: "warning",
        category: "verification",
        message: "phase=complete but no ## Verification section",
        auto_fix_command: null,
      });
    } else {
      const after = body.slice(verIdx).split("\n").slice(1).join("\n");
      // capture content until next ## or end
      const nextHead = after.search(/^##\s+/m);
      const verBody = nextHead === -1 ? after : after.slice(0, nextHead);
      if (verBody.trim().length < 50) {
        findings.push({
          slug,
          severity: "warning",
          category: "verification",
          message: `## Verification section has <50 chars of content (${verBody.trim().length})`,
          auto_fix_command: null,
        });
      }
    }
  }

  // 7. parent_rfc presence — surfaced EXACTLY like the R44 conformance handler
  //    (RFC-0080 §2.2): warning-tier, and only for vNext (format_version: 3)
  //    PRDs at effort >= standard authored on/after the rule cutoff. Orphan PRDs
  //    declare `parent_rfc: none`, which satisfies the check (presence, any value).
  if (
    fm.format_version === "3" &&
    STANDARD_PLUS_EFFORT.has(effort) &&
    !isPreCutoffISO(fm.started, PARENT_RFC_CUTOFF_ISO) &&
    (!fm.parent_rfc || fm.parent_rfc.length === 0)
  ) {
    findings.push({
      slug,
      severity: "warning",
      category: "parent_rfc",
      message: `vNext effort=${effort} PRD missing parent_rfc (use \`parent_rfc: none\` + 🪶 ORPHAN STRATEGIC INTENT for orphans) — R44`,
      auto_fix_command: null,
    });
  }

  return findings;
}

// ───────────────────────────────────────────────────────────────────────────
// Run (CLI entrypoint — guarded so lintPrd can be imported in tests)
// ───────────────────────────────────────────────────────────────────────────

if (import.meta.main) {
const prds = listPrds();
const allFindings: Finding[] = [];
for (const p of prds) {
  try {
    allFindings.push(...lintPrd(p));
  } catch (e) {
    const slug = p.split("/").slice(-2, -1)[0]!;
    allFindings.push({
      slug,
      severity: "warning",
      category: "lint_error",
      message: `lint crashed: ${(e as Error).message}`,
      auto_fix_command: null,
    });
  }
}

const filtered = SEV_FILTER
  ? allFindings.filter((f) => f.severity === SEV_FILTER)
  : allFindings;

const bySev = {
  critical: allFindings.filter((f) => f.severity === "critical").length,
  warning: allFindings.filter((f) => f.severity === "warning").length,
  info: allFindings.filter((f) => f.severity === "info").length,
};

// ───────────────────────────────────────────────────────────────────────────
// Output
// ───────────────────────────────────────────────────────────────────────────

if (FLAG_JSON) {
  console.log(
    JSON.stringify(
      {
        timestamp: ts,
        total_prds: prds.length,
        by_severity: bySev,
        findings: filtered,
      },
      null,
      2,
    ),
  );
} else {
  const isTty = process.stdout.isTTY;
  const red = (s: string) => (isTty ? `\x1b[31m${s}\x1b[0m` : s);
  const yel = (s: string) => (isTty ? `\x1b[33m${s}\x1b[0m` : s);
  const gry = (s: string) => (isTty ? `\x1b[90m${s}\x1b[0m` : s);
  const grn = (s: string) => (isTty ? `\x1b[32m${s}\x1b[0m` : s);
  const bar = "=".repeat(60);
  const sub = "-".repeat(60);

  console.log(bar);
  console.log("  PRD LINT REPORT");
  console.log(bar);
  console.log("");
  console.log(`TOTAL PRDS:     ${prds.length}`);
  console.log(`CRITICAL:       ${red(String(bySev.critical))}`);
  console.log(`WARNING:        ${yel(String(bySev.warning))}`);
  console.log(`INFO:           ${gry(String(bySev.info))}`);
  console.log("");
  console.log(sub);

  if (filtered.length === 0) {
    console.log(grn("No findings (with current filter). PRDs look clean."));
  } else {
    for (const f of filtered) {
      const tag =
        f.severity === "critical"
          ? red("[CRITICAL]")
          : f.severity === "warning"
            ? yel("[WARNING] ")
            : gry("[INFO]    ");
      console.log(`${tag} ${f.slug.padEnd(46)} ${f.message}`);
      if (f.auto_fix_command) console.log(`           ${gry("→ " + f.auto_fix_command)}`);
    }
  }
}

process.exit(bySev.critical > 0 ? 1 : 0);
}
