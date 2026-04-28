'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supportApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { LoadingLines, Notice, PageHeader, Panel } from '@/components/ui/signal-primitives';
import { SupportStatusBadge } from '@/components/support/SupportStatusBadge';
import { SupportMessageBubble } from '@/components/support/SupportMessageBubble';
import { SupportMessageComposer } from '@/components/support/SupportMessageComposer';
import type { SupportThreadDetail, SupportMessage } from '@/components/support/support.types';

const POLL_INTERVAL_MS = 8000;

export default function SupportThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [thread, setThread] = useState<SupportThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  const fetchThread = useCallback(
    async (silent = false) => {
      if (!silent) setThreadLoading(true);
      try {
        const result = await supportApi.getThread(threadId);
        setThread(result.thread as SupportThreadDetail);
        supportApi.markRead(threadId).catch(() => {});
      } catch {
        if (!silent) {
          setError(
            localeRef.current === 'ru'
              ? 'Не удалось загрузить обращение.'
              : 'Failed to load ticket.',
          );
        }
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [threadId],
  );

  // Initial load + polling
  useEffect(() => {
    if (!user) return;
    fetchThread(false);
    const timer = setInterval(() => fetchThread(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, fetchThread]);

  // Scroll to bottom when message list length changes
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length]);

  function handleMessageSent(newMessage: unknown) {
    const msg = newMessage as SupportMessage;
    setThread((prev) =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages, msg],
            // User reply transitions OPEN/WAITING_USER → IN_PROGRESS optimistically
            status:
              prev.status === 'OPEN' || prev.status === 'WAITING_USER'
                ? 'IN_PROGRESS'
                : prev.status,
          }
        : prev,
    );
  }

  if (loading || !user) return null;

  const isClosed = thread?.status === 'CLOSED';

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader
        title={thread?.subject ?? (locale === 'ru' ? 'Обращение' : 'Ticket')}
        subtitle={
          locale === 'ru'
            ? 'Переписка с командой поддержки'
            : 'Correspondence with the support team'
        }
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {thread && <SupportStatusBadge status={thread.status} locale={locale} />}
            <Link href={`/${locale}/cabinet/support`} className="btn btn-secondary btn-sm">
              {locale === 'ru' ? 'Назад' : 'Back'}
            </Link>
          </div>
        }
      />

      <Panel variant="elevated" className="cabinet-workspace-panel">
        {threadLoading ? (
          <LoadingLines rows={6} />
        ) : error ? (
          <Notice tone="danger">{error}</Notice>
        ) : !thread ? null : (
          <>
            {/* Message history */}
            <div
              ref={messagesContainerRef}
              style={{
                minHeight: '160px',
                maxHeight: '460px',
                overflowY: 'auto',
                padding: '4px 2px',
                marginBottom: '20px',
              }}
            >
              {thread.messages.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    color: 'var(--color-text-faint)',
                    fontSize: '0.9rem',
                  }}
                >
                  {locale === 'ru'
                    ? 'Сообщений пока нет. Мы ответим в ближайшее время.'
                    : 'No messages yet. We will respond shortly.'}
                </div>
              ) : (
                thread.messages.map((msg) => (
                  <SupportMessageBubble
                    key={msg.id}
                    message={msg}
                    currentUserId={user.id}
                    locale={locale}
                  />
                ))
              )}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--color-border-soft)', marginBottom: '16px' }} />

            {/* Composer */}
            <SupportMessageComposer
              threadId={thread.id}
              disabled={isClosed}
              locale={locale}
              onSent={handleMessageSent}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
