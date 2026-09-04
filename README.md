# Dotnapps CRM

Turn leads into customers. Customers into revenue.

A modern, multi-tenant CRM. This repository implements all **8 build phases**
from the product specification: Foundation (auth, tenancy, RBAC, audit),
CRM Core (Leads / Contacts / Companies, tags, search, bulk actions, conversion),
Sales Pipeline (Deals, configurable pipelines, a drag-and-drop Kanban board,
Tasks, a unified Activity timeline), the **Dotnapps Invoice revenue
integration** (quotations, invoices, payments via a configurable provider with
signed webhooks, plus a labelled sandbox mode), **rule-based follow-up
automation** with in-app notifications (explicit condition/action rules, no AI),
**reports & analytics** computed at read time from source records, **SaaS
subscriptions** (configurable plans, server-side usage limits, a trial / grace
/ suspension lifecycle), and **hardening** — rate limiting, security headers,
error boundaries, and an automated test suite. See "What's implemented" per
phase below, and [docs/TESTING.md](docs/TESTING.md) /
[docs/OPERATIONS.md](docs/OPERATIONS.md) for the honest state of testing and
ops readiness.

> **No AI in V1.** The architecture is kept modular so AI features can be added
> in V2, but none are present.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Actions) + React 19 |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Prisma |
| Auth | Auth.js v5 (Credentials provider, JWT sessions, bcrypt) |
| Styling | Tailwind CSS v4, hand-rolled UI primitives |
| Validation | Zod |

## What's implemented (Phase 1)

- **Marketing** landing page and pricing page.
- **Signup / login / logout** with hashed passwords and session cookies.
- **Onboarding**: create a business (organization); the creator becomes `OWNER`.
- **Multi-tenancy**: every org-owned row carries `orgId`; the active
  organization is held in an `httpOnly` cookie with an in-app switcher.
- **RBAC** (`src/lib/rbac.ts`): `OWNER · ADMIN · MANAGER · SALES · VIEWER` with a
  permission catalogue covering every planned module. Enforced server-side in
  `requireOrgContext` / `requirePermission` / `checkPermission`; UI hiding is
  never the security boundary.
- **Team management** (`/settings/team`): invite by email (real tokenised link,
  email delivery is a later phase), change roles, remove members — each guarded
  and written to the audit log.
- **Invitations**: accept flow at `/accept-invite/[token]`, also surfaced during
  onboarding.
- **Profile & organization settings**: name, password, business name.
- **Audit log**: append-only record of auth, org, and membership mutations;
  shown on the dashboard and in the Super Admin area.
- **Super Admin** (`/admin`, gated by `User.isSuperAdmin`): platform counts,
  business list, cross-tenant activity feed. Read-only.
- **App shell**: permission-aware sidebar; every remaining Sales/Revenue/Reports
  module has a route with an honest "ships in phase N" placeholder — no fake
  data or fake success states.

## What's implemented (Phase 2 — CRM Core)

- **Leads** (`/leads`): list with search, status/source/owner/tag/archived
  filters, pagination; create/edit; detail view with notes; archive (never
  hard-delete); CSV export of the filtered set (`/leads/export`, audited,
  `export:data` gated).
- **Bulk actions** on leads: reassign owner, change status, add/remove tag,
  archive — each RBAC-checked and audited.
- **Lead conversion**: creates or links a Contact and/or Company, carries tags
  and notes across, advances the lead's status, keeps the original lead
  traceable. Same-name companies are reused to reduce duplicates.
- **Contacts** (`/contacts`) and **Companies** (`/companies`): list + filters +
  export, create/edit, detail views. Company detail manages billing/shipping/
  other **addresses** and shows linked contacts; contact detail shows the
  company and conversion origin. Financial totals are intentionally left to the
  Dotnapps Invoice phase.
- **Tags**: shared per-org labels, managed at `/settings/tags` (`org:manage`),
  applied on any list/detail via a comma-separated input; new names auto-create.
- **Notes**: lightweight timeline entries on leads, contacts and companies —
  the seed of the Phase 3 activity timeline.
- **Global search** (`/search`): leads + contacts + companies, tenant- and
  permission-scoped.
