/**
 * RFC-0001 orchestration runtime — JSON canonicalization + hashing helpers.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor. Shared by gates,
 * retry routing, capability-registry hashing, and phase-record digesting.
 * Zero I/O, zero process.env. Pure functions only.
 *
 * `canonicalize` (capability-registry's structurally-identical helper) will
 * be folded in here in a later iteration once capability-registry.ts is
 * extracted; until then the duplication is documented as G5 follow-on.
 */

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
    .join(",")}}`;
}

export async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
