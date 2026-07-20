/**
 * Project-to-Wing Resolver
 *
 * Resolves the current working directory to a MemPalace wing name
 * by parsing PROJECTS.md and matching paths.
 *
 * Usage:
 *   import { resolveProjectWing, resolveProjectWingFromEnv } from './lib/project-resolver';
 *   const { wing, project } = resolveProjectWing(process.cwd());
 */

import { homedir } from 'os';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDosDir } from './paths';

export interface ProjectMatch {
  wing: string | null;
  project: string | null;
}

interface ProjectEntry {
  project: string;
  path: string;
  wing: string;
}

// Module-level cache — parsed once per process
let cachedEntries: ProjectEntry[] | null = null;
let cacheLoaded = false;

/**
 * Expand ~ to the user's home directory
 */
function expandTilde(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

/**
 * Derive a wing name from a project name when no Wing column exists.
 * Takes the first word, lowercases, strips non-alpha characters.
 * "MyAppOS (MAO)" → "myapp", "ClientSite" → "clientsite"
 */
function deriveWing(projectName: string): string {
  // Remove parenthetical suffixes like "(DOS)"
  const cleaned = projectName.replace(/\s*\(.*?\)\s*/g, '').trim();
  // Take first word, lowercase, strip non-alpha
  const firstWord = cleaned.split(/\s+/)[0] || projectName;
  // Remove trailing "OS" or similar suffixes for cleaner wing names
  const wing = firstWord.replace(/OS$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return wing || firstWord.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Parse PROJECTS.md and return project entries.
 * Handles tables with or without a Wing column.
 *
 * Exported so other consumers (StudioSync hook, registration tools)
 * can reuse the header-aware parser instead of rolling positional
 * cell indexing — the latter silently drifts when the table layout
 * changes (e.g., column reorder produced the slug=path swap bug).
 */
export function loadProjects(): ProjectEntry[] {
  if (cacheLoaded) return cachedEntries || [];

  cacheLoaded = true;

  const projectsPath = join(getDosDir(), 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');

  if (!existsSync(projectsPath)) {
    cachedEntries = [];
    return [];
  }

  try {
    const content = readFileSync(projectsPath, 'utf-8');
    const lines = content.split('\n');

    // Find the table header line (contains | Project |)
    const headerIdx = lines.findIndex(line => /\|\s*Project\s*\|/.test(line));
    if (headerIdx === -1) {
      cachedEntries = [];
      return [];
    }

    // Parse header to find column indices
    const headerCells = lines[headerIdx].split('|').map(c => c.trim()).filter(Boolean);
    const colIndex: Record<string, number> = {};
    headerCells.forEach((cell, i) => {
      colIndex[cell.toLowerCase()] = i;
    });

    const projectCol = colIndex['project'] ?? -1;
    const pathCol = colIndex['path'] ?? -1;
    const wingCol = colIndex['wing'] ?? -1;

    if (projectCol === -1 || pathCol === -1) {
      cachedEntries = [];
      return [];
    }

    const entries: ProjectEntry[] = [];

    // Skip header and separator rows, parse data rows
    for (let i = headerIdx + 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !line.startsWith('|')) continue;

      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      const projectName = cells[projectCol];
      const rawPath = cells[pathCol];

      if (!projectName || !rawPath || rawPath === '-') continue;

      const expandedPath = expandTilde(rawPath);
      const rawWing = wingCol !== -1 ? cells[wingCol] : undefined;
      const wing = rawWing && rawWing !== '-'
        ? rawWing.replace(/`/g, '').trim().toLowerCase()
        : deriveWing(projectName);

      entries.push({
        project: projectName,
        path: expandedPath,
        wing,
      });
    }

    cachedEntries = entries;
    return entries;
  } catch {
    cachedEntries = [];
    return [];
  }
}

/**
 * Resolve a working directory to a MemPalace wing and project name.
 *
 * Matches by checking if cwd starts with a project path.
 * Longest match wins (most specific path takes priority).
 *
 * @param cwd - Directory to resolve. Defaults to process.cwd().
 * @returns { wing, project } or { null, null } if unmapped.
 */
export function resolveProjectWing(cwd?: string): ProjectMatch {
  const dir = cwd || process.cwd();
  const entries = loadProjects();

  if (entries.length === 0) {
    return { wing: null, project: null };
  }

  // Find all matching entries where cwd starts with the project path
  const matches = entries.filter(entry => {
    // Exact match or subdirectory match (path + /)
    return dir === entry.path || dir.startsWith(entry.path + '/');
  });

  if (matches.length === 0) {
    return { wing: null, project: null };
  }

  // Sort by path length descending — longest (most specific) match wins
  matches.sort((a, b) => b.path.length - a.path.length);

  const best = matches[0];
  return { wing: best.wing, project: best.project };
}

/**
 * Resolve project wing using environment context.
 * Tries CLAUDE_PROJECT_DIR first, then falls back to process.cwd().
 */
export function resolveProjectWingFromEnv(): ProjectMatch {
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    const result = resolveProjectWing(expandTilde(envDir));
    if (result.wing) return result;
  }

  return resolveProjectWing(process.cwd());
}
