#!/usr/bin/env bun
/**
 * MemPalaceDiaryWrite.hook.ts — SessionEnd diary capture for MemPalace.
 *
 * PURPOSE:
 * Fires at SessionEnd. This is the <500ms WRAPPER: it writes a tmp-JSON payload
 * and spawns a detached, unref'd summarizer daemon (MemPalaceDiaryWrite.daemon.ts)
 * that reads the transcript tail, summarizes it (DOS Inference, fast/haiku), and
 * writes a four-field RAW-VERBATIM narrative as the diary entry. The wrapper then
 * exits immediately — the heavy work stays off the SessionEnd critical path.
 *
 * HISTORY:
 * - 2026-05-12 (commit 9b70e48): MVP — buildEntry() wrote only session metadata
 *   and never read transcript_path (its docstring deferred "ingest summary from
 *   transcript_path"). Result: 1,859 stub diary drawers with no recall value.
 * - 2026-06-19 (recall-caveat #1): the deferred step landed as a detached
 *   summarizer daemon, cloning the proven MemPalacePreCompact hook+daemon split.
 *
 * TRIGGER: SessionEnd
 *
 * INPUT:
 * - stdin: { session_id, transcript_path, hook_event_name }
 *
 * OUTPUT:
 * - stderr: status messages (always)
 * - exit(0): always — non-blocking, never fails the session
 *
 * PERFORMANCE:
 * - Foreground: <500ms (stdin read + wing resolve + tmp write + detached spawn).
 *   The 9105ms synchronous diary write that blew past Claude Code's SessionEnd
 *   reaper ("Hook cancelled", 2026-05-16) is gone — the bridge write now happens
 *   inside the detached daemon, never on the hook's critical path.
 *
 * FALLBACK:
 * - If the daemon script is missing or cannot be spawned, the wrapper logs and
 *   SKIPS (no diary entry) rather than writing a content-less "SessionEnd capture"
 *   stub. That stub carried zero semantic content, was rejected by the daemon's own
 *   isDurableDiarySource gate, and accreted 2,249 junk drawers in the largest room
 *   (2026-06 drawer-quality audit). A clean-empty diary beats a junk-filled one, and
 *   a non-spawning daemon is a deploy bug to surface, not to paper over.
 */

import { existsSync, writeFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { homedir, tmpdir } from "os";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { resolveProjectWingFromEnv } from "./lib/project-resolver";
import { startTimer, stopTimer } from "./lib/hook-io";

const MEMPALACE_DIR = process.env.MEMPALACE_DIR || join(homedir(), ".mempalace");
const DAEMON_SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "MemPalaceDiaryWrite.daemon.ts",
);

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name?: string;
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

/** Write the tmp-JSON payload and spawn the detached daemon. Returns false if it can't. */
function spawnDaemon(payload: {
  session_id: string;
  agent_name: string;
  wing: string;
  transcript_path: string;
  timestamp: string;
}): boolean {
  if (!existsSync(DAEMON_SCRIPT)) {
    console.error(`[MemPalaceDiaryWrite] Daemon missing at ${DAEMON_SCRIPT} — using inline fallback`);
    return false;
  }
  const inputPath = join(
    tmpdir(),
    `dos-diary-${(payload.session_id || "unknown").slice(0, 8)}-${Date.now()}.json`,
  );
  try {
    writeFileSync(inputPath, JSON.stringify(payload));
  } catch (err) {
    console.error(`[MemPalaceDiaryWrite] Failed to write daemon input: ${err}`);
    return false;
  }
  try {
    const child = spawn(process.execPath, [DAEMON_SCRIPT], {
      env: { ...process.env, DOS_DIARY_INPUT_FILE: inputPath },
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    console.error(`[MemPalaceDiaryWrite] Spawned summarizer daemon pid=${child.pid ?? -1} — summary running async`);
    return true;
  } catch (err) {
    console.error(`[MemPalaceDiaryWrite] Failed to spawn daemon: ${err}`);
    // The daemon never started, so it will never clean up its input file —
    // unlink it here to avoid orphaning tmp payloads on every spawn failure.
    try { unlinkSync(inputPath); } catch { /* best-effort */ }
    return false;
  }
}

async function main() {
  const input = await readStdin();
  if (!input) {
    console.error("[MemPalaceDiaryWrite] No stdin — skipping");
    process.exit(0);
  }

  // Guard: no palace → skip silently
  if (!existsSync(join(MEMPALACE_DIR, "palace"))) {
    console.error("[MemPalaceDiaryWrite] No palace found — skipping");
    process.exit(0);
  }

  const agentName = (process.env.DOS_AGENT_NAME ?? "fox").toLowerCase();

  // Test seam: skip the spawn entirely (pure never-blocks check, no side effects).
  if (process.env.DOS_DIARY_NO_SPAWN === "1") {
    console.error("[MemPalaceDiaryWrite] DOS_DIARY_NO_SPAWN=1 — skipping spawn");
    process.exit(0);
  }

  // Grounding lookup needs the PROJECT wing (where stop/precompact digests live);
  // "general" mirrors the Stop/PreCompact writers' fallback.
  const { wing: projectWing } = resolveProjectWingFromEnv();
  const wing = projectWing || "general";

  const spawned = spawnDaemon({
    session_id: input.session_id || "unknown",
    agent_name: agentName,
    wing,
    transcript_path: input.transcript_path || "",
    timestamp: new Date().toISOString(),
  });

  if (!spawned) {
    // Daemon unavailable (missing script or spawn failure). The pre-2026-06 behavior
    // wrote a metadata-only "SessionEnd capture" stub inline so the diary "never went
    // empty" — but that stub carries ZERO semantic content, is exactly the source class
    // the daemon path already rejects via isDurableDiarySource, and accreted 2,249 junk
    // drawers in the largest room (2026-06 drawer-quality audit). A clean empty diary
    // beats a junk-filled one, and a non-spawning daemon is a deploy bug to surface, not
    // to paper over — so skip the write and log loudly instead of stubbing.
    console.error(
      `[MemPalaceDiaryWrite] Daemon unavailable — skipping inline stub (zero semantic content) for session=${input.session_id || "unknown"}. Diary summary missing; check the daemon at ${DAEMON_SCRIPT}.`,
    );
  }

  // ALWAYS exit 0 — non-blocking capture
  process.exit(0);
}

const _t = startTimer("MemPalaceDiaryWrite");
process.on("exit", () => stopTimer(_t, "SessionEnd"));
main().catch((err) => {
  console.error("[MemPalaceDiaryWrite] Fatal:", err);
  process.exit(0);
});
