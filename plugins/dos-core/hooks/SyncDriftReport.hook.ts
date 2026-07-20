#!/usr/bin/env bun
/**
 * SyncDriftReport.hook.ts — SessionEnd four-copy drift observability
 *
 * PURPOSE:
 * At SessionEnd, runs the project's Tools/sync-check.ts --json (if present)
 * and appends the result to the operator's LEARNING/SYS/sync-drift-YYYYMMDD.jsonl.
 * Turns "am I in sync?" from an invisible correctness property into a tracked
 * metric queryable via jq or Studio sync.
 *
 * TRIGGER: SessionEnd
 *
 * DESIGN:
 * - Fire-and-forget — never blocks SessionEnd even if project root is missing
 * - Silent on success (no console spam)
 * - Writes one JSONL row per session with timestamp + pair counts + exit_code
 *
 * FAILURE MODES:
 * - Project root missing → silently skip (fresh clone / different operator)
 * - sync-check.ts missing → silently skip (operator machine w/o DOS-author tools)
 * - JSON parse fails → write a minimal error row, still exit 0
 */
import { existsSync, appendFileSync, mkdirSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { join } from "node:path";
import { resolveProjectRoot, getMemorySubdir } from "./lib/paths";

const PROJECT_ROOT = resolveProjectRoot();
const SYNC_CHECK = join(PROJECT_ROOT, "Tools", "sync-check.ts");
const LOG_DIR = join(getMemorySubdir("LEARNING"), "SYS");

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function main(): void {
  if (!existsSync(SYNC_CHECK)) {
    process.exit(0);
  }

  // Detach the sync-check spawn so SessionEnd doesn't wait for ~1-2s of
  // sha256 scanning (cumulative with other SessionEnd hooks → reaper
  // SIGTERM → "Hook cancelled" in operator logs, 2026-05-16). Self-fork
  // re-enters the same file with SYNC_DRIFT_DETACHED=1; the parent exits
  // immediately. Mirrors the StudioSync wrapper+daemon split intent
  // (~/.claude/hooks/StudioSync.hook.ts:11-14) without adding a second
  // file — drift-row work is small enough to keep inline.
  if (process.env.SYNC_DRIFT_DETACHED !== "1") {
    spawn(process.execPath, [__filename], {
      env: { ...process.env, SYNC_DRIFT_DETACHED: "1" },
      detached: true,
      stdio: "ignore",
    }).unref();
    process.exit(0);
  }

  let row: Record<string, unknown>;
  try {
    const result = spawnSync("bun", [SYNC_CHECK, "--json"], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      // sync-check --json emits ~1.3MB (per-file rows for 4091 entries),
      // exceeding Node's 1MB default. Use 16MB so corpus growth has headroom.
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
      throw new Error(result.error?.message || "sync-check failed");
    }
    const output = result.stdout;
    const parsed = JSON.parse(output);
    row = {
      timestamp: new Date().toISOString(),
      total_identical: parsed.total_identical,
      total_drift: parsed.total_drift,
      total_missing: parsed.total_missing,
      pair_counts: parsed.pair_counts,
      exit_code: parsed.exit_code,
    };
  } catch (e) {
    row = {
      timestamp: new Date().toISOString(),
      error: (e as Error).message,
      exit_code: -1,
    };
  }

  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(join(LOG_DIR, `sync-drift-${today()}.jsonl`), JSON.stringify(row) + "\n");
  } catch {
    // SessionEnd must not block on logging failures
  }

  process.exit(0);
}

main();
