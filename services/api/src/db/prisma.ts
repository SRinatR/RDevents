// Workaround for Prisma adapter type issues in TypeScript.
// The PrismaPg adapter works correctly at runtime, but TypeScript
// definitions may still complain about the adapter option.

declare module '@prisma/client' {
  interface PrismaClientOptions {
    adapter?: unknown;
  }
}

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../common/logger.js';

// Singleton prisma client — reuse across the process lifetime.
// In dev, avoid creating multiple clients due to hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function numberEnv(key: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[key] ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function createPrismaClient() {
  const connectionString = env.DATABASE_URL;
  const pool = new pg.Pool({
    connectionString,
    max: numberEnv('DATABASE_POOL_MAX', 10, 1, 50),
    idleTimeoutMillis: numberEnv('DATABASE_POOL_IDLE_TIMEOUT_MS', 30_000, 1_000, 300_000),
    connectionTimeoutMillis: numberEnv('DATABASE_POOL_CONNECTION_TIMEOUT_MS', 10_000, 1_000, 60_000),
  });

  // pg emits `error` for idle clients when the DB/network connection breaks.
  // Without this listener Node treats it as an unhandled EventEmitter error and
  // can terminate the API process after the server has been idle for a while.
  pool.on('error', (error) => {
    logger.error('PostgreSQL pool idle client error', error, {
      module: 'database',
      action: 'postgres_pool_idle_error',
    });
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: env.isDev ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.isDev) {
  globalForPrisma.prisma = prisma;
}
