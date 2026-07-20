# dos-prisma-saas-kit — Framework Digest

Cross-cutting synthesis of the kit docs corpus (exact counts pinned in the generated block below), sliced into every agent brief. Machine-derivable pins live between the `generated:pins` markers and are rewritten from the resolved target repo by `bun Tools/BuildDigest.ts [--repo <path>]` — never hand-edit that region. Load-bearing pins are then checked against the resolved repo's `AGENTS.md` by `Tools/VerifyDigest.ts` (run it before trusting this file — see DocsRefresh Phase 0). Where a fact lives in the repo's `AGENTS.md` or `docs/`, this digest cites the file rather than restating it.

<!-- generated:pins:start -->
- **Repo:** `next-prisma-kit` v1.8.3 (upstream) — pnpm@11.9.0 (pnpm 11) + Turborepo, **46 workspaces** under `apps/*` / `packages/**` / `tooling/*`.
- **Catalog pins** (`pnpm-workspace.yaml`): Next.js 16.2.10 · React 19.2.7 · TypeScript 6.0.3 · Prisma 7.8.0 · Tailwind CSS 4.3.1 · Base UI 1.6.0 · Better Auth 1.6.23 · zod 4.4.3.
- **Toolchain:** oxlint + oxfmt. `pnpm healthcheck` = `oxlint --fix && oxfmt && pnpm run typecheck && manypkg fix` — MUTATES files; the read-only ladder is `pnpm lint && pnpm typecheck && pnpm test:unit`.
- **Docs corpus:** 155 `.mdoc` files across 25 topic dirs under `docs/` · 15 `AGENTS.md` files repo-wide.

Generated against next-prisma-kit@~/Developer/next-prisma-kit on 2026-07-02 by `bun Tools/BuildDigest.ts`.
<!-- generated:pins:end -->

## 1 · Stack & Layout

- **Next.js (App Router, RSC)** + **React** + **TypeScript** + **Tailwind CSS** (CSS-first via `theme.css`) + **Base UI6.0** (not Radix `asChild` — uses `render` prop) + **Lucide**. Exact versions: generated pins block above.
- **Toolchain:** **oxlint + oxfmt (Oxc)** — this repo ships NO ESLint or Prettier config; server actions via **next-safe-action + zod** (major per generated pins); **Better Auth** (pin above); **pnpm + Turborepo** (pnpm major pinned above). Do NOT emit ESLint/Prettier config or prior-major zod syntax — they fail against the installed toolchain.
- **Workspaces** under `apps/*` / `packages/**` / `tooling/*` (count pinned in the generated block). There is NO `.dependency-cruiser.cjs` and NO `depcruise` script in this repo — layer boundaries are enforced by convention: root `AGENTS.md` (never mix client/server imports; separate `package.json` exports) plus review.
- **Better Auth** (self-hosted, plugin-based) replaces NextAuth/Clerk. Reasons: no per-user pricing, plugin composability, MFA/Org/OAuth as first-class plugins.
- **Prisma** (exact catalog pin above) on **PostgreSQL** via `@prisma/adapter-pg`. Schema lives in `packages/database/src/prisma/schema.prisma`. Models PascalCase, tables snake_case via `@@map`. (Pretraining on the prior Prisma major will emit stale schema/client APIs — trust the generated pin above.)
- **Turborepo + pnpm workspaces.** `apps/{web,e2e,dev-tool}` + `packages/@kit/*` (workspace, never published) + `tooling/{mcp-server,scripts,typescript,vitest}`.
- Layered package architecture: pure utils (`@kit/rbac`, `@kit/shared`) → meta-packages (`@kit/organization-*`, `@kit/account-*`) → `@kit/better-auth` → features (`@kit/billing-*`, `@kit/storage`, `@kit/policies`). Lower never imports higher. Meta-packages split into `-core`/`-ui`/`-hooks` for tree-shaking.
- Imports always `@kit/<package>`, never relative cross-package. Server vs client split via `package.json#exports` (`./server` vs `./client`) + `import 'server-only'`.

