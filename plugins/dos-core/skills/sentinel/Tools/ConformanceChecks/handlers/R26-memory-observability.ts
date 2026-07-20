/**
 * R26 — Bridge call sites must be observable via the audit-log-collector port.
 *
 * Post-V11.7 (RFC-0075 §0.5) the bridge audit log moved out of the Python
 * bridge and into the TypeScript hook lib. The previous R26 looked for
 * "memory-events.jsonl" inside the bridge facade — a string that no
 * longer exists there because the audit-log writer is now
 * ~/.claude/hooks/lib/audit-log-collector.ts and the JSONL was renamed
 * to bridge-actions.jsonl.
 *
 * Convention (post-V11.7):
 *   1. ~/.claude/hooks/lib/audit-log-collector.ts MUST exist and write
 *      bridge-actions.jsonl (the canonical audit log filename).
 *   2. ~/.claude/hooks/lib/mempalace.ts MUST import recordBridgeAction
 *      from ./audit-log-collector, so every bridgeSync / bridgeFire /
 *      bridgeAsync call is observable.
 *
 * Pass: both invariants hold.
 * Fail: collector missing, audit-log filename missing, or mempalace.ts
 * does not import recordBridgeAction.
 * Not_applicable: hooks/lib not present (non-DOS install).
 *
 * Why R-class: silent bridge operations were the primary observability gap
 * identified in the post-tragedy audit. A bridge that doesn't emit events
 * makes it impossible to diagnose what the agent did with memory at runtime.
 *
 * Pre-V11.7 reference: the Python bridge used to write memory-events.jsonl
 * directly. RFC-0075 §0.5 moved the writer to the TS hook layer because
 * (a) the bridge daemon makes Python-side append-on-every-call expensive,
 * (b) the TS layer already wraps every call site through
 *     bridgeSync/bridgeFire/bridgeAsync, and (c) renaming to
 *     bridge-actions.jsonl made the audit log first-class rather than a
 *     side-effect of a single observation port.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "audit-log-collector.ts must write bridge-actions.jsonl AND mempalace.ts must invoke recordBridgeAction (post-V11.7 audit-log invariant)";

const COLLECTOR_TOKEN = "bridge-actions.jsonl";
const COLLECTOR_EXPORT = "recordBridgeAction";

export async function r26MemoryObservability(ctx: CheckContext): Promise<CheckResult> {
  // Test seam (added 2026-05-25, v0.0.18 close-out flaky-test audit): allow
  // ctx.hooksLibPath to override the homedir-derived default so this rule
  // can be fixtured without requiring HOME-relative test files. Production
  // behaviour is unchanged when the seam is absent.
  const hooksLib = ctx.hooksLibPath ?? join(homedir(), ".claude", "hooks", "lib");
  const collectorPath = join(hooksLib, "audit-log-collector.ts");
  const mempalacePath = join(hooksLib, "mempalace.ts");

  if (!existsSync(hooksLib)) {
    return {
      rId: "R26",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`hooks/lib/ not found at ${hooksLib} — non-DOS install`],
    };
  }

  const evidence: string[] = [];

  // Invariant 1: collector exists and writes bridge-actions.jsonl
  if (!existsSync(collectorPath)) {
    evidence.push(`${collectorPath}: audit-log-collector.ts not found — bridge calls have no audit-log writer`);
  } else {
    let collectorSrc: string;
    try {
      collectorSrc = readFileSync(collectorPath, "utf-8");
    } catch (err) {
      return {
        rId: "R26",
        requirement: REQUIREMENT,
        status: "fail",
        evidence: [`${collectorPath} unreadable: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
    if (!collectorSrc.includes(COLLECTOR_TOKEN)) {
      evidence.push(`${collectorPath}: missing reference to '${COLLECTOR_TOKEN}' — audit-log filename not wired`);
    }
    if (!collectorSrc.includes(`export function ${COLLECTOR_EXPORT}`) && !collectorSrc.includes(`export const ${COLLECTOR_EXPORT}`)) {
      evidence.push(`${collectorPath}: missing exported function/const '${COLLECTOR_EXPORT}' — call sites cannot invoke the writer`);
    }
  }

  // Invariant 2: mempalace.ts imports recordBridgeAction
  if (!existsSync(mempalacePath)) {
    evidence.push(`${mempalacePath}: mempalace.ts not found — bridge wrapper layer absent`);
  } else {
    let mempalaceSrc: string;
    try {
      mempalaceSrc = readFileSync(mempalacePath, "utf-8");
    } catch (err) {
      return {
        rId: "R26",
        requirement: REQUIREMENT,
        status: "fail",
        evidence: [`${mempalacePath} unreadable: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
    const importsCollector =
      mempalaceSrc.includes(`from './audit-log-collector'`) ||
      mempalaceSrc.includes(`from "./audit-log-collector"`) ||
      mempalaceSrc.includes(`from './audit-log-collector.ts'`) ||
      mempalaceSrc.includes(`from "./audit-log-collector.ts"`);
    if (!importsCollector) {
      evidence.push(`${mempalacePath}: does not import from ./audit-log-collector — bridge calls bypass the audit log`);
    }
    if (!mempalaceSrc.includes(COLLECTOR_EXPORT)) {
      evidence.push(`${mempalacePath}: does not reference ${COLLECTOR_EXPORT} — bridge call sites are unobservable`);
    }
  }

  if (evidence.length === 0) {
    return {
      rId: "R26",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${collectorPath}: writes ${COLLECTOR_TOKEN} via ${COLLECTOR_EXPORT}`,
        `${mempalacePath}: imports ${COLLECTOR_EXPORT} from ./audit-log-collector`,
      ],
    };
  }

  return {
    rId: "R26",
    requirement: REQUIREMENT,
    status: "fail",
    evidence,
  };
}
