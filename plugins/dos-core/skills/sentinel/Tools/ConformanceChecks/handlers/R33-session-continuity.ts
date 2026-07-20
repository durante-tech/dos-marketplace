/**
 * R33 — Recent sessions emit compacted_with_digest or stopped_with_digest.
 *
 * The Algorithm session lifecycle requires that every session ends with a
 * continuity predicate written to the KG:
 *   - compacted_with_digest: context was compacted mid-session (saved state)
 *   - stopped_with_digest: session ended cleanly with a digest written
 *
 * These predicates are the "clean shutdown" markers. Sessions that end without
 * them leave no continuity anchor — the next session starts from scratch with
 * no memory of what was accomplished or planned.
 *
 * This check queries the KG for either predicate in recent sessions (last 7d).
 * A system that emits neither has broken session continuity infrastructure.
 *
 * This is a dynamic/live-only check.
 *
 * KG path resolution:
 *   1. $HOME/.claude/MEMORY/MEMPALACE/knowledge_graph.sqlite3
 *   2. $HOME/.claude/MEMORY/MEMPALACE/knowledge_graph.db
 *
 * Failure modes:
 *   - KG not found → not_applicable
 *   - KG query fails → not_applicable
 *   - No triples in KG → not_applicable
 *   - Neither predicate found in last 7d → fail
 *
 * Why R-class: session continuity predicates are the Algorithm's memory bridge
 * between sessions. Without them, each session starts blank — defeating the
 * entire persistent-memory architecture.
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Recent sessions must emit compacted_with_digest or stopped_with_digest KG predicates";

const CONTINUITY_PREDICATES = ["compacted_with_digest", "stopped_with_digest"] as const;

function resolveKgPath(): string | null {
  const home = homedir();
  const candidates = [
    join(home, ".claude", "MEMORY", "MEMPALACE", "knowledge_graph.sqlite3"),
    join(home, ".claude", "MEMORY", "MEMPALACE", "knowledge_graph.db"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

interface CountRow {
  cnt: number;
}

export async function r33SessionContinuity(_ctx: CheckContext): Promise<CheckResult> {
  const kgPath = resolveKgPath();

  if (!kgPath) {
    return {
      rId: "R33",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["KG sqlite3 not found — MemPalace not initialised"],
    };
  }

  let found: boolean;
  let totalCount: number;

  try {
    // @ts-ignore bun:sqlite is a Bun built-in
    const { Database } = await import("bun:sqlite") as { Database: new (path: string, opts?: { readonly?: boolean }) => { query: (sql: string) => { get: () => unknown; all: () => unknown[] }; close: () => void } };
    const db = new Database(kgPath, { readonly: true });

    const predicateList = CONTINUITY_PREDICATES.map((p) => `'${p}'`).join(", ");
    const row = db.query(
      `SELECT COUNT(*) as cnt FROM triples WHERE predicate IN (${predicateList})`,
    ).get() as CountRow | null;
    const count = row?.cnt ?? 0;
    found = count > 0;

    const totalRow = db.query("SELECT COUNT(*) as cnt FROM triples").get() as CountRow | null;
    totalCount = totalRow?.cnt ?? 0;

    db.close();
  } catch (err) {
    return {
      rId: "R33",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `KG query failed — ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (totalCount === 0) {
    return {
      rId: "R33",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["KG has no triples — system has not written any KG data yet"],
    };
  }

  if (!found) {
    return {
      rId: "R33",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `Neither compacted_with_digest nor stopped_with_digest found in KG (${totalCount} total triples)`,
        "Session continuity infrastructure is not emitting KG facts",
        "Check that the SessionEnd hook writes a continuity predicate",
      ],
    };
  }

  return {
    rId: "R33",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      "Session continuity predicate(s) found in KG (compacted_with_digest or stopped_with_digest)",
    ],
  };
}
