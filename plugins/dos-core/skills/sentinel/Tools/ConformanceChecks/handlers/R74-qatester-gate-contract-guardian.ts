/**
 * R74 (Amendment H §H.6 J4) — QATesterGate Contract Guardian.
 *
 * Background: Amendment H §H.3 wires the QATesterGate Invocation Gate
 * into VERIFY by scanning the tool-use ledger for
 * `Task(subagent_type='QATester')` entries and asserting PASS/FAIL
 * report-format surface in returned text. This gate is string-literal
 * coupled to three pieces of `agents/QATester.md`. Without a guardian,
 * an edit to QATester.md (rename, format change, scope swap) silently
 * breaks the gate.
 *
 * Contract: Docs/Contracts/qatester-gate-contract.md declares the
 * 3-piece extract-interface (Feathers, WELC Ch. 4). This R-rule reads
 * the contract document and asserts each piece still holds against
 * `agents/QATester.md`.
 *
 * Applicability: gated on Amendment H being `Status: ACTIVE` in
 * `DOS/Algorithm/v0.0.10.md` Part 5. While DRAFT, returns
 * `not_applicable` so the rule does NOT fire false-positives during
 * the ratification window.
 *
 * Pass conditions (all required when ACTIVE):
 *   - Piece (a): `agents/QATester.md` frontmatter contains `name: QATester`
 *   - Piece (c): `agents/QATester.md` body contains the three canonical
 *                report headers verbatim (`QA VALIDATION PASSED`,
 *                `QA VALIDATION FAILED`, `QA VALIDATION PARTIAL PASS`)
 *   - Contract doc exists at `Docs/Contracts/qatester-gate-contract.md`
 *
 * Piece (b) (tool-use ledger entry shape) is NOT verified here — it is
 * a harness contract, not an agent contract. It belongs in a separate
 * R-rule guarding the harness/Algorithm wiring if drift becomes a
 * problem.
 *
 * Fail conditions: any of the above pass-checks fails.
 *
 * Tier: warning (Amendment E precedent — R44/R45 shipped at warning
 * tier on first ship; promotion to error after ≥1 sprint of empirical
 * evidence).
 *
 * Cutoff: pre-Amendment-H PRDs are not subject to this rule.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "QATesterGate 3-piece contract (Docs/Contracts/qatester-gate-contract.md) must hold against agents/QATester.md when Amendment H Status: ACTIVE";

const DOCTRINE_REL_PATH = "DOS/Algorithm/v0.0.10.md";
const CONTRACT_PATH = "Docs/Contracts/qatester-gate-contract.md";
const AGENT_REL_PATH = "agents/QATester.md";

const RELEASE_VERSION_RE = /^v(\d+)\.(\d+)\.(\d+)$/;

/**
 * Releases/v* directory names that carry a `.claude` subtree, sorted HIGHEST
 * semver first (the active release). SENT-01: the old code hardcoded
 * v0.0.18 then v0.0.17 — a committed-class gate must read the ACTIVE committed
 * release (v0.0.19+) dynamically, not a frozen prior one, or it green-while-
 * blinds against the contract it exists to guard.
 */
function discoverReleaseDirs(repoRoot: string): string[] {
  const releasesRoot = join(repoRoot, "Releases");
  let entries: string[];
  try {
    entries = readdirSync(releasesRoot);
  } catch {
    return [];
  }
  const versions: Array<{ name: string; parts: [number, number, number] }> = [];
  for (const name of entries) {
    const m = RELEASE_VERSION_RE.exec(name);
    if (!m) continue;
    const claudeDir = join(releasesRoot, name, ".claude");
    try {
      if (!statSync(claudeDir).isDirectory()) continue;
    } catch {
      continue;
    }
    versions.push({ name, parts: [Number(m[1]), Number(m[2]), Number(m[3])] });
  }
  versions.sort(
    (a, b) => b.parts[0] - a.parts[0] || b.parts[1] - a.parts[1] || b.parts[2] - a.parts[2],
  );
  return versions.map((v) => v.name);
}

// Locate a file that lives in the active committed release OR a co-located
// live-install tree. R74 is a COMMITTED-class gate (determinism.ts) — its
// verdict must be f(HEAD), reproducible on any clean checkout / CI clone. So
// we probe the repoRoot committed tree ONLY; the maintainer's ~/.claude homedir
// candidate is DROPPED (SENT-01: reading it made the verdict operator-local and
// non-reproducible). Symlink mode: <repoRoot>/.claude is the symlink target of
// Releases/v{X}/.claude — same inode, so either resolves identically.
//
// Probe order:
//   (1) active committed release — Releases/v* discovered dynamically, highest
//       semver first (this is what makes the gate read v0.0.19, not frozen v0.0.18)
//   (2) repo-root mounted symlink / co-located live-install — <repoRoot>/.claude/<rel>
//   (3) repo-root direct (some installs flatten the agents/ tree)
/**
 * Resolve the ACTIVE release submodule path from .gitmodules — the repo's
 * canonical resolution idiom (Tools/lib/active-submodule.ts is the SoT; the
 * in-handler parse mirrors the R19 precedent since ConformanceChecks can't
 * import Tools/lib across the four-copy boundary). Preferred over highest-vN
 * scanning because during a freeze window release.sh creates the NEXT
 * Releases/vN tree before .gitmodules retargets — highest-wins would read the
 * half-populated new tree while the active release is still the old one.
 */