- **Dashboard**: KPIs now compute real lead metrics (new in 30 days, open, won,
  converted, conversion rate); deal/revenue tiles remain `—` until Phase 3–4.

### CRM Core notes

- Read access to CRM records is org-wide for every role in V1; create / edit /
  delete / assign / archive / export are permission-gated. Per-user record
  visibility (e.g. "sales sees only owned") is a later refinement — the single
  place to add it is each module's `query.ts` where-builder.
- CSV **import** (mapping / validation / preview wizard) is still to come; export
  is done.

## What's implemented (Phase 3 — Sales Pipeline)

- **Deals** (`/deals`): list with search + pipeline/stage/status/owner/tag/
  archived filters, pagination; create/edit; detail view; archive; CSV export.
- **Pipelines & stages** (`/settings/pipelines`, `org:manage`): multiple
  pipelines, one default; add / rename / reorder / delete stages with
  probability and an `OPEN` / `WON` / `LOST` kind. Deleting a stage moves its
  deals to a sibling. New pipelines seed a sensible default stage set.
- **Kanban board** (`/pipeline`): columns per stage, HTML5 drag-and-drop to
  change stage (optimistic), a per-card stage `<select>` fallback on mobile,
  owner/tag/pipeline filters. Every move writes a system Activity + audit entry.
- **Deal lifecycle**: moving to a stage applies its probability; `WON`/`LOST`
  stages (or the explicit **Mark won / Mark lost** action with a reason) set
  `status`, `closedAt`, and the win/loss reason.
- **Tasks** (`/tasks`): All / My tasks / Overdue views; status/priority/assignee
  filters; inline status toggle and edit; create standalone or from a deal.
  Tasks relate to a Lead, Contact, Company or Deal. Completing a deal task logs
  a timeline Activity.
- **Activity timeline**: `Activity` is now the single timeline primitive
  (Phase 2 `Note` rows were migrated into it). Manual entries (`NOTE`, `CALL`,
  `MEETING`, `EMAIL`, `WHATSAPP`, `FOLLOW_UP`, `DEMO`) are visually distinct
  from `SYSTEM` ones (stage changes, task completions, conversions). Shown on
  every Lead / Contact / Company / Deal, and globally at `/activities`.
- **Lead conversion** now also opens a Deal in the default pipeline (optional).
- **Dashboard**: real open-deal count, open-pipeline value, won count/value,
  "deals closing soon" (next 14 days), and your open-task count.

### Sales notes

- `Deal.status` and `Deal.probability` are denormalised from the deal's stage
  for fast filtering; the stage remains the source of truth.
- Board drag-and-drop uses native HTML5 DnD (no external library).

## What's implemented (Phase 4 — Dotnapps Invoice revenue integration)

CRM owns the relationship and sales process; **Dotnapps Invoice stays the
financial source of truth**. The CRM only mirrors provider values into
`QuotationLink` / `InvoiceLink` / `PaymentEvent`, keyed by the provider's
`externalId`, and never computes taxes, balances or totals itself.

- **`/settings/integrations`** (`integration:manage`): connect Dotnapps
  Invoice. Base URL + API key (AES-256-GCM encrypted at rest via `AUTH_SECRET`),
  a generated webhook signing secret, "advance stage on quotation accept"
  toggle, **Test connection**, enable/disable, disconnect, rotate secret.
  Two modes:
  - **Live** — real HTTP calls to the configured base URL.
  - **Mock** — a built-in, clearly-labelled sandbox so the flows are usable
    without a real account. Every screen showing mock data carries a sandbox
    banner; the CRM never reports success it did not observe.
- **Webhook** `POST /api/integrations/invoice/webhook?org=<id>` — verifies an
  HMAC-SHA256 `X-Dotnapps-Signature` against the org's secret (missing/invalid
  → 401), idempotent on `(eventType, externalId)` via `IntegrationEvent`,
  handles `quotation.*` / `invoice.*` / `payment.*`. Accepting a quotation
  optionally advances the linked deal to the next open stage and logs it.
- **Deal → Revenue panel**: setup state when not connected; when connected,
  **Create quotation** (calls the provider / mock), lists linked quotations,
  invoices and payments with links out, and — in mock mode — buttons to
  simulate `accepted` / `invoice` / `payment` webhooks against the sandbox.
