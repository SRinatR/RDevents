import type { SupportThread, SupportMessage, SupportAttachment, User } from '@prisma/client';

export type UserSummary = Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
export type AdminSummary = Pick<User, 'id' | 'name' | 'email'>;

export type SupportMessageWithAttachments = SupportMessage & {
  sender: UserSummary;
  attachments: SupportAttachment[];
};

export type SupportThreadSummary = SupportThread & {
  user: UserSummary;
  assignedAdmin: AdminSummary | null;
  _count: { messages: number };
  lastMessage: Pick<SupportMessage, 'body' | 'createdAt' | 'senderType'> | null;
};

export type SupportThreadDetail = SupportThread & {
  user: UserSummary;
  assignedAdmin: AdminSummary | null;
  messages: SupportMessageWithAttachments[];
};