function activeReleaseFromGitmodules(repoRoot: string): string | null {
  try {
    const gm = readFileSync(join(repoRoot, ".gitmodules"), "utf-8");
    const m = gm.match(/path = (Releases\/[^\n]+\/\.claude)/);
    if (m && existsSync(join(repoRoot, m[1]))) return join(repoRoot, m[1]);
  } catch {
    /* no .gitmodules — fall through to the version scan */
  }
  return null;
}

function locateInSubmodule(repoRoot: string, relPath: string): string | null {
  const candidates: string[] = [];
  const active = activeReleaseFromGitmodules(repoRoot);
  if (active) candidates.push(join(active, relPath));
  for (const version of discoverReleaseDirs(repoRoot)) {
    const c = join(repoRoot, "Releases", version, ".claude", relPath);
    if (!candidates.includes(c)) candidates.push(c);
  }
  candidates.push(join(repoRoot, ".claude", relPath));
  candidates.push(join(repoRoot, relPath));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readAmendmentHStatus(doctrineContent: string): "ACTIVE" | "DRAFT" | "MISSING" {
  // Find Part 5 — QATesterGate (Amendment H) block.
  const part5Idx = doctrineContent.indexOf("# Part 5 — QATesterGate (v0.0.10 Amendment H)");
  if (part5Idx < 0) return "MISSING";
  // A6 patch — scan from Part 5 header to next `# Part` or EOF, instead
  // of a fixed 600-char window. Future doctrine edits may insert a long
  // preamble between header and Status line; a brittle window silently
  // disarmed the guardian.
  const afterPart5 = doctrineContent.slice(part5Idx);
  const nextPartIdx = afterPart5.indexOf("\n# Part ", 1);
  const window = nextPartIdx > 0 ? afterPart5.slice(0, nextPartIdx) : afterPart5;
  const statusMatch = window.match(/\*\*Status:\*\*\s*(ACTIVE|DRAFT)/);
  if (!statusMatch) return "MISSING";
  return statusMatch[1] as "ACTIVE" | "DRAFT";
}

function frontmatterField(content: string, field: string): string | undefined {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return undefined;
  const m = fmMatch[1].match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
}

const PIECE_C_HEADERS = [
  "QA VALIDATION PASSED",
  "QA VALIDATION FAILED",
  "QA VALIDATION PARTIAL PASS",
];

export const r74QATesterGateContractGuardian: CheckHandler = async (ctx) => {
  const doctrinePath = locateInSubmodule(ctx.repoRoot, DOCTRINE_REL_PATH);
  if (!doctrinePath) {
    return {
      rId: "R74",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Algorithm doctrine ${DOCTRINE_REL_PATH} not found in any active submodule under ${ctx.repoRoot} — rule has no anchor`],
    };
  }

  let doctrineContent: string;
  try {
    doctrineContent = readFileSync(doctrinePath, "utf-8");
  } catch (err) {
    return {
      rId: "R74",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`could not read doctrine: ${(err as Error).message}`],
    };
  }

  const status = readAmendmentHStatus(doctrineContent);
  if (status === "MISSING") {
    return {
      rId: "R74",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["Amendment H Part 5 block not present in v0.0.10.md — rule not yet armed"],
    };
  }
  if (status === "DRAFT") {
    return {
      rId: "R74",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["Amendment H Status: DRAFT — guardian armed only at Status: ACTIVE per ISC-J4-9"],
    };
  }

  // Status: ACTIVE — run all 3 pass-checks.
  const fails: string[] = [];

  // Contract doc presence
  const contractPath = join(ctx.repoRoot, CONTRACT_PATH);
  if (!existsSync(contractPath)) {
    fails.push(`contract doc missing at ${CONTRACT_PATH} — Amendment H §H.6 J3 prerequisite`);
  }

  // Agent file presence + Piece (a) + Piece (c)
  const agentPath = locateInSubmodule(ctx.repoRoot, AGENT_REL_PATH);
  if (!agentPath) {
    fails.push(`agents/QATester.md not found at any known location (active Releases/v*/.claude or <repoRoot>/.claude)`);
  } else {
    let agentContent: string;
    try {
      agentContent = readFileSync(agentPath, "utf-8");
    } catch (err) {
      fails.push(`could not read agent file: ${(err as Error).message}`);
      agentContent = "";
    }

    if (agentContent) {
      // Piece (a) — frontmatter name: QATester
      const name = frontmatterField(agentContent, "name");
      if (name !== "QATester") {
        fails.push(
          `Piece (a) contract violation: agent file 'name:' frontmatter is "${name ?? "(missing)"}" — expected "QATester" (subagent_type literal coupling to v0.0.10.md §H.2)`,
        );
      }

      // Piece (c) — three canonical report headers present
      for (const header of PIECE_C_HEADERS) {
        if (!agentContent.includes(header)) {
          fails.push(
            `Piece (c) contract violation: agent file missing canonical report header "${header}" — VERIFY's PASS/FAIL surface extraction depends on it (v0.0.10.md §H.3)`,
          );
        }
      }
    }
  }

  if (fails.length === 0) {
    return {
      rId: "R74",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `Amendment H Status: ACTIVE; contract doc present at ${CONTRACT_PATH}; agent file Piece (a) name=QATester + Piece (c) 3/3 report headers verbatim`,
      ],
    };
  }

  return {
    rId: "R74",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${fails.length} contract violation(s) detected (tier: warning, Amendment E precedent):`,
      ...fails,
      `Remediation: revert the agent-file change OR update Amendment H Part 5 (v0.0.10.md) to match the new contract, then update Docs/Contracts/qatester-gate-contract.md accordingly.`,
    ],
  };
};

// Local CheckHandler alias — mirrors R44 pattern.
type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
