/**
 * Shared CLI error handling for Media CLI tools.
 *
 * Provides CLIError class and handleError function used by
 * Generate.ts (images) and Speak.ts (speech).
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
    console.error(`\u274C Error: ${error.message}`);
    process.exit(error.exitCode);
  }
  if (error instanceof Error) {
    console.error(`\u274C Unexpected error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
  console.error(`\u274C Unknown error:`, error);
  process.exit(1);
}
