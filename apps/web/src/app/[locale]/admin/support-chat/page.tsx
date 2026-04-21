'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminSupportChatApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel } from '@/components/ui/signal-primitives';

export default function AdminSupportChatPage() {
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';

  const [threads, setThreads] = useState<any[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) router.push(`/${locale}`);
  }, [loading, user, isPlatformAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isPlatformAdmin) return;
    adminSupportChatApi.listThreads({ limit: 100 })
      .then((result) => setThreads(result.data ?? []))
      .catch(() => setError(isRu ? 'Не удалось загрузить чаты.' : 'Failed to load chats.'))
      .finally(() => setLoadingThreads(false));
  }, [user, isPlatformAdmin, isRu]);

  if (loading || !user) return null;

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader title={isRu ? 'Чат с поддержкой' : 'Chat with Support'} subtitle={isRu ? 'Постоянные чаты пользователей' : 'Persistent user chats'} />
      <Panel variant="elevated" className="admin-command-panel admin-data-panel">
        {loadingThreads ? <LoadingLines rows={6} /> : error ? <Notice tone="danger">{error}</Notice> : threads.length === 0 ? (
          <EmptyState title={isRu ? 'Чатов пока нет' : 'No chats yet'} description={isRu ? 'Пока никто не написал в чат поддержки.' : 'No one has started a support chat yet.'} />
        ) : (
          <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
            {threads.map((thread) => (
              <Link key={thread.id} href={`/${locale}/admin/support-chat/${thread.id}`} className="admin-support-thread-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{thread.user?.name || thread.user?.email || thread.userId}</strong>
                  <span className="status-chip neutral">{new Date(thread.updatedAt).toLocaleString(locale)}</span>
                </div>
                <div style={{ color: 'var(--color-text-soft)' }}>{thread.lastMessage?.body || (isRu ? 'Нет сообщений' : 'No messages')}</div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
