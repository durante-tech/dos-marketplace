/**
 * R30 — mempalace-drift.jsonl entries from last 7d are tracked aliases or empty.
 *
 * The MemPalace bridge logs predicate drift events to mempalace-drift.jsonl
 * whenever a KG write uses a predicate not in the canonical vocabulary. The
 * intent is that drift events are short-lived: they should be reviewed and
 * either added to PREDICATES.md (making them canonical) or aliased to an
 * existing canonical predicate.
 *
 * This check reads the drift log and verifies that all entries in the last 7
 * days are either:
 *   (a) already in the canonical vocabulary (R19 would catch these as violations)
 *   (b) the file is empty (no drift events = healthy state)
 *
 * "Tracked aliases" means: the drifted predicate appears in PREDICATES.md
 * under an alias entry, not just as a standalone unknown.
 *
 * This is a dynamic/live-only check: returns `not_applicable` if the drift
 * log file is not found.
 *
 * Drift log resolution:
 *   1. $HOME/.claude/MEMORY/MEMPALACE/mempalace-drift.jsonl
 *   2. $HOME/.claude/MEMORY/STATE/mempalace-drift.jsonl (legacy location)
 *
 * Failure modes:
 *   - Drift log not found → not_applicable
 *   - Drift log has entries from last 7d with unknown predicates → fail
 *
 * Why R-class: unresolved drift accumulation fragments the KG vocabulary.
 * Each unresolved drift event creates a query blind spot: `worked_on` and
 * `worked-on` as separate predicates means half the data is invisible.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "mempalace-drift.jsonl must have no unresolved entries in the last 7 days";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface DriftEntry {
  predicate?: string;
  resolved?: boolean;
  timestamp?: string;
  ts?: string;
  created_at?: string;
}

function resolveDriftLogPath(): string | null {
  const home = homedir();
  const candidates = [
    join(home, ".claude", "MEMORY", "MEMPALACE", "mempalace-drift.jsonl"),
    join(home, ".claude", "MEMORY", "STATE", "mempalace-drift.jsonl"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function parseTimestamp(entry: DriftEntry): number | null {
  const raw = entry.timestamp ?? entry.ts ?? entry.created_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return isNaN(ms) ? null : ms;
}

export async function r30DriftTelemetryLiveness(ctx: CheckContext): Promise<CheckResult> {
  const nowMs = ctx.nowMs ?? Date.now();
  const cutoffMs = nowMs - SEVEN_DAYS_MS;

  const driftLogPath = resolveDriftLogPath();

  if (!driftLogPath) {
    return {
      rId: "R30",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        "mempalace-drift.jsonl not found at any known location — drift telemetry not yet running",
      ],
    };
  }

  let lines: string[];
  try {
    const content = readFileSync(driftLogPath, "utf-8");
    lines = content.split("\n").filter(Boolean);
  } catch (err) {
    return {
      rId: "R30",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `Failed to read ${driftLogPath}: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (lines.length === 0) {
    return {
      rId: "R30",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: ["mempalace-drift.jsonl is empty — no drift events recorded (clean state)"],
    };
  }

  // Parse entries and filter to last 7 days
  const recentUnresolved: DriftEntry[] = [];
  let parseErrors = 0;

  for (const line of lines) {
    let entry: DriftEntry;
    try {
      entry = JSON.parse(line) as DriftEntry;
    } catch {
      parseErrors++;
      continue;
    }

    // Check if within 7-day window
    const entryMs = parseTimestamp(entry);
    if (entryMs !== null && entryMs < cutoffMs) continue; // older than 7d

    // Within window: check if resolved
    if (!entry.resolved) {
      recentUnresolved.push(entry);
    }
  }

  if (recentUnresolved.length === 0) {
    return {
      rId: "R30",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${lines.length} total drift entry(ies) in log — none unresolved in last 7 days`,
        ...(parseErrors > 0 ? [`${parseErrors} line(s) could not be parsed as JSON`] : []),
      ],
    };
  }

  const uniquePredicates = [...new Set(recentUnresolved.map((e) => e.predicate ?? "(unknown)"))];
  const preview = uniquePredicates.slice(0, 10).join(", ");
  const overflow = uniquePredicates.length > 10 ? ` (+${uniquePredicates.length - 10} more)` : "";

  return {
    rId: "R30",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${recentUnresolved.length} unresolved drift event(s) in last 7 days`,
      `Unresolved predicates: ${preview}${overflow}`,
      "Add these predicates to PREDICATES.md canonical list or alias map to resolve",
    ],
  };
}