- **`/quotations`, `/invoices`, `/payments`**: read-only lists from the link
  tables with a setup state; invoices show billed / collected / outstanding
  roll-ups (aggregates of provider values, not recalculated).
- **Company detail** shows billed / collected / outstanding from `InvoiceLink`s.
- **Super Admin** gains an integration-health panel (status, mode, last check,
  failed webhook count). **Dashboard** shows revenue collected when connected.

### Integration notes

- Secrets are stored as AES-256-GCM ciphertext; `AUTH_SECRET` is the key
  material, so nothing sensitive is in source or plaintext in the DB.
- The mock provider (`src/lib/integrations/invoice-mock.ts`) returns the same
  DTOs a real provider would; swapping in a real Dotnapps Invoice account is a
  base-URL + API-key change plus pointing its webhooks at the endpoint above.

## What's implemented (Phase 5 — rule-based follow-up automation, no AI)

Explicit `when → do` rules only. No AI, no hidden heuristics.

- **`/settings/automation`** (`org:manage`): create / edit / enable / disable /
  delete rules and **Run automation now**. Triggers: new lead with no
  follow-up, quotation sent with no response, deal close date approaching,
  task overdue, deal stage changed. Actions: create a follow-up task, notify
  the owner / assignee / managers. Config: delay, window, task title +
  priority.
- **Engine** (`src/lib/automation/engine.ts`): every fired rule writes a
  `ReminderExecution`; a `@@unique(ruleId, dedupeKey)` makes the runner
  **idempotent** (re-running does nothing). Failures are stored with the error
  and are **retryable** from the executions log. `DEAL_STAGE_CHANGED` is
  event-driven (hooked into the stage-change actions + the webhook
  auto-advance); the rest are evaluated by the poll.
- **Scheduler endpoint**: `POST /api/automation/run` with
  `Authorization: Bearer $AUTOMATION_SECRET` (optionally `?org=<id>`). Point a
  cron job at it; unauthorized calls get 401.
- **Notifications** (`src/lib/automation/notify.ts`): an in-app list at
  `/notifications` with a sidebar unread badge, mark-read / mark-all-read.
  Sources: assignment (task assignee, lead/deal owner, bulk lead assign),
  `@mention` in an activity/note (matched to a member's first / full name or
  email local-part), plus every automation notify action. Honours each user's
  muted types from **`/settings/notifications`**.

### Automation notes

- The engine caps candidates per rule per run (200) — a real deployment would
  page, but the dedupe key means missed rows are picked up next run.
- Email delivery for notifications is not wired; `emailEnabled` is stored for
  when it is.

## What's implemented (Phase 6 — reports & analytics)

`/reports` is a single analytics page with a **date-range** (30d / 90d / 12m /
all) and **owner** filter. Every figure is computed at read time from the
underlying rows (`src/lib/reports/metrics.ts`) — nothing is cached or
denormalised, so a report always reconciles against its source records, and no
financial logic is duplicated (revenue figures come straight from the
Invoice-link tables).

- **Leads** — volume, converted, conversion rate; breakdown by status and by
  source (with per-source conversion %).
- **Pipeline** — open deals, open value, probability-weighted value, and value
  by stage.
- **Won & lost** — won/lost counts and value, win rate, average deal size,
  average sales cycle (created → closed), and closed-on-time vs expected.
- **Salesperson performance** — per-member table: leads, deals won, won value,
  open pipeline, tasks completed. CSV export at `/reports/export`
  (`export:data` gated, range carried in the filename).
- **Revenue** (only when Dotnapps Invoice is connected) — collected,
  outstanding, quotation-to-invoice conversion, revenue by source and top
  customers.

The dashboard keeps its snapshot KPIs and links out to the full reports.

## What's implemented (Phase 7 — SaaS subscriptions, plans & usage limits)

Plans are platform-level and configurable — **no plan names are hardcoded in
app logic**; a plan's `limits` JSON drives every entitlement check.

- **Model**: `SubscriptionPlan` (price, interval, trial days, `limits`,
  `features`), `Subscription` (one per org: `TRIALING → GRACE → SUSPENDED`,
  plus `ACTIVE` / `PAST_DUE` / `CANCELED`), `UsageRecord` (per-period metered
  usage, e.g. exports).
