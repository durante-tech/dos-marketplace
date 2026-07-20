export interface ArtifactRow {
  timestamp: string;
  pack: string;
  workflow: string;
  type: string;
  title: string;
  path: string;
  contentPreview: string;
  wing?: string;
  sessionId: string;
  persisted: boolean;
  agentCount: number;
}

export interface GateDecision {
  permitted: boolean;
  identity: string;
  required_n: number;
  observed_n: number;
  freshness_days: number;
  min_days_spread: number;
  persisted_ratio: number;
  min_days_ok: boolean;
  ratio_ok: boolean;
  reason: string;
}

export interface PromoteOptions {
  slug: string;
  scope: "user" | "project";
  tools: string;
  nSessions: number;
  freshnessDays: number;
  minDaysSpread: number;
  minPersistedRatio: number;
  force: boolean;
  dryRun: boolean;
}

export type StepResult<T> = { ok: true; value: T } | { ok: false; code: number };

export interface LoadedAgent {
  frontmatter: Record<string, unknown>;
  body: string;
  rawFrontmatter: string;
  title: string;
  traits: string[];
  identity: string;
}

export interface PromotionTarget {
  targetDir: string;
  targetName: string;
  targetPath: string;
  content: string;
}
