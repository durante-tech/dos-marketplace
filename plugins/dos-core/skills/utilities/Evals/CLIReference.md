# Evals CLI Reference

## CLI-First Architecture

This skill follows the CLI-First Architecture pattern:

```
User Request -> AI orchestrates -> Tools/ CLIs -> Deterministic results in Results/
```

The shipped surface is three Bun CLIs under `~/.claude/skills/utilities/Evals/Tools/`.
There is no server, web UI, or database: `Results/<use-case>/<run-id>/results.json` is the store.

---

## SuiteManager — manage evaluation suites

```bash
bun run ~/.claude/skills/utilities/Evals/Tools/SuiteManager.ts <command>

# Commands
#   create <name>            Create a new suite (-t capability|regression, -d description, --domain)
#   list [type]              List all suites (optionally filter by type)
#   show <name>              Show suite details with saturation status
#   add-task <suite> <task>  Add a task to a suite
#   check-saturation <name>  Check if a capability suite is saturated
#   graduate <name>          Graduate capability suite to regression
```

## AlgorithmBridge — run suites (+ ISC binding)

```bash
bun run ~/.claude/skills/utilities/Evals/Tools/AlgorithmBridge.ts -s <suite>          # run + results
bun run ~/.claude/skills/utilities/Evals/Tools/AlgorithmBridge.ts -s <suite> -r 3 -u  # bind + update ISC row 3
bun run ~/.claude/skills/utilities/Evals/Tools/AlgorithmBridge.ts -s <suite> --show-saturation
```

## TrialRunner — multi-trial a single task (pass@k / pass^k)

```bash
bun run ~/.claude/skills/utilities/Evals/Tools/TrialRunner.ts -t UseCases/<domain>/<name>/task.yaml -n 3
```

Note: TrialRunner's CLI validates the runner infrastructure; full agent-executed
runs flow through AlgorithmBridge (which configures the executor).

## Reading results

```bash
RES=~/.claude/skills/utilities/Evals/Results/<use-case>
ls -t $RES | head -10                                   # recent runs
python3 -m json.tool $RES/<run-id>/results.json          # one run, readable
jq '.results[] | select(.passed==false)' $RES/<run-id>/results.json   # failures
```
