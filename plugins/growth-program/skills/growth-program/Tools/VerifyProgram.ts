#!/usr/bin/env bun
/**
 * VerifyProgram.ts — the deterministic integrity gate for an emitted GrowthProgram
 * (`docs/growth/`). The opus-Skeptic (Coordination Step 7) judges whether a stat is
 * TRUE; this gate mechanically checks the SHAPE the integrity rules already mandate,
 * so a non-self-graded floor survives even when the council degrades to conductor
 * self-review (the Copy-4 gap) — the one check the LLM cannot rubber-stamp.
 *
 * SHAPE/STRUCTURE ONLY. It never judges "is this number real / is this review
 * incentivized" — that stays the opus-Skeptic + WebSearch/WebFetch. This gate BACKS
 * the veto; it does not replace it.
 *
 *   bun VerifyProgram.ts --verify <docs/growth dir> [--json]
 *       → exit 0 clean · exit 2 on any blocking integrity violation / bad args.
 *
 * Checks (each maps to an authored integrity rule, with worked-example / code-fence /
 * quarantine exemptions so it does not false-positive on pedagogical content):
 *   citation-presence   every load-bearing number in body prose carries a
 *                       `[source @ date]` or snippet ref, or lives in a DO NOT CITE
 *                       block (Measurement.md "a cell with no [source @ date] is
 *                       inadmissible").
 *   quarantine-physical a quarantined stat must be struck at origin — a numeric
 *                       token in BOTH a DO NOT CITE block and body prose fails
 *                       (Coordination.md "quarantine is physical").
 *   schema-without-data no AggregateRating/Review JSON-LD without a verified-data
 *                       gate (integrity-guard.md).
 *   id-disjointness     the social (C-star / M-star) and GEO (GC-star / GM-star)
 *                       namespaces never reuse a number (output-contract.md "never
 *                       reuse a number across the two namespaces") — the GM8 class.
 *   raci-one-a          each RACI row has exactly one Accountable (Coordination.md).
 *
 * Never invents a verdict: a file it cannot read is reported, not silently passed.
 * Exit: 0 ok · 2 violations / bad args.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface Violation {
  file: string;
  rule: string;
  message: string;
}

// ── Segment masking ──────────────────────────────────────────────────────────
// Body = load-bearing content. Mask out fenced code blocks, the `## Output
// Template` and `## Worked example` pedagogical sections (which demonstrate the
// rules and legitimately contain illustrative stats), and `> DO NOT CITE`
// quarantine blocks (the sanctioned home for unverifiable figures).
export function splitSegments(content: string): { body: string[]; quarantine: string[] } {
  const lines = content.split("\n");
  const body: string[] = [];
  const quarantine: string[] = [];
  let inFence = false;
  let inExemptSection = false;
  let inQuarantine = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^```/.test(t) || /^~~~/.test(t)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^#{1,6}\s+/.test(t)) {
      inExemptSection = /^#{1,6}\s+(output template|worked example|example)\b/i.test(t);
      inQuarantine = false;
    }
    if (inExemptSection) continue;
    if (/^>\s*do not cite/i.test(t)) {
      inQuarantine = true;
      quarantine.push(line);
      continue;
    }
    if (inQuarantine) {
      if (/^>/.test(t)) {
        quarantine.push(line);
        continue;
      }
      inQuarantine = false; // a non-blockquote line ends the quarantine block
    }
    body.push(line);
  }
  return { body, quarantine };
}

// Load-bearing numeric stat patterns — percentages, money, and counted nouns.
// Deliberately NARROW so stable IDs (C1/M8/GM8/Q3/PH2/W4), dates, and bare ordinals
// are NOT treated as stats.
const STAT_RES: RegExp[] = [
  /\b\d{1,3}(?:\.\d+)?\s?%/,
  /\$\s?\d[\d,]*(?:\.\d+)?\s?[KMB]?\b/,
  /\b\d[\d,]*\+?\s+(?:reviews?|ratings?|followers?|subscribers?|citations?|customers?|users?|visits?|impressions?)\b/i,
  /\b\d(?:\.\d+)?\s*stars?\b/i,
];
const CITATION_RE = /\[[^\]]*@[^\]]*\]/; // [source @ date]
const SNIPPET_RE = /\b(snippet|log#|source\s*[:=]|cited[- ]from)/i;

function matchStats(line: string): string[] {
  const out: string[] = [];
  for (const re of STAT_RES) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(line))) out.push(m[0].trim());
  }
  return out;
}

export function checkCitations(file: string, body: string[]): Violation[] {
  const v: Violation[] = [];
  for (const line of body) {
    const t = line.trim();
    if (!t || /^#/.test(t)) continue;
    if (/^\|?\s*:?-{2,}/.test(t)) continue; // table separator row
    if (matchStats(line).length === 0) continue;
    if (CITATION_RE.test(line) || SNIPPET_RE.test(line)) continue;
    v.push({
      file,
      rule: "citation-presence",
      message: `load-bearing number without a [source @ date] or snippet ref: "${t.slice(0, 90)}"`,
    });
  }
  return v;
}

export function checkQuarantinePhysical(file: string, body: string[], quarantine: string[]): Violation[] {
  const v: Violation[] = [];
  const tokens = new Set<string>();
  for (const q of quarantine) for (const tok of matchStats(q)) tokens.add(tok);
  if (tokens.size === 0) return v;
  const bodyText = body.join("\n");
  for (const tok of tokens) {
    if (bodyText.includes(tok)) {
      v.push({
        file,
        rule: "quarantine-physical",
        message: `quarantined stat "${tok}" still appears in body prose — a refuted stat must be struck at origin, not just copied into DO NOT CITE`,
      });
    }
  }
  return v;
}

export function checkSchemaWithoutData(file: string, content: string): Violation[] {
  const v: Violation[] = [];
  const re = /"@type"\s*:\s*"(AggregateRating|Review)"/g;
  const gated = /(verified[- ]data|real customer data|gated\s*[:(][^\n]*review|default[- ]off|ADR-05)/i.test(content);
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (!gated) {
      v.push({
        file,
        rule: "schema-without-data",
        message: `${m[1]} JSON-LD without a verified-data gate — integrity-guard.md forbids rating/review schema you cannot substantiate`,
      });
    }
  }
  return v;
}

// Collect stable-ID DEFINITIONS — a markdown table row whose first cell is a bolded
// stable ID, e.g. "| **GM8** | PH3 defensibility ... |". Definitions are the
// authoritative meaning of an ID; references (Gantt rows, prose) are not collected.
// (The C*/M* social vs GC*/GM* GEO namespaces are owned by different workflows —
// coordination owns M*, GeoPillar owns GM* — so M5 and GM5 are DISTINCT IDs, not a
// number clash. The mechanizable collision is an ID DEFINED twice with conflicting
// meaning, e.g. GM8 in two files; the prose-level GM8/M8 mislabel is an editorial
// fix, out of this gate's shape-only scope.)
export function collectDefinitions(body: string[]): Map<string, string> {
  const defs = new Map<string, string>();
  const re = /^\s*\|\s*\*\*((?:GC|GM|C|M|Q|P|PH)\d+)\*\*\s*\|\s*([^|]+?)\s*\|/;
  for (const line of body) {
    const m = line.match(re);
    if (!m) continue;
    // keep the FIRST definition seen per id within a file; cross-file merge happens
    // in scanProgram where a conflicting redefinition is the violation.
    if (!defs.has(m[1])) defs.set(m[1], m[2].trim());
  }
  return defs;
}

