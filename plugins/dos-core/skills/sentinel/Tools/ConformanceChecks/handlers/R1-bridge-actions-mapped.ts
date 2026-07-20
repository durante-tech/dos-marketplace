/**
 * R1 — No hook invokes a bridge action not in `ACTIONS` dict.
 *
 * Parses the canonical ACTIONS dict from the configured bridge.py
 * (§6.3), then walks every *.hook.ts under hooksRoot for bridge
 * invocations. Flags any call whose action name isn't in ACTIONS.
 *
 * Recognized call shapes (all with the action as a string literal):
 *   bridgeFire("<action>", ...)
 *   bridgeSync("<action>", ...)
 *   queueOp(ops, "<action>", ...)
 *
 * Dynamic action arguments (variable / expression) are NOT flagged —
 * the handler can't statically verify them and silent-skip is worse
 * than conservative-skip for unverifiable cases. The evidence output
 * notes when such calls exist.
 *
 * Exempt pragma: `// conformance:R1-exempt`
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import {
  SyntaxKind,
  createCheckProject,
  hasExemptPragma,
  walkFiles,
} from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const DEFAULT_BRIDGE = join(
  homedir(),
  ".claude",
  "DOS",
  "Tools",
  "mempalace_bridge.py",
);

const EXEMPT_PRAGMA = /conformance:R1-exempt/;

// V11.13 split bridge.py into a facade + 3 modules. The ACTIONS dispatch
// table moved out of the facade — it is now built dynamically by
// `_build_actions_table(...)` in _bridge_palace.py and assigned to
// `_ACTIONS_CACHE = { ... }` (the canonical literal). We co-scan the
// facade and the sibling palace module if it exists; tests pin a
// single-file fixture which preserves prior behavior.
function bridgeScanPaths(ctxPath: string | undefined): string[] {
  const facade = ctxPath ?? DEFAULT_BRIDGE;
  const palace = join(dirname(facade), "_bridge_palace.py");
  return existsSync(palace) ? [facade, palace] : [facade];
}

/** Extract the canonical ACTIONS dict keys from bridge module source.
 * Matches either the legacy top-level `ACTIONS = { ... }` literal
 * (pre-V11.13 single-file shape) or the post-split `_ACTIONS_CACHE =
 * { ... }` literal inside _build_actions_table(). Both forms enumerate
 * the dispatch table the same way. */
function extractActionKeys(bridgeSrc: string): Set<string> {
  const literalRe = /^\s*(?:ACTIONS|_ACTIONS_CACHE)\s*=\s*\{([\s\S]*?)^\s*\}/m;
  const match = literalRe.exec(bridgeSrc);
  if (!match) return new Set();
  const body = match[1]!;
  const keys = new Set<string>();
  const keyRe = /['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(body)) !== null) {
    keys.add(m[1]!);
  }
  return keys;
}

interface ActionCall {
  action: string | null; // null = non-literal, cannot statically verify
  line: number;
}

function extractActionCalls(sf: ReturnType<ReturnType<typeof createCheckProject>["getSourceFiles"]>[number]): ActionCall[] {
  const calls: ActionCall[] = [];
  const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const c of callExprs) {
    const callee = c.getExpression().getText();
    const args = c.getArguments();
    let actionArgIdx: number | null = null;
    if (callee === "bridgeFire" || callee === "bridgeSync") actionArgIdx = 0;
    else if (callee === "queueOp") actionArgIdx = 1;
    if (actionArgIdx === null) continue;
    const arg = args[actionArgIdx];
    if (!arg) continue;
    if (arg.getKind() === SyntaxKind.StringLiteral || arg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
      const raw = arg.getText().replace(/^['"`]|['"`]$/g, "");
      calls.push({ action: raw, line: c.getStartLineNumber() });
    } else {
      calls.push({ action: null, line: c.getStartLineNumber() });
    }
  }
  return calls;
}

export async function r1BridgeActionsMapped(ctx: CheckContext): Promise<CheckResult> {
  const paths = bridgeScanPaths(ctx.bridgePath);
  const existing = paths.filter((p) => existsSync(p));

  if (existing.length === 0) {
    return {
      rId: "R1",
      requirement: "No hook invokes a bridge action not in `ACTIONS` dict",
      status: "not_applicable",
      evidence: [`${paths.join(", ")} not found — bridge not installed`],
    };
  }

  let bridgeSrc = "";
  for (const p of existing) bridgeSrc += readFileSync(p, "utf-8") + "\n";
  const label = existing.length === 1 ? existing[0] : existing.join(" + ");

  const actionKeys = extractActionKeys(bridgeSrc);
  if (actionKeys.size === 0) {
    return {
      rId: "R1",
      requirement: "No hook invokes a bridge action not in `ACTIONS` dict",
      status: "fail",
      evidence: [`${label}: could not extract ACTIONS dict — was the top-level literal renamed?`],
    };
  }

  const files = walkFiles(ctx.hooksRoot, (name) => name.endsWith(".hook.ts"));
  if (files.length === 0) {
    return {
      rId: "R1",
      requirement: "No hook invokes a bridge action not in `ACTIONS` dict",
      status: "not_applicable",
      evidence: [`no *.hook.ts found under ${ctx.hooksRoot}`],
    };
  }

  const project = createCheckProject();
  project.addSourceFilesAtPaths(files);

  const evidence: string[] = [];
  let dynamicCalls = 0;

  for (const sf of project.getSourceFiles()) {
    const fullText = sf.getFullText();
    if (!fullText.includes("bridgeFire") && !fullText.includes("bridgeSync") && !fullText.includes("queueOp")) continue;
    const filePath = sf.getFilePath();
    const lines = fullText.split("\n");
    for (const { action, line } of extractActionCalls(sf)) {
      if (action === null) { dynamicCalls++; continue; }
      if (actionKeys.has(action)) continue;
      // Look up the call node at this line for pragma check
      const callExpr = sf.getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((c) => c.getStartLineNumber() === line);
      if (callExpr && hasExemptPragma(callExpr, lines, EXEMPT_PRAGMA)) continue;
      evidence.push(`${filePath}:${line}  calls bridge action "${action}" which is not in ACTIONS dict`);
    }
  }

  const suffix = dynamicCalls > 0 ? ` (${dynamicCalls} dynamic action arg(s) not statically verified)` : "";
  return {
    rId: "R1",
    requirement: "No hook invokes a bridge action not in `ACTIONS` dict",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence: evidence.length === 0
      ? [`${files.length} *.hook.ts clean — ${actionKeys.size} ACTIONS key(s) known${suffix}`]
      : evidence,
  };
}
