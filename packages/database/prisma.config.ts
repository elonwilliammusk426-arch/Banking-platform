import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../../.env' });
config();

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
