/**
 * UpdateCounts.ts - Update settings.json with fresh system counts
 *
 * PURPOSE:
 * Updates the counts section of settings.json at the end of each session.
 * Banner and statusline then read from settings.json (instant, no execution).
 *
 * ARCHITECTURE:
 * SessionEnd hook → UpdateCounts → settings.json
 * Session start → Banner reads settings.json (instant)
 * Session start → Statusline reads settings.json (instant)
 *
 * This design ensures:
 * - No spawning/execution at session start
 * - Counts are always available (no waiting)
 * - Single source of truth in settings.json
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { getDosDir, getSettingsPath, getMemorySubdir, dosPath } from '../lib/paths';


interface Counts {
  skills: number;
  topLevelSkills: number;
  workflows: number;
  hooks: number;
  hookLibraries: number;
  agents: number;
  autonomousAgents: number;
  packs: number;
  traitCombinations: number;
  signals: number;
  files: number;
  work: number;
  sessions: number;
  research: number;
  ratings: number;
  updatedAt: string;
}

/**
 * Count files matching criteria recursively
 */
function countFilesRecursive(dir: string, extension?: string): number {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFilesRecursive(fullPath, extension);
      } else if (entry.isFile()) {
        if (!extension || entry.name.endsWith(extension)) {
          count++;
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return count;
}

/**
 * Count .md files inside any Workflows directory
 */
function countWorkflowFiles(dir: string): number {
  let count = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === 'workflows') {
          count += countFilesRecursive(fullPath, '.md');
        } else {
          count += countWorkflowFiles(fullPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return count;
}

/**
 * Count skills recursively (any directory containing a SKILL.md file).
 * Counts nested sub-skills like Media/Art, Media/Speech, Utilities/Browser, etc.
 */
function countSkills(dosDir: string): number {
  function countRecursive(dir: string): number {
    let count = 0;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'Workflows' || entry.name === 'Tools' || entry.name === 'Lib') continue;
        const fullPath = join(dir, entry.name);
        const isDir = entry.isDirectory() ||
          (entry.isSymbolicLink() && statSync(fullPath).isDirectory());
        if (isDir) {
          if (existsSync(join(fullPath, 'SKILL.md'))) {
            count++;
          }
          count += countRecursive(fullPath);
        }
      }
    } catch {}
    return count;
  }
  return countRecursive(join(dosDir, 'skills'));
}

/**
 * Count top-level skills (directories at depth 1 in skills/ with SKILL.md).
 * Unlike countSkills which includes nested sub-skills, this counts only
 * the top-level directories — what users see as "skill packs."
 */
function countTopLevelSkills(dosDir: string): number {
  let count = 0;
  const skillsDir = join(dosDir, 'skills');
  try {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (existsSync(join(skillsDir, entry.name, 'SKILL.md'))) {
        count++;
      }
    }
  } catch {}
  return count;
}

/**
 * Count hooks (.hook.ts files in hooks/ at depth 1)
 */
function countHooks(dosDir: string): number {
  let count = 0;
  const hooksDir = join(dosDir, 'hooks');
  try {
    for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.hook.ts')) {
        count++;
      }
    }
  } catch {}
  return count;
}

/**
 * Count hook shared libraries (.ts files in hooks/lib/)
 */
function countHookLibraries(dosDir: string): number {
  let count = 0;
  const libDir = join(dosDir, 'hooks', 'lib');
  try {
    for (const entry of readdirSync(libDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        count++;
      }
    }
  } catch {}
  return count;
}

/**
 * Count spawnable subagents — *.md files in ~/.claude/agents/.
 * These are the @-mentionable agents Claude Code reads at startup
 * (Algorithm, Architect, Engineer, Plan, Explore, Cockburn, Fowler, …).
 *
 * Historical note: this previously counted *Context.md in skills/agents/,
 * a legacy concept that no longer exists on disk — banner showed 0 forever.
 */
function countAgents(dosDir: string): number {
  let count = 0;
  const agentsDir = join(dosDir, 'agents');
  try {
    for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        count++;
      }
    }
  } catch {}
  return count;
}

