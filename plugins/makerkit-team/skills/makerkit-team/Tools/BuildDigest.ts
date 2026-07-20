#!/usr/bin/env bun
/**
 * BuildDigest — derive the machine-checkable pins of FrameworkDigest.md from
 * the TARGET repo (resolved via ResolveRepo.ts) and rewrite ONLY the marked
 * region between GEN_START / GEN_END. The curated prose around the region is
 * hand-maintained and never touched by this tool.
 *
 * Derived facts: package name + version, pnpm-workspace.yaml catalog pins
 * (next / react / typescript / prisma / tailwindcss / zod / better-auth /
 * base-ui), packageManager + pnpm major, workspace count, docs corpus counts
 * (topic dirs + .mdoc files), AGENTS.md file count, toolchain (oxlint/oxfmt
 * detection), and the healthcheck script text.
 *
 * Usage:
 *   bun Tools/BuildDigest.ts [--repo <path>] [--digest <path>] [--json]
 *   # exit 0 = region rewritten; exit 1 = repo unresolvable or markers missing
 *
 * Companion: Tools/VerifyDigest.ts checks the digest's pins against the
 * resolved repo's AGENTS.md (exit 0 = N>0 verified / 1 = drift / 2 = VACUOUS).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { resolveKitRepo } from './ResolveRepo';

export const GEN_START = '<!-- generated:pins:start -->';
export const GEN_END = '<!-- generated:pins:end -->';

export interface DigestFacts {
  name: string;
  version: string;
  kind: string;
  packageManager: string;
  pnpmMajor: string | null;
  workspaceCount: number;
  /** display-normalized catalog pins (leading ^/~ stripped), keyed by catalog name */
  catalog: Record<string, string>;
  docsTopicDirs: number;
  mdocCount: number;
  agentsMdCount: number;
  /** e.g. 'oxlint + oxfmt', 'eslint', 'unknown' */
  toolchain: string;
  healthcheckScript: string | null;
}

/** Catalog entries the digest pins. Order = render order. */
const CATALOG_KEYS = [
  ['next', 'Next.js'],
  ['react', 'React'],
  ['typescript', 'TypeScript'],
  ['@prisma/client', 'Prisma'],
  ['tailwindcss', 'Tailwind CSS'],
  ['@base-ui/react', 'Base UI'],
  ['better-auth', 'Better Auth'],
  ['zod', 'zod'],
] as const;

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', '.turbo']);

/** Parse the top-level `catalog:` block of pnpm-workspace.yaml (no YAML dep). */
export function parseCatalog(workspaceYaml: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inCatalog = false;
  for (const line of workspaceYaml.split('\n')) {
    if (/^catalog:\s*$/.test(line)) {
      inCatalog = true;
      continue;
    }
    if (inCatalog) {
      if (/^\S/.test(line)) break; // next top-level key ends the block
      const m = line.match(/^\s+'?([^':\s]+)'?\s*:\s*(\S+)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  }
  return out;
}

/** Strip range prefixes for display: '^7.8.0' -> '7.8.0'. */
export function displayVersion(v: string): string {
  return v.replace(/^[\^~>=<]+/, '');
}

function walkCount(dir: string, predicate: (path: string, name: string) => boolean): number {
  let count = 0;
  if (!existsSync(dir)) return 0;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) count += walkCount(full, predicate);
    else if (predicate(full, entry)) count += 1;
  }
  return count;
}

