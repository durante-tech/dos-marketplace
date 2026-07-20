#!/usr/bin/env bun
/**
 * MemPalaceLearn.hook.ts — Fast-path SessionEnd wrapper.
 *
 * PURPOSE:
 * Walks LEARNING/{ALGORITHM,SYSTEM,FAILURES} for files newer than the last
 * sync watermark and spawns detached `MemPalaceLearn.daemon.ts` to do the
 * slow per-file `bridgeSync('classify')` calls + drawer filing OFF the
 * SessionEnd critical path. Exits in <500ms.
 *
 * WHY THIS SPLIT (RFC-0037 follow-up, 2026-05-03):
 * The unified hook called `bridgeSync('classify', ..., 3000)` once per
 * learning file in a sequential loop. Five learnings × 3s timeout = 15s,
 * exceeding Claude Code's SessionEnd reaper budget. Same silent SIGKILL
 * profile as MemoryHarvest pre-fix — 0 entries in hook-timing.jsonl
 * despite being registered for SessionEnd. Mirrors the MemoryHarvest +
 * StudioSync splits shipped earlier today.
 *
 * TRIGGER: SessionEnd
 *
 * INPUT:
 * - stdin: { session_id, transcript_path, hook_event_name }
 * - Files: MEMORY/LEARNING/{ALGORITHM,SYSTEM,FAILURES}/YYYY-MM/*.md
 *
 * OUTPUT:
 * - stderr: status messages
 * - Spawns: MemPalaceLearn.daemon.ts (does classify + add_drawer)
 * - exit(0): always (non-blocking)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - MUST RUN AFTER: WorkCompletionLearning (needs learning files to exist)
 * - INDEPENDENT OF: SessionCleanup
 *
 * PERFORMANCE:
 * - Wrapper: <500ms (file walk + spawn)
 * - Daemon: 3-15s in background, does not block parent
 */

import { spawn } from "child_process";
import { readFileSync, existsSync, readdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { resolveProjectWingFromEnv } from "./lib/project-resolver";
import { BRIDGE_PATH } from "./lib/mempalace";
import { getMemorySubdir } from "./lib/paths";
import { startTimer, stopTimer } from './lib/hook-io';

const LEARNING_DIR = getMemorySubdir("LEARNING");
// Watermark MUST be project-scoped to match the project-scoped LEARNING_DIR walk.
// A GLOBAL watermark lets Project A's session-end advance lastSync past Project
// B's not-yet-processed learnings, which findNewLearnings then silently skips
// forever (H-074, the H-066 class). getLastSyncTime's 1h fallback bounds the
// first-run window, so project-scoping cannot flood. The daemon writes this
// SAME path (both inherit CLAUDE_PROJECT_DIR, so getMemorySubdir agrees).
const STATE_FILE = join(getMemorySubdir("STATE"), "mempalace-last-sync.json");
const DAEMON_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "MemPalaceLearn.daemon.ts");

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name?: string;
}

async function readHookInput(): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let input = "";
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 500));
    const read = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        input += decoder.decode(value, { stream: true });
      }
    })();
    await Promise.race([read, timeout]);
    return input.trim() ? (JSON.parse(input) as HookInput) : null;
  } catch {
    return null;
  }
}

function getLastSyncTime(): Date {
  try {
    if (existsSync(STATE_FILE)) {
      const state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      return new Date(state.lastSync);
    }
  } catch {
    // First run
  }
  return new Date(Date.now() - 60 * 60 * 1000);
}

function findNewLearnings(since: Date): Array<{ path: string; category: string }> {
  const results: Array<{ path: string; category: string }> = [];

  for (const category of ["ALGORITHM", "SYSTEM"]) {
    const categoryDir = join(LEARNING_DIR, category);
    if (!existsSync(categoryDir)) continue;
    try {
      const months = readdirSync(categoryDir).filter((d) => /^\d{4}-\d{2}$/.test(d));
      for (const month of months) {
        const monthDir = join(categoryDir, month);
        try {
          const files = readdirSync(monthDir).filter((f) => f.endsWith(".md"));
          for (const file of files) {
            const filepath = join(monthDir, file);
            try {
              const stat = Bun.file(filepath);
              if (stat.lastModified > since.getTime()) {
                results.push({ path: filepath, category: category.toLowerCase() });
              }
            } catch { /* skip unreadable */ }
          }
        } catch { /* skip unreadable dirs */ }
      }
    } catch { /* skip */ }
  }

  const failuresDir = join(LEARNING_DIR, "FAILURES");
  if (existsSync(failuresDir)) {
    try {
      const months = readdirSync(failuresDir).filter((d) => /^\d{4}-\d{2}$/.test(d));
      for (const month of months) {
        const monthDir = join(failuresDir, month);
        try {
          const dirs = readdirSync(monthDir);
          for (const dir of dirs) {
            const contextFile = join(monthDir, dir, "CONTEXT.md");
            if (existsSync(contextFile)) {
              try {
                const stat = Bun.file(contextFile);
                if (stat.lastModified > since.getTime()) {
                  results.push({ path: contextFile, category: "failures" });
                }
              } catch { /* skip */ }
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return results;
}

function spawnLearnDaemon(payload: Record<string, unknown>): void {
  if (!existsSync(DAEMON_SCRIPT)) {
    console.error(`[MemPalaceLearn] Daemon missing at ${DAEMON_SCRIPT} — skipping`);
    return;
  }
  const inputPath = join(tmpdir(), `dos-learn-${process.pid}-${Date.now()}.json`);
  try {
    writeFileSync(inputPath, JSON.stringify(payload));
  } catch (err) {
    console.error(`[MemPalaceLearn] Failed to write daemon input: ${err}`);
    return;
  }
  try {
    const child = spawn(process.execPath, [DAEMON_SCRIPT], {
      env: {
        ...process.env,
        DOS_LEARN_INPUT_FILE: inputPath,
      },
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    console.error(`[MemPalaceLearn] Spawned daemon pid=${child.pid ?? -1} input=${inputPath}`);
  } catch (err) {
    console.error(`[MemPalaceLearn] Failed to spawn daemon: ${err}`);
  }
}

async function main(): Promise<void> {
  const input = await readHookInput();
  if (!input) {
    process.exit(0);
  }

  if (!existsSync(BRIDGE_PATH)) {
    console.error("[MemPalaceLearn] Bridge not installed, skipping");
    process.exit(0);
  }

  const since = getLastSyncTime();
  const newLearnings = findNewLearnings(since);

  if (newLearnings.length === 0) {
    console.error("[MemPalaceLearn] No new learnings to file");
    process.exit(0);
  }

  const { wing: projectWing } = resolveProjectWingFromEnv();
  const targetWing = projectWing ? `${projectWing}` : "learnings";

  spawnLearnDaemon({
    sessionId: input.session_id,
    targetWing,
    learnings: newLearnings,
  });

  process.exit(0);
}

const _t = startTimer('MemPalaceLearn');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));
main().catch((err) => {
  console.error("[MemPalaceLearn] Fatal:", err);
  process.exit(0);
});
