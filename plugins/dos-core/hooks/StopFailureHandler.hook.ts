#!/usr/bin/env bun
// conformance:R13-exempt — single localhost POST fire-and-forget — sub-50ms wall, no SessionEnd risk (operator-authorized R13 closure 2026-05-18; Engineer council triage)
/**
 * StopFailureHandler.hook.ts — StopFailure-event failure logger + voice notification
 *
 * Lifted from upstream PAI v5.0.0 hooks/StopFailureHandler.hook.ts (W-2.16
 * per RFC-0042 §Wave 2.5; closes RFC-0056 W-S4 FailureCapture-class slot 1
 * of 2). ACL-translated: paiPath → getMemorySubdir + dosPath, voice fetch
 * routed at the existing 31337 endpoint.
 *
 * TRIGGER: StopFailure (native platform event — fires only when a turn ends in
 * an API failure). The platform supports native error-type matchers on this
 * event (rate_limit, overloaded, billing_error, …); those matchers are declared
 * in settings.json by the orchestrator, so registration narrows WHICH failures
 * reach the hook. DUAL-SCHEMA SAFE: if fed a legacy Stop payload the hook still
 * works — it self-filters to real failures via `error` presence, so the
 * settings cutover from Stop → StopFailure is safe to flip on its own.
 *
 * NOTE: StopFailure output AND exit code are ignored by the platform (per the
 * hooks spec). This hook is pure side-effect (structured log + best-effort
 * voice) — it never attempts to gate.
 *
 * BEHAVIOR:
 *   1. Parse stdin JSON.
 *   2. Branch on hook_event_name: StopFailure is always a failure; legacy Stop
 *      self-filters on `error` presence.
 *   3. On a real failure, append a structured event line to
 *      MEMORY/SECURITY/{year}/{month}/stop-failures-{date}.jsonl and fire a
 *      best-effort voice notification. Non-failure legacy Stop events are a
 *      no-op (no "(none)" noise — refinement over the pre-migration hook, which
 *      logged every turn end).
 *
 * SAFETY:
 *   - Never blocks: silent on parse error, file-system error, voice-server down.
 *   - Project-level resolution: SECURITY is project-eligible per CLAUDE.md.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { getMemorySubdir } from "./lib/paths";
import { getISOTimestamp, getPSTDate, getYearMonth } from "./lib/time";
import { getVoiceId } from "./lib/identity";

interface StopFailureInput {
  session_id?: string;
  hook_event_name?: string;
  // Some platform versions surface the matched error type at the top level.
  error_type?: string;
  type?: string;
  // Claude Code may send either a string error message or a structured
  // { code, message, type } object depending on the failure path. Accept both
  // and normalize at use-site (see normalizeError / extractErrorType below).
  error?: string | { code?: string; message?: string; type?: string } | null;
}

/**
 * Normalize error field to a string for logging + voice-trigger check.
 * Returns '' (empty) when there is no real error so the voice gate stays
 * silent on Stop events that fire with no failure context.
 */
export function normalizeError(err: StopFailureInput["error"]): string {
  if (!err) return "";
  if (typeof err === "string") return err.trim();
  // Object form — prefer message, fall back to code, fall back to JSON
  const parts: string[] = [];
  if (typeof err.message === "string") parts.push(err.message);
  if (typeof err.code === "string") parts.push(`[${err.code}]`);
  if (parts.length === 0) {
    try {
      return JSON.stringify(err);
    } catch {
      return "";
    }
  }
  return parts.join(" ").trim();
}

/**
 * Extract the matched error type (rate_limit / overloaded / billing_error / …)
 * from whichever field the platform used. Empty string when unknown. This is
 * the same taxonomy the native StopFailure matchers key on, captured here for
 * telemetry parity with the matcher registration.
 */
export function extractErrorType(input: StopFailureInput): string {
  if (typeof input.error_type === "string" && input.error_type.trim()) return input.error_type.trim();
  if (typeof input.type === "string" && input.type.trim()) return input.type.trim();
  const e = input.error;
  if (e && typeof e === "object") {
    if (typeof e.type === "string" && e.type.trim()) return e.type.trim();
    if (typeof e.code === "string" && e.code.trim()) return e.code.trim();
  }
  return "";
}

async function main(): Promise<void> {
  let input: StopFailureInput;
  try {
    input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
  } catch {
    process.exit(0);
  }

  const eventName = input.hook_event_name || "Stop";
  const isFailureEvent = eventName === "StopFailure";
  const errorString = normalizeError(input.error);
  const errorType = extractErrorType(input);

  // StopFailure is intrinsically a failure; legacy Stop must carry a real error.
  const isFailure = isFailureEvent || errorString.length > 0;
  if (!isFailure) {
    process.exit(0);
  }

  const timestamp = getISOTimestamp();
  const [year, month] = getYearMonth().split("-");
  const securityDir = getMemorySubdir("SECURITY");
  const logDir = `${securityDir}/${year}/${month}`;

  try {
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    appendFileSync(
      `${logDir}/stop-failures-${getPSTDate()}.jsonl`,
      JSON.stringify({
        timestamp,
        session_id: input.session_id || "unknown",
        event_type: "stop_failure",
        hook_event: eventName,
        error_details: errorString || "(none)",
        error_type: errorType || null,
      }) + "\n",
    );
  } catch {
    // silent — never block on logging failure
  }

  // Best-effort voice on the failure. Enrich the spoken line with the matched
  // error type when the platform provided one.
  try {
    const spokenType = errorType ? errorType.replace(/_/g, " ") : "";
    const message = spokenType
      ? `Turn ended on a ${spokenType} error. Check the session.`
      : "API error ended the turn. Check the session.";
    await fetch("http://localhost:31337/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        voice_id: getVoiceId(),
        voice_enabled: true,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // silent — voice server may be down
  }

  process.exit(0);
}

if (import.meta.main) {
  main();
}
