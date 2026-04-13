import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { logger } from './common/logger.js';

async function main() {
  logger.info('Starting Event Platform API', {
    action: 'startup',
    meta: {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      nodeVersion: process.version,
    },
  });

  logger.info('Environment loaded', {
    action: 'env_loaded',
    meta: {
      corsOrigin: env.CORS_ORIGIN,
      databaseUrl: env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'), // Mask password
    },
  });

  // Verify DB connection before starting
  try {
    await prisma.$connect();
    logger.info('Database connected successfully', { action: 'database_connected' });
  } catch (error) {
    logger.error('Database connection failed', error, { action: 'database_failed' });
    throw error;
  }

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info(`API server ready`, {
      action: 'server_ready',
      meta: {
        port: env.PORT,
        url: `http://localhost:${env.PORT}`,
      },
    });
    console.log(`✓ API running on http://localhost:${env.PORT}`);
    console.log(`  ENV: ${env.NODE_ENV}`);
    console.log(`  Health: http://localhost:${env.PORT}/health`);
    console.log(`  Ready: http://localhost:${env.PORT}/ready`);
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', err, { action: 'startup_error' });
  console.error('Fatal startup error:', err);
  process.exit(1);
});
