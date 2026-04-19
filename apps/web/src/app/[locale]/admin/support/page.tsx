'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminSupportApi } from '@/lib/api';
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

export default function AdminSupportInboxPage() {
  const { user, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [threads, setThreads] = useState<any[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && (!user || !isPlatformAdmin)) router.push(`/${locale}`);
  }, [user, loading, isPlatformAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isPlatformAdmin) return;
    setThreadsLoading(true);
    setError('');
    adminSupportApi
      .listThreads({ status: status || undefined, unassigned: unassigned || undefined, limit: 100 })
      .then((result) => setThreads(result.data ?? []))
      .catch(() =>
        setError(locale === 'ru' ? 'Не удалось загрузить обращения.' : 'Failed to load tickets.'),
      )
      .finally(() => setThreadsLoading(false));
  }, [user, isPlatformAdmin, status, unassigned, locale]);

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

  if (loading || !user) return null;

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={locale === 'ru' ? 'Поддержка' : 'Support inbox'}
        subtitle={
          locale === 'ru'
            ? 'Обращения пользователей'
            : 'User support tickets'
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
              <AdminSupportThreadCard key={thread.id} thread={thread} locale={locale} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
