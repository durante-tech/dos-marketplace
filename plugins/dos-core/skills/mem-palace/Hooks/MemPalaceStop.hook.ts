#!/usr/bin/env bun
/**
 * MemPalaceStop.hook.ts — Auto-Save Session Digest on Stop
 *
 * PURPOSE:
 * Counts human messages in the session transcript. Every SAVE_INTERVAL
 * messages, performs a durable digest save to MemPalace and allows the stop
 * to proceed without operator interruption.
 *
 * REWRITTEN 2026-05-04: removed the `decision: block` pattern that demanded
 * the AI manually invoke MCP save tools under time pressure. That approach
 * (a) interrupted flow, (b) relied on AI memory under stress, and (c) could
 * loop if the AI failed to act. The hook now saves itself via
 * mempalace_bridge.add_drawer + add_kg_fact, then ALLOWS the stop to proceed.
 *
 * TRIGGER: Stop
 *
 * INPUT:
 * - stdin: { session_id, transcript_path, stop_hook_active }
 *
 * OUTPUT:
 * - stdout: (nothing) — always allow stop
 * - exit(0): always
 *
 * SIDE EFFECTS:
 * - Writes a "stop digest" drawer to wing=<project|"general">, room=stop-saves
 * - Writes a KG fact: session-{id} stopped_with_digest <drawer-id>
 * - Appends one JSONL line to MEMORY/STATE/stop-saves.jsonl for audit
 * - Updates ~/.mempalace/hook_state/{session_id}_last_save (message count watermark)
 *
 * BUDGET:
 * - bridgeSync add_drawer: 8s (chromadb embed + sqlite write)
 * - bridgeSync add_kg_fact: 5s
 * - git context capture: 1.5s timeout each
 * Total worst case ~15s. Stop hook budget is generous — never the bottleneck.
 */

import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, appendFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { execSync, spawn } from "child_process";
import { resolveProjectWingFromEnv } from "./lib/project-resolver";
import { parseFrontmatter, getScalarField, countCriteria } from "./lib/prd-utils";
import { PRD_PHASE_COMPLETE } from "./lib/tab-constants";
import { dosPath, getWorkDir } from "./lib/paths";
import { startTimer, stopTimer } from './lib/hook-io';
import { bridgeSync, resolveBridgePython, BRIDGE_PATH } from './lib/mempalace';

const SAVE_INTERVAL = 15;
const MEMPALACE_DIR = process.env.MEMPALACE_DIR || join(homedir(), ".mempalace");
const STATE_DIR = join(MEMPALACE_DIR, "hook_state");

interface StopHookInput {
  session_id: string;
  transcript_path: string;
  stop_hook_active?: boolean;
  hook_event_name: string;
}

async function readStdin(): Promise<StopHookInput | null> {
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
    return input.trim() ? (JSON.parse(input) as StopHookInput) : null;
  } catch {
    return null;
  }
}

