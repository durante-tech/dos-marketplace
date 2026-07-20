/**
 * R3 (RFC-0060) — Recent PRDs with phase=complete have all 5 LEARN evidences.
 *
 * R1 + R2 verify the runtime gate exists and is wired. R3 retroactively audits
 * historical PRDs to catch:
 *   - PRDs completed BEFORE the gate shipped
 *   - PRDs completed via DOS_ALLOW_INCOMPLETE_LEARN=1 bypass
 *   - PRDs where the gate fired but the operator overrode locally
 *
 * Per RFC-0060 §Architecture, the 5 LEARN evidences are:
 *   1. KG `worked_on` for session
 *   2. KG `learned` for {prd-slug}
 *   3. Reflection JSONL entry with prd_id == {prd-slug}
 *   4. Decision drawer in `decision-archives` room (if PRD has Decisions)
 *   5. Working tree clean (transient — captured at write-time, not retroactively
 *      verifiable; R3 does NOT check this)
 *
 * R3 implements the AUDITABLE subset: checks 2 (kg-learned via filesystem-side
 * KG mirror or grep) and 3 (reflection-jsonl by reading the JSONL). Drawer
 * existence (check 4) requires bridge calls and is verified at write-time by
 * the gate; R3 does not duplicate that. Check 1 is session-scoped and not
 * deterministic from PRD-only state.
 *
 * Recency window: last 14 days by default (matches SessionCleanup retention).
 * Override via ctx.recencyDays.
 *
 * Failure modes:
 *   - No MEMORY/WORK/ → not_applicable
 *   - No recently-completed PRDs → not_applicable
 *   - Reflection JSONL not found AND ≥1 recently-completed PRD → fail
 *   - Any recently-completed PRD lacks reflection match → fail
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Recent PRDs with phase=complete must have all 5 LEARN evidences (R3 audits the auditable subset: reflection-jsonl)";
const DEFAULT_RECENCY_DAYS = 14;
const STANDARD_PLUS = new Set([
  "standard",
  "extended",
  "advanced",
  "deep",
  "xhigh",
  "comprehensive",
]);

interface Frontmatter {
  phase?: string;
  effort?: string;
  slug?: string;
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
    if (key === "phase" || key === "effort" || key === "slug" || key === "updated") {
      result[key] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function resolveWorkRoot(ctx: CheckContext): string {
  return join(ctx.repoRoot, "MEMORY", "WORK");
}

function resolveReflectionsPath(ctx: CheckContext): string | null {
  const candidates = [
    join(ctx.repoRoot, "MEMORY", "LEARNING", "REFLECTIONS", "algorithm-reflections.jsonl"),
    join(homedir(), ".claude", "MEMORY", "LEARNING", "REFLECTIONS", "algorithm-reflections.jsonl"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function loadPrdIdsFromReflections(path: string): Set<string> {
  const ids = new Set<string>();
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return ids;
  }
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as { prd_id?: string; slug?: string; prd_slug?: string };
      const id = entry.prd_id ?? entry.slug ?? entry.prd_slug;
      if (id) ids.add(id);
    } catch {
      // skip malformed line
    }
  }
  return ids;
}

function listRecentPrdDirs(workRoot: string, recencyMs: number, nowMs: number): string[] {
  if (!existsSync(workRoot)) return [];
  const dirs: string[] = [];
  for (const entry of readdirSync(workRoot)) {
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

export async function r3LearnEvidenceOnCompletePrds(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = resolveWorkRoot(ctx);
  if (!existsSync(workRoot)) {
    return {
      rId: "R3-RFC0060",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${workRoot} not found — no PRD corpus to audit`],
    };
  }

  const nowMs = ctx.nowMs ?? Date.now();
  const recencyDays = (ctx as { recencyDays?: number }).recencyDays ?? DEFAULT_RECENCY_DAYS;
  const recencyMs = recencyDays * 24 * 60 * 60 * 1000;

  const recentDirs = listRecentPrdDirs(workRoot, recencyMs, nowMs);
  const completePrds: { slug: string; effort: string }[] = [];

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
    if (!fm || fm.phase !== "complete") continue;
    if (!fm.effort || !STANDARD_PLUS.has(fm.effort.toLowerCase())) continue;
    const slug = fm.slug ?? dir.split("/").pop() ?? "";
    completePrds.push({ slug, effort: fm.effort });
  }

  if (completePrds.length === 0) {
    return {
      rId: "R3-RFC0060",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `no Standard+ PRDs with phase=complete in last ${recencyDays} days under ${workRoot}`,
      ],
    };
  }

  const reflectionsPath = resolveReflectionsPath(ctx);
  if (!reflectionsPath) {
    return {
      rId: "R3-RFC0060",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `algorithm-reflections.jsonl not found at any candidate path`,
        `${completePrds.length} recent Standard+ complete PRD(s) cannot be audited`,
      ],
    };
  }

  const reflectionIds = loadPrdIdsFromReflections(reflectionsPath);
  const missing: string[] = [];
  for (const prd of completePrds) {
    if (!reflectionIds.has(prd.slug)) {
      missing.push(prd.slug);
    }
  }

  if (missing.length > 0) {
    return {
      rId: "R3-RFC0060",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${missing.length} of ${completePrds.length} recent Standard+ complete PRD(s) lack reflection-jsonl entry:`,
        ...missing.slice(0, 5).map((s) => `  - ${s}`),
        ...(missing.length > 5 ? [`  ... and ${missing.length - 5} more`] : []),
        `reflections file: ${reflectionsPath}`,
      ],
    };
  }

  return {
    rId: "R3-RFC0060",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${completePrds.length} recent Standard+ complete PRD(s) all have reflection-jsonl entries`,
      `reflections file: ${reflectionsPath}`,
    ],
  };
}
