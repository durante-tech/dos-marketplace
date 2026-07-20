#!/usr/bin/env bun
/**
 * ObservedBridgeWorker.ts — detached bridge worker with result ledger.
 *
 * Foreground hooks write a small JSON payload and spawn this worker. The worker
 * calls bridgeSync, appends a success/failure event to
 * MEMORY/STATE/mempalace-bridge-events.jsonl, and exits. Bridge failures are
 * also appended to mempalace-errors.jsonl by runObservedBridgeWorker.
 */

import { readFileSync, unlinkSync } from 'fs';
import { appendBridgeEvent, runObservedBridgeWorker, type ObservedBridgeWorkerInput } from './lib/mempalace';

const inputPath = process.argv[2] || process.env.MEMPALACE_BRIDGE_INPUT_FILE || '';

if (!inputPath) {
  appendBridgeEvent({
    source: 'observedBridgeWorker',
    action: 'unknown',
    ok: false,
    reason: 'missing input path',
  });
  process.exit(1);
}

let input: ObservedBridgeWorkerInput;
try {
  input = JSON.parse(readFileSync(inputPath, 'utf-8')) as ObservedBridgeWorkerInput;
} catch (err) {
  appendBridgeEvent({
    source: 'observedBridgeWorker',
    action: 'unknown',
    ok: false,
    reason: `read-input-error: ${err instanceof Error ? err.message : String(err)}`,
  });
  process.exit(1);
}

try { unlinkSync(inputPath); } catch {}

const result = runObservedBridgeWorker(input);
process.exit(result.ok ? 0 : 1);