- **Entitlements** (`src/lib/billing/entitlements.ts`): `getSubscription`
  (creates a trialing one lazily), `checkLimit` / `assertWithinLimit`
  (live counts for members / leads / contacts / companies / deals / rules /
  integrations; per-month count for exports), `assertWritable` (blocks all
  writes on a suspended workspace — data is retained).
- **Enforcement (server-side)**: the shared `guard()` rejects mutations on a
  suspended org; create actions for leads / contacts / companies / deals /
  automation rules and member invites check the plan limit; every CSV export
  route consumes and enforces the monthly export allowance (`429` when spent).
- **Lifecycle**: `runBillingLifecycle()` advances trial → grace → suspended by
  date, notifies admins, and is exposed at
  `POST /api/billing/lifecycle` (`Authorization: Bearer $AUTOMATION_SECRET`).
- **`/settings/subscription`** (`billing:manage`): current plan + status,
  usage bars, self-serve upgrade / downgrade / cancel / resume, and a sandbox
  "simulate payment success / failure" (no real payment provider is wired).
- **`/pricing`** renders from the public plan rows.
- **Super Admin** gains **Plans** (create / edit, limits editor) and
  **Subscriptions** (per-org plan + status control, MRR, run-lifecycle), and
  MRR / suspended tiles on the overview.
- A billing banner (trial ending / past due / suspended / cancelling) shows in
  the app shell for every role.

### Billing notes

- There is no payment integration; plan changes and the sandbox actions are
  the only ways a subscription becomes `ACTIVE`. Swapping in a real provider
  means wiring its checkout + webhooks to the same lifecycle transitions.

## What's implemented (Phase 8 — hardening)

- **Rate limiting** (`src/lib/rate-limit.ts`) on login, signup, password
  change, the Invoice webhook, and both cron endpoints (429 once exceeded).
  In-process by design — see [docs/OPERATIONS.md](docs/OPERATIONS.md) for the
  multi-instance caveat.
- **Security headers** (`next.config.ts`): CSP, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS.
- **Error handling**: root `error.tsx` / `global-error.tsx` boundaries and a
  branded `not-found.tsx`, each logging a structured event
  (`src/lib/logger.ts`) at the point a real error tracker would hook in.
- **IDOR/BOLA audit**: every object-scoped mutation was checked to confirm it
  verifies `orgId` ownership before acting; codified as integration tests
  (below) rather than left as a one-time manual pass.
- **Automated test suite** — Vitest unit tests (permissions, crypto, webhook
  signatures, billing math, query parsing, rate limiting, validation — no DB)
  plus integration tests against a real Postgres database (tenant isolation /
  cross-tenant access, plan-limit enforcement, billing suspension lifecycle,
  automation idempotency, webhook idempotency). See
  [docs/TESTING.md](docs/TESTING.md) for the full breakdown, `npm test` to run
  it, and what's still manual vs. automated.
- **Operations runbook** — [docs/OPERATIONS.md](docs/OPERATIONS.md): deploy
  steps, required env vars, backup/restore, scheduled-job wiring, monitoring
  hooks, and known gaps (no nonce-based CSP yet, a transitive `postcss`
  advisory in Next 15.1.x).

## Local setup

### 1. PostgreSQL

Any PostgreSQL 14+ instance works. With Homebrew:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb dotnapps_crm
```

### 2. Environment

```bash
cp .env.example .env
```

Then set:

- `DATABASE_URL` — e.g. `postgresql://<you>@localhost:5432/dotnapps_crm?schema=public`
- `AUTH_SECRET` — `openssl rand -base64 32`
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` in dev

### 3. Install, migrate, seed

```bash
npm install
npm run db:migrate      # applies prisma/migrations
npm run db:seed         # demo org + one user per role
npm run dev             # http://localhost:3000
```

### Seeded accounts

All use password `Password123!`:

| Email | Access |
| --- | --- |
| `superadmin@dotnapps.test` | Platform Super Admin (no workspace) |
| `owner@dotnapps.test` | Owner of *Acme Inc.* |
| `manager@dotnapps.test` | Manager of *Acme Inc.* |
| `sales@dotnapps.test` | Sales of *Acme Inc.* |
| `viewer@dotnapps.test` | Viewer of *Acme Inc.* |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create / apply a dev migration |
| `npm run db:deploy` | Apply migrations (CI / prod) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm test` | Unit tests (no database) |
| `npm run test:integration` | Integration tests (needs `dotnapps_crm_test`, see [docs/TESTING.md](docs/TESTING.md)) |
| `npm run test:all` | Everything |