function countHumanMessages(transcriptPath: string): number {
  if (!transcriptPath || !existsSync(transcriptPath)) return 0;

  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    let count = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (
          entry.role === "human" ||
          entry.role === "user" ||
          entry.type === "human"
        ) {
          const text = entry.content || entry.message || "";
          if (
            typeof text === "string" &&
            !text.includes("<command-message>") &&
            !text.includes("<command-name>")
          ) {
            count++;
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
    return count;
  } catch {
    return 0;
  }
}

function getLastSaveCount(sessionId: string): number {
  const stateFile = join(STATE_DIR, `${sessionId}_last_save`);
  try {
    if (existsSync(stateFile)) {
      return parseInt(readFileSync(stateFile, "utf-8").trim(), 10) || 0;
    }
  } catch {
    // First session
  }
  return 0;
}

function updateLastSaveCount(sessionId: string, count: number): void {
  try {
    if (!existsSync(STATE_DIR)) {
      mkdirSync(STATE_DIR, { recursive: true });
    }
    writeFileSync(join(STATE_DIR, `${sessionId}_last_save`), String(count), "utf-8");
  } catch {
    // Non-critical
  }
}

interface PRDDigest {
  task: string;
  phase: string;
  progress: string;
  unchecked: string[];
  decisions: string[];
  prd_path: string;
}

function findActivePRDDigest(): PRDDigest | null {
  // Resolve project-first via getWorkDir() (NOT the global-only dosPath) so a
  // cross-project session does not leak Durante PRDs, mirroring WakeUp's
  // collectOpenThreads (RFC-0027 §5.3) (MP-056).
  const workDir = getWorkDir();
  if (!existsSync(workDir)) return null;

  let bestPath: string | null = null;
  let bestMtime = 0;

  // Candidate PRDs live at two depths after the WORK active/archived migration
  // (CLAUDE.md "active/archived structural split"):
  //   - legacy flat:  MEMORY/WORK/{slug}/PRD.md            (one level)
  //   - active bucket: MEMORY/WORK/active/{slug}/PRD.md     (two levels)
  //   - archived:      MEMORY/WORK/archived/{slug}/PRD.md   (two levels)
  // A one-level scan made the newest (hot) PRDs in active/ structurally
  // invisible to the resume digest (MP-056).
  const candidateDirs: string[] = [workDir];
  for (const bucket of ["active", "archived"]) {
    const bucketDir = join(workDir, bucket);
    try {
      if (statSync(bucketDir).isDirectory()) candidateDirs.push(bucketDir);
    } catch {}
  }

  for (const baseDir of candidateDirs) {
    for (const dir of readdirSync(baseDir)) {
      const prdPath = join(baseDir, dir, "PRD.md");
      try {
        const s = statSync(prdPath);
        if (s.mtimeMs > bestMtime) {
          bestMtime = s.mtimeMs;
          bestPath = prdPath;
        }
      } catch {}
    }
  }

  if (!bestPath) return null;

  try {
    const content = readFileSync(bestPath, "utf-8");
    const fm = parseFrontmatter(content);
    if (!fm) return null;
    const phase = getScalarField(fm, "phase") ?? "unknown";
    // Skip the "remaining work" digest for terminal PRDs. 'done' is terminal
    // alongside 'complete' (6 live PRDs use it) — without this a finished 'done'
    // PRD gets a spurious remaining-criteria digest written to memory (H-075b,
    // the recurring done-phase class).
    if (phase === PRD_PHASE_COMPLETE || phase === "done") return null;

    const taskName = getScalarField(fm, "task") || getScalarField(fm, "slug") || "unknown";
    const { checked, total } = countCriteria(content);

    // `(?![\s\S])` is the end-of-string anchor. JS regex has NO `\Z` — `\Z` is a
    // literal 'Z', so the old lookahead only terminated on '\n## '/'\n---'/a
    // literal Z and returned NULL when '## Criteria' was the PRD's LAST section
    // (common) — silently dropping the remaining-criteria block from the Stop
    // digest drawer (H-075, the H-016 class).
    const criteriaMatch = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|(?![\s\S]))/);
    const unchecked: string[] = [];
    if (criteriaMatch) {
      for (const line of criteriaMatch[1].split("\n")) {
        if (line.startsWith("- [ ]")) {
          unchecked.push(line.replace(/^- \[ \]\s*/, "").trim());
        }
      }
    }

    // Same `\Z`-literal end-anchor fix as Criteria above (H-075): '## Decisions'
    // is very commonly the PRD's last section, so `\Z` dropped it entirely.
    const decisionsMatch = content.match(/## Decisions\n([\s\S]*?)(?=\n## |(?![\s\S]))/);
    const decisions: string[] = [];
    if (decisionsMatch) {
      for (const line of decisionsMatch[1].split("\n")) {
        const numbered = line.match(/^\d+\.\s+(.+)/);
        if (numbered) decisions.push(numbered[1].trim());
      }
    }

    return {
      task: taskName,
      phase,
      progress: `${checked}/${total}`,
      unchecked,
      decisions,
      prd_path: bestPath,
    };
  } catch {
    return null;
  }
}

