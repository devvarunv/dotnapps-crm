# Testing strategy

What's automated, what's manually verified, and what's still open — mapped to
the categories in the product spec (§28).

## Running the suite

```bash
npm test              # unit tests — no database needed
npm run test:integration   # integration tests — needs the test database below
npm run test:all      # everything
```

Integration tests run against a **dedicated** database so they can freely
`TRUNCATE` between runs — never point them at dev or prod data.

```bash
createdb dotnapps_crm_test
echo 'DATABASE_URL="postgresql://<you>@localhost:5432/dotnapps_crm_test?schema=public"' > .env.test
DATABASE_URL="$(grep DATABASE_URL .env.test | cut -d'"' -f2)" npx prisma migrate deploy
npm run test:integration
```

`tests/setup.ts` loads `.env.test` (falling back to `.env`) before any test
file imports app code, so `src/lib/db.ts`'s Prisma client points at the test
database automatically.

## What's covered today

**Unit tests** (`tests/unit/`, no DB) — 62 tests:

- **Permissions** — the full RBAC matrix (`can`/`canAny`/`assignableRoles`)
  for every role, including the negative cases (VIEWER can't write, SALES
  can't manage members, only OWNER/ADMIN can manage integrations).
- Integration secret encryption round-trip + tamper detection
  (`src/lib/crypto.ts`).
- Webhook HMAC signature verification — valid, tampered body, wrong secret,
  missing header, bare-hex format.
- Billing entitlement pure helpers — price formatting, monthly-cents
  conversion, read-only/needs-attention state derivation.
- List-query parsing, pagination math, querystring building.
- Automation rule config defaults/validation.
- Rate limiter window behaviour.
- Utility functions (`slugify`, `initials`, `cn`) and a handful of Zod
  schemas (signup, login, lead).

**Integration tests** (`tests/integration/`, real Postgres) — 17 tests:

- **Cross-tenant access / IDOR-BOLA (security)** — a lead list scoped to org
  A never returns org B's rows; `assertCompanyInOrg` and `resolveOwnerId`
  reject ids that belong to another org's data even when the id itself is
  well-formed; a direct `findFirst` scoped by `orgId` returns `null` for a
  foreign record.
- **Plan/usage limits** — creating up to a plan's limit succeeds, one more
  throws `LimitError`; an absent metric is unlimited; archived records don't
  count toward usage.
- **Billing lifecycle & suspension** — `assertWritable` throws once a
  subscription is `SUSPENDED` and recovers when reactivated; a `CANCELED`
  subscription stays writable until its period ends; `runBillingLifecycle`
  moves an expired trial to `GRACE` and an expired grace to `SUSPENDED`, and
  is idempotent (a second run makes no further changes).
- **Automation execution (idempotency)** — a rule fires once per matching
  record; a second run creates zero duplicate tasks/executions; a disabled
  rule never fires; the stage-changed event hook is idempotent per
  (deal, stage) pair.
- **Dotnapps Invoice webhook processing** — a duplicate `externalId` delivery
  is ignored (no duplicate row, no duplicate `IntegrationEvent`); a payment
  for a not-yet-known invoice fails cleanly with no partial row; events are
  scoped to the org they were received for.

## Manually verified (not yet automated)

Every phase of this build was exercised end-to-end in a real browser against
the running app as it was built, including:

- The full golden flow: signup → create business → invite team → lead →
  qualify → convert to contact/company/deal → move through pipeline stages →
  create quotation → accept (webhook simulation) → invoice → payment.
- Import/CSV export flows, bulk lead actions, and their permission scoping.
- Role-by-role UI + server-action checks (OWNER/ADMIN/MANAGER/SALES/VIEWER)
  across every module, including that a denied role gets both a hidden
  control *and* a server-side rejection if the action is called directly.
- Responsive behaviour on mobile viewport widths for the app shell.
- Empty, loading (via Suspense boundaries where used), error, and
  permission-denied states on every major screen.

This isn't a substitute for automated E2E coverage — it's the honest current
state. See "Open" below.

## Open

- **Automated E2E** (Playwright or similar) covering the golden flow above.
  Not set up in this repo yet — the manual pass above is the closest
  equivalent today.
- **CSV import pipeline** doesn't exist yet (export does), so there's nothing
  to integration-test there.
- **Accessibility** — no automated `axe`-style scan is wired in; the app uses
  semantic elements, labelled form fields, and visible focus states
  throughout, but a real audit (screen reader pass, contrast check on every
  custom color) hasn't been done.
- **Load/performance testing** — not attempted.
- CI wiring (running `npm run test:all` on every PR) is not set up in this
  repo; do that in whatever CI system the deployment uses.
