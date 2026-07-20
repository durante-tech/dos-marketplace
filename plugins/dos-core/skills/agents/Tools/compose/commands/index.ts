import type { Command } from "./types.ts";
import { ListTraitsCommand } from "./ListTraitsCommand.ts";
import { AnalyticsCommand } from "./AnalyticsCommand.ts";
import { SearchCommand } from "./SearchCommand.ts";
import { ListSavedCommand } from "./ListSavedCommand.ts";
import { DeleteCommand } from "./DeleteCommand.ts";
import { PromoteCommand } from "./PromoteCommand.ts";
import { DemoteCommand } from "./DemoteCommand.ts";
import { LoadCommand } from "./LoadCommand.ts";
import { CouncilCommand } from "./CouncilCommand.ts";
import { ComposeCommand } from "./ComposeCommand.ts";

export const commands: readonly Command[] = [
  ListTraitsCommand,
  AnalyticsCommand,
  SearchCommand,
  ListSavedCommand,
  DeleteCommand,
  PromoteCommand,
  DemoteCommand,
  LoadCommand,
  CouncilCommand,
  ComposeCommand,
];

export type { Command } from "./types.ts";
