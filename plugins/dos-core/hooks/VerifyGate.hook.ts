#!/usr/bin/env bun
/**
 * VerifyGate.hook.ts — RFC-0024 §5.2 Code-Produced Check enforcement
 *
 * Trigger: SessionEnd (audit stamp) + PostToolBatch (real enforcement point).
 *   The hook branches on `hook_event_name` from stdin:
 *     - SessionEnd  → stamps the audit ledger + emits the warn/stderr reminder.
 *                     SessionEnd is a NON-BLOCKABLE event, so its "block" mode
 *                     could never actually gate — it is kept for the audit trail
 *                     and the ISC-5.2.4 denominator only.
 *     - PostToolBatch → the blockable enforcement point. It re-evaluates the
 *                     same code-review/simplify_skipped condition and, ONLY when
 *                     DOS_ENFORCEMENT_MODE_SIMPLIFY=block, emits the blockable
 *                     output shape ({"decision":"block","reason":...}) that stops
 *                     the tool loop. It does NOT write the audit ledger (SessionEnd
 *                     owns that, so the denominator is not double-counted). The
 *                     DEFAULT mode stays `warn`, so this block path is dormant
 *                     until an operator opts in.
 *
 * Scans session transcript for code-producing Write/Edit/MultiEdit tool calls.
 * Code-producing = path matches a supported extension AND is not excluded by
 * path rules (PRDs, docs, Plans/, MEMORY/, agents/, Releases/, snapshots,
 * fixtures, codegen, four-copy mirror writes).
 *
 * If code-producing: require either (a) Skill("code-review", ...) invocation in
 * the same session, or (b) `simplify_skipped: "<non-empty reason>"` declared
 * in the session's active PRD under `## Decisions`. Bare `true`, empty string,
 * or missing value fails the gate.
 *
 * Note: Claude Code v2.1.146 renamed /simplify → /code-review. The regex
 * matcher (line ~147) accepts BOTH names so pre-rename transcripts still
 * satisfy the gate. The historic identifier surface — function `simplifyInvoked`,
 * log file `simplify.jsonl`, env var `DOS_ENFORCEMENT_MODE_SIMPLIFY`, PRD escape
 * token `simplify_skipped:` — is preserved deliberately as a STABLE OPERATOR
 * CONTRACT: existing PRDs reference the old field, the audit-trail drainer
 * keys on the old file name, and operator shell profiles set the old env var.
 * Only the user-facing reminder and the regex see the new command name.
 *
 * Outcome logged to MEMORY/LEARNING/ENFORCEMENT/simplify.jsonl for both
 * violations and passes (builds ISC-5.2.4 denominator).
 *
 * Mode (env):
 *   DOS_ENFORCEMENT_MODE_SIMPLIFY=warn  (default) — log + stderr reminder
 *   DOS_ENFORCEMENT_MODE_SIMPLIFY=block — log with block_mode:true flag
 *   DOS_DISABLE_VERIFY_GATE=1           — hook disabled entirely
 *
 * Spec: RFC-0024 §5.2 (Accepted 2026-04-24, amended same-day per Council G1-G6).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnv } from "./lib/paths";

loadProjectEnv();

const HOME = process.env.HOME ?? "";
const DOS_DIR = process.env.DOS_DIR ?? join(HOME, ".claude");
const ENFORCEMENT_DIR = join(DOS_DIR, "MEMORY", "LEARNING", "ENFORCEMENT");
const JSONL_PATH = join(ENFORCEMENT_DIR, "simplify.jsonl");
const STATE_DIR = join(DOS_DIR, "MEMORY", "STATE");

const MODE = (process.env.DOS_ENFORCEMENT_MODE_SIMPLIFY ?? "warn").toLowerCase();
const DISABLED = process.env.DOS_DISABLE_VERIFY_GATE === "1";

const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "go", "rs", "rb",
  "java", "kt", "swift",
  "c", "cpp", "cc", "h", "hpp",
  "cs", "php", "lua",
  "sh", "bash", "zsh",
  "sql", "tf", "hcl", "proto", "graphql",
]);

const EXCLUDED_PATH_PATTERNS: RegExp[] = [
  /(?:^|\/)PRD\.md$/,
  /\.md$/i,
  /(?:^|\/)Plans\//,
  /(?:^|\/)MEMORY\//,
  /(?:^|\/)\.claude\/agents\//,
  /(?:^|\/)Releases\/[^/]+\//,
  /(?:^|\/)\.sentinel\//,
  /(?:^|\/)node_modules\//,
  /(?:^|\/)dist\//,
  /(?:^|\/)build\//,
  /(?:^|\/)generated\//,
  /\.generated\.[^/]+$/,
  /(?:^|\/)__snapshots__\//,
  /\.snap$/,
  /\.fixture\.[^/]+$/,
];

type ToolUse = { name?: string; input?: Record<string, unknown> };

interface TranscriptEntry {
  type?: string;
  message?: {
    content?: Array<{ type?: string; name?: string; input?: Record<string, unknown> }>;
  };
}

function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "";
  return path.slice(dot + 1).toLowerCase();
}

function isExcluded(path: string): boolean {
  return EXCLUDED_PATH_PATTERNS.some((re) => re.test(path));
}

function isCodeProducingPath(path: string): boolean {
  if (!path) return false;
  const ext = extOf(path);
  if (!CODE_EXTENSIONS.has(ext)) return false;
  if (isExcluded(path)) return false;
  return true;
}

function collapseFourCopyMirror(paths: string[]): string[] {
  // Four-copy mirror writes (live + submodule + pack) count as single logical edit.
  // Fingerprint = basename + last 2 path segments; collapse dupes.
  const seen = new Map<string, string>();
  for (const p of paths) {
    const segs = p.split("/");
    const fp = segs.slice(-3).join("/");
    if (!seen.has(fp)) seen.set(fp, p);
  }
  return [...seen.values()];
}

function extractToolUses(transcriptPath: string): ToolUse[] {
  if (!existsSync(transcriptPath)) return [];
  const lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  const uses: ToolUse[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as TranscriptEntry;
      const blocks = entry?.message?.content;
      if (!Array.isArray(blocks)) continue;
      for (const b of blocks) {
        if (b?.type === "tool_use" && typeof b.name === "string") {
          uses.push({ name: b.name, input: b.input });
        }
      }
    } catch {
      // ignore malformed lines
    }
  }
  return uses;
}

function codeProducingPaths(uses: ToolUse[]): string[] {
  const paths: string[] = [];
  for (const u of uses) {
    if (!u.name) continue;
    if (!["Write", "Edit", "MultiEdit"].includes(u.name)) continue;
    const p = typeof u.input?.file_path === "string" ? u.input.file_path : "";
    if (isCodeProducingPath(p)) paths.push(p);
  }
  return collapseFourCopyMirror(paths);
}

function simplifyInvoked(uses: ToolUse[]): boolean {
  return uses.some((u) => {
    if (u.name !== "Skill") return false;
    const skill = typeof u.input?.skill === "string" ? u.input.skill : "";
    // /simplify → /code-review (Claude Code v2.1.146); match both so
    // transcripts authored before the rename still satisfy the gate.
    return /^(simplify|code-review)\b/i.test(skill);
  });
}

function findActivePrdPath(sessionId?: string): string | null {
  const candidates = sessionId
    ? [join(STATE_DIR, `current-work-${sessionId}.json`), join(STATE_DIR, "current-work.json")]
    : [join(STATE_DIR, "current-work.json")];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    try {
      const state = JSON.parse(readFileSync(f, "utf8")) as { prd_path?: string; session_dir?: string };
      if (state.prd_path && existsSync(state.prd_path)) return state.prd_path;
      if (state.session_dir) {
        const prd = join(state.session_dir, "PRD.md");
        if (existsSync(prd)) return prd;
      }
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

function readSimplifySkipped(prdPath: string): { declared: boolean; reason: string | null; valid: boolean } {
  try {
    const text = readFileSync(prdPath, "utf8");
    // Look for simplify_skipped under a ## Decisions section, but accept anywhere in the PRD.
    const match = text.match(/simplify_skipped\s*:\s*(.+?)(?:\n|$)/i);
    if (!match) return { declared: false, reason: null, valid: false };
    const raw = match[1].trim();
    // Reject bare true / false / empty
    if (/^(true|false|yes|no)$/i.test(raw)) return { declared: true, reason: raw, valid: false };
    // Strip surrounding quotes
    const unquoted = raw.replace(/^["']|["']$/g, "").trim();
    if (unquoted.length === 0) return { declared: true, reason: raw, valid: false };
    return { declared: true, reason: unquoted, valid: true };
  } catch {
    return { declared: false, reason: null, valid: false };
  }
}

async function main(): Promise<void> {
  if (DISABLED) {
    process.exit(0);
  }
  try {
    // Force-exit guard: unbounded Bun.stdin.text() hangs the Stop phase if stdin
    // lingers open; a Promise.race won't release the pending read (Forge Gen 21).
    // Timeout → exit 0 = same fail-open no-op as the empty-stdin path below. [H-021]
    const hardTimer = setTimeout(() => process.exit(0), 5000);
    const stdin = await Bun.stdin.text();
    clearTimeout(hardTimer);
    if (!stdin) process.exit(0);
    const input = JSON.parse(stdin) as {
      session_id?: string;
      transcript_path?: string;
      hook_event_name?: string;
    };
    const eventName = input.hook_event_name || "SessionEnd";
    if (eventName === "PostToolBatch") {
      await handlePostToolBatch(input);
    } else {
      await handleSessionEnd(input);
    }
  } catch {
    // Fire-and-forget: never block on hook error
  }
  process.exit(0);
}

/**
 * SessionEnd path — the audit stamp. Writes the enforcement ledger (builds the
 * ISC-5.2.4 denominator) and emits the warn-mode stderr reminder. SessionEnd is
 * non-blockable, so even MODE=block only records `block_mode:true` — it cannot
 * actually gate. Preserved byte-for-byte from the pre-migration hook.
 */
