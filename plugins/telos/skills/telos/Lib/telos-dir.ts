import { homedir } from 'os';
import { join } from 'path';

/**
 * Canonical TELOS-corpus directory resolver for the Telos Bun tools.
 *
 * ONE rule for every pack surface that touches the corpus:
 *   $DURANTE_TELOS_DIR overrides (with ~ and $HOME expanded) || ~/.durante/user/TELOS.
 *
 * The live corpus is operator data at ~/.durante/user/TELOS — outside the
 * ~/.claude install tree, so it survives symlink-mode freezes AND real-dir
 * customer installs.
 *
 * Lockstep copies (these CANNOT share one physical module: the dashboard is a
 * scaffold-out standalone app and the DOS core lives outside this pack):
 *   - DashboardTemplate/Lib/telos-dir.ts  (the Next.js dashboard app)
 *   - getTelosDir() in hooks/lib/paths.ts (the DOS core)
 * Parity between this resolver and the dashboard copy is pinned mechanically by
 * Tools/telos-dir.test.ts; the hooks/lib copy stays comment-locked.
 */
export function getTelosDir(): string {
  const env = process.env.DURANTE_TELOS_DIR;
  if (env) {
    return env
      .replace(/^~(?=$|\/)/, homedir())
      .replace(/^\$HOME(?=$|\/)/, homedir());
  }
  return join(homedir(), '.durante', 'user', 'TELOS');
}
