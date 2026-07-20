#!/usr/bin/env bun
/**
 * ModeHeaderGuard.hook.ts — Mode Header Conformance Logger (Stop)
 *
 * CLAUDE.md declares "first output MUST be the mode header" but prose rules
 * have no compiler. Non-blocking log pattern mirrors SubagentReturn.hook.ts
 * (C1 conformance) — writes to MEMORY/LEARNING/REFLECTIONS/...jsonl for
 * later analysis. Blocking the Stop to force regeneration risks infinite
 * loops; proactive nudge lives in IntentRetrieval's UserPromptSubmit hook.
 */

import { appendFileSync, mkdirSync, existsSync, openSync, readSync, closeSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { readHookInput, startTimer, stopTimer } from "./lib/hook-io";
import { isMachineGeneratedPrompt } from "./lib/machine-text";
import { buildStopJoinRow } from "./lib/router-trace";

const HOME = homedir();
const DOS_DIR = process.env.DOS_DIR || join(HOME, ".claude");
const REFLECTIONS_DIR = join(DOS_DIR, "MEMORY", "LEARNING", "REFLECTIONS");
const LOG_PATH = join(REFLECTIONS_DIR, "mode-header-conformance.jsonl");

const TRANSCRIPT_FULL_READ_MAX = 1 * 1024 * 1024;
// Read a tail as large as the full-read threshold. The old 256KB tail was a 4x drop
// from the 1MB full-read cap, so a transcript just over 1MB lost 75% of its content —
// and when the just-completed turn's own leading tool_result pushed its operator-prompt
// boundary outside the 256KB window, the grader silently graded an arbitrary stale
// message from a much earlier turn (Forge H-122; 457 of 32,505 local transcripts exceed
// 1MB). A 1MB tail captures the boundary for all but pathologically large single turns,
// and the truncation-aware guard below skips (never mis-grades) that residual.
const TRANSCRIPT_TAIL_BYTES = TRANSCRIPT_FULL_READ_MAX;

// B.3 / RFC-0074:111 — first-LINE-anchored mode regexes. The mode header is
// the operator's mandated FIRST output: it must open the message, not appear
// anywhere in the body. Anchoring on the first non-empty line kills the
// false-positive where a banner quoted deep in prose (e.g. a teaching example
// or a pasted prior turn) reads as conformant. classifyMode scans only the
// first non-empty line of the graded message.
const MODE_PATTERNS = {
  MINIMAL: /═══\s*DOS\s*═/,
  NATIVE: /════\s*DOS\s*\|\s*NATIVE\s*MODE/,
  ALGORITHM: /(♻︎\s*Entering\s*the\s*DOS\s*ALGORITHM|━━━\s*(?:👁️|🔎|🧠|📋|🔨|🛠️|⚡|🚀|✅|📚)\s*(?:OBSERVE|THINK|PLAN|BUILD|EXECUTE|VERIFY|LEARN))/i,
};

interface TranscriptEntry {
  type?: string;
  role?: string;
  // B.3 / ArtifactAutoLogger.hook.ts:176 — structural sidechain flag set by the
  // harness on subagent (Task-spawned) transcript entries. Replaces the brittle
  // SUBAGENT_MARKERS content-regex skip: the regex skipped any message that
  // merely CONTAINED the subagent return labels (🔎 FILES TO READ / 🧠 MEMORY
  // TO RECALL / 🏹 CAPABILITIES), biasing the denominator against primary turns
  // that legitimately quote those labels. isSidechain is set by the transcript
  // writer, never by message content, so the skip is unbiased.
  isSidechain?: boolean;
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string }> | string;
  };
}

// B.3 / RFC-0074:111 — grade the FIRST non-empty line only. The first-output
// mandate is positional; a banner buried in the body is not a conformant
// header. Returns NONE when the leading line carries no mode banner even if
// one appears later in the text.
function firstNonEmptyLine(text: string): string {
  for (const line of text.split("\n")) {
    if (line.trim()) return line;
  }
  return "";
}