/**
 * Resolve the DOS project root — the canonical "DOS author repo".
 *
 * Marker triple: a dir is the DOS root iff it has `.git` AND `Packs/` AND
 * `Releases/`. The third marker disambiguates from the active submodule
 * (Releases/v{X}/.claude), which itself has `.git` (gitlink file) and a
 * (tiny) `Packs/` of its own — `Releases/` exists only at the true root.
 *
 * Resolution strategies (silent; first match wins):
 *   1. CLAUDE_PROJECT_DIR if it satisfies the marker triple
 *   2. Walk up from cwd
 *   3. Walk up from __dirname (this handler's resolved location) — under
 *      maintainer symlink mode (~/.claude → Releases/v{X}/.claude), this
 *      traverses the symlink target and lands on the parent DOS repo even
 *      when the session was launched from outside it (e.g. `dos -l` from ~).
 *
 * Returns null on operator machines with no DOS-author repo on disk.
 * Bypasses resolveProjectRoot() because its cwd-fallback console.warn is
 * noise for this probe — we want a silent boolean "is the DOS repo here?".
 */
function isDosRoot(dir: string): boolean {
  try {
    return existsSync(join(dir, '.git'))
        && existsSync(join(dir, 'Packs'))
        && existsSync(join(dir, 'Releases'));
  } catch { return false; }
}

function getDosProjectRoot(): string | null {
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir && isDosRoot(envDir)) return envDir;

  for (const start of [process.cwd(), __dirname]) {
    try {
      let current = start;
      for (let i = 0; i < 12; i++) {
        if (isDosRoot(current)) return current;
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
      }
    } catch {}
  }

  return null;
}

/**
 * Count autonomous agent packs (dirs in Packs/agents/ excluding _runtime and src).
 *
 * When getDosProjectRoot() returns null (session opened outside the DOS repo,
 * CLAUDE_PROJECT_DIR unset and .git walk-up doesn't land on a Packs/-bearing dir),
 * we PRESERVE the prior count instead of silently zeroing it. Logs a warning so
 * the regression is observable in hook-timing.
 */
function countAutonomousAgents(prior: number): number {
  const root = getDosProjectRoot();
  if (!root) {
    console.error(`[UpdateCounts] WARN: getDosProjectRoot() returned null — preserving prior autonomousAgents=${prior}`);
    return prior;
  }
  let count = 0;
  // Lowercase 'agents' — the real directory name. A capital 'A' resolved only by
  // accident on macOS's case-insensitive APFS; on Linux/CI readdirSync threw ENOENT,
  // the empty catch below swallowed it, and this returned 0 while the doc comment
  // above promised to preserve the prior count. (Forge H-106, wrong-case class.)
  const packsAgentsDir = join(root, 'Packs', 'agents');
  try {
    for (const entry of readdirSync(packsAgentsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'src') {
        count++;
      }
    }
  } catch {}
  return count;
}

/**
 * Count distributable packs (dirs in Packs/ excluding Agents).
 * Same null-root preservation as countAutonomousAgents — last-known-good wins
 * over silent 0.
 */
function countPacks(prior: number): number {
  const root = getDosProjectRoot();
  if (!root) {
    console.error(`[UpdateCounts] WARN: getDosProjectRoot() returned null — preserving prior packs=${prior}`);
    return prior;
  }
  let count = 0;
  const packsDir = join(root, 'Packs');
  try {
    for (const entry of readdirSync(packsDir, { withFileTypes: true })) {
      // 'agents' is the agent-pack DOMAIN, not a pack — exclude it. The literal was
      // 'Agents', which never matched the real lowercase dir, so the agents domain was
      // counted as a pack and the banner over-reported by one on EVERY platform, not
      // just case-sensitive ones. (Forge H-105.)
      if (entry.isDirectory() && entry.name !== 'agents') {
        count++;
      }
    }
  } catch {}
  return count;
}

/**
 * Count trait combinations from Traits.yaml dimensions
 */
