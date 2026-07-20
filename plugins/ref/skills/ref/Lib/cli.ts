/**
 * Shared CLI error handling for Ref Pack CLIs.
 *
 * Idiom mirrored from Packs/openrouter/src/Lib/cli.ts. Used by Tools/Search.ts
 * and Tools/Read.ts so argv parsing + upstream errors surface with
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
    console.error(`ref: ${error.message}`);
    process.exit(error.exitCode);
  }
  if (error instanceof Error && error.name === "MissingStudioEnvError") {
    console.error(`ref: ${error.message}`);
    process.exit(2);
  }
  if (error instanceof Error) {
    console.error(`ref: unexpected error: ${error.message}`);
    if (process.env.REF_PACK_DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
  console.error(`ref: unknown error:`, error);
  process.exit(1);
}
