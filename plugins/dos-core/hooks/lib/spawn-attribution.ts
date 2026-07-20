/**
 * spawn-attribution.ts — RFC-0125 Regime 1 (model-orchestrated) per-spawn attribution.
 *
 * Binds a subagent's originating PRD at SPAWN time (PreToolUse Agent/Task),
 * keyed by `tool_use_id`, so the matching PostToolUse return is attributed to
 * the PRD that actually spawned it — not a return-time session-global guess
 * that drifts when a later PRD becomes mtime-newest (RFC-0125 finding 2).
 *
 * One append-only JSONL of immutable facts per session (atomicAppendSync —
 * O_APPEND is kernel-atomic for these small lines, so concurrent spawns never
 * tear and there is no last-writer-wins mutable map):
 *   MEMORY/STATE/spawn-attribution/{session_id}.jsonl
 *   {"tool_use_id":"toolu_…","prd_slug":"…","ts":"…"}
 *
 * The two hooks that touch this file (SubagentSpawnAttribution writer,
 * SubagentReturnTally reader) share THIS module's resolver + parse logic so the
 * implementation is defined once.
 */

import {
  readFileSync, existsSync, readdirSync, statSync, openSync, readSync, closeSync,
} from 'node:fs';
import { join } from 'node:path';
import { getMemorySubdir, getAllMemorySubdirs } from './paths';

export interface SpawnFact {
  tool_use_id: string;
  prd_slug: string;
  ts: string;
}

/** Per-session spawn-map JSONL path. */
export function spawnMapPath(sessionId: string): string {
  return join(getMemorySubdir('STATE'), 'spawn-attribution', `${sessionId}.jsonl`);
}

/**
 * PURE: build a `tool_use_id -> prd_slug` map from JSONL lines. Append-only
 * facts mean a given tool_use_id appears once in practice; if it somehow
 * repeats, last line wins (harmless — same spawn). Empty/absent tool_use_id
 * lines are skipped so they never collide on one empty key (finding 10a).
 */
export function parseSpawnMap(lines: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const f = JSON.parse(line) as Partial<SpawnFact>;
      if (f.tool_use_id) m.set(f.tool_use_id, f.prd_slug ?? 'unknown');
    } catch { /* skip unparseable — fail open */ }
  }
  return m;
}

/** PURE: look up a spawn-attributed slug by tool_use_id. `null` = miss (no fact). */
export function lookupSpawnSlug(lines: string[], toolUseId: string): string | null {
  if (!toolUseId) return null;
  const slug = parseSpawnMap(lines).get(toolUseId);
  return slug ?? null;
}

/**
 * Read the per-session spawn-map lines (empty array if absent/unreadable).
 *
 * The writer (PreToolUse) and this reader (PostToolUse) are separate process
 * invocations. Each resolves getMemorySubdir('STATE') at call time, so if a
 * project-side MEMORY/STATE/ comes into existence BETWEEN the spawn and the
 * return (e.g. a /sentinel scan or first project write), the reader can
 * resolve project-side while the writer wrote global-side → silent miss that
 * degrades to the mtime guess (paths.ts:164-176). To close that race [hooks-011]
 * we first read the primary resolved path, then — only on miss — fall back to
 * the spawn-attribution file under EVERY STATE dir (project + global) so the
 * writer's choice is always found regardless of which root the reader picked.
 */
export function readSpawnMapLines(sessionId: string): string[] {
  try {
    const p = spawnMapPath(sessionId);
    if (existsSync(p)) return readFileSync(p, 'utf-8').split('\n');
  } catch { /* fall through to the cross-root scan */ }

  // Primary path missed — scan all STATE roots (project + global) for the
  // writer's file. First hit wins (one writer per session, so no ambiguity).
  try {
    for (const stateDir of getAllMemorySubdirs('STATE')) {
      const alt = join(stateDir, 'spawn-attribution', `${sessionId}.jsonl`);
      if (existsSync(alt)) return readFileSync(alt, 'utf-8').split('\n');
    }
  } catch { /* fail open */ }

  return [];
}

/**
 * Resolve the active PRD slug for this session — deterministic
 * `active-prd-{sessionId}.json` state file first; mtime-newest non-complete PRD
 * (across WORK/ and WORK/active/) as fallback; "unknown" if nothing resolves.
 *
 * MOVED verbatim from SubagentReturnTally.hook.ts (RFC-0125) so the spawn-hook
 * writer and the tally fallback share ONE implementation. Used at SPAWN time to
 * bind the originating PRD; binding at spawn (not return) is what fixes finding 2.
 */
export function resolveActivePrdSlug(sessionId: string): string {
  try {
    const stateFile = join(getMemorySubdir('STATE'), `active-prd-${sessionId}.json`);
    if (existsSync(stateFile)) {
      const p = JSON.parse(readFileSync(stateFile, 'utf-8')) as { prdSlug?: string };
      if (p.prdSlug) return p.prdSlug;
    }
  } catch { /* fall through */ }

  try {
    const workDir = getMemorySubdir('WORK');
    let best: string | null = null;
    let bestMtime = 0;
    for (const root of [workDir, join(workDir, 'active')]) {
      if (!existsSync(root)) continue;
      for (const name of readdirSync(root)) {
        const prd = join(root, name, 'PRD.md');
        let phase = '';
        let mtimeMs = 0;
        try {
          mtimeMs = statSync(prd).mtimeMs;
          // Frontmatter lives at offset 0 — a bounded head read avoids loading
          // every PRD body in full on this hot path.
          const fd = openSync(prd, 'r');
          try {
            const buf = Buffer.allocUnsafe(1024);
            const n = readSync(fd, buf, 0, 1024, 0);
            const fm = buf.toString('utf-8', 0, n).match(/^---\n([\s\S]*?)\n---/);
            // Optional-quote + case-insensitive so `phase: "done"` parses (H-052);
            // mirrors the CouncilUnanimousRedTeam readPrdFrontmatter fix.
            phase = fm?.[1]?.match(/^phase:\s*["']?([a-z_-]+)/mi)?.[1]?.toLowerCase() ?? '';
          } finally { closeSync(fd); }
        } catch { continue; }
        // Both 'complete' and 'done' are terminal in the live corpus (6 PRDs use
        // 'done') — a finished PRD must not win the mtime race for 'active' and
        // misattribute subagent returns / RedTeam-pending flags to a closed PRD (H-052).
        if (phase === 'complete' || phase === 'done') continue;
        if (mtimeMs > bestMtime) { bestMtime = mtimeMs; best = name; }
      }
    }
    if (best) return best;
  } catch { /* fall through */ }

  return 'unknown';
}
