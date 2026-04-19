export type SupportAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  createdAt: string;
};

export type SupportMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderType: 'USER' | 'ADMIN';
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; email: string; avatarUrl: string | null };
  attachments: SupportAttachment[];
};

export type SupportThread = {
  id: string;
  userId: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'CLOSED';
  assignedAdminId: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  assignedAdmin: { id: string; name: string | null; email: string } | null;
  _count: { messages: number };
  lastMessage: { body: string; createdAt: string; senderType: string } | null;
};

export type SupportThreadDetail = {
  id: string;
  userId: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'CLOSED';
  assignedAdminId: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  assignedAdmin: { id: string; name: string | null; email: string } | null;
  messages: SupportMessage[];
};
