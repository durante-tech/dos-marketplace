import type { Command } from "./types.ts";
import { listTraits } from "../search.ts";

export const ListTraitsCommand: Command = {
  name: "list",
  matches: (argv) => Boolean(argv.list),
  execute: (_argv, ctx) => {
    listTraits(ctx.getTraits());
    return 0;
  },
};
