/**
 * R61 (RFC-0098 §13.3) — Atomic-design catalog spec's frontmatter `fields:`
 * names should appear as keys in the spec's first live `instances_at:` glob
 * target (spot-check, not exhaustive).
 *
 * Naming history:
 * ---------------
 * Originally registered as `presence.artifact-spec-matches-producer`. Renamed
 * to `presence.artifact-spec-sample-matches-producer` 2026-05-25 (v0.0.18 A7,
 * cascade-source RFC-0098 §15.1 SPEC-BS-1). Cato cross-vendor audit flagged
 * the original name as overpromising: "matches-producer" suggests full
 * producer-parity verification, but the implementation samples first file
 * from first glob. New slug is honest about the sampling semantic.
 *
 * Background: Seat 4 Council proposal during 2026-05-13 catalog format-debate
 * (`Docs/AtomicDesign/artifact-catalog/README.md`). Detects spec-vs-instance
 * field drift mechanically via spot-check.
 *
 * Pass: every `fields[].name` declared in spec frontmatter appears as a YAML key
 * (or stringified JSON key) in the first matching instance.
 * Fail: declared field name not found in any live instance.
 * Not_applicable:
 *   - catalog directory missing
 *   - spec has empty `fields:` block
 *   - spec's `instances_at:` glob resolves to zero files
 *   - spec's `layer:` is `template` (template-layer specs describe
 *     template-of-templates which legitimately may not have live instances yet —
 *     codified explicitly 2026-05-25 per A7 applicability refinement)
 *
 * Tier: warning per RFC-0085 council default.
 * Sampling: spot-checks first matching instance only; not exhaustive validation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { listSpecFiles } from "../lib/catalog-layers.ts";

const REQUIREMENT =
  "Catalog spec `fields[].name` entries should be present in the spec's first live `instances_at:` target (spot-check sample)";

// Layer enumeration + spec-file listing delegated to
// `lib/catalog-layers.ts::listSpecFiles()` (RFC-0098 §15.1 CODE-BS-3 / A10).

function parseFrontmatter(content: string): { fm: string } | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? { fm: m[1] } : null;
}

function extractFieldNames(fm: string): string[] {
  // Look for `fields:` block; pull subsequent `  - name: <ident>` lines until a blank or new top-level key.
  const fieldsIdx = fm.search(/^fields\s*:/m);
  if (fieldsIdx < 0) return [];
  const rest = fm.slice(fieldsIdx);
  const names: string[] = [];
  for (const line of rest.split("\n").slice(1)) {
    if (/^[a-z_][a-z0-9_]*:/i.test(line)) break; // next top-level key
    const m = line.match(/^\s+-\s+name:\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if (m) names.push(m[1]);
  }
  return names;
}

function extractInstancesGlob(fm: string): string | null {
  // first `instances_at:` entry — handle both `- path` and `instances_at: [glob]` shapes
  const idx = fm.search(/^instances_at\s*:/m);
  if (idx < 0) return null;
  const rest = fm.slice(idx).split("\n").slice(1);
  for (const line of rest) {
    if (/^[a-z_][a-z0-9_]*:/i.test(line)) break;
    const m = line.match(/^\s+-\s+(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function extractLayer(fm: string): string | null {
  // single-line `layer: <value>` at top-level (catalog frontmatter convention)
  const m = fm.match(/^layer\s*:\s*([A-Za-z_][A-Za-z0-9_-]*)/m);
  return m ? m[1] : null;
}

function expandGlobBase(glob: string, repoRoot: string): string | null {
  // Naive resolution — replace ~ and {layer} placeholders. We accept the first
  // concrete-looking path component as the lookup target.
  let p = glob.replace(/^~/, process.env.HOME ?? "~");
  // strip globstar / wildcards for first-file sampling
  p = p.replace(/\*+/g, "").replace(/\{[^}]+\}/g, "").replace(/\/+/g, "/");
  if (!p.startsWith("/")) p = join(repoRoot, p);
  return p;
}

// Bounded depth-first search for the first regular file under `dir`, preferring
// files at the current level before descending. Capped at MAX_SAMPLE_DEPTH so a
// deeply nested (or symlink-cyclic) tree cannot hang the conformance scan.
const MAX_SAMPLE_DEPTH = 4;

function firstFileInTree(dir: string, depth: number): string | null {
  let entries: string[];
  try { entries = readdirSync(dir).sort(); } catch { return null; }
  const subdirs: string[] = [];
  for (const name of entries) {
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (st.isFile()) return full; // shallowest file wins — keeps single-level globs byte-stable
      if (st.isDirectory()) subdirs.push(full);
    } catch {}
  }
  if (depth <= 0) return null;
  for (const sub of subdirs) {
    const found = firstFileInTree(sub, depth - 1);
    if (found) return found;
  }
  return null;
}

function firstFileUnder(prefix: string): string | null {
  try {
    if (!existsSync(prefix)) {
      // The expanded glob base is usually a glued phantom: `MEMORY/WORK/**/PRD.md`
      // collapses to `MEMORY/WORK/PRD.md`, which does not exist. Fall back to the
      // parent dir and walk it RECURSIVELY — the dominant catalog instance
      // families (`MEMORY/WORK/**/PRD.md`, `…/*/PRD.md`, `…/{slug}/PRD.md`) live
      // one or more dirs below a wildcard segment, so the previous
      // direct-children-only scan silently skipped every one of them (R61 never
      // sampled its highest-volume target).
      const parent = dirname(prefix);
      if (!existsSync(parent)) return null;
      return firstFileInTree(parent, MAX_SAMPLE_DEPTH);
    }
    const stat = statSync(prefix);
    if (stat.isFile()) return prefix;
    if (stat.isDirectory()) return firstFileInTree(prefix, MAX_SAMPLE_DEPTH);
  } catch {}
  return null;
}

export async function r61ArtifactSpecSampleMatchesProducer(ctx: CheckContext): Promise<CheckResult> {
  const catalogRoot = join(ctx.repoRoot, "Docs", "AtomicDesign", "artifact-catalog", "source");
  if (!existsSync(catalogRoot)) {
    return { rId: "R61", requirement: REQUIREMENT, status: "not_applicable", evidence: ["catalog directory not found"] };
  }
  const specs = listSpecFiles(catalogRoot);
  if (specs.length === 0) {
    return { rId: "R61", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no spec files"] };
  }

  const fails: string[] = [];
  let scanned = 0;
  let applicable = 0;
  let templateSkipped = 0;
  for (const path of specs) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    scanned++;
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;
    // RFC-0098 §13.3 + A7 applicability refinement: template-layer specs
    // legitimately may have no live instances yet (they describe templates of
    // templates). Skip explicitly so a template author cannot trigger a fail
    // by leaving instances_at empty during scaffolding.
    if (extractLayer(parsed.fm) === "template") { templateSkipped++; continue; }
    const names = extractFieldNames(parsed.fm);
    if (names.length === 0) continue; // empty fields — skip
    const glob = extractInstancesGlob(parsed.fm);
    if (!glob) continue;
    const base = expandGlobBase(glob, ctx.repoRoot);
    if (!base) continue;
    const sampleFile = firstFileUnder(base);
    if (!sampleFile) continue;
    applicable++;

    let sample: string;
    try { sample = readFileSync(sampleFile, "utf-8"); } catch { continue; }

    const missing = names.filter((n) => !new RegExp(`(?:^|\\s|")${n}(?:"|:|\\s|$)`, "m").test(sample));
    if (missing.length > 0) {
      fails.push(`${path} (sample: ${sampleFile}): declared fields not found [${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ", ..." : ""}]`);
    }
  }

  if (applicable === 0) {
    return {
      rId: "R61",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${scanned} specs scanned; ${templateSkipped} template-layer skipped; none of the remainder had non-empty fields with resolvable instances_at`],
    };
  }
  if (fails.length === 0) {
    return {
      rId: "R61",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`${applicable}/${applicable} applicable specs: declared fields found in sample instance (${templateSkipped} template-layer skipped)`],
    };
  }
  return {
    rId: "R61",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${applicable} applicable specs drift (${templateSkipped} template-layer skipped):`, ...fails.slice(0, 5)],
  };
}
