import type { Command } from "./types.ts";
import { searchTraits } from "../search.ts";

export const SearchCommand: Command = {
  name: "search",
  matches: (argv) => Boolean(argv.search),
  execute: (argv, ctx) => {
    searchTraits(argv.search!, ctx.getTraits());
    return 0;
  },
};
