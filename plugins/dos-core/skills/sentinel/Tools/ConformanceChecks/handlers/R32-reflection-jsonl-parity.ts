/**
 * R32 — Every Standard+ complete PRD has a corresponding entry in
 * algorithm-reflections.jsonl.
 *
 * When a Standard-or-higher effort PRD reaches `phase: complete`, the Algorithm
 * LEARN phase mandates writing a reflection entry to algorithm-reflections.jsonl.
 * This entry is the durable lesson extracted from the session. A PRD marked
 * `phase: complete` without a reflection entry means the LEARN phase was skipped
 * or the reflection was never written.
 *
 * "Standard+" means effort is one of: standard, extended, advanced, deep,
 * xhigh, comprehensive. PRDs with effort `quick`, `minimal`, or unrecognized
 * values are excluded from this gate.
 *
 * Reflection matching: checks for the PRD's directory slug in the reflections
 * JSONL. Each reflection entry must have a `slug` or `session_id` field that
 * matches the PRD's directory name.
 *
 * Reflections JSONL resolution:
 *   1. ctx.repoRoot/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
 *   2. $HOME/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
 *
 * Failure modes:
 *   - No MEMORY/WORK/ → not_applicable
 *   - No Standard+ complete PRDs → not_applicable
 *   - Reflections JSONL not found → fail (if any completed Standard+ PRDs exist)
 *   - Completed Standard+ PRD has no matching reflection entry → fail
 *
 * Why R-class: reflection JSONL parity is the observable test of LEARN phase
 * execution. Silent LEARN-skip accumulates session-over-session until the agent
 * has no institutional memory — the primary factor in repeated error patterns.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every Standard+ effort PRD with phase:complete must have an entry in algorithm-reflections.jsonl";

/** Effort tiers that require a reflection on completion. */
const STANDARD_PLUS = new Set(["standard", "extended", "advanced", "deep", "xhigh", "comprehensive"]);

interface ReflectionEntry {
  slug?: string;
  session_id?: string;
  prd_slug?: string;
  [key: string]: unknown;
}

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

function resolveReflectionsPath(ctx: CheckContext): string | null {
  const candidates = [
    join(ctx.repoRoot, "MEMORY", "LEARNING", "REFLECTIONS", "algorithm-reflections.jsonl"),
    join(homedir(), ".claude", "MEMORY", "LEARNING", "REFLECTIONS", "algorithm-reflections.jsonl"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function loadSlugsFromReflections(path: string): Set<string> {
  const slugs = new Set<string>();
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return slugs;
  }
  for (const line of content.split("\n").filter(Boolean)) {
    try {
      const entry = JSON.parse(line) as ReflectionEntry;
      if (entry.slug) slugs.add(entry.slug);
      if (entry.prd_slug) slugs.add(entry.prd_slug);
      if (entry.session_id) slugs.add(entry.session_id);
    } catch {
      // skip malformed lines
    }
  }
  return slugs;
}

export async function r32ReflectionJsonlParity(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");

  if (!existsSync(workRoot)) {
    return {
      rId: "R32",
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
      rId: "R32",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Failed to read ${workRoot}: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // Collect all Standard+ complete PRD slugs
  const completedStandardPlusSlugs: string[] = [];

  for (const entry of entries.sort()) {
    const prdPath = join(workRoot, entry, "PRD.md");
    if (!existsSync(prdPath)) continue;
    try {
      if (!statSync(prdPath).isFile()) continue;
    } catch {
      continue;
    }

    let content: string;
    try {
      content = readFileSync(prdPath, "utf-8");
    } catch {
      continue;
    }

    const frontmatter = parseFrontmatter(content);
    const phase = (frontmatter?.phase ?? "").toLowerCase().trim();
    const effort = (frontmatter?.effort ?? "").toLowerCase().trim();

    if (phase === "complete" && STANDARD_PLUS.has(effort)) {
      completedStandardPlusSlugs.push(entry);
    }
  }

  if (completedStandardPlusSlugs.length === 0) {
    return {
      rId: "R32",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["No Standard+ effort PRDs with phase:complete found — reflection gate not applicable"],
    };
  }

  // Find reflections JSONL
  const reflectionsPath = resolveReflectionsPath(ctx);

  if (!reflectionsPath) {
    return {
      rId: "R32",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `algorithm-reflections.jsonl not found — ${completedStandardPlusSlugs.length} completed Standard+ PRD(s) require reflections`,
        `Expected at: ${ctx.repoRoot}/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`,
        `or: ~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`,
      ],
    };
  }

  const reflectedSlugs = loadSlugsFromReflections(reflectionsPath);

  const missingReflections = completedStandardPlusSlugs.filter((slug) => !reflectedSlugs.has(slug));

  if (missingReflections.length > 0) {
    const preview = missingReflections.slice(0, 5).join(", ");
    const overflow = missingReflections.length > 5 ? ` (+${missingReflections.length - 5} more)` : "";
    return {
      rId: "R32",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${missingReflections.length} completed Standard+ PRD(s) lack reflection entries: ${preview}${overflow}`,
        `Reflections file: ${reflectionsPath} (${reflectedSlugs.size} entries)`,
      ],
    };
  }

  return {
    rId: "R32",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${completedStandardPlusSlugs.length} completed Standard+ PRD(s) — all have reflection entries`,
      `Reflections file: ${reflectionsPath}`,
    ],
  };
}