function classifyMode(text: string): "MINIMAL" | "NATIVE" | "ALGORITHM" | "NONE" {
  const head = firstNonEmptyLine(text);
  if (MODE_PATTERNS.ALGORITHM.test(head)) return "ALGORITHM";
  if (MODE_PATTERNS.NATIVE.test(head)) return "NATIVE";
  if (MODE_PATTERNS.MINIMAL.test(head)) return "MINIMAL";
  return "NONE";
}

// Read the transcript once (bounded tail for large files) and hand the raw
// string to both pure extractors below — avoids a second file read.
function readTranscriptRaw(transcriptPath: string): { raw: string; truncated: boolean } {
  try {
    const stat = statSync(transcriptPath);
    if (stat.size > TRANSCRIPT_FULL_READ_MAX) {
      const buf = Buffer.alloc(TRANSCRIPT_TAIL_BYTES);
      const fd = openSync(transcriptPath, "r");
      readSync(fd, buf, 0, buf.length, stat.size - buf.length);
      closeSync(fd);
      return { raw: buf.toString("utf-8"), truncated: true };
    }
    return { raw: readFileSync(transcriptPath, "utf-8"), truncated: false };
  } catch {
    return { raw: "", truncated: false };
  }
}

// Concatenate the text blocks of a single transcript entry's message content.
// Empty when the entry has no text (e.g. tool_use-only assistant turn).
function entryText(entry: TranscriptEntry): string {
  const content = entry.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b?.type === "text" || typeof b?.text === "string")
      .map((b) => b.text ?? "")
      .join("\n");
  }
  return "";
}

// True when this entry is a tool_result-bearing user message — a harness
// turn, not operator text. Mirrors extractLastUserFromRaw's tool_result skip.
function isToolResultUser(entry: TranscriptEntry): boolean {
  const content = entry.message?.content;
  return Array.isArray(content) && content.some((b) => (b as { type?: string })?.type === "tool_result");
}

// B.3 / RT-A12 + RT-A17 / F12 + F17 — grade the FIRST assistant message of the
// current turn, not the last. The first-output mode-header mandate is satisfied
// (or violated) by the FIRST thing the assistant emits after the operator's
// prompt; the last assistant message in a multi-message turn is frequently a
// tool-call follow-up or a closing summary that never carries the entry banner.
// Grading the last message systematically under-counts conformance (the
// wrong-message tripwire artifact F12 names).
//
// Turn boundary: walk back from the end to the most recent real operator
// (non-tool_result, non-sidechain) user entry, then walk FORWARD to the first
// assistant (non-sidechain) entry after it. Returns "" when no such pair exists
// (older transcript shapes / sidechain-only tails) → caller falls through to
// the never-blocks exit, never grading a phantom.
function extractFirstAssistantOfTurnFromRaw(raw: string, truncated: boolean): string {
  const lines = raw.split("\n");
  const entries: TranscriptEntry[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as TranscriptEntry);
    } catch {
      // Skip malformed line
    }
  }

  // Find the most recent real operator user entry (the turn's opening prompt).
  let lastUserIdx = -1;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.isSidechain === true) continue;
    const role = entry.role ?? entry.message?.role;
    if (role !== "user") continue;
    if (isToolResultUser(entry)) continue;
    lastUserIdx = i;
    break;
  }

  // No operator prompt found. Two very different reasons:
  //   - truncated read (large transcript): the prompt EXISTS but is outside the tail
  //     window. Grading the oldest surviving entry would grade an arbitrary stale
  //     message from a much earlier turn and corrupt the conformance metric — return
  //     "" so the caller skips this turn (honoring the contract stated above). (H-122)
  //   - full read, genuinely no user entry (degraded/legacy transcript shape): keep the
  //     best-effort of grading the oldest assistant entry, as before.
  if (lastUserIdx === -1 && truncated) return "";

  // Walk forward from just after the operator prompt to the FIRST assistant text entry
  // of the turn. For lastUserIdx === -1 on a full read, start at 0 (legacy best-effort).
  for (let i = lastUserIdx + 1; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.isSidechain === true) continue;
    const role = entry.role ?? entry.message?.role;
    if (role !== "assistant") continue;
    const text = entryText(entry);
    if (text) return text;
  }
  return "";
}

