#!/usr/bin/env bun
/**
 * MemPalacePreCompact.daemon.ts — Async save worker for PreCompact hook.
 *
 * PURPOSE:
 * Runs the heavy add_drawer + add_kg_fact + audit log calls OFF the PreCompact
 * critical path. Spawned detached by MemPalacePreCompact.hook.ts which then
 * exits immediately with {continue: true}, keeping the hook under 500ms.
 *
 * RATIONALE (M2, mempalace-intel-enhancement DAG, 2026-05-04):
 * The original PreCompact rewrite (commit 9f4d609) was fully synchronous:
 * 8s + 5s bridge calls blocked compaction. The daemon split preserves the
 * same durability guarantee (digest lands in MemPalace before context is
 * consumed by the next session) while keeping the hook itself below the
 * 500ms observer budget.
 *
 * IDEMPOTENCY:
 * Before saving, checks precompact-saves.jsonl for an existing entry with
 * this session_id. If found, skips (duplicate hook fire, noop). The drawer
 * creation is not itself idempotent (creates a new drawer each time), so
 * this guard prevents duplicate drawers on re-run.
 *
 * INPUT:
 * - env DOS_PRECOMPACT_INPUT_FILE: tmp JSON file written by the wrapper with
 *   { session_id, wing, transcript_path, timestamp }
 *
 * OUTPUT:
 * - stderr: status messages
 * - Side effects:
 *   - add_drawer → MemPalace wing/<slug>/precompact-saves
 *   - add_kg_fact → session-{id} compacted_with_digest <drawer-id>
 *   - precompact-saves.jsonl audit entry
 * - Cleans up DOS_PRECOMPACT_INPUT_FILE on exit
 * - exit(0): always
 */

import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, appendFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { parseFrontmatter, getScalarField, countCriteria } from "./lib/prd-utils";
import { PRD_PHASE_COMPLETE } from "./lib/tab-constants";
import { dosPath, getWorkDir } from "./lib/paths";
import { startTimer, stopTimer } from './lib/hook-io';
import { bridgeSync } from './lib/mempalace';

const MEMPALACE_DIR = process.env.MEMPALACE_DIR || join(homedir(), ".mempalace");

interface DaemonInput {
  session_id: string;
  wing: string;
  transcript_path: string;
  timestamp: string;
}

function readDaemonInput(): DaemonInput | null {
  const inputFile = process.env.DOS_PRECOMPACT_INPUT_FILE;
  if (!inputFile || !existsSync(inputFile)) {
    console.error("[MemPalacePreCompact.daemon] No DOS_PRECOMPACT_INPUT_FILE — exiting");
    return null;
  }
  try {
    return JSON.parse(readFileSync(inputFile, "utf-8")) as DaemonInput;
  } catch (err) {
    console.error(`[MemPalacePreCompact.daemon] Failed to read input file: ${err}`);
    return null;
  }
}

