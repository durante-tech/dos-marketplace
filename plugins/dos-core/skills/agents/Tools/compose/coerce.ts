export type Scope = "user" | "project";

export const SCOPE_ERROR =
  `[ComposeAgent] --scope must be 'user' or 'project'; 'managed' and 'plugin' are read-only (§9.1)`;

export function coerceScope(raw: string | undefined): Scope | null {
  const s = (raw || "user").toLowerCase();
  return s === "user" || s === "project" ? s : null;
}

export function coerceInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function coerceFloat(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}
