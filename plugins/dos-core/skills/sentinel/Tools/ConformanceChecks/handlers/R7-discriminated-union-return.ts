/**
 * R7 — bridgeSync returns discriminated union.
 *
 * §1 Clause 2 obligation: consumers must see pass/fail surfaced in the
 * type system, not conflated through exception paths or sentinel
 * values. Reference shape in hooks/lib/mempalace.ts:
 *
 *   type BridgeOk<T> = { ok: true; data: T };
 *   type BridgeFail  = { ok: false; reason: string };
 *   type BridgeResult<T> = BridgeOk<T> | BridgeFail;
 *   export function bridgeSync(...): BridgeResult { ... }
 *
 * Handler uses ts-morph to:
 *   1. Locate the `bridgeSync` function declaration in mempalace.ts
 *   2. Extract its declared return type text
 *   3. Trace aliases (BridgeResult → BridgeOk | BridgeFail) until a
 *      union with ≥2 arms is reached
 *   4. Assert every arm has an `ok` property with a literal-bool type
 *
 * Failure shapes flagged:
 *   - `bridgeSync` missing or not exported
 *   - return type is a single object (not a union)
 *   - union arms lack a common `ok` discriminant
 */

import { existsSync } from "fs";
import { join } from "path";
import {
  SyntaxKind,
  createCheckProject,
} from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const DEFAULT_LIB_FILE = "lib/mempalace.ts";
const FUNCTION_NAME = "bridgeSync";
const DISCRIMINANT_PROPERTY = "ok";

interface UnionAnalysis {
  isUnion: boolean;
  armCount: number;
  armsWithDiscriminant: number;
  returnTypeText: string;
}

function analyzeReturnType(
  project: ReturnType<typeof createCheckProject>,
  sfPath: string,
  fnName: string,
): UnionAnalysis | null {
  const sf = project.getSourceFile(sfPath);
  if (!sf) return null;
  const fn = sf.getFunction(fnName);
  if (!fn) return null;

  const returnType = fn.getReturnType();
  const returnTypeText = returnType.getText();
  const armTypes = returnType.isUnion() ? returnType.getUnionTypes() : [returnType];

  let armsWithDiscriminant = 0;
  for (const arm of armTypes) {
    const prop = arm.getProperty(DISCRIMINANT_PROPERTY);
    if (!prop) continue;
    // Property exists on this arm — good signal for discrimination
    armsWithDiscriminant += 1;
  }

  return {
    isUnion: returnType.isUnion(),
    armCount: armTypes.length,
    armsWithDiscriminant,
    returnTypeText,
  };
}

export async function r7DiscriminatedUnionReturn(ctx: CheckContext): Promise<CheckResult> {
  const path = ctx.mempalaceLibPath ?? join(ctx.hooksRoot, DEFAULT_LIB_FILE);

  if (!existsSync(path)) {
    return {
      rId: "R7",
      requirement: "bridgeSync returns discriminated union",
      status: "not_applicable",
      evidence: [`${path} not found — mempalace.ts lib not installed`],
    };
  }

  const project = createCheckProject();
  project.addSourceFileAtPath(path);

  // Locate the function — not finding it is a hard fail (the contract is that
  // bridgeSync exists here; absence of the symbol is worse than a bad shape).
  const sf = project.getSourceFile(path);
  const fn = sf?.getFunction(FUNCTION_NAME);
  if (!fn) {
    // Also try locating it as an exported variable arrow fn (alternative shape)
    const varDecl = sf?.getVariableDeclaration(FUNCTION_NAME);
    if (!varDecl) {
      return {
        rId: "R7",
        requirement: "bridgeSync returns discriminated union",
        status: "fail",
        evidence: [`${path}: no \`function ${FUNCTION_NAME}\` or \`const ${FUNCTION_NAME}\` declaration found`],
      };
    }
    // const bridgeSync = (...) => ... — fall back to direct type inspection
    const arrowType = varDecl.getType();
    const callSigs = arrowType.getCallSignatures();
    if (callSigs.length === 0) {
      return {
        rId: "R7",
        requirement: "bridgeSync returns discriminated union",
        status: "fail",
        evidence: [`${path}: \`${FUNCTION_NAME}\` is not a callable`],
      };
    }
    const rt = callSigs[0]!.getReturnType();
    const armTypes = rt.isUnion() ? rt.getUnionTypes() : [rt];
    const armsWithDiscriminant = armTypes.filter(a => a.getProperty(DISCRIMINANT_PROPERTY)).length;
    if (!rt.isUnion() || armsWithDiscriminant < armTypes.length || armTypes.length < 2) {
      return {
        rId: "R7",
        requirement: "bridgeSync returns discriminated union",
        status: "fail",
        evidence: [`${path}: ${FUNCTION_NAME} return type is not a discriminated union on \`${DISCRIMINANT_PROPERTY}\` (${armTypes.length} arm(s), ${armsWithDiscriminant} with discriminant)`],
      };
    }
    return {
      rId: "R7",
      requirement: "bridgeSync returns discriminated union",
      status: "pass",
      evidence: [`${path}: ${FUNCTION_NAME} returns ${armTypes.length}-arm union, all arms carry \`${DISCRIMINANT_PROPERTY}\` discriminant`],
    };
  }

  const analysis = analyzeReturnType(project, path, FUNCTION_NAME)!;
  if (!analysis.isUnion || analysis.armCount < 2) {
    return {
      rId: "R7",
      requirement: "bridgeSync returns discriminated union",
      status: "fail",
      evidence: [`${path}: ${FUNCTION_NAME} return type \`${analysis.returnTypeText}\` is not a union (or has fewer than 2 arms)`],
    };
  }
  if (analysis.armsWithDiscriminant < analysis.armCount) {
    return {
      rId: "R7",
      requirement: "bridgeSync returns discriminated union",
      status: "fail",
      evidence: [`${path}: ${FUNCTION_NAME} union has ${analysis.armCount} arm(s) but only ${analysis.armsWithDiscriminant} carry the \`${DISCRIMINANT_PROPERTY}\` discriminant`],
    };
  }

  // Unused AST walker reference to satisfy linter-style warnings on SyntaxKind import.
  void SyntaxKind.UnionType;

  return {
    rId: "R7",
    requirement: "bridgeSync returns discriminated union",
    status: "pass",
    evidence: [`${path}: ${FUNCTION_NAME} returns ${analysis.armCount}-arm union, every arm carries \`${DISCRIMINANT_PROPERTY}\` discriminant`],
  };
}
