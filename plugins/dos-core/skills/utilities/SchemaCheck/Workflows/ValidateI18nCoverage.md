# ValidateI18nCoverage

Detects i18n key drift between a flat/nested JSON registry and translation calls in source code. Catches both **missing keys** (used in code, absent from registry — runtime fallbacks or crashes) and **orphan keys** (in registry, never referenced — dead weight).

## When to run

- Before editing an i18n registry (baseline the current state).
- After adding a new translatable string to a component.
- Pre-commit / pre-merge, as part of CI.
- When auditing a locale file before shipping a new language.

## Usage

```bash
bun Tools/ValidateI18nCoverage.ts \
  --registry apps/web/messages/en.json \
  --src-glob "apps/web/**/*.{ts,tsx}" \
  --json
```

### Arguments

| Flag | Required | Default | Purpose |
|------|----------|---------|---------|
| `--registry` | yes | — | Path to the JSON registry (nested objects flattened to dot notation). |
| `--src-glob` | yes | — | Glob matching source files to scan. Supports `**`, `*`, `?`, `{a,b}`. |
| `--call-pattern` | no | `t\(['"\`]([^'"\`]+)['"\`]\)` | RegExp with one capture group for the key. |
| `--json` | no | off | Emit a JSON report instead of human text. |

### Exit codes

- `0` — full coverage (no missing, no orphans).
- `1` — gaps detected.
- `2` — invalid args / unreadable registry / malformed regex.

## Call-pattern customization

The default matches `t('key')` / `t("key")` / `` t(`key`) `` — works for **next-intl** and **react-i18next** out of the box. Override for:

- **react-i18next** with namespace separator: `--call-pattern "i18n\.t\(['\"]([^'\"]+)['\"]\)"`
- **vue-i18n** composition API: `--call-pattern "\\\$t\(['\"]([^'\"]+)['\"]\)"`
- **Lingui**: `--call-pattern "i18n\._\(['\"]([^'\"]+)['\"]\)"`
- Custom wrappers (e.g. `msg('key')`): `--call-pattern "msg\(['\"]([^'\"]+)['\"]\)"`

Only the **first capture group** is read as the key.

## JSON output

```json
{
  "validator": "ValidateI18nCoverage",
  "ok": false,
  "missing_in_registry": [{ "key": "header.cta", "files": ["app/Hero.tsx"] }],
  "orphans_in_registry": [{ "key": "legacy.old_banner" }],
  "summary": "1 missing keys, 1 orphan keys"
}
```

## Scope & limitations

- Static regex scan — dynamic keys like `t(variableName)` or `t('prefix.' + id)` are invisible by design.
- Skips `node_modules`, `.next`, `dist`, `.git`, `build`, `coverage`, `.turbo`, `.cache`.
- Registry values can be strings, numbers, or booleans; nested objects are traversed, arrays are treated as leaf values.

## Related

- `Tests/ValidateI18nCoverage.test.ts` — fixture-backed smoke test.
