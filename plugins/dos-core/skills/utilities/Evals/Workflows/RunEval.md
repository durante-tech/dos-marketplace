---
name: Run Eval
description: Run evaluations for a specific use case and collect results.
status: STABLE
---

# RunEval Workflow

Run evaluations for a specific use case.

## Prerequisites

- Use case must exist in `UseCases/<name>/`
- Test cases defined in use case
- Config.yaml with scoring criteria

## Execution

### Step 1: Validate Use Case

```bash
# Check use case exists
ls ~/.claude/skills/utilities/Evals/UseCases/<use-case>/config.yaml
```

If missing, redirect to `CreateUseCase.md` workflow.

### Step 2: Locate the Suite

```bash
# List available suites (capability + regression)
bun run ~/.claude/skills/utilities/Evals/Tools/SuiteManager.ts list

# Show one suite's tasks + saturation status
bun run ~/.claude/skills/utilities/Evals/Tools/SuiteManager.ts show <suite>
```

### Step 3: Run Evaluation

**Option A: Suite run with ISC binding (the standard path)**

```bash
bun run ~/.claude/skills/utilities/Evals/Tools/AlgorithmBridge.ts -s <suite>            # run + show results
bun run ~/.claude/skills/utilities/Evals/Tools/AlgorithmBridge.ts -s <suite> -r 3 -u    # run + update ISC row 3
```

**Option B: Multi-trial a single task (pass@k infra)**
```bash
bun run ~/.claude/skills/utilities/Evals/Tools/TrialRunner.ts -t UseCases/<domain>/<name>/task.yaml -n 3
```

### Step 4: Collect Results

Results are stored in:
- `Results/<use-case>/<run-id>/results.json` (the store — no database exists)

### Step 5: Report Summary

Use structured response format:

```markdown
📋 SUMMARY: Evaluation completed for <use-case>

📊 STATUS:
| Metric | Value |
|--------|-------|
| Pass Rate | X% |
| Mean Score | X.XX |
| Failed Tests | X |

📖 STORY EXPLANATION:
1. Ran evaluation against <N> test cases
2. Deterministic scorers completed first
3. AI judges evaluated accuracy and style
4. Calculated weighted scores
5. Compared against pass threshold
6. <Key finding 1>
7. <Key finding 2>
8. <Recommendation>

🎯 COMPLETED: Evaluation finished with X% pass rate.
```

## Error Handling

**If eval fails:**
1. Check model API key is configured
2. Verify test cases have valid inputs
3. Check scorer configurations in config.yaml
4. Review error logs in terminal

## Done

Evaluation complete. Results available in UI and files.
