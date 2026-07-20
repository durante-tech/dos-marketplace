/**
 * Pack-local shim → canonical `~/.claude/hooks/lib/mempalace.ts`.
 *
 * Authored by Tools/migrate-pack-imports-to-shim.ts per PRD-D1 (C1-RedTeam-refined,
 * council-ratified 2026-05-21). Uses sync Bun `require()` of the homedir()-resolved
 * absolute path so the import works at BOTH pack-source paths and deployed
 * `~/.claude/skills/<P>/Lib/mempalace.ts` paths (the dual-path-resolution gap).
 *
 * DO NOT replace this with a relative-path import — the 5-up form breaks under
 * symlink-mode deployment. See:
 *   MEMORY/CANONICAL/patterns/pack-tool-stable-import-resolution.md
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

const canonical = join(homedir(), '.claude/hooks/lib/mempalace.ts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require(canonical);

export const bridgeSync: typeof import('../../../../../.claude/hooks/lib/mempalace').bridgeSync = mod.bridgeSync;
export const bridgeAsync: typeof import('../../../../../.claude/hooks/lib/mempalace').bridgeAsync = mod.bridgeAsync;
export const bridgeFire: typeof import('../../../../../.claude/hooks/lib/mempalace').bridgeFire = mod.bridgeFire;
export const bridgeObserved: typeof import('../../../../../.claude/hooks/lib/mempalace').bridgeObserved = mod.bridgeObserved;
export const bridgeAction: typeof import('../../../../../.claude/hooks/lib/mempalace').bridgeAction = mod.bridgeAction;
export const bridgeCmd: typeof import('../../../../../.claude/hooks/lib/mempalace').bridgeCmd = mod.bridgeCmd;
export const queryMemory: typeof import('../../../../../.claude/hooks/lib/mempalace').queryMemory = mod.queryMemory;
export const queueOp: typeof import('../../../../../.claude/hooks/lib/mempalace').queueOp = mod.queueOp;
export const batchOps: typeof import('../../../../../.claude/hooks/lib/mempalace').batchOps = mod.batchOps;
export const appendBridgeEvent: typeof import('../../../../../.claude/hooks/lib/mempalace').appendBridgeEvent = mod.appendBridgeEvent;
export const validatePredicate: typeof import('../../../../../.claude/hooks/lib/mempalace').validatePredicate = mod.validatePredicate;
export type { BridgeResult, BridgeOk, BridgeFail, BridgeOp, MemoryIntent, MemoryQuery, MemoryResult } from '../../../../../.claude/hooks/lib/mempalace';
