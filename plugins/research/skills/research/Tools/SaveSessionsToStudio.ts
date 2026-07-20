#!/usr/bin/env bun
/**
 * SaveSessionsToStudio - Sync session metadata to Studio Sessions API
 *
 * Reads history.jsonl + session-names.json and POSTs each session
 * to /api/v1/sessions.
 *
 * USAGE
 * -----
 *   bun SaveSessionsToStudio.ts --import-all
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveSessionsToStudio');

interface HistoryEntry {
  timestamp: number;
  sessionId: string;
  project?: string;
  display?: string;
}

interface SessionData {
  sessionId: string;
  displayName: string | null;
  projectPath: string | null;
  startedAt: string;
  endedAt: string;
  messageCount: number;
}

import { queueOrPost, digestOfBody, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';

async function syncSession(
  session: SessionData,
  acked: Set<string>,
  onSkip: () => void,
): Promise<boolean> {
  const body = session;
  // RFC-0062 F3 — gate cross-tenant projectPath fields at the producer.
  // payload.projectPath is the canonical leak field for sessions (the
  // 528 live + 4,631 historical altyaa envelopes were dominated by this).
  const gate = crossTenantGate({
    tool: 'sessions',
    endpoint: '/api/v1/sessions',
    absPath: body.projectPath,
    source: 'SaveSessionsToStudio',
    payload: body,
  });
  if (!gate.ok) return false;
  const key = `sessions:${session.sessionId}:${digestOfBody(body)}`;
  if (acked.has(key)) { onSkip(); return true; } // already synced — skip
  const result = await queueOrPost(body, '/api/v1/sessions', {
    tool: 'sessions',
    idempotencyKey: key,
  });
  if (result.outcome === 'dropped') {
    console.error(`Sync dropped for ${session.sessionId}: ${result.reason}`);
    return false;
  }
  return true;
}

async function importAll(): Promise<void> {
  const historyPath = join(homedir(), '.claude', 'history.jsonl');
  const namesPath = join(homedir(), '.claude', 'MEMORY', 'STATE', 'session-names.json');

  if (!existsSync(historyPath)) {
    console.error('No history.jsonl found');
    process.exit(0);
  }

  // Load session names
  let sessionNames: Record<string, string> = {};
  if (existsSync(namesPath)) {
    try {
      sessionNames = JSON.parse(readFileSync(namesPath, 'utf-8'));
    } catch { /* ignore parse errors */ }
  }

  // Parse history entries
  const lines = readFileSync(historyPath, 'utf-8').split('\n').filter((l) => l.trim());
  const sessionMap = new Map<string, { startedAt: number; endedAt: number; messageCount: number; projectPath: string | null }>();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as HistoryEntry;
      if (!entry.sessionId) continue;

      const existing = sessionMap.get(entry.sessionId);
      if (existing) {
        existing.endedAt = Math.max(existing.endedAt, entry.timestamp);
        existing.startedAt = Math.min(existing.startedAt, entry.timestamp);
        existing.messageCount++;
        if (!existing.projectPath && entry.project) {
          existing.projectPath = entry.project;
        }
      } else {
        sessionMap.set(entry.sessionId, {
          startedAt: entry.timestamp,
          endedAt: entry.timestamp,
          messageCount: 1,
          projectPath: entry.project || null,
        });
      }
    } catch { /* skip malformed lines */ }
  }

  const acked = loadAckedKeys("sessions:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const [sessionId, data] of sessionMap) {
    const session: SessionData = {
      sessionId,
      displayName: sessionNames[sessionId] || null,
      projectPath: data.projectPath,
      startedAt: new Date(data.startedAt).toISOString(),
      endedAt: new Date(data.endedAt).toISOString(),
      messageCount: data.messageCount,
    };

    const before = skipped;
    const ok = await syncSession(session, acked, () => { skipped++; });
    if (skipped > before) { /* already-synced row skipped — not counted as synced */ }
    else if (ok) synced++;
    else failed++;
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped, ${failed} failed (of ${sessionMap.size} total)`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveSessionsToStudio.ts --import-all');
  process.exit(1);
}
