import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // IMPORTANT: This fallback is only to keep local Prisma tooling/generate unblocked
    // when DATABASE_URL is temporarily missing. It must never be relied on for
    // production/runtime. In docker-compose production, DATABASE_URL must use host
    // `postgres`, not localhost/127.0.0.1. The API startup guard in src/config/env.ts
    // throws on startup if NODE_ENV=production and DATABASE_URL contains @127.0.0.1: or
    // @localhost:.
    url:
      process.env.DATABASE_URL
      || 'postgresql://event_platform_user:event_platform_password@localhost:5432/event_platform?schema=public',
  },
});
