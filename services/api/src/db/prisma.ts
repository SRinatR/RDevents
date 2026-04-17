// Workaround for Prisma adapter type issues in TypeScript
// The PrismaPg adapter works correctly at runtime but TypeScript definitions have a mismatch
declare module '@prisma/client' {
  interface PrismaClientOptions {
    adapter?: unknown;
  }
}

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from '../config/env.js';

// Singleton prisma client — reuse across the process lifetime.
// In dev, avoid creating multiple clients due to hot reload.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  // @ts-expect-error - adapter type mismatch between @prisma/adapter-pg and @prisma/client
  return new PrismaClient({ adapter, log: env.isDev ? ['query', 'error', 'warn'] : ['error'] });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.isDev) {
  globalForPrisma.prisma = prisma;
}
