#!/usr/bin/env bun
/**
 * ParallelismCheck.hook.ts — RFC-0024 §5.6 parallelism enforcement
 *
 * Trigger: SessionEnd (retrospective — see VerifyGate L1 for rationale)
 *
 * Scans session transcript for SEQUENTIAL Write/Edit/MultiEdit operations
 * that share a path prefix (top-2 segments). If ≥3 sequential matches occur
 * without a Skill("batch", ...) invocation AND without a `batch_skipped:
 * "<non-empty reason>"` declaration in the active PRD, logs a violation.
 *
 * "Sequential" means across multiple assistant messages. N≥3 Write/Edit
 * tool_uses in the SAME assistant message are PARALLEL and exempt.
 *
 * Iterative-debug exemption: if the same file is rewritten repeatedly with
 * Bash/Read interleaved between the Writes, treat as debug iteration (not
 * missed batching).
 *
 * Mode (env):
 *   DOS_ENFORCEMENT_MODE_PARALLELISM=warn (default) | block
 *   DOS_DISABLE_PARALLELISM_CHECK=1 disables entirely
 *
 * Spec: RFC-0024 §5.6 (Accepted 2026-04-24, amended per Council G1-G6).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { loadProjectEnv } from "./lib/paths";

loadProjectEnv();
import { join } from "node:path";

const HOME = process.env.HOME ?? "";
const DOS_DIR = process.env.DOS_DIR ?? join(HOME, ".claude");
const ENFORCEMENT_DIR = join(DOS_DIR, "MEMORY", "LEARNING", "ENFORCEMENT");
const JSONL_PATH = join(ENFORCEMENT_DIR, "parallelism.jsonl");
const STATE_DIR = join(DOS_DIR, "MEMORY", "STATE");

const MODE = (process.env.DOS_ENFORCEMENT_MODE_PARALLELISM ?? "warn").toLowerCase();
const DISABLED = process.env.DOS_DISABLE_PARALLELISM_CHECK === "1";

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

interface ToolUse {
  name: string;
  input?: Record<string, unknown>;
  message_idx: number; // which assistant message this tool_use belonged to
}

interface TranscriptEntry {
  type?: string;
  message?: {
    content?: Array<{ type?: string; name?: string; input?: Record<string, unknown> }>;
  };
}

function isExcluded(path: string): boolean {
  return EXCLUDED_PATH_PATTERNS.some((re) => re.test(path));
}

function extractToolUses(transcriptPath: string): ToolUse[] {
  if (!existsSync(transcriptPath)) return [];
  const lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  const uses: ToolUse[] = [];
  let msgIdx = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as TranscriptEntry;
      if (entry?.type !== "assistant") continue;
      const blocks = entry?.message?.content;
      if (!Array.isArray(blocks)) continue;
      msgIdx++;
      for (const b of blocks) {
        if (b?.type === "tool_use" && typeof b.name === "string") {
          uses.push({ name: b.name, input: b.input, message_idx: msgIdx });
        }
      }
    } catch {
      // ignore malformed lines
    }
  }
  return uses;
}

function pathPrefix(path: string): string {
  // Use the file's parent directory as the grouping key. Files that share
  // a directory are candidates for /batch; files scattered across multiple
  // directories are orthogonal work.
  const idx = path.lastIndexOf("/");
  if (idx < 0) return "";
  return path.slice(0, idx);
}

function basename(path: string): string {
  const segs = path.split("/");
  return segs[segs.length - 1] ?? path;
}

function batchInvoked(uses: ToolUse[]): boolean {
  return uses.some((u) => {
    if (u.name !== "Skill") return false;
    const skill = typeof u.input?.skill === "string" ? u.input.skill : "";
    return /^batch\b/i.test(skill);
  });
}

interface WriteOp {
  path: string;
  message_idx: number;
  use_idx: number; // position in full tool-use stream
}

function collectWrites(uses: ToolUse[]): WriteOp[] {
  const writes: WriteOp[] = [];
  uses.forEach((u, i) => {
    if (!["Write", "Edit", "MultiEdit"].includes(u.name)) return;
    const p = typeof u.input?.file_path === "string" ? u.input.file_path : "";
    if (!p || isExcluded(p)) return;
    writes.push({ path: p, message_idx: u.message_idx, use_idx: i });
  });
  return writes;
}

interface PrefixGroup {
  prefix: string;
  writes: WriteOp[];
  unique_messages: number;
  unique_basenames: number;
}

function groupByPrefix(writes: WriteOp[]): PrefixGroup[] {
  const groups = new Map<string, WriteOp[]>();
  for (const w of writes) {
    const pfx = pathPrefix(w.path);
    if (!pfx) continue;
    const arr = groups.get(pfx) ?? [];
    arr.push(w);
    groups.set(pfx, arr);
  }
  return [...groups.entries()].map(([prefix, ws]) => {
    const messages = new Set(ws.map((w) => w.message_idx));
    const bases = new Set(ws.map((w) => basename(w.path)));
    return { prefix, writes: ws, unique_messages: messages.size, unique_basenames: bases.size };
  });
}

function isIterativeDebugGroup(group: PrefixGroup, allUses: ToolUse[]): boolean {
  // Heuristic: all writes hit the SAME single file (unique_basenames === 1)
  // AND there are Bash/Read tool_uses interleaved between them.
  if (group.unique_basenames !== 1) return false;
  if (group.writes.length < 2) return false;
  const firstIdx = group.writes[0].use_idx;
  const lastIdx = group.writes[group.writes.length - 1].use_idx;
  for (let i = firstIdx + 1; i < lastIdx; i++) {
    const u = allUses[i];
    if (u && ["Bash", "Read"].includes(u.name)) return true;
  }
  return false;
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
      // ignore
    }
  }
  return null;
}

function readBatchSkipped(prdPath: string): { declared: boolean; reason: string | null; valid: boolean } {
  try {
    const text = readFileSync(prdPath, "utf8");
    const match = text.match(/batch_skipped\s*:\s*(.+?)(?:\n|$)/i);
    if (!match) return { declared: false, reason: null, valid: false };
    const raw = match[1].trim();
    if (/^(true|false|yes|no)$/i.test(raw)) return { declared: true, reason: raw, valid: false };
    const unquoted = raw.replace(/^["']|["']$/g, "").trim();
    if (unquoted.length === 0) return { declared: true, reason: raw, valid: false };
    return { declared: true, reason: unquoted, valid: true };
  } catch {
    return { declared: false, reason: null, valid: false };
  }
}

function writeJsonl(entry: Record<string, unknown>): void {
  try {
    if (!existsSync(ENFORCEMENT_DIR)) mkdirSync(ENFORCEMENT_DIR, { recursive: true });
    appendFileSync(JSONL_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    // swallow
  }
}

async function main(): Promise<void> {
  if (DISABLED) process.exit(0);
  try {
    // Force-exit guard: unbounded Bun.stdin.text() hangs the SessionEnd phase if
    // stdin lingers; a Promise.race won't release the pending read (Forge Gen 21).
    // Timeout → exit 0 = same no-op as the empty-stdin path below. [H-021]
    const hardTimer = setTimeout(() => process.exit(0), 5000);
    const stdin = await Bun.stdin.text();
    clearTimeout(hardTimer);
    if (!stdin) process.exit(0);
    const input = JSON.parse(stdin) as { session_id?: string; transcript_path?: string };
    const sessionId = input.session_id;
    const transcriptPath = input.transcript_path;
    if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);

    const allUses = extractToolUses(transcriptPath);
    const writes = collectWrites(allUses);

    // Qualifying group:
    //   (1) ≥3 distinct BASENAMES under the same parent directory (not 3 edits of 1-2 files),
    //   (2) ≥2 distinct assistant messages (sequential, not single-turn parallel),
    //   (3) not an iterative-debug loop (same single file rewritten with Bash/Read between).
    const allGroups = groupByPrefix(writes);
    const qualifyingGroups = allGroups.filter(
      (g) =>
        g.unique_basenames >= 3 &&
        g.unique_messages >= 2 &&
        !isIterativeDebugGroup(g, allUses),
    );

    if (qualifyingGroups.length === 0) {
      writeJsonl({
        timestamp: new Date().toISOString(),
        session_id: sessionId ?? null,
        qualifying_sequential: false,
        groups: allGroups.length,
        total_writes: writes.length,
        verdict: "non_qualifying",
        mode: MODE,
      });
      process.exit(0);
    }

    const invoked = batchInvoked(allUses);
    const prdPath = findActivePrdPath(sessionId);
    const skipped = prdPath ? readBatchSkipped(prdPath) : { declared: false, reason: null, valid: false };

    let verdict: "pass_invoked" | "pass_skipped_valid" | "violation_no_invocation" | "violation_skipped_invalid";
    if (invoked) verdict = "pass_invoked";
    else if (skipped.declared && skipped.valid) verdict = "pass_skipped_valid";
    else if (skipped.declared && !skipped.valid) verdict = "violation_skipped_invalid";
    else verdict = "violation_no_invocation";

    writeJsonl({
      timestamp: new Date().toISOString(),
      session_id: sessionId ?? null,
      qualifying_sequential: true,
      qualifying_groups: qualifyingGroups.map((g) => ({
        prefix: g.prefix,
        count: g.writes.length,
        unique_messages: g.unique_messages,
        unique_basenames: g.unique_basenames,
      })),
      batch_invoked: invoked,
      batch_skipped: skipped.reason,
      batch_skipped_valid: skipped.valid,
      prd_path: prdPath,
      verdict,
      mode: MODE,
      block_mode: MODE === "block",
    });

    if (verdict.startsWith("violation")) {
      const worst = qualifyingGroups[0];
      const reason =
        verdict === "violation_no_invocation"
          ? "no Skill('batch') invocation AND no batch_skipped declaration"
          : `batch_skipped declared but invalid (got ${skipped.reason}) — require non-empty reason string`;
      const modeLabel = MODE === "block" ? "BLOCK" : "WARN";
      process.stderr.write(
        `\n<system-reminder>\nRFC-0024 §5.6 Parallelism Check [${modeLabel}]: session made ${worst.writes.length} sequential Write/Edit calls under "${worst.prefix}/" without batching.\nReason: ${reason}\nResolve: invoke Skill("batch", ...) for uniform edits across sibling files, OR declare batch_skipped: "<non-empty reason>" in PRD ## Decisions.\nLog: ${JSONL_PATH}\nDisable (discouraged): DOS_DISABLE_PARALLELISM_CHECK=1\n</system-reminder>\n`,
      );
    }
  } catch {
    // fire-and-forget
  }
  process.exit(0);
}

await main();
