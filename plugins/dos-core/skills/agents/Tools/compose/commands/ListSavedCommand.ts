import type { Command } from "./types.ts";
import { listSavedAgents } from "../persistence.ts";

export const ListSavedCommand: Command = {
  name: "list-saved",
  matches: (argv) => Boolean(argv["list-saved"]),
  execute: () => {
    listSavedAgents();
    return 0;
  },
};
