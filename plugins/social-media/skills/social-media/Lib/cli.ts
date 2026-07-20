/**
 * Shared CLI error handling for SocialMedia tools.
 *
 * Provides CLIError class and handleError function used by all
 * Facebook and Instagram tools.
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

/**
 * Publish-safety policy \u2014 shared across all publish entrypoints (Facebook Publish,
 * Facebook PublishVideo, Instagram Publish, LinkedIn Publish).
 *
 * Inverts the previous posture: publishing an irreversible post to a public account is
 * now the GUARDED action (it requires an explicit `--yes`, mirroring the `Comment.ts`
 * destructive-delete idiom), and a bare invocation defaults to a DRY-RUN preview instead
 * of silently going live. Lives once in Lib/ so the policy can never drift per-platform.
 */
export interface PublishGuardOptions {
  /** Display name of the platform, e.g. "Facebook" / "Instagram" / "LinkedIn". */
  platform: string;
  /** Whether the platform supports an unpublished/draft state (FB/LinkedIn = true, IG = false). */
  canDraft: boolean;
  /** `--yes` \u2014 explicit confirmation to publish LIVE. */
  yes: boolean;
  /** `--draft` \u2014 stage the post unpublished instead of going live (the soft path). */
  draft: boolean;
  /** `SOCIAL_DRAFT_ONLY=1` env \u2014 set by the composing consumer OUTSIDE the prompt surface (unspoofable). */
  draftOnly: boolean;
}

export type PublishDecision =
  | { action: "publish" }
  | { action: "draft" }
  | { action: "dry-run"; reason: string }
  | { action: "refuse"; reason: string };

/**
 * Pure publish-safety policy \u2014 no side effects, unit-testable.
 *
 * Precedence: (1) the fail-closed draft-only env posture wins over everything; then
 * (2) an explicit `--draft`; then (3) an explicit `--yes` live confirmation; otherwise
 * (4) a bare invocation is a safe DRY-RUN, never a silent live publish.
 */
export function decidePublish(o: PublishGuardOptions): PublishDecision {
  // (1) Fail-closed draft-only posture, set by the consumer OUTSIDE the prompt surface.
  //     An LLM cannot spoof an env var the way it can pass a flag \u2014 this is the enforced boundary.
  if (o.draftOnly) {
    return o.canDraft
      ? { action: "draft" }
      : {
          action: "refuse",
          reason: `${o.platform} cannot stage drafts; live publish is blocked in draft-only mode (SOCIAL_DRAFT_ONLY=1) \u2014 schedule via the platform's native Business Suite instead.`,
        };
  }
  // (2) Explicit --draft soft path (FB/LinkedIn only; IG has no draft state).
  if (o.draft) {
    return o.canDraft
      ? { action: "draft" }
      : {
          action: "refuse",
          reason: `${o.platform} has no draft state \u2014 drop --draft (use the platform's native scheduler) or pass --yes to publish live.`,
        };
  }
  // (3) Explicit live confirmation.
  if (o.yes) return { action: "publish" };
  // (4) Bare invocation \u2192 safe default: dry-run preview, NEVER a silent live publish.
  const draftHint = o.canDraft ? ", or --draft to stage it unpublished" : "";
  return {
    action: "dry-run",
    reason: `Publishing to a live public ${o.platform} account is irreversible \u2014 pass --yes to confirm${draftHint}.`,
  };
}

/**
 * Enforce the publish-safety policy at a tool's `main()` boundary.
 *
 * Returns `{ published }` for the caller to thread into its API call. For a dry-run or a
 * refusal it prints the composed-post preview + the reason and exits non-zero \u2014 so a
 * misrouted / prompt-drifted invocation can never silently publish.
 */
export function enforcePublish(o: PublishGuardOptions, preview: string[] = []): { published: boolean } {
  const decision = decidePublish(o);
  if (decision.action === "publish") return { published: true };
  if (decision.action === "draft") return { published: false };
  if (decision.action === "dry-run") {
    console.error(`\u{1F6E1}  Publish-safety: DRY-RUN \u2014 no post was created.`);
    console.error(decision.reason);
    if (preview.length) {
      console.error(`\n--- composed ${o.platform} post (preview) ---`);
      for (const line of preview) console.error(line);
    }
    process.exit(2);
  }
  // decision.action === "refuse"
  console.error(`\u{1F6E1}  Publish-safety: REFUSED \u2014 ${decision.reason}`);
  process.exit(2);
}

/**
 * Reads the consumer-set draft-only env posture. Unspoofable by the calling LLM because it
 * is an env/spawn condition, not a flag the agent can pass. Consumers (e.g. StreamRig's
 * "DRAFT ONLY" PostStream/GoLive contract) set `SOCIAL_DRAFT_ONLY=1` in their compose env.
 */
export function isDraftOnly(): boolean {
  return process.env.SOCIAL_DRAFT_ONLY === "1";
}
