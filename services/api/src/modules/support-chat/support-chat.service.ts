import { prisma } from '../../db/prisma.js';
import type { AdminSupportChatListQuery, SendSupportChatMessageInput } from './support-chat.schemas.js';

const SUPPORT_CHAT_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  messages: {
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export async function getOrCreateUserSupportChatThread(userId: string) {
  const existing = await prisma.supportChatThread.findUnique({ where: { userId }, include: SUPPORT_CHAT_INCLUDE });
  if (existing) return existing;
  return prisma.supportChatThread.create({ data: { userId }, include: SUPPORT_CHAT_INCLUDE });
}

export async function sendUserSupportChatMessage(userId: string, input: SendSupportChatMessageInput) {
  const thread = await getOrCreateUserSupportChatThread(userId);
  const message = await prisma.supportChatMessage.create({
    data: { threadId: thread.id, senderId: userId, senderType: 'USER', body: input.body },
    include: { sender: { select: { id: true, name: true, email: true } } },
  });
  await prisma.supportChatThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
  return { message };
}

export async function listAdminSupportChats(query: AdminSupportChatListQuery) {
  const skip = (query.page - 1) * query.limit;
  const q = query.q?.trim();
  const where = q
    ? {
      OR: [
        { user: { email: { contains: q, mode: 'insensitive' as const } } },
        { user: { name: { contains: q, mode: 'insensitive' as const } } },
      ],
    }
    : undefined;

  const [total, rows] = await Promise.all([
    prisma.supportChatThread.count({ where }),
    prisma.supportChatThread.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true, createdAt: true, senderType: true },
        },
      },
    }),
  ]);

  return {
    data: rows.map((row) => {
      const { messages, ...rest } = row;
      return { ...rest, lastMessage: messages[0] ?? null };
    }),
    meta: { total, page: query.page, limit: query.limit, pageCount: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export async function getAdminSupportChatThread(threadId: string) {
  return prisma.supportChatThread.findUnique({ where: { id: threadId }, include: SUPPORT_CHAT_INCLUDE });
}

export async function sendAdminSupportChatMessage(adminId: string, threadId: string, input: SendSupportChatMessageInput) {
  const thread = await prisma.supportChatThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) return null;
  const message = await prisma.supportChatMessage.create({
    data: { threadId, senderId: adminId, senderType: 'ADMIN', body: input.body },
    include: { sender: { select: { id: true, name: true, email: true } } },
  });
  await prisma.supportChatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
  return { message };
}

export async function getOrCreateUserSupportChat(userId: string) {
  return getOrCreateUserSupportChatThread(userId);
}
