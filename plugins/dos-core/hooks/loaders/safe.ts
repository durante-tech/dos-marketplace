import type { BootContext, ContextLoader, LoaderResult } from './types';

/**
 * Run a single loader with a single try/catch. The seven near-identical
 * try/catch blocks in main() pre-refactor collapse into this one helper.
 *
 * SessionStart is fail-open by contract: any loader failure logs to stderr
 * and returns an empty result; the boot continues.
 */
export async function safeLoad(loader: ContextLoader, ctx: BootContext): Promise<LoaderResult> {
  try {
    return await loader.load(ctx);
  } catch (err) {
    console.error(`⚠️ ${loader.name} failed: ${err}`);
    return {};
  }
}
