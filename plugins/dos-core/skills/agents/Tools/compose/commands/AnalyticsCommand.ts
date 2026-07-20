import type { Command } from "./types.ts";
import { showAnalytics } from "../analytics.ts";

export const AnalyticsCommand: Command = {
  name: "analytics",
  matches: (argv) => Boolean(argv.analytics),
  execute: () => {
    showAnalytics();
    return 0;
  },
};
