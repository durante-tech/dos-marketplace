#!/usr/bin/env bun
/**
 * OrchestratorCapabilities.hook.ts — RFC-0026 registry refresh.
 *
 * Trigger: SessionStart
 *
 * Generates the DOS runtime capability registry used by prompt contracts and
 * PreToolUse gates. Generation is deterministic so hooks can compare hashes.
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { capabilityRegistryPath, writeCapabilityRegistry } from "../DOS/Tools/orchestrator/index";
import { startTimer, stopTimer } from "./lib/hook-io";
import { traceOrchestrator } from "./lib/orchestrator-trace";
import { loadProjectEnv } from "./lib/paths";

loadProjectEnv();

const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const STATE_DIR = process.env.DOS_ORCH_STATE_DIR || join(DOS_DIR, "MEMORY", "STATE", "orchestrator");
const ENABLED = process.env.DOS_ORCH_ENABLED !== "0";

async function main(): Promise<void> {
  traceOrchestrator({ hook: "capabilities", event: "start", details: { state_dir: STATE_DIR } });
  if (!ENABLED) {
    traceOrchestrator({ hook: "capabilities", event: "env-disabled", details: { state_dir: STATE_DIR } });
    process.exit(0);
  }

  const path = process.env.DOS_ORCH_CAPABILITY_REGISTRY || capabilityRegistryPath(DOS_DIR, STATE_DIR);
  const registry = writeCapabilityRegistry(DOS_DIR, path);
  traceOrchestrator({
    hook: "capabilities",
    event: "registry-built",
    details: {
      path,
      entries: registry.entries.length,
      diagnostics: registry.diagnostics.length,
      hash: registry.hash,
    },
  });
  process.exit(0);
}

const _t = startTimer("OrchestratorCapabilities");
process.on("exit", () => stopTimer(_t, "SessionStart"));
main().catch((error) => {
  traceOrchestrator({
    hook: "capabilities",
    event: "error",
    reason: error instanceof Error ? error.message : String(error),
  });
  console.error(`[OrchestratorCapabilities] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
});
