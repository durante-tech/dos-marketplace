/**
 * R37 (v0.0.10 Bucket B4 — DOSUpgrade reflection theme #4) — Constraint
 * discovery upfront on data-migration PRDs.
 *
 * Background: 5x reflection-frequency theme — front-loaded constraint
 * inventory (pg_constraint catalog read, FK graph audit, NOT NULL/CHECK
 * inventory) would have saved 8+ runs across DOSUpgrade research sweep.
 * Migration PRDs that skip this step accumulate run-time discovery cost
 * (failed migrate dev, partial rollback, schema-divergence regressions).
 *
 * Detection — "data migration":
 *   PRD body matches one of the migration-signal phrases (case-insensitive):
 *     • "data migration", "schema migration", "prisma migrate"
 *     • "alter table", "drop column", "add column", "rename column"
 *     • "drop table", "create table" within `## Plan` or `## Context`
 *     • frontmatter `task` mentions "migrate"/"migration"
 *
 *   When NONE appear, the PRD is verification/maintenance/research/feature
 *   work without DB schema impact — `not_applicable`, skipped silently.
 *
 * Pass condition: PRDs touching data migration must mention `pg_constraint`
 * OR `constraint inventory` OR `FK audit` OR `## Pre-Migration Constraints`
 * (case-insensitive) somewhere in the body. The discipline is the inventory
 * being declared, not the format.
 *
 * Recency window: last 14 days (matches R36).
 * Tier scope: Standard+ phase=complete PRDs (matches R36 — only audit
 * decision-grade work, not in-flight drafts).
 *
 * NOT a runtime gate — `/sentinel scan` audit only. Failure surfaces
 * missing-inventory PRDs by slug; operator backfills or accepts.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "PRDs touching data migrations must declare an upfront constraint inventory (`pg_constraint` / `constraint inventory` / `FK audit` / `## Pre-Migration Constraints`) — DOSUpgrade reflection theme #4, frequency 5";
const DEFAULT_RECENCY_DAYS = 14;
// Doctrine ratification cutoff — v0.0.10 Bucket B4 ships this date.
// PRDs whose `started` predates this cutoff are skipped silently.
const DEFAULT_CUTOFF_ISO = "2026-05-07T00:00:00.000Z";
const STANDARD_PLUS = new Set([
  "standard",
  "extended",
  "advanced",
  "deep",
  "xhigh",
  "comprehensive",
]);

const MIGRATION_PATTERNS: RegExp[] = [
  /\b(data|schema)\s+migration\b/i,
  /\bprisma\s+migrate\b/i,
  /\balter\s+table\b/i,
  /\bdrop\s+(column|table|index|constraint)\b/i,
  /\badd\s+(column|index|constraint)\b/i,
  /\brename\s+column\b/i,
  /\bcreate\s+table\b/i,
  /\bsupabase\s+migration\b/i,
];

const INVENTORY_PATTERNS: RegExp[] = [
  /pg_constraint/i,
  /constraint\s+inventory/i,
  /\bfk\s+(audit|graph)\b/i,
  /^##\s+pre[-\s]?migration\s+constraints/im,
  /constraint\s+catalog/i,
  /\bnot\s+null\b.*\binventory\b/i,
];

interface Frontmatter {
  phase?: string;
  effort?: string;
  slug?: string;
  task?: string;
  started?: string;
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
    if (key === "phase" || key === "effort" || key === "slug" || key === "task" || key === "started") {
      result[key] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
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

function touchesMigration(body: string, taskField?: string): boolean {
  const surface = `${body}\n${taskField ?? ""}`;
  return MIGRATION_PATTERNS.some((re) => re.test(surface));
}

function declaresConstraintInventory(body: string): boolean {
  return INVENTORY_PATTERNS.some((re) => re.test(body));
}

export async function r37MigrationConstraintDiscovery(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  if (!existsSync(workRoot)) {
    return {
      rId: "R37",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${workRoot} not found — no PRD corpus to audit`],
    };
  }

  const nowMs = ctx.nowMs ?? Date.now();
  const recencyDays = (ctx as { recencyDays?: number }).recencyDays ?? DEFAULT_RECENCY_DAYS;
  const recencyMs = recencyDays * 24 * 60 * 60 * 1000;
  const cutoffIso = (ctx as { migrationConstraintCutoff?: string }).migrationConstraintCutoff ?? DEFAULT_CUTOFF_ISO;
  const cutoffMs = Date.parse(cutoffIso);

  const recentDirs = listRecentPrdDirs(workRoot, recencyMs, nowMs);
  if (recentDirs.length === 0) {
    return {
      rId: "R37",
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
    if (!fm.effort || !STANDARD_PLUS.has(fm.effort.toLowerCase())) continue;

    if (fm.started) {
      const startedMs = Date.parse(fm.started);
      if (!Number.isNaN(startedMs) && startedMs < cutoffMs) continue;
    }

    const slug = fm.slug ?? dir.split("/").pop() ?? "unknown-prd";

    if (!touchesMigration(content, fm.task)) {
      skipped.push(slug);
      continue;
    }

    if (declaresConstraintInventory(content)) {
      passed.push(slug);
    } else {
      failures.push(slug);
    }
  }

  if (failures.length === 0 && passed.length === 0) {
    return {
      rId: "R37",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `${recentDirs.length} recently-modified PRD dirs scanned`,
        `${skipped.length} skipped (no migration signal)`,
        "0 audited (no Standard+ phase=complete migration PRDs in window)",
      ],
    };
  }

  if (failures.length > 0) {
    return {
      rId: "R37",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${failures.length} migration PRD(s) missing constraint inventory:`,
        ...failures.map((s) => `  • ${s}`),
        `(${passed.length} PRD(s) compliant; ${skipped.length} skipped — no migration signal)`,
      ],
    };
  }

  return {
    rId: "R37",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${passed.length} recent migration PRD(s) — all declare constraint inventory`,
      `(${skipped.length} skipped — no migration signal; ${recentDirs.length} dirs total)`,
    ],
  };
}
