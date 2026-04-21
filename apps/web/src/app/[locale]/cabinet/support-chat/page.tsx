'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supportChatApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { LoadingLines, Notice, PageHeader, Panel } from '@/components/ui/signal-primitives';
import type { SupportChatMessage, SupportChatThread } from '@/components/support-chat/support-chat.types';
import { SupportChatMessageBubble } from '@/components/support-chat/SupportChatMessageBubble';
import { SupportChatComposer } from '@/components/support-chat/SupportChatComposer';

export default function SupportChatPage() {
  const { user, loading } = useAuth();
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
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [loading, user, router, locale]);

  useEffect(() => {
    if (!user) return;
    setThreadLoading(true);
    supportChatApi.getThread()
      .then((result) => setThread(result.thread as SupportChatThread))
      .catch(() => setError(isRu ? 'Не удалось загрузить чат.' : 'Failed to load chat.'))
      .finally(() => setThreadLoading(false));
  }, [user, isRu]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const result = await supportChatApi.sendMessage({ body });
      const message = result.message as SupportChatMessage;
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, message] } : prev));
      setDraft('');
    } catch {
      setError(isRu ? 'Не удалось отправить сообщение.' : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader
        title={isRu ? 'Чат поддержки' : 'Support Chat'}
        subtitle={isRu ? 'Постоянный чат с командой поддержки' : 'Persistent conversation with support'}
      />
      <Panel variant="elevated" className="cabinet-workspace-panel support-chat-thread">
        {threadLoading ? <LoadingLines rows={5} /> : error ? <Notice tone="danger">{error}</Notice> : (
          <>
            <div ref={messagesRef} className="support-chat-thread__messages">
              {thread?.messages.map((m) => (
                <SupportChatMessageBubble
                  key={m.id}
                  message={m}
                  locale={locale}
                  isOwn={m.senderId === user.id}
                  ownLabel={isRu ? 'Вы' : 'You'}
                  otherLabel={isRu ? 'Поддержка' : 'Support'}
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
