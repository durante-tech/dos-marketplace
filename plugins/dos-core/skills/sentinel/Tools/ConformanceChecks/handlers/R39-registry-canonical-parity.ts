/**
 * R39 — Project registry canonical parity.
 *
 * Background: 2026-05-09 incident. PROJECTS.md (operator-curated, gitignored)
 * and .dos-projects.json (canonical, hook-consumed) drifted. PROJECTS.md had
 * an "Altyaa Agents" row that .dos-projects.json did not. resolveProjectSlug()
 * reads only the canonical JSON, so cd ~/Experiments/altyaa-agents rendered
 * "[no project · run /sentinel]" in the V11 status bar even though PROJECTS.md
 * declared the wing.
 *
 * Convention (post-incident): .dos-projects.json is the canonical source of
 * truth for project↔wing mapping. PROJECTS.md is doc / Stack metadata only.
 * Every wing in PROJECTS.md MUST also appear in .dos-projects.json.
 * (Inverse direction is allowed — JSON may add new projects before the doc
 * catches up.)
 *
 * Pass: every PROJECTS.md row's `Wing` value resolves to a `wing` field in
 * .dos-projects.json (or PROJECTS.md is absent — fresh install).
 * Fail: PROJECTS.md has wings absent from canonical JSON.
 * Not_applicable: .dos-projects.json absent (the canonical doesn't exist
 * yet — operator hasn't initialized the registry).
 *
 * Exempt pragma: none — registry parity is structural and unconditional.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every wing declared in PROJECTS.md must also appear in .dos-projects.json (canonical source of truth)";

function findCanonicalPath(repoRoot: string): string | null {
  const home = homedir();
  const candidates = [
    join(home, "Durante", "Tools", ".dos-projects.json"),
    join(home, "Durante", ".dos-projects.json"),
    join(repoRoot, "Tools", ".dos-projects.json"),
    join(repoRoot, ".dos-projects.json"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

function findProjectsMdPath(): string | null {
  const home = homedir();
  const candidates = [
    join(home, ".claude", "DOS", "USER", "PROJECTS", "PROJECTS.md"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

export interface ProjectsMdParse {
  wings: string[];
  /** True when the doc HAS table rows but no parseable `| Project … | Wing` header. */
  malformed: boolean;
  reason?: string;
}

// A pipe-bounded data row (`| a | b |`), excluding the `|---|---|` separator row.
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|[\s:|-]+\|\s*$/;

/**
 * Parse the wing column from the PROJECTS.md registry table.
 *
 * Returns `malformed:true` when the document carries markdown table rows but no
 * parseable `| Project … | Wing` header (or the header lacks a `Wing` column).
 * The prior version returned `[]` in that case, which the handler read as
 * "0 wings → all present → pass" — a VACUOUS pass that hid a header-spelling
 * drift (SENT-07). A genuinely table-less doc (e.g. a fresh scaffold) is NOT
 * malformed and yields `wings:[]`.
 */
export function parseProjectsMd(md: string): ProjectsMdParse {
  const lines = md.split("\n");
  let hdrIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes("| Project") && lines[i]!.includes("| Wing")) {
      hdrIdx = i;
      break;
    }
  }
  const tableRows = lines.filter((l) => TABLE_ROW_RE.test(l) && !TABLE_SEP_RE.test(l));
  if (hdrIdx < 0) {
    if (tableRows.length > 0) {
      return {
        wings: [],
        malformed: true,
        reason: `PROJECTS.md has ${tableRows.length} table row(s) but no parseable "| Project … | Wing" header (header spelling drift?) — refusing to vacuously pass`,
      };
    }
    return { wings: [], malformed: false };
  }
  const cols = lines[hdrIdx]!.split("|").map((c) => c.trim());
  const wi = cols.indexOf("Wing");
  if (wi < 0) {
    return { wings: [], malformed: true, reason: `PROJECTS.md header row found but no "Wing" column parsed` };
  }
  const wings: string[] = [];
  for (let i = hdrIdx + 2; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length <= wi) continue;
    const wing = cells[wi]!.replace(/`/g, "");
    if (!wing || wing === "-" || wing === "Wing") continue;
    wings.push(wing);
  }
  return { wings, malformed: false };
}

function parseJsonWings(json: string): Set<string> {
  const data = JSON.parse(json) as { projects?: Array<{ wing?: string | null }> };
  const wings = new Set<string>();
  for (const p of data.projects ?? []) {
    if (p.wing && typeof p.wing === "string") wings.add(p.wing);
  }
  return wings;
}

export async function r39RegistryCanonicalParity(ctx: CheckContext): Promise<CheckResult> {
  const projectsMd = findProjectsMdPath();
  const canonicalJson = findCanonicalPath(ctx.repoRoot);

  if (!canonicalJson) {
    return {
      rId: "R39",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`.dos-projects.json not found in ~/Durante/Tools or repo root — canonical registry not initialized`],
    };
  }

  if (!projectsMd) {
    return {
      rId: "R39",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`PROJECTS.md not found at ~/.claude/DOS/USER/PROJECTS/PROJECTS.md — fresh install or operator did not opt into the doc registry`],
    };
  }

  let parsed: ProjectsMdParse;
  let jsonWings: Set<string> = new Set();
  try {
    parsed = parseProjectsMd(readFileSync(projectsMd, "utf-8"));
  } catch (err) {
    return {
      rId: "R39",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${projectsMd} unreadable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
  if (parsed.malformed) {
    // A table-bearing PROJECTS.md whose header we can't parse is registry drift
    // itself — the exact class R39 guards. Do NOT vacuously pass (SENT-07).
    return {
      rId: "R39",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${projectsMd}: ${parsed.reason ?? "table header unparseable"}`,
        `Fix: ensure the PROJECTS.md registry table header row reads "| Project | … | Wing | …".`,
      ],
    };
  }
  const mdWings = parsed.wings;
  try {
    jsonWings = parseJsonWings(readFileSync(canonicalJson, "utf-8"));
  } catch (err) {
    return {
      rId: "R39",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${canonicalJson} unparseable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const orphaned = mdWings.filter((w) => !jsonWings.has(w));
  if (orphaned.length === 0) {
    return {
      rId: "R39",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`${mdWings.length} PROJECTS.md wing(s) all present in .dos-projects.json (${jsonWings.size} canonical wings)`],
    };
  }

  return {
    rId: "R39",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${orphaned.length} PROJECTS.md wing(s) absent from .dos-projects.json:`,
      ...orphaned.map((w) => `  • ${w}`),
      `Fix: add the missing wing(s) as entries in ${canonicalJson}.`,
    ],
  };
}
