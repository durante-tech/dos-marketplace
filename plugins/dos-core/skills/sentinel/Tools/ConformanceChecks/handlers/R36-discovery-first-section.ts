/**
 * R36 (RFC-0068 ISC-5.2 → mechanizes ISC-5.1 doctrine) — Discovery-First section
 * presence on PRDs that touch new components.
 *
 * Background: RFC-0068 ISC-5.1 added a DISCOVERY-FIRST CHECKPOINT subsection
 * to the active Algorithm doctrine. Originally §6.1.e2 in v0.0.7-enhanced.md;
 * renumbered to §6.1.e3 in v0.0.8.md (where new §6.1.e2 is ADJACENT-CONTRACT
 * SCAN). Mandates enumerate → probe → record → re-scope before authoring any
 * new component.
 * The doctrine prose ships in the submodule; ISC-5.2 (this rule) mechanizes
 * the check at `/sentinel scan` time so PRDs that skip the procedure are
 * surfaced rather than silently passing.
 *
 * Detection — "touches new component":
 *   The PRD body matches one of the new-component phrases (case-insensitive):
 *     • "new file", "new hook", "new RFC", "new agent", "new policy"
 *     • "new schema", "new doctrine section", "ship a new"
 *     • "author …", "create …", "scaffold …" within ## Context or ## Plan
 *
 *   When NONE of these phrases appear, the rule treats the PRD as
 *   verification/maintenance/research — `not_applicable` for that PRD,
 *   skipped silently.
 *
 * Pass condition: PRDs touching new components have a `### Discovery-First`
 * heading inside their `## Context` body. Heading match is case-sensitive on
 * "Discovery-First" (canonical form per the doctrine).
 *
 * Recency window: last 14 days by default (matches R3 SessionCleanup retention).
 *
 * Failure modes:
 *   - No MEMORY/WORK/ → `not_applicable`
 *   - No recently-completed PRDs → `not_applicable`
 *   - Recently-completed PRDs touching new components but missing the section → `fail`
 *   - All recently-completed PRDs either don't touch new components or have the section → `pass`
 *
 * NOT a runtime gate (no PreToolUse hook) — `/sentinel scan` audit only.
 * Failure surfaces missing-section PRDs by name + slug for retroactive
 * documentation. Operator decides: backfill the section, or accept the gap.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Recently-completed PRDs that touch new components must have a `### Discovery-First` subsection in `## Context` (RFC-0068 ISC-5.1 doctrine §6.1.e2)";
const DEFAULT_RECENCY_DAYS = 14;
// Doctrine ratification cutoff — RFC-0068 ISC-5.1 shipped this date.
// PRDs whose `started` predates this cutoff are skipped silently (couldn't have
// known to apply a doctrine that didn't exist yet). Override via ctx.discoveryFirstCutoff
// for testing or replay scenarios.
const DEFAULT_CUTOFF_ISO = "2026-05-06T04:25:00.000Z";
const STANDARD_PLUS = new Set([
  "standard",
  "extended",
  "advanced",
  "deep",
  "xhigh",
  "comprehensive",
]);

const NEW_COMPONENT_PATTERNS: RegExp[] = [
  /\bnew\s+(file|hook|rfc|agent|policy|schema|doctrine\s+section|skill|module)\b/i,
  /\bship\s+(a\s+)?new\b/i,
  /\bauthor\s+(a\s+)?new\b/i,
  /\bcreate\s+(a\s+)?new\b/i,
  /\bscaffold\s+(a\s+)?new\b/i,
  /\bisa\s+12-section\s+format\b/i,
  /\bauthored\s+at\b.+\.md/i,
  // File-extension form — "author Verifier.md", "ship X.hook.ts", "create R36-foo.ts" etc.
  // Catches PRDs that name a specific output file as their deliverable without the
  // literal word "new" preceding the component noun.
  /\b(author|ship|create|scaffold|implement|build|write)\s+(?:a\s+|the\s+)?\S{2,}\.(hook\.ts|md|json|ts|py|sh|yaml|yml)\b/i,
];

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
    if (key === "phase" || key === "effort" || key === "slug" || key === "task" || key === "started" || key === "updated") {
      result[key] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function resolveWorkRoot(ctx: CheckContext): string {
  return join(ctx.repoRoot, "MEMORY", "WORK");
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

function touchesNewComponent(body: string): boolean {
  return NEW_COMPONENT_PATTERNS.some((re) => re.test(body));
}

function hasDiscoveryFirstSection(body: string): boolean {
  // Look for `### Discovery-First` (canonical heading form per doctrine)
  // OR `### Discovery First` (space variant) within ## Context.
  // Match any line starting with `###` and containing "Discovery" + "First".
  const lines = body.split("\n");
  for (const line of lines) {
    if (line.startsWith("###") && /discovery[\s-]first/i.test(line)) {
      return true;
    }
  }
  return false;
}

export async function r36DiscoveryFirstSection(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = resolveWorkRoot(ctx);
  if (!existsSync(workRoot)) {
    return {
      rId: "R36",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${workRoot} not found — no PRD corpus to audit`],
    };
  }

  const nowMs = ctx.nowMs ?? Date.now();
  const recencyDays = (ctx as { recencyDays?: number }).recencyDays ?? DEFAULT_RECENCY_DAYS;
  const recencyMs = recencyDays * 24 * 60 * 60 * 1000;
  const cutoffIso = (ctx as { discoveryFirstCutoff?: string }).discoveryFirstCutoff ?? DEFAULT_CUTOFF_ISO;
  const cutoffMs = Date.parse(cutoffIso);

  const recentDirs = listRecentPrdDirs(workRoot, recencyMs, nowMs);
  if (recentDirs.length === 0) {
    return {
      rId: "R36",
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

    // Only audit phase: complete + Standard+ effort PRDs
    if (fm.phase !== "complete") continue;
    if (!fm.effort || !STANDARD_PLUS.has(fm.effort.toLowerCase())) continue;

    // Skip PRDs that started before the doctrine ratification cutoff —
    // operator couldn't have known to apply a rule that didn't exist yet.
    if (fm.started) {
      const startedMs = Date.parse(fm.started);
      if (!Number.isNaN(startedMs) && startedMs < cutoffMs) continue;
    }

    const slug = fm.slug ?? dir.split("/").pop() ?? "unknown-prd";
    const body = content;

    if (!touchesNewComponent(body)) {
      skipped.push(slug);
      continue;
    }

    if (hasDiscoveryFirstSection(body)) {
      passed.push(slug);
    } else {
      failures.push(slug);
    }
  }

  if (failures.length === 0 && passed.length === 0) {
    return {
      rId: "R36",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `${recentDirs.length} recently-modified PRD dirs scanned`,
        `${skipped.length} skipped (verification/maintenance — no new-component signal)`,
        "0 audited (no Standard+ phase=complete PRDs touching new components in window)",
      ],
    };
  }

  if (failures.length > 0) {
    return {
      rId: "R36",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${failures.length} PRD(s) touching new components but missing \`### Discovery-First\` section:`,
        ...failures.map((s) => `  • ${s}`),
        `(${passed.length} PRD(s) compliant; ${skipped.length} skipped — no new-component signal)`,
      ],
    };
  }

  return {
    rId: "R36",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${passed.length} recent PRD(s) touching new components — all have \`### Discovery-First\` section`,
      `(${skipped.length} skipped — no new-component signal; ${recentDirs.length} dirs total in ${recencyDays}-day window)`,
    ],
  };
}
