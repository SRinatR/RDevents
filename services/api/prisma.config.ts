import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` doesn't require a live database connection, but Prisma config
    // is still loaded and can fail if DATABASE_URL is missing.
    // Fallback keeps `prisma generate` (and editor type generation) unblocked.
    url:
      process.env.DATABASE_URL
      || 'postgresql://event_platform_user:event_platform_password@localhost:5432/event_platform?schema=public',
  },
});
