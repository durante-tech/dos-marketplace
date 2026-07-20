# SchemaCheck — Install

## Requirements

- **Bun** (any recent version) — validators are Bun TS scripts
- **`yaml` lib** (declared in `package.json`) — used by `ValidateYamlKeys` and `ValidateMdocFrontmatter`

## Install

The pack ships with `package.json` and `bun.lock` declaring its own `yaml` dependency. Install:

```bash
cd ~/.claude/skills/utilities/SchemaCheck   # or wherever the pack lives
bun install
```

This populates `node_modules/` (excluded from sync-check via the manifest's `**/node_modules/**` rule, so it does NOT trigger four-copy drift).

The other two validators (`ValidateI18nCoverage`, `ValidateTableConsumers`) use only Bun built-ins and need no install step beyond `bun install` for parity.

## Verify the install

Run all four smoke tests:

```bash
bun Tests/ValidateYamlKeys.test.ts        # PASS
bun Tests/ValidateI18nCoverage.test.ts    # PASS
bun Tests/ValidateMdocFrontmatter.test.ts # PASS 5/5
bun Tests/ValidateTableConsumers.test.ts  # PASS
```

If any test prints `FAIL`, see `VERIFY.md` for diagnostics.

## Where to invoke

Validators are pure CLIs — no skill-tool integration required. Invoke directly via `bun Tools/Validate*.ts <args>` from anywhere on disk. The CLI prints either human-readable output (default) or JSON (`--json`) for CI/script integration.

Under RFC-0001, the runtime phase contract is the canonical entry point for algorithm-driven invocation. Plan the right validator against structured criteria, then run it only in a phase where the current gate permits Bash.

## Uninstall

Delete the pack directory. No global state, no hooks, no migrations.
