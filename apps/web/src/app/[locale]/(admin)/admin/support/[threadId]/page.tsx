'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminSupportApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { LoadingLines, Notice, Panel } from '@/components/ui/signal-primitives';
import { SupportStatusBadge } from '@/components/support/SupportStatusBadge';
import { SupportMessageBubble } from '@/components/support/SupportMessageBubble';
import { AdminSupportMetaPanel } from '@/components/admin/support/AdminSupportMetaPanel';
import { AdminSupportComposer } from '@/components/admin/support/AdminSupportComposer';
import type { SupportMessage } from '@/components/support/support.types';

const POLL_INTERVAL_MS = 8000;

export default function AdminSupportThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = use(params);
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [thread, setThread] = useState<any | null>(null);
  const [threadLoading, setThreadLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) router.push(`/${locale}`);
  }, [user, loading, isPlatformAdmin, router, locale]);

  const fetchThread = useCallback(
    async (silent = false) => {
      if (!silent) setThreadLoading(true);
      try {
        const result = await adminSupportApi.getThread(threadId);
        setThread(result.thread);
        adminSupportApi.markRead(threadId).catch(() => {});
      } catch {
        if (!silent) {
          setError(localeRef.current === 'ru' ? 'Не удалось загрузить обращение.' : 'Failed to load ticket.');
        }
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [threadId],
  );

  useEffect(() => {
    if (!user || !isPlatformAdmin) return;
    fetchThread(false);
    const timer = setInterval(() => fetchThread(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, isPlatformAdmin, fetchThread]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages?.length]);

  function handleMessageSent(newMessage: unknown) {
    const msg = newMessage as SupportMessage;
    setThread((prev: any) =>
      prev
        ? {
            ...prev,
            messages: [...(prev.messages ?? []), msg],
            // Admin reply always sets thread to WAITING_USER on the backend
            status: prev.status !== 'CLOSED' ? 'WAITING_USER' : prev.status,
          }
        : prev,
    );
  }

  function handleThreadUpdate(updated: any) {
    setThread((prev: any) => (prev ? { ...prev, ...updated } : prev));
  }

  if (loading || !user) return null;

  const isClosed = thread?.status === 'CLOSED';

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={thread?.subject ?? (locale === 'ru' ? 'Обращение' : 'Ticket')}
        subtitle={
          thread?.user
            ? `${thread.user.name || thread.user.email}`
            : (locale === 'ru' ? 'Загрузка…' : 'Loading…')
        }
        actions={
          <div className="admin-support-header-actions">
            {thread && <SupportStatusBadge status={thread.status} locale={locale} />}
            <Link href={`/${locale}/admin/support`} className="btn btn-secondary btn-sm">
              {locale === 'ru' ? 'Назад' : 'Back'}
            </Link>
          </div>
        }
      />

      {threadLoading ? (
        <Panel variant="elevated" className="admin-command-panel">
          <LoadingLines rows={6} />
        </Panel>
      ) : error ? (
        <Panel variant="elevated" className="admin-command-panel">
          <Notice tone="danger">{error}</Notice>
        </Panel>
      ) : !thread ? null : (
        <div className="admin-support-thread-grid">
          {/* Main conversation panel */}
          <Panel variant="elevated" className="admin-command-panel">
            {/* Message history */}
            <div ref={messagesContainerRef} className="admin-support-messages">
              {(thread.messages ?? []).length === 0 ? (
                <div className="admin-support-empty">
                  {locale === 'ru' ? 'Сообщений пока нет.' : 'No messages yet.'}
                </div>
              ) : (
                (thread.messages as SupportMessage[]).map((msg) => (
                  <SupportMessageBubble
                    key={msg.id}
                    message={msg}
                    currentUserId={user.id}
                    locale={locale}
                  />
                ))
              )}
            </div>

            <div className="admin-support-divider" />

            {isClosed ? (
              <Notice tone="info">
                {locale === 'ru' ? 'Обращение закрыто.' : 'This ticket is closed.'}
              </Notice>
            ) : (
              <AdminSupportComposer
                threadId={thread.id}
                locale={locale}
                onSent={handleMessageSent}
              />
            )}
          </Panel>

          {/* Meta panel */}
          <AdminSupportMetaPanel
            thread={thread}
            currentUserId={user.id}
            locale={locale}
            onThreadUpdate={handleThreadUpdate}
          />
        </div>
      )}
    </div>
  );
}
