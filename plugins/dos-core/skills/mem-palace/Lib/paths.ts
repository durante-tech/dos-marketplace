/**
 * Pack-local shim → canonical `~/.claude/hooks/lib/paths.ts`.
 *
 * Authored by Tools/migrate-pack-imports-to-shim.ts per PRD-D1 (C1-RedTeam-refined,
 * council-ratified 2026-05-21). Uses sync Bun `require()` of the homedir()-resolved
 * absolute path so the import works at BOTH pack-source paths and deployed
 * `~/.claude/skills/<P>/Lib/paths.ts` paths (the dual-path-resolution gap).
 *
 * DO NOT replace this with a relative-path import — the 5-up form breaks under
 * symlink-mode deployment. See:
 *   MEMORY/CANONICAL/patterns/pack-tool-stable-import-resolution.md
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

const canonical = join(homedir(), '.claude/hooks/lib/paths.ts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require(canonical);

export const getMemorySubdir: typeof import('../../../../../.claude/hooks/lib/paths').getMemorySubdir = mod.getMemorySubdir;
export const getMemoryDir: typeof import('../../../../../.claude/hooks/lib/paths').getMemoryDir = mod.getMemoryDir;
export const getDosDir: typeof import('../../../../../.claude/hooks/lib/paths').getDosDir = mod.getDosDir;
export const getAllMemorySubdirs: typeof import('../../../../../.claude/hooks/lib/paths').getAllMemorySubdirs = mod.getAllMemorySubdirs;
export const getHooksDir: typeof import('../../../../../.claude/hooks/lib/paths').getHooksDir = mod.getHooksDir;
export const getSkillsDir: typeof import('../../../../../.claude/hooks/lib/paths').getSkillsDir = mod.getSkillsDir;
export const getSettingsPath: typeof import('../../../../../.claude/hooks/lib/paths').getSettingsPath = mod.getSettingsPath;
export const getWorkDir: typeof import('../../../../../.claude/hooks/lib/paths').getWorkDir = mod.getWorkDir;
export const getAllWorkDirs: typeof import('../../../../../.claude/hooks/lib/paths').getAllWorkDirs = mod.getAllWorkDirs;
export const expandPath: typeof import('../../../../../.claude/hooks/lib/paths').expandPath = mod.expandPath;
export const dosPath: typeof import('../../../../../.claude/hooks/lib/paths').dosPath = mod.dosPath;
export const resolveProjectRoot: typeof import('../../../../../.claude/hooks/lib/paths').resolveProjectRoot = mod.resolveProjectRoot;
export const resolveSkillRoot: typeof import('../../../../../.claude/hooks/lib/paths').resolveSkillRoot = mod.resolveSkillRoot;
export const parseSkillRoot: typeof import('../../../../../.claude/hooks/lib/paths').parseSkillRoot = mod.parseSkillRoot;
export const pathIsUnderAnyRoot: typeof import('../../../../../.claude/hooks/lib/paths').pathIsUnderAnyRoot = mod.pathIsUnderAnyRoot;
export const getSecurityPatternsPath: typeof import('../../../../../.claude/hooks/lib/paths').getSecurityPatternsPath = mod.getSecurityPatternsPath;
export const loadProjectEnv: typeof import('../../../../../.claude/hooks/lib/paths').loadProjectEnv = mod.loadProjectEnv;
export const isGatewayOnly: typeof import('../../../../../.claude/hooks/lib/paths').isGatewayOnly = mod.isGatewayOnly;
export const drainFolderRepairs: typeof import('../../../../../.claude/hooks/lib/paths').drainFolderRepairs = mod.drainFolderRepairs;
export type { SkillRoot, SkillRootDeclaration } from '../../../../../.claude/hooks/lib/paths';