async function handleSessionEnd(input: { session_id?: string; transcript_path?: string }): Promise<void> {
  const sessionId = input.session_id;
  const transcriptPath = input.transcript_path;

  if (!transcriptPath || !existsSync(transcriptPath)) {
    return;
  }

  const uses = extractToolUses(transcriptPath);
  const codePaths = codeProducingPaths(uses);

  // Non-code-producing runs exit silently — still log a pass entry for denominator hygiene
  if (codePaths.length === 0) {
    writeJsonl({
      timestamp: new Date().toISOString(),
      session_id: sessionId ?? null,
      code_producing: false,
      code_paths: [],
      simplify_invoked: false,
      simplify_skipped: null,
      verdict: "non_code_producing",
      mode: MODE,
    });
    return;
  }

  const invoked = simplifyInvoked(uses);
  const prdPath = findActivePrdPath(sessionId);
  const skipped = prdPath ? readSimplifySkipped(prdPath) : { declared: false, reason: null, valid: false };

  let verdict: "pass_invoked" | "pass_skipped_valid" | "violation_no_invocation" | "violation_skipped_invalid";
  if (invoked) verdict = "pass_invoked";
  else if (skipped.declared && skipped.valid) verdict = "pass_skipped_valid";
  else if (skipped.declared && !skipped.valid) verdict = "violation_skipped_invalid";
  else verdict = "violation_no_invocation";

  writeJsonl({
    timestamp: new Date().toISOString(),
    session_id: sessionId ?? null,
    code_producing: true,
    code_paths: codePaths,
    simplify_invoked: invoked,
    simplify_skipped: skipped.reason,
    simplify_skipped_valid: skipped.valid,
    prd_path: prdPath,
    verdict,
    mode: MODE,
    block_mode: MODE === "block",
  });

  if (verdict.startsWith("violation")) {
    const reason =
      verdict === "violation_no_invocation"
        ? "no Skill('code-review') invocation AND no simplify_skipped declaration"
        : `simplify_skipped declared but invalid (got ${skipped.reason}) — require non-empty reason string`;
    const modeLabel = MODE === "block" ? "BLOCK" : "WARN";
    process.stderr.write(
      `\n<system-reminder>\nRFC-0024 §5.2 Code-Produced Check [${modeLabel}]: session wrote ${codePaths.length} code-producing file(s) without satisfying the /code-review gate.\nReason: ${reason}\nCode paths (first 5): ${codePaths.slice(0, 5).join(", ")}\nResolve: invoke Skill("code-review", "high") next code-producing run, or declare simplify_skipped: "<non-empty reason>" in PRD ## Decisions.\nLog: ${JSONL_PATH}\nDisable (discouraged): DOS_DISABLE_VERIFY_GATE=1\n</system-reminder>\n`,
    );
  }
}

