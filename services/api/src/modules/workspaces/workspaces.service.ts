import type { OrganizerMemberRole, OrganizerMemberStatus, OrganizerWorkspaceKind, OrganizerWorkspaceStatus, User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { writeAuditLog, type AuditLogInput } from '../access-control/access-control.audit.js';
import { canManageWorkspace, canManagePlatform } from '../access-control/access-control.service.js';

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  description?: string | null;
  kind: OrganizerWorkspaceKind;
  parentId?: string | null;
  sortOrder?: number;
  audit?: Omit<AuditLogInput, 'action' | 'workspaceId' | 'afterJson'>;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
  description?: string | null;
  kind?: OrganizerWorkspaceKind;
  status?: OrganizerWorkspaceStatus;
  parentId?: string | null;
  sortOrder?: number;
  audit?: Omit<AuditLogInput, 'action' | 'workspaceId' | 'beforeJson' | 'afterJson'>;
}

async function getDescendantWorkspaceIds(rootIds: string[]) {
  const all = await prisma.organizerWorkspace.findMany({
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const workspace of all) {
    if (!workspace.parentId) continue;
    const children = childrenByParent.get(workspace.parentId) ?? [];
    children.push(workspace.id);
    childrenByParent.set(workspace.parentId, children);
  }

  const result = new Set(rootIds);
  const queue = [...rootIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (result.has(childId)) continue;
      result.add(childId);
      queue.push(childId);
    }
  }

  return [...result];
}

export async function getVisibleWorkspaceIds(user: User) {
  if (await canManagePlatform(user)) {
    const workspaces = await prisma.organizerWorkspace.findMany({ select: { id: true } });
    return workspaces.map(workspace => workspace.id);
  }

  const memberships = await prisma.organizerWorkspaceMember.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { workspaceId: true },
  });

  return getDescendantWorkspaceIds(memberships.map(membership => membership.workspaceId));
}

async function assertParentExists(parentId?: string | null) {
  if (!parentId) return;
  const parent = await prisma.organizerWorkspace.findUnique({
    where: { id: parentId },
    select: { id: true, status: true },
  });
  if (!parent || parent.status !== 'ACTIVE') throw new Error('PARENT_WORKSPACE_NOT_FOUND');
}

async function assertNoParentCycle(workspaceId: string, parentId?: string | null) {
  if (!parentId) return;
  if (workspaceId === parentId) throw new Error('WORKSPACE_PARENT_CYCLE');

  let currentParentId: string | null | undefined = parentId;
  const seen = new Set<string>();

  while (currentParentId) {
    if (seen.has(currentParentId)) throw new Error('WORKSPACE_PARENT_CYCLE');
    seen.add(currentParentId);
    if (currentParentId === workspaceId) throw new Error('WORKSPACE_PARENT_CYCLE');

    const parent = await prisma.organizerWorkspace.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    currentParentId = parent?.parentId;
  }
}

export async function listWorkspaces(actor: User) {
  const visibleIds = await getVisibleWorkspaceIds(actor);
  if (visibleIds.length === 0) return [];

  return prisma.organizerWorkspace.findMany({
    where: { id: { in: visibleIds } },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      _count: { select: { children: true, members: true, events: true, policies: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getWorkspace(actor: User, workspaceId: string) {
  if (!(await canManageWorkspace(actor, workspaceId, 'workspace.read'))) throw new Error('FORBIDDEN');

  const workspace = await prisma.organizerWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      children: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      _count: { select: { members: true, events: true, policies: true } },
    },
  });
  if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');
  return workspace;
}

export async function createWorkspace(actor: User, input: CreateWorkspaceInput) {
  if (await canManagePlatform(actor)) {
    // Platform-level admins may create any workspace.
  } else if (input.parentId && await canManageWorkspace(actor, input.parentId, 'workspace.children.create')) {
    // Workspace owners may create children under their own workspace.
  } else {
    throw new Error('FORBIDDEN');
  }

  await assertParentExists(input.parentId);

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.organizerWorkspace.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        kind: input.kind,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
        createdById: actor.id,
      },
    });

    await writeAuditLog(tx, {
      ...(input.audit ?? {}),
      actorUserId: input.audit?.actorUserId ?? actor.id,
      action: 'WORKSPACE_CREATED',
      workspaceId: workspace.id,
      afterJson: workspace as any,
    });

    return workspace;
  });
}

export async function updateWorkspace(actor: User, workspaceId: string, input: UpdateWorkspaceInput) {
  if (!(await canManageWorkspace(actor, workspaceId, 'workspace.update'))) throw new Error('FORBIDDEN');

  const existing = await prisma.organizerWorkspace.findUnique({ where: { id: workspaceId } });
  if (!existing) throw new Error('WORKSPACE_NOT_FOUND');

  if (input.parentId !== undefined && input.parentId !== existing.parentId) {
    await assertParentExists(input.parentId);
    await assertNoParentCycle(workspaceId, input.parentId);
    if (input.parentId && !(await canManageWorkspace(actor, input.parentId, 'workspace.children.create'))) {
      throw new Error('FORBIDDEN');
    }
  }

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.organizerWorkspace.update({
      where: { id: workspaceId },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        kind: input.kind,
        status: input.status,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
      },
    });

    await writeAuditLog(tx, {
      ...(input.audit ?? {}),
      actorUserId: input.audit?.actorUserId ?? actor.id,
      action: input.parentId !== undefined && input.parentId !== existing.parentId ? 'WORKSPACE_PARENT_CHANGED' : 'WORKSPACE_UPDATED',
      workspaceId,
      beforeJson: existing as any,
      afterJson: workspace as any,
    });

    return workspace;
  });
}

