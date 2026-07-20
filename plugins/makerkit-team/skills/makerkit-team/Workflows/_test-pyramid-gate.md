# Test Pyramid Gate (binding)

Shared substrate for every change-producing MakerkitTeam workflow. Defines the two-tier test pyramid per Makerkit canon, the ships-with-tests gate, the canonical commands, file conventions, do/don't list, and the per-ISC layer-mapping rubric. Workflows reference this file rather than restating contracts inline.

**Source of truth (Makerkit docs):**
- `https://makerkit.dev/docs/nextjs-prisma/testing/overview`
- `https://makerkit.dev/docs/nextjs-prisma/testing/unit`
- `https://makerkit.dev/docs/nextjs-prisma/testing/e2e`
- `https://makerkit.dev/docs/nextjs-prisma/testing/writing-tests`

## The Two-Tier Pyramid

Makerkit prescribes exactly two test layers. There is no formal integration tier — integration cases fold into "E2E with real DB" or "unit with mocks".

| Layer | Tool | Folder | What goes here |
|---|---|---|---|
| **Unit** | Vitest | `__tests__/*.test.ts` adjacent to source (e.g., `packages/rbac/src/core/__tests__/factory.test.ts`) | Pure functions (validators, transformers, formatters), business logic (RBAC rules, seat enforcement, subscription calculations), Zod schema validations, error-handling paths, edge cases in algorithms |
| **E2E** | Playwright | `apps/e2e/tests/<feature>/<feature>.spec.ts` + `<feature>.po.ts` (Page Object) | Critical user flows, anything with React components, anything touching the real database, anything requiring authenticated session |

**What NOT to unit-test** (per Makerkit `testing/unit`): React components → use E2E. Database queries → use E2E with real DB. External API integrations → E2E or mocked integration tests.

## The Ships-With-Tests Gate (the hard rule)

No PR opens, no QuickFix completes, no BugFix verifies, no Refactor closes, no DeliverFeature reaches G7 unless ALL six checks pass:

1. **Unit-layer green** — affected business-logic packages have a green Vitest run captured as evidence in PRD `## Verification`. Command: `pnpm --filter @kit/<pkg> test:unit`.
2. **E2E-layer green** — user-facing scope has a green Playwright run captured as evidence. Command: `pnpm --filter web-e2e exec playwright test <feature> --workers=1` for iteration; `pnpm --filter web-e2e test:slow` for the full slow suite.
3. **`run_checks` clean** — `mcp__makerkit__run_checks` returns no typecheck / lint / format / package-consistency failures. If the MCP server is not connected, use the read-only fallback ladder (see Canonical Commands → Health below).
4. **`data-testid` discipline** — every new interactive element has a kebab-case `data-testid` attribute (Playwright config: `testIdAttribute: 'data-testid'`).
5. **Bootstrap-helper usage** — Playwright specs use `bootstrapAuthenticatedUser` / `bootstrapUserWithOrg` / `bootstrapOrgWithMembers` / `bootstrapOrgMember` / `bootstrapSuperAdminUser` from `apps/e2e/utils/bootstrap-helpers.ts` for auth setup. UI login flows are tested ONLY when the test's purpose is the login flow itself.
6. **Per-ISC layer mapping documented** — PRD `## Decisions → ### Test Pyramid Plan` maps every ISC to a layer (`unit-covered`, `e2e-covered`, `verification-only (justified)`, or `documentation-only`).

Failure on any of the six routes through the standard ISC-failure remediation path: original implementer (frontend / backend / database / e2e by code ownership) re-spawned with surgical-fix constraint, 3-strike escalation to operator.

## Canonical Commands

Verbatim from Makerkit `testing/overview`, `testing/unit`, `testing/e2e`. Workflows MUST cite these forms — never invent new pnpm scripts.

### Unit (Vitest)

```bash
pnpm test:unit                                  # all packages
pnpm --filter @kit/<pkg> test:unit              # single package
pnpm --filter @kit/<pkg> test:unit:watch        # watch mode
pnpm --filter @kit/<pkg> test:unit:coverage     # with coverage report
```

### E2E (Playwright)

```bash
# Production-build path (recommended — matches CI)
pnpm --filter web build:test
pnpm --filter web start:test                    # separate terminal
pnpm --filter web-e2e test:slow                 # full suite, 2 workers, stops on first failure

# Iteration / debugging
pnpm --filter web-e2e exec playwright test <file> --workers=1   # single test, serial
pnpm --filter web-e2e test:ui                                    # Playwright UI mode
```

### Health (catch-all)

```bash
mcp__makerkit__run_checks                       # typecheck + lint + format + package consistency
```

If `mcp__makerkit__run_checks` is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.

## File Conventions

| Concern | Convention |
|---|---|
| Unit test file | `__tests__/<name>.test.ts` adjacent to the file under test |
| Unit test mocking | `vi.mock()` at the top of the test file; `vi.mocked()` to access mocks; shared config auto-mocks `server-only` imports |
| E2E spec | `apps/e2e/tests/<feature>/<feature>.spec.ts` |
| E2E Page Object | `apps/e2e/tests/<feature>/<feature>.po.ts` (paired with the spec) |
| E2E bootstrap helpers | Imported from `apps/e2e/utils/bootstrap-helpers.ts` |
| `data-testid` format | kebab-case (`sign-in-button`, `team-invite-form`) |
| Playwright config defaults | `testIdAttribute: 'data-testid'`, `timeout: 120 * 1000`, `retries: 2`, `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'` |

## Bootstrap Helpers (E2E auth shortcuts)

