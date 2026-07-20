#!/usr/bin/env bun
/**
 * ValidateSeatRecruitment — close the named-specialist recruitment gap
 * (Tailor Gen 68; gen-067 council-seam audit, conversion #2).
 *
 * The interactive council's named-specialist path ("Council with Fowler,
 * KentBeck, ...") previously fuzzy-matched names in prose and handed the
 * result straight to Task(subagent_type:) — a mistyped or hallucinated
 * name reached the spawn layer unchecked (vcr, by contrast, enum-coerces
 * against a hard allowlist).
 *
 * Design choices (deliberate):
 *  - The roster is DERIVED FROM DISK (~/.claude/agents/<Name>.md), never a
 *    hand-typed array — a new seat def is recruitable the moment its file
 *    exists, and there is no second copy to drift (PRD-B lesson).
 *  - Unknown names FAIL LOUDLY with a nearest-match suggestion; there is no
 *    silent coercion to a default seat. vcr degrades silently by design
 *    (unattended workflow); an interactive council has an operator present —
 *    surfacing the typo beats masking it.
 *
 * Usage:
 *   bun run ValidateSeatRecruitment.ts <Name> [<Name> ...] [--json]
 * Exit: 0 all resolve · 1 any unknown · 2 usage/roster error.
 */
import { readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const AGENTS_DIR = join(homedir(), ".claude", "agents");

/** Case-insensitive roster from disk: basename (sans .md) → canonical name. */
export function loadRoster(dir: string = AGENTS_DIR): Map<string, string> {
  const roster = new Map<string, string>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const name = f.slice(0, -3);
    roster.set(name.toLowerCase(), name);
  }
  return roster;
}

/** Levenshtein distance — small inputs only (seat names). */
function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export interface SeatValidation {
  ok: boolean;
  resolved: string[];           // canonical names, spawn-safe
  unknown: { asked: string; suggestion: string | null }[];
}

export function validateSeats(names: string[], roster: Map<string, string>): SeatValidation {
  const resolved: string[] = [];
  const unknown: { asked: string; suggestion: string | null }[] = [];
  for (const raw of names) {
    const key = raw.trim().toLowerCase();
    const hit = roster.get(key);
    if (hit) { resolved.push(hit); continue; }
    let best: string | null = null;
    let bestD = Infinity;
    for (const [k, canonical] of roster) {
      const d = lev(key, k);
      if (d < bestD) { bestD = d; best = canonical; }
    }
    unknown.push({ asked: raw, suggestion: bestD <= 3 ? best : null });
  }
  return { ok: unknown.length === 0, resolved, unknown };
}

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  const asJson = args.includes("--json");
  const names = args.filter((a) => !a.startsWith("--"));
  if (names.length === 0) {
    console.error("Usage: bun run ValidateSeatRecruitment.ts <Name> [<Name> ...] [--json]");
    process.exit(2);
  }
  let roster: Map<string, string>;
  try {
    roster = loadRoster();
  } catch (e) {
    console.error(`roster unreadable (${AGENTS_DIR}): ${e}`);
    process.exit(2);
  }
  const v = validateSeats(names, roster);
  if (asJson) console.log(JSON.stringify(v, null, 2));
  else {
    for (const r of v.resolved) console.log(`OK      ${r}`);
    for (const u of v.unknown)
      console.log(`UNKNOWN ${u.asked}${u.suggestion ? `  — did you mean ${u.suggestion}?` : ""}`);
  }
  process.exit(v.ok ? 0 : 1);
}
