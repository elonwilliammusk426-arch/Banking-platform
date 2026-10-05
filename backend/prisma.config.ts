import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Service-local .env first, then the repo-root .env as a convenience for local
// monorepo development. On Railway only real environment variables are present,
// and both calls simply no-op.
config();
config({ path: '../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://haven:haven_dev_password@localhost:5432/haven?schema=public',
  },
});
