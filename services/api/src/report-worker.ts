import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { logger } from './common/logger.js';
import { startWorker } from './modules/system-reports/report-processor.worker.js';

async function main() {
  logger.info('Starting Report Worker', {
    action: 'worker_startup',
    meta: {
      nodeEnv: env.NODE_ENV,
      nodeVersion: process.version,
    },
  });

  logger.info('Environment loaded', {
    action: 'env_loaded',
    meta: {
      databaseUrl: env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'),
    },
  });

  try {
    await prisma.$connect();
    logger.info('Database connected successfully', { action: 'database_connected' });
  } catch (error) {
    logger.error('Database connection failed', error, { action: 'database_failed' });
    throw error;
  }

  const stopWorker = await startWorker(5000);
  logger.info('Report worker started', { action: 'worker_started' });

  console.log('✓ Report Worker running');
  console.log(`  ENV: ${env.NODE_ENV}`);
  console.log(`  Polling interval: 5000ms`);

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...', { action: 'shutdown' });
    await stopWorker();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...', { action: 'shutdown' });
    await stopWorker();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Fatal worker startup error', err, { action: 'startup_error' });
  console.error('Fatal startup error:', err);
  process.exit(1);
});