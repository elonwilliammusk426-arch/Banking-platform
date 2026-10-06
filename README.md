# Haven Banking Platform

A production-minded full-stack banking starter built as a TypeScript monorepo. It includes customer registration and verification, KYC onboarding, multi-currency accounts, beneficiaries, internal/ACH/wire transfer workflows, funding and withdrawals, card controls, customer support, an RBAC operations console, PostgreSQL/Prisma persistence, Redis, private S3-compatible storage, structured observability, and tamper-evident audit logs.

## Stack

| Layer | Technology |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4, reusable UI components |
| API | Node.js, NestJS, TypeScript, validation and rate limiting |
| Data | PostgreSQL, Prisma ORM 7, serializable transfer transactions |
| Identity | Argon2id, short-lived JWT access cookies, rotating opaque refresh sessions, TOTP MFA |
| Platform | Docker, Railway configs, AWS deployment guidance, Redis, S3/MinIO |
| Observability | Pino JSON logs, Sentry integration, Prometheus metrics, hash-chained audit logs |

## Repository layout

Three independently deployable tiers. Each application tier owns its
`package.json`, lockfile, `tsconfig.json`, and `Dockerfile`, so it can be built
on its own — this is what lets Railway deploy `frontend/` and `backend/` as
separate services from this one repository.

```text
frontend/                 Next.js 16 + React 19 + TypeScript + Tailwind 4
  app/ components/ lib/   Routes, UI components, API client
  Dockerfile              Standalone image (build context = frontend/)
  railway.toml            Railway service config (Root Directory = frontend)

backend/                  Node.js + NestJS 11 + TypeScript
  src/                    Domain modules (auth, banking, ledger, cards, admin…)
  src/prisma/             Generated Prisma client barrel + PG adapter
  prisma/                 schema.prisma, migrations/, seed.ts
  Dockerfile              Standalone image (build context = backend/)
  railway.toml            Railway service config (Root Directory = backend)

database/                 PostgreSQL tier
  docker-compose.yml      Local Postgres container
  README.md               Railway managed-Postgres runbook

infrastructure/           Prometheus and deployment notes
docker-compose.yml        Full local stack (db + redis + minio + both tiers)
```

### Tier boundaries

| Boundary | Mechanism |
| --- | --- |
| Frontend → Backend | HTTP only. `next.config.ts` proxies `/api/*` to `API_INTERNAL_URL`; no shared code. |
| Backend → Database | Prisma client, generated from `backend/prisma/schema.prisma`. |
| Frontend → Database | **None.** The frontend has no DB driver and never receives `DATABASE_URL`. |

Both boundaries are enforced in CI by the "Verify tier isolation" steps.

> **Why the Prisma schema lives under `backend/`:** Railway builds the backend
> with Root Directory `backend`, so only files under `backend/` exist in that
> build context. A schema in a sibling folder would be missing at build time and
> both `prisma generate` and `prisma migrate deploy` would fail. See
> [database/README.md](database/README.md).

## Quick start

### 1. Configure the environment

```bash
cp .env.example .env
# Replace JWT and MFA keys. Generate the MFA key with:
openssl rand -base64 32
```

### 2. Start backing services

```bash
docker compose up -d postgres redis minio create-bucket
# or just the database tier:
docker compose -f database/docker-compose.yml up -d
```

### 3. Install, migrate, and seed

Each tier installs separately — there is no root `node_modules`.

```bash
npm run install:all      # == (cd backend && npm install) + (cd frontend && npm install)
npm run db:migrate       # apply migrations  (runs in backend/)
npm run db:seed          # load demo data    (runs in backend/)
```

Demo account after seeding: `alex@haven.demo` / `ChangeMe!123456`. Change or remove it outside local development.

### 4. Run the platform

```bash
npm run dev              # both tiers together
npm run dev:frontend     # or one at a time
npm run dev:backend
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- MinIO console: http://localhost:9001
- Liveness: http://localhost:4000/api/v1/health/live
- Readiness: http://localhost:4000/api/v1/health/ready
- Metrics: http://localhost:4000/api/v1/metrics

The dashboard retrieves balances from the authenticated API and deliberately shows no fallback amounts when the API is unavailable. Customer routes include `/register`, `/verify`, `/login`, `/mfa`, and `/onboarding`; the operations interface is available at `/admin`.

The included integration providers are explicit **sandbox adapters**. Connect regulated KYC, card-issuing, ACH/wire, email, and SMS providers before processing real customers or funds.

## Product surface

### Customer and identity

- Registration, email/phone verification, login, rotating sessions, TOTP MFA, recovery codes
- Encrypted KYC profile and document onboarding with reviewer workflow
- Customer profile, persisted user/security/account preferences, trusted-device and session management, notifications, and support chat streams

### Money movement

- Checking, savings, vault, and multi-currency account records
- Append-only ledger authority: ledger balance is credits minus debits; available balance is ledger balance minus active holds
- Every customer/admin balance response is derived server-side from PostgreSQL ledger entries; projection fields are never used for display and the web app performs no optimistic balance arithmetic
- Beneficiaries, internal transfers, ACH/wire workflows, fees, schedules, receipts, deposits, and withdrawals
- Serializable writes, optimistic projection versions, idempotency keys, state events, and risk-review thresholds

### Cards and operations

- Virtual/physical issuance, activation, freeze controls, limits, history, and replacement lifecycle
- RBAC admin APIs for customers, KYC, transactions, transfer approvals, risk alerts, cards, fees, support, configuration, reports, and audit logs
- Provider interfaces with local sandbox adapters for KYC, cards, bank rails, and messaging

## Important API groups

- `/api/v1/auth`, `/api/v1/verification`, `/api/v1/customer`, `/api/v1/settings`, `/api/v1/kyc`
- `/api/v1/accounts`, `/api/v1/banking`, `/api/v1/payments`, `/api/v1/cards`
- `/api/v1/notifications`, `/api/v1/support`, `/api/v1/storage`
- `/api/v1/admin` (role protected)

Transfer, funding, and withdrawal requests require a unique `Idempotency-Key` header. High-value transfers require MFA and can be routed to operations review.

Browser requests use `credentials: include`. Mutations send the readable `csrf_token` cookie in the `X-CSRF-Token` header; access and refresh credentials remain `HttpOnly`.

## Quality checks

From the repository root (runs each tier in turn):

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Or per tier, which is what CI does — the two run as independent parallel jobs:

```bash
cd backend  && npm ci && npm run typecheck && npm test && npm run build
cd frontend && npm ci && npm run typecheck && npm run lint && npm run build
```

See [SECURITY.md](SECURITY.md) for controls and the production checklist. See [infrastructure/README.md](infrastructure/README.md) for Railway and AWS guidance.

> This project is a technical foundation, not a certified core-banking system. Real-money deployment requires regulatory review, threat modeling, penetration testing, operational controls, and jurisdiction-specific compliance.
