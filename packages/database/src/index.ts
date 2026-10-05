export * from './generated/prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';

export function createPrismaAdapter(connectionString: string) {
  return new PrismaPg({ connectionString });
}
