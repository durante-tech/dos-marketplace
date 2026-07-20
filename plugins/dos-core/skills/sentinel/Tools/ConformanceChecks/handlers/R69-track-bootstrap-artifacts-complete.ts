/**
 * R69 — Every track-bootstrap parent PRD (slug matching
 * `*-research-package-bootstrap`) MUST have all 6 named stack-level artifacts
 * present in `MEMORY/ARTIFACTS/{STACK}/`:
 *
 *   - MILESTONES.md
 *   - ROADMAP.md
 *   - dag-deps.md
 *   - backend-integration-matrix.md
 *   - at least one `api-catalog-*-complete.md`
 *   - at least one `*-package-design.md`
 *
 * Provenance: V16 PRD `MEMORY/CANONICAL/track-bootstrap-pattern.md` (Tier 4).
 * Mechanizes the 7-artifact invariant from `~/.claude/DOS/Scaffolds/track-bootstrap/README.md`
 * after the 3rd-instance crystallization (Google Merchant 2026-05-15).
 *
 * Why this rule exists: without enforcement, a partial track-bootstrap run
 * can ship a parent PRD without the catalog/design/roadmap/matrix artifacts
 * that downstream sub-track PRDs depend on. The pattern's load-bearing intent
 * is catalog accuracy + parallelizability — both fail when artifacts are missing.
 *
 * Detection:
 *   1. Walk MEMORY/WORK/{active,archived,*}/  for PRD.md files
 *   2. For each PRD, parse frontmatter `slug:` field
 *   3. Match slug pattern `*-research-package-bootstrap`
 *   4. Extract stack name from slug: pattern is `{TS_UTC}_{STACK}-research-package-bootstrap`
 *   5. Check artifact presence in `<repoRoot>/MEMORY/ARTIFACTS/{STACK}/`
 *
 * Status:
 *   - pass: every matched PRD has all 6 artifact slots populated
 *   - fail: at least one PRD has missing artifact(s); evidence lists each
 *     missing file per PRD with the PRD's path as `loc`
 *   - not_applicable: MEMORY/WORK/ absent, OR no track-bootstrap PRDs found
 *
 * Tier: warning (operator-curated; doesn't block, surfaces drift)
 *
 * Test seam: ctx.repoRoot — fixture-friendly per established convention.
 */

import { existsSync, readdirSync, readFileSync, statSync, type Stats } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every track-bootstrap parent PRD (slug ending in -research-package-bootstrap) must have all 6 named artifacts in MEMORY/ARTIFACTS/{STACK}/: MILESTONES.md, ROADMAP.md, dag-deps.md, backend-integration-matrix.md, ≥1 api-catalog-*-complete.md, ≥1 *-package-design.md";

const FIXED_ARTIFACTS = [
  "MILESTONES.md",
  "ROADMAP.md",
  "dag-deps.md",
  "backend-integration-matrix.md",
] as const;

const SLUG_RE = /^(?:\d{8}-\d{6})_(.+)-research-package-bootstrap$/;

function readFrontmatter(content: string): string | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

function extractSlug(fm: string): string | null {
  const m = fm.match(/^slug:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

/** Walk a directory recursively, collecting PRD.md files at any depth.
 *  Symlinks and errors are skipped silently. */
function findPrdMd(root: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(root, entry);
    let stat: Stats;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      out.push(...findPrdMd(full));
    } else if (entry === "PRD.md") {
      out.push(full);
    }
  }
  return out;
}

function listArtifactsForStack(repoRoot: string, stack: string): string[] {
  const dir = join(repoRoot, "MEMORY", "ARTIFACTS", stack);
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

interface MissingReport {
  prdPath: string;
  slug: string;
  stack: string;
  missing: string[];
}

function auditPrd(
  prdPath: string,
  repoRoot: string,
): MissingReport | null {
  let content: string;
  try {
    content = readFileSync(prdPath, "utf-8");
  } catch {
    return null;
  }
  const fm = readFrontmatter(content);
  if (!fm) return null;
  const slug = extractSlug(fm);
  if (!slug) return null;
  const m = slug.match(SLUG_RE);
  if (!m) return null;
  const stack = m[1];
  const artifactNames = listArtifactsForStack(repoRoot, stack);
  const set = new Set(artifactNames);

  const missing: string[] = [];
  for (const fixed of FIXED_ARTIFACTS) {
    if (!set.has(fixed)) missing.push(fixed);
  }
  if (!artifactNames.some((n) => /^api-catalog-.+-complete\.md$/.test(n))) {
    missing.push("api-catalog-*-complete.md (none found)");
  }
  if (!artifactNames.some((n) => /-package-design\.md$/.test(n))) {
    missing.push("*-package-design.md (none found)");
  }

  if (missing.length === 0) return null;
  return { prdPath, slug, stack, missing };
}

export async function r69TrackBootstrapArtifactsComplete(
  ctx: CheckContext,
): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  if (!existsSync(workRoot)) {
    return {
      rId: "R69",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`MEMORY/WORK not found at ${workRoot}`],
    };
  }

  const allPrds = findPrdMd(workRoot);
  const trackBootstrapPrds: string[] = [];
  for (const prdPath of allPrds) {
    const content = (() => {
      try {
        return readFileSync(prdPath, "utf-8");
      } catch {
        return null;
      }
    })();
    if (!content) continue;
    const fm = readFrontmatter(content);
    if (!fm) continue;
    const slug = extractSlug(fm);
    if (!slug) continue;
    if (SLUG_RE.test(slug)) trackBootstrapPrds.push(prdPath);
  }

  if (trackBootstrapPrds.length === 0) {
    return {
      rId: "R69",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `no track-bootstrap PRDs found under ${workRoot} (slug pattern: *-research-package-bootstrap)`,
      ],
    };
  }

  const reports: MissingReport[] = [];
  for (const prdPath of trackBootstrapPrds) {
    const report = auditPrd(prdPath, ctx.repoRoot);
    if (report) reports.push(report);
  }

  if (reports.length === 0) {
    return {
      rId: "R69",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${trackBootstrapPrds.length} track-bootstrap PRD(s) audited; all 6 artifacts present per stack`,
      ],
    };
  }

  const evidence: string[] = [];
  for (const r of reports) {
    evidence.push(
      `${r.prdPath} (stack=${r.stack}): missing in MEMORY/ARTIFACTS/${r.stack}/: ${r.missing.join(", ")}`,
    );
  }
  return {
    rId: "R69",
    requirement: REQUIREMENT,
    status: "fail",
    evidence,
    loc: reports[0].prdPath,
  };
}
