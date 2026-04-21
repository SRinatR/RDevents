export type SupportChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderType: 'USER' | 'ADMIN';
  body: string;
  createdAt: string;
  sender?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
};

export type SupportChatThread = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  messages: SupportChatMessage[];
};
