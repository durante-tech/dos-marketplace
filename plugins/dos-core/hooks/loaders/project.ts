import { join } from 'path';
import { existsSync, statSync } from 'fs';
import { resolveProjectWingFromEnv } from '../lib/project-resolver';
import { bridgeSync } from '../lib/mempalace';
import type { ContextLoader } from './types';

interface KgFact {
  predicate: string;
  object: string;
  current: boolean;
  valid_from?: string;
}

function loadProjectKgContext(): { fragment: string; log: string } | null {
  const { wing: projectWing, project: projectName } = resolveProjectWingFromEnv();
  if (!projectWing || !projectName) return null;

  const kgResult = bridgeSync('kg_timeline', { entity: projectWing }, 3000);
  if (!kgResult.ok || !Array.isArray(kgResult.data.timeline)) return null;

  const timeline = kgResult.data.timeline as KgFact[];
  const currentFacts = timeline.filter(f => f.current);
  if (currentFacts.length === 0) return null;

  const decisions = currentFacts.filter(f => f.predicate === 'decided').slice(0, 5);
  const blockers = currentFacts.filter(f => f.predicate === 'blocked_by').slice(0, 3);
  const workingOn = currentFacts.filter(f => f.predicate === 'working_on').slice(0, 3);
  const completed = currentFacts.filter(f => f.predicate === 'completed').slice(0, 3);
  const uses = currentFacts.filter(f => f.predicate === 'uses').slice(0, 10);
  const other = currentFacts.filter(f =>
    !['decided', 'blocked_by', 'working_on', 'completed', 'rated', 'uses'].includes(f.predicate)
  ).slice(0, 5);

  const sections: string[] = [];
  sections.push(`**Project:** ${projectName} (wing: ${projectWing})`);

  if (workingOn.length > 0) {
    sections.push(`\n**Active work:**`);
    workingOn.forEach(f => sections.push(`  - ${f.object} _(since ${f.valid_from})_`));
  }
  if (decisions.length > 0) {
    sections.push(`\n**Recent decisions:**`);
    decisions.forEach(f => sections.push(`  - ${f.object} _(${f.valid_from})_`));
  }
  if (blockers.length > 0) {
    sections.push(`\n**Blockers:**`);
    blockers.forEach(f => sections.push(`  - ⚠️ ${f.object}`));
  }
  if (completed.length > 0) {
    sections.push(`\n**Recently completed:**`);
    completed.forEach(f => sections.push(`  - ✅ ${f.object} _(${f.valid_from})_`));
  }
  if (uses.length > 0) {
    sections.push(`\n**Stack:** ${uses.map(f => f.object).join(', ')}`);
  }
  if (other.length > 0) {
    sections.push(`\n**Other facts:**`);
    other.forEach(f => sections.push(`  - ${f.predicate}: ${f.object}`));
  }

  if (sections.length <= 1) return null;

  const fragment = `\n## Active Project Context\n\n${sections.join('\n')}\n`;
  const log = `🎯 Loaded project context for ${projectName}: ${currentFacts.length} facts (${decisions.length} decisions, ${blockers.length} blockers)`;
  return { fragment, log };
}

function loadDriftWarnings(): string {
  const { wing: driftWing } = resolveProjectWingFromEnv();
  if (!driftWing) return '';

  const kgResult = bridgeSync('kg_timeline', { entity: `project:${driftWing}` }, 3000);
  if (!kgResult.ok || !Array.isArray(kgResult.data.timeline)) return '';

  const timeline = kgResult.data.timeline as KgFact[];
  const scanFact = timeline.find(f => f.predicate === 'scanned_by_sentinel' && f.current);
  const pathFact = timeline.find(f => f.predicate === 'path_is' && f.current);
  if (!scanFact || !pathFact) return '';

  const scanDate = scanFact.object;
  const scanTime = new Date(scanDate + 'T23:59:59').getTime();
  const projectPath = pathFact.object;

  const keyFiles = ['package.json', 'CLAUDE.md'];
  try {
    const prismaSchemaPath = join(projectPath, 'prisma', 'schema.prisma');
    if (existsSync(prismaSchemaPath)) keyFiles.push('prisma/schema.prisma');
  } catch { /* skip */ }

  const driftedFiles: string[] = [];
  for (const relFile of keyFiles) {
    const fullPath = join(projectPath, relFile);
    try {
      if (existsSync(fullPath) && statSync(fullPath).mtimeMs > scanTime) {
        driftedFiles.push(relFile);
      }
    } catch { /* skip unreadable files */ }
  }

  if (driftedFiles.length === 0) return '';

  let warnings = '';
  for (const f of driftedFiles) {
    warnings += `\n> **Project drift detected:** \`${f}\` changed since last Sentinel scan (${scanDate}). Run \`sentinel scan\` to update conventions.`;
  }
  console.error(`⚠️ Drift detected: ${driftedFiles.join(', ')} changed since Sentinel scan on ${scanDate}`);
  return warnings;
}

/**
 * Active Project Context: KG timeline facts (decisions, blockers,
 * working_on, completed, stack), then Sentinel drift warnings appended
 * inline. The four-copy banner appends in the same project block via
 * `fourCopyBannerLoader` running after this one in the registry.
 */
export const projectLoader: ContextLoader = {
  name: 'project-context',
  load: () => {
    const kg = loadProjectKgContext();
    const driftWarnings = loadDriftWarnings();

    if (!kg && !driftWarnings) return {};

    let fragment = kg?.fragment ?? '';
    if (driftWarnings) fragment += driftWarnings + '\n';

    return {
      fragment,
      slot: 'project',
      log: kg?.log,
    };
  },
};
