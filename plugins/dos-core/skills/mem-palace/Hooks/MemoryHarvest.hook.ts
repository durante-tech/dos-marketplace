#!/usr/bin/env bun
/**
 * MemoryHarvest.hook.ts — Fast-path SessionEnd wrapper.
 *
 * PURPOSE:
 * Validates the session is worth harvesting (bridge present, transcript
 * readable, message count above threshold), then spawns the detached
 * `MemoryHarvest.daemon.ts` to run the slow Haiku-inference + extraction
 * filing OFF the SessionEnd critical path. Exits in <500ms.
 *
 * WHY THIS SPLIT (RFC-0037 follow-up, 2026-05-03):
 * The unified MemoryHarvest hook was being SIGKILL'd by Claude Code's
 * SessionEnd reaper because Haiku inference takes 20-60s and the harness
 * caps hook duration ~5s. SIGKILL doesn't fire `process.on('exit')`, so
 * timing/error telemetry never landed and the harvest tracker was stuck
 * on a synthetic test-harness run from 2026-04-27. Mirrors the
 * SessionContextSnapshot → SessionContextEnrich.daemon split (RFC-0027).
 *
 * TRIGGER: SessionEnd
 *
 * INPUT:
 * - stdin: { session_id, transcript_path, hook_event_name }
 * - Files: transcript JSONL, MEMORY/STATE/correction-queue-{sessionId}.json
 *
 * OUTPUT:
 * - stderr: status messages
 * - Spawns: MemoryHarvest.daemon.ts (does the inference + filing)
 * - exit(0): always (non-blocking)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - RUNS AFTER: WorkCompletionLearning, MemPalaceLearn (per settings.json order)
 * - READS: CorrectionDetector queue from STATE/
 * - SPAWNS: MemoryHarvest.daemon.ts (detached, ignores stdio)
 *
 * PERFORMANCE:
 * - <500ms typical (transcript read + 300ms flush wait + spawn)
 * - Daemon: 20-60s in background, does not block parent
 */

import { spawn } from "child_process";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { homedir, tmpdir } from "os";
import { fileURLToPath } from "url";
import { resolveProjectWingFromEnv } from "./lib/project-resolver";
import { BRIDGE_PATH } from "./lib/mempalace";
import { startTimer, stopTimer } from './lib/hook-io';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const STATE_DIR = join(DOS_DIR, "MEMORY", "STATE");
// Production follows the wrapper module so plugin data overrides cannot turn
// persistent state into a code root. The narrow override keeps missing-daemon
// tests hermetic without executing an operator's live ~/.claude hook.
const DAEMON_SCRIPT = process.env.DOS_MEMORY_HARVEST_DAEMON_PATH ||
  join(dirname(fileURLToPath(import.meta.url)), "MemoryHarvest.daemon.ts");

const MIN_MESSAGES = 4;
const MAX_TRANSCRIPT_CHARS = 8000;

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name?: string;
}

async function readHookInput(): Promise<HookInput | null> {
  try {
    const decoder = new TextDecoder();
    const reader = (process.stdin as any).getReader?.()
      ?? (Bun?.stdin?.stream?.().getReader?.() ?? null);
    let input = "";
    if (reader) {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("stdin timeout")), 1000)
      );
      const read = (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          input += decoder.decode(value, { stream: true });
        }
      })();
      await Promise.race([read, timeout]);
    } else {
      input = await Bun.stdin.text();
    }
    return input.trim() ? (JSON.parse(input) as HookInput) : null;
  } catch {
    return null;
  }
}

/**
 * Extract last N human+assistant messages from transcript JSONL.
 * Same shape as the previous unified hook — the daemon needs the
 * conversation text and message count, the wrapper does the gate.
 */
