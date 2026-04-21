'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supportApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import {
  EmptyState,
  LoadingLines,
  Notice,
  PageHeader,
  Panel,
  SectionHeader,
} from '@/components/ui/signal-primitives';
import { SupportThreadCard } from '@/components/support/SupportThreadCard';
import { NewThreadForm } from '@/components/support/NewThreadForm';
import type { SupportThread } from '@/components/support/support.types';

function SupportPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const searchParams = useSearchParams();

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  // Auto-open the new ticket form when ?new=1 is present
  const [showNewForm, setShowNewForm] = useState(searchParams.get('new') === '1');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!user) return;
    setThreadsLoading(true);
    setError('');
    supportApi
      .listThreads()
      .then((result) => setThreads((result.data as SupportThread[]) ?? []))
      .catch(() =>
        setError(locale === 'ru' ? 'Не удалось загрузить обращения.' : 'Failed to load tickets.'),
      )
      .finally(() => setThreadsLoading(false));
  }, [user, locale]);

  function handleCreated(thread: unknown) {
    setShowNewForm(false);
    const t = thread as { id: string };
    router.push(`/${locale}/cabinet/support/${t.id}`);
  }

  async function handleDeleteThread(thread: SupportThread) {
    const confirmed = window.confirm(
      locale === 'ru'
        ? 'Удалить это обращение и всю переписку? Действие нельзя отменить.'
        : 'Delete this ticket and all messages? This action cannot be undone.',
    );
    if (!confirmed) return;

    setDeletingThreadId(thread.id);
    setError('');
    setSuccessMessage('');
    try {
      await supportApi.deleteThread(thread.id);
      setThreads((prev) => prev.filter((item) => item.id !== thread.id));
      setSuccessMessage(locale === 'ru' ? 'Обращение удалено.' : 'Ticket deleted.');
    } catch {
      setError(
        locale === 'ru' ? 'Не удалось удалить обращение.' : 'Failed to delete ticket.',
      );
    } finally {
      setDeletingThreadId(null);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader
        title={locale === 'ru' ? 'Поддержка' : 'Support'}
        subtitle={
          locale === 'ru'
            ? 'Ваши обращения и переписка с командой поддержки'
            : 'Your tickets and correspondence with the support team'
        }
        actions={
          threads.length > 0 && !showNewForm ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewForm(true)}>
              {locale === 'ru' ? 'Новое обращение' : 'New ticket'}
            </button>
          ) : undefined
        }
      />

      {showNewForm && (
        <Panel variant="elevated" className="cabinet-workspace-panel" style={{ marginBottom: '16px' }}>
          <SectionHeader title={locale === 'ru' ? 'Новое обращение' : 'New ticket'} />
          <NewThreadForm locale={locale} onCreated={handleCreated} onCancel={() => setShowNewForm(false)} />
        </Panel>
      )}

      {(threadsLoading || !!error || threads.length > 0 || !showNewForm) && (
      <Panel variant="elevated" className="cabinet-workspace-panel">
        {successMessage ? <Notice tone="success">{successMessage}</Notice> : null}
        {threadsLoading ? (
          <LoadingLines rows={5} />
        ) : error ? (
          <Notice tone="danger">{error}</Notice>
        ) : threads.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Обращений пока нет' : 'No tickets yet'}
            description={
              locale === 'ru'
                ? 'Если у вас есть вопрос или проблема, создайте обращение — мы ответим.'
                : 'If you have a question or issue, create a ticket and we will respond.'
            }
            actions={
              <button className="btn btn-primary btn-sm" onClick={() => setShowNewForm(true)}>
                {locale === 'ru' ? 'Создать обращение' : 'Create ticket'}
              </button>
            }
          />
        ) : (
          <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
            {threads.map((thread) => (
              <SupportThreadCard
                key={thread.id}
                thread={thread}
                locale={locale}
                deleting={deletingThreadId === thread.id}
                onDelete={(item) => void handleDeleteThread(item)}
              />
            ))}
          </div>
        )}
      </Panel>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense>
      <SupportPageInner />
    </Suspense>
  );
}
