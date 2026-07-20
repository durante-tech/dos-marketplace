/**
 * path-attribution — derives pack/artifactType/workflow from a file path.
 *
 * Used by ArtifactAutoLogger.hook.ts (when transcript-based skill resolution
 * returns out-of-window) AND StreamEventDispatcher.hook.ts (to replace the
 * generic 'stream-dispatch' default for paths it captures).
 *
 * Matching is order-sensitive: first match wins. Rules normalise the path
 * by stripping any prefix up to and including the first `.claude/` or
 * `Durante/` segment so absolute and relative paths produce the same output.
 */

import { classifyArtifactPath } from './vendor/artifact-classifier.ts';

export interface PathAttribution {
  pack: string;
  artifactType: string;
  workflow: string;
}

export function resolveByPath(filePath: string): PathAttribution {
  let p = filePath;
  const claudeIdx = p.indexOf('.claude/');
  const duranteIdx = p.indexOf('Durante/');
  if (claudeIdx !== -1) {
    p = p.slice(claudeIdx + '.claude/'.length);
  } else if (duranteIdx !== -1) {
    p = p.slice(duranteIdx + 'Durante/'.length);
  }
  p = p.replace(/\\/g, '/');

  if (/^MEMORY\/RESEARCH\/[^/]+/.test(p)) {
    return { pack: 'Research', artifactType: 'research-vault', workflow: 'unknown' };
  }

  if (/^MEMORY\/WORK\/[^/]+\/PRD\.md$/.test(p)) {
    return { pack: 'Algorithm', artifactType: 'prd', workflow: 'unknown' };
  }

  if (/^MEMORY\/WORK\/[^/]+/.test(p)) {
    return { pack: 'Algorithm', artifactType: 'work-artifact', workflow: 'unknown' };
  }

  if (/^Plans\//.test(p)) {
    return classifyArtifactPath(p).pathAttribution;
  }

  const skillWorkflow = p.match(/^skills\/([^/]+)\/Workflows\/([^/]+)\.md$/);
  if (skillWorkflow) {
    return { pack: skillWorkflow[1]!, artifactType: 'skill-file', workflow: skillWorkflow[2]! };
  }

  const skillName = p.match(/^skills\/([^/]+)\//);
  if (skillName) {
    return { pack: skillName[1]!, artifactType: 'skill-file', workflow: 'unknown' };
  }

  const packName = p.match(/^Packs\/([^/]+)\//);
  if (packName) {
    return { pack: packName[1]!, artifactType: 'pack-source', workflow: 'unknown' };
  }

  if (filePath.startsWith('/tmp/') || p.startsWith('tmp/')) {
    return { pack: 'stream-dispatch', artifactType: 'file', workflow: 'unknown' };
  }

  return { pack: 'stream-dispatch', artifactType: 'file', workflow: 'unknown' };
}
