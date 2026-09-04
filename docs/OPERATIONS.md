# Operations runbook

Deploy, backup, monitoring and incident notes for Dotnapps CRM. Pairs with
[README.md](../README.md) (setup, feature map) and
[docs/TESTING.md](./TESTING.md) (what's automated).

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`. Also the key material for encrypting integration secrets (`src/lib/crypto.ts`) — **rotating it invalidates every stored API key / webhook secret**; re-save integrations after rotation. |
| `AUTH_URL` / `AUTH_TRUST_HOST` | yes | Base URL Auth.js runs behind. |
| `NEXT_PUBLIC_APP_URL` | yes | Used for absolute links (invites, webhook URL shown in Settings). |
| `AUTOMATION_SECRET` | yes for schedulers | Bearer secret for `POST /api/automation/run` and `POST /api/billing/lifecycle`. |

Never commit `.env` / `.env.test`. Store production secrets in the hosting
platform's secret manager, not in source.

## Deploying

1. `npm ci`
2. `npm run build` (runs `prisma generate` first)
3. `npm run db:deploy` (`prisma migrate deploy` — safe to run repeatedly;
   only applies pending migrations, never resets data)
4. `npm run db:seed` **once**, only for a fresh environment you want demo
   data in (it upserts by email/slug, so re-running is safe but not
   meaningful in production)
5. Start with `npm start`

### Scheduled jobs

Two endpoints need an external scheduler (cron, a hosting platform's
scheduled functions, etc.) — both are secret-protected and rate-limited:

- `POST /api/automation/run` — evaluates follow-up rules. Run every 5–15 min.
- `POST /api/billing/lifecycle` — advances trial → grace → suspended. Run
  daily.

```bash
curl -X POST https://your-domain/api/automation/run \
  -H "Authorization: Bearer $AUTOMATION_SECRET"
```

### Rollback

`prisma migrate deploy` only applies forward migrations. To roll back a bad
release: redeploy the previous build artifact/image against the same
database. If a migration must be reverted, write a new forward migration that
undoes it — do not edit or delete an already-applied migration file.

## Database backups & recovery

No backup automation is wired into this repo (it depends on your Postgres
host). Minimum viable policy:

- **Daily** `pg_dump` (or your host's managed snapshot) with **7–30 day**
  retention; weekly snapshots retained longer if storage allows.
- Store dumps somewhere other than the DB host itself.
- **Test restores periodically** — an untested backup is not a backup.
- Suspended-workspace data is retained indefinitely per the product spec
  (§22) until an admin cancels/deletes the org; there is no automatic purge.

Manual dump/restore:

```bash
pg_dump "$DATABASE_URL" -Fc -f backup.dump
pg_restore -d "$DATABASE_URL" --clean --if-exists backup.dump
```

## Monitoring & error logging

- Server-side errors and audited actions log as structured JSON lines via
  `src/lib/logger.ts` (`{ ts, level, message, ...meta }`) — pipe stdout/stderr
  to whatever log aggregator your host provides (most PaaS hosts do this
  automatically).
- `src/app/error.tsx` / `global-error.tsx` catch rendering errors and log a
  `client_error_boundary` / `root_error_boundary` event before showing a
  recovery UI — this is the integration point for a real error tracker
  (Sentry, etc.): call its client in those `useEffect` hooks.
- `AuditLog` (business-critical mutations) and `IntegrationEvent` (webhook
  processing outcomes, including `FAILED`) are queryable in-app —
  Super Admin → Overview shows a failed-webhook count; alert on it growing.
- Watch for repeated `billing.suspended` / `automation.run` failures in the
  audit log as an early signal something's wrong with the scheduled jobs.

## Rate limiting

`src/lib/rate-limit.ts` is an in-process sliding-window limiter applied to
login, signup, password change, the Invoice webhook, and both cron endpoints.
It is correct for a **single Node process**. If you scale to multiple
instances, replace the in-memory `Map` with a shared store (Redis, etc.) —
the call sites (`rateLimit(key, limit, windowMs)`) don't need to change.

## Known gaps / follow-ups

- No nonce-based CSP yet — `script-src`/`style-src` currently allow
  `'unsafe-inline'` because Next's App Router ships an inline RSC hydration
  bootstrap. Tightening this needs nonce plumbing through the root layout.
- `npm audit` flags a transitive `postcss` advisory bundled inside Next
  15.1.x (source-map path disclosure at build time, not a runtime request
  path). Fixed upstream in Next 16; upgrading is a deliberate, separate task.
- No file/attachment uploads exist yet, so there's no file-handling surface
  to hardened.
