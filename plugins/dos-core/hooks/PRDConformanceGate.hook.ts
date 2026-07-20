#!/usr/bin/env bun
/**
 * PRDConformanceGate.hook.ts — V12.3-β Gate A (RFC-0082 §2.2)
 *
 * TRIGGER: PostToolUse for Write/Edit/MultiEdit on MEMORY/WORK/{slug}/PRD.md
 *
 * BEHAVIOR (non-blocking per v0.0.8 §2 sole-writer principle):
 * - Parses the just-written PRD via @durante/prd parsePRDFile()
 * - Surfaces conformance findings as additionalContext (visible next turn)
 * - Records to MEMORY/STATE/prd-conformance.jsonl
 * - Returns {continue: true} unconditionally — NEVER blocks Write/Edit
 *
 * Per RFC-0082 §2.2 Gate A spec: "block bad PRDs from being declared complete"
 * happens at Gate B (PhaseCompleteGate extension), not here. This gate is the
 * observational surface that gives the assistant feedback in the next turn.
 *
 * Conformance checks (V12.3-β α-scope):
 * 1. format_version is valid {2, 3} (RFC-0081 §2.3 failure-closed)
 * 2. vNext PRDs at effort >= standard have parent_rfc field (R44 invariant)
 * 3. Frontmatter parses without error
 *
 * Future checks (V12.3-β β-scope):
 * 4. AC ⊂ OoS subset relation per R45
 * 5. Section ordering matches format_version
 * 6. Required Algorithm-output sections present per effort tier
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { prdPathFromHookPayload } from "./lib/prd-kg";
import { dosPath } from "./lib/paths";
// RFC-0112 D1: PRD-parser primitives route THROUGH ./lib/prd-utils (the
// fail-soft loader) — never a direct static `@durante/prd` import, which
// would crash this hook's module load on a fresh install with no node_modules.
import { detectFormatVersion, parsePRDContent, getScalarField, prdAvailable } from "./lib/prd-utils";
import { emitPostToolUseContext } from "./lib/hook-output";

const STANDARD_PLUS = new Set(["standard", "extended", "advanced", "deep", "xhigh", "comprehensive"]);

interface ConformanceFinding {
  severity: "info" | "warn";
  code: string;
  message: string;
}

function check(prdPath: string): ConformanceFinding[] {
  const findings: ConformanceFinding[] = [];
  let content: string;
  try { content = readFileSync(prdPath, "utf-8"); } catch {
    findings.push({ severity: "info", code: "prd-unreadable", message: `cannot read ${prdPath}` });
    return findings;
  }

  // RFC-0112: fail-soft degradation. With the PRD parser unresolved the
  // conformance checks cannot run; return an info-only finding (info never
  // surfaces as a warn, so the gate stays a non-blocking pass). Never crash.
  if (!prdAvailable) {
    console.error('[PRDConformanceGate] @durante/prd degraded (RFC-0112) — conformance checks skipped');
    findings.push({ severity: "info", code: "prd-degraded", message: "@durante/prd unresolved (RFC-0112 fail-soft) — conformance checks skipped" });
    return findings;
  }

  // Progress-denominator parity — mirrors Sentinel R65 (presence.prd-progress-
  // denominator). R65 audits at periodic scan time; this surfaces the same
  // drift at authoring time so the assistant gets next-turn feedback instead
  // of discovering it sessions later (Algorithm v0.0.10 §6.1.e6 MECHANICAL
  // PRE-READ). Version-agnostic — applies to v2 and vNext PRDs alike.
  // Scope the progress read to the frontmatter block: `progress:` is a frontmatter
  // field, but an unscoped /m match also hit a line-start `progress: X/Y` in the
  // BODY (format examples in a PRD-about-PRDs), producing a spurious mismatch warn.
  // (Forge Gen 25.)
  const fmBlock = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const progressMatch = fmBlock ? fmBlock[1].match(/^progress:\s*(\d+)\/(\d+)\s*$/m) : null;
  if (progressMatch) {
    const denominator = Number(progressMatch[2]);
    const bodyCount = (content.match(/^- \[[ x]\] ISC-/gm) ?? []).length;
    if (denominator !== bodyCount) {
      findings.push({
        severity: "warn",
        code: "progress-denominator-mismatch",
        message: `progress denominator ${denominator} ≠ ${bodyCount} body ISC line(s) — recount per §6.1.e6 MECHANICAL PRE-READ (Sentinel R65 audits the same at scan time)`,
      });
    }
  }

  const version = detectFormatVersion(content);
  if (version.status === "invalid") {
    findings.push({
      severity: "warn",
      code: "format-version-invalid",
      message: `format_version: ${JSON.stringify(version.raw)} is not in closed enum {2, 3} per RFC-0080 §2.2`,
    });
    return findings;
  }

  // R44 — parent_rfc required for effort >= standard on vNext
  if (version.status === "valid" && version.version === 3) {
    let doc;
    try { doc = parsePRDContent(content); } catch (e) {
      findings.push({ severity: "warn", code: "parse-error", message: String((e as Error).message).slice(0, 200) });
      return findings;
    }
    const effort = getScalarField(doc.frontmatter, "effort")?.toLowerCase();
    if (effort && STANDARD_PLUS.has(effort)) {
      const parentRfc = getScalarField(doc.frontmatter, "parent_rfc");
      if (!parentRfc) {
        findings.push({
          severity: "warn",
          code: "missing-parent-rfc",
          message: `vNext PRD at effort: ${effort} should declare parent_rfc field (or 'none' for orphan) per RFC-0080 §2.2 + R44`,
        });
      }
    }
  }

  return findings;
}

async function main() {
  let input: any;
  try { input = JSON.parse(readFileSync(0, "utf-8")); } catch { process.exit(0); }
  const prdPath = prdPathFromHookPayload(input);
  if (!prdPath) process.exit(0);
  if (!existsSync(prdPath)) process.exit(0);

  const findings = check(prdPath);
  const logPath = dosPath("MEMORY", "STATE", "prd-conformance.jsonl");
  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, JSON.stringify({
      ts: new Date().toISOString(),
      prd: prdPath,
      findings,
    }) + "\n");
  } catch {}

  if (findings.length === 0) process.exit(0);

  const warns = findings.filter(f => f.severity === "warn");
  if (warns.length > 0) {
    const lines = warns.map(f => `  - [${f.code}] ${f.message}`);
    const additionalContext = `🚨 PRD CONFORMANCE (${prdPath}):\n${lines.join("\n")}`;
    // PostToolUse additionalContext MUST be nested under hookSpecificOutput; the
    // emitter carries the {continue:true} never-blocks contract.
    emitPostToolUseContext(additionalContext);
  }
  process.exit(0);
}

main();