function extractRecentMessages(
  transcriptPath: string,
  maxMessages: number = 30
): { text: string; messageCount: number; cwd: string } {
  if (!existsSync(transcriptPath)) {
    return { text: "", messageCount: 0, cwd: "" };
  }
  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const messages: string[] = [];
    let cwd = "";
    let totalHumanMessages = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.cwd && !cwd) cwd = entry.cwd;
        if (entry.type === "user" && entry.message?.content) {
          const text = typeof entry.message.content === "string"
            ? entry.message.content
            : Array.isArray(entry.message.content)
              ? entry.message.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
              : "";
          if (text.includes("<command-message>") || text.includes("<command-name>") || text.includes("<system-reminder>")) continue;
          if (text.trim()) {
            messages.push(`USER: ${text.trim()}`);
            totalHumanMessages++;
          }
        }
        if (entry.type === "assistant" && entry.message?.content) {
          const blocks = Array.isArray(entry.message.content) ? entry.message.content : [{ type: "text", text: entry.message.content }];
          const textParts = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text?.trim()).filter(Boolean);
          if (textParts.length > 0) {
            const combined = textParts.join("\n");
            messages.push(`ASSISTANT: ${combined.length > 500 ? combined.slice(0, 500) + "... [truncated]" : combined}`);
          }
        }
      } catch { /* skip malformed lines */ }
    }
    const recent = messages.slice(-maxMessages);
    return { text: recent.join("\n\n"), messageCount: totalHumanMessages, cwd };
  } catch {
    return { text: "", messageCount: 0, cwd: "" };
  }
}

function readCorrectionQueue(sessionId: string): string[] {
  const queueFile = join(STATE_DIR, `correction-queue-${sessionId}.json`);
  if (!existsSync(queueFile)) return [];
  try {
    const data = JSON.parse(readFileSync(queueFile, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function spawnHarvestDaemon(payload: Record<string, unknown>): void {
  if (!existsSync(DAEMON_SCRIPT)) {
    console.error(`[MemoryHarvest] Daemon missing at ${DAEMON_SCRIPT} — skipping`);
    return;
  }
  const inputPath = join(tmpdir(), `dos-harvest-${process.pid}-${Date.now()}.json`);
  try {
    writeFileSync(inputPath, JSON.stringify(payload));
  } catch (err) {
    console.error(`[MemoryHarvest] Failed to write daemon input: ${err}`);
    return;
  }
  try {
    const child = spawn(process.execPath, [DAEMON_SCRIPT], {
      env: {
        ...process.env,
        DOS_HARVEST_INPUT_FILE: inputPath,
      },
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    console.error(`[MemoryHarvest] Spawned daemon pid=${child.pid ?? -1} input=${inputPath}`);
  } catch (err) {
    console.error(`[MemoryHarvest] Failed to spawn daemon: ${err}`);
  }
}

async function main(): Promise<void> {
  const input = await readHookInput();
  if (!input) {
    process.exit(0);
  }

  if (!existsSync(BRIDGE_PATH)) {
    console.error("[MemoryHarvest] Bridge not installed, skipping");
    process.exit(0);
  }

  // Small delay to let transcript flush
  await new Promise((resolve) => setTimeout(resolve, 300));

  const { text: conversationText, messageCount } = extractRecentMessages(input.transcript_path, 30);
  if (messageCount < MIN_MESSAGES) {
    console.error(`[MemoryHarvest] Session too short (${messageCount} messages), skipping`);
    process.exit(0);
  }

  const { wing: projectWing } = resolveProjectWingFromEnv();
  const targetWing = projectWing || "general";

  const correctionQueue = readCorrectionQueue(input.session_id);
  const correctionContext = correctionQueue.length > 0
    ? `\n\nDETECTED CORRECTIONS (from real-time detection):\n${correctionQueue.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
    : "";

  const truncatedConversation = conversationText.length > MAX_TRANSCRIPT_CHARS
    ? conversationText.slice(-MAX_TRANSCRIPT_CHARS)
    : conversationText;

  spawnHarvestDaemon({
    sessionId: input.session_id,
    targetWing,
    conversationText: truncatedConversation,
    messageCount,
    correctionQueue,
    correctionContext,
  });

  process.exit(0);
}

const _t = startTimer('MemoryHarvest');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));
main().catch((err) => {
  console.error("[MemoryHarvest] Fatal:", err);
  process.exit(0);
});
