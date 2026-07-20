#!/usr/bin/env bun
/**
 * MemPalacePreCompact.hook.ts — Auto-Save Before Context Compaction (PreCompact)
 *
 * PURPOSE:
 * Fires right before Claude Code compresses the context window. Spawns a
 * detached daemon (MemPalacePreCompact.daemon.ts) to do the heavy
 * add_drawer + add_kg_fact + audit log work off the critical path, then
 * exits with {continue: true} in <500ms.
 *
 * HISTORY:
 * - Original: hard-blocked compaction and demanded AI manual save (broke flow)
 * - Rewrite 2026-05-04 (commit 9f4d609): synchronous add_drawer in foreground,
 *   ~15s worst-case but allowed compaction to proceed
 * - Daemon split 2026-05-04 (M2, mempalace-intel-enhancement DAG): foreground
 *   exits in <500ms; daemon handles the bridge calls asynchronously
 *
 * TRIGGER: PreCompact
 *
 * INPUT:
 * - stdin: { session_id, transcript_path, hook_event_name }
 *
 * OUTPUT:
 * - stdout: {"continue": true}     — always allow compaction
 * - exit(0): always
 *
 * SIDE EFFECTS (via daemon):
 * - Writes a "precompact digest" drawer to wing=<project|"general">, room=precompact-saves
 * - Writes a KG fact: session-{id} compacted_with_digest <drawer-id>
 * - Appends one JSONL line to MEMORY/STATE/precompact-saves.jsonl for audit
 *
 * BUDGET:
 * - Foreground: <500ms (stdin read + wing resolve + tmp write + spawn)
 * - Daemon: 10-15s async, does not block compaction
 */

import { existsSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { homedir, tmpdir } from "os";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { resolveProjectWingFromEnv } from "./lib/project-resolver";
import { startTimer, stopTimer } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';

loadProjectEnv();

const MEMPALACE_DIR = process.env.MEMPALACE_DIR || join(homedir(), ".mempalace");
const DAEMON_SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "MemPalacePreCompact.daemon.ts",
);

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

async function readStdin(): Promise<HookInput | null> {
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

function spawnDaemon(payload: { session_id: string; wing: string; transcript_path: string; timestamp: string }): void {
  if (!existsSync(DAEMON_SCRIPT)) {
    console.error(`[MemPalacePreCompact] Daemon missing at ${DAEMON_SCRIPT} — skipping async save`);
    return;
  }

  const inputPath = join(
    tmpdir(),
    `dos-precompact-${payload.session_id.slice(0, 8)}-${Date.now()}.json`,
  );

  try {
    writeFileSync(inputPath, JSON.stringify(payload));
  } catch (err) {
    console.error(`[MemPalacePreCompact] Failed to write daemon input: ${err}`);
    return;
  }

  try {
    const child = spawn(process.execPath, [DAEMON_SCRIPT], {
      env: {
        ...process.env,
        DOS_PRECOMPACT_INPUT_FILE: inputPath,
      },
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    console.error(`[MemPalacePreCompact] Spawned daemon pid=${child.pid ?? -1} — save running async`);
  } catch (err) {
    console.error(`[MemPalacePreCompact] Failed to spawn daemon: ${err}`);
  }
}

async function main() {
  const input = await readStdin();
  if (!input) {
    // Allow compaction silently when stdin is unparseable
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  // No palace → can't save, but still allow compaction
  if (!existsSync(join(MEMPALACE_DIR, "palace"))) {
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  const { wing: projectWing } = resolveProjectWingFromEnv();
  const wing = projectWing || "general";

  // Spawn daemon with minimal payload — daemon does all the heavy lifting
  spawnDaemon({
    session_id: input.session_id || "unknown",
    wing,
    transcript_path: input.transcript_path || "",
    timestamp: new Date().toISOString(),
  });

  // ALWAYS allow compaction immediately
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const _t = startTimer('MemPalacePreCompact');
process.on('exit', () => stopTimer(_t, 'PreCompact'));
main().catch((err) => {
  console.error("[MemPalacePreCompact] Fatal:", err);
  // Never block compaction even on hook crash
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
});
