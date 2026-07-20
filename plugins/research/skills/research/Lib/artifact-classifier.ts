/**
 * Pack-local shim → canonical `~/.claude/hooks/lib/vendor/artifact-classifier.ts`.
 *
 * Mirrors the C1-RedTeam stable-import pattern (PRD-D1, 2026-05-21).
 * Sync Bun `require()` of homedir()-resolved absolute path so the import
 * works at BOTH pack-source paths and deployed `~/.claude/skills/<P>/Lib/`
 * paths — closing the dual-path-resolution gap that broke
 * SavePlansToStudio on customer installs (Eric Daniel, 2026-05-21).
 *
 * The canonical artifact-classifier was itself vendored into hooks/lib/vendor/
 * earlier today via the RFC-0112 Option A precedent — `Tools/lib/` is
 * maintainer-only and never ships to customers. See:
 *   MEMORY/CANONICAL/patterns/pack-tool-stable-import-resolution.md
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

const canonical = join(homedir(), '.claude/hooks/lib/vendor/artifact-classifier.ts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require(canonical);

export const classifyArtifactPath: typeof import('../../../../.claude/hooks/lib/vendor/artifact-classifier').classifyArtifactPath = mod.classifyArtifactPath;
