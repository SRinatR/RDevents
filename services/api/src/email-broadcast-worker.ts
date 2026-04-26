import { prisma } from './db/prisma.js';
import { logger } from './common/logger.js';
import { startEmailBroadcastWorkerLoop } from './workers/email-broadcast.worker.js';

logger.info('Starting email broadcast worker', {
  module: 'email-broadcast-worker',
  action: 'startup',
});

const stop = startEmailBroadcastWorkerLoop();

async function shutdown(signal: string) {
  logger.info('Email broadcast worker shutting down', {
    module: 'email-broadcast-worker',
    action: 'shutdown',
    meta: { signal },
  });
  stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
