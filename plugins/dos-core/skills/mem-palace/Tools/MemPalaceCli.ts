#!/usr/bin/env bun
/**
 * MemPalaceCli — small deterministic helpers for MemPalace workflows.
 *
 * Relocates deterministic logic out of workflow prose (RFC-0126 §9, B3 dedup).
 *
 * Subcommands:
 *   find-latest-reconcile   Resolve the most-recent KG reconcile report path.
 *                           Project-level MEMORY/STATE takes priority over global.
 *   render-reconcile        Render a kg-reconcile report JSON into the
 *                           by-category findings markdown.
 *   render-mine-summary     Render the project-mining-complete summary markdown.
 *   render-mine-file-cmd    Print the bridge mine_file shell command for a file.
 *   derive-room             Normalize a filepath to its MemPalace room name.
 *
 * Usage:
 *   bun MemPalaceCli.ts find-latest-reconcile        # prints the path, or "" if none
 *   bun MemPalaceCli.ts find-latest-reconcile --json # { path, candidates }
 *   bun MemPalaceCli.ts render-reconcile <report.json>
 *   bun MemPalaceCli.ts render-mine-summary <data.json>
 *   bun MemPalaceCli.ts render-mine-file-cmd <filepath> <wing> <room>
 *   bun MemPalaceCli.ts derive-room <filepath>
 *
 * @version 1.1.0
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { basename, join } from "path";

import { getMemorySubdir, getAllMemorySubdirs } from "../Lib/paths";

// ---------------------------------------------------------------------------
// findLatestReconcileReport
// ---------------------------------------------------------------------------

const RECONCILE_PREFIX = "kg-reconcile-";
const RECONCILE_SUFFIX = ".json";

/**
 * Pick the most-recent `kg-reconcile-*.json` inside a single STATE directory.
 * Returns the absolute path with the newest mtime, or null when the directory
 * holds no matching report. Mirrors the prose `ls -t ... | head -1`.
 */
export function latestReconcileInDir(stateDir: string): string | null {
  if (!existsSync(stateDir)) return null;

  let best: { path: string; mtimeMs: number } | null = null;
  let entries: string[];
  try {
    entries = readdirSync(stateDir);
  } catch {
    return null;
  }

  for (const name of entries) {
    if (!name.startsWith(RECONCILE_PREFIX) || !name.endsWith(RECONCILE_SUFFIX)) continue;
    const full = join(stateDir, name);
    let mtimeMs: number;
    try {
      const st = statSync(full);
      if (!st.isFile()) continue;
      mtimeMs = st.mtimeMs;
    } catch {
      continue;
    }
    if (best === null || mtimeMs > best.mtimeMs) {
      best = { path: full, mtimeMs };
    }
  }

  return best ? best.path : null;
}

/**
 * Resolve the latest KG reconcile report across candidate STATE directories.
 *
 * Behaviour-preserving relocation of MergeReconcile.md Step 1: the prose
 * lists the latest global report, then the latest project-level report, with
 * the note "Project-level path takes priority". We honour that ordering — the
 * first candidate directory that yields a report wins; within a directory the
 * newest by mtime wins (the `-t ... | head -1` semantics).
 *
 * Candidate ordering: project-level MEMORY/STATE first (CLAUDE_PROJECT_DIR /
 * cwd resolution via getMemorySubdir), then global, plus any additional
 * per-project STATE dirs from PROJECTS.md (getAllMemorySubdirs). Duplicates
 * are skipped so a single physical dir is only scanned once.
 *
 * @param candidateDirs Optional explicit STATE-directory list (test seam).
 *                      When omitted, the default DOS resolution chain is used.
 * @returns Absolute path to the chosen report, or null when none exist.
 */
export function findLatestReconcileReport(candidateDirs?: string[]): string | null {
  const dirs = candidateDirs ?? defaultStateDirs();

  const seen = new Set<string>();
  for (const dir of dirs) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    const hit = latestReconcileInDir(dir);
    if (hit) return hit;
  }
  return null;
}

/**
 * The default ordered STATE-directory candidate list.
 * Project-first (getMemorySubdir), then every known STATE dir (global + all
 * projects) so a report authored in any project's MEMORY/STATE is reachable.
 */
function defaultStateDirs(): string[] {
  const dirs: string[] = [];
  // Project-first per getMemorySubdir's three-step chain. Drives the
  // "project-level path takes priority" note from the workflow prose.
  dirs.push(getMemorySubdir("STATE"));
  // Global + all per-project STATE dirs (deduped against the project-first hit
  // inside findLatestReconcileReport).
  for (const d of getAllMemorySubdirs("STATE")) dirs.push(d);
  return dirs;
}

