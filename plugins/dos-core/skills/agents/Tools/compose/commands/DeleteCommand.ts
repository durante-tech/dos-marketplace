import type { Command } from "./types.ts";
import { deleteAgent } from "../persistence.ts";

export const DeleteCommand: Command = {
  name: "delete",
  matches: (argv) => Boolean(argv.delete),
  execute: (argv) => {
    const ok = deleteAgent(argv.delete!);
    return ok ? 0 : 1;
  },
};
