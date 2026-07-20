#!/usr/bin/env bun
/**
 * SaveProjectToStudio - Register a project in Studio from Sentinel scan data
 *
 * USAGE
 * -----
 *   bun SaveProjectToStudio.ts --name "<Project Name>" --slug <slug> --repo "<org>/<repo>" --path "<project-root>" --stack "<comma,separated,tech>"
 *   bun SaveProjectToStudio.ts --from-scan .sentinel/scan-report.json
 */

import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { kebab } from './SentinelScan';

interface ProjectData {
  name: string;
  slug: string;
  description?: string;
  repo?: string;
  path?: string;
  stack?: string[];
}

/**
 * Map a SentinelScan report (scan-report.json shape) to ProjectData.
 *
 * DEFECT sentinel-rest-006: the original mapping read fields SentinelScan never
 * emits — `report.git?.remote` (the report has no `remote`),
 * `report.stack?.technologies` / `report.techStack` (the report has
 * `stack.{language,framework,runtime,dependencies}`), and derived `slug` from
 * kebab(project.name) instead of the registry `wing` that Scan.md Step 6/6b use
 * everywhere else. That split the Studio record: --from-scan registered under a
 * different slug than SaveConventionsToStudio later PATCHed.
 *
 * Real fields:
 *  - slug: prefer `project.wing` (the registry wing); fall back to kebab(name).
 *  - stack: synthesize from scalar language/framework/runtime + dependency keys.
 *  - repo: not present in a scan report — leave undefined.
 */
export function mapScanReport(report: Record<string, any>, cwd: string = process.cwd()): ProjectData {
  const name: string = report.project?.name ?? report.name ?? basename(cwd);
  const wing: string | undefined =
    typeof report.project?.wing === 'string' && report.project.wing.length > 0
      ? report.project.wing
      : undefined;
  // Fall back to kebab(name) — SentinelScan's canonical wing derivation —
  // which collapses run-of-non-alnum to a single dash and strips leading/
  // trailing dashes, so the from-scan slug matches the registry wing format
  // (sentinel-rest-013). A bare replace left leading dashes / uncollapsed runs.
  const slug = wing ?? kebab(name);

  // Curated scalar stack fields first (language/framework/runtime), then the
  // dependency names. Legacy shapes (technologies / techStack arrays) are
  // honored if present for forward/back compat with external report shapes.
  const scalarStack: string[] = [
    report.stack?.language,
    report.stack?.framework,
    report.stack?.runtime,
  ].filter((v: unknown): v is string => typeof v === 'string' && v.length > 0);
  const depStack: string[] = report.stack?.dependencies
    ? Object.keys(report.stack.dependencies)
    : [];
  const legacyStack: string[] = Array.isArray(report.stack?.technologies)
    ? report.stack.technologies
    : Array.isArray(report.techStack)
      ? report.techStack
      : [];
  const stack = legacyStack.length > 0 ? legacyStack : [...scalarStack, ...depStack];

  return {
    name,
    slug,
    description: report.project?.description ?? report.description,
    repo: undefined, // not present in a SentinelScan report
    path: report.project?.path ?? report.path ?? cwd,
    stack,
  };
}

function parseArgs(): ProjectData {
  const args = process.argv.slice(2);

  // Mode 1: --from-scan <path>
  const fromScanIdx = args.indexOf('--from-scan');
  if (fromScanIdx !== -1 && args[fromScanIdx + 1]) {
    const scanPath = args[fromScanIdx + 1]!;
    if (!existsSync(scanPath)) {
      console.error(`Scan report not found: ${scanPath}`);
      process.exit(1);
    }
    const report = JSON.parse(readFileSync(scanPath, 'utf-8'));
    return mapScanReport(report);
  }

  // Mode 2: --name/--slug/--repo/--path/--stack flags
  function getFlag(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : undefined;
  }

  const name = getFlag('name');
  const slug = getFlag('slug');

  if (!name || !slug) {
    console.error('Usage: bun SaveProjectToStudio.ts --name "Name" --slug slug [--repo org/repo] [--path ~/path] [--stack "TS,Bun"]');
    process.exit(1);
  }

  return {
    name,
    slug,
    description: getFlag('description'),
    repo: getFlag('repo'),
    path: getFlag('path'),
    stack: getFlag('stack')?.split(',').map((s) => s.trim()) ?? [],
  };
}

async function syncProject(data: ProjectData, studio: { url: string; key: string }): Promise<void> {
  try {
    const res = await fetch(`${studio.url}/api/v1/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${studio.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Studio API error (${res.status}): ${text.slice(0, 200)}`);
      process.exit(1);
    }

    const result = await res.json();
    console.error(`Project registered: ${data.name} (${data.slug}) → ${result.id}`);
  } catch (err) {
    console.error(`Network error: ${(err as Error).message}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  loadEnv();
  const { url, key } = requireStudioConfigOrSkip('SaveProjectToStudio');
  const projectData = parseArgs();
  await syncProject(projectData, { url, key });
}