// ---------------------------------------------------------------------------
// renderReconcileFindings (RFC-0126 §9 B1 relocation)
//
// Behaviour-preserving relocation of MergeReconcile.md Step 3 ("Present
// Findings by Category"). Renders a kg-reconcile-*.json report into the
// by-category findings markdown. The `[N]` bracket index is a running 1-based
// counter across all corrections in fixed category order
// (unknown_predicate → orphaned_triple → empty_entity → alias_predicate),
// matching the prose skeleton. Golden-tested in MemPalaceCli.test.ts.
// ---------------------------------------------------------------------------

interface ReconcileCorrection {
  id?: string;
  type: "unknown_predicate" | "orphaned_triple" | "empty_entity" | "alias_predicate";
  subject?: string;
  predicate?: string;
  object?: string;
  suggestion?: string;
  triples_affected?: number;
  status?: string;
}

interface ReconcileReport {
  run_at?: string;
  session_id?: string;
  summary?: {
    total_corrections?: number;
    orphaned_triples?: number;
    unknown_predicates?: number;
    empty_entities?: number;
    alias_predicates?: number;
  };
  corrections?: ReconcileCorrection[];
}

/**
 * Render the by-category reconcile findings markdown from a report object.
 * Date in the header is the date portion of `run_at` (YYYY-MM-DD).
 */
export function renderReconcileFindings(report: ReconcileReport): string {
  const corrections = report.corrections ?? [];
  const date = (report.run_at ?? "").slice(0, 10) || "YYYY-MM-DD";
  const total = report.summary?.total_corrections ?? corrections.length;

  const byType = (t: ReconcileCorrection["type"]) =>
    corrections.filter((c) => c.type === t);
  const unknown = byType("unknown_predicate");
  const orphaned = byType("orphaned_triple");
  const empty = byType("empty_entity");
  const alias = byType("alias_predicate");

  // Running index across categories in fixed order.
  let idx = 0;
  const next = () => ++idx;

  const lines: string[] = [];
  lines.push(`KG Reconcile Report — ${date}`);
  lines.push(`  Total corrections: ${total}`);
  lines.push("");
  lines.push(`  Unknown predicates (${unknown.length}):`);
  for (const c of unknown) {
    lines.push(`    [${next()}] subject: "${c.subject}" | pred: "${c.predicate}" → suggest: "${c.suggestion}"`);
  }
  lines.push("");
  lines.push(`  Orphaned triples (${orphaned.length}):`);
  for (const c of orphaned) {
    lines.push(`    [${next()}] subject: "${c.subject}" | pred: "${c.predicate}" | no entity record`);
  }
  lines.push("");
  lines.push(`  Empty entities (${empty.length}):`);
  for (const c of empty) {
    lines.push(`    [${next()}] entity "${c.subject}" — 0 triples, safe to remove`);
  }
  lines.push("");
  lines.push(`  Alias predicates to collapse (${alias.length}):`);
  for (const c of alias) {
    lines.push(`    [${next()}] "${c.predicate}" → "${c.suggestion}" (${c.triples_affected ?? 0} triples affected)`);
  }
  lines.push("");
  lines.push(`Apply [1-N], skip [1-N], or "apply all" / "apply safe-only"`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// loadReconcileReport (RFC-0126 §9 B7 relocation)
//
// Behaviour-preserving relocation of MergeReconcile.md Step 2 ("Load and Parse
// the Report"). The prose previously instructed the agent to `cat` the file and
// JSON.parse + eyeball it against the documented schema. That parse-and-validate
// is deterministic — a malformed report or one missing the `corrections` array
// should fail loudly, not be silently mis-read. The loader reads the file,
// parses JSON, and asserts the load-bearing shape (a `corrections` array;
// `summary` is optional). Pure transform path (`parseReconcileReport`) is
// tested independently of the file read.
// ---------------------------------------------------------------------------

/**
 * Parse + validate reconcile-report text into a typed ReconcileReport.
 * Throws on invalid JSON or a missing/non-array `corrections` field — the two
 * failure modes the agent would otherwise have to spot by eye. Pure (no I/O)
 * so it is directly oracle-testable.
 */
export function parseReconcileReport(text: string): ReconcileReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`reconcile report is not valid JSON: ${String(e)}`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("reconcile report must be a JSON object");
  }
  const report = parsed as ReconcileReport;
  if (!Array.isArray(report.corrections)) {
    throw new Error('reconcile report missing required "corrections" array');
  }
  return report;
}

