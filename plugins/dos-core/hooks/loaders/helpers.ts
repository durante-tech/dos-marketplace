/**
 * Helpers used by SessionStart context loaders.
 *
 * Pre-refactor these lived in LoadContext.hook.ts; they are unchanged in
 * behavior. Moved here to break the cycle between LoadContext.hook.ts and
 * loaders/*.ts (the entry file imports the registry; loaders import these
 * helpers). Test surface is the LoadContext smoke fixture in
 * MEMORY/WORK/.../baseline.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { atomicWriteSync } from '../lib/atomic-write';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { getWorkDir } from '../lib/paths';
import type { Settings, DynamicContextConfig } from './types';

// ─── Version Checker ──────────────────────────────────────

const REPO_SSH = 'git@github.com:durante-tech/cc-durante-studio.git';
const REPO_HTTPS = 'https://github.com/durante-tech/cc-durante-studio.git';
const VERSION_CHECK_TIMEOUT = 3000;
const VERSION_CACHE_TTL = 24 * 60 * 60 * 1000;

export interface VersionComparison {
  local: string;
  remote: string | null;
  severity: 'up-to-date' | 'behind' | 'ahead' | 'error';
}

function parseVersion(v: string): { major: number; minor: number; patch: number } | null {
  const clean = v.replace(/^v/, '').split('-')[0];
  const parts = clean.split('.').map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function compareVersions(local: string, remote: string): 'up-to-date' | 'behind' | 'ahead' {
  const l = parseVersion(local);
  const r = parseVersion(remote);
  if (!l || !r) return 'up-to-date';

  if (l.major !== r.major) return l.major > r.major ? 'ahead' : 'behind';
  if (l.minor !== r.minor) return l.minor > r.minor ? 'ahead' : 'behind';
  if (l.patch !== r.patch) return l.patch > r.patch ? 'ahead' : 'behind';
  return 'up-to-date';
}

function getLatestRemoteVersion(): string | null {
  for (const url of [REPO_SSH, REPO_HTTPS]) {
    try {
      const output = execFileSync('git', ['ls-remote', '--tags', '--refs', '--sort=-v:refname', url], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: VERSION_CHECK_TIMEOUT,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });

      const firstLine = output.trim().split('\n')[0];
      if (!firstLine) return null;

      const tagRef = firstLine.split('\t')[1];
      if (!tagRef) return null;

      return tagRef.replace('refs/tags/', '').replace(/^v/, '');
    } catch {
      continue;
    }
  }
  return null;
}

function readLocalVersion(dosDir: string): string | null {
  const versionPath = join(dosDir, 'version.json');
  if (!existsSync(versionPath)) return null;
  try {
    const versionData = JSON.parse(readFileSync(versionPath, 'utf-8'));
    return versionData.dos || 'unknown';
  } catch {
    return null;
  }
}

function tryReadFreshCache(cachePath: string, local: string): VersionComparison | null {
  if (!existsSync(cachePath)) return null;
  try {
    const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
    const age = Date.now() - new Date(cache.timestamp).getTime();
    if (age >= VERSION_CACHE_TTL || !cache.remote) return null;
    console.error(`⚡ Version check from cache (${Math.round(age / 3600000)}h old)`);
    return { local, remote: cache.remote, severity: compareVersions(local, cache.remote) };
  } catch {
    return null;
  }
}

function fetchAndCacheRemoteVersion(cachePath: string, local: string): VersionComparison {
  const remote = getLatestRemoteVersion();
  if (!remote) return { local, remote: null, severity: 'error' };

  atomicWriteSync(cachePath, JSON.stringify({
    remote,
    local,
    timestamp: new Date().toISOString(),
  }));

  return { local, remote, severity: compareVersions(local, remote) };
}

export function checkVersion(dosDir: string): VersionComparison {
  const local = readLocalVersion(dosDir);
  if (local === null) return { local: 'unknown', remote: null, severity: 'error' };

  const cachePath = join(dosDir, 'MEMORY', 'STATE', 'version-cache.json');
  const cached = tryReadFreshCache(cachePath, local);
  if (cached) return cached;

  return fetchAndCacheRemoteVersion(cachePath, local);
}

export function formatVersionCheck(result: VersionComparison): void {
  if (result.severity === 'error') {
    console.error('⚠️ Version check: could not reach remote (offline or no access)');
    return;
  }

  switch (result.severity) {
    case 'up-to-date':
      console.error(`✅ DOS v${result.local} is up to date`);
      break;
    case 'ahead':
      console.error(`🚀 DOS v${result.local} (ahead of latest ${result.remote})`);
      break;
    case 'behind':
      console.error(`⚠️ DOS v${result.local} → v${result.remote} available`);
      console.log(`\n⚠️ DOS update available: v${result.local} → v${result.remote}. Run \`dos upgrade\` to update.\n`);
      break;
  }
}

// ─── Settings + dynamic-context gating ─────────────────────

export function isDynamicEnabled(settings: Settings, key: keyof DynamicContextConfig): boolean {
  if (!settings.dynamicContext) return true;
  const val = settings.dynamicContext[key];
  return val !== false;
}

export function loadSettings(dosDir: string): Settings {
  const settingsPath = join(dosDir, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch (err) {
      console.error(`⚠️ Failed to parse settings.json: ${err}`);
    }
  }
  return {};
}

// ─── Startup files (force-load via settings.json → loadAtStartup) ─

export function loadStartupFiles(dosDir: string, settings: Settings): string | null {
  const config = settings.loadAtStartup;
  if (!config?.files || config.files.length === 0) return null;

  const parts: string[] = [];
  for (const relPath of config.files) {
    const fullPath = join(dosDir, relPath);
    if (!existsSync(fullPath)) {
      console.error(`⚠️ loadAtStartup: file not found: ${relPath}`);
      continue;
    }
    try {
      const content = readFileSync(fullPath, 'utf-8').trim();
      parts.push(content);
      console.error(`📄 Force-loaded: ${relPath} (${content.length} chars)`);
    } catch (err) {
      console.error(`⚠️ loadAtStartup: failed to read ${relPath}: ${err}`);
    }
  }

  if (parts.length === 0) return null;
  return parts.join('\n\n---\n\n');
}

// ─── Relationship context ─────────────────────────────────

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const MAX_OPINIONS = 6;
const MAX_NOTES_PER_DAY = 5;

const formatDate = (d: Date) => d.toISOString().split('T')[0];
const formatMonth = (d: Date) => d.toISOString().slice(0, 7);

function loadHighConfidenceOpinions(dosDir: string): string[] {
  const opinionsPath = join(dosDir, 'DOS/USER/OPINIONS.md');
  if (!existsSync(opinionsPath)) return [];

  let content: string;
  try {
    content = readFileSync(opinionsPath, 'utf-8');
  } catch (err) {
    console.error(`⚠️ Failed to load opinions: ${err}`);
    return [];
  }

  const highConfidence: string[] = [];
  const opinionBlocks = content.split(/^### /gm).slice(1);
  for (const block of opinionBlocks) {
    const statement = block.split('\n')[0]?.trim();
    const confidenceMatch = block.match(/\*\*Confidence:\*\*\s*([\d.]+)/);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0;
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD && statement) {
      highConfidence.push(`• ${statement} (${(confidence * 100).toFixed(0)}%)`);
    }
  }
  return highConfidence.slice(0, MAX_OPINIONS);
}

// R14 (Amendment R companion, 2026-07-08): sensitivity hold-back — personal-
// difficulty content never rides AMBIENT SessionStart injection; it stays fully
// reachable via explicit search/recall when Lucas raises the topic himself.
// v1 is a conservative keyword gate on note lines; a classifier upgrade and the
// diary-recall analog are NAMED follow-ups, not claimed shipped. Subagent leak
// path is closed structurally: LoadContext's isSubagent() guard exits before
// any injection, so ambient relationship content never reaches spawn contexts.
export const SENSITIVE_NOTE_RE =
  // Deliberately excludes bare "fired"/"debt" — this codebase's own vocabulary
  // (hooks "fire", technical debt) makes them false-positive magnets; job-loss
  // and financial-hardship phrasing is covered by the scoped forms below.
  /\b(grie[fv]\w*|death|died|funeral|illness|diagnos\w*|hospital\w*|cancer|therap(y|ist)|depress\w*|anxiet\w*|anxious|panic|burn(ed[- ]?out|out)|crisis|cr(ying|ied)|divorce|break[- ]?up|broke up|lay[- ]?off|laid off|(got|was|being) fired|(financial|money) (trouble|debt|stress)|lonel\w*|suicid\w*|self[- ]harm)\b/i;

export function isSensitiveNote(line: string): boolean {
  return SENSITIVE_NOTE_RE.test(line);
}

function readRelationshipNotesForDate(dosDir: string, date: Date): string[] {
  const notePath = join(
    dosDir,
    'MEMORY/RELATIONSHIP',
    formatMonth(date),
    `${formatDate(date)}.md`,
  );
  if (!existsSync(notePath)) return [];

  let content: string;
  try {
    content = readFileSync(notePath, 'utf-8');
  } catch {
    return [];
  }

  const allNotes = content
    .split('\n')
    .filter(line => line.trim().startsWith('- '));
  const heldBack = allNotes.filter(isSensitiveNote).length;
  if (heldBack > 0) {
    console.error(`🔒 R14: held back ${heldBack} sensitive relationship note(s) from ambient injection`);
  }
  // Filter BEFORE the per-day cap deliberately: held-back notes must not eat
  // display slots — up to MAX_NOTES_PER_DAY ordinary notes still surface.
  const notes = allNotes
    .filter(line => !isSensitiveNote(line))
    .slice(0, MAX_NOTES_PER_DAY);
  if (notes.length === 0) return [];

  return [`*${formatDate(date)}:*`, ...notes];
}

function loadRecentRelationshipNotes(dosDir: string): string[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const out: string[] = [];
  for (const date of [today, yesterday]) {
    out.push(...readRelationshipNotesForDate(dosDir, date));
  }
  return out;
}

function composeRelationshipContext(opinions: string[], notes: string[]): string | null {
  const parts: string[] = [];
  if (opinions.length > 0) {
    parts.push('**Key Opinions (high confidence):**');
    parts.push(opinions.join('\n'));
  }
  if (notes.length > 0) {
    if (parts.length > 0) parts.push('');
    parts.push('**Recent Relationship Notes:**');
    parts.push(notes.join('\n'));
  }
  if (parts.length === 0) return null;
  return `
## Relationship Context

${parts.join('\n')}

*Full details: DOS/USER/OPINIONS.md, MEMORY/RELATIONSHIP/*
`;
}

export function loadRelationshipContext(dosDir: string): string | null {
  const opinions = loadHighConfidenceOpinions(dosDir);
  const notes = loadRecentRelationshipNotes(dosDir);
  return composeRelationshipContext(opinions, notes);
}

// ─── Active work scanning ─────────────────────────────────

export interface WorkSession {
  type: 'recent' | 'project';
  name: string;
  title: string;
  status: string;
  timestamp: string;
  stale: boolean;
  objectives?: string[];
  handoff_notes?: string;
  next_steps?: string[];
  prd?: { id: string; status: string; progress: string } | null;
}

interface RecentDir {
  dirName: string;
  dirPath: string;
  dirTime: number;
  slug: string;
  yyyymmddhhmm: string;
}

interface SessionMeta {
  status: string;
  rawTitle: string;
  sessionId?: string;
  prd: { id: string; status: string; progress: string } | null;
}

const WORK_DIR_PATTERN = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_(.+)$/;
const RECENT_CUTOFF_MS = 48 * 60 * 60 * 1000;
const RECENT_DIR_LIMIT = 30;
const RECENT_SESSION_LIMIT = 8;

function loadSessionNames(dosDir: string): Record<string, string> {
  const namesPath = join(dosDir, 'MEMORY', 'STATE', 'session-names.json');
  if (!existsSync(namesPath)) return {};
  try {
    return JSON.parse(readFileSync(namesPath, 'utf-8'));
  } catch {
    return {};
  }
}

function listRecentWorkDirs(workDir: string, limit: number, cutoffMs: number): RecentDir[] {
  const out: RecentDir[] = [];
  const now = Date.now();

  // Scan the flat WORK root AND the RFC-0037 active/archived buckets. The old
  // one-level scan skipped 'active'/'archived' (they don't match the timestamp
  // slug pattern) and never descended, so every migrated PRD — 142 under active/
  // here, i.e. the newest/hottest work this banner exists to surface — was
  // structurally invisible (H-083, the MP-015 sibling defect).
  const candidates: Array<{ dirName: string; container: string }> = [];
  for (const container of [workDir, join(workDir, 'active'), join(workDir, 'archived')]) {
    try {
      for (const d of readdirSync(container, { withFileTypes: true })) {
        if (d.isDirectory() && /^\d{8}-\d{6}_/.test(d.name)) {
          candidates.push({ dirName: d.name, container });
        }
      }
    } catch { /* bucket absent — skip */ }
  }
  if (candidates.length === 0) return out;
  // Newest-first; the cutoff `break` below stays valid because the list is sorted desc.
  candidates.sort((a, b) => b.dirName.localeCompare(a.dirName));

  const seen = new Set<string>();
  for (const { dirName, container } of candidates) {
    if (seen.has(dirName)) continue; // a slug cannot legitimately live in two buckets
    const match = dirName.match(WORK_DIR_PATTERN);
    if (!match) continue;
    const [, y, mo, d, h, mi, s, slug] = match;
    const dirTime = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();
    if (now - dirTime > cutoffMs) break;
    seen.add(dirName);
    out.push({
      dirName,
      dirPath: join(container, dirName),
      dirTime,
      slug,
      yyyymmddhhmm: `${y}-${mo}-${d} ${h}:${mi}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function parsePrdFrontmatter(prdPath: string, slug: string): SessionMeta | null {
  let content: string;
  try {
    content = readFileSync(prdPath, 'utf-8');
  } catch {
    return null;
  }
  const head = content.substring(0, 600);

  const phaseMatch = head.match(/^phase:\s*"?(\w+)"?/m);
  const titleMatch = head.match(/^title:\s*"?(.+?)"?\s*$/m);
  const sessionIdMatch = head.match(/^session_id:\s*"?(.+?)"?\s*$/m);

  const prdIdMatch = content.match(/^id:\s*(.+)$/m);
  const prdPhaseMatch = content.match(/^phase:\s*(.+)$/m);
  const prdVerifyMatch = content.match(/^verification_summary:\s*"?(.+?)"?$/m);
  const prdProgressMatch = content.match(/^progress:\s*(.+)$/m);

  return {
    status: phaseMatch?.[1] ?? 'UNKNOWN',
    rawTitle: titleMatch?.[1] ?? slug.replace(/-/g, ' '),
    sessionId: sessionIdMatch?.[1]?.trim(),
    prd: {
      id: prdIdMatch?.[1]?.trim() || 'PRD',
      status: prdPhaseMatch?.[1]?.trim() || 'UNKNOWN',
      progress:
        prdVerifyMatch?.[1]?.trim()
        || prdProgressMatch?.[1]?.trim()
        || '0/0',
    },
  };
}

function parseMetaYaml(metaPath: string, slug: string): SessionMeta | null {
  let content: string;
  try {
    content = readFileSync(metaPath, 'utf-8');
  } catch {
    return null;
  }
  const statusMatch = content.match(/^status:\s*"?(\w+)"?/m);
  const titleMatch = content.match(/^title:\s*"?(.+?)"?\s*$/m);
  const sessionIdMatch = content.match(/^session_id:\s*"?(.+?)"?\s*$/m);

  return {
    status: statusMatch?.[1] ?? 'UNKNOWN',
    rawTitle: titleMatch?.[1] ?? slug.replace(/-/g, ' '),
    sessionId: sessionIdMatch?.[1]?.trim(),
    prd: null,
  };
}

function readWorkSessionMetadata(dirPath: string, slug: string): SessionMeta | null {
  const prdPath = join(dirPath, 'PRD.md');
  if (existsSync(prdPath)) return parsePrdFrontmatter(prdPath, slug);

  const metaPath = join(dirPath, 'META.yaml');
  if (existsSync(metaPath)) return parseMetaYaml(metaPath, slug);

  return null;
}

function passesFilters(meta: SessionMeta, seenSessionIds: Set<string>): boolean {
  // 'done' is terminal alongside 'complete' (6 live PRDs use it) — without this a
  // finished PRD keeps reappearing in the SessionStart "Recent Sessions" banner
  // (H-084, the recurring done-phase class).
  if (meta.status === 'complete' || meta.status === 'COMPLETED' || meta.status === 'done') return false;
  if (meta.rawTitle.toLowerCase().startsWith('tasknotification')) return false;
  if (meta.rawTitle.length < 10) return false;
  if (meta.sessionId && seenSessionIds.has(meta.sessionId)) return false;
  return true;
}

function buildWorkSession(
  dirName: string,
  yyyymmddhhmm: string,
  meta: SessionMeta,
  sessionNames: Record<string, string>,
): WorkSession {
  const titleFromNames = meta.sessionId ? sessionNames[meta.sessionId] : undefined;
  const title = titleFromNames || meta.rawTitle;
  return {
    type: 'recent',
    name: dirName,
    title: title.length > 60 ? title.substring(0, 57) + '...' : title,
    status: meta.status,
    timestamp: yyyymmddhhmm,
    stale: false,
    prd: meta.prd,
  };
}

export function getRecentWorkSessions(dosDir: string): WorkSession[] {
  // Project-first resolution. The old hardcoded join(dosDir,'MEMORY','WORK') always
  // read the GLOBAL install dir, so the SessionStart "Active Work" banner was blind
  // to virtually the entire real corpus (17 global dirs vs 153 flat + 142 under
  // active/ in this project). Same class as the MP-TS-01/MP-056 sibling fix in
  // MemPalacePreCompact.daemon (H-082). Fall back to the global path if the
  // project-first resolver yields nothing.
  let workDir = getWorkDir();
  if (!existsSync(workDir)) workDir = join(dosDir, 'MEMORY', 'WORK');
  if (!existsSync(workDir)) return [];

  const sessionNames = loadSessionNames(dosDir);
  const recentDirs = listRecentWorkDirs(workDir, RECENT_DIR_LIMIT, RECENT_CUTOFF_MS);
  const seen = new Set<string>();
  const sessions: WorkSession[] = [];

  for (const { dirName, dirPath, slug, yyyymmddhhmm } of recentDirs) {
    const meta = readWorkSessionMetadata(dirPath, slug);
    if (!meta) continue;
    if (!passesFilters(meta, seen)) continue;
    if (meta.sessionId) seen.add(meta.sessionId);
    sessions.push(buildWorkSession(dirName, yyyymmddhhmm, meta, sessionNames));
    if (sessions.length >= RECENT_SESSION_LIMIT) break;
  }

  return sessions;
}

interface ProgressFile {
  project: string;
  status: string;
  updated: string;
  objectives: string[];
  next_steps: string[];
  handoff_notes: string;
}

const STALE_PROGRESS_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

function listProgressFiles(progressDir: string): string[] {
  try {
    return readdirSync(progressDir).filter(f => f.endsWith('-progress.json'));
  } catch (err) {
    console.error(`⚠️ Error reading progress files: ${err}`);
    return [];
  }
}

function readActiveProgress(filePath: string): ProgressFile | null {
  try {
    const progress = JSON.parse(readFileSync(filePath, 'utf-8')) as ProgressFile;
    return progress.status === 'active' ? progress : null;
  } catch {
    return null;
  }
}

function buildProjectSession(progress: ProgressFile, now: number): WorkSession {
  const updatedTime = new Date(progress.updated).getTime();
  return {
    type: 'project',
    name: progress.project,
    title: progress.project,
    status: 'active',
    timestamp: new Date(progress.updated).toISOString().split('T')[0],
    stale: (now - updatedTime) > STALE_PROGRESS_THRESHOLD_MS,
    objectives: progress.objectives,
    handoff_notes: progress.handoff_notes,
    next_steps: progress.next_steps,
  };
}

export function getProjectProgress(dosDir: string): WorkSession[] {
  const progressDir = join(dosDir, 'MEMORY', 'STATE', 'progress');
  if (!existsSync(progressDir)) return [];

  const now = Date.now();
  const sessions: WorkSession[] = [];

  for (const file of listProgressFiles(progressDir)) {
    const progress = readActiveProgress(join(progressDir, file));
    if (!progress) continue;
    sessions.push(buildProjectSession(progress, now));
  }

  return sessions;
}

export async function checkActiveProgress(dosDir: string): Promise<string | null> {
  const recentSessions = getRecentWorkSessions(dosDir);
  const projects = getProjectProgress(dosDir);

  if (recentSessions.length === 0 && projects.length === 0) {
    return null;
  }

  let summary = '\n📋 ACTIVE WORK:\n';

  if (recentSessions.length > 0) {
    summary += '\n  ── Recent Sessions (last 48h) ──\n';
    for (const s of recentSessions) {
      summary += `\n  ⚡ ${s.title}\n`;
      summary += `     ${s.timestamp} | Status: ${s.status}\n`;
      if (s.prd) {
        summary += `     PRD: ${s.prd.id} (${s.prd.status}, ${s.prd.progress})\n`;
      }
    }
  }

  if (projects.length > 0) {
    summary += '\n  ── Tracked Projects ──\n';
    for (const proj of projects) {
      const staleTag = proj.stale ? ' ⚠️ STALE (>14d)' : '';
      summary += `\n  ${proj.stale ? '🟡' : '🔵'} ${proj.name}${staleTag}\n`;

      if (proj.objectives && proj.objectives.length > 0) {
        summary += '     Objectives:\n';
        proj.objectives.forEach(o => summary += `     • ${o}\n`);
      }

      if (proj.handoff_notes) {
        summary += `     Handoff: ${proj.handoff_notes}\n`;
      }

      if (proj.next_steps && proj.next_steps.length > 0) {
        summary += '     Next steps:\n';
        proj.next_steps.forEach(s => summary += `     → ${s}\n`);
      }
    }
  }

  summary += '\n💡 To resume project: `bun run ~/.claude/DOS/Tools/SessionProgress.ts resume <project>`\n';
  summary += '💡 To complete project: `bun run ~/.claude/DOS/Tools/SessionProgress.ts complete <project>`\n';

  return summary;
}

// Re-export `statSync` for the drift loader
export { statSync, existsSync, readFileSync };