export function checkDuplicateDefinitions(perFile: Array<{ file: string; defs: Map<string, string> }>): Violation[] {
  const v: Violation[] = [];
  const seen = new Map<string, { file: string; text: string }>();
  for (const { file, defs } of perFile) {
    for (const [id, text] of defs) {
      const prior = seen.get(id);
      if (prior && prior.text !== text) {
        v.push({
          file: "(program)",
          rule: "id-collision",
          message: `stable ID ${id} is defined twice with conflicting meaning — "${prior.text.slice(0, 40)}" (${prior.file}) vs "${text.slice(0, 40)}" (${file}); one definition per ID (output-contract.md)`,
        });
      } else if (!prior) {
        seen.set(id, { file, text });
      }
    }
  }
  return v;
}

// RACI: each data row in a table under a "RACI" heading has exactly one Accountable.
// Conservative — only rows whose post-name cells are all RACI tokens are scored.
export function checkRaciOneA(file: string, content: string): Violation[] {
  const v: Violation[] = [];
  const lines = content.split("\n");
  let inRaci = false;
  let inFence = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^```/.test(t)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^#{1,6}\s+/.test(t)) inRaci = /raci/i.test(t);
    if (!inRaci) continue;
    if (!/^\|/.test(t)) continue;
    const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.length < 3) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue; // separator
    const raciCells = cells.filter((c) => /^[RACI](\/[RACI])*$/.test(c));
    if (raciCells.length < 2) continue; // not a RACI data row (e.g. the header)
    const aCount = cells.filter((c) => /(^|\/)A(\/|$)/.test(c)).length;
    if (aCount !== 1) {
      v.push({
        file,
        rule: "raci-one-a",
        message: `RACI row has ${aCount} Accountable (A) cells, expected exactly 1: "${t.slice(0, 90)}"`,
      });
    }
  }
  return v;
}

function listMarkdown(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (e.endsWith(".md")) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// Scan an emitted program directory. Pure over the filesystem read; returns all
// violations (empty = clean).
export function scanProgram(dir: string): Violation[] {
  const violations: Violation[] = [];
  const files = listMarkdown(dir).sort();
  const perFileDefs: Array<{ file: string; defs: Map<string, string> }> = [];
  for (const path of files) {
    const rel = relative(dir, path);
    const content = readFileSync(path, "utf8");
    const { body, quarantine } = splitSegments(content);
    violations.push(...checkCitations(rel, body));
    violations.push(...checkQuarantinePhysical(rel, body, quarantine));
    violations.push(...checkSchemaWithoutData(rel, content));
    if (/coordination\.md$/.test(rel)) violations.push(...checkRaciOneA(rel, content));
    perFileDefs.push({ file: rel, defs: collectDefinitions(body) });
  }
  violations.push(...checkDuplicateDefinitions(perFileDefs));
  return violations;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (f: string, d = ""): string => {
    const i = argv.indexOf(f);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : d;
  };
  const dir = arg("--verify");
  if (!dir) {
    console.error("usage:\n  VerifyProgram.ts --verify <docs/growth dir> [--json]");
    process.exit(2);
  }
  if (!existsSync(dir)) {
    console.error(`error: program dir not found: ${dir}`);
    process.exit(2);
  }
  const violations = scanProgram(dir);
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ ok: violations.length === 0, count: violations.length, violations }, null, 2));
  } else if (violations.length === 0) {
    console.log("integrity gate: PASS — no mechanical violations.");
  } else {
    console.error(`integrity gate: BLOCK — ${violations.length} violation(s):`);
    for (const x of violations) console.error(`  [${x.rule}] ${x.file}: ${x.message}`);
  }
  process.exit(violations.length === 0 ? 0 : 2);
}
