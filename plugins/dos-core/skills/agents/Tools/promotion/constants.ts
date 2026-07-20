const HOME = process.env.HOME || "~";

export const CUSTOM_AGENTS_DIR = `${HOME}/.claude/custom-agents`;
export const ARTIFACTS_PATH = `${HOME}/.claude/MEMORY/ARTIFACTS/artifacts.jsonl`;
export const AGENTS_DIR_USER = `${HOME}/.claude/agents`;
export const PROMOTION_OVERRIDES_PATH = `${HOME}/.claude/MEMORY/SECURITY/promotion-overrides.jsonl`;

export const DEFAULT_PROMOTE_N_SESSIONS = 3;
export const DEFAULT_FRESHNESS_DAYS = 90;
export const DEFAULT_TOOLS_ALLOWLIST = "Read, Grep, Glob";

export const POLL_BACKOFF_MS = [500, 1000, 2000, 4000];
export const MAX_EPHEMERAL_BLOB_BYTES = 32 * 1024;
export const VALID_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;
