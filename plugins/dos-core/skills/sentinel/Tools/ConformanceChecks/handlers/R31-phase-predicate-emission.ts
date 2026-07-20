/**
 * R31 — KG contains phase predicate triples (system emitting phase facts).
 *
 * The Algorithm emits phase-transition KG facts during execution. Phase
 * predicate emission confirms the system is actually writing phase data to
 * the knowledge graph — not silently skipping KG writes. Examples:
 *   - (session-id, phase_started, "observe")
 *   - (session-id, phase_complete, "build")
 *   - (prj-slug, phase_transition, "plan → build")
 *
 * This check queries the KG for any triples whose predicate matches the
 * phase_* pattern. A KG with no phase predicates indicates the Algorithm
 * phase instrumentation is not firing.
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
 *   - No triples in KG at all → not_applicable
 *   - No phase predicate triples → fail
 *
 * Why R-class: phase predicate emission is load-bearing for session continuity
 * (R33) and reflection JSONL parity (R32). Without phase triples, the whole
 * phase-tracking layer of the Algorithm is unverifiable.
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "KG must contain phase predicate triples (phase_started, phase_complete, phase_transition, or similar)";

const PHASE_PREDICATES_LIKE = "phase%";

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

// ctx is required by the CheckHandler interface signature
export async function r31PhasePredicateEmission(_ctx: CheckContext): Promise<CheckResult> {
  const kgPath = resolveKgPath();

  if (!kgPath) {
    return {
      rId: "R31",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["KG sqlite3 not found — MemPalace not initialised"],
    };
  }

  let phaseCount: number;
  let totalCount: number;

  try {
    // @ts-ignore bun:sqlite is a Bun built-in
    const { Database } = await import("bun:sqlite") as { Database: new (path: string, opts?: { readonly?: boolean }) => { query: (sql: string) => { get: () => unknown; all: () => unknown[] }; close: () => void } };
    const db = new Database(kgPath, { readonly: true });

    const phaseRow = db.query(
      `SELECT COUNT(*) as cnt FROM triples WHERE predicate LIKE '${PHASE_PREDICATES_LIKE}'`,
    ).get() as CountRow | null;
    phaseCount = phaseRow?.cnt ?? 0;

    const totalRow = db.query("SELECT COUNT(*) as cnt FROM triples").get() as CountRow | null;
    totalCount = totalRow?.cnt ?? 0;

    db.close();
  } catch (err) {
    return {
      rId: "R31",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `KG query failed — ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (totalCount === 0) {
    return {
      rId: "R31",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["KG has no triples — system has not written any KG data yet"],
    };
  }

  if (phaseCount === 0) {
    return {
      rId: "R31",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `No phase predicate triples found in KG (${totalCount} total triples)`,
        "Expected predicates like: phase_started, phase_complete, phase_transition",
        "Phase instrumentation is not emitting KG facts — check Algorithm LEARN phase implementation",
      ],
    };
  }

  return {
    rId: "R31",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${phaseCount} phase predicate triple(s) found in KG (of ${totalCount} total)`,
    ],
  };
}