## 2 · The Tenancy Model (the most important architectural decision)

- **Dual-context, NOT a shared `accounts` table.** This is a deliberate departure from Supabase-flavored Makerkit kits.
  - **Personal context** = absence of `session.activeOrganizationId`. No `personalAccount` row exists — it's the user record + empty active-org state.
  - **Organization context** = real `organization` row + `member` join + active session.
- **No URL-based org routing.** No `/org/[slug]/*`. Same routes (`/dashboard`, `/settings/*`) render personal vs org content based on session state.
- **No Postgres RLS.** Tenant scoping is enforced in application code via `organizationActionClient` middleware (auto-injects `ctx.organizationId`) plus explicit `where: { organizationId }` filters. Trust boundary lives in middleware.
- `NEXT_PUBLIC_ACCOUNT_MODE` ∈ `personal-only | organizations-only | hybrid` — auto-derives 8 feature flags. **One-way switch** post-launch (breaks data associations).

## 3 · Server Actions Spine (`@kit/action-middleware`)

The canonical pattern — every mutation goes through `next-safe-action` middleware:

| Client | Adds | Use for |
|---|---|---|
| `authenticatedActionClient` | `ctx.user`, throws if unauth | Personal actions |
| `organizationActionClient` | `ctx.organizationId`, `ctx.role`, verifies membership | Org-scoped actions |
| `adminActionClient` | requires super-admin | `/admin` panel |

Composable middleware: `.use(withMinRole('admin'))` (hierarchy: owner=100, admin=50, member=10), `.use(withFeaturePermission({ resource: ['action'] }))`, `.inputSchema(zodSchema)` (typed `parsedInput`). Logging via `getLogger()` from `@kit/shared/logger`.

Five-layer protection for `/admin`: proxy → `requireAdmin()` loader → `adminActionClient` → `withAdminPermission()` → client-side `useAdminPermissions()` (UX only, never trusted).

## 4 · RBAC + Policies (composable, two layers)

- **RBAC** (`@kit/rbac`): role hierarchy + resource×action permissions defined once in `packages/rbac/src/rbac.config.ts` (org) and `admin-rbac.config.ts` (super-admin). Admin resources MUST be **singular** (`user` not `users`) — Better Auth requirement, fails silently if plural.
- **Custom roles** — static (config-defined) or dynamic (`/settings/roles` UI, per-org rows). Snap to hierarchy levels 75/30/5.
- **Policies** (`@kit/policies` primitives `definePolicy`, `allow()`, `deny({code,message,remediation})`): two registries — organization (`packages/organization/policies/`) and account-deletion (`@kit/account-hooks`). Wired into Better Auth `organizationHooks`.
- **Before-registries** block ops; **after-registries** run side effects (must always `allow()`, throwing does NOT roll back). Ten before-registries + ten after-registries cover the full lifecycle.
- Policies run BEFORE RBAC's permission check. RBAC = "can this role do this action"; policies = business rules (limits, domain restrictions, sub-required).

## 5 · Better Auth Wiring

Two files own auth: `packages/better-auth/src/auth.ts` (server, plugins, email handlers, secret) + `auth-client.ts` (mirror with client plugins). Server plugin without client plugin = undefined client methods.

- **Plugins shipped:** two-factor (TOTP), social-providers (Google wired, GitHub/Apple via factory), captcha (Turnstile), rate-limit (DB-backed), email-otp (3 types), one-time-token (sensitive actions), admin (platform-level — distinct from org-admin).
- **Auth methods toggled by `NEXT_PUBLIC_AUTH_*` env vars** — no code changes. Magic link bypasses MFA by design (email is itself a factor).
- **Session API** via `@kit/better-auth/context`: `getSession()`, `getAccountContext()`, `requireActiveOrganizationId()`, `requireAdmin()`, `isUserAdmin()`. All cached per-request via React `cache()`.
- Proxy at `apps/web/proxy.ts` is **first gate only** — gates `/admin/*` and redirects authed away from `/auth/*`. Component-level checks always re-verify.

