// Resend webhooks are processed synchronously by the webhook route for P0.
// This module is kept as the extension point for moving webhook processing to an outbox worker.
export async function runEmailWebhookWorkerTick() {
  return { processed: 0 };
}
