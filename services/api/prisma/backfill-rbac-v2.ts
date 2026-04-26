/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

import { unionPermissionsForRoles } from '../src/modules/access-control/access-control.permissions.js';

const BATCH_SIZE = Number(process.env.RBAC_V2_BACKFILL_BATCH_SIZE ?? 250);
const ROOT_WORKSPACE_SLUG = process.env.RBAC_V2_ROOT_WORKSPACE_SLUG ?? 'russian-house-root';
const DEFAULT_WORKSPACE_SLUG = process.env.RBAC_V2_DEFAULT_WORKSPACE_SLUG ?? 'default-events';

const connectionString = process.env.DATABASE_URL?.replace('localhost', '127.0.0.1');
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(message: string, meta?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      action: 'rbac_v2_backfill',
      message,
      ...(meta ? { meta } : {}),
    }),
  );
}

async function ensureDefaultWorkspaces() {
  const root = await prisma.organizerWorkspace.upsert({
    where: { slug: ROOT_WORKSPACE_SLUG },
    create: {
      name: process.env.RBAC_V2_ROOT_WORKSPACE_NAME ?? 'Russian House',
      slug: ROOT_WORKSPACE_SLUG,
      kind: 'ROOT_ORGANIZATION',
      status: 'ACTIVE',
    },
    update: {
      kind: 'ROOT_ORGANIZATION',
      status: 'ACTIVE',
    },
  });

  const defaultWorkspace = await prisma.organizerWorkspace.upsert({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    create: {
      name: process.env.RBAC_V2_DEFAULT_WORKSPACE_NAME ?? 'Default Events',
      slug: DEFAULT_WORKSPACE_SLUG,
      kind: 'DEPARTMENT',
      status: 'ACTIVE',
      parentId: root.id,
    },
    update: {
      kind: 'DEPARTMENT',
      status: 'ACTIVE',
      parentId: root.id,
    },
  });

  log('default_workspaces_ready', { rootId: root.id, defaultWorkspaceId: defaultWorkspace.id });
  return { root, defaultWorkspace };
}

async function backfillEventWorkspaces(defaultWorkspaceId: string) {
  let total = 0;

  while (true) {
    const events = await prisma.event.findMany({
      where: { organizerWorkspaceId: null },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    });

    if (events.length === 0) {
      break;
    }

    await prisma.event.updateMany({
      where: { id: { in: events.map((event) => event.id) } },
      data: { organizerWorkspaceId: defaultWorkspaceId },
    });

    total += events.length;
    log('event_workspace_batch_done', { batchSize: events.length, total });
  }

  log('event_workspace_backfill_done', { total });
}

async function upsertGrant(input: {
  eventId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN';
  source: 'SYSTEM' | 'LEGACY_EVENT_ADMIN_MIGRATION';
  reason: string;
}) {
  const existing = await prisma.eventStaffGrant.findFirst({
    where: {
      eventId: input.eventId,
      userId: input.userId,
      role: input.role,
      source: input.source,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.eventStaffGrant.update({
      where: { id: existing.id },
      data: {
        status: 'ACTIVE',
        disabledAt: null,
        removedAt: null,
        reason: input.reason,
      },
    });
    return { id: existing.id, created: false };
  }

  const created = await prisma.eventStaffGrant.create({
    data: {
      eventId: input.eventId,
      userId: input.userId,
      role: input.role,
      source: input.source,
      status: 'ACTIVE',
      reason: input.reason,
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

async function recalculateEventStaffAccess(eventId: string, userId: string) {
  const activeGrants = await prisma.eventStaffGrant.findMany({
    where: { eventId, userId, status: 'ACTIVE' },
    select: { role: true },
  });

  if (activeGrants.length === 0) {
    await prisma.eventStaffAccess.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: {
        eventId,
        userId,
        status: 'REMOVED',
        roles: [],
        permissions: [],
        isOwner: false,
        recalculatedAt: new Date(),
      },
      update: {
        status: 'REMOVED',
        roles: [],
        permissions: [],
        isOwner: false,
        recalculatedAt: new Date(),
      },
    });
    return;
  }

  const roles = [...new Set(activeGrants.map((grant) => grant.role))];
  const permissions = unionPermissionsForRoles(roles);

  await prisma.eventStaffAccess.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: {
      eventId,
      userId,
      status: 'ACTIVE',
      roles,
      permissions,
      isOwner: roles.includes('OWNER'),
      recalculatedAt: new Date(),
    },
    update: {
      status: 'ACTIVE',
      roles,
      permissions,
      isOwner: roles.includes('OWNER'),
      recalculatedAt: new Date(),
    },
  });
}

async function backfillOwnerGrants() {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const events = await prisma.event.findMany({
      where: { createdById: { not: null } },
      select: { id: true, createdById: true },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });

    if (events.length === 0) {
      break;
    }

    for (const event of events) {
      if (!event.createdById) {
        continue;
      }

      await upsertGrant({
        eventId: event.id,
        userId: event.createdById,
        role: 'OWNER',
        source: 'SYSTEM',
        reason: 'RBAC v2 owner backfill from Event.createdById',
      });
      await recalculateEventStaffAccess(event.id, event.createdById);
      total += 1;
    }

    cursor = events.at(-1)?.id;
    log('owner_grant_batch_done', { batchSize: events.length, total });
  }

  log('owner_grant_backfill_done', { total });
}

async function backfillLegacyEventAdmins() {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const memberships = await prisma.eventMember.findMany({
      where: {
        role: 'EVENT_ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true, eventId: true, userId: true },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });

    if (memberships.length === 0) {
      break;
    }

    for (const membership of memberships) {
      const grant = await upsertGrant({
        eventId: membership.eventId,
        userId: membership.userId,
        role: 'ADMIN',
        source: 'LEGACY_EVENT_ADMIN_MIGRATION',
        reason: `RBAC v2 backfill from legacy EventMember ${membership.id}`,
      });

      if (grant.created) {
        await prisma.auditLog.create({
          data: {
            action: 'LEGACY_EVENT_ADMIN_MIGRATED',
            eventId: membership.eventId,
            targetUserId: membership.userId,
            afterJson: {
              grantId: grant.id,
              legacyEventMemberId: membership.id,
            },
          },
        });
      }

      await recalculateEventStaffAccess(membership.eventId, membership.userId);
      total += 1;
    }

    cursor = memberships.at(-1)?.id;
    log('legacy_admin_batch_done', { batchSize: memberships.length, total });
  }

  log('legacy_admin_backfill_done', { total });
}

async function main() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  log('started', { batchSize: BATCH_SIZE });
  const { defaultWorkspace } = await ensureDefaultWorkspaces();
  await backfillEventWorkspaces(defaultWorkspace.id);
  await backfillOwnerGrants();
  await backfillLegacyEventAdmins();
  log('finished');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