/** Read + parse + validate a reconcile report from disk. Thin I/O wrapper. */
export function loadReconcileReport(filePath: string): ReconcileReport {
  return parseReconcileReport(readFileSync(filePath, "utf-8"));
}

// ---------------------------------------------------------------------------
// planReconcileCorrections (RFC-0126 §9 B7 relocation)
//
// Behaviour-preserving relocation of MergeReconcile.md Step 4 ("Apply
// Corrections") dispatch logic + the "Correction Type → Bridge Action" table.
// The deterministic core is: given the corrections list and a safe-only flag,
// map each correction type to the bridge action + JSON args it requires, and
// (for safe-only) drop the types that need manual confirmation. The actual
// bridge subprocess call stays in the workflow / a thin I/O caller — this pure
// transform just produces the ordered call plan, which is what is testable.
//
// Type → action mapping (from the prose table):
//   unknown_predicate → reconcile {action:"rename_predicate", from, to}   (needs target; UNSAFE)
//   alias_predicate   → reconcile {action:"rename_predicate", from, to}   (unambiguous; SAFE)
//   orphaned_triple   → invalidate {subject, predicate, object}           (UNSAFE — manual confirm)
//   empty_entity      → reconcile {action:"prune_empty_entities"}         (SAFE)
//
// "safe-only" keeps empty_entity + alias_predicate (Notes: unambiguous target),
// and skips unknown_predicate + orphaned_triple. Mirrors the workflow Notes
// verbatim.
// ---------------------------------------------------------------------------

export interface ReconcileBridgeCall {
  /** Source correction id (for traceability / status write-back). */
  correction_id?: string;
  /** Correction type that produced this call. */
  type: ReconcileCorrection["type"];
  /** Bridge action to invoke. */
  bridge_action: "reconcile" | "invalidate";
  /** JSON args object for the bridge action. */
  args: Record<string, unknown>;
  /** True when this type is auto-applicable under safe-only. */
  safe: boolean;
}

const SAFE_TYPES: ReadonlySet<ReconcileCorrection["type"]> = new Set([
  "empty_entity",
  "alias_predicate",
]);

/**
 * Map a single correction to its bridge call. Returns null for empty-entity
 * dedup (handled by one prune call appended once by the planner) — keeps the
 * per-correction mapping pure and total.
 */
function bridgeCallForCorrection(c: ReconcileCorrection): ReconcileBridgeCall | null {
  const safe = SAFE_TYPES.has(c.type);
  switch (c.type) {
    case "unknown_predicate":
    case "alias_predicate":
      return {
        correction_id: c.id,
        type: c.type,
        bridge_action: "reconcile",
        args: { action: "rename_predicate", from: c.predicate, to: c.suggestion },
        safe,
      };
    case "orphaned_triple":
      return {
        correction_id: c.id,
        type: c.type,
        bridge_action: "invalidate",
        args: { subject: c.subject, predicate: c.predicate, object: c.object },
        safe,
      };
    case "empty_entity":
      // Pruning is a single batch call (prune_empty_entities), appended once.
      return null;
    default:
      return null;
  }
}

/**
 * Build the ordered bridge-call plan for a set of corrections.
 *
 * @param corrections the report's corrections array.
 * @param opts.safeOnly when true, only empty_entity + alias_predicate types are
 *        included (the "apply safe-only" path); unknown_predicate and
 *        orphaned_triple are skipped (manual confirmation required).
 * @returns ordered ReconcileBridgeCall[]. When any empty_entity corrections are
 *          present (and admitted by the filter), exactly one trailing
 *          `reconcile {action:"prune_empty_entities"}` call is appended.
 */
export function planReconcileCorrections(
  corrections: ReconcileCorrection[],
  opts: { safeOnly?: boolean } = {}
): ReconcileBridgeCall[] {
  const safeOnly = opts.safeOnly ?? false;
  const admitted = corrections.filter((c) => (safeOnly ? SAFE_TYPES.has(c.type) : true));

  const calls: ReconcileBridgeCall[] = [];
  for (const c of admitted) {
    const call = bridgeCallForCorrection(c);
    if (call) calls.push(call);
  }

  // One prune call covers all admitted empty_entity corrections.
  if (admitted.some((c) => c.type === "empty_entity")) {
    calls.push({
      type: "empty_entity",
      bridge_action: "reconcile",
      args: { action: "prune_empty_entities" },
      safe: true,
    });
  }

  return calls;
}