function captureGitContext(): { head: string; recent: string } {
  let head = "";
  let recent = "";
  try {
    head = execSync("git rev-parse HEAD", { timeout: 1500, encoding: "utf-8" }).trim();
  } catch {}
  try {
    recent = execSync("git log --oneline -5", { timeout: 1500, encoding: "utf-8" }).trim();
  } catch {}
  return { head, recent };
}

function buildDigestContent(
  input: StopHookInput,
  messageCount: number,
  prd: PRDDigest | null,
  git: { head: string; recent: string },
): string {
  const lines: string[] = [
    `# Stop Digest — session ${input.session_id || "unknown"}`,
    `Saved: ${new Date().toISOString()}`,
    `Messages in session: ${messageCount}`,
    `Transcript: ${input.transcript_path || "unknown"}`,
    "",
  ];

  if (prd) {
    lines.push(
      "## Active task",
      `- Task: ${prd.task}`,
      `- Phase: ${prd.phase}`,
      `- Progress: ${prd.progress}`,
      `- PRD: ${prd.prd_path}`,
      "",
    );
    if (prd.unchecked.length > 0) {
      lines.push(`## Remaining criteria (${prd.unchecked.length})`);
      for (const c of prd.unchecked.slice(0, 20)) lines.push(`- [ ] ${c}`);
      if (prd.unchecked.length > 20) lines.push(`- ... +${prd.unchecked.length - 20} more`);
      lines.push("");
    }
    if (prd.decisions.length > 0) {
      lines.push("## Decisions to preserve");
      for (const d of prd.decisions.slice(0, 10)) lines.push(`- ${d}`);
      lines.push("");
    }
  } else {
    lines.push("## Active task", "(no active PRD found in MEMORY/WORK)", "");
  }

  if (git.head) {
    lines.push("## Git context", `- HEAD: ${git.head}`, "");
  }
  if (git.recent) {
    lines.push("## Recent commits", "```", git.recent, "```", "");
  }

  lines.push(
    "## Resume hint",
    "Next session: read this drawer + the PRD path above to resume mid-flow.",
    "Use kg_query subject=session-" + (input.session_id || "unknown") + " to find related facts.",
  );

  return lines.join("\n");
}

/**
 * Fire-and-forget WAL checkpoint (PRD MDC-1). At SessionEnd the writers for
 * this session have stopped, so a deterministic `PRAGMA wal_checkpoint(TRUNCATE)`
 * bounds the KG WAL. The checkpointer is pure stdlib (no mempalace import) and
 * flock-guards a singleton lock, so spawning it detached is safe even when
 * other sessions or the bridge daemon also tick a checkpoint. We never await
 * it — the stop must not block on the checkpoint.
 */
