/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const DEFAULT_SUPER_ADMIN_EMAIL = 'rinat200355@gmail.com';
const DEFAULT_MOCK_EVENT_SLUGS = ['dom-gde-zhivet-rossiya'];

const MOCK_USER_EMAILS = [
  'admin@example.com',
  'platform@example.com',
  'organizer@example.com',
  'manager@example.com',
  'user@example.com',
  'volunteer@example.com',
  'pending@example.com',
  'reserve@example.com',
  'rejected@example.com',
  'incomplete@example.com',
  'teamjoiner@example.com',
  'disabled@example.com',
  'social@example.com',
];

const MOCK_PROVIDER_ACCOUNT_IDS = [
  'google-demo-social',
  'yandex-demo-social',
  'telegram-demo-social',
];

function parseCsvEnv(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN_EMAIL).trim().toLowerCase();
const extraMockEventSlugs = parseCsvEnv('CLEANUP_MOCK_EVENT_SLUGS');
const includeDefaultMockEvents = process.env.CLEANUP_DEFAULT_MOCK_EVENTS !== 'false';
const mockEventSlugs = Array.from(new Set([
  ...(includeDefaultMockEvents ? DEFAULT_MOCK_EVENT_SLUGS : []),
  ...extraMockEventSlugs,
]));
const connectionString = process.env.DATABASE_URL?.replace('localhost', '127.0.0.1');
const isProduction = process.env.NODE_ENV === 'production';
const allowNonProductionCleanup = process.env.ALLOW_NON_PROD_MOCK_CLEANUP === 'true';

if (!connectionString) {
  throw new Error('DATABASE_URL is required to clean mock data.');
}

if (!isProduction && !allowNonProductionCleanup) {
  throw new Error('Mock cleanup is production-only. Set ALLOW_NON_PROD_MOCK_CLEANUP=true only if you intentionally want to clean a non-production database.');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    action: 'cleanup_mock_data',
    message,
    ...(meta ? { meta } : {}),
  }));
}

async function main() {
  log('started', { superAdminEmail, mockEventSlugs });

  const targetUser = await prisma.user.findUnique({
    where: { email: superAdminEmail },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!targetUser) {
    throw new Error(`User ${superAdminEmail} was not found. Create or register the account first, then rerun cleanup.`);
  }

  const mockUsers = await prisma.user.findMany({
    where: {
      email: {
        in: MOCK_USER_EMAILS.filter((email) => email !== superAdminEmail),
      },
    },
    select: { id: true, email: true },
  });

  const mockAccounts = await prisma.userAccount.findMany({
    where: { providerAccountId: { in: MOCK_PROVIDER_ACCOUNT_IDS } },
    select: { userId: true },
  });

  const mockUserIds = Array.from(new Set([
    ...mockUsers.map((user) => user.id),
    ...mockAccounts.map((account) => account.userId),
  ])).filter((userId) => userId !== targetUser.id);

  const mockEvents = mockEventSlugs.length
    ? await prisma.event.findMany({
        where: { slug: { in: mockEventSlugs } },
        select: { id: true, slug: true },
      })
    : [];

  const mockEventIds = mockEvents.map((event) => event.id);

  const result = await prisma.$transaction(async (tx) => {
    const analyticsConditions: any[] = [];

    if (mockUserIds.length > 0) {
      analyticsConditions.push({ userId: { in: mockUserIds } });
    }

    if (mockEventIds.length > 0) {
      analyticsConditions.push({ eventId: { in: mockEventIds } });
    }

    const analytics = analyticsConditions.length
      ? await tx.analyticsEvent.deleteMany({ where: { OR: analyticsConditions } })
      : { count: 0 };

    const events = mockEventIds.length
      ? await tx.event.deleteMany({ where: { id: { in: mockEventIds } } })
      : { count: 0 };

    const reassignedExportPresets = mockUserIds.length
      ? await tx.exportPreset.updateMany({
          where: { createdById: { in: mockUserIds } },
          data: { createdById: targetUser.id },
        })
      : { count: 0 };

    const reassignedReportTemplates = mockUserIds.length
      ? await tx.systemReportTemplate.updateMany({
          where: { createdById: { in: mockUserIds } },
          data: { createdById: targetUser.id },
        })
      : { count: 0 };

    const reassignedReportRuns = mockUserIds.length
      ? await tx.systemReportRun.updateMany({
          where: { requestedByUserId: { in: mockUserIds } },
          data: { requestedByUserId: targetUser.id, requestedByEmail: superAdminEmail },
        })
      : { count: 0 };

    const users = mockUserIds.length
      ? await tx.user.deleteMany({ where: { id: { in: mockUserIds } } })
      : { count: 0 };

    const superAdmin = await tx.user.update({
      where: { id: targetUser.id },
      data: { role: 'SUPER_ADMIN', isActive: true },
      select: { id: true, email: true, role: true, isActive: true },
    });

    return { analytics, events, reassignedExportPresets, reassignedReportTemplates, reassignedReportRuns, users, superAdmin };
  });

  log('finished', {
    deletedAnalyticsEvents: result.analytics.count,
    deletedEvents: result.events.count,
    reassignedExportPresets: result.reassignedExportPresets.count,
    reassignedReportTemplates: result.reassignedReportTemplates.count,
    reassignedReportRuns: result.reassignedReportRuns.count,
    deletedUsers: result.users.count,
    promotedUser: result.superAdmin,
    cleanupEventSlugs: mockEventSlugs,
  });
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
