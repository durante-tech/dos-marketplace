---
description: Normalize /design-bundle flags, inspect fork state, capture preflight decisions, and route into RunPipeline or ValidateBundle without recursively invoking the skill.
---

# DesignBundle command adapter

Run this adapter first whenever DesignBundle is invoked with `$ARGUMENTS` or slash-command-style flags. It preserves the historical `/design-bundle` contract while the public plugin exposes the skill as the single invocation surface.

## 1. Parse intent

Recognized flags are mutually exclusive unless noted:

| Flag | Route |
|---|---|
| `--quick` | RunPipeline with light copy, no Phase B research, press, review, D14, D16, D17, or D18 |
| `--launch-ready` | Full RunPipeline; this is the default when no mode flag is present |
| `--research-only` | Run Phase B and D14 only; preserve every other bundle artifact |
| `--copy-only` | Run D15 only from existing `context/`; preserve every other artifact |
| `--validate` | Run ValidateBundle read-only; perform no bundle or app writes |
| `--skip-research` | Full RunPipeline except Phase B and D14; reuse existing intelligence |
| `--commit` | May accompany `--research-only`; otherwise use the selected route's normal commit policy |

Treat the first positional token that does not start with `--` as the company name. If absent, derive it from `git remote get-url origin`. Reject unknown flags and conflicting mode flags rather than guessing.

## 2. Inspect state before any write

Run and show a concise preflight:

```bash
git rev-parse --show-toplevel
git remote get-url origin 2>/dev/null || true
git branch --show-current
test -f .fork-slot && sed -n '1p' .fork-slot || true
test -d claude-design-system-bundle && find claude-design-system-bundle -type f | wc -l || true
```

Stop for confirmation when the current directory is not a git worktree, the detected repository is not the intended fork, or the branch/remote state conflicts with the requested destination.

## 3. Capture operator decisions

For full and `--launch-ready` runs, capture these four decisions before routing:

1. Site scope: marketing-only, marketing plus light auth, or full SaaS.
2. Institutional positioning: operating-systems firm, durable infrastructure, founder-led, or Linear compression.
3. Languages: EN, EN plus another locale now, or EN now and another locale later.
4. Deploy target: Vercel, Cloudflare, Railway, or TBD.

For `--quick`, preselect marketing-only, founder-led, EN, and TBD, while allowing explicit operator overrides. Research-only, copy-only, and validate routes reuse locked decisions and do not re-ask unrelated questions.

## 4. Route without recursive skill invocation

Read the selected supporting workflow relative to this skill root:

- `Workflows/RunPipeline.md` for every mutating route.
- `Workflows/ValidateBundle.md` for `--validate`.

Build an explicit invocation record before execution:

```json
{
  "workflow": "RunPipeline | ValidateBundle",
  "mode": "launch-ready | quick | research-only | copy-only | skip-research | validate",
  "company": "derived-or-explicit",
  "repo_path": "absolute-current-worktree",
  "decisions": {
    "scope": "locked-value",
    "positioning": "locked-value",
    "languages": "locked-value",
    "deploy_target": "locked-value"
  }
}
```

Apply the mode boundaries exactly:

- `launch-ready`: Phases A through E and D1 through D18.
- `quick`: A, C, D2 through D5, D10 through D13, and E; light copy depth; no research, press, or review.
- `research-only`: B and D14 only; commit only when `--commit` is present.
- `copy-only`: D15 only.
- `skip-research`: full pipeline except B and D14.
- `validate`: all ValidateBundle checks, `strict:true`, `report:false`, and no writes.

The adapter chooses and constrains the workflow; it never calls DesignBundle again through a Skill tool.

## 5. Completion receipt

Report the bundle path, before/after file count, phases executed or skipped, branch and commit (if one was created), validation status, and the next operator action. Never claim a commit, remote push, or validation result without command evidence.

Recovery rules:

- Phase A failure: correct fork/remote configuration, then rerun.
- Phase B failure: resume with `--research-only`.
- D15 failure: resume with `--copy-only`.
- Phase E failure: leave the working tree visible and ask before committing.
- `--validate`: never mutate the bundle.

The adapter never pushes, creates a remote repository without confirmation, downloads external assets, or modifies `apps/*` or `packages/*`.