function countTraitCombinations(dosDir: string): number {
  // Lowercase 'agents' — same wrong-case class (Forge H-108, found by the mechanized
  // sweep after H-105/H-106 were reported by hand).
  const traitsPath = join(dosDir, 'skills', 'agents', 'Data', 'Traits.yaml');
  try {
    const content = readFileSync(traitsPath, 'utf-8');
    // Count entries under each dimension by counting indented name: lines after dimension headers
    let expertise = 0, personality = 0, approach = 0;
    let currentSection = '';
    for (const line of content.split('\n')) {
      if (line.startsWith('expertise:')) currentSection = 'expertise';
      else if (line.startsWith('personality:')) currentSection = 'personality';
      else if (line.startsWith('approach:')) currentSection = 'approach';
      else if (line.startsWith('voice_mappings:') || line.startsWith('examples:')) currentSection = '';
      else if (currentSection && /^  \w+:$/.test(line)) {
        if (currentSection === 'expertise') expertise++;
        else if (currentSection === 'personality') personality++;
        else if (currentSection === 'approach') approach++;
      }
    }
    return expertise * personality * approach;
  } catch {
    return 0;
  }
}

/**
 * Count non-empty lines in a JSONL file (signals = rating entries)
 */
function countRatingsLines(filePath: string): number {
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return 0;
    return readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim()).length;
  } catch {
    return 0;
  }
}

/**
 * Count immediate subdirectories (depth 1)
 */
