/**
 * Shared CLI error handling for OpenRouter Pack CLIs.
 *
 * Idiom mirrored from Packs/media/src/Lib/cli.ts. Used by Tools/Chat.ts
 * and Tools/Models.ts so argv parsing + upstream errors surface with
 * consistent exit codes.
 */

export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode: number = 1,
  ) {
    super(message);
    this.name = "CLIError";
  }
}

export function handleError(error: unknown): never {
  if (error instanceof CLIError) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(error.exitCode);
  }
  if (error instanceof Error && error.name === "MissingStudioEnvError") {
    console.error(`❌ Error: ${error.message}`);
    process.exit(2);
  }
  if (error instanceof Error) {
    console.error(`❌ Unexpected error: ${error.message}`);
    if (process.env.OPENROUTER_PACK_DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
  console.error(`❌ Unknown error:`, error);
  process.exit(1);
}
