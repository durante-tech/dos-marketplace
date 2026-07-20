/**
 * R60 (RFC-0098 §13.2) — Atomic-design catalog spec bodies must carry 6 sections
 * in fixed order: Description, Internal Blocks, Examples, Lineage, Edge Cases,
 * Drift Watch.
 *
 * Background: 2026-05-13 5-seat Council ratification of the spec body shape
 * (`Docs/AtomicDesign/artifact-catalog/source/_spec-template.md` §"Body
 * sections"). Drift Watch was added 2026-05-13 in response to the reflection-
 * JSONL audit finding.
 *
 * Pass: all spec bodies have all 6 sections, in correct order, populated or
 * empty.
 * Fail: missing section OR section out of order.
 * Not_applicable: catalog directory not found OR specs have empty body.
 *
 * Tier: warning per RFC-0085 council default for new presence checks.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { listSpecFiles } from "../lib/catalog-layers.ts";
import { stripCodeFences } from "../lib/markdown-catalog.ts";

const REQUIREMENT =
  "Every catalog spec body has 6 sections in fixed order: Description / Internal Blocks / Examples / Lineage / Edge Cases / Drift Watch";

const REQUIRED_SECTIONS = [
  "Description",
  "Internal Blocks",
  "Examples",
  "Lineage",
  "Edge Cases",
  "Drift Watch",
];

// Layer enumeration + spec-file listing delegated to
// `lib/catalog-layers.ts::listSpecFiles()` (RFC-0098 §15.1 CODE-BS-3 / A10).

function bodyAfterFrontmatter(content: string): string {
  const m = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return m ? m[1] : content;
}

function findSectionsInOrder(body: string): { found: string[]; outOfOrder: boolean } {
  const found: string[] = [];
  let lastIdx = -1;
  let outOfOrder = false;
  for (const section of REQUIRED_SECTIONS) {
    const re = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
    const m = body.match(re);
    if (m && m.index !== undefined) {
      if (m.index < lastIdx) outOfOrder = true;
      found.push(section);
      lastIdx = m.index;
    }
  }
  return { found, outOfOrder };
}

export async function r60ArtifactSpecBodySections(ctx: CheckContext): Promise<CheckResult> {
  const catalogRoot = join(ctx.repoRoot, "Docs", "AtomicDesign", "artifact-catalog", "source");
  if (!existsSync(catalogRoot)) {
    return {
      rId: "R60",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["catalog directory not found"],
    };
  }

  const specs = listSpecFiles(catalogRoot);
  if (specs.length === 0) {
    return { rId: "R60", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no spec files found"] };
  }

  const fails: string[] = [];
  let scanned = 0;
  for (const path of specs) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    scanned++;
    const body = bodyAfterFrontmatter(content);
    if (body.trim().length === 0) continue; // empty body — skip
    // Strip fenced code blocks first so a `## Header` shown INSIDE a ```markdown
    // example does not satisfy the required-section check (SENT-09/SENT-03; the
    // same fence-strip R82/R63 use). stripCodeFences preserves line count, so the
    // in-order index comparison below stays meaningful.
    const { found, outOfOrder } = findSectionsInOrder(stripCodeFences(body));
    const missing = REQUIRED_SECTIONS.filter((s) => !found.includes(s));
    if (missing.length > 0 || outOfOrder) {
      const reasons: string[] = [];
      if (missing.length > 0) reasons.push(`missing [${missing.join(", ")}]`);
      if (outOfOrder) reasons.push("sections out of order");
      fails.push(`${path}: ${reasons.join("; ")}`);
    }
  }

  if (fails.length === 0) {
    return { rId: "R60", requirement: REQUIREMENT, status: "pass", evidence: [`${scanned} spec files; all 6 sections present in order`] };
  }
  return {
    rId: "R60",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${scanned} specs malformed:`, ...fails.slice(0, 5)],
  };
}