/**
 * PostToolBatch path — the real, blockable enforcement point. Re-evaluates the
 * same code-review/simplify_skipped condition against the transcript so far.
 * ONLY when MODE=block does it emit the blockable output shape that stops the
 * tool loop ({"decision":"block","reason":...}). Shape verified against the
 * official hooks reference (fetched 2026-07-02): PostToolBatch is in the
 * top-level-decision family (alongside PostToolUse/Stop/PreCompact), NOT the
 * hookSpecificOutput.permissionDecision family (PreToolUse-only). In the
 * default `warn` mode (and on any non-violation) it passes through with
 * {"continue":true}. It never writes the audit ledger — SessionEnd owns that.
 */
async function handlePostToolBatch(input: { session_id?: string; transcript_path?: string }): Promise<void> {
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  const uses = extractToolUses(transcriptPath);
  const codePaths = codeProducingPaths(uses);
  if (codePaths.length === 0) {
    process.stdout.write(JSON.stringify({ continue: true }));
    return;
  }

  const invoked = simplifyInvoked(uses);
  const prdPath = findActivePrdPath(input.session_id);
  const skipped = prdPath ? readSimplifySkipped(prdPath) : { declared: false, reason: null, valid: false };
  const isViolation = !invoked && !(skipped.declared && skipped.valid);

  if (isViolation && MODE === "block") {
    const reason = !skipped.declared
      ? "no Skill('code-review') invocation AND no simplify_skipped declaration"
      : `simplify_skipped declared but invalid (got ${skipped.reason}) — require non-empty reason string`;
    process.stdout.write(
      JSON.stringify({
        decision: "block",
        reason:
          `RFC-0024 §5.2 Code-Produced Check [BLOCK]: ${codePaths.length} code-producing file(s) written without satisfying the /code-review gate.\n` +
          `Reason: ${reason}\n` +
          `Code paths (first 5): ${codePaths.slice(0, 5).join(", ")}\n` +
          `Resolve: invoke Skill("code-review", "high"), or declare simplify_skipped: "<non-empty reason>" in PRD ## Decisions.\n` +
          `Disable (discouraged): DOS_DISABLE_VERIFY_GATE=1`,
      }),
    );
    return;
  }

  // Default warn mode, or a non-violation, or a valid skip → never gate.
  process.stdout.write(JSON.stringify({ continue: true }));
}

function writeJsonl(entry: Record<string, unknown>): void {
  try {
    if (!existsSync(ENFORCEMENT_DIR)) mkdirSync(ENFORCEMENT_DIR, { recursive: true });
    appendFileSync(JSONL_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // swallow
  }
}

if (import.meta.main) {
  await main();
}