// ---------------------------------------------------------------------------
// renderMineProjectSummary (RFC-0126 §9 B2 relocation)
//
// Behaviour-preserving relocation of MineProject.md "Output Format". The tally
// fields are supplied by the agent after the mining run (they count what the
// run did and are not derivable from any single artifact). Golden-tested.
// ---------------------------------------------------------------------------

export interface MineProjectSummary {
  project_name: string;
  wing_name: string;
  files_scanned: number;
  drawers_created: number;
  kg_facts_added: number;
  /** Ordered room/count pairs, e.g. [["architecture", 4], ["api-routes", 7]]. */
  rooms: Array<[string, number]>;
}

/**
 * Render the project-mining-complete summary markdown. The `Rooms:` line is the
 * comma-joined `room (count)` list, matching the prose "[list of rooms with
 * counts]" placeholder.
 */
export function renderMineProjectSummary(data: MineProjectSummary): string {
  const roomsList = data.rooms.map(([room, count]) => `${room} (${count})`).join(", ");

  const lines: string[] = [];
  lines.push(`Project Mining Complete: ${data.project_name}`);
  lines.push("");
  lines.push(`  Wing: ${data.wing_name}`);
  lines.push(`  Files scanned: ${data.files_scanned}`);
  lines.push(`  Drawers created: ${data.drawers_created}`);
  lines.push(`  KG facts added: ${data.kg_facts_added}`);
  lines.push(`  Rooms: [${roomsList}]`);
  lines.push("");
  lines.push(`  L1 wake-up will now include ${data.project_name} context.`);
  lines.push(`  Test: close and reopen this session to see project-aware L1.`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// deriveRoomFromFilepath (RFC-0126 §9 B1 relocation)
//
// Behaviour-preserving relocation of SyncTelos.md Step 4's shell normalization
// `room=$(basename "$f" .md | tr '[:upper:]' '[:lower:]')`. Strips the .md
// extension and lowercases. Golden-tested.
// ---------------------------------------------------------------------------

export function deriveRoomFromFilepath(filepath: string): string {
  return basename(filepath, ".md").toLowerCase();
}

// ---------------------------------------------------------------------------
// renderMineFileCommand (RFC-0126 §9 B1 relocation)
//
// Behaviour-preserving relocation of MineProject.md Step 3 Option A — the
// `uv run ... mine_file '{...}'` bridge command. Interpolates filepath/wing/
// room into the exact shell string the workflow previously hand-typed.
// Golden-tested.
// ---------------------------------------------------------------------------

/** The canonical `uv run ... mempalace_bridge.py` invocation prefix. */
const BRIDGE_INVOKE = "uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py";

export function renderMineFileCommand(filepath: string, wing: string, room: string): string {
  const args = JSON.stringify({ filepath, wing, room });
  return `${BRIDGE_INVOKE} mine_file '${args}'`;
}

// ---------------------------------------------------------------------------
// renderBridgeStatusCommand (RFC-0126 §9 B8 relocation)
//
// Behaviour-preserving relocation of MineProject.md Step 5 ("Verify") — the
// no-arg `... mempalace_bridge.py status` invocation. The command is a constant,
// but the long `uv run ...` prefix is transcription-prone; centralizing it
// (shared BRIDGE_INVOKE with renderMineFileCommand) removes the drift between
// the two workflow callsites. Golden-tested.
// ---------------------------------------------------------------------------

export function renderBridgeStatusCommand(): string {
  return `${BRIDGE_INVOKE} status`;
}

// ---------------------------------------------------------------------------
// renderDiskGuardCheck (PRD 20260626 Feature-6 / ISC-33 / ISC-35)
//
// The single canonical "Step 0 — Disk-Guard Preflight" bash block that every
// mining workflow (Mine / MineDir / MineProject / SyncTelos) embeds VERBATIM.
// Centralizing it here makes the 2026-06-22 disk-fill prevention floor a
// golden-tested invariant rather than four hand-copied blocks that can drift.
// The block aborts (exit 2) before any palace write when free space on the
// palace volume is below the 5GB floor. Pure string — does not run `df`.
// Golden-tested; the workflows paste its output byte-for-byte.
// ---------------------------------------------------------------------------

export function renderDiskGuardCheck(): string {
  return [
    "# Step 0 — Disk-Guard Preflight (MANDATORY before any mining write)",
    "# 2026-06-22 disk-fill prevention: abort ingest if the palace volume is below the safety floor.",
    'PALACE_DIR="${MEMPALACE_DIR:-$HOME/.mempalace}"',
    "FREE_GB=$(df -Pk \"$PALACE_DIR\" 2>/dev/null | awk 'NR==2 {printf \"%d\", $4/1048576}')",
    'if [ "${FREE_GB:-0}" -lt 5 ]; then',
    '  echo "🔴 DISK-GUARD ABORT — ${FREE_GB}GB free on the palace volume (< 5GB floor)."',
    '  echo "   Mining halted to prevent a disk-fill freeze (2026-06-22). Free space, then re-run."',
    "  exit 2",
    "fi",
    'echo "🟢 DISK-GUARD — ${FREE_GB}GB free (>= 5GB floor); safe to mine."',
  ].join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const sub = args.find((a) => !a.startsWith("-"));

  if (args.includes("--help") || args.includes("-h") || !sub) {
    console.log(`MemPalaceCli — deterministic helpers for MemPalace workflows

Subcommands:
  find-latest-reconcile [--json]   Print the latest kg-reconcile-*.json path
                                   (project-level MEMORY/STATE takes priority)
  load-reconcile <report.json>     Parse + validate a reconcile report, print it
  render-reconcile <report.json>   Render KG reconcile findings markdown
  plan-reconcile <report.json> [--safe-only]
                                   Print the bridge-call plan (JSON) for the
                                   report's corrections
  render-mine-summary <data.json>  Render project-mining-complete summary
  render-mine-file-cmd <fp> <w> <r>  Print the bridge mine_file shell command
  render-verify-cmd                Print the bridge status verify command
  render-disk-guard                Print the Step-0 disk-guard preflight block
  derive-room <filepath>           Normalize a filepath to its room name`);
    process.exit(sub ? 0 : 1);
  }

  if (sub === "find-latest-reconcile") {
    const path = findLatestReconcileReport();
    if (args.includes("--json")) {
      console.log(JSON.stringify({ status: "ok", path: path ?? null }));
    } else {
      console.log(path ?? "");
    }
    process.exit(path ? 0 : 1);
  }

  if (sub === "load-reconcile") {
    const file = args.find((a) => !a.startsWith("-") && a !== sub);
    if (!file) {
      console.error("usage: load-reconcile <report.json>");
      process.exit(2);
    }
    const report = loadReconcileReport(file);
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  if (sub === "render-reconcile") {
    const file = args.find((a) => !a.startsWith("-") && a !== sub);
    if (!file) {
      console.error("usage: render-reconcile <report.json>");
      process.exit(2);
    }
    const report = loadReconcileReport(file);
    console.log(renderReconcileFindings(report));
    process.exit(0);
  }

  if (sub === "plan-reconcile") {
    const file = args.find((a) => !a.startsWith("-") && a !== sub);
    if (!file) {
      console.error("usage: plan-reconcile <report.json> [--safe-only]");
      process.exit(2);
    }
    const report = loadReconcileReport(file);
    const plan = planReconcileCorrections(report.corrections ?? [], {
      safeOnly: args.includes("--safe-only"),
    });
    console.log(JSON.stringify(plan, null, 2));
    process.exit(0);
  }

  if (sub === "render-mine-summary") {
    const file = args.find((a) => !a.startsWith("-") && a !== sub);
    if (!file) {
      console.error("usage: render-mine-summary <data.json>");
      process.exit(2);
    }
    const data = JSON.parse(readFileSync(file, "utf-8")) as MineProjectSummary;
    console.log(renderMineProjectSummary(data));
    process.exit(0);
  }

  if (sub === "render-mine-file-cmd") {
    const rest = args.filter((a) => !a.startsWith("-") && a !== sub);
    const [filepath, wing, room] = rest;
    if (!filepath || !wing || !room) {
      console.error("usage: render-mine-file-cmd <filepath> <wing> <room>");
      process.exit(2);
    }
    console.log(renderMineFileCommand(filepath, wing, room));
    process.exit(0);
  }

  if (sub === "render-verify-cmd") {
    console.log(renderBridgeStatusCommand());
    process.exit(0);
  }

  if (sub === "render-disk-guard") {
    console.log(renderDiskGuardCheck());
    process.exit(0);
  }

  if (sub === "derive-room") {
    const file = args.find((a) => !a.startsWith("-") && a !== sub);
    if (!file) {
      console.error("usage: derive-room <filepath>");
      process.exit(2);
    }
    console.log(deriveRoomFromFilepath(file));
    process.exit(0);
  }

  console.error(JSON.stringify({ status: "error", error: `Unknown subcommand: ${sub}` }));
  process.exit(2);
}

if (import.meta.main) {
  main();
}
