#!/usr/bin/env bun
/**
 * ReconcileStudio — Audit and sync all DOS data to Studio
 *
 * Single command to ensure local DOS state is fully reflected in Studio.
 * Runs all sync tools + backfill in order.
 *
 * USAGE: bun ReconcileStudio.ts
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('ReconcileStudio');

const TOOLS_DIR = join(homedir(), '.claude', 'skills', 'research', 'Tools');

async function runTool(name: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  const toolPath = join(TOOLS_DIR, name);
  if (!existsSync(toolPath)) {
    return { ok: false, output: `Tool not found: ${toolPath}` };
  }

  try {
    const result = Bun.spawnSync(['bun', toolPath, ...args], {
      timeout: 60000,
      env: process.env,
    });
    const stderr = new TextDecoder().decode(result.stderr);
    const stdout = new TextDecoder().decode(result.stdout);
    return { ok: result.exitCode === 0, output: (stderr + stdout).trim().split('\n').slice(-2).join(' | ') };
  } catch (err) {
    return { ok: false, output: String(err) };
  }
}

async function runBackfill(): Promise<string> {
  try {
    const res = await fetch(`${STUDIO_API_URL}/api/v1/projects/backfill`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STUDIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return `Backfill failed: ${res.status}`;
    const data = await res.json() as { updated: number; skipped: number };
    return `${data.updated} linked, ${data.skipped} skipped`;
  } catch (err) {
    return `Backfill error: ${(err as Error).message}`;
  }
}

console.error('╔═══════════════════════════════════════╗');
console.error('║     DOS → STUDIO RECONCILIATION       ║');
console.error('╚═══════════════════════════════════════╝');
console.error('');

// Step 1: Sync work sessions
console.error('1. Work Sessions...');
const work = await runTool('SaveWorkToStudio.ts', ['--import-all']);
console.error(`   ${work.output}`);

// Step 2: Sync research
console.error('2. Research...');
const research = await runTool('SaveResearchVaultsToStudio.ts', ['--import-all']);
console.error(`   ${research.output}`);

// Step 3: Sync reflections
console.error('3. Reflections...');
const reflections = await runTool('SaveReflectionsToStudio.ts', ['--import-all']);
console.error(`   ${reflections.output}`);

// Step 4: Sync signals
console.error('4. Signals...');
const signals = await runTool('SaveSignalsToStudio.ts', ['--import-all']);
console.error(`   ${signals.output}`);

// Step 5: Sync commitments
console.error('5. Commitments...');
const commitments = await runTool('SaveCommitmentsToStudio.ts', ['--import-all']);
console.error(`   ${commitments.output}`);

// Step 6: Sync deferrals
console.error('6. Deferrals...');
const deferrals = await runTool('SaveDeferralsToStudio.ts', ['--import-all']);
console.error(`   ${deferrals.output}`);

// Step 7: Run project backfill
console.error('7. Project Backfill...');
const backfill = await runBackfill();
console.error(`   ${backfill}`);

console.error('');
console.error('Reconciliation complete.');
