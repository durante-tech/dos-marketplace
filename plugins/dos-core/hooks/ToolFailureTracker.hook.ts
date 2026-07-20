#!/usr/bin/env bun
/**
 * ToolFailureTracker.hook.ts — tool-failure event logger
 *
 * Lifted from upstream PAI v5.0.0 hooks/ToolFailureTracker.hook.ts
 * (W-2.22 per RFC-0042 §Wave 2.5; closes RFC-0056 W-S4 FailureCapture-class
 * slot 2 of 2). ACL-translated: paiPath → dosPath; OBSERVABILITY is a
 * global subdir (not in the project-eligible list), so we use dosPath('MEMORY',
 * 'OBSERVABILITY') for predictable cross-session aggregation.
 *
 * TRIGGER: PostToolUseFailure (native platform failure event — fires only when
 * a tool call fails). DUAL-SCHEMA SAFE: if fed a legacy PostToolUse catch-all
 * payload it still works — it self-filters to real failures via `error`
 * presence, exactly as before. This lets the settings cutover from
 * PostToolUse → PostToolUseFailure be flipped without a flag day.
 *
 * OUTPUT:
 *   - ${DOS_DIR}/MEMORY/OBSERVABILITY/tool-failures.jsonl (append-only event log)
 *   The ledger line format is byte-compatible with the pre-migration hook:
 *   { timestamp, event:"tool_failure", session_id, tool_name, error, tool_input_preview }.
 *
 * PERFORMANCE: <20ms (file append only, no inference, no network).
 *
 * NEVER BLOCKS: errors are caught and logged to stderr, exit 0 always.
 * (PostToolUseFailure is non-blockable anyway — the tool already ran.)
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { dosPath } from "./lib/paths";
import { getISOTimestamp } from "./lib/time";

/**
 * Failure detail arrives in different shapes depending on the event and the
 * Claude Code version. We accept the whole surface and normalize at use-site:
 *   - PostToolUseFailure may carry `error` (string) or `error`/`tool_error`
 *     as { code, message }, or nest the failure inside `tool_response` /
 *     `tool_output`.
 *   - Legacy PostToolUse carried a top-level string `error` (DOS convention).
 */
interface ToolFailureInput {
  session_id?: string;
  transcript_path?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  error?: string | { code?: string; message?: string } | null;
  tool_error?: string | { code?: string; message?: string } | null;
  tool_response?: unknown;
  tool_output?: unknown;
}

interface ToolFailureEvent {
  timestamp: string;
  event: "tool_failure";
  session_id: string;
  tool_name: string;
  error: string;
  tool_input_preview: string;
}

const OBS_DIR = dosPath("MEMORY", "OBSERVABILITY");
const FAILURES_FILE = join(OBS_DIR, "tool-failures.jsonl");

/**
 * Coerce a value that may be a string, an { code, message } object, or null
 * into a readable error string. Strings are returned verbatim (NO trim) so the
 * legacy PostToolUse ledger bytes are preserved exactly.
 */
export function coerceErrorText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as { code?: unknown; message?: unknown };
    const parts: string[] = [];
    if (typeof o.message === "string") parts.push(o.message);
    if (typeof o.code === "string") parts.push(`[${o.code}]`);
    if (parts.length) return parts.join(" ");
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return String(v);
}

/**
 * Extract the best available error string from a dual-schema payload.
 * Priority: top-level `error` → `tool_error` → nested error/message inside
 * `tool_response` / `tool_output`. Empty string when no failure detail exists.
 */
export function extractError(data: ToolFailureInput): string {
  const direct = coerceErrorText(data.error);
  if (direct.trim()) return direct;
  const te = coerceErrorText(data.tool_error);
  if (te.trim()) return te;
  for (const container of [data.tool_response, data.tool_output]) {
    if (container && typeof container === "object") {
      const c = container as Record<string, unknown>;
      const nested = coerceErrorText(c.error) || coerceErrorText(c.message);
      if (nested.trim()) return nested;
    }
  }
  return "";
}

/**
 * Build the ledger event, or null when there is nothing to record.
 *
 * - PostToolUseFailure fires only on failure → always record (placeholder
 *   error when the payload carried no detail).
 * - Legacy PostToolUse fires on every call → self-filter to real failures via
 *   `error` presence, exactly as the pre-migration hook did.
 */
export function buildFailureEvent(data: ToolFailureInput): ToolFailureEvent | null {
  const isFailureEvent = (data.hook_event_name || "") === "PostToolUseFailure";
  const errorText = extractError(data);

  if (!errorText && !isFailureEvent) return null;

  const finalError = errorText || "(tool failure — no error detail provided)";
  const toolName = data.tool_name || "unknown";

  let inputPreview = "";
  if (data.tool_input) {
    const rawInput = JSON.stringify(data.tool_input);
    inputPreview = rawInput.length > 500 ? rawInput.slice(0, 500) + "..." : rawInput;
  }

  return {
    timestamp: getISOTimestamp(),
    event: "tool_failure",
    session_id: data.session_id || "unknown",
    tool_name: toolName,
    error: finalError.slice(0, 1000),
    tool_input_preview: inputPreview,
  };
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    const timer = setTimeout(() => resolve(data), 2000);
    process.stdin.on("data", (chunk) => {
      data += chunk.toString();
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    if (!raw.trim()) {
      process.exit(0);
    }

    const data: ToolFailureInput = JSON.parse(raw);
    const event = buildFailureEvent(data);
    if (!event) {
      process.exit(0);
    }

    if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });
    appendFileSync(FAILURES_FILE, JSON.stringify(event) + "\n", "utf-8");
    console.error(
      `[ToolFailureTracker] Logged failure: ${event.tool_name} — ${event.error.slice(0, 80)}`,
    );
  } catch (err) {
    console.error(`[ToolFailureTracker] Error: ${err}`);
  }
  process.exit(0);
}

if (import.meta.main) {
  main();
}
