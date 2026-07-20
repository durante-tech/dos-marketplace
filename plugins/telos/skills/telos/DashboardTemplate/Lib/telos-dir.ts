import path from 'path'
import os from 'os'

/**
 * Canonical TELOS-corpus directory resolver for the dashboard Next.js app.
 *
 * The dashboard is a standalone, scaffold-out app and CANNOT import hooks/lib or
 * the pack's Tools/Lib — so this is its single in-app source of truth. Every
 * reader (telos-data.ts) and writer (api/upload, api/file/save) route imports it,
 * which kills the historic split-brain where the writers persisted to the dead
 * ~/.claude/skills/Telos path while the reader scanned ~/.durante/user/TELOS.
 *
 * Resolution rule — lockstep with getTelosDir() in the pack's Lib/telos-dir.ts
 * and in hooks/lib/paths.ts (parity pinned by Tools/telos-dir.test.ts):
 *   $DURANTE_TELOS_DIR overrides (~ and $HOME expanded) || ~/.durante/user/TELOS.
 */
export function getTelosDir(): string {
  const env = process.env.DURANTE_TELOS_DIR
  if (env) {
    return env
      .replace(/^~(?=$|\/)/, os.homedir())
      .replace(/^\$HOME(?=$|\/)/, os.homedir())
  }
  return path.join(os.homedir(), '.durante/user/TELOS')
}
