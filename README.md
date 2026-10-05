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

```text
apps/
  web/                    Next.js customer application
  api/                    NestJS API and domain modules
packages/
  database/               Prisma schema, migrations, generated client boundary
infrastructure/           Prometheus and deployment notes
docker-compose.yml        PostgreSQL, Redis, MinIO, API, and web
docker-compose.observability.yml
```

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
```

### 3. Install, migrate, and seed

```bash
npm install
npm run db:generate
npm run db:migrate
npm run seed -w @haven/database
```

Demo account after seeding: `alex@haven.demo` / `ChangeMe!123456`. Change or remove it outside local development.

### 4. Run the platform

```bash
npm run dev
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
- Customer profile, trusted-device/session visibility, notifications, and support chat streams

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

- `/api/v1/auth`, `/api/v1/verification`, `/api/v1/customer`, `/api/v1/kyc`
- `/api/v1/accounts`, `/api/v1/banking`, `/api/v1/payments`, `/api/v1/cards`
- `/api/v1/notifications`, `/api/v1/support`, `/api/v1/storage`
- `/api/v1/admin` (role protected)

Transfer, funding, and withdrawal requests require a unique `Idempotency-Key` header. High-value transfers require MFA and can be routed to operations review.

Browser requests use `credentials: include`. Mutations send the readable `csrf_token` cookie in the `X-CSRF-Token` header; access and refresh credentials remain `HttpOnly`.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

See [SECURITY.md](SECURITY.md) for controls and the production checklist. See [infrastructure/README.md](infrastructure/README.md) for Railway and AWS guidance.

> This project is a technical foundation, not a certified core-banking system. Real-money deployment requires regulatory review, threat modeling, penetration testing, operational controls, and jurisdiction-specific compliance.