/** Collect every derivable fact from the resolved repo root. */
export function collectFacts(root: string): DigestFacts {
  const profile = resolveKitRepo(root);

  let pkg: { version?: string; scripts?: Record<string, string> } = {};
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch {
    // degrade below
  }

  let rawCatalog: Record<string, string> = {};
  try {
    rawCatalog = parseCatalog(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8'));
  } catch {
    // no workspace file: catalog stays empty
  }
  const catalog: Record<string, string> = {};
  for (const [key] of CATALOG_KEYS) {
    if (rawCatalog[key]) catalog[key] = displayVersion(rawCatalog[key]);
  }
  // Fall back from @prisma/client to the prisma CLI pin if only that exists.
  if (!catalog['@prisma/client'] && rawCatalog['prisma']) {
    catalog['@prisma/client'] = displayVersion(rawCatalog['prisma']);
  }

  const workspaceCount = ['apps', 'packages', 'tooling'].reduce(
    (n, d) => n + walkCount(join(root, d), (_p, name) => name === 'package.json'),
    0,
  );

  const docsDir = join(root, 'docs');
  const docsTopicDirs = existsSync(docsDir)
    ? readdirSync(docsDir).filter((e) => {
        try {
          return statSync(join(docsDir, e)).isDirectory() && !SKIP_DIRS.has(e);
        } catch {
          return false;
        }
      }).length
    : 0;
  const mdocCount = walkCount(docsDir, (_p, name) => name.endsWith('.mdoc'));
  const agentsMdCount = walkCount(root, (_p, name) => name === 'AGENTS.md');

  const scripts = profile.scripts;
  const usesOxfmt = /oxfmt/.test(scripts['format'] ?? '') || /oxfmt/.test(scripts['format:fix'] ?? '');
  const toolchain =
    profile.lintTool === 'oxlint'
      ? usesOxfmt
        ? 'oxlint + oxfmt'
        : 'oxlint'
      : profile.lintTool;

  const pm = profile.packageManager;
  const pnpmMajor = pm.startsWith('pnpm@') ? pm.slice('pnpm@'.length).split('.')[0] : null;

  return {
    name: profile.name,
    version: pkg.version ?? 'unknown',
    kind: profile.kind,
    packageManager: pm,
    pnpmMajor,
    workspaceCount,
    catalog,
    docsTopicDirs,
    mdocCount,
    agentsMdCount,
    toolchain,
    healthcheckScript: scripts['healthcheck'] ?? null,
  };
}

/** Render the block that lives between GEN_START and GEN_END (markers excluded). */
export function renderPinsBlock(facts: DigestFacts, opts: { root: string; date: string }): string {
  const pins = CATALOG_KEYS.filter(([key]) => facts.catalog[key])
    .map(([key, label]) => `${label} ${facts.catalog[key]}`)
    .join(' · ');

  const lines = [
    `- **Repo:** \`${facts.name}\` v${facts.version} (${facts.kind}) — ${facts.packageManager}` +
      (facts.pnpmMajor ? ` (pnpm ${facts.pnpmMajor})` : '') +
      ` + Turborepo, **${facts.workspaceCount} workspaces** under \`apps/*\` / \`packages/**\` / \`tooling/*\`.`,
    `- **Catalog pins** (\`pnpm-workspace.yaml\`): ${pins || 'none extractable'}.`,
    `- **Toolchain:** ${facts.toolchain}.` +
      (facts.healthcheckScript
        ? ` \`pnpm healthcheck\` = \`${facts.healthcheckScript}\` — MUTATES files; the read-only ladder is \`pnpm lint && pnpm typecheck && pnpm test:unit\`.`
        : ''),
    `- **Docs corpus:** ${facts.mdocCount} \`.mdoc\` files across ${facts.docsTopicDirs} topic dirs under \`docs/\` · ${facts.agentsMdCount} \`AGENTS.md\` files repo-wide.`,
    '',
    // Reproducible footer: repo NAME + kind only — never the absolute path or a
    // date, which would bake one operator's home dir + today's date into the
    // committed digest and spuriously trip sync-check on every machine/day.
    `Generated against ${facts.name} (${facts.kind}) by \`bun Tools/BuildDigest.ts\` at DocsRefresh Phase 0.`,
  ];
  return lines.join('\n');
}

export interface FactPinCheck {
  name: string;
  /** value derived from the repo (catalog/package.json), or null if underivable */
  live: string | null;
  /** the string the digest must contain when `live` is known */
  expected: string | null;
  /** true=present, false=drift, null=skipped (fact underivable from the repo) */
  ok: boolean | null;
}

export interface FactVerifyResult {
  checks: FactPinCheck[];
  ok: boolean;
  driftCount: number;
  extractableCount: number;
  verifiedCount: number;
}

/**
 * Verify the digest against facts derived from the repo itself — the exact
 * source renderPinsBlock writes into the generated region. This is the
 * fallback for repos whose AGENTS.md carries no version pins (e.g. upstream
 * next-prisma-kit), where VerifyDigest's AGENTS.md extraction is vacuous.
 * Result shape mirrors VerifyDigest.VerifyResult so the CLI can swap it in.
 */
export function verifyDigestAgainstFacts(digestText: string, facts: DigestFacts): FactVerifyResult {
  const checks: FactPinCheck[] = [];

  for (const [key, label] of CATALOG_KEYS) {
    const v = facts.catalog[key];
    if (!v) {
      checks.push({ name: `${label} catalog pin`, live: null, expected: null, ok: null });
      continue;
    }
    const expected = `${label} ${v}`;
    checks.push({ name: `${label} catalog pin`, live: v, expected, ok: digestText.includes(expected) });
  }

  if (facts.workspaceCount > 0) {
    const expected = `${facts.workspaceCount} workspaces`;
    checks.push({
      name: 'workspace count',
      live: String(facts.workspaceCount),
      expected,
      ok: digestText.includes(expected),
    });
  } else {
    checks.push({ name: 'workspace count', live: null, expected: null, ok: null });
  }

  if (facts.toolchain !== 'unknown') {
    checks.push({
      name: 'toolchain',
      live: facts.toolchain,
      expected: facts.toolchain,
      ok: digestText.includes(facts.toolchain),
    });
  } else {
    checks.push({ name: 'toolchain', live: null, expected: null, ok: null });
  }

  const driftCount = checks.filter((c) => c.ok === false).length;
  const extractableCount = checks.filter((c) => c.ok !== null).length;
  const verifiedCount = checks.filter((c) => c.ok === true).length;
  return { checks, ok: driftCount === 0, driftCount, extractableCount, verifiedCount };
}

/** Replace ONLY the marked region. Throws when the markers are missing/reversed. */
export function replaceMarkedRegion(digestText: string, block: string): string {
  const start = digestText.indexOf(GEN_START);
  const end = digestText.indexOf(GEN_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `Digest is missing the generated region markers (${GEN_START} … ${GEN_END}); ` +
        'add them where the pins block should live, then re-run.',
    );
  }
  const before = digestText.slice(0, start + GEN_START.length);
  const after = digestText.slice(end);
  return `${before}\n${block}\n${after}`;
}

