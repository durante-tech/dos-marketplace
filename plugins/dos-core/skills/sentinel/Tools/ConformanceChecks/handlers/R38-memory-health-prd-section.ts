/**
 * R38 (RFC-0035 §5.MW1 → V11.14 ship) — `📚 MEMORY HEALTH:` PRD-section presence
 * for Deep+ effort PRDs.
 *
 * Background: RFC-0035 §3 item 9 requires every Deep+ effort PRD to capture a
 * memory-substrate snapshot at authoring time so that PRD reviewers can see
 * the palace state the work was authored against. The literal section header
 * is `📚 MEMORY HEALTH:` (emoji is load-bearing — it's a Sentinel-grade rule
 * marker, not decoration). The PRD body downstream typically embeds the
 * one-line `bun ~/Durante/Tools/dos-memory-status.ts --json` snapshot.
 *
 * RFC-0078 retiral (2026-05-08) verified the rule was missing in the live
 * codebase. This handler closes that gap as part of the V11.14 batch.
 *
 * Detection — applicable PRDs:
 *   • frontmatter `phase: complete` (skip in-progress PRDs to avoid noise)
 *   • frontmatter `effort` ∈ {deep, advanced, xhigh, comprehensive}
 *
 * Pass condition: PRD body contains a line starting with `📚 MEMORY HEALTH:`
 * (literal — emoji + uppercase + colon required, anywhere in the file
 * including frontmatter/body).
 *
 * Recency window: last 14 days by default (matches R36 cadence). Override via
 * ctx.recencyDays.
 *
 * Cutoff: PRDs whose `started` predates V11.14 ratification cutoff (2026-05-08)
 * are skipped silently — the rule didn't exist when they were authored.
 *
 * Failure modes (returned by handler):
 *   - No MEMORY/WORK/ → not_applicable
 *   - No recently-completed Deep+ PRDs in window → not_applicable
 *   - Recently-completed Deep+ PRD missing the section → fail (lists slugs)
 *   - All recently-completed Deep+ PRDs have the section → pass
 *
 * NOT a runtime gate (no PreToolUse hook) — `/sentinel scan` audit only.
 * Failure surfaces missing-section PRDs by name + slug for retroactive
 * documentation. Operator decides: backfill the section, or accept the gap.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Recently-completed Deep+ PRDs must include a `📚 MEMORY HEALTH:` section capturing the dos-memory-status snapshot (RFC-0035 §3 item 9, V11.14)";

const DEFAULT_RECENCY_DAYS = 14;
// V11.14 ship cutoff — PRDs started before this couldn't have known the rule.
const DEFAULT_CUTOFF_ISO = "2026-05-08T00:00:00.000Z";

const DEEP_PLUS = new Set(["deep", "advanced", "xhigh", "comprehensive"]);

// Literal section marker — emoji + uppercase + colon. The emoji is the
// load-bearing distinguisher (other section headers use plain ASCII).
// Substring match (no line anchor) so the marker can appear inside a heading
// like `## 📚 MEMORY HEALTH:` or `### 📚 MEMORY HEALTH:` without further
// regex tuning.
const SECTION_MARKER = /📚\s*MEMORY\s+HEALTH\s*:/;

interface Frontmatter {
  phase?: string;
  effort?: string;
  slug?: string;
  task?: string;
  started?: string;
  updated?: string;
}

function parseFrontmatter(content: string): Frontmatter | null {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (endIdx === -1) return null;
  const result: Frontmatter = {};
  for (let i = 1; i < endIdx; i++) {
    const m = lines[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1] as keyof Frontmatter;
    if (
      key === "phase" ||
      key === "effort" ||
      key === "slug" ||
      key === "task" ||
      key === "started" ||
      key === "updated"
    ) {
      result[key] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function listRecentPrdDirs(workRoot: string, recencyMs: number, nowMs: number): string[] {
  if (!existsSync(workRoot)) return [];
  const dirs: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(workRoot);
  } catch {
    return [];
  }
  for (const entry of entries) {
    const dir = join(workRoot, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (nowMs - st.mtimeMs > recencyMs) continue;
    dirs.push(dir);
  }
  return dirs;
}

function hasMemoryHealthSection(body: string): boolean {
  return SECTION_MARKER.test(body);
}

export async function r38MemoryHealthPrdSection(
  ctx: CheckContext,
): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  if (!existsSync(workRoot)) {
    return {
      rId: "R38",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${workRoot} not found — no PRD corpus to audit`],
    };
  }

  const nowMs = ctx.nowMs ?? Date.now();
  const recencyDays =
    (ctx as { recencyDays?: number }).recencyDays ?? DEFAULT_RECENCY_DAYS;
  const recencyMs = recencyDays * 24 * 60 * 60 * 1000;
  const cutoffIso =
    (ctx as { memoryHealthCutoff?: string }).memoryHealthCutoff ??
    DEFAULT_CUTOFF_ISO;
  const cutoffMs = Date.parse(cutoffIso);

  const recentDirs = listRecentPrdDirs(workRoot, recencyMs, nowMs);
  if (recentDirs.length === 0) {
    return {
      rId: "R38",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No PRDs modified in last ${recencyDays} days — nothing to audit`],
    };
  }

  const failures: string[] = [];
  const passed: string[] = [];
  const skipped: string[] = [];

  for (const dir of recentDirs) {
    const prdPath = join(dir, "PRD.md");
    if (!existsSync(prdPath)) continue;

    let content: string;
    try {
      content = readFileSync(prdPath, "utf-8");
    } catch {
      continue;
    }

    const fm = parseFrontmatter(content);
    if (!fm) continue;

    if (fm.phase !== "complete") continue;
    if (!fm.effort || !DEEP_PLUS.has(fm.effort.toLowerCase())) continue;

    if (fm.started) {
      const startedMs = Date.parse(fm.started);
      if (!Number.isNaN(startedMs) && startedMs < cutoffMs) {
        skipped.push(`${fm.slug ?? dir.split("/").pop()} (pre-cutoff)`);
        continue;
      }
    }

    const slug = fm.slug ?? dir.split("/").pop() ?? "unknown-prd";

    if (hasMemoryHealthSection(content)) {
      passed.push(slug);
    } else {
      failures.push(slug);
    }
  }

  if (failures.length === 0 && passed.length === 0) {
    return {
      rId: "R38",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `${recentDirs.length} recently-modified PRD dirs scanned`,
        `${skipped.length} skipped (pre-cutoff or non-Deep+)`,
        "0 audited (no Deep+ phase=complete PRDs in window)",
      ],
    };
  }

  if (failures.length > 0) {
    return {
      rId: "R38",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${failures.length} Deep+ PRD(s) missing \`📚 MEMORY HEALTH:\` section:`,
        ...failures.map((s) => `  • ${s}`),
        `(${passed.length} compliant; ${skipped.length} skipped — pre-cutoff)`,
      ],
    };
  }

  return {
    rId: "R38",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${passed.length} recent Deep+ PRD(s) — all carry \`📚 MEMORY HEALTH:\` section`,
      `(${skipped.length} skipped — pre-cutoff; ${recentDirs.length} dirs total in ${recencyDays}-day window)`,
    ],
  };
}
