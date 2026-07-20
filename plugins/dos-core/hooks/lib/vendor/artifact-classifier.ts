import { basename, extname, relative } from 'node:path';

export type ArtifactKind =
  | 'rfc'
  | 'spec'
  | 'roadmap'
  | 'scope-draft'
  | 'report'
  | 'runbook'
  | 'history'
  | 'studio-plan'
  | 'working-doc'
  | 'session-prompt'
  | 'root-plan'
  | 'task-prd'
  | 'project-prd'
  | 'unknown';

export interface PathAttributionShape {
  pack: string;
  artifactType: string;
  workflow: string;
}

export interface ArtifactClassification {
  kind: ArtifactKind;
  family: string;
  id: string;
  titleHint?: string;
  relativePath: string;
  studioPlanType: string;
  pathAttribution: PathAttributionShape;
}

const PLAN_PREFIX = 'Plans/';
const MEMORY_WORK_PRD_RE = /^MEMORY\/WORK\/[^/]+\/PRD\.md$/;

function normalizePath(inputPath: string, repoRoot?: string): string {
  let p = inputPath.replace(/\\/g, '/');
  const root = repoRoot?.replace(/\\/g, '/').replace(/\/+$/, '');

  if (root && p.startsWith(`${root}/`)) {
    p = relative(root, inputPath).replace(/\\/g, '/');
  } else {
    const duranteIdx = p.indexOf('/Durante/');
    if (duranteIdx !== -1) p = p.slice(duranteIdx + '/Durante/'.length);
    else {
      const plansIdx = p.indexOf('/Plans/');
      const memoryIdx = p.indexOf('/MEMORY/');
      if (plansIdx !== -1) p = p.slice(plansIdx + 1);
      else if (memoryIdx !== -1) p = p.slice(memoryIdx + 1);
    }
  }

  return p.replace(/^\.\//, '').replace(/^\/+/, '');
}

function stripMd(path: string): string {
  return path.endsWith('.md') ? path.slice(0, -3) : path;
}

function pathSlug(relativePath: string): string {
  return stripMd(relativePath).split('/').filter(Boolean).join('--');
}

function titleHintFromPath(relativePath: string): string {
  return basename(relativePath, extname(relativePath)).replace(/[-_]/g, ' ');
}

export function studioPlanTypeFor(kind: ArtifactKind): string {
  switch (kind) {
    case 'rfc':
      return 'rfc';
    case 'spec':
      return 'spec';
    case 'roadmap':
      return 'roadmap';
    case 'scope-draft':
      return 'scope-draft';
    case 'report':
      return 'report';
    case 'runbook':
      return 'runbook';
    case 'history':
      return 'history';
    case 'studio-plan':
      return 'studio-plan';
    case 'working-doc':
      return 'working-doc';
    case 'session-prompt':
      return 'session-prompt';
    case 'root-plan':
      return 'plan';
    case 'project-prd':
      return 'project-prd';
    case 'task-prd':
      return 'prd';
    default:
      return 'unknown';
  }
}

export function pathAttributionFor(kind: ArtifactKind): PathAttributionShape {
  switch (kind) {
    case 'rfc':
      return { pack: 'RFC', artifactType: 'rfc', workflow: 'unknown' };
    case 'spec':
      return { pack: 'Plan', artifactType: 'spec', workflow: 'unknown' };
    case 'roadmap':
      return { pack: 'Plan', artifactType: 'roadmap', workflow: 'unknown' };
    case 'scope-draft':
      return { pack: 'Plan', artifactType: 'scope-draft', workflow: 'unknown' };
    case 'report':
      return { pack: 'Plan', artifactType: 'report', workflow: 'unknown' };
    case 'runbook':
      return { pack: 'Plan', artifactType: 'runbook', workflow: 'unknown' };
    case 'history':
      return { pack: 'Plan', artifactType: 'history', workflow: 'unknown' };
    case 'studio-plan':
      return { pack: 'Studio', artifactType: 'studio-plan', workflow: 'unknown' };
    case 'working-doc':
      return { pack: 'Plan', artifactType: 'working-doc', workflow: 'unknown' };
    case 'session-prompt':
      return { pack: 'Plan', artifactType: 'session-prompt', workflow: 'unknown' };
    case 'root-plan':
      return { pack: 'Plan', artifactType: 'plan', workflow: 'unknown' };
    case 'task-prd':
      return { pack: 'Algorithm', artifactType: 'prd', workflow: 'unknown' };
    case 'project-prd':
      return { pack: 'Algorithm', artifactType: 'project-prd', workflow: 'unknown' };
    default:
      return { pack: 'stream-dispatch', artifactType: 'file', workflow: 'unknown' };
  }
}

export function deriveArtifactId(path: string, kind: ArtifactKind): string {
  const relativePath = normalizePath(path);
  const name = basename(relativePath, '.md');

  if (kind === 'task-prd') {
    const parts = relativePath.split('/');
    return parts[parts.length - 2] ?? name;
  }

  if (kind === 'project-prd') {
    return 'project-prd';
  }

  if (kind === 'rfc') {
    const match = name.match(/^(RFC-\d{4})/);
    return match ? match[1] : name;
  }

  if (relativePath.startsWith(PLAN_PREFIX)) {
    const planRelative = relativePath.slice(PLAN_PREFIX.length);
    if (!planRelative.includes('/')) return name;
    if (/^Specs\/[^/]+\.md$/.test(planRelative)) return name;
    return pathSlug(planRelative);
  }

  return pathSlug(relativePath);
}

export function classifyArtifactPath(path: string, repoRoot?: string): ArtifactClassification {
  const relativePath = normalizePath(path, repoRoot);
  const name = basename(relativePath);
  let kind: ArtifactKind = 'unknown';

  if (MEMORY_WORK_PRD_RE.test(relativePath)) {
    kind = 'task-prd';
  } else if (relativePath === 'PRD.md') {
    kind = 'project-prd';
  } else if (/^Plans\/Specs\/Archive\//.test(relativePath)) {
    kind = 'history';
  } else if (/^Plans\/Specs\/RFC-\d{4}-.+\.md$/.test(relativePath)) {
    kind = 'rfc';
  } else if (/^Plans\/Specs\/[^/]+\.md$/.test(relativePath)) {
    kind = 'spec';
  } else if (/^Plans\/Roadmaps\/.+\.md$/.test(relativePath)) {
    kind = name.includes('scope-draft') ? 'scope-draft' : 'roadmap';
  } else if (/^Plans\/Reports\/.+\.md$/.test(relativePath)) {
    kind = 'report';
  } else if (/^Plans\/Runbooks\/.+\.md$/.test(relativePath)) {
    kind = 'runbook';
  } else if (/^Plans\/History\/.+\.md$/.test(relativePath)) {
    kind = 'history';
  } else if (/^Plans\/Studio\/.+\.md$/.test(relativePath)) {
    kind = 'studio-plan';
  } else if (/^Plans\/WorkingDocs\/.+\.md$/.test(relativePath)) {
    kind = 'working-doc';
  } else if (/^Plans\/session-prompts\/.+\.md$/.test(relativePath)) {
    kind = 'session-prompt';
  } else if (/^Plans\/[^/]+\.md$/.test(relativePath)) {
    const lower = name.toLowerCase();
    kind = lower.startsWith('roadmap-') || lower.includes('roadmap') ? 'roadmap' : 'root-plan';
  }

  return {
    kind,
    family: kind === 'task-prd' || kind === 'project-prd' ? 'work' : kind === 'unknown' ? 'unknown' : 'planning',
    id: deriveArtifactId(relativePath, kind),
    titleHint: kind === 'unknown' ? undefined : titleHintFromPath(relativePath),
    relativePath,
    studioPlanType: studioPlanTypeFor(kind),
    pathAttribution: pathAttributionFor(kind),
  };
}
