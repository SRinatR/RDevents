'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminTechnicalSupportApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import {
  EmptyState,
  LoadingLines,
  Notice,
  PageHeader,
  Panel,
} from '@/components/ui/signal-primitives';
import { AdminSupportFilters } from '@/components/admin/support/AdminSupportFilters';
import { AdminSupportThreadCard } from '@/components/admin/support/AdminSupportThreadCard';

const POLL_INTERVAL_MS = 30000;

export default function AdminSupportInboxPage() {
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [threads, setThreads] = useState<any[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [status, setStatus] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [search, setSearch] = useState('');

  const statusRef = useRef(status);
  const unassignedRef = useRef(unassigned);
  statusRef.current = status;
  unassignedRef.current = unassigned;

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) router.push(`/${locale}`);
  }, [user, loading, isPlatformAdmin, router, locale]);

  const fetchThreads = useCallback(
    async (silent = false) => {
      if (!silent) setThreadsLoading(true);
      setError('');
      try {
        const result = await adminTechnicalSupportApi.listThreads({
          status: statusRef.current || undefined,
          unassigned: unassignedRef.current || undefined,
          limit: 100,
        });
        setThreads(result.data ?? []);
      } catch {
        if (!silent) setError(locale === 'ru' ? 'Не удалось загрузить обращения.' : 'Failed to load tickets.');
      } finally {
        if (!silent) setThreadsLoading(false);
      }
    },
    [locale],
  );

  // Re-fetch when filters change (full reload)
  useEffect(() => {
    if (!user || !isPlatformAdmin) return;
    fetchThreads(false);
  }, [user, isPlatformAdmin, status, unassigned, fetchThreads]);

  // Background polling
  useEffect(() => {
    if (!user || !isPlatformAdmin) return;
    const timer = setInterval(() => fetchThreads(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, isPlatformAdmin, fetchThreads]);

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.trim().toLowerCase();
    return threads.filter(
      (t) =>
        t.subject?.toLowerCase().includes(q) ||
        t.user?.name?.toLowerCase().includes(q) ||
        t.user?.email?.toLowerCase().includes(q),
    );
  }, [threads, search]);

  async function handleDeleteThread(thread: any) {
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
      await adminTechnicalSupportApi.deleteThread(thread.id);
      setThreads((prev) => prev.filter((item) => item.id !== thread.id));
      setSuccessMessage(locale === 'ru' ? 'Обращение удалено.' : 'Ticket deleted.');
    } catch {
      setError(locale === 'ru' ? 'Не удалось удалить обращение.' : 'Failed to delete ticket.');
    } finally {
      setDeletingThreadId(null);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={locale === 'ru' ? 'Техническая поддержка' : 'Technical Support'}
        subtitle={
          locale === 'ru'
            ? `Обращения пользователей${threads.length ? ` · ${threads.length}` : ''}`
            : `Technical support tickets${threads.length ? ` · ${threads.length}` : ''}`
        }
      />

      <Panel variant="elevated" className="admin-command-panel admin-data-panel">
        <AdminSupportFilters
          locale={locale}
          status={status}
          onStatusChange={setStatus}
          unassigned={unassigned}
          onUnassignedChange={setUnassigned}
          search={search}
          onSearchChange={setSearch}
        />
        {successMessage ? <Notice tone="success">{successMessage}</Notice> : null}

        {threadsLoading ? (
          <LoadingLines rows={6} />
        ) : error ? (
          <Notice tone="danger">{error}</Notice>
        ) : filteredThreads.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Обращений нет' : 'No tickets'}
            description={
              locale === 'ru'
                ? 'Нет обращений, соответствующих выбранным фильтрам.'
                : 'No tickets match the selected filters.'
            }
          />
        ) : (
            <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
              {filteredThreads.map((thread) => (
                <AdminSupportThreadCard
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
    </div>
  );
}
