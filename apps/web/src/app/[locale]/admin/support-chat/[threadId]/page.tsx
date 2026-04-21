'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminSupportChatApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { LoadingLines, Notice, PageHeader, Panel } from '@/components/ui/signal-primitives';
import type { SupportChatMessage, SupportChatThread } from '@/components/support-chat/support-chat.types';
import { SupportChatMessageBubble } from '@/components/support-chat/SupportChatMessageBubble';
import { SupportChatComposer } from '@/components/support-chat/SupportChatComposer';

export default function AdminSupportChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';

  const [thread, setThread] = useState<SupportChatThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) router.push(`/${locale}`);
  }, [loading, user, isPlatformAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isPlatformAdmin) return;
    adminSupportChatApi.getThread(threadId)
      .then((result) => setThread(result.thread as SupportChatThread))
      .catch(() => setError(isRu ? 'Не удалось загрузить чат.' : 'Failed to load chat.'))
      .finally(() => setThreadLoading(false));
  }, [threadId, user, isPlatformAdmin, isRu]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const result = await adminSupportChatApi.sendMessage(threadId, { body });
      const msg = result.message as SupportChatMessage;
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
      setDraft('');
    } catch {
      setError(isRu ? 'Не удалось отправить сообщение.' : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={isRu ? 'Чат с поддержкой' : 'Chat with Support'}
        subtitle={thread?.user?.email || thread?.user?.name || ''}
        actions={<Link href={`/${locale}/admin/support-chat`} className="btn btn-secondary btn-sm">{isRu ? 'Назад' : 'Back'}</Link>}
      />
      <Panel variant="elevated" className="admin-command-panel admin-data-panel support-chat-thread">
        {threadLoading ? <LoadingLines rows={5} /> : error ? <Notice tone="danger">{error}</Notice> : (
          <>
            <div ref={messagesRef} className="support-chat-thread__messages">
              {thread?.messages.map((m) => (
                <SupportChatMessageBubble
                  key={m.id}
                  message={m}
                  locale={locale}
                  isOwn={m.senderId === user.id}
                  ownLabel={isRu ? 'Поддержка' : 'Support'}
                  otherLabel={isRu ? 'Пользователь' : 'User'}
                />
              ))}
            </div>
            <SupportChatComposer
              value={draft}
              onChange={setDraft}
              onSend={() => void sendMessage()}
              sending={sending}
              placeholder={isRu ? 'Введите сообщение…' : 'Type a message…'}
              sendLabel={isRu ? 'Отправить' : 'Send'}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
