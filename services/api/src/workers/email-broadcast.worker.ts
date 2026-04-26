import { logger } from '../common/logger.js';
import { emailBroadcastWorkerTick } from '../modules/admin-email/admin-email.service.js';

let running = false;

export async function runEmailBroadcastWorkerTick() {
  if (running) return;
  running = true;
  try {
    await emailBroadcastWorkerTick();
  } catch (error) {
    logger.error('Email broadcast worker tick failed', error, {
      module: 'email-broadcast-worker',
      action: 'worker_tick_failed',
    });
  } finally {
    running = false;
  }
}

export function startEmailBroadcastWorkerLoop() {
  const delayMs = Math.max(250, Number(process.env['EMAIL_BROADCAST_BATCH_DELAY_MS'] ?? 1000) || 1000);
  void runEmailBroadcastWorkerTick();
  const timer = setInterval(() => {
    void runEmailBroadcastWorkerTick();
  }, delayMs);
  return () => clearInterval(timer);
}