export async function archiveWorkspace(actor: User, workspaceId: string, force = false, audit?: Omit<AuditLogInput, 'action' | 'workspaceId'>) {
  if (!(await canManageWorkspace(actor, workspaceId, 'workspace.archive'))) throw new Error('FORBIDDEN');

  const existing = await prisma.organizerWorkspace.findUnique({ where: { id: workspaceId } });
  if (!existing) throw new Error('WORKSPACE_NOT_FOUND');

  const blockers = await prisma.$transaction(async (tx) => {
    const [activeChildren, activeEvents, activePolicies] = await Promise.all([
      tx.organizerWorkspace.count({ where: { parentId: workspaceId, status: 'ACTIVE' } }),
      tx.event.count({ where: { organizerWorkspaceId: workspaceId, status: { in: ['DRAFT', 'PUBLISHED'] } } }),
      tx.workspaceEventAccessPolicy.count({ where: { workspaceId, status: 'ACTIVE' } }),
    ]);
    return { activeChildren, activeEvents, activePolicies };
  });

  if (!force && (blockers.activeChildren > 0 || blockers.activeEvents > 0 || blockers.activePolicies > 0)) {
    const error = new Error('WORKSPACE_ARCHIVE_BLOCKED') as Error & { blockers?: typeof blockers };
    error.blockers = blockers;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.organizerWorkspace.update({
      where: { id: workspaceId },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });

    await writeAuditLog(tx, {
      ...(audit ?? {}),
      actorUserId: audit?.actorUserId ?? actor.id,
      action: 'WORKSPACE_ARCHIVED',
      workspaceId,
      beforeJson: existing as any,
      afterJson: workspace as any,
      meta: { force, blockers },
    });

    return workspace;
  });
}

export async function restoreWorkspace(actor: User, workspaceId: string, audit?: Omit<AuditLogInput, 'action' | 'workspaceId'>) {
  if (!(await canManageWorkspace(actor, workspaceId, 'workspace.restore'))) throw new Error('FORBIDDEN');

  const existing = await prisma.organizerWorkspace.findUnique({ where: { id: workspaceId } });
  if (!existing) throw new Error('WORKSPACE_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const workspace = await tx.organizerWorkspace.update({
      where: { id: workspaceId },
      data: { status: 'ACTIVE', archivedAt: null },
    });

    await writeAuditLog(tx, {
      ...(audit ?? {}),
      actorUserId: audit?.actorUserId ?? actor.id,
      action: 'WORKSPACE_RESTORED',
      workspaceId,
      beforeJson: existing as any,
      afterJson: workspace as any,
    });

    return workspace;
  });
}

export async function listWorkspaceMembers(actor: User, workspaceId: string) {
  if (!(await canManageWorkspace(actor, workspaceId, 'workspace.members.read'))) throw new Error('FORBIDDEN');

  return prisma.organizerWorkspaceMember.findMany({
    where: { workspaceId, status: { not: 'REMOVED' } },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function upsertWorkspaceMember(
  actor: User,
  workspaceId: string,
  input: { userId: string; role: OrganizerMemberRole; status: OrganizerMemberStatus },
  audit?: Omit<AuditLogInput, 'action' | 'workspaceId' | 'targetUserId' | 'afterJson'>,
) {
  if (!(await canManageWorkspace(actor, workspaceId, 'workspace.members.manage'))) throw new Error('FORBIDDEN');

  const targetUser = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!targetUser) throw new Error('USER_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const member = await tx.organizerWorkspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: input.userId } },
      create: {
        workspaceId,
        userId: input.userId,
        role: input.role,
        status: input.status,
        invitedByUserId: actor.id,
        invitedAt: new Date(),
        joinedAt: input.status === 'ACTIVE' ? new Date() : null,
      },
      update: {
        role: input.role,
        status: input.status,
        removedAt: input.status === 'REMOVED' ? new Date() : null,
        joinedAt: input.status === 'ACTIVE' ? new Date() : undefined,
      },
    });

    await writeAuditLog(tx, {
      ...(audit ?? {}),
      actorUserId: audit?.actorUserId ?? actor.id,
      action: 'WORKSPACE_MEMBER_ADDED',
      workspaceId,
      targetUserId: input.userId,
      afterJson: member as any,
    });

    return member;
  });
}

export async function updateWorkspaceMember(
  actor: User,
  workspaceId: string,
  memberId: string,
  input: { role?: OrganizerMemberRole; status?: OrganizerMemberStatus },
  audit?: Omit<AuditLogInput, 'action' | 'workspaceId' | 'targetUserId' | 'beforeJson' | 'afterJson'>,
) {
  if (!(await canManageWorkspace(actor, workspaceId, 'workspace.members.manage'))) throw new Error('FORBIDDEN');

  const existing = await prisma.organizerWorkspaceMember.findUnique({ where: { id: memberId } });
  if (!existing || existing.workspaceId !== workspaceId) throw new Error('MEMBER_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const member = await tx.organizerWorkspaceMember.update({
      where: { id: memberId },
      data: {
        role: input.role,
        status: input.status,
        removedAt: input.status === 'REMOVED' ? new Date() : undefined,
      },
    });

    await writeAuditLog(tx, {
      ...(audit ?? {}),
      actorUserId: audit?.actorUserId ?? actor.id,
      action: input.status === 'REMOVED' ? 'WORKSPACE_MEMBER_REMOVED' : 'WORKSPACE_MEMBER_UPDATED',
      workspaceId,
      targetUserId: existing.userId,
      beforeJson: existing as any,
      afterJson: member as any,
    });

    return member;
  });
}
