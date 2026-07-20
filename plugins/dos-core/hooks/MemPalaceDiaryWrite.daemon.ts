#!/usr/bin/env bun
/**
 * MemPalaceDiaryWrite.daemon.ts — Detached transcript summarizer for the diary.
 *
 * PURPOSE:
 * Runs the heavy work OFF the SessionEnd critical path: reads the transcript
 * tail, summarizes it into a four-field RAW-VERBATIM session narrative via the
 * DOS Inference tool (fast/haiku), and writes THAT as the diary entry — closing
 * the recall-caveat #1 gap where buildEntry() (the 2026-05-12 MVP) wrote only
 * session metadata and never read transcript_path.
 *
 * Spawned detached + unref'd by MemPalaceDiaryWrite.hook.ts (which writes a
 * tmp-JSON payload and exits in <500ms), mirroring the proven
 * MemPalacePreCompact hook+daemon split. The pure summarization logic lives in
 * MemPalaceDiaryWrite.summary.ts (unit-testable, no lib imports); this file is
 * the I/O shell (transcript read, grounding fetch, inference, bridge write).
 *
 * GROUNDING (default ON; DOS_DIARY_GROUND_FROM_DIGEST=0 disables): when a
 * stop-saves / precompact-saves digest exists for the project wing, its PRD/git
 * facts are threaded into the prompt to anchor the DECISIONS section. The
 * transcript stays the source of truth for narrative; the digest is a hint.
 * Grounding READS the digest via list_drawers(sort=recent) — the only WRITE is
 * the new diary entry.
 *
 * NEVER-EMPTY FALLBACK LADDER (selectEntry in the summary module):
 *   1. transcript + inference OK            → four-field narrative
 *   2. inference fails BUT a digest exists  → digest body (digest-fallback)
 *   3. inference fails AND no digest        → truncated raw transcript tail
 *   4. transcript unreadable AND no digest  → the old MVP boilerplate
 * Every run appends one line to MEMORY/STATE/diary-saves.jsonl (idempotency +
 * audit); failures also route to MEMORY/STATE/mempalace-errors.jsonl — a
 * detached unref'd child propagates no exit code, so without its own log a
 * broken summarizer rots silently (exactly how the 2026-05-12 MVP rotted).
 *
 * INPUT:
 * - env DOS_DIARY_INPUT_FILE: tmp JSON written by the wrapper with
 *   { session_id, agent_name, wing, transcript_path, timestamp }
 *
 * OUTPUT:
 * - Side effect: bridge `diary` write (room=diary, wing_<agent>)
 * - Cleans up DOS_DIARY_INPUT_FILE on exit; exit(0) always.
 */

import { existsSync, readFileSync, mkdirSync, appendFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { dosPath } from "./lib/paths";
import { startTimer, stopTimer } from "./lib/hook-io";
import { bridgeSync } from "./lib/mempalace";
import { isPluginInstall, PLUGIN_CODE_PATHS } from "./lib/plugin-data-env";
import {
  type DaemonInput,
  SYSTEM_PROMPT,
  readTranscriptTail,
  ensureFourSections,
  buildUserPrompt,
  selectEntry,
  isDurableDiarySource,
  stampProvenance,
} from "./MemPalaceDiaryWrite.summary";

const MEMPALACE_DIR = process.env.MEMPALACE_DIR || join(homedir(), ".mempalace");
const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const INFERENCE_PATH = isPluginInstall()
  ? PLUGIN_CODE_PATHS.inferencePath
  : join(DOS_DIR, "DOS", "Tools", "Inference.ts");

// Grounding is ON by default (operator decision 2026-06-19); set to "0" to disable.
const GROUND_FROM_DIGEST = process.env.DOS_DIARY_GROUND_FROM_DIGEST !== "0";

function readDaemonInput(): DaemonInput | null {
  const inputFile = process.env.DOS_DIARY_INPUT_FILE;
  if (!inputFile || !existsSync(inputFile)) {
    console.error("[MemPalaceDiaryWrite.daemon] No DOS_DIARY_INPUT_FILE — exiting");
    return null;
  }
  try {
    return JSON.parse(readFileSync(inputFile, "utf-8")) as DaemonInput;
  } catch (err) {
    console.error(`[MemPalaceDiaryWrite.daemon] Failed to read input file: ${err}`);
    return null;
  }
}

function alreadySaved(sessionId: string): boolean {
  try {
    const auditPath = dosPath("MEMORY", "STATE", "diary-saves.jsonl");
    if (!existsSync(auditPath)) return false;
    const lines = readFileSync(auditPath, "utf-8").trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const e = JSON.parse(line) as { session_id?: string; saved?: boolean };
        if (e.session_id === sessionId && e.saved === true) return true;
      } catch { /* skip malformed */ }
    }
  } catch { /* unreadable — assume not saved */ }
  return false;
}

/** Fetch the most-recent stop/precompact digest body for the project wing (read-only). */
function fetchGroundingDigest(wing: string): string | null {
  if (!GROUND_FROM_DIGEST || !wing) return null;
  let best: { ts: string; content: string } | null = null;
  for (const room of ["stop-saves", "precompact-saves"]) {
    const r = bridgeSync(
      "list_drawers",
      { wing, room, sort: "recent", limit: 1, preview_chars: 0 },
      3000,
    );
    if (r.ok) {
      const d = (r.data as { drawers?: Array<{ content?: string; timestamp?: string }> })?.drawers?.[0];
      if (d?.content) {
        const ts = d.timestamp || "";
        if (!best || ts > best.ts) best = { ts, content: d.content };
      }
    }
  }
  return best?.content ?? null;
}

