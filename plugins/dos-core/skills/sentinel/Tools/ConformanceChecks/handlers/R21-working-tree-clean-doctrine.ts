/**
 * R21 — Active doctrine references the WORKING-TREE-CLEAN GATE.
 *
 * Reads the active Algorithm doctrine file (resolved from the LATEST pointer
 * under hooksRoot/../DOS/Algorithm/LATEST) and verifies it contains the token
 * "WORKING-TREE-CLEAN" or "working-tree-clean-gate". Sub-documents under the
 * Algorithm directory are also scanned.
 *
 * If the token is absent from ALL doctrine files, the gate is not enforced at
 * the doctrine level — agents loading that version will silently skip the gate.
 *
 * Path resolution:
 *   algoDir = join(ctx.hooksRoot, '..', 'DOS', 'Algorithm')
 *   Main file: algoDir/LATEST → e.g. "v0.0.7-enhanced.md" → algoDir/v0.0.7-enhanced.md
 *   Sub-docs: algoDir/sub-docs/*.md (also scanned if main file lacks the token)
 *
 * For fixture tests, point hooksRoot to a directory whose parent contains a
 * DOS/Algorithm/ subtree with the expected files.
 *
 * Failure modes:
 *   - Algorithm directory not found → not_applicable
 *   - LATEST pointer file absent → not_applicable
 *   - Active doctrine file missing → not_applicable
 *   - Token absent from all doctrine files → fail
 *
 * Why R-class: the WORKING-TREE-CLEAN GATE is a mandatory phase-transition
 * guard in the Algorithm v0.0.7 LEARN phase. If the doctrine doesn't reference
 * it, agents will skip it — silently leaving submodule dirt behind (the
 * 2026-05-04 incident root cause).
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Active Algorithm doctrine must reference the WORKING-TREE-CLEAN GATE";

const SEARCH_TOKENS = ["WORKING-TREE-CLEAN", "working-tree-clean-gate"] as const;

function containsToken(content: string): boolean {
  return SEARCH_TOKENS.some((t) => content.includes(t));
}

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

export async function r21WorkingTreeCleanDoctrine(ctx: CheckContext): Promise<CheckResult> {
  const algoDir = join(ctx.hooksRoot, "..", "DOS", "Algorithm");

  if (!existsSync(algoDir)) {
    return {
      rId: "R21",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`DOS/Algorithm directory not found at ${algoDir} — DOS not installed`],
    };
  }

  // --- Resolve active doctrine file via LATEST pointer ---
  const latestPath = join(algoDir, "LATEST");
  if (!existsSync(latestPath)) {
    return {
      rId: "R21",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`LATEST pointer file not found at ${latestPath}`],
    };
  }

  let latestPointer: string;
  try {
    latestPointer = readFileSync(latestPath, "utf-8").trim();
  } catch (err) {
    return {
      rId: "R21",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Failed to read LATEST pointer: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const activeDoctrinePath = join(algoDir, latestPointer);
  if (!existsSync(activeDoctrinePath)) {
    return {
      rId: "R21",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Active doctrine file not found: ${activeDoctrinePath} (LATEST → ${latestPointer})`],
    };
  }

  // --- Check main doctrine file ---
  const doctrineContent = readFileSafe(activeDoctrinePath);
  if (doctrineContent && containsToken(doctrineContent)) {
    return {
      rId: "R21",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`${activeDoctrinePath}: WORKING-TREE-CLEAN GATE reference found`],
    };
  }

  // --- Check sub-docs directory ---
  const subDocsDir = join(algoDir, "sub-docs");
  if (existsSync(subDocsDir)) {
    let subDocFiles: string[] = [];
    try {
      subDocFiles = readdirSync(subDocsDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => join(subDocsDir, f));
    } catch {
      // ignore readdir errors
    }

    for (const subDocPath of subDocFiles) {
      const content = readFileSafe(subDocPath);
      if (content && containsToken(content)) {
        return {
          rId: "R21",
          requirement: REQUIREMENT,
          status: "pass",
          evidence: [
            `${subDocPath}: WORKING-TREE-CLEAN GATE reference found (sub-doc)`,
            `Main doctrine (${latestPointer}) does not contain the token directly`,
          ],
        };
      }
    }
  }

  return {
    rId: "R21",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `Active doctrine ${latestPointer} and all sub-docs lack WORKING-TREE-CLEAN reference`,
      `Searched tokens: ${SEARCH_TOKENS.join(", ")}`,
      `Agents loading this doctrine will skip the phase-transition gate`,
    ],
  };
}
