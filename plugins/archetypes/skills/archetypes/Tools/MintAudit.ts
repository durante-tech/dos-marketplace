#!/usr/bin/env bun
/**
 * mint-audit.ts — H32 (archer gen-56): mechanical Step-3-close audit of a
 * mint record. Prose contracts don't police prose (6th confirmation at
 * gen-54: the driver-synthesis itself dropped 1 table line and 4 miner
 * inferred-markers despite writing the contracts). This tool is the
 * mechanical owner of both classes, run BEFORE encoding:
 *
 *   bun Tools/MintAudit.ts --mint-dir <EXPERIMENTS/<mint>/ dir>   [--strict]
 *
 * Expects in the mint dir: synthesis.json (with `exclusions`) + one or
 * more *table.md miner files (markdown capability tables).
 *
 * Check A — ABSENCE DIFF (deterministic): every miner-table capability
 * line must token-match a row (id/capability) or an exclusion entry.
 * Unmatched lines are the ISC-A2 class. --strict exits 1 on any.
 *
 * Check B — INFERRED-MARKER PARITY (advisory): a table line carrying an
 * inferred-ish marker ("inferred:", "(inferred", "implied") whose matched
 * row's evidence for that cohort lacks `inferred: true` is a candidate
 * dropped caveat. Advisory because table notes also use "inferred absent"
 * about NON-counted members — the driver adjudicates the report; the tool
 * guarantees the line is LOOKED AT (gen-54's four drops were never looked
 * at). Never gates.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const STOP = new Set([
  "the", "a", "an", "of", "for", "and", "or", "on", "to", "with", "in",
  "as", "per", "via", "by", "at", "is", "are", "can", "flag", "flags",
]);

/** Light stemmer: ing/ed/es/s suffixes + trailing double-consonant collapse
 *  + "-al" adjective strip. Unifies switches/switch, logging/log,
 *  scheduled/schedule-ish, organizational/organization. */
export function stem(t: string): string {
  let s = t;
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s")) s = s.slice(0, -1);
  if (s.length > 3 && s[s.length - 1] === s[s.length - 2]) s = s.slice(0, -1);
  if (s.length > 6 && s.endsWith("al")) s = s.slice(0, -2);
  return s;
}

export function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t))
      .map(stem)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

export function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

export interface TableLine {
  file: string;
  capability: string;
  raw: string;
  cohortHint: "inapp" | "services" | "unknown";
}

/** Parse `| capability | references | count | notes |` markdown rows. */
export function parseTableLines(file: string, md: string): TableLine[] {
  const out: TableLine[] = [];
  const cohortHint = /inapp|in-app/i.test(file)
    ? "inapp"
    : /dedicated|service/i.test(file)
      ? "services"
      : "unknown";
  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // cells[0] is empty (leading pipe); capability = cells[1]
    const cap = (cells[1] ?? "").replace(/\*\*/g, "").trim();
    if (!cap || cap === "capability" || cap.toLowerCase() === "capability") continue;
    if (/^[-: ]+$/.test(cap)) continue; // separator row
    if (cap.startsWith("_")) continue; // header conventions
    out.push({ file, capability: cap, raw: line, cohortHint });
  }
  return out;
}

interface RowLike {
  id: string;
  capability: string;
  seedISC?: string;
  notes?: string;
  evidence: Array<{ cohort: string; inferred?: boolean }>;
}

export interface AuditReport {
  unmatched: TableLine[];
  inferredCandidates: Array<{ line: TableLine; rowId: string }>;
  matchedCount: number;
}

const MATCH_THRESHOLD = 2;

export function audit(
  rows: RowLike[],
  exclusions: Array<{ capability: string }>,
  lines: TableLine[],
): AuditReport {
  const rowToks = rows.map((r) => ({
    row: r,
    toks: new Set([
      ...tokens(r.id),
      ...tokens(r.capability),
      ...tokens(r.seedISC ?? ""),
      ...tokens(r.notes ?? ""),
    ]),
  }));
  const exToks = exclusions
    .filter((e) => e.capability !== "_cutoff")
    .map((e) => tokens(e.capability));

  const unmatched: TableLine[] = [];
  const inferredCandidates: AuditReport["inferredCandidates"] = [];
  let matchedCount = 0;

  for (const line of lines) {
    const lt = tokens(line.capability);
    let best: { row: RowLike; score: number } | null = null;
    for (const { row, toks } of rowToks) {
      const s = overlap(lt, toks);
      const hit = s >= MATCH_THRESHOLD || (s >= 1 && lt.size <= 2);
      if (hit && (best === null || s > best.score)) {
        best = { row, score: s };
      }
    }
    const excluded =
      best === null &&
      exToks.some(
        (et) => overlap(lt, et) >= MATCH_THRESHOLD || (overlap(lt, et) >= 1 && lt.size <= 2),
      );

    if (best === null && !excluded) {
      unmatched.push(line);
      continue;
    }
    matchedCount++;
    const row = best?.row;
    if (!row) continue;

    // Check B: inferred-ish marker on the line, matched row cohort lacks the flag
    if (/\binferred\b|\bimplied\b/i.test(line.raw)) {
      const ev = row.evidence.find(
        (e) => line.cohortHint === "unknown" || e.cohort === line.cohortHint,
      );
      if (ev && ev.inferred !== true) {
        inferredCandidates.push({ line, rowId: row.id });
      }
    }
  }
  return { unmatched, inferredCandidates, matchedCount };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--mint-dir");
  if (dirIdx === -1 || !args[dirIdx + 1]) {
    console.error("usage: bun Tools/MintAudit.ts --mint-dir <dir> [--strict]");
    process.exit(2);
  }
  const dir = args[dirIdx + 1];
  const strict = args.includes("--strict");
  const synthPath = join(dir, "synthesis.json");
  if (!existsSync(synthPath)) {
    console.error(`mint-audit: ${synthPath} not found`);
    process.exit(2);
  }
  const synth = JSON.parse(readFileSync(synthPath, "utf-8"));
  const tableFiles = readdirSync(dir).filter((f) => f.endsWith("table.md"));
  if (tableFiles.length === 0) {
    console.error("mint-audit: no *table.md miner files in mint dir");
    process.exit(2);
  }
  const lines = tableFiles.flatMap((f) =>
    parseTableLines(f, readFileSync(join(dir, f), "utf-8")),
  );
  const report = audit(synth.rows ?? [], synth.exclusions ?? [], lines);

  console.log(
    `mint-audit: ${lines.length} table lines · ${report.matchedCount} accounted · ${report.unmatched.length} UNMATCHED · ${report.inferredCandidates.length} inferred-parity candidates`,
  );
  for (const u of report.unmatched) {
    console.log(`  ABSENCE  [${u.file}] ${u.capability}`);
  }
  for (const c of report.inferredCandidates) {
    console.log(`  INFERRED? [${c.line.file}] "${c.line.capability}" -> row ${c.rowId} (cohort evidence lacks inferred:true — adjudicate)`);
  }
  if (strict && report.unmatched.length > 0) process.exit(1);
  process.exit(0);
}
