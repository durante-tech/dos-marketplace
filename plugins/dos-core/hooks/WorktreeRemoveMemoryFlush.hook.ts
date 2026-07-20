#!/usr/bin/env bun
/**
 * WorktreeRemoveMemoryFlush.hook.ts — flush gitignored MEMORY out of a worktree
 * before it is torn down.
 *
 * Trigger: WorktreeRemove (fires BEFORE a worktree directory is removed).
 *
 * THE SEAM: a subagent working in a TEMPORARY worktree writes PRDs / reflections
 * to gitignored MEMORY/{WORK,LEARNING,RESEARCH,ARTIFACTS,SECURITY,STATE}. When
 * the worktree is removed, those uncommitted/untracked files are discarded
 * SILENTLY (Claude Code docs: "Removing deletes the worktree directory…
 * discarding any uncommitted changes, untracked files, and commits").
 * WorktreeMemoryWriteGuard.hook.ts only WARNS about this at write time; this
 * hook MECHANIZES the recovery: it copies the at-risk files back to the main
 * checkout's MEMORY before removal actually happens.
 *
 * CONSERVATIVE v1 policy:
 *   - Only the six gitignored, project-eligible subdirs listed above are flushed
 *     (ARCHIVE/CANONICAL are git-tracked → survive on their own; MEMPALACE lives
 *     outside the worktree at ~/Durante/MEMORY/MEMPALACE per RFC-0100 → not here).
 *   - COPY-NEW-ONLY: a source file is copied to the main checkout ONLY when no
 *     file exists at the same relative path there. Existing destination files are
 *     NEVER overwritten (COPYFILE_EXCL + existsSync guard) — the main checkout is
 *     authoritative; the worktree copy is at most additive.
 *   - Append-only *.jsonl files are SKIPPED in v1. A correct merge would need a
 *     line-level union (dedup by content/idempotency key); blind copy-new-only
 *     would drop the worktree's appended lines when the file already exists in
 *     main, and blind append would double-count. Deferred to a v2 JSONL merger.
 *   - Symlinks are skipped (v1 conservative).
 *
 * SAFETY: strict fail-open. Any error (bad payload, missing path, fs error) logs
 * a line to stderr and exits 0 — a flush hook must never disrupt worktree
 * teardown. CRITICAL: it NEVER exits 2. On WorktreeRemove a non-zero/exit-2
 * ABORTS the worktree removal (platform verified v2.1.198), so exiting 2 here
 * would strand the very worktree we are draining — every code path returns
 * exit 0. A summary line is always logged; a telemetry line is appended
 * best-effort to MEMORY/STATE/worktree-memory-flush.jsonl.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  appendFileSync,
  constants as fsConstants,
} from "node:fs";
import { join, relative, dirname } from "node:path";
import { getMemoryDir, loadProjectEnv } from "./lib/paths";
import { readHookInput } from "./lib/hook-io";

/**
 * Gitignored, project-eligible MEMORY subtrees whose worktree-local writes would
 * be lost on teardown. Deliberately excludes ARCHIVE + CANONICAL (git-tracked)
 * and MEMPALACE (lives outside the worktree).
 */
export const FLUSH_SUBDIRS = [
  "WORK",
  "LEARNING",
  "RESEARCH",
  "ARTIFACTS",
  "SECURITY",
  "STATE",
] as const;

/**
 * Resolve where flushed MEMORY belongs. Readers resolve MEMORY project-first
 * (getMemorySubdir: $CLAUDE_PROJECT_DIR/MEMORY → cwd/MEMORY → ~/.claude/MEMORY),
 * so flushing to the global tree strands recovered files where no reader looks.
 * Preference order:
 *   1. The main checkout the worktree was carved from (strip /.claude/worktrees/<name>
 *      or /worktrees/<name>) when it carries a MEMORY tree — the files' true home.
 *   2. $CLAUDE_PROJECT_DIR/MEMORY when set and present.
 *   3. Global getMemoryDir() as the last resort.
 */
export function resolveFlushDestination(worktreeRoot: string): string {
  const markers = ["/.claude/worktrees/", "/worktrees/"];
  for (const marker of markers) {
    const idx = worktreeRoot.lastIndexOf(marker);
    if (idx > 0) {
      const mainCheckout = worktreeRoot.slice(0, idx);
      const candidate = join(mainCheckout, "MEMORY");
      if (existsSync(candidate)) return candidate;
    }
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (projectDir) {
    const candidate = join(projectDir, "MEMORY");
    if (existsSync(candidate)) return candidate;
  }
  return getMemoryDir();
}

export interface FlushResult {
  worktreeRoot: string;
  mainMemoryDir: string;
  copied: string[]; // relative paths (under MEMORY/) copied into the main checkout
  skippedExisting: string[]; // dest already existed — never overwritten
  skippedJsonl: string[]; // append-only files deferred in v1
  errors: string[];
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(full));
    else if (e.isFile()) out.push(full);
    // symlinks and other node types are skipped (v1 conservative)
  }
  return out;
}

/**
 * Pure-ish core: copy new-only files from a worktree's MEMORY subtrees into a
 * destination MEMORY dir. Takes explicit source + destination so it is fully
 * testable with temp dirs. NEVER overwrites; NEVER merges *.jsonl.
 */
