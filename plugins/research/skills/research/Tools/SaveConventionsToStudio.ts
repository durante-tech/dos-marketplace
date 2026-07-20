#!/usr/bin/env bun
/**
 * SaveConventionsToStudio - Sync Sentinel scan results to Studio
 *
 * Reads .sentinel/ artifacts from a project and PATCHes the project's sentinel data.
 *
 * USAGE
 * -----
 *   bun SaveConventionsToStudio.ts --project-path /path/to/repo --slug wing-name
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

function parseArgs(): { projectPath: string; slug: string } {
  const args = process.argv.slice(2);

  function getFlag(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : undefined;
  }

  const projectPath = getFlag('project-path');
  const slug = getFlag('slug');

  if (!projectPath || !slug) {
    console.error('Usage: bun SaveConventionsToStudio.ts --project-path /path/to/repo --slug wing-name');
    process.exit(1);
  }

  return { projectPath, slug };
}

function readJsonFile(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.error(`Failed to parse: ${path}`);
    return null;
  }
}

export function extractArchitecturePattern(scanReport: Record<string, unknown>): string | null {
  // SentinelScan emits `structure.hasMonorepo` (boolean) — the field actually
  // present in scan-report.json. The historical top-level `monorepo` /
  // `architecture` keys this code first checked never existed in a real report,
  // so architecturePattern was always null. Read the real field first; keep the
  // legacy fallbacks for any external report shapes.
  if (scanReport.structure && typeof scanReport.structure === 'object') {
    const structure = scanReport.structure as Record<string, unknown>;
    if (structure.hasMonorepo) return 'monorepo';
  }
  if (scanReport.monorepo) return 'monorepo';
  if (scanReport.architecture) return String(scanReport.architecture);
  if (scanReport.project && typeof scanReport.project === 'object') {
    const proj = scanReport.project as Record<string, unknown>;
    if (proj.architecture) return String(proj.architecture);
  }
  return null;
}

export function extractStack(scanReport: Record<string, unknown>): string[] {
  // Legacy shapes: explicit technologies array (never present in a real report).
  if (Array.isArray((scanReport.stack as Record<string, unknown> | undefined)?.technologies)) {
    return (scanReport.stack as Record<string, unknown>).technologies as string[];
  }
  if (Array.isArray(scanReport.techStack)) return scanReport.techStack as string[];
  if (scanReport.stack && typeof scanReport.stack === 'object') {
    const stack = scanReport.stack as Record<string, unknown>;
    if (Array.isArray(stack.technologies)) return stack.technologies as string[];
    // Real SentinelScan shape: synthesize the stack list from the scalar
    // language / framework / runtime fields that scan-report.json actually
    // carries. Without this the `body.stack` column stayed empty for every
    // scanned project.
    const synthesized = [stack.language, stack.framework, stack.runtime]
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (synthesized.length > 0) return synthesized;
  }
  return [];
}

async function syncConventions(
  projectPath: string,
  slug: string,
  studio: { url: string; key: string },
): Promise<void> {
  const { url: STUDIO_API_URL, key: STUDIO_API_KEY } = studio;
  const sentinelDir = join(projectPath, '.sentinel');

  // Sentinel scan writes `conventions-raw.json` (full inference output) and
  // `conventions.json` (enriched cache used by Guard hook). The legacy
  // `convention-report.json` only exists at older scan paths. Prefer the
  // full structure; fall back through cache; legacy stays last for
  // backwards-compat with pre-bootstrap projects.
  const conventions =
    readJsonFile(join(sentinelDir, 'conventions-raw.json')) ??
    readJsonFile(join(sentinelDir, 'conventions.json')) ??
    readJsonFile(join(sentinelDir, 'convention-report.json'));
  const healthData = readJsonFile(join(sentinelDir, 'health.json')) as Record<string, unknown> | null;
  const scanReport = readJsonFile(join(sentinelDir, 'scan-report.json')) as Record<string, unknown> | null;

  if (!conventions && !healthData && !scanReport) {
    console.error(`No .sentinel/ artifacts found in ${projectPath}`);
    process.exit(0);
  }

  const nowIso = new Date().toISOString();
  const body: Record<string, unknown> = {
    lastScannedAt: nowIso,
    // Mirror — schema declares both lastScannedAt and lastSentinelScanAt;
    // older readers may still query lastSentinelScanAt. Send both to keep
    // the column populated without a migration coupling step.
    lastSentinelScanAt: nowIso,
  };

  if (conventions) {
    body.conventions = conventions;
    // The full conventions payload travels via `conventions`. The
    // structured rule list (just the conventions[] array) and the count
    // populate the dedicated columns the schema reserved for them.
    if (
      typeof conventions === 'object' &&
      conventions !== null &&
      Array.isArray((conventions as Record<string, unknown>).conventions)
    ) {
      const rules = (conventions as Record<string, unknown>).conventions as unknown[];
      body.conventionRules = rules;
      body.conventionCount = rules.length;
    }
  }

  if (healthData) {
    const score = healthData.score ?? healthData.healthScore ?? healthData.overall;
    if (score !== undefined) {
      body.healthScore = Number(score);
    }
  }

  if (scanReport) {
    const arch = extractArchitecturePattern(scanReport);
    if (arch) body.architecturePattern = arch;

    const stack = extractStack(scanReport);
    if (stack.length > 0) body.stack = stack;

    // Full raw scan report — preserves intelligence Studio doesn't yet
    // surface (git metadata, file stats, dep tree). Cheap to send,
    // expensive to lose.
    body.sentinelScanRaw = scanReport;
  }

  try {
    const res = await fetch(`${STUDIO_API_URL}/api/v1/projects/${encodeURIComponent(slug)}/sentinel`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${STUDIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Studio API error (${res.status}) for project "${slug}": ${text.slice(0, 200)}`);
      process.exit(1);
    }

    console.error(`Sentinel data synced for project "${slug}": conventions=${!!conventions}, health=${!!healthData}, scan=${!!scanReport}`);
  } catch (err) {
    console.error(`Network error: ${(err as Error).message}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  loadEnv();
  const { url, key } = requireStudioConfigOrSkip('SaveConventionsToStudio');
  const { projectPath, slug } = parseArgs();
  await syncConventions(projectPath, slug, { url, key });
}
