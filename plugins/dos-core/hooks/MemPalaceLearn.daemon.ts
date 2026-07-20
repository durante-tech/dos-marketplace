#!/usr/bin/env bun
/**
 * MemPalaceLearn.daemon.ts — Slow-path learning-file classifier + filer.
 *
 * PURPOSE:
 * Runs the per-learning `bridgeSync('classify')` loop OFF the SessionEnd
 * critical path. Spawned detached by `MemPalaceLearn.hook.ts` after the
 * wrapper finds N new learning files.
 *
 * RATIONALE (RFC-0037 follow-up, 2026-05-03):
 * The unified MemPalaceLearn hook called `bridgeSync('classify', ..., 3000)`
 * once per learning file in a sequential loop. Five learnings × 3s timeout
 * = 15s, which exceeds Claude Code's SessionEnd reaper budget. Same silent
 * SIGKILL profile as MemoryHarvest pre-fix. Mirrors the MemoryHarvest +
 * StudioSync splits shipped earlier today and the original
 * SessionContextSnapshot/Enrich split from RFC-0027.
 *
 * INPUT:
 * - env DOS_LEARN_INPUT_FILE: tmp JSON file written by the wrapper with
 *   { sessionId, targetWing, learnings: [{path, category}] }
 *
 * OUTPUT:
 * - stderr: status messages (lost when stdio:'ignore' from spawn)
 * - Side effects:
 *   - bridge add_drawer per learning (fire-and-forget)
 *   - MEMORY/STATE/mempalace-last-sync.json updated to gate next wrapper run
 * - exit(0): always
 *
 * PERFORMANCE:
 * - 3-15s typical (3s × N learnings, classify dominates); detached so the
 *   harness can't kill it.
 */

import { readFileSync, existsSync, writeFileSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { BRIDGE_PATH, bridgeSync, bridgeFire } from "./lib/mempalace";
import { startTimer, stopTimer } from './lib/hook-io';
import { emitMemoryDigest } from './lib/memory-digest';
import { getMemorySubdir } from "./lib/paths";

// Project-scoped watermark, matching the wrapper's project-scoped LEARNING walk
// (H-074). The daemon inherits CLAUDE_PROJECT_DIR from the wrapper's spawn env,
// so getMemorySubdir resolves the SAME project STATE dir the wrapper reads from.
const STATE_FILE = join(getMemorySubdir("STATE"), "mempalace-last-sync.json");

interface DaemonInput {
  sessionId: string;
  targetWing: string;
  learnings: Array<{ path: string; category: string }>;
}

function readDaemonInput(): DaemonInput | null {
  const inputFile = process.env.DOS_LEARN_INPUT_FILE;
  if (!inputFile || !existsSync(inputFile)) return null;
  try {
    return JSON.parse(readFileSync(inputFile, "utf-8")) as DaemonInput;
  } catch (err) {
    console.error(`[MemPalaceLearn.daemon] Failed to read input file ${inputFile}:`, err);
    return null;
  }
}

function classifyContent(content: string): string | null {
  try {
    const result = bridgeSync("classify", { text: content.slice(0, 2000) }, 3000);
    if (!result.ok) return null;
    const typesFound = result.data.types_found;
    if (Array.isArray(typesFound) && typesFound.length > 0) {
      return typesFound[0] as string;
    }
  } catch {
    // Classification failed, fall back to category
  }
  return null;
}

function fileToMemPalace(
  filepath: string,
  wing: string,
  room: string,
): { classifiedAs: string | null; filename: string } {
  if (!existsSync(BRIDGE_PATH)) {
    console.error("[MemPalaceLearn.daemon] Bridge not found at:", BRIDGE_PATH);
    return { classifiedAs: null, filename: basename(filepath) };
  }
  try {
    const content = readFileSync(filepath, "utf-8").slice(0, 4000);
    const memoryType = classifyContent(content);
    const finalRoom = memoryType || room;

    bridgeFire("add_drawer", {
      wing,
      room: finalRoom,
      content,
      source_file: filepath,
      added_by: "dos-learn-hook",
    });

    if (memoryType) {
      console.error(`[MemPalaceLearn.daemon] Classified as "${memoryType}": ${basename(filepath)}`);
    }
    return { classifiedAs: memoryType, filename: basename(filepath) };
  } catch (err) {
    console.error(`[MemPalaceLearn.daemon] Failed to file ${basename(filepath)}:`, err);
    return { classifiedAs: null, filename: basename(filepath) };
  }
}

function updateSyncTime(): void {
  try {
    writeFileSync(
      STATE_FILE,
      JSON.stringify({ lastSync: new Date().toISOString() }),
      "utf-8",
    );
  } catch {
    // Non-critical
  }
}

async function main(): Promise<void> {
  const input = readDaemonInput();
  if (!input) {
    console.error("[MemPalaceLearn.daemon] No DOS_LEARN_INPUT_FILE — exiting");
    return;
  }

  const { sessionId, targetWing, learnings } = input;
  if (learnings.length === 0) return;

  console.error(`[MemPalaceLearn.daemon] Filing ${learnings.length} learning(s) for session ${sessionId.slice(0, 8)} (wing: ${targetWing})`);

  const fileResults: Array<{ classifiedAs: string | null; filename: string }> = [];
  for (const learning of learnings) {
    fileResults.push(fileToMemPalace(learning.path, targetWing, learning.category));
  }

  // Only update the watermark on success — preserves the wrapper's "find
  // since last sync" semantics. If the daemon dies before this line the
  // next wrapper run re-discovers the same files (idempotent re-file).
  updateSyncTime();
  console.error("[MemPalaceLearn.daemon] Done");

  const classified = fileResults.filter(r => r.classifiedAs);
  if (classified.length > 0) {
    if (classified.length === 1) {
      const r = classified[0]!;
      emitMemoryDigest(`learn classified "${r.classifiedAs}" → drawer in ${targetWing} wing`);
    } else {
      const types = [...new Set(classified.map(r => r.classifiedAs))].join(", ");
      emitMemoryDigest(`learn classified ${classified.length} files (${types}) → drawers in ${targetWing} wing`);
    }
  }
}

const _t = startTimer('MemPalaceLearn.daemon');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));

main()
  .catch((err) => { console.error("[MemPalaceLearn.daemon] Fatal:", err); })
  .finally(() => {
    const inputFile = process.env.DOS_LEARN_INPUT_FILE;
    if (inputFile) {
      try { unlinkSync(inputFile); } catch { /* best-effort */ }
    }
    process.exit(0);
  });
