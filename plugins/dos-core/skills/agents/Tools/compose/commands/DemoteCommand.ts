import type { Command } from "./types.ts";
import { demoteAgentPromotion } from "../../promotion/index.ts";
import { coerceScope, SCOPE_ERROR } from "../coerce.ts";

export const DemoteCommand: Command = {
  name: "demote",
  matches: (argv) => Boolean(argv.demote),
  execute: (argv) => {
    const scope = coerceScope(argv.scope);
    if (!scope) {
      console.error(SCOPE_ERROR);
      return 1;
    }
    return demoteAgentPromotion({
      slug: argv.demote!,
      scope,
    });
  },
};