async function fireWalCheckpoint(): Promise<void> {
  try {
    const python = await resolveBridgePython();
    // wal_checkpointer.py deploys alongside the bridge in DOS/Tools/.
    const checkpointer = join(dirname(BRIDGE_PATH), "wal_checkpointer.py");
    if (!existsSync(checkpointer)) return;
    const child = spawn(python, [checkpointer], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    // Never block stop on a checkpoint failure.
  }
}

function appendAuditLog(payload: Record<string, unknown>): void {
  try {
    const auditPath = dosPath("MEMORY", "STATE", "stop-saves.jsonl");
    mkdirSync(dirname(auditPath), { recursive: true });
    appendFileSync(auditPath, JSON.stringify({ ts: new Date().toISOString(), ...payload }) + "\n");
  } catch {
    // Audit log is advisory — never block.
  }
}

async function main() {
  const input = await readStdin();
  if (!input) {
    process.exit(0);
  }

  // No palace → can't save, exit cleanly
  if (!existsSync(join(MEMPALACE_DIR, "palace"))) {
    process.exit(0);
  }

  // Deterministic WAL checkpoint (PRD MDC-1). AWAIT the launch (not the
  // checkpoint itself — the child is detached + unref'd) BEFORE the
  // message-count gate so the KG WAL is bounded on EVERY Stop, including the
  // common low-message session that exits at the gate below. Awaiting only
  // the spawn() launch costs the resolveBridgePython() probe (cached after
  // first call); without the await, the synchronous `process.exit(0)` at the
  // gate races ahead of the async launch and the checkpoint never fires.
  await fireWalCheckpoint();

  // Acknowledge any SessionEnd checkpoint written by the mempalace library's
  // own stop hook. Fires BEFORE the message-count gate so the bridge event
  // lands in memory-events.jsonl on every Stop, not just high-message sessions.
  // Safe no-op when no ack file exists (returns {status:"quiet"}).
  // Fixes ISC-55: memories_filed_away had 0 direct fires because no call site
  // existed — methods were defined in mempalace-client.ts but never invoked.
  // Capture the ack result so a degraded/failed memories_filed_away is visible
  // — discarding it left the diagnostic intent (ISC-55) blind (MP-093/MP-094).
  // Non-blocking: only logs on failure, never throws or blocks the Stop.
  const filedAck = bridgeSync('memories_filed_away', {}, 3000);
  if (!filedAck.ok) {
    console.error('[MemPalaceStop] memories_filed_away failed:', filedAck.reason);
  }

  // Count messages and check threshold
  const messageCount = countHumanMessages(input.transcript_path);
  const lastSave = getLastSaveCount(input.session_id);
  const sinceLast = messageCount - lastSave;

  if (sinceLast < SAVE_INTERVAL) {
    // Not enough messages since last save — skip quietly
    process.exit(0);
  }

  const { wing: projectWing } = resolveProjectWingFromEnv();
  const wing = projectWing || "general";
  const prd = findActivePRDDigest();
  const git = captureGitContext();
  const content = buildDigestContent(input, messageCount, prd, git);

  // Synchronous drawer save — 8s budget
  const drawerResult = bridgeSync(
    "add_drawer",
    {
      content,
      wing,
      room: "stop-saves",
      metadata: {
        session_id: input.session_id || "unknown",
        saved_at: new Date().toISOString(),
        message_count: messageCount,
        transcript_path: input.transcript_path || null,
        prd_path: prd?.prd_path || null,
        git_head: git.head || null,
      },
    },
    8000,
  );

  let drawerId: string | null = null;
  if (drawerResult.ok) {
    const data = drawerResult.data as { id?: string; drawer_id?: string };
    drawerId = data.id || data.drawer_id || null;
  }

  // KG fact pointing to the drawer (best-effort, 5s budget)
  if (drawerId) {
    bridgeSync(
      "add_kg_fact",
      {
        subject: `session-${input.session_id || "unknown"}`,
        predicate: "stopped_with_digest",
        object: drawerId,
      },
      5000,
    );
  }

  appendAuditLog({
    session_id: input.session_id || "unknown",
    wing,
    drawer_id: drawerId,
    message_count: messageCount,
    since_last: sinceLast,
    prd_task: prd?.task || null,
    prd_phase: prd?.phase || null,
    prd_progress: prd?.progress || null,
    git_head: git.head || null,
    saved: drawerResult.ok,
    reason: drawerResult.ok ? "ok" : drawerResult.reason,
  });

  if (drawerResult.ok) {
    // Advance the save watermark ONLY after a durable save. Advancing it before
    // the save (the prior behavior) caused a lost-update: a failed save still
    // bumped the watermark, so the next Stop computed sinceLast from the higher
    // mark and never retried the failed window (MP-053). The re-entry guard is
    // preserved by the SAVE_INTERVAL gate above plus alreadySaved-style idempotency.
    updateLastSaveCount(input.session_id, messageCount);
    console.error(
      `[MemPalaceStop] Saved digest drawer ${drawerId ?? "(no-id)"} to ${wing}/stop-saves (${sinceLast} msgs since last) — stop continues`,
    );
  } else {
    console.error(
      `[MemPalaceStop] Save failed (${drawerResult.reason}) — stop continues anyway`,
    );
  }

  // ALWAYS allow stop — never block
  process.exit(0);
}

const _t = startTimer('MemPalaceStop');
process.on('exit', () => stopTimer(_t, 'Stop'));
main().catch((err) => {
  console.error("[MemPalaceStop] Fatal:", err);
  // Never block stop even on hook crash
  process.exit(0);
});