// Extracts the most recent real operator user entry's text. Tool results land
// as user-role transcript entries, so skip any entry whose content array
// carries a tool_result block — those are not operator text. Sidechain
// (subagent) user entries are skipped structurally. This is the text S5's
// Stop-row join hashes (router-trace promptSha256) to bind the turn.
function extractLastUserFromRaw(raw: string): string {
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as TranscriptEntry;
      if (entry.isSidechain === true) continue;
      const role = entry.role ?? entry.message?.role;
      if (role !== "user") continue;
      if (isToolResultUser(entry)) continue;
      const content = entry.message?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return entryText(entry);
      }
    } catch {
      // Skip malformed line
    }
  }
  return "";
}

interface StopHookInput {
  session_id?: string;
  transcript_path?: string;
  stop_hook_active?: boolean;
}

async function main(): Promise<void> {
  try {
    const input = (await readHookInput()) as unknown as StopHookInput | null;
    if (!input) process.exit(0);
    if (input.stop_hook_active) process.exit(0);

    const transcriptPath = input.transcript_path ?? "";
    if (!transcriptPath) process.exit(0);

    const { raw, truncated } = readTranscriptRaw(transcriptPath);
    // B.3 / RT-A12 + RT-A17 / F12 + F17 — grade the FIRST assistant message of
    // the turn, not the last. extractFirstAssistantOfTurnFromRaw also applies
    // the structural isSidechain skip per entry (replacing the SUBAGENT_MARKERS
    // content-regex skip): a sidechain-only tail yields "" → never-blocks exit.
    const gradedText = extractFirstAssistantOfTurnFromRaw(raw, truncated);
    if (!gradedText) process.exit(0);

    // 2026-06-12: machine-text deploy — mode-header-conformance.jsonl rates the
    // operator-turn segment from this date onward. Robot turns (task-notification /
    // system-reminder / command envelopes) receive no banner instruction from
    // IntentRetrieval, so grading them would log unattributable non-conformance.
    // Skip without a row, removing robot turns from the denominator. If no user
    // text is extractable (older transcript shapes), fall through and grade.
    const lastUserText = extractLastUserFromRaw(raw);
    if (lastUserText && isMachineGeneratedPrompt(lastUserText)) process.exit(0);

    const mode = classifyMode(gradedText);
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      session_id: input.session_id ?? null,
      mode,
      conformant: mode !== "NONE",
      text_length: gradedText.length,
      snippet: gradedText.slice(0, 240).replace(/\n/g, " ").trim(),
      // B.3 discontinuity marker: rows graded by the first-message + first-line
      // instrument carry grader_version:2 so any analyzer reading the full
      // history can mechanically cut at the S2 deploy timestamp. Pre-S2 rows
      // (last-message grader) lack this field — the comparison is void across it.
      grader_version: 2,
    };

    // B.2 Stop-row join (S5 / RT-A16 / RT-A5). Read the per-session turn-state
    // handshake the router wrote at UserPromptSubmit, recompute the sha256 of the
    // operator text we already extracted (lastUserText — the SAME extractor whose
    // text the router hashed), and attach the join fields {turn_id, hint,
    // actual_mode, agreed} ONLY when the two digests match. A hash mismatch
    // (compaction / PreCompact rewrite / harness reformatting) or a missing
    // handshake yields NO join — the row carries no turn_id, never a phantom
    // join. actual_mode is the B.3-corrected grader's verdict (mode above);
    // agreed=null is the DEFINED value when hint=null (silent turns). The
    // grading row itself is unconditional — only the join is hash-gated — so the
    // B.3 conformance denominator is never reduced by a join miss.
    const joinKey = input.session_id ?? "";
    if (joinKey && lastUserText) {
      const join = buildStopJoinRow(joinKey, lastUserText, mode);
      if (join) {
        entry.turn_id = join.turn_id;
        entry.hint = join.hint;
        entry.actual_mode = join.actual_mode;
        entry.agreed = join.agreed;
      }
    }

    if (!existsSync(REFLECTIONS_DIR)) mkdirSync(REFLECTIONS_DIR, { recursive: true });
    appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // Fail-open — never break Stop flow on hook error.
  }
  process.exit(0);
}

const _t = startTimer("ModeHeaderGuard");
process.on("exit", () => stopTimer(_t, "Stop"));
main();
