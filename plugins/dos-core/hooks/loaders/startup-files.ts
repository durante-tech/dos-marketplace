import { loadStartupFiles } from './helpers';
import type { ContextLoader } from './types';

/**
 * Force-load files listed in settings.json → loadAtStartup.files.
 * Each file's contents become a single concatenated `<system-reminder>`
 * block emitted to stdout (separate envelope from the unified dynamic
 * context block emitted later).
 */
export const startupFilesLoader: ContextLoader = {
  name: 'startup-files',
  load: (ctx) => {
    const content = loadStartupFiles(ctx.dosDir, ctx.settings);
    if (!content) return {};
    return { emit: `<system-reminder>\n${content}\n</system-reminder>` };
  },
};