function parseArgs(argv: string[]): { repo?: string; digest?: string; json: boolean } {
  const out: { repo?: string; digest?: string; json: boolean } = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') out.repo = argv[++i];
    else if (a === '--digest') out.digest = argv[++i];
    else if (a === '--json') out.json = true;
  }
  return out;
}

function main(): void {
  const args = parseArgs(Bun.argv.slice(2));

  let root: string;
  try {
    root = resolveKitRepo(args.repo).root;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const digestPath = args.digest ?? resolve(import.meta.dir, '../FrameworkDigest.md');
  if (!existsSync(digestPath)) {
    console.error(`FrameworkDigest not found: ${digestPath}`);
    process.exit(1);
  }

  const facts = collectFacts(root);
  const date = new Date().toISOString().slice(0, 10);
  const block = renderPinsBlock(facts, { root, date });

  let updated: string;
  try {
    updated = replaceMarkedRegion(readFileSync(digestPath, 'utf8'), block);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  // This IS the artifact generator: it rewrites only the <!-- generated:pins -->
  // region of FrameworkDigest.md in the resolved target repo (a deterministic
  // DocsRefresh Phase 0 build step), not a skill output write.
  // writeArtifact:exempt — digest-region regeneration, not a skill output write
  writeFileSync(digestPath, updated);

  if (args.json) console.log(JSON.stringify({ digest: digestPath, root, facts }, null, 2));
  else console.log(`Rewrote generated pins region in ${digestPath} (against ${facts.name}@${root}).`);
}

if (import.meta.main) main();