async function summarize(tail: string, grounding: string | null): Promise<string | null> {
  try {
    const mod = await import(INFERENCE_PATH);
    const result = await mod.inference({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(tail, grounding),
      level: "fast",
      // Generous headroom: the FIRST `claude` spawn in this fresh detached
      // process cold-starts (model load) and can exceed the 15s fast default,
      // which would drop us to the digest/raw-tail fallback unnecessarily. The
      // daemon is off the SessionEnd critical path, so a longer cap is free.
      timeout: 45_000,
    });
    if (result?.success && typeof result.output === "string" && result.output.trim()) {
      return ensureFourSections(result.output.trim());
    }
    return null;
  } catch {
    return null;
  }
}

function appendAudit(payload: Record<string, unknown>): void {
  try {
    const auditPath = dosPath("MEMORY", "STATE", "diary-saves.jsonl");
    mkdirSync(dirname(auditPath), { recursive: true });
    appendFileSync(auditPath, JSON.stringify({ ts: new Date().toISOString(), ...payload }) + "\n");
  } catch { /* audit is advisory — never block */ }
}

function logError(payload: Record<string, unknown>): void {
  try {
    const errPath = dosPath("MEMORY", "STATE", "mempalace-errors.jsonl");
    mkdirSync(dirname(errPath), { recursive: true });
    appendFileSync(errPath, JSON.stringify({ ts: new Date().toISOString(), where: "MemPalaceDiaryWrite.daemon", ...payload }) + "\n");
  } catch { /* best-effort */ }
}

async function main(): Promise<void> {
  const input = readDaemonInput();
  if (!input) return;

  if (!existsSync(join(MEMPALACE_DIR, "palace"))) {
    console.error("[MemPalaceDiaryWrite.daemon] No palace found — exiting");
    return;
  }
  if (alreadySaved(input.session_id)) {
    console.error(`[MemPalaceDiaryWrite.daemon] Already saved for session ${(input.session_id || "").slice(0, 8)} — skipping`);
    return;
  }

  const agent = (input.agent_name || "fox").toLowerCase();
  const tail = readTranscriptTail(input.transcript_path);
  const grounding = fetchGroundingDigest(input.wing);
  const summary = tail ? await summarize(tail, grounding) : null;

  const picked = selectEntry(summary, grounding, tail, input);

  // QUALITY GATE (2026-06 drawer-quality audit / RFC-0073 hygiene): NEVER file a
  // low-value diary drawer. Only a successful LLM digest of the transcript earns
  // a drawer; every fallback rung — "digest-fallback (inference unavailable)",
  // "raw-tail-fallback", and the content-less "boilerplate-fallback" SessionEnd
  // capture header (just session-id/timestamp/path/hook metadata) — is skipped
  // and logged instead of written. These stubs were ~77% of the wing_fox diary.
  if (!isDurableDiarySource(picked.source)) {
    appendAudit({
      session_id: input.session_id || "unknown",
      agent,
      source: picked.source,
      inference_ok: !!summary,
      grounded: !!grounding,
      saved: false,
      reason: "skipped-low-value-no-llm-digest",
    });
    console.error(
      `[MemPalaceDiaryWrite.daemon] Skipped low-value diary entry (${picked.source}) for ${agent}/session ${(input.session_id || "").slice(0, 8)} — no LLM digest`,
    );
    return;
  }

  const entry = stampProvenance(picked.entry, picked.source, input);

  const w = bridgeSync(
    "diary",
    { agent_name: agent, action: "write", entry, topic: "session-summary" },
    8000,
  );

  appendAudit({
    session_id: input.session_id || "unknown",
    agent,
    source: picked.source,
    inference_ok: !!summary,
    grounded: !!grounding,
    saved: w.ok,
    reason: w.ok ? "ok" : w.reason,
  });

  if (w.ok) {
    console.error(`[MemPalaceDiaryWrite.daemon] Wrote diary narrative (${picked.source}) for ${agent}/session ${(input.session_id || "").slice(0, 8)}`);
  } else {
    console.error(`[MemPalaceDiaryWrite.daemon] Diary write failed (${w.reason})`);
    logError({ phase: "diary-write", session_id: input.session_id || "unknown", reason: w.reason });
  }
}

// Guarded so the I/O shell does not execute on import.
if (import.meta.main) {
  const _t = startTimer("MemPalaceDiaryWrite.daemon");
  process.on("exit", () => stopTimer(_t, "SessionEnd.daemon"));
  main()
    .catch((err) => {
      console.error("[MemPalaceDiaryWrite.daemon] Fatal:", err);
      logError({ phase: "fatal", reason: String(err) });
    })
    .finally(() => {
      const inputFile = process.env.DOS_DIARY_INPUT_FILE;
      if (inputFile) {
        try { unlinkSync(inputFile); } catch { /* best-effort */ }
      }
      process.exit(0);
    });
}
