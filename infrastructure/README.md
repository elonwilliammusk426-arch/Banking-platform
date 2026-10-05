# Deployment notes

## Railway

Create separate API and web services from the same repository and select the matching `railway.*.toml` configuration. Add managed PostgreSQL and Redis services, then configure the variables listed in `.env.example`. Use a private `API_INTERNAL_URL` from the web service to the API.

Run database migrations as a release command before the API receives traffic:

```bash
npm run db:migrate -w @haven/database -- --deploy
```

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
