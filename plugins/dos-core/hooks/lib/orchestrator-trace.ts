import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export interface OrchestratorTraceEvent {
  hook: "prompt" | "gate" | "capabilities";
  event: string;
  session_id?: string;
  phase?: string | null;
  mode?: string;
  tool_name?: string;
  state_path?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

function tracePath(): string {
  const dosDir = process.env.DOS_DIR || join(homedir(), ".claude");
  const stateDir = process.env.DOS_ORCH_STATE_DIR || join(dosDir, "MEMORY", "STATE", "orchestrator");
  return process.env.DOS_ORCH_TRACE_PATH || join(stateDir, "trace.jsonl");
}

export function traceOrchestrator(event: OrchestratorTraceEvent): void {
  if (process.env.DOS_ORCH_TRACE === "0") return;
  try {
    const path = tracePath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      path,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        pid: process.pid,
        cwd: process.cwd(),
        enabled: process.env.DOS_ORCH_ENABLED ?? null,
        gate_mode: process.env.DOS_ORCH_GATE_MODE ?? null,
        ...event,
      })}\n`,
      "utf8",
    );
  } catch {
    // Tracing must never affect hook behavior.
  }
}
