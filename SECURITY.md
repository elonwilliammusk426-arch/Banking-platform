# Security policy

## Architecture controls

- Passwords use Argon2id with explicit memory and time costs.
- Access JWTs are short-lived and stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- Refresh tokens are opaque, hashed at rest, rotated on every use, and grouped into revocable families. Reuse revokes the family.
- State-changing cookie-authenticated requests require a double-submit CSRF token.
- MFA secrets are encrypted with AES-256-GCM. TOTP permits only one 30-second window on either side. Recovery codes are one-time and Argon2id-hashed.
- Login endpoints are rate limited and repeated failures temporarily lock the account. Login events compare device and network signals and flag suspicious changes.
- Customer, support, KYC, risk, operations, admin, and super-admin roles are enforced at the API guard layer.
- KYC payloads, bank identifiers, beneficiary details, and system configuration are encrypted with a separate AES-256-GCM data key.
- Transfer writes use serializable PostgreSQL transactions, optimistic account versions, idempotency keys, per-transaction/daily limits, MFA step-up, and high-value operations review.
- Ledger and audit rows are append-only at the database layer. Displayed ledger balances are calculated as credits minus debits, and available balances subtract active holds; mutable account projections are never returned as balances. Audit records form a SHA-256 hash chain.
- S3 objects remain private and uploads use five-minute presigned URLs with an allowlist of content types and sizes.
- Structured logs redact passwords, cookies, authorization headers, MFA codes, and challenge tokens.

## Production checklist

1. Replace every placeholder secret with at least 32 random bytes from a secrets manager.
2. Use TLS for PostgreSQL, Redis, S3, and all public traffic.
3. Put `/api/v1/metrics` on a private network or protect it at the gateway.
4. Restrict the CORS origin to the exact web origin.
5. Run migrations with a dedicated deployment identity; the runtime identity should not own the schema.
6. Configure Sentry data scrubbing and retention before enabling `SENTRY_DSN`.
7. Export audit records to write-once storage and alert on chain verification failures.
8. Run SAST, dependency auditing, container scanning, and secret scanning in CI.

## Reporting vulnerabilities

Do not open public issues containing vulnerability details. Contact the repository owner privately with reproduction steps and impact.