From `apps/e2e/utils/bootstrap-helpers.ts`. Use these instead of UI login flows whenever the test's purpose is not the login flow itself.

| Helper | Use when |
|---|---|
| `bootstrapAuthenticatedUser()` | Test needs a logged-in user; create user in DB and log in via API (no UI) |
| `bootstrapUserWithOrg()` | Test needs a user owning a fresh organization |
| `bootstrapOrgWithMembers()` | Test needs an organization with multiple members |
| `bootstrapOrgMember()` | Test needs a regular (non-owner) member context |
| `bootstrapSuperAdminUser()` | Test needs an admin account |

## Page Object Pattern

```typescript
// auth.po.ts
export class AuthPageObject {
  constructor(private page: Page) {}
  async goToSignIn() { await this.page.goto('/auth/sign-in'); }
  async signIn(params: { email: string; password: string }) {
    await this.page.getByTestId('sign-in-email').fill(params.email);
    await this.page.getByTestId('sign-in-password').fill(params.password);
    await this.page.getByTestId('sign-in-submit').click();
  }
}

// auth.spec.ts
test('should sign in', async ({ page }) => {
  const auth = new AuthPageObject(page);
  await auth.goToSignIn();
  await auth.signIn({ email: 'test@example.com', password: 'pw' });
  await expect(page.getByTestId('dashboard-heading')).toBeVisible();
});
```

## Do's and Don'ts (verbatim Makerkit guidance)

### Do's
- Each test creates its own data
- Use polling assertions for async operations: `await expect(async () => { ... }).toPass()`
- Add descriptive test names explaining behavior
- Run tests locally with `--workers=1` before pushing
- Add `data-testid` attributes (kebab-case) on every interactive element new to the diff
- Use bootstrap helpers for e2e auth setup

### Don'ts
- Don't create test dependencies between specs
- Don't use vague names like "should work"
- Don't leave `test.only` in code before submission
- Don't unit-test React components (push to E2E)
- Don't unit-test database queries (push to E2E with real DB)

## Per-ISC Layer Mapping Rubric

Every ISC in a change-producing workflow's PRD MUST be tagged with one of these four labels in the `### Test Pyramid Plan` table:

| Label | When |
|---|---|
| `unit-covered` | Pure logic, validators, transformers, RBAC rules, schema validations, error-path branches. Vitest test in `__tests__/` adjacent to the implementation. |
| `e2e-covered` | User flow, page interaction, RSC + client-component composition, auth boundary, real-DB query path. Playwright spec in `apps/e2e/tests/<feature>/`. |
| `verification-only (justified)` | ISC verifiable by `run_checks`, `mcp__makerkit__kit_translations_stats`, `mcp__makerkit__kit_env_schema`, code-read inspection, or a non-test artifact. Justification (≤16 words) required in the table. |
| `documentation-only` | Doc / changelog / mdoc edit with no behavioral surface. Tests not applicable. |

The Test Pyramid Plan table goes in PRD `## Decisions → ### Test Pyramid Plan`:

```markdown
### Test Pyramid Plan

| ISC | Layer | Test path | Notes |
|---|---|---|---|
| ISC-1 | unit-covered | `packages/billing-config/src/__tests__/seat-limit.test.ts` | seat enforcement edge cases |
| ISC-2 | e2e-covered | `apps/e2e/tests/team-invite/team-invite.spec.ts` | flow + mailpit assertion |
| ISC-3 | verification-only (justified) | `mcp__makerkit__kit_translations_stats` output | i18n coverage; no behavior |
| ISC-4 | documentation-only | n/a | docs/team-invite.mdoc only |
```

## QA + E2E Pyramid Reviewer Framing (PR loop)

When QA or E2E roles review a PR, in addition to their normal framing prompts (see `ReviewOpenPRs.md` Phase 4 reviewer table), they MUST emit a **pyramid completeness check** for the diff:

- **QA** — the missing-unit-test heuristic is defined ONCE as the shared `findMissingUnitTests()` in `Tools/_shared.ts`, executed via `bun Tools/MakerkitCli.ts pyramid-missing-tests` (changed-paths JSON on stdin). It emits one TODO per changed `packages/**` source file lacking a `__tests__/<name>.test.ts` sibling: `(agent:qa) (priority:high) Add Vitest unit test for <function or module> in <pkg>/__tests__/`. Do not restate or re-derive the heuristic in prose — the tool is canonical.
- **E2E** — for every new user-facing flow added in the diff (signals: new `apps/web/**/page.tsx`, new `apps/web/**/_components/<form>`, new server action that mutates user-visible state), check whether `apps/e2e/tests/<feature>/` already contains a spec. If absent, emit: `(agent:e2e) (priority:high) Add Playwright spec for <flow> in apps/e2e/tests/<feature>/`.

These TODOs join the existing auto-CRITICAL stream from `mcp__makerkit__run_checks` failures and follow the same TODO checklist markdown protocol from `_pr-loop-shared.md`.

## Anti-Patterns to Catch

- **Generic "test plan" with no layer mapping** — every QA-produced test plan MUST be a Test Pyramid Plan with the per-ISC table.
- **E2E-only coverage for business logic** — if logic is testable at the unit layer (pure function, no UI), unit-test it. E2E is selective; don't bury logic in flows.
- **UI login flow used for auth setup** — use bootstrap helpers; UI login is tested ONLY when the test's purpose is the login flow.
- **Missing `data-testid` on new interactive element** — the PR's diff MUST add `data-testid` (kebab-case) on new buttons, inputs, links, dropdowns. Frontend's contract.
- **`test.only` left in submission** — workflow gates check for it.
- **Test depends on prior test's state** — every test must seed its own data.
