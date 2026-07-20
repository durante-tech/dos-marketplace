---
name: ValidateYamlKeys
description: Detect duplicate keys at any nesting level in a YAML file. Exits non-zero on violations so it can gate commits and CI.
status: STABLE
---

# ValidateYamlKeys

Catches the YAML duplicate-key bug class: YAML silently drops earlier values when the same key appears twice at the same nesting level, so `frontmatter`, `config`, and `compose`-style files get subtly broken without parser errors.

## Trigger Conditions

- About to commit a hand-edited YAML file (frontmatter, workflow, docker-compose, CI config).
- YAML-driven config "suddenly stopped working" and you suspect a duplicate key shadowing.
- Adding a pre-commit or CI gate for YAML hygiene.
- Merging a branch that touched the same YAML section multiple times.

## Usage

```bash
# Pretty output, exits 0/1/2
bun Tools/ValidateYamlKeys.ts path/to/file.yaml

# JSON output for CI / other tools
bun Tools/ValidateYamlKeys.ts path/to/file.yaml --json
```

### Exit codes

- `0` — clean, no duplicate keys.
- `1` — duplicate keys found.
- `2` — invalid args or file missing / unparseable.

### Sample output (duplicates)

```
FAIL  config.yaml
  - items.alpha  (line 3, line 4)
  - nested.beta.gamma  (line 7, line 8)
2 duplicate keys found across 4 occurrences
```

### Sample JSON

```json
{
  "validator": "ValidateYamlKeys",
  "ok": false,
  "violations": [
    { "key": "items.alpha", "occurrences": [{ "line": 3 }, { "line": 4 }] }
  ],
  "summary": "1 duplicate key found across 2 occurrences"
}
```

## Anti-patterns

- Don't use this tool to "fix" duplicates by auto-picking one — surface them and let a human decide which value was intended.
- Don't skip nested maps; a duplicate three levels deep is the exact class of bug this tool exists to catch.
- Don't treat a parse error (exit 2) as "no duplicates" — it means the file was unreadable and still needs human review.
- Don't replace this with a regex grep of `^(\s*)(\w+):` — indentation and flow-style YAML make that approach unreliable; use the real parser.
