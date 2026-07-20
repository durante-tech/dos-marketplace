/**
 * R56 (v0.0.15 foundation-fix sprint, PRD-20260513-145627 ISC-7 regression
 * guard) — `Tools/release.sh` must carry the `--alias-versions=` arg-parser
 * substring so multi-version folder aliasing remains available at release
 * time.
 *
 * Background: ISC-7 added the `--alias-versions=X,Y[,Z]` flag to
 * release.sh, which is the Path-B tag-aliased single-freeze mechanism used
 * by v0.0.12 / v0.0.13 / v0.0.14 to land three -final tags on one
 * cc-durante-studio SHA. If the arg parser is silently dropped during a
 * future release.sh refactor, that delivery pattern regresses to "three
 * separate freezes" with no tooling support.
 *
 * Applicability: <repoRoot>/Tools/release.sh exists.
 *
 * Pass condition: comment-stripped source contains the literal `--alias-versions=`
 * (SENT-05: a raw whole-file `includes()` stayed green when the parser was
 * deleted but a shell `#`-comment still mentioned the flag).
 *
 * Fail condition: file exists but the flag literal is absent from code (a
 * comment mention no longer counts).
 *
 * Not_applicable: Tools/release.sh not found.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { stripHashComments, hasLiteralInCode } from "../lib/source-presence.ts";

const REQUIREMENT =
  "Tools/release.sh must carry the `--alias-versions=` arg-parser substring (ISC-7 regression guard)";
const PARSER_TOKEN = "--alias-versions=";

export async function r56ReleaseAliasVersionsFlag(ctx: CheckContext): Promise<CheckResult> {
  const releasePath = join(ctx.repoRoot, "Tools", "release.sh");

  if (!existsSync(releasePath)) {
    return {
      rId: "R56",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Tools/release.sh not found at ${releasePath}`],
    };
  }

  let src: string;
  try {
    src = readFileSync(releasePath, "utf-8");
  } catch (err) {
    return {
      rId: "R56",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${releasePath} unreadable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (!hasLiteralInCode(stripHashComments(src), PARSER_TOKEN)) {
    return {
      rId: "R56",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${releasePath}: arg-parser literal '${PARSER_TOKEN}' absent from comment-stripped source`,
        "ISC-7 added --alias-versions for multi-version folder aliasing; the parser literal must remain in code (a #-comment mention no longer counts).",
      ],
    };
  }

  return {
    rId: "R56",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`${releasePath}: '${PARSER_TOKEN}' present in code — multi-version alias parser wired`],
  };
}
