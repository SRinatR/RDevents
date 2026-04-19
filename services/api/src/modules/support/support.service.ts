import { prisma } from '../../db/prisma.js';
import { saveUploadedFile } from '../../common/storage.js';
import type { SupportThreadStatus } from '@prisma/client';
import type { CreateThreadInput, AddMessageInput, ThreadQuery, AdminThreadQuery } from './support.schemas.js';

const USER_SELECT = { id: true, name: true, email: true, avatarUrl: true } as const;
const ADMIN_SELECT = { id: true, name: true, email: true } as const;

const THREAD_INCLUDE = {
  user: { select: USER_SELECT },
  assignedAdmin: { select: ADMIN_SELECT },
  _count: { select: { messages: true } },
} as const;

const MESSAGE_INCLUDE = {
  sender: { select: USER_SELECT },
  attachments: true,
} as const;

function lastMessageSubquery(threadId: string) {
  return prisma.supportMessage.findFirst({
    where: { threadId },
    orderBy: { createdAt: 'desc' },
    select: { body: true, createdAt: true, senderType: true },
  });
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export async function uploadSupportAttachments(
  uploaderId: string,
  threadId: string,
  files: Express.Multer.File[],
  role: 'USER' | 'ADMIN',
) {
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true, userId: true },
  });
  if (!thread) return null;
  if (role === 'USER' && thread.userId !== uploaderId) return null;

  const savedFiles = await Promise.all(
    files.map((file) =>
      saveUploadedFile({
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalFilename: file.originalname,
        folder: `support/${threadId}`,
      }),
    ),
  );

  const attachments = await prisma.$transaction(
    files.map((file, i) =>
      prisma.supportAttachment.create({
        data: {
          threadId,
          uploaderId,
          messageId: null,
          filename: file.originalname || 'upload',
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: savedFiles[i]!.storageKey,
          publicUrl: savedFiles[i]!.publicUrl,
        },
      }),
    ),
  );

  return { attachments };
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
    threads.map(async (t) => ({ ...t, lastMessage: await lastMessageSubquery(t.id) })),
  );

  const readStates = await prisma.supportThreadReadState.findMany({
    where: { userId, threadId: { in: threads.map((t) => t.id) } },
    select: { threadId: true, lastReadAt: true },
  });
  const readMap = new Map(readStates.map((rs) => [rs.threadId, rs.lastReadAt]));

  const data = threadsWithLastMessage.map((t) => {
    const lastReadAt = readMap.get(t.id) ?? null;
    const lm = t.lastMessage;
    const hasUnread =
      lm != null &&
      lm.senderType === 'ADMIN' &&
      (!lastReadAt || new Date(lm.createdAt) > lastReadAt);
    return { ...t, hasUnread };
  });

  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function createThread(userId: string, input: CreateThreadInput) {
  return prisma.$transaction(async (tx) => {
    const thread = await tx.supportThread.create({
      data: { userId, subject: input.subject, status: 'OPEN' },
      include: THREAD_INCLUDE,
    });

    await tx.supportMessage.create({
      data: { threadId: thread.id, senderId: userId, senderType: 'USER', body: input.body },
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
      messages: { include: MESSAGE_INCLUDE, orderBy: { createdAt: 'asc' } },
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

  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 0) {
    const valid = await prisma.supportAttachment.findMany({
      where: { id: { in: attachmentIds }, threadId, uploaderId: userId, messageId: null },
      select: { id: true },
    });
    if (valid.length !== attachmentIds.length) return { error: 'INVALID_ATTACHMENTS' as const };
  }

  const nextStatus: SupportThreadStatus =
    thread.status === 'WAITING_USER' || thread.status === 'OPEN' ? 'IN_PROGRESS' : thread.status;

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.supportMessage.create({
      data: { threadId, senderId: userId, senderType: 'USER', body: input.body },
    });

    if (attachmentIds.length > 0) {
      await tx.supportAttachment.updateMany({
        where: { id: { in: attachmentIds } },
        data: { messageId: msg.id },
      });
    }

    await tx.supportThread.update({
      where: { id: threadId },
      data: { status: nextStatus, updatedAt: new Date() },
    });

    return tx.supportMessage.findUnique({
      where: { id: msg.id },
      include: MESSAGE_INCLUDE,
    });
  });

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

export async function listAdminThreads(adminId: string, query: AdminThreadQuery) {
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
    threads.map(async (t) => ({ ...t, lastMessage: await lastMessageSubquery(t.id) })),
  );

  const readStates = await prisma.supportThreadReadState.findMany({
    where: { userId: adminId, threadId: { in: threads.map((t) => t.id) } },
    select: { threadId: true, lastReadAt: true },
  });
  const readMap = new Map(readStates.map((rs) => [rs.threadId, rs.lastReadAt]));

  const data = threadsWithLastMessage.map((t) => {
    const lastReadAt = readMap.get(t.id) ?? null;
    const lm = t.lastMessage;
    const hasUnread =
      lm != null &&
      lm.senderType === 'USER' &&
      (!lastReadAt || new Date(lm.createdAt) > lastReadAt);
    return { ...t, hasUnread };
  });

  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
}

export async function getAdminThread(threadId: string) {
  return prisma.supportThread.findUnique({
    where: { id: threadId },
    include: {
      user: { select: USER_SELECT },
      assignedAdmin: { select: ADMIN_SELECT },
      messages: { include: MESSAGE_INCLUDE, orderBy: { createdAt: 'asc' } },
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

  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length > 0) {
    const valid = await prisma.supportAttachment.findMany({
      where: { id: { in: attachmentIds }, threadId, uploaderId: adminId, messageId: null },
      select: { id: true },
    });
    if (valid.length !== attachmentIds.length) return { error: 'INVALID_ATTACHMENTS' as const };
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.supportMessage.create({
      data: { threadId, senderId: adminId, senderType: 'ADMIN', body: input.body },
    });

    if (attachmentIds.length > 0) {
      await tx.supportAttachment.updateMany({
        where: { id: { in: attachmentIds } },
        data: { messageId: msg.id },
      });
    }

    await tx.supportThread.update({
      where: { id: threadId },
      data: { status: 'WAITING_USER', updatedAt: new Date() },
    });

    return tx.supportMessage.findUnique({
      where: { id: msg.id },
      include: MESSAGE_INCLUDE,
    });
  });

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
    data: {
      assignedAdminId: adminId,
      // Promote OPEN → IN_PROGRESS when admin takes ownership
      ...(thread.status === 'OPEN' ? { status: 'IN_PROGRESS' as const } : {}),
    },
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
    data: { status, closedAt: status === 'CLOSED' ? new Date() : null, updatedAt: new Date() },
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
