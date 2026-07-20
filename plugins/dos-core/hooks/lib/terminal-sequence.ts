/**
 * terminal-sequence.ts — emit Claude Code v2.1.141 `terminalSequence` hook output.
 *
 * Trigger surface: any hook that wants to ping the operator's desktop, set
 * a terminal window title, or ring the bell — without a TTY. The v2.1.141
 * release added the `terminalSequence` field to hook JSON output so hooks
 * running as detached subprocesses can emit OSC sequences the harness then
 * forwards to the operator's terminal.
 *
 * Replaces voice.sh shell-out from MemoryHarvest.daemon / DrainPending /
 * Stop hooks that currently fire-and-forget against the bridge — those run
 * detached and lose the operator-visible signal when the bridge is offline.
 * `terminalSequence` is the native channel.
 *
 * Spec lineage: introduced 2026-05-15 by the 28D delivery sprint (D5).
 */

import { writeFileSync } from "node:fs";

/** Escape codes for the three supported sequences. */
const OSC_DESKTOP_NOTIFY = "\x1b]9;"; // body, terminated by BEL
const OSC_WINDOW_TITLE = "\x1b]0;"; // body, terminated by BEL
const BEL = "\x07";

/**
 * Build a desktop-notification escape sequence. The OS terminal (Kitty,
 * iTerm2, etc.) picks this up and pops a system notification.
 *
 * Maximum body length is operator-terminal-dependent — Kitty caps around
 * 256 bytes; longer strings are truncated by the terminal silently.
 */
export function desktopNotify(message: string): string {
  return `${OSC_DESKTOP_NOTIFY}${message}${BEL}`;
}

/**
 * Build a window-title escape sequence. Sets the terminal's window title.
 * Useful for surfacing in-flight context ("Fox: harvesting memory…") that
 * the operator sees in their tab list.
 */
export function windowTitle(title: string): string {
  return `${OSC_WINDOW_TITLE}${title}${BEL}`;
}

/**
 * Build a bell-only sequence. Audible ping; no visible message. Use only
 * for explicit operator-attention events (gate failures, errors).
 */
export function bell(): string {
  return BEL;
}

/**
 * Compose a Claude Code hook JSON output payload that includes a
 * terminalSequence field. The harness consumes the JSON and forwards the
 * sequence to the operator's terminal.
 *
 * @param sequence the escape-sequence string (from desktopNotify / windowTitle / bell)
 * @param extras any additional hook-output fields (continue, decision, additionalContext, etc.)
 */
export function hookOutputWithTerminalSequence(
  sequence: string,
  extras: Record<string, unknown> = {},
): string {
  return JSON.stringify({ ...extras, terminalSequence: sequence });
}

/**
 * Write the JSON payload to stdout (the Claude Code hook contract — hooks
 * emit JSON on stdout and the harness consumes it). Pass the result of
 * hookOutputWithTerminalSequence (or a manually-composed object) here.
 *
 * `writeFileSync('/dev/stdout', ...)` is the deterministic stdout-write
 * pattern that survives stdio:'ignore' detachment used by daemon hooks.
 */
export function writeHookStdout(payload: string): void {
  try {
    writeFileSync("/dev/stdout", payload + "\n");
  } catch {
    // Detached hooks (stdio:'ignore') will throw here; that's expected
    // for fire-and-forget daemons. Swallow silently — the terminal
    // sequence still rides on stdout if the harness is consuming it.
  }
}
