# Deployment notes

## Railway

One repository, one environment, three services. Both application services come
from this same repo and are told apart by their **Root Directory**.

### 1. Database service

**New → Database → Add PostgreSQL.** It is a managed service — nothing is built
from this repo for it. Optionally add Redis the same way.

### 2. Backend service

**New → GitHub Repo → this repository**, then in **Settings**:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Builder | Dockerfile (picked up from `backend/railway.toml`) |
| Healthcheck path | `/api/v1/health/live` |

**Variables** (reference syntax keeps them in sync automatically):

```
DATABASE_URL = ${{ Postgres.DATABASE_URL }}
REDIS_URL    = ${{ Redis.REDIS_URL }}
```

…plus the secrets listed in `backend/.env.example`.

Migrations run automatically: the container start command is `npm run release`,
which executes `prisma migrate deploy` before booting the API. Nothing extra to
configure.

### 3. Frontend service

**New → GitHub Repo → the same repository**, then in **Settings**:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Builder | Dockerfile (picked up from `frontend/railway.toml`) |
| Healthcheck path | `/` |

**Variables:**

```
API_INTERNAL_URL = http://${{ backend.RAILWAY_PRIVATE_DOMAIN }}:4000
```

This keeps frontend→backend traffic on Railway's private network. Next.js
rewrites `/api/*` to that URL server-side, so the browser only ever talks to the
frontend's own origin — no CORS, and the backend needs no public domain.

> Give the frontend **no** database credentials. It must never receive
> `DATABASE_URL` or any JWT/encryption secret.

### Deploys

Railway tracks the `main` branch. Because each service has a Root Directory,
Railway only rebuilds a service when files under its directory change — a
frontend-only commit will not redeploy the backend.

## AWS reference mapping

- **Web/API:** ECS Fargate or App Runner behind an ALB
- **Database:** encrypted RDS PostgreSQL with multi-AZ and PITR
- **Cache:** ElastiCache Redis with TLS and authentication
- **Storage:** private S3 bucket with Block Public Access and KMS encryption
- **Secrets:** Secrets Manager injected at runtime
- **Monitoring:** CloudWatch plus Sentry; scrape `/api/v1/metrics` from a private network

Keep API and metrics endpoints private where possible. Terminate TLS at the load balancer, enforce HTTPS, restrict security groups, and use a distinct KMS key per environment.

## Backups and recovery

Enable PostgreSQL point-in-time recovery, S3 versioning, and lifecycle policies. Test restore procedures quarterly. Audit-log exports should be copied to a separate write-once retention bucket.
