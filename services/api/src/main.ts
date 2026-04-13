import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

async function main() {
  // Verify DB connection before starting
  await prisma.$connect();
  console.log('✓ Database connected');

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`✓ API running on http://localhost:${env.PORT}`);
    console.log(`  ENV: ${env.NODE_ENV}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
