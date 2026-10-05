# Database tier — PostgreSQL

The persistence tier for the Haven banking platform.

## Where things live

| Thing | Location | Why |
| --- | --- | --- |
| PostgreSQL instance (production) | Railway **managed PostgreSQL** service | Provisioned from the Railway dashboard, not built from this repo |
| PostgreSQL instance (local) | `database/docker-compose.yml` | Disposable local container |
| Prisma schema | `backend/prisma/schema.prisma` | — |
| Migrations | `backend/prisma/migrations/` | — |
| Seed script | `backend/prisma/seed.ts` | — |

### Why the schema lives in `backend/`

The backend is the **only** service that talks to PostgreSQL, and it is the
process that applies migrations on deploy. Prisma requires `schema.prisma`,
the `migrations/` folder, and the generated client to sit inside the service
that builds and runs them.

Railway builds the backend with **Root Directory = `backend`**, which means
only files under `backend/` are in that build context. A schema kept in a
sibling `database/` folder would simply not exist at build time, and both
`prisma generate` and `prisma migrate deploy` would fail.

So this directory owns the **PostgreSQL instance** (local compose + the
production runbook below); `backend/prisma/` owns the **schema that is
applied to it**.

## Production: Railway managed PostgreSQL

PostgreSQL on Railway is a managed service — there is no repo or Dockerfile to
deploy for it.

1. In your Railway **environment**: **New → Database → Add PostgreSQL**.
2. Open the **backend** service → **Variables**.
3. Add a *reference* variable so the two services are linked:

   ```
   DATABASE_URL = ${{ Postgres.DATABASE_URL }}
   ```

   Use the reference syntax rather than pasting the literal connection string —
   Railway then keeps it correct if the database is rotated or recreated.

4. Deploy. The backend container's start command is `npm run release`, which
   runs `prisma migrate deploy` before booting the API, so schema changes are
   applied automatically on every deploy.

> The frontend service must **not** get `DATABASE_URL`. It never touches the
> database; it only calls the backend over HTTP.

## Local development

```bash
# just the database
docker compose -f database/docker-compose.yml up -d

# or the whole stack (postgres + redis + minio + backend + frontend)
docker compose up -d
```

Then, from `backend/`:

```bash
npm run migrate      # create/apply a migration in dev
npm run seed         # load demo data
npm run studio       # browse data in Prisma Studio
```

Default local connection string:

```
postgresql://haven:haven_dev_password@localhost:5432/haven?schema=public
```

## Migrations

| Command | Run from | Purpose |
| --- | --- | --- |
| `npm run migrate` | `backend/` | Create + apply a migration during development |
| `npm run migrate:deploy` | `backend/` | Apply pending migrations (CI/production) |
| `npm run seed` | `backend/` | Insert demo data |

Existing migrations:

- `20261005000000_init`
- `20261005010000_customer_and_operations`
- `20261005020000_ledger_authority`
