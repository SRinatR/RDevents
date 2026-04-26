import type { User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { writeAuditLog, type AuditLogInput } from '../access-control/access-control.audit.js';
import { canManagePlatform, canManageWorkspace } from '../access-control/access-control.service.js';

type OrganizationNodeType = 'workspace' | 'user' | 'event' | 'policy';
type OrganizationEdgeType = 'parent_child' | 'workspace_member' | 'workspace_event' | 'event_staff' | 'policy_grant';

interface OrganizationNode {
  id: string;
  type: OrganizationNodeType;
  label: string;
  kind?: string;
  status?: string;
  meta?: Record<string, unknown>;
}

interface OrganizationEdge {
  id: string;
  from: string;
  to: string;
  type: OrganizationEdgeType;
  label?: string;
  meta?: Record<string, unknown>;
}

export interface OrganizationMapResponse {
  nodes: OrganizationNode[];
  edges: OrganizationEdge[];
  summary: {
    workspaces: number;
    users: number;
    events: number;
    policies: number;
  };
}

async function getDescendantWorkspaceIds(rootId: string) {
  const workspaces = await prisma.organizerWorkspace.findMany({
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const workspace of workspaces) {
    if (!workspace.parentId) continue;
    const children = childrenByParent.get(workspace.parentId) ?? [];
    children.push(workspace.id);
    childrenByParent.set(workspace.parentId, children);
  }

  const ids = new Set([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const childId of childrenByParent.get(currentId) ?? []) {
      if (ids.has(childId)) continue;
      ids.add(childId);
      queue.push(childId);
    }
  }

  return [...ids];
}

function addNode(nodes: Map<string, OrganizationNode>, node: OrganizationNode) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function addEdge(edges: Map<string, OrganizationEdge>, edge: OrganizationEdge) {
  if (!edges.has(edge.id)) edges.set(edge.id, edge);
}

async function buildMapForWorkspaceIds(
  actor: User,
  workspaceIds: string[],
  audit: Omit<AuditLogInput, 'action'> | undefined,
): Promise<OrganizationMapResponse> {
  if (workspaceIds.length === 0) {
    return { nodes: [], edges: [], summary: { workspaces: 0, users: 0, events: 0, policies: 0 } };
  }

  const now = new Date();
  const [workspaces, members, events, policies, grants] = await Promise.all([
    prisma.organizerWorkspace.findMany({
      where: { id: { in: workspaceIds } },
      include: { _count: { select: { members: true, events: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.organizerWorkspaceMember.findMany({
      where: { workspaceId: { in: workspaceIds }, status: { not: 'REMOVED' } },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.event.findMany({
      where: { organizerWorkspaceId: { in: workspaceIds } },
      select: { id: true, title: true, status: true, startsAt: true, endsAt: true, organizerWorkspaceId: true },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.workspaceEventAccessPolicy.findMany({
      where: { workspaceId: { in: workspaceIds }, status: { not: 'REMOVED' } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.eventStaffGrant.findMany({
      where: {
        status: 'ACTIVE',
        event: { organizerWorkspaceId: { in: workspaceIds } },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        event: { select: { id: true, organizerWorkspaceId: true } },
        policy: { select: { id: true } },
      },
    }),
  ]);

  const nodes = new Map<string, OrganizationNode>();
  const edges = new Map<string, OrganizationEdge>();
  const userIdsByWorkspace = new Map<string, Set<string>>();

  for (const member of members) {
    const set = userIdsByWorkspace.get(member.workspaceId) ?? new Set<string>();
    set.add(member.userId);
    userIdsByWorkspace.set(member.workspaceId, set);
  }

  for (const workspace of workspaces) {
    const workspaceEvents = events.filter(event => event.organizerWorkspaceId === workspace.id);
    addNode(nodes, {
      id: workspace.id,
      type: 'workspace',
      label: workspace.name,
      kind: workspace.kind,
      status: workspace.status,
      meta: {
        membersCount: workspace._count.members,
        eventsCount: workspace._count.events,
        activeEventsCount: workspaceEvents.filter(event => ['DRAFT', 'PUBLISHED'].includes(event.status) && event.startsAt <= now && event.endsAt >= now).length,
        futureEventsCount: workspaceEvents.filter(event => ['DRAFT', 'PUBLISHED'].includes(event.status) && event.startsAt > now).length,
      },
    });

    if (workspace.parentId && workspaceIds.includes(workspace.parentId)) {
      addEdge(edges, {
        id: `edge_${workspace.parentId}_${workspace.id}`,
        from: workspace.parentId,
        to: workspace.id,
        type: 'parent_child',
      });
    }
  }

  for (const member of members) {
    addNode(nodes, {
      id: member.userId,
      type: 'user',
      label: member.user.name || member.user.email,
      meta: {
        externalCollaborator: false,
      },
    });
    addEdge(edges, {
      id: `edge_${member.userId}_${member.workspaceId}_member`,
      from: member.userId,
      to: member.workspaceId,
      type: 'workspace_member',
      label: member.role,
      meta: { status: member.status },
    });
  }

  for (const event of events) {
    addNode(nodes, {
      id: event.id,
      type: 'event',
      label: event.title,
      status: event.status,
      meta: {
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
      },
    });
    if (event.organizerWorkspaceId) {
      addEdge(edges, {
        id: `edge_${event.organizerWorkspaceId}_${event.id}_event`,
        from: event.organizerWorkspaceId,
        to: event.id,
        type: 'workspace_event',
      });
    }
  }

  for (const policy of policies) {
    addNode(nodes, {
      id: policy.id,
      type: 'policy',
      label: `${policy.role} policy`,
      status: policy.status,
      meta: {
        autoApplyToNewEvents: policy.autoApplyToNewEvents,
        fullWorkspaceAccess: policy.fullWorkspaceAccess,
      },
    });
    addNode(nodes, {
      id: policy.userId,
      type: 'user',
      label: policy.user.name || policy.user.email,
      meta: { externalCollaborator: false },
    });
    addEdge(edges, {
      id: `edge_${policy.workspaceId}_${policy.id}_policy`,
      from: policy.workspaceId,
      to: policy.id,
      type: 'policy_grant',
      label: policy.role,
    });
    addEdge(edges, {
      id: `edge_${policy.id}_${policy.userId}_policy_user`,
      from: policy.id,
      to: policy.userId,
      type: 'policy_grant',
      label: policy.role,
    });
  }

  for (const grant of grants) {
    const workspaceId = grant.event.organizerWorkspaceId;
    const isWorkspaceMember = workspaceId ? userIdsByWorkspace.get(workspaceId)?.has(grant.userId) === true : false;

    addNode(nodes, {
      id: grant.userId,
      type: 'user',
      label: grant.user.name || grant.user.email,
      meta: {
        externalCollaborator: !isWorkspaceMember,
      },
    });
    addEdge(edges, {
      id: `edge_${grant.userId}_${grant.eventId}_${grant.id}_staff`,
      from: grant.userId,
      to: grant.eventId,
      type: 'event_staff',
      label: grant.role,
      meta: {
        source: grant.source,
        policyId: grant.policyId,
        externalCollaborator: !isWorkspaceMember,
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      ...(audit ?? {}),
      actorUserId: audit?.actorUserId ?? actor.id,
      action: 'ORGANIZATION_MAP_VIEWED',
      workspaceId: workspaceIds.length === 1 ? workspaceIds[0] : null,
      meta: { workspaceIdsCount: workspaceIds.length },
    });
  });

  const users = new Set(
    [...nodes.values()]
      .filter(node => node.type === 'user')
      .map(node => node.id),
  );

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    summary: {
      workspaces: workspaces.length,
      users: users.size,
      events: events.length,
      policies: policies.length,
    },
  };
}

export async function getGlobalOrganizationMap(actor: User, audit?: Omit<AuditLogInput, 'action'>) {
  if (!(await canManagePlatform(actor))) throw new Error('FORBIDDEN');

  const workspaces = await prisma.organizerWorkspace.findMany({ select: { id: true } });
  return buildMapForWorkspaceIds(actor, workspaces.map(workspace => workspace.id), audit);
}

export async function getWorkspaceOrganizationMap(actor: User, workspaceId: string, audit?: Omit<AuditLogInput, 'action'>) {
  if (!(await canManageWorkspace(actor, workspaceId, 'workspace.organizationMap.read'))) {
    throw new Error('FORBIDDEN');
  }

  const workspace = await prisma.organizerWorkspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) throw new Error('WORKSPACE_NOT_FOUND');

  const workspaceIds = await getDescendantWorkspaceIds(workspaceId);
  return buildMapForWorkspaceIds(actor, workspaceIds, audit);
}
