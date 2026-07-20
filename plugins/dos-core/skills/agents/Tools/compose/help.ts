import { readFileSync, existsSync } from "fs";
import { HELP_TEXT_PATH } from "./constants.ts";

export function printHelp(): void {
  if (!existsSync(HELP_TEXT_PATH)) {
    console.error(`Error: Help text not found at ${HELP_TEXT_PATH}`);
    process.exit(1);
  }
  console.log(readFileSync(HELP_TEXT_PATH, "utf-8"));
}
