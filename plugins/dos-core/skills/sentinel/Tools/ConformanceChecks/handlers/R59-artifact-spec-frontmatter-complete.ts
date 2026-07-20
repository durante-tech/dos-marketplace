/**
 * R59 (RFC-0098 §13.1) — Atomic-design catalog spec files must declare the 14
 * required frontmatter keys.
 *
 * Background: the 5-seat Council ratified the atomic-design spec format on
 * 2026-05-13 (`Docs/AtomicDesign/artifact-catalog/source/_spec-template.md`
 * §"Frontmatter schema"). Every spec at `source/{atoms,molecules,organisms,
 * templates,pages}/*.md` must carry: id, layer, status, description, producer,
 * location, format, fields, composes, parent_template, instances_at,
 * validates_against, lineage, references.
 *
 * Pass: all spec files declare all 14 required keys (empty values OK).
 * Fail: at least one spec missing one or more required keys.
 * Not_applicable: catalog directory does not exist.
 *
 * Tier: warning per RFC-0085 council default for new presence checks.
 * Exclusions: filename-prefix `_` (e.g., `_spec-template.md` which has 0 fields
 * by design) and the four meta files (INDEX/README/FINDINGS/GRAPH).md — see
 * `listSpecFiles()` for the exact filter.
 *
 * Parser: uses the `yaml` npm parser (v2.8.x, already in root deps) rather
 * than regex key-detection. RFC-0098 §15.1 CODE-BS-2 documents the regex
 * false-positive surface (commented-out keys, value substrings, nested-key
 * shadows of a missing top-level key) that drove the v0.0.18 A9 swap. The
 * verdict matrix is unchanged on the existing corpus — see the byte-identical
 * regression in `R59-artifact-spec-frontmatter-complete.test.ts`.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import type { CheckContext, CheckResult } from "../types.ts";
import { listSpecFiles } from "../lib/catalog-layers.ts";

const REQUIREMENT =
  "Every atomic-design catalog spec at Docs/AtomicDesign/artifact-catalog/source/{layer}/*.md declares all 14 required frontmatter keys";

const REQUIRED_KEYS = [
  "id",
  "layer",
  "status",
  "description",
  "producer",
  "location",
  "format",
  "fields",
  "composes",
  "parent_template",
  "instances_at",
  "validates_against",
  "lineage",
  "references",
];

// Layer enumeration + spec-file listing delegated to
// `lib/catalog-layers.ts::listSpecFiles()` (RFC-0098 §15.1 CODE-BS-3 / A10).
// Catalog subdirs are discovered at handler-init time; new layers in
// `Docs/AtomicDesign/artifact-catalog/source/` are picked up automatically
// without code change.

function readFrontmatter(content: string): string | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

/**
 * Parse the frontmatter block and return its top-level key set. Returns `null`
 * if the YAML cannot be parsed as a mapping at all — caller treats that the
 * same as "no frontmatter" (it cannot have required keys).
 *
 * RFC-0098 §15.1 CODE-BS-2 false-positives the regex predecessor used to admit
 * — all eliminated because the parser only surfaces real top-level keys:
 *   1. commented-out keys (`# id: x`)            — YAML comment, never a key
 *   2. quoted value substrings (`"id: foo"`)     — value, not a key
 *   3. nested keys (`producer:\n  id: x`)        — depth-1, not top-level
 *
 * Strictness: parses with `strict: false` + `logLevel: "silent"`. The regex
 * predecessor was implicitly tolerant of value-level YAML quote irregularities
 * (e.g., `description: ' ' (unchecked) or 'x' (checked)` — a quote-syntax issue
 * in the *value* of a top-level key). The lenient parser surfaces such cases
 * as warnings while still resolving the top-level key set. This preserves the
 * regex-era verdict on the v0.0.18 corpus where ~20/87 specs have legacy
 * quote-mismatches in description/format value strings. Top-level key
 * identification is unaffected — the only thing the lenient mode rescues is
 * the parser refusing to return *any* keys when a single value scalar is
 * malformed. The A9 contract (verdict-stable mechanism swap) requires this.
 */
function parseTopLevelKeys(fm: string): Set<string> | null {
  let parsed: unknown;
  try {
    parsed = parseYaml(fm, { strict: false, logLevel: "silent" });
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return new Set(Object.keys(parsed as Record<string, unknown>));
}

export async function r59ArtifactSpecFrontmatterComplete(ctx: CheckContext): Promise<CheckResult> {
  const catalogRoot = join(ctx.repoRoot, "Docs", "AtomicDesign", "artifact-catalog", "source");
  if (!existsSync(catalogRoot)) {
    return {
      rId: "R59",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["catalog directory Docs/AtomicDesign/artifact-catalog/source/ not found"],
    };
  }

  const specs = listSpecFiles(catalogRoot);
  if (specs.length === 0) {
    return { rId: "R59", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no spec files found in catalog layers"] };
  }

  const fails: string[] = [];
  let scanned = 0;
  for (const path of specs) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    scanned++;
    const fm = readFrontmatter(content);
    if (!fm) {
      fails.push(`${path}: no YAML frontmatter`);
      continue;
    }
    const keys = parseTopLevelKeys(fm);
    if (keys === null) {
      fails.push(`${path}: no YAML frontmatter`);
      continue;
    }
    const missing = REQUIRED_KEYS.filter((k) => !keys.has(k));
    if (missing.length > 0) {
      fails.push(`${path}: missing keys [${missing.join(", ")}]`);
    }
  }

  if (fails.length === 0) {
    return { rId: "R59", requirement: REQUIREMENT, status: "pass", evidence: [`${scanned} spec files; all 14 required keys present`] };
  }
  return {
    rId: "R59",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${scanned} specs incomplete:`, ...fails.slice(0, 5)],
  };
}
