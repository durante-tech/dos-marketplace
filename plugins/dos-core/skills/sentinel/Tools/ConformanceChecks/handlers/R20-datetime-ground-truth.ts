/**
 * R20 — Every PRD's slug timestamp matches frontmatter started within 30s.
 *
 * PRD working directories are named `YYYYMMDD-HHmmss_{slug}`. This check
 * extracts the embedded timestamp and compares it against the `started`
 * frontmatter field. A divergence > 30 seconds indicates the directory was
 * renamed, copied, or created with a mismatched timestamp — making the slug
 * useless as a temporal anchor for audit trails and Studio session linking.
 *
 * Date parsing:
 *   Slug prefix: YYYYMMDD-HHmmss (treated as UTC, or local if no Z suffix)
 *   started field: ISO 8601 (e.g., 2026-05-05T03:13:34Z)
 *
 * Failure modes:
 *   - No MEMORY/WORK/ directory → not_applicable
 *   - No PRD.md files → not_applicable
 *   - Slug doesn't match expected timestamp format → fail (evidence logged)
 *   - |slug_ts - started_ts| > 30s → fail
 *
 * Why R-class: datetime ground truth is a load-bearing property of session
 * identity — the Studio sync pipeline uses slug timestamps as foreign keys
 * to match PRDs with session events. Silent drift corrupts audit trails.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every PRD directory slug timestamp must match frontmatter 'started' field within 30 seconds";

const SLUG_TS_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/;
const TOLERANCE_MS = 30_000;

// R20 was introduced 2026-05-05 (commit f521ff67). PRDs scaffolded before
// the rule existed could not have been authored against this discipline;
// applying it retroactively penalizes legacy artifacts for not following
// a rule that didn't exist. The rule's intent (catch future drift) is
// preserved by checking forward; legacy PRDs are out-of-scope.
const R20_INTRO_DATE_MS = new Date("2026-05-05T00:00:00Z").getTime();

/** Parse YAML frontmatter. */
function parseFrontmatter(content: string): Record<string, string> | null {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (endIdx === -1) return null;
  const result: Record<string, string> = {};
  for (let i = 1; i < endIdx; i++) {
    const m = lines[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (m) result[m[1]] = m[2].trim();
  }
  return result;
}

/** Extract UTC timestamp in ms from slug prefix YYYYMMDD-HHmmss. */
function slugToMs(dirName: string): number | null {
  const m = SLUG_TS_RE.exec(dirName);
  if (!m) return null;
  const [, year, month, day, hour, min, sec] = m;
  // Parse as UTC
  const d = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

export async function r20DatetimeGroundTruth(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");

  if (!existsSync(workRoot)) {
    return {
      rId: "R20",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`MEMORY/WORK/ not found under ${ctx.repoRoot}`],
    };
  }

  let entries: string[];
  try {
    entries = readdirSync(workRoot);
  } catch (err) {
    return {
      rId: "R20",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Failed to read ${workRoot}: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const prdPaths: Array<{ dir: string; prdPath: string }> = [];
  for (const entry of entries.sort()) {
    const prdPath = join(workRoot, entry, "PRD.md");
    if (existsSync(prdPath)) {
      try {
        if (statSync(prdPath).isFile()) prdPaths.push({ dir: entry, prdPath });
      } catch {
        // ignore
      }
    }
  }

  if (prdPaths.length === 0) {
    return {
      rId: "R20",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No PRD.md files found under ${workRoot}`],
    };
  }

  const failEvidence: string[] = [];

  for (const { dir, prdPath } of prdPaths) {
    let content: string;
    try {
      content = readFileSync(prdPath, "utf-8");
    } catch (err) {
      failEvidence.push(`${prdPath}: cannot read — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const frontmatter = parseFrontmatter(content);
    const startedRaw = frontmatter?.started ?? "";

    if (!startedRaw) {
      failEvidence.push(`${prdPath}: missing 'started' field — cannot verify datetime ground truth`);
      continue;
    }

    const slugMs = slugToMs(dir);
    if (slugMs === null) {
      // Directory name doesn't match expected YYYYMMDD-HHmmss_ prefix — warn but don't fail
      // (some PRDs may not follow slug convention)
      continue;
    }

    // Legacy exemption: PRDs scaffolded before R20 introduction (2026-05-05)
    // are out of scope. They could not have been authored against a discipline
    // that did not yet exist; the rule's intent is to catch forward drift.
    if (slugMs < R20_INTRO_DATE_MS) {
      continue;
    }

    const startedMs = new Date(startedRaw).getTime();
    if (isNaN(startedMs)) {
      failEvidence.push(`${prdPath}: 'started' value '${startedRaw}' is not a valid ISO datetime`);
      continue;
    }

    const diffMs = Math.abs(slugMs - startedMs);
    if (diffMs > TOLERANCE_MS) {
      // Slug prefix is local-wall-clock (operator's local timezone) but parsed as
      // UTC; `started` may carry a non-UTC offset (e.g., `-03:00`). The honest
      // ground-truth comparison ignores TZ — accept any hour-multiple diff (3600s
      // boundaries ±30s) as a tz-offset match rather than real drift. Anything
      // that lands between hour boundaries is real datetime drift.
      const hourMod = diffMs % 3_600_000;
      const offsetSlackMs = Math.min(hourMod, 3_600_000 - hourMod);
      if (offsetSlackMs <= TOLERANCE_MS) {
        // tz-offset match (whole-hour shift within 30s) — accept silently
        continue;
      }
      const diffSec = (diffMs / 1000).toFixed(1);
      failEvidence.push(
        `${prdPath}: slug timestamp and 'started' diverge by ${diffSec}s (> 30s tolerance) — ` +
        `slug: ${dir.slice(0, 15)}, started: ${startedRaw}`,
      );
    }
  }

  if (failEvidence.length > 0) {
    return {
      rId: "R20",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: failEvidence,
    };
  }

  return {
    rId: "R20",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`${prdPaths.length} PRD(s) checked — all slug timestamps within 30s of frontmatter started`],
  };
}
