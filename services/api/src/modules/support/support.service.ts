import { prisma } from '../../db/prisma.js';
import type { SupportThreadStatus } from '@prisma/client';
import type { CreateThreadInput, AddMessageInput, ThreadQuery, AdminThreadQuery } from './support.schemas.js';

const USER_SELECT = { id: true, name: true, email: true, avatarUrl: true } as const;
const ADMIN_SELECT = { id: true, name: true, email: true } as const;

const THREAD_INCLUDE = {
  user: { select: USER_SELECT },
  assignedAdmin: { select: ADMIN_SELECT },
  _count: { select: { messages: true } },
} as const;

function lastMessageSubquery(threadId: string) {
  return prisma.supportMessage.findFirst({
    where: { threadId },
    orderBy: { createdAt: 'desc' },
    select: { body: true, createdAt: true, senderType: true },
  });
}

// ─── User-facing service functions ───────────────────────────────────────────

export async function listUserThreads(userId: string, query: ThreadQuery) {
  const { page, limit, status } = query;
  const where = { userId, ...(status ? { status } : {}) };

  const [total, threads] = await Promise.all([
    prisma.supportThread.count({ where }),
    prisma.supportThread.findMany({
      where,
      include: THREAD_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const threadsWithLastMessage = await Promise.all(
    threads.map(async (t) => ({
      ...t,
      lastMessage: await lastMessageSubquery(t.id),
    })),
  );

  return { data: threadsWithLastMessage, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function createThread(userId: string, input: CreateThreadInput) {
  return prisma.$transaction(async (tx) => {
    const thread = await tx.supportThread.create({
      data: {
        userId,
        subject: input.subject,
        status: 'OPEN',
      },
      include: THREAD_INCLUDE,
    });

    await tx.supportMessage.create({
      data: {
        threadId: thread.id,
        senderId: userId,
        senderType: 'USER',
        body: input.body,
      },
    });

    return thread;
  });
}

export async function getUserThread(userId: string, threadId: string) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    include: {
      user: { select: USER_SELECT },
      assignedAdmin: { select: ADMIN_SELECT },
      messages: {
        include: {
          sender: { select: USER_SELECT },
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!thread || thread.userId !== userId) return null;
  return thread;
}

export async function addUserMessage(userId: string, threadId: string, input: AddMessageInput) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true, userId: true, status: true },
  });

  if (!thread || thread.userId !== userId) return null;
  if (thread.status === 'CLOSED') return { error: 'THREAD_CLOSED' as const };

  const nextStatus: SupportThreadStatus =
    thread.status === 'WAITING_USER' || thread.status === 'OPEN' ? 'IN_PROGRESS' : thread.status;

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        threadId,
        senderId: userId,
        senderType: 'USER',
        body: input.body,
      },
      include: {
        sender: { select: USER_SELECT },
        attachments: true,
      },
    }),
    prisma.supportThread.update({
      where: { id: threadId },
      data: { status: nextStatus, updatedAt: new Date() },
    }),
  ]);

  return { message };
}

export async function markUserThreadRead(userId: string, threadId: string) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true, userId: true },
  });
  if (!thread || thread.userId !== userId) return null;

  await prisma.supportThreadReadState.upsert({
    where: { threadId_userId: { threadId, userId } },
    create: { threadId, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  return { ok: true };
}

// ─── Admin service functions ──────────────────────────────────────────────────

export async function listAdminThreads(query: AdminThreadQuery) {
  const { page, limit, status, assignedAdminId, unassigned } = query;

  const where: Record<string, unknown> = {};
  if (status) where['status'] = status;
  if (unassigned === true) where['assignedAdminId'] = null;
  else if (assignedAdminId) where['assignedAdminId'] = assignedAdminId;

  const [total, threads] = await Promise.all([
    prisma.supportThread.count({ where: where as any }),
    prisma.supportThread.findMany({
      where: where as any,
      include: THREAD_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const threadsWithLastMessage = await Promise.all(
    threads.map(async (t) => ({
      ...t,
      lastMessage: await lastMessageSubquery(t.id),
    })),
  );

  return { data: threadsWithLastMessage, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function getAdminThread(threadId: string) {
  return prisma.supportThread.findUnique({
    where: { id: threadId },
    include: {
      user: { select: USER_SELECT },
      assignedAdmin: { select: ADMIN_SELECT },
      messages: {
        include: {
          sender: { select: USER_SELECT },
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function addAdminReply(adminId: string, threadId: string, input: AddMessageInput) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true, status: true },
  });

  if (!thread) return null;
  if (thread.status === 'CLOSED') return { error: 'THREAD_CLOSED' as const };

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: {
        threadId,
        senderId: adminId,
        senderType: 'ADMIN',
        body: input.body,
      },
      include: {
        sender: { select: USER_SELECT },
        attachments: true,
      },
    }),
    prisma.supportThread.update({
      where: { id: threadId },
      data: { status: 'WAITING_USER', updatedAt: new Date() },
    }),
  ]);

  return { message };
}

export async function takeThread(adminId: string, threadId: string) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true, assignedAdminId: true, status: true },
  });

  if (!thread) return null;
  if (thread.status === 'CLOSED') return { error: 'THREAD_CLOSED' as const };

  const updated = await prisma.supportThread.update({
    where: { id: threadId },
    data: { assignedAdminId: adminId },
    include: THREAD_INCLUDE,
  });

  return { thread: updated };
}

export async function assignThread(threadId: string, targetAdminId: string) {
  const [thread, targetAdmin] = await Promise.all([
    prisma.supportThread.findUnique({ where: { id: threadId }, select: { id: true, status: true } }),
    prisma.user.findUnique({ where: { id: targetAdminId }, select: { id: true, role: true } }),
  ]);

  if (!thread) return { error: 'THREAD_NOT_FOUND' as const };
  if (!targetAdmin) return { error: 'ADMIN_NOT_FOUND' as const };
  if (!['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(targetAdmin.role)) {
    return { error: 'TARGET_NOT_ADMIN' as const };
  }

  const updated = await prisma.supportThread.update({
    where: { id: threadId },
    data: { assignedAdminId: targetAdminId },
    include: THREAD_INCLUDE,
  });

  return { thread: updated };
}

export async function updateThreadStatus(threadId: string, status: SupportThreadStatus) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true },
  });
  if (!thread) return null;

  const updated = await prisma.supportThread.update({
    where: { id: threadId },
    data: {
      status,
      closedAt: status === 'CLOSED' ? new Date() : undefined,
      updatedAt: new Date(),
    },
    include: THREAD_INCLUDE,
  });

  return { thread: updated };
}

export async function markAdminThreadRead(adminId: string, threadId: string) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true },
  });
  if (!thread) return null;

  await prisma.supportThreadReadState.upsert({
    where: { threadId_userId: { threadId, userId: adminId } },
    create: { threadId, userId: adminId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });

  return { ok: true };
}
