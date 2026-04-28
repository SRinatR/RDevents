'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { adminSupportApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  EmptyState,
  LoadingLines,
  Notice,
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
  const [error, setError] = useState('');

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
        const result = await adminSupportApi.listThreads({
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

  if (loading || !user) return null;

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={locale === 'ru' ? 'Поддержка' : 'Support inbox'}
        subtitle={
          locale === 'ru'
            ? `Обращения пользователей${threads.length ? ` · ${threads.length}` : ''}`
            : `User support tickets${threads.length ? ` · ${threads.length}` : ''}`
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
