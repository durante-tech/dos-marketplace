#!/usr/bin/env bun
/**
 * SelectionCacheWarm.hook.ts — SessionStart cache pre-warmer.
 *
 * Calls loadSelectionCache(true) once at session start. The force-reload runs
 * the full skills-tree walk AND writes the persisted cache file under
 * MEMORY/STATE, so every later SkillRouteGuard process (its own `bun`, unable
 * to see this process's in-memory memo) hits the fast persisted+stat-sweep
 * path instead of re-walking the tree. No output, fail-open on errors.
 */

import { loadSelectionCache } from "./lib/selection-cache";
import { startTimer, stopTimer } from "./lib/hook-io";

const _t = startTimer("SelectionCacheWarm");
process.on("exit", () => stopTimer(_t, "SessionStart"));

try {
  loadSelectionCache(true);
} catch {
  // Fail-open — cache will rebuild on first SkillRouteGuard call.
}
process.exit(0);
