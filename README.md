# Dotnapps CRM

Turn leads into customers. Customers into revenue.

A modern, multi-tenant CRM. This repository currently contains **Phase 1 —
Foundation** and **Phase 2 — CRM Core** from the product specification:
authentication, organizations and tenant isolation, server-side RBAC, an audit
log, the app shell, plus Leads, Contacts, Companies, Customer-360 detail views,
tags, notes, search, filtering, bulk actions, CSV import-ready export, and lead
conversion.

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
  search/                       global search
  settings/                     profile, organization, team, tags
src/app/admin/              Super Admin (separate layout + guard)
```

## Notes / next steps

- `package.json#prisma` (the `seed` hook) is deprecated in favour of
  `prisma.config.ts` in Prisma 7 — migrate before upgrading.
- **Phase 3 (Sales Pipeline: Deal, Pipeline, PipelineStage, Task, Activity)**
  attaches to the models block reserved at the bottom of `schema.prisma`. Notes
  become the first-class activity timeline.
- Still open in CRM Core: CSV **import** wizard, custom fields, per-user record
  visibility scoping.
- Email delivery, subscription/billing, and the Dotnapps Invoice integration are
  later phases; honest placeholder states for them are already in the UI.