export function flushWorktreeMemory(
  worktreeRoot: string,
  mainMemoryDir: string,
  subdirs: readonly string[] = FLUSH_SUBDIRS,
): FlushResult {
  const result: FlushResult = {
    worktreeRoot,
    mainMemoryDir,
    copied: [],
    skippedExisting: [],
    skippedJsonl: [],
    errors: [],
  };

  const srcMemoryRoot = join(worktreeRoot, "MEMORY");
  // Identity guard — never flush a directory onto itself.
  if (srcMemoryRoot === mainMemoryDir) return result;

  for (const subdir of subdirs) {
    const srcDir = join(srcMemoryRoot, subdir);
    if (!existsSync(srcDir)) continue;

    for (const file of walkFiles(srcDir)) {
      const rel = relative(srcMemoryRoot, file); // e.g. "WORK/x/PRD.md"

      if (file.endsWith(".jsonl")) {
        result.skippedJsonl.push(rel);
        continue;
      }

      const dest = join(mainMemoryDir, rel);
      if (existsSync(dest)) {
        result.skippedExisting.push(rel);
        continue;
      }

      try {
        mkdirSync(dirname(dest), { recursive: true });
        // COPYFILE_EXCL: hard-fail (EEXIST) rather than overwrite if a racing
        // writer created the dest between the existsSync check and the copy.
        copyFileSync(file, dest, fsConstants.COPYFILE_EXCL);
        result.copied.push(rel);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "EEXIST") {
          result.skippedExisting.push(rel);
        } else {
          result.errors.push(`${rel}: ${(err as Error)?.message ?? String(err)}`);
        }
      }
    }
  }

  return result;
}

/**
 * Extract the worktree root from the WorktreeRemove payload.
 *
 * SCHEMA AMBIGUITY: the official digest does not name the WorktreeRemove
 * path field. We probe the plausible field names in priority order. We do
 * NOT fall back to `cwd` — during teardown cwd may be the main checkout, and
 * flushing the wrong tree is worse than a no-op. If none resolve, the hook
 * no-ops (fail-open).
 */
export function extractWorktreePath(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const candidates = [
    o.worktree_path,
    o.worktreePath,
    o.worktree_root,
    o.worktreeRoot,
    o.path,
    o.worktree,
    o.removed_path,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return null;
}

function recordFlush(result: FlushResult): void {
  try {
    const stateDir = join(result.mainMemoryDir, "STATE");
    mkdirSync(stateDir, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      event: "worktree_memory_flush",
      worktree_root: result.worktreeRoot,
      main_memory_dir: result.mainMemoryDir,
      copied: result.copied.length,
      skipped_existing: result.skippedExisting.length,
      skipped_jsonl: result.skippedJsonl.length,
      errors: result.errors.length,
      copied_paths: result.copied.slice(0, 50),
    };
    appendFileSync(join(stateDir, "worktree-memory-flush.jsonl"), JSON.stringify(entry) + "\n");
  } catch {
    // telemetry is best-effort; never fail the flush over it
  }
}

if (import.meta.main) {
  (async () => {
    try {
      loadProjectEnv();
      const input = await readHookInput();
      const worktreeRoot = extractWorktreePath(input);

      if (!worktreeRoot || !existsSync(worktreeRoot)) {
        // Distinguish "empty/no payload" (legitimately nothing) from "a real
        // WorktreeRemove event fired but its path field wasn't among our probed
        // candidates" — the latter SILENTLY discards the worktree's gitignored
        // MEMORY writes (the exact loss this hook exists to prevent). The schema
        // is undocumented, so instead of guessing more field names, log the ACTUAL
        // payload keys loudly on a non-empty event: that surfaces the real field
        // name for a targeted extractWorktreePath fix (H-064, observability).
        const payloadKeys =
          input && typeof input === "object" ? Object.keys(input as object) : [];
        if (!worktreeRoot && payloadKeys.length > 0) {
          console.error(
            `[WorktreeRemoveMemoryFlush] SCHEMA MISS: WorktreeRemove event received but no worktree ` +
              `path resolved from any probed field — the worktree's MEMORY writes may be LOST. ` +
              `Actual payload keys: [${payloadKeys.join(", ")}]. Add the real field to extractWorktreePath.`,
          );
        } else {
          console.error(
            "[WorktreeRemoveMemoryFlush] no resolvable worktree path in event — nothing to flush",
          );
        }
        process.exit(0);
      }

      const mainMemoryDir = resolveFlushDestination(worktreeRoot);
      const result = flushWorktreeMemory(worktreeRoot, mainMemoryDir);

      console.error(
        `[WorktreeRemoveMemoryFlush] copied=${result.copied.length} ` +
          `skippedExisting=${result.skippedExisting.length} ` +
          `skippedJsonl=${result.skippedJsonl.length} ` +
          `errors=${result.errors.length} (${worktreeRoot} → ${mainMemoryDir})`,
      );
      recordFlush(result);
    } catch (err) {
      console.error("[WorktreeRemoveMemoryFlush] internal error — failing open:", err);
    }
    process.exit(0);
  })();
}
