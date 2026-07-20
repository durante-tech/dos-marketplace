/**
 * R86 — Atomic-design catalog spec `status:` must be one of the enum values the
 * catalog declares for itself in `_spec-template.md`: draft | stable | deprecated.
 *
 * Background: the 2026-06-26 catalog self-compliance audit found two specs with
 * out-of-enum status — `pages/doctrine-v007-enhanced.md` (status: superseded)
 * and `pages/sprint-v012-active.md` (status: active) — while the declared
 * enum value `deprecated` was used zero times. R59 (frontmatter completeness)
 * confirms the `status` KEY is present but is silent on the VALUE; this rule
 * closes that gap. The honest remediation for the two offenders is
 * `superseded -> deprecated` (the doc already carries a `superseded_by` key)
 * and `active -> draft` (carry the sprint state elsewhere), not widening the
 * enum.
 *
 * Pass: every catalog spec's `status` value is in the declared enum.
 * Fail: at least one spec carries an out-of-enum status.
 * Not_applicable: catalog directory does not exist / no spec files.
 *
 * Tier: warning (RFC-0085 council default for new presence checks). Ships in
 * warn-mode so the two known offenders surface without blocking until the
 * remediation pass remaps them.
 *
 * Enumeration + spec-file listing delegated to `lib/catalog-layers.ts`
 * (RFC-0098 §15.1 CODE-BS-3 / A10) — new layers picked up automatically.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import type { CheckContext, CheckResult } from "../types.ts";
import { listSpecFiles } from "../lib/catalog-layers.ts";

const REQUIREMENT =
  "Every atomic-design catalog spec `status:` is one of the _spec-template.md enum values (draft|stable|deprecated)";

// Source of truth: Docs/AtomicDesign/artifact-catalog/source/_spec-template.md
// §"Frontmatter schema" — `status | enum: draft|stable|deprecated`.
const STATUS_ENUM = new Set(["draft", "stable", "deprecated"]);

function readFrontmatter(content: string): string | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

function statusValue(fm: string): string | null {
  let parsed: unknown;
  try {
    parsed = parseYaml(fm, { strict: false, logLevel: "silent" });
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const s = (parsed as Record<string, unknown>).status;
  return s == null ? null : String(s);
}

export async function r86CatalogStatusEnumValid(ctx: CheckContext): Promise<CheckResult> {
  const catalogRoot = join(ctx.repoRoot, "Docs", "AtomicDesign", "artifact-catalog", "source");
  if (!existsSync(catalogRoot)) {
    return { rId: "R86", requirement: REQUIREMENT, status: "not_applicable", evidence: ["catalog directory Docs/AtomicDesign/artifact-catalog/source/ not found"] };
  }

  const specs = listSpecFiles(catalogRoot);
  if (specs.length === 0) {
    return { rId: "R86", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no spec files found in catalog layers"] };
  }

  const fails: string[] = [];
  let scanned = 0;
  for (const path of specs) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    scanned++;
    const fm = readFrontmatter(content);
    if (!fm) continue; // frontmatter presence is R59's concern
    const status = statusValue(fm);
    if (status == null) continue; // missing key is R59's concern
    if (!STATUS_ENUM.has(status)) {
      fails.push(`${path}: status="${status}" (not in {draft, stable, deprecated})`);
    }
  }

  if (fails.length === 0) {
    return { rId: "R86", requirement: REQUIREMENT, status: "pass", evidence: [`${scanned} spec files; all status values in enum`] };
  }
  return {
    rId: "R86",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${scanned} specs out-of-enum:`, ...fails.slice(0, 5)],
  };
}