## 6 · Billing (the most complex module)

- **Two providers**, one active per install: Stripe (default) or Polar via `NEXT_PUBLIC_BILLING_PROVIDER`. Multi-provider unsupported. Switching does not migrate.
- Architecture: `@kit/billing-api` (`BillingClient` + `getBilling(auth)`) on top of `@kit/better-auth/plugins/billing.ts`. Capability flags (`capabilities.supportsCancel`, `supportsEntitlements`, `supportsUsageMeters`, `supportsOrganizations`) for graceful degradation.
- **Most common error:** Stripe wants Price IDs (`price_…`), Polar wants Product IDs (`prod_…`).
- **Pricing models:** flat (`SimplePlan`), per-seat (`seatPriceId`, Stripe auto-syncs), metered (`recordUsage()`), hybrid (`AdvancedPlan` with `lineItems[]`), tiered (`tiers[]`). Mixed billing intervals rejected by Stripe.
- **Two seat concerns:** seat *billing* (`updateSubscriptionQuantity` triggered by org policies `seatBillingOnAcceptPolicy` / `seatBillingOnRemovePolicy`) vs seat *enforcement* (`SeatEnforcementService` throws `SeatLimitReachedError` at invite time — Stripe-only, Polar has no quantity to enforce).
- **Entitlements:** plan limits (config-based, `checkPlanLimit()`, **declarative only — must call explicitly**, uses strict `<`) + Stripe Entitlements (boolean flags via `checkEntitlement(customerId, lookupKey)`).
- **Polar limitations:** user-centric only (no org customers), no programmatic cancel/restore (portal only), `getUsage()` always returns all-time, `freeTrial` config ignored (set in dashboard), no CLI webhook forwarder.
- Lifecycle hooks in `packages/billing/{stripe,polar}/src/hooks/` — must be idempotent (webhooks redeliver), wrap in try/catch (don't block subscription updates on email failures).

## 7 · Database & Storage

- Single `db` singleton from `@kit/database`. Multiple `PrismaClient` instances exhaust the pool. Inside `$transaction`, use `tx` not `db`.
- Schema conventions: every tenant table has `organizationId String @map("organization_id")` with `onDelete: Cascade`. `createdAt`/`updatedAt` audit columns. Better Auth owns auth tables (`user, session, account, verification, twoFactor, organization, member, invitation, organizationRole, subscription, rate_limit`).
- `prisma migrate deploy` in production, `prisma migrate dev` locally. Generated client at `packages/database/src/prisma/generated/`.
- **Rate limit service** (`createRateLimitService()`): sliding window via single atomic upsert. Three backends: `database` (default, ~5-10ms, cross-instance), `secondary-storage` (Redis/Upstash, ~1-2ms), `memory` (dev-only). Toggle via `BETTER_AUTH_RATE_LIMIT_STORAGE`.
- **Storage** = thin facade over **unstorage**. `STORAGE_PROVIDER` env selects driver (`fs` default, `s3`, register custom). The kit's storage abstraction does **not** manage bucket permissions — delegated to provider console. Org-scoping via key path (`avatars/${userId}/file.png`), not bucket-level isolation.

## 8 · CMS, Email, i18n, Marketing

- **CMS** (`@kit/cms`): factory `createCmsClient()` switches on `CMS_CLIENT` env (`keystatic` default, `wordpress`, custom). Narrow interface: list, getBySlug, categories, tags. Kit does NOT ship `/keystatic` admin route — content edited as `.mdoc` files in `apps/web/content/{posts,changelog,documentation}`. WordPress requires pretty permalinks, REST not GraphQL.
- **Email** (`@kit/mailers`): `MAILER_PROVIDER` ∈ `nodemailer | resend | custom`. 15 React Email templates in `packages/email-templates/src/emails/` (must wrap in `<Tailwind>` or Gmail strips styles). Mailpit on port 8025 captures local SMTP — Resend bypasses (HTTP). Edge runtime requires Resend (Nodemailer needs `net`).
- **i18n** = **next-intl** (NOT next-i18next). `packages/i18n` (routing/navigation) + `apps/web/i18n/messages/{locale}/{namespace}.json`. RSC: `await getTranslations()`. Client: `useTranslations()`. Mixing them silently produces empty strings. Locale-aware navigation via `@kit/i18n/navigation` (NOT Next.js defaults). `localePrefix: 'as-needed'` — default locale has no URL prefix (SEO consideration).
- **Email translations are separate** at `packages/email-templates/src/locales/`. Render functions call `initializeEmailI18n()` for context-free `createTranslator()`.
- **Marketing pages** at `apps/web/app/[locale]/(public)`: composable from `@kit/ui/marketing` (`Hero`, `FeatureGrid`, `EcosystemShowcase`, `SecondaryHero`). Help docs at `/help` (NOT `/docs`). Search via **Pagefind** (`packages/cms/pagefind`), index built post-build.

## 9 · UI Conventions (`@kit/ui`)

- 80+ components on shadcn/ui + Base UI (`packages/ui/src/{shadcn,makerkit,base-ui}`). `components.json` declares `style: "base-nova"`, `iconLibrary: "lucide"`, `baseColor: "neutral"`.
- Composition pattern: **`render` prop, NOT Radix `asChild`** — `<DialogTrigger render={<Button />}>`.
- Adding a shadcn component: `pnpm dlx shadcn@latest add <name>` from inside `packages/ui`, **then manually rewrite `@/components` aliases to `#components/...`** (Turborepo + shadcn CLI alias bug).
- Theming = paste CSS vars from ui.shadcn.com/themes into `apps/web/styles/custom.css` under `@layer base { :root { ... } .dark { ... } }`. **Edit `custom.css`, NOT `shadcn-ui.css`** — kit upgrades may overwrite.
- Tailwind (CSS-first — version per generated pins) with HSL triplets without `hsl()` wrapper. Dark mode via `.dark` class.
- Toasts via Sonner. Tables via TanStack via `DataTable`. Charts via Recharts via `ChartContainer`.
- **React-layer mandates** live in root `AGENTS.md` (## React) — do not restate, read them: always `react-hook-form` + `@kit/ui/form` for forms; avoid `useEffect` (justify when unavoidable); prefer RSC for data fetching; `'use client'` on client components; `data-testid` for E2E.

## 10 · Testing & Production

The full pyramid contract — including the ships-with-tests gate and PR-loop reviewer framing — lives in `Workflows/_test-pyramid-gate.md`. Sub-sections 10.1–10.6 below are the brief slice every dev agent receives.

### 10.1 · Pyramid Layers

Two-tier per Makerkit canon — Vitest unit + Playwright e2e. No formal integration tier (folds into "E2E with real DB" or "unit with mocks").

| Layer | Tool | Folder | What goes here |
|---|---|---|---|
| Unit | Vitest | `__tests__/<name>.test.ts` adjacent to source | Pure functions, business logic (RBAC, seat enforcement, subscription calc), Zod validations, error paths, edge cases |
| E2E | Playwright | `apps/e2e/tests/<feature>/<feature>.spec.ts` + `<feature>.po.ts` | Critical user flows, React components, real-DB query paths, authenticated session flows |

### 10.2 · Canonical Commands

```bash
# Unit
pnpm test:unit                                  # all packages
pnpm --filter @kit/<pkg> test:unit              # single package
pnpm --filter @kit/<pkg> test:unit:watch        # watch mode
pnpm --filter @kit/<pkg> test:unit:coverage     # with coverage

# E2E (production-build path — matches CI)
pnpm --filter web build:test
pnpm --filter web start:test                    # separate terminal
pnpm --filter web-e2e test:slow                 # full suite, 2 workers, stops on first failure

# E2E iteration
pnpm --filter web-e2e exec playwright test <file> --workers=1
pnpm --filter web-e2e test:ui                   # Playwright UI mode

# Healthcheck (catch-all)
mcp__makerkit__run_checks                       # typecheck + lint + format + package consistency
# If mcp__makerkit__run_checks is unavailable (server not connected — check the
# capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the
# read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run
# `pnpm healthcheck` in review/read-only contexts — it MUTATES files
# (oxlint --fix && oxfmt && pnpm run typecheck && manypkg fix).
```

### 10.3 · File Conventions

- Unit shared base: `tooling/vitest/vitest.config.ts` — `pool: 'forks'`, aliases `server-only` to a mock so server modules can be tested
- Unit naming: `__tests__/<name>.test.ts` adjacent to the source file
- E2E naming: `<feature>.spec.ts` + paired `<feature>.po.ts` (Page Object)
- Playwright config: `testIdAttribute: 'data-testid'`, `timeout: 120 * 1000`, `retries: 2`, `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`, `fullyParallel: true`, `baseURL: http://localhost:3000`
- `data-testid` format: kebab-case (`sign-in-button`, `team-invite-form`)
- React component tests pushed to E2E — Vitest doesn't render React in this kit

### 10.4 · Bootstrap Helpers (E2E auth shortcuts)

From `apps/e2e/tests/utils/bootstrap-helpers.ts` — skip UI for auth setup:

| Helper | Use when |
|---|---|
| `bootstrapAuthenticatedUser()` | Logged-in user; create user in DB and log in via API (no UI) |
| `bootstrapUserWithOrg()` | User owning a fresh organization |
| `bootstrapOrgWithMembers()` | Organization with multiple members |
| `bootstrapOrgMember()` | Regular (non-owner) member context |
| `bootstrapSuperAdminUser()` | Admin account |

Mailbox PO hits Mailpit. UI login flows are tested ONLY when the test's purpose IS the login flow.

### 10.5 · Do's and Don'ts

**Do**
- Each test creates its own data
- Polling assertions for async: `await expect(async () => { ... }).toPass()`
- Descriptive test names explaining behavior
- Run with `--workers=1` locally before pushing
- `data-testid` (kebab-case) on every new interactive element

**Don't**
- Test dependencies between specs
- Vague names like "should work"
- `test.only` left in submission
- Unit-test React components (push to E2E)
- Unit-test database queries (push to E2E with real DB)

### 10.6 · Page Object Pattern

```typescript
// auth.po.ts
export class AuthPageObject {
  constructor(private page: Page) {}
  async goToSignIn() { await this.page.goto('/auth/sign-in'); }
  async signIn(p: { email: string; password: string }) {
    await this.page.getByTestId('sign-in-email').fill(p.email);
    await this.page.getByTestId('sign-in-password').fill(p.password);
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

### 10.7 · Production / Monitoring / Analytics / Docker

- **Monitoring** (`@kit/monitoring`): only Sentry first-party. PostHog/Honeybadger/SigNoz are stub docs — implement `MonitoringService` and register in `get-monitoring-provider.ts` (forgetting the enum entry silently downgrades to console fallback).
- **Analytics** (`@kit/analytics`): default is `NullAnalyticsService`. `AnalyticsManager` broadcasts to N providers. Events catalog is open. Traits are `Record<string,string>` only.
- **Production:** generate env vars via `pnpm --filter dev-tool dev` → `localhost:3010/variables` → Production mode. `prisma migrate deploy` (never `dev`). Webhooks: `/api/auth/stripe/webhook`, `/api/auth/polar/webhook` (NOT `/api/stripe/webhook`).
- **Docker:** `pnpm run turbo gen docker` produces multi-stage Dockerfile based on Next.js `output: "standalone"`. Healthcheck at `/api/healthcheck`. Cross-arch needs `docker buildx --platform linux/amd64`.

## 11 · Twelve Highest-ROI Gotchas

1. `NEXT_PUBLIC_*` are baked at build time — adding post-build leaves client `undefined`.
2. `NEXT_PUBLIC_SITE_URL` no trailing slash, exact `https://`. Wrong = OAuth + email links break.
3. Stripe needs `price_…`, Polar needs `prod_…`. Inverted = checkout fails.
4. Webhook URLs are `/api/auth/{stripe,polar}/webhook`, not `/api/{provider}/webhook`.
5. Inside `$transaction` use `tx`, not `db`.
6. Don't catch redirect errors — Next.js `redirect()` throws a special error; use `isRedirectError()` from `next/dist/client/components/redirect-error`.
7. Plugin without client mirror = undefined methods. New tables = `schema:generate` + `prisma migrate dev`.
8. Admin RBAC resource names MUST be singular.
9. Custom roles below hierarchy 50 silently inherit member template.
10. After-hook errors don't roll back — log, don't throw.
11. Banning user does NOT revoke sessions — call `revokeAllUserSessions` separately.
12. shadcn CLI generates `@/components` aliases that break — manually rewrite to `#components/...`.

## 12 · Where to Look When You Need…

| Need | Read first |
|---|---|
| New feature scaffolding | `docs/development-guide/adding-features.mdoc` + `apps/web/config/app.config.ts` |
| New permission/role | `packages/rbac/src/rbac.config.ts` + `docs/members-management/custom-roles.mdoc` |
| New billing plan | `packages/billing/config/src/config.ts` + `docs/billing/billing-configuration.mdoc` |
| New email | `packages/email-templates/src/emails/` + `docs/emails/templates.mdoc` |
| New auth method | `packages/better-auth/src/plugins/` + `docs/better-auth/adding-plugins.mdoc` |
| New CMS provider | `packages/cms/types/src/cms-client.ts` + `docs/content/creating-your-own-cms-client.mdoc` |
| New mailer | `packages/mailers/core/src/registry.ts` + `docs/emails/custom-mailer.mdoc` |
| New monitoring backend | `packages/monitoring/api/src/get-monitoring-provider.ts` + `docs/monitoring/custom-provider.mdoc` |
| Admin extension | `packages/admin/src/admin-sidebar.tsx` + `docs/admin/extending-admin.mdoc` |
| Org lifecycle hook | `packages/organization/policies/src/registry.ts` + `docs/organizations/lifecycle-hooks.mdoc` |
| **The behavioral rule for ANY task** | the **local `AGENTS.md`** (14 local ones — 11 `packages/*`, `apps/web`, `apps/e2e`, `tooling/mcp-server` — each with a `CLAUDE.md`=`@AGENTS.md` shim; +root = 15 repo-wide) + the matching guide in `docs/development-guide/*.mdoc` — root `AGENTS.md` "## Package Guidelines" lists them. AGENTS.md = checklist; the dev-guide = reasoning + anti-patterns. **Read the local AGENTS.md before editing in a package.** |
| Architecture-boundary question | root `AGENTS.md` "## TypeScript" + "## Package Guidelines" (never mix client/server imports; separate `package.json` exports) — no dependency-cruiser config exists in this repo |

## 13 · The Agentic Bridge (read before editing)

The kit ships an always-fresh agent-onboarding mechanism this digest must NOT duplicate — defer to it:

- **Per-package `AGENTS.md`** carries each package's non-negotiables; a `CLAUDE.md`=`@AGENTS.md` shim makes it auto-load in Claude Code (14 local pairs across `packages/*`, `apps/*`, `tooling/mcp-server`; count pinned in the generated block). The most-local `AGENTS.md` wins on conflict. When adding a package, add both files or its guidance is invisible.
- **Root `AGENTS.md` "## Package Guidelines"** routes you to the per-package `AGENTS.md` files; the behavioral deep-dives live in `docs/development-guide/*.mdoc` (server-actions, working-with-forms, database-operations, action-middleware, adding-features, development-workflow). Surface drift anti-patterns to watch: don't catch `redirect()` (`isRedirectError`), `revalidatePath` placement, client/server `'use server'`/`'server-only'` split.
- **Service pattern** — root `AGENTS.md` mandates "Use service pattern for server-side APIs"; the data-access flow is detailed in `docs/development-guide/server-actions.mdoc` + `docs/development-guide/database-operations.mdoc`.
