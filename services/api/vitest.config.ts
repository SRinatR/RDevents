import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@event-platform/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@event-platform/shared/': resolve(__dirname, '../../packages/shared/src/'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://event_platform_user:event_platform_password@localhost:5432/event_platform?schema=public',
      JWT_ACCESS_SECRET: 'test_access_secret_min_32_chars_value',
      JWT_REFRESH_SECRET: 'test_refresh_secret_min_32_chars_value',
      RESEND_WEBHOOK_SECRET: 'test_resend_webhook_secret',
    },
  },
});
