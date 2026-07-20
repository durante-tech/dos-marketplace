#!/usr/bin/env bun
/**
 * CompletionEvidence.hook.ts — RFC-0024 §5.7 completion-claim evidence enforcement
 *
 * Trigger: Stop (fires after each assistant response)
 *
 * Scans the just-emitted response text for completion-claim markers (done,
 * shipped, verified, ✅, 🗣️-with-verb, Claude-isms, Portuguese cognates,
 * checked checkboxes). If any match AND no evidence marker (file:line, git
 * SHA, URL, backticked file path, ISC-N, PR #N, terminal output, quoted
 * tool output) appears in the same response, logs a violation to
 * MEMORY/LEARNING/ENFORCEMENT/completion.jsonl and emits a <system-reminder>
 * to stderr.
 *
 * Known measurement caveat (RFC §5.7, Council G7): regex detects citation
 * *shapes*, not verification quality. This hook is a useful floor (zero-
 * citation completions are caught), not a ceiling. Semantic audits via the
 * cadenced council (§5.8) complement regex.
 *
 * Mode (env):
 *   DOS_ENFORCEMENT_MODE_COMPLETION=warn (default) | block
 *   DOS_DISABLE_COMPLETION_EVIDENCE=1 disables entirely
 *
 * Spec: RFC-0024 §5.7 (Accepted 2026-04-24, amended per Council G5).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnv } from "./lib/paths";

loadProjectEnv();

const HOME = process.env.HOME ?? "";
const DOS_DIR = process.env.DOS_DIR ?? join(HOME, ".claude");
const ENFORCEMENT_DIR = join(DOS_DIR, "MEMORY", "LEARNING", "ENFORCEMENT");
const JSONL_PATH = join(ENFORCEMENT_DIR, "completion.jsonl");

const MODE = (process.env.DOS_ENFORCEMENT_MODE_COMPLETION ?? "warn").toLowerCase();
const DISABLED = process.env.DOS_DISABLE_COMPLETION_EVIDENCE === "1";

// Minimum response length to scan (shorter = greeting/ack, skip)
const MIN_LENGTH = 80;

// Completion markers — case-insensitive when needed; tuned per RFC §5.7 G5 amendment.
const COMPLETION_PATTERNS: RegExp[] = [
  // General completion verbs + English shorthand
  /\b(done|complete|completed|verified|shipped|fixed|merged|deployed|landed|ready|working|passing|implemented|refactored|migrated|wired up|ship it|LGTM|all green)\b/i,
  // Checkmark at line start (excludes ✅ embedded in the middle of an ISC verification line which likely has evidence anyway)
  /(^|\n)✅/,
  // Voice line with completion verb
  /🗣️.*(?:done|complete|shipped|verified|ready)/i,
  // Checked checkbox — "task X is done" shape
  /^\s*-\s*\[x\]/im,
  // Claude-specific completion phrasings
  /\bSuccessfully\s+(created|updated|deleted|added|fixed|implemented|migrated|deployed|ran)/i,
  /\bis\s+(now|already)\s+(working|complete|done|ready|fixed|deployed|live)/i,
  /\bshould\s+(now|already)\s+(work|be\s+\w+|be\s+(fixed|ready|complete|deployed))/i,
  // Portuguese completion cognates ({PRINCIPAL.NAME} L1)
  /\b(pronto|feito|enviado|concluído|concluido|implementado|corrigido|implantado)\b/i,
];

// Evidence markers — any one sufficient
const EVIDENCE_PATTERNS: RegExp[] = [
  /[a-zA-Z_./\\-]+\.\w+:\d+/,              // file:line
  /\b[a-f0-9]{7,40}\b/,                     // short or long git SHA
  /https?:\/\//,                            // URL
  /`[a-zA-Z0-9_\-./]+\.\w{1,8}`/,           // backticked file path
  /ISC-\d+(\.\d+)?[a-z]?/,                  // ISC-N or ISC-5.4.a
  /PR\s*#?\d+/i,                            // PR number
  /\$\s*[a-z][a-z0-9-]*\s+[a-z0-9-]+/,     // terminal command shape
  /^\s*>\s+/m,                              // quoted tool-output block
];

// MINIMAL-mode header — skip these responses
const MINIMAL_HEADER = /═══\s*DOS\s*═══/;

function extractLastSection(text: string): string {
  // Scan only the "last section" heuristic: after last `## ` heading or last `---` horizontal rule.
  // Prevents tripping on a historical-context completion claim in an early section.
  const lastHR = text.lastIndexOf("\n---");
  const lastH2 = text.lastIndexOf("\n## ");
  const cut = Math.max(lastHR, lastH2);
  if (cut < 0 || cut < text.length / 2) return text; // too early or absent — use whole text
  return text.slice(cut);
}

function stripCodeBlocks(text: string): string {
  // Remove triple-backtick fenced code blocks — completion markers in code are not claims.
  return text.replace(/```[\s\S]*?```/g, "");
}

function stripQuotedUserMessages(text: string): string {
  // Remove lines that look like quoted user messages (one-level > blocks at message start, not tool-output).
  // Heuristic: consecutive > lines with a blank before/after are a quoted passage — skip them.
  return text.replace(/(^|\n)(>[^\n]*\n)(>[^\n]*\n)+/g, "\n");
}

interface Scan {
  length: number;
  has_completion: boolean;
  completion_hits: string[];
  has_evidence: boolean;
  evidence_hits: string[];
  scanned_length: number;
}

interface CompletionVerdict {
  verdict: "pass" | "violation" | "skip";
  scan: Scan;
  reminder?: string;
  shouldBlock: boolean;
  alreadyWarned: boolean;
}

function scanResponse(raw: string): Scan {
  if (MINIMAL_HEADER.test(raw.slice(0, 200))) {
    return { length: raw.length, has_completion: false, completion_hits: [], has_evidence: false, evidence_hits: [], scanned_length: 0 };
  }
  // Strip code fences and quoted user messages before scanning
  const cleaned = stripQuotedUserMessages(stripCodeBlocks(raw));
  const lastSection = extractLastSection(cleaned);

  const completion_hits: string[] = [];
  for (const re of COMPLETION_PATTERNS) {
    const m = lastSection.match(re);
    if (m) completion_hits.push(m[0].slice(0, 60));
  }
  const evidence_hits: string[] = [];
  for (const re of EVIDENCE_PATTERNS) {
    const m = lastSection.match(re);
    if (m) evidence_hits.push(m[0].slice(0, 60));
  }

  return {
    length: raw.length,
    has_completion: completion_hits.length > 0,
    completion_hits,
    has_evidence: evidence_hits.length > 0,
    evidence_hits,
    scanned_length: lastSection.length,
  };
}

function writeJsonl(entry: Record<string, unknown>): void {
  try {
    if (!existsSync(ENFORCEMENT_DIR)) mkdirSync(ENFORCEMENT_DIR, { recursive: true });
    appendFileSync(JSONL_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // swallow
  }
}

function sessionAlreadyWarned(sessionId: string | null): boolean {
  if (!sessionId || !existsSync(JSONL_PATH)) return false;
  try {
    const lines = readFileSync(JSONL_PATH, "utf8").split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const entry = JSON.parse(lines[i]) as { session_id?: string | null; verdict?: string };
      if (entry.session_id === sessionId && entry.verdict === "violation") return true;
    }
  } catch {
    // If the ledger is malformed, fail open and warn again.
  }
  return false;
}

function buildReminder(scan: Scan, blockMode: boolean): string {
  const modeLabel = blockMode ? "BLOCK" : "WARN";
  return `RFC-0024 §5.7 Completion-Claim Evidence [${modeLabel}]: response contains completion marker(s) without evidence citation.\nCompletion hits: ${scan.completion_hits.slice(0, 3).join(", ")}\nAdd evidence: file:line reference, git SHA, URL, backticked file path, ISC-N, PR #, or terminal output.\nLog: ${JSONL_PATH}\nDisable (discouraged): DOS_DISABLE_COMPLETION_EVIDENCE=1`;
}

function evaluateCompletionEvidence(
  text: string,
  opts: { mode?: string; sessionId?: string | null; alreadyWarned?: boolean } = {},
): CompletionVerdict {
  if (text.length < MIN_LENGTH) {
    const scan: Scan = {
      length: text.length,
      has_completion: false,
      completion_hits: [],
      has_evidence: false,
      evidence_hits: [],
      scanned_length: 0,
    };
    return { verdict: "skip", scan, shouldBlock: false, alreadyWarned: Boolean(opts.alreadyWarned) };
  }

  const scan = scanResponse(text);
  if (!scan.has_completion) {
    return { verdict: "skip", scan, shouldBlock: false, alreadyWarned: Boolean(opts.alreadyWarned) };
  }
  if (scan.has_evidence) {
    return { verdict: "pass", scan, shouldBlock: false, alreadyWarned: Boolean(opts.alreadyWarned) };
  }

  const blockMode = (opts.mode ?? MODE) === "block";
  const alreadyWarned = Boolean(opts.alreadyWarned);
  return {
    verdict: "violation",
    scan,
    reminder: buildReminder(scan, blockMode),
    shouldBlock: blockMode && !alreadyWarned,
    alreadyWarned,
  };
}

async function readLastAssistantMessage(input: Record<string, unknown>): Promise<string | null> {
  const direct = input.last_assistant_message;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const transcriptPath = input.transcript_path;
  if (typeof transcriptPath !== "string" || !existsSync(transcriptPath)) return null;
  // Fallback: read transcript JSONL, find last assistant entry with a text block
  try {
    const lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as { type?: string; message?: { content?: Array<{ type?: string; text?: string }> } };
        if (entry.type !== "assistant") continue;
        const blocks = entry.message?.content;
        if (!Array.isArray(blocks)) continue;
        const text = blocks
          .filter((b) => b.type === "text" && typeof b.text === "string")
          .map((b) => b.text as string)
          .join("\n");
        if (text.length > 0) return text;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function main(): Promise<void> {
  if (DISABLED) process.exit(0);
  try {
    // Force-exit guard: unbounded Bun.stdin.text() hangs the Stop phase if stdin
    // lingers open; a Promise.race won't release the pending read (Forge Gen 21).
    // Timeout → exit 0 = same fail-open no-op as the empty-stdin path below. [H-021]
    const hardTimer = setTimeout(() => process.exit(0), 5000);
    const stdin = await Bun.stdin.text();
    clearTimeout(hardTimer);
    if (!stdin) process.exit(0);
    const input = JSON.parse(stdin) as Record<string, unknown>;

    const text = await readLastAssistantMessage(input);
    if (!text) process.exit(0);

    const sessionId = typeof input.session_id === "string" ? input.session_id : null;
    const alreadyWarned = sessionAlreadyWarned(sessionId);
    const result = evaluateCompletionEvidence(text, { mode: MODE, sessionId, alreadyWarned });
    const scan = result.scan;

    // Non-completion responses exit silently (log pass entries would flood).
    if (result.verdict === "skip") {
      process.exit(0);
    }

    const verdict = result.verdict;

    writeJsonl({
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      response_length: scan.length,
      scanned_length: scan.scanned_length,
      has_completion: scan.has_completion,
      completion_hits: scan.completion_hits,
      has_evidence: scan.has_evidence,
      evidence_hits: scan.evidence_hits,
      verdict,
      mode: MODE,
      block_mode: MODE === "block",
      suppressed_repeat: verdict === "violation" && alreadyWarned,
    });

    if (verdict === "violation" && result.reminder && !alreadyWarned) {
      if (result.shouldBlock) {
        console.log(JSON.stringify({ decision: "block", reason: result.reminder }));
      } else {
        process.stderr.write(`\n<system-reminder>\n${result.reminder}\n</system-reminder>\n`);
      }
    }
  } catch {
    // fire-and-forget
  }
  process.exit(0);
}

if (import.meta.main) {
  await main();
}

export {
  scanResponse,
  evaluateCompletionEvidence,
  stripCodeBlocks,
  stripQuotedUserMessages,
  extractLastSection,
};