## Project layout

```
prisma/schema.prisma        Foundation + CRM Core data model
src/lib/
  auth.ts / auth.config.ts  Auth.js (Node + edge-safe split)
  context.ts                getAuthContext / requireOrgContext / requirePermission / checkPermission
  rbac.ts                   Permission catalogue + role matrix
  audit.ts                  recordAudit()
  validation.ts             Zod schemas (Foundation)
  crm/                      CRM Core: labels, list-query parsing, csv, tag/owner services, guard
src/middleware.ts           Route protection (edge)
src/components/app/         shell, list-toolbar, pagination, tag-badge, note-thread, empty/denied states
src/app/(auth)/             login, signup
src/app/onboarding/         create business, accept invites
src/app/(app)/              authenticated shell
  leads/ contacts/ companies/   list + [id] + [id]/edit + new + export route + actions
  deals/                        list + [id] + [id]/edit + new + export + actions
  pipeline/                     Kanban board
  tasks/ activities/            task views + global activity feed
  quotations/ invoices/ payments/  read-only revenue-link lists
  notifications/                in-app notification list
  search/                       global search
  settings/           profile, organization, team, tags, pipelines, integrations, automation, notifications
src/lib/crm/                sales.ts (pipeline/activity helpers) + labels/query/csv/service/guard
src/lib/integrations/       invoice client (live + mock), webhook HMAC, event sync
src/lib/automation/         engine (rule evaluators + idempotent runner), notify, rules
src/lib/reports/            report range parsing + read-time metric functions
src/lib/billing/            entitlements (limits + suspension) + lifecycle job
src/app/(app)/reports/      analytics page + salesperson CSV export
src/app/(app)/settings/subscription/   plan, usage, upgrade/cancel, sandbox
src/app/api/integrations/invoice/webhook   signed provider webhook endpoint
src/app/api/automation/run                 secret-protected scheduler endpoint
src/app/api/billing/lifecycle              secret-protected billing lifecycle job
src/app/admin/              Super Admin — overview, plans, subscriptions
src/lib/rate-limit.ts       in-process sliding-window limiter
src/lib/logger.ts           structured JSON server logging
src/app/error.tsx / global-error.tsx / not-found.tsx   error & 404 boundaries
tests/unit/                 Vitest, no database
tests/integration/          Vitest against a dedicated Postgres test database
docs/TESTING.md             what's automated vs. manual
docs/OPERATIONS.md          deploy, backup, monitoring, rate-limit notes
```

## Notes / next steps

All 8 phases from the spec's build order are implemented. What's genuinely
still open, honestly:

- `package.json#prisma` (the `seed` hook) is deprecated in favour of
  `prisma.config.ts` in Prisma 7 — migrate before upgrading.
- **CSV import** (mapping / validation / preview wizard) — export exists,
  import doesn't yet.
- **Custom fields** (`CustomField`/`CustomFieldValue`) — modelled in the spec,
  not built.
- **Per-user record visibility** — CRM read access is currently org-wide for
  every role; a "sales sees only owned/assigned" scope is a refinement to
  each module's `query.ts` where-builder, not a schema change.
- **Email delivery** — invites, notifications and billing-lifecycle emails
  currently show a real, in-app-only state (invite links are generated and
  shown, not emailed).
- `reports:view` shows the salesperson-performance table to every role; a
  manager-only gate for that section is a later refinement.
- Automated **E2E** coverage (Playwright) and a nonce-based CSP are the two
  largest gaps called out in [docs/TESTING.md](docs/TESTING.md) and
  [docs/OPERATIONS.md](docs/OPERATIONS.md) respectively.
- Multi-currency roll-ups (reports and revenue currently assume USD display
  formatting even though records store their own `currency`).
