/**
 * R99 — visibility-roster-parity. Canonical-format campaign 2026-07-06.
 *
 * RFC-0011 §6.3 / Appendix C classifies every adoption-cohort pack as
 * public | internal | beta. The Release Locker and edition compilers read the
 * pack's OWN frontmatter (`src/SKILL.md` `visibility:`), not the RFC roster —
 * so the two surfaces can drift apart silently. They did: Sentinel shipped
 * `visibility: public` for weeks while Appendix C classed it internal
 * (resolved by operator declassification 2026-07-06, §6.3 amendment note).
 * This rule makes the next drift surface instead of persist.
 *
 * Enforcement: for every pack ROW in RFC-0011 Appendix C, the pack's
 * `src/SKILL.md` frontmatter `visibility:` MUST equal the roster value, and
 * the pack source dir MUST exist under Packs/ (a rostered pack with no
 * source — the 2026-05-15 retired-but-still-rostered state — is a failure).
 *
 * Deliberately NOT this rule's territory (no double-reporting):
 *   - src/SKILL.md missing entirely → R11 (required pack-manifest files)
 *   - visibility field missing/invalid → lint-skills R8
 *   Both cases are skipped with an evidence note, not failed.
 *
 * Packs absent from the Appendix C roster (post-RFC packs, e.g. AppleHig,
 * tigris, Discover) are out of scope — their frontmatter alone governs.
 * Widening the roster is an RFC-0011 §6.4 amendment, not this rule's job.
 *
 * Status:
 *   - pass: every parsed roster row agrees with its pack frontmatter
 *   - fail: >=1 row disagrees OR a rostered pack has no source dir
 *   - not_applicable: RFC-0011 file absent or zero Appendix C rows parsed
 *
 * Test seam: ctx.repoRoot (handler reads
 * <repoRoot>/Plans/Specs/RFC-0011-packs-distribution-release-authoring.md and
 * walks <repoRoot>/Packs/{X}/src/SKILL.md).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every pack classified in RFC-0011 §6.3 Appendix C MUST exist under Packs/ with src/SKILL.md frontmatter `visibility:` equal to its roster classification";

const RFC_REL_PATH = join(
  "Plans",
  "Specs",
  "RFC-0011-packs-distribution-release-authoring.md",
);

/** Appendix C row: `| 21 | sentinel | public | marketplace, submodule | … |` */
const ROSTER_ROW_RE = /^\|\s*\d+\s*\|\s*([A-Za-z][A-Za-z0-9_]*)\s*\|\s*(public|internal|beta)\s*\|/;

/** First `visibility:` line inside the leading `---` frontmatter block. */
function readFrontmatterVisibility(skillMdPath: string): string | null {
  let text: string;
  try {
    text = readFileSync(skillMdPath, "utf-8");
  } catch {
    return null;
  }
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const vis = fm[1].match(/^visibility:\s*(\S+)\s*$/m);
  if (!vis) return null;
  // Normalize legal YAML variants a real parser would accept — quoted or
  // capitalized values ("public", Public) must not read as drift (review
  // finding 2026-07-06): the roster tokens are lowercase-unquoted.
  return vis[1].replace(/^["']|["']$/g, "").toLowerCase();
}

export async function r99VisibilityRosterParity(
  ctx: CheckContext,
): Promise<CheckResult> {
  const rfcPath = join(ctx.repoRoot, RFC_REL_PATH);
  if (!existsSync(rfcPath)) {
    return {
      rId: "R99",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`RFC-0011 not found at ${rfcPath}`],
    };
  }

  const roster: Array<{ pack: string; visibility: string }> = [];
  for (const line of readFileSync(rfcPath, "utf-8").split("\n")) {
    const m = line.match(ROSTER_ROW_RE);
    if (m) roster.push({ pack: m[1], visibility: m[2] });
  }

  if (roster.length === 0) {
    return {
      rId: "R99",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`RFC-0011 present but zero Appendix C roster rows parsed`],
    };
  }

  const failures: string[] = [];
  const skips: string[] = [];
  let compared = 0;

  for (const row of roster) {
    const packDir = join(ctx.repoRoot, "Packs", row.pack);
    if (!existsSync(packDir)) {
      failures.push(
        `Packs/${row.pack}: rostered as "${row.visibility}" in Appendix C but has NO source dir under Packs/ (retired-but-still-rostered state)`,
      );
      continue;
    }
    const skillMd = join(packDir, "src", "SKILL.md");
    if (!existsSync(skillMd)) {
      skips.push(`Packs/${row.pack}: src/SKILL.md absent — R11's territory, skipped`);
      continue;
    }
    const fmVis = readFrontmatterVisibility(skillMd);
    if (fmVis === null) {
      skips.push(`Packs/${row.pack}: no frontmatter visibility field — lint-skills R8's territory, skipped`);
      continue;
    }
    compared++;
    if (fmVis !== row.visibility) {
      failures.push(
        `Packs/${row.pack}: roster says "${row.visibility}" but src/SKILL.md frontmatter says "${fmVis}" — reconcile via RFC-0011 §6.4 (declassify) or fix the frontmatter`,
      );
    }
  }

  if (failures.length === 0) {
    return {
      rId: "R99",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${roster.length} Appendix C roster row(s) parsed; ${compared} compared against frontmatter; 0 drift`,
        ...skips,
      ],
    };
  }

  return {
    rId: "R99",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${failures.length}/${roster.length} roster row(s) out of parity:`,
      ...failures.map((f) => `  ${f}`),
      ...skips,
    ],
    loc: rfcPath,
  };
}