function countSubdirs(dir: string): number {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

/**
 * Get all counts. `priorCounts` is the existing settings.json `counts` object,
 * threaded into root-dependent counters so they can preserve last-known-good
 * when getDosProjectRoot() can't resolve.
 */
export function getCounts(dosDir: string, priorCounts: Partial<Counts>): Counts {
  const learningDir = getMemorySubdir('LEARNING');
  const researchDir = getMemorySubdir('RESEARCH');
  const ratingsPath = join(learningDir, 'SIGNALS', 'ratings.jsonl');
  return {
    skills: countSkills(dosDir),
    topLevelSkills: countTopLevelSkills(dosDir),
    workflows: countWorkflowFiles(join(dosDir, 'skills')),
    hooks: countHooks(dosDir),
    hookLibraries: countHookLibraries(dosDir),
    agents: countAgents(dosDir),
    autonomousAgents: countAutonomousAgents(priorCounts.autonomousAgents ?? 0),
    packs: countPacks(priorCounts.packs ?? 0),
    traitCombinations: countTraitCombinations(dosDir),
    signals: countFilesRecursive(learningDir, '.md'),
    files: countFilesRecursive(join(dosDir, 'DOS/USER')),
    work: countSubdirs(getMemorySubdir('WORK')),
    sessions: countFilesRecursive(join(dosDir, 'MEMORY'), '.jsonl'),
    research: countFilesRecursive(researchDir, '.md') +
              countFilesRecursive(researchDir, '.json'),
    ratings: countRatingsLines(ratingsPath),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Refresh usage cache from Anthropic OAuth API (+ optional admin cost report).
 * Slow (~3s, up to ~8s with an admin key). As of the v0.0.20 lifecycle refactor
 * this runs in the DETACHED background copy of UpdateCounts.hook.ts so the
 * SessionEnd critical path never blocks on it; the status line reads the cached
 * JSON. Exported for that wrapper; also still invoked inline by
 * handleUpdateCounts() for the standalone-seed path.
 */
export async function refreshUsageCache(): Promise<void> {
  const usageCachePath = dosPath('MEMORY', 'STATE', 'usage-cache.json');

  try {
    // Extract OAuth token — macOS Keychain or Linux credentials file
    let credJson: string;
    if (process.platform === 'darwin') {
      credJson = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
        { encoding: 'utf-8', timeout: 3000 }
      ).trim();
    } else {
      const credPath = join(process.env.HOME || '', '.claude', '.credentials.json');
      credJson = readFileSync(credPath, 'utf-8').trim();
    }

    const parsed = JSON.parse(credJson);
    const token = parsed?.claudeAiOauth?.accessToken;
    if (!token) return;

    const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) return;
    const data = await resp.json() as Record<string, unknown>;
    if (!data?.five_hour) return;

    // Fetch API workspace cost if admin key is available
    const adminKey = process.env.ANTHROPIC_ADMIN_API_KEY;
    if (adminKey) {
      try {
        const now = new Date();
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00Z`;
        const costResp = await fetch(
          `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${startOfMonth}`,
          {
            headers: {
              'x-api-key': adminKey,
              'anthropic-version': '2023-06-01',
            },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (costResp.ok) {
          const costData = await costResp.json() as any;
          // Sum all daily cost entries (amount is cents as decimal string)
          let totalCostCents = 0;
          if (Array.isArray(costData?.data)) {
            for (const day of costData.data) {
              if (Array.isArray(day?.results)) {
                for (const entry of day.results) {
                  totalCostCents += parseFloat(entry.amount || '0');
                }
              }
            }
          }
          (data as any).workspace_cost = {
            month_used_cents: Math.round(totalCostCents),
            updated_at: new Date().toISOString(),
          };
          console.error(`[UpdateCounts] Workspace cost: $${(totalCostCents / 100).toFixed(2)} this month`);
        }
      } catch {
        // Non-fatal — admin API unavailable
      }
    }

    writeFileSync(usageCachePath, JSON.stringify(data, null, 2) + '\n');
    console.error(`[UpdateCounts] Usage cache refreshed: 5H=${(data.five_hour as any)?.utilization}% 7D=${(data.seven_day as any)?.utilization}%`);
  } catch {
    // Non-fatal — status line falls back to stale cache
  }
}

/**
 * Synchronous counts refresh — no async, no network, no API calls.
 *
 * Reads existing settings.json, recomputes counts (preserving prior values
 * for root-dependent counters when the DOS project root can't resolve),
 * writes settings.json back. Returns the fresh counts so callers can use
 * them inline without re-reading the file.
 *
 * Called by:
 *   - SessionEnd hook (via handleUpdateCounts which also runs the OAuth fetch)
 *   - Banner data loader (banner/data.ts) — invoked synchronously at render
 *     so the banner shows current numbers instead of last-SessionEnd snapshot
 *
 * Cost: ~5–30 ms depending on filesystem (recursive directory walks).
 * Silent-fail: any error returns null and leaves settings.json untouched.
 */
export function refreshCountsSync(): Counts | null {
  try {
    const dosDir = getDosDir();
    const settingsPath = getSettingsPath();
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const priorCounts: Partial<Counts> = settings.counts || {};

    const counts = getCounts(dosDir, priorCounts);
    settings.counts = counts;

    try {
      const claudeMd = readFileSync(join(dosDir, 'CLAUDE.md'), 'utf-8');
      const algoMatch = claudeMd.match(/Algorithm\/v([\d.]+)\.md/);
      if (algoMatch) {
        settings.dos = settings.dos || {};
        settings.dos.algorithmVersion = algoMatch[1];
      }
    } catch {}

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    return counts;
  } catch {
    return null;
  }
}

/**
 * Handler called by UpdateCounts.hook.ts (SessionEnd).
 * Runs the sync counts refresh in parallel with the async OAuth usage fetch.
 */
export async function handleUpdateCounts(): Promise<void> {
  try {
    const [counts] = await Promise.all([
      Promise.resolve(refreshCountsSync()),
      refreshUsageCache(),
    ]);

    if (counts) {
      console.error(`[UpdateCounts] Updated: SK:${counts.topLevelSkills}(${counts.skills}) WF:${counts.workflows} HK:${counts.hooks} AG:${counts.agents} PK:${counts.packs} TR:${counts.traitCombinations}`);
    } else {
      console.error('[UpdateCounts] refreshCountsSync returned null — settings.json untouched');
    }
  } catch (error) {
    console.error('[UpdateCounts] Failed to update counts:', error);
    // Non-fatal - don't throw, let other handlers continue
  }
}

// Allow running standalone to seed initial counts
if (import.meta.main) {
  handleUpdateCounts().then(() => process.exit(0));
}
