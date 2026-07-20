/**
 * resolveKgDbPath — single source of truth for the MemPalace knowledge-graph db path.
 *
 * Used by BOTH the radiator (Tools/dos-memory-status.ts probeKg) and the G3 audit gate
 * (Tools/dos-memory-audit.ts), so the gate verifies the SAME resolver the radiator runs and
 * the two can never drift (the prior hand-mirrored copies were the G3 false-RED root cause).
 *
 * Lives in its own lib (not Tools/dos-memory-status.ts) so the read-only forensic audit does not
 * transitively load the 2226-line bridge runtime just to compute a path string, and not in the
 * auto-generated Lib/paths.ts shim (a regeneration would drop a hand-added function).
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expandPath, getDosDir } from './paths';

/**
 * Resolve the KG sqlite path the MemPalace bridge reads/writes, mirroring the Python bridge
 * boundary `_bridge_palace.py:70` → `os.environ.get("MEMPALACE_DIR", "~/.mempalace")`:
 *   - The default applies ONLY when MEMPALACE_DIR is ABSENT, so use `??` (not `||`) — an empty
 *     MEMPALACE_DIR="" is preserved, exactly as Python's os.environ.get returns "".
 *   - Bridge dir FIRST (the single read/write boundary), then the legacy getMemorySubdir
 *     dir-chain (project → cwd → ~/.claude) expanded to per-FILE existence checks so a populated
 *     legacy KG is found wherever it lives, not just under the first existing MEMORY/MEMPALACE dir.
 *   - CLAUDE_PROJECT_DIR is expandPath'd to match getMemorySubdir's own expansion.
 *   - process.cwd() is guarded: a deleted/unmounted cwd (temp dirs, removed worktrees) must not
 *     throw — the radiator's documented "never throw" invariant depends on it.
 * First existing db wins; when none exist, the canonical bridge location is reported as the
 * missing path so the operator is pointed at the right place.
 */
export function resolveKgDbPath(): string {
  const KG = 'knowledge_graph.sqlite3';
  const bridgeDir = process.env.MEMPALACE_DIR ?? join(homedir(), '.mempalace');

  let cwdCandidate: string | null = null;
  try {
    cwdCandidate = join(process.cwd(), 'MEMORY', 'MEMPALACE', KG);
  } catch {
    /* cwd deleted/unmounted — skip the cwd candidate rather than throw */
  }

  const candidates: Array<string | null> = [
    join(bridgeDir, KG),
    process.env.CLAUDE_PROJECT_DIR
      ? join(expandPath(process.env.CLAUDE_PROJECT_DIR), 'MEMORY', 'MEMPALACE', KG)
      : null,
    cwdCandidate,
    join(getDosDir(), 'MEMORY', 'MEMPALACE', KG),
  ];

  return (candidates.filter(Boolean) as string[]).find((p) => existsSync(p)) ?? join(bridgeDir, KG);
}