function alreadySaved(sessionId: string): boolean {
  try {
    const auditPath = dosPath("MEMORY", "STATE", "precompact-saves.jsonl");
    if (!existsSync(auditPath)) return false;
    const lines = readFileSync(auditPath, "utf-8").trim().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as { session_id?: string; saved?: boolean };
        if (entry.session_id === sessionId && entry.saved === true) return true;
      } catch { /* skip malformed */ }
    }
  } catch { /* file unreadable — assume not saved */ }
  return false;
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
  // MP-TS-01: project-first resolution (getWorkDir → getMemorySubdir('WORK'))
  // to match the MP-056 sibling fix. The old global-only dosPath('MEMORY','WORK')
  // picked the wrong project's WORK set when compaction fired in a non-Durante
  // session (cross-project leak + a lost "Active task" digest).
  const workDir = getWorkDir();
  if (!existsSync(workDir)) return null;

  let bestPath: string | null = null;
  let bestMtime = 0;

  // Candidate PRDs live at two depths after the WORK active/archived migration
  // (CLAUDE.md "active/archived structural split"):
  //   - legacy flat:  MEMORY/WORK/{slug}/PRD.md            (one level)
  //   - active bucket: MEMORY/WORK/active/{slug}/PRD.md     (two levels)
  //   - archived:      MEMORY/WORK/archived/{slug}/PRD.md   (two levels)
  // The original one-level scan made the newest (hot) PRDs in active/ — the
  // entire point of the resume digest — structurally invisible (MP-015).
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
        if (s.mtimeMs <= bestMtime) continue;
        // Select the newest ACTIVE PRD, not the newest overall. The terminal-phase
        // check used to run AFTER this loop, on whatever PRD had the highest mtime —
        // so a PRD you just closed shadowed an older still-active one, and the
        // pre-compaction digest returned null and silently lost that task's Active
        // task / Remaining criteria / Decisions. Skip terminal PRDs while selecting
        // so best = newest active, regardless of readdir order. (H-083/084 shape, H-117.)
        const head = readFileSync(prdPath, "utf-8").slice(0, 600);
        const ph = head.match(/^phase:\s*"?(\w+)"?/m)?.[1]?.toLowerCase();
        if (ph === PRD_PHASE_COMPLETE || ph === "done") continue;
        bestMtime = s.mtimeMs;
        bestPath = prdPath;
      } catch {}
    }
  }

  if (!bestPath) return null;

  try {
    const content = readFileSync(bestPath, "utf-8");
    const fm = parseFrontmatter(content);
    if (!fm) return null;
    // bestPath is already the newest non-terminal PRD (filtered in the selection
    // loop above), so this is a cheap re-confirm on the fully-parsed frontmatter
    // rather than the head slice — kept as defense, not the primary gate (H-076b).
    const phase = getScalarField(fm, "phase") ?? "unknown";
    if (phase === PRD_PHASE_COMPLETE || phase === "done") return null;

    const taskName = getScalarField(fm, "task") || getScalarField(fm, "slug") || "unknown";
    const { checked, total } = countCriteria(content);

    // `\Z` is a literal 'Z' in JS regex, not an end anchor — the capture returned
    // NULL when '## Criteria' was the PRD's last section, silently dropping it from
    // the pre-compaction digest. Use the JS end-of-string anchor (H-076, H-075 class).
    const criteriaMatch = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|(?![\s\S]))/);
    const unchecked: string[] = [];
    if (criteriaMatch) {
      for (const line of criteriaMatch[1].split("\n")) {
        if (line.startsWith("- [ ]")) {
          unchecked.push(line.replace(/^- \[ \]\s*/, "").trim());
        }
      }
    }

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
  input: DaemonInput,
  prd: PRDDigest | null,
  git: { head: string; recent: string },
): string {
  const lines: string[] = [
    `# PreCompact Digest — session ${input.session_id || "unknown"}`,
    `Saved: ${new Date().toISOString()}`,
    `Triggered at: ${input.timestamp}`,
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

function appendAuditLog(payload: Record<string, unknown>): void {
  try {
    const auditPath = dosPath("MEMORY", "STATE", "precompact-saves.jsonl");
    mkdirSync(dirname(auditPath), { recursive: true });
    appendFileSync(auditPath, JSON.stringify({ ts: new Date().toISOString(), ...payload }) + "\n");
  } catch {
    // Audit log is advisory — never block.
  }
}

async function main(): Promise<void> {
  const input = readDaemonInput();
  if (!input) return;

  // No palace — can't save, exit cleanly
  if (!existsSync(join(MEMPALACE_DIR, "palace"))) {
    console.error("[MemPalacePreCompact.daemon] No palace found — exiting");
    return;
  }

  // Idempotency guard: skip if already saved for this session
  if (alreadySaved(input.session_id)) {
    console.error(`[MemPalacePreCompact.daemon] Already saved for session ${input.session_id.slice(0, 8)} — skipping`);
    return;
  }

  const prd = findActivePRDDigest();
  const git = captureGitContext();
  const content = buildDigestContent(input, prd, git);

  // Synchronous drawer save — 8s budget
  const drawerResult = bridgeSync(
    "add_drawer",
    {
      content,
      wing: input.wing,
      room: "precompact-saves",
      // W6 B1 provenance fix: the bridge reads source_file/added_by ONLY from
      // top-level add_drawer args (_bridge_drawers.add_drawer); the nested
      // `metadata` below is NOT consulted for provenance, so these drawers were
      // landing with added_by="dos-hook" (default) and source_file="" — the 64
      // empty-provenance precompact drawers in the W6 census. Populate both at
      // the top level.
      source_file: prd?.prd_path || input.transcript_path || "",
      added_by: "mechanical:precompact-save",
      metadata: {
        session_id: input.session_id || "unknown",
        saved_at: new Date().toISOString(),
        triggered_at: input.timestamp,
        transcript_path: input.transcript_path || null,
        prd_path: prd?.prd_path || null,
        git_head: git.head || null,
        via: "daemon",
      },
    },
    8000,
  );

  let drawerId: string | null = null;
  if (drawerResult.ok) {
    const data = drawerResult.data as { id?: string; drawer_id?: string };
    drawerId = data.id || data.drawer_id || null;
  }

  // KG fact pointing to the drawer (best-effort, 5s budget). Capture the
  // result so a dropped KG link (timeout / predicate-gate / closed-db race) is
  // auditable — the digest's own Resume hint tells the next session to
  // kg_query subject=session-{id}, so a silently-lost fact makes that query
  // return empty with no signal (MP-049). Non-fatal: never fail the save.
  let kgLinked: boolean | null = null;
  let kgReason: string | undefined;
  if (drawerId) {
    const kgResult = bridgeSync(
      "add_kg_fact",
      {
        subject: `session-${input.session_id || "unknown"}`,
        predicate: "compacted_with_digest",
        object: drawerId,
      },
      5000,
    );
    kgLinked = kgResult.ok;
    kgReason = kgResult.ok ? undefined : kgResult.reason;
  }

  appendAuditLog({
    session_id: input.session_id || "unknown",
    wing: input.wing,
    drawer_id: drawerId,
    prd_task: prd?.task || null,
    prd_phase: prd?.phase || null,
    prd_progress: prd?.progress || null,
    git_head: git.head || null,
    saved: drawerResult.ok,
    kg_linked: kgLinked,
    kg_reason: kgReason ?? null,
    via: "daemon",
    reason: drawerResult.ok ? "ok" : drawerResult.reason,
  });

  if (drawerResult.ok) {
    console.error(
      `[MemPalacePreCompact.daemon] Saved digest drawer ${drawerId ?? "(no-id)"} to ${input.wing}/precompact-saves`,
    );
  } else {
    console.error(
      `[MemPalacePreCompact.daemon] Save failed (${drawerResult.reason})`,
    );
  }
}

const _t = startTimer('MemPalacePreCompact.daemon');
process.on('exit', () => stopTimer(_t, 'PreCompact.daemon'));

main()
  .catch((err) => { console.error("[MemPalacePreCompact.daemon] Fatal:", err); })
  .finally(() => {
    const inputFile = process.env.DOS_PRECOMPACT_INPUT_FILE;
    if (inputFile) {
      try { unlinkSync(inputFile); } catch { /* best-effort */ }
    }
    process.exit(0);
  });
