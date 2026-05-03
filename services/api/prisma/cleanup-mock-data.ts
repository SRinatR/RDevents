/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const DEFAULT_SUPER_ADMIN_EMAIL = 'rinat200355@gmail.com';
const DEFAULT_MOCK_EVENT_SLUGS = ['dom-gde-zhivet-rossiya'];
const CLEANUP_REASON = 'cleanup-mock-data';

const MOCK_USER_EMAILS = [
  'admin@example.com','platform@example.com','organizer@example.com','manager@example.com','user@example.com','volunteer@example.com','pending@example.com','reserve@example.com','rejected@example.com','incomplete@example.com','teamjoiner@example.com','disabled@example.com','social@example.com',
];
const MOCK_PROVIDER_ACCOUNT_IDS = ['google-demo-social','yandex-demo-social','telegram-demo-social'];

function parseCsvEnv(name: string): string[] { return (process.env[name] ?? '').split(',').map((v) => v.trim()).filter(Boolean); }
function isDryRun(): boolean { return process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true'; }

const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN_EMAIL).trim().toLowerCase();
const includeDefaultMockEvents = process.env.CLEANUP_DEFAULT_MOCK_EVENTS !== 'false';
const mockEventSlugs = Array.from(new Set([...(includeDefaultMockEvents ? DEFAULT_MOCK_EVENT_SLUGS : []), ...parseCsvEnv('CLEANUP_MOCK_EVENT_SLUGS')]));
const connectionString = process.env.DATABASE_URL?.replace('localhost', '127.0.0.1');
const isProduction = process.env.NODE_ENV === 'production';
const allowNonProductionCleanup = process.env.ALLOW_NON_PROD_MOCK_CLEANUP === 'true';
const dryRun = isDryRun();

if (!connectionString) throw new Error('DATABASE_URL is required to clean mock data.');
if (!isProduction && !allowNonProductionCleanup) throw new Error('Mock cleanup is production-only. Set ALLOW_NON_PROD_MOCK_CLEANUP=true only if you intentionally want to clean a non-production database.');
if (isProduction && process.env.CONFIRM_PRODUCTION_CLEANUP !== 'true') throw new Error('Refusing to run cleanup in production without CONFIRM_PRODUCTION_CLEANUP=true');

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const targetUser = await prisma.user.findUnique({ where: { email: superAdminEmail }, select: { id: true, email: true } });
  if (!targetUser) throw new Error(`User ${superAdminEmail} was not found.`);

  const mockUsers = await prisma.user.findMany({ where: { email: { in: MOCK_USER_EMAILS.filter((e) => e !== superAdminEmail) } }, select: { id: true, email: true, protectedFromCleanup: true } });
  const mockAccounts = await prisma.userAccount.findMany({ where: { providerAccountId: { in: MOCK_PROVIDER_ACCOUNT_IDS } }, select: { userId: true } });
  const mockUserIds = Array.from(new Set([...mockUsers.map((u) => u.id), ...mockAccounts.map((a) => a.userId)])).filter((id) => id !== targetUser.id);

  const eventWhere = {
    isSeedData: true,
    protectedFromCleanup: false,
    deletedAt: null,
    ...(mockEventSlugs.length ? { slug: { in: mockEventSlugs } } : {}),
  } as const;
  const candidateEvents = await prisma.event.findMany({ where: eventWhere, select: { id: true, slug: true } });
  const candidateEventIds = candidateEvents.map((e) => e.id);

  const analyticsAffected = await prisma.analyticsEvent.count({ where: { OR: [{ userId: { in: mockUserIds } }, { eventId: { in: candidateEventIds } }] } });

  await prisma.maintenanceJobRun.create({
    data: {
      type: 'cleanup-mock-data', status: dryRun ? 'DRY_RUN' : 'STARTED', actorUserId: targetUser.id, actorEmail: superAdminEmail,
      environment: process.env.NODE_ENV, command: process.argv.join(' '), dryRun,
      metaJson: { candidateUsers: mockUsers.map((u) => u.email), candidateEvents: candidateEvents.map((e) => e.slug), analyticsAffected, cleanupEventSlugs: mockEventSlugs },
    },
  });

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, candidateUsers: mockUsers.map((u) => u.email), candidateEvents: candidateEvents.map((e) => e.slug), analyticsAffected, relatedTables: ['analytics_events','events','users','event_members','event_teams'] }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const events = await tx.event.updateMany({ where: eventWhere, data: { deletedAt: new Date(), deleteReason: CLEANUP_REASON } });
    const users = mockUserIds.length ? await tx.user.updateMany({ where: { id: { in: mockUserIds }, protectedFromCleanup: false }, data: { isActive: false, deletedAt: new Date(), deleteReason: CLEANUP_REASON } }) : { count: 0 };
    const superAdmin = await tx.user.update({ where: { id: targetUser.id }, data: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null, protectedFromCleanup: true } });
    return { events: events.count, users: users.count, superAdminId: superAdmin.id };
  });

  await prisma.maintenanceJobRun.create({ data: { type: 'cleanup-mock-data', status: 'SUCCESS', actorUserId: targetUser.id, actorEmail: superAdminEmail, environment: process.env.NODE_ENV, command: process.argv.join(' '), dryRun: false, metaJson: { softDeletedUsers: result.users, softDeletedEvents: result.events, cleanupEventSlugs: mockEventSlugs, superAdminEmail } } });
}

main().finally(async () => { await prisma.$disconnect(); await pool.end(); });
