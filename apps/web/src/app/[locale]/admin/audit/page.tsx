'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, PageHeader, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

export default function AdminAuditPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [logs, setLogs] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    // Stub data for audit log
    setTimeout(() => {
      setLogs([
        { id: '1', actor: 'admin@example.com', action: 'USER_ROLE_CHANGE', entity: 'User', entityId: 'user-123', timestamp: new Date().toISOString(), status: 'success' },
        { id: '2', actor: 'admin@example.com', action: 'EVENT_CREATE', entity: 'Event', entityId: 'evt-456', timestamp: new Date(Date.now() - 3600000).toISOString(), status: 'success' },
        { id: '3', actor: 'admin@example.com', action: 'EVENT_PUBLISH', entity: 'Event', entityId: 'evt-456', timestamp: new Date(Date.now() - 1800000).toISOString(), status: 'success' },
      ]);
      setLoadingData(false);
    }, 500);
  }, [user, isAdmin]);

  if (loading || !user || !isAdmin) {
    return <div className="admin-loading-screen"><div className="spinner" /></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="signal-page-shell admin-control-page">
        <EmptyState
          title={locale === 'ru' ? 'Доступ запрещён' : 'Access denied'}
          description={locale === 'ru' ? 'Журнал аудита доступен только платформенным администраторам.' : 'Audit log is only available to platform administrators.'}
        />
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    const searchPass = !search || 
      log.actor?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity?.toLowerCase().includes(search.toLowerCase());
    const actionPass = actionFilter === 'ALL' || log.action === actionFilter;
    return searchPass && actionPass;
  });

  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
    success: 'success',
    failed: 'danger',
    pending: 'warning',
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <PageHeader
        title={t('admin.audit') ?? 'Audit Log'}
        subtitle={locale === 'ru' ? 'Журнал действий администраторов' : 'Administrator action log'}
      />

      <Panel variant="elevated" className="admin-command-panel">
        <ToolbarRow>
          <FieldInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по актору, действию...' : 'Search by actor, action...'}
            className="admin-filter-search"
          />
          <FieldSelect value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="admin-filter-select">
            <option value="ALL">{locale === 'ru' ? 'Все действия' : 'All actions'}</option>
            <option value="USER_ROLE_CHANGE">{locale === 'ru' ? 'Смена роли' : 'Role change'}</option>
            <option value="EVENT_CREATE">{locale === 'ru' ? 'Создание события' : 'Event create'}</option>
            <option value="EVENT_PUBLISH">{locale === 'ru' ? 'Публикация' : 'Publish'}</option>
            <option value="EVENT_DELETE">{locale === 'ru' ? 'Удаление' : 'Delete'}</option>
          </FieldSelect>
          <StatusBadge tone="info">{filteredLogs.length} {locale === 'ru' ? 'записей' : 'records'}</StatusBadge>
        </ToolbarRow>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет записей' : 'No records'}
            description={locale === 'ru' ? 'Журнал аудита будет заполняться по мере действий администраторов.' : 'Audit log will populate as administrators take actions.'}
          />
        ) : (
          <TableShell>
            <table className="signal-table">
              <thead>
                <tr>
                  <th>{locale === 'ru' ? 'Актор' : 'Actor'}</th>
                  <th>{locale === 'ru' ? 'Действие' : 'Action'}</th>
                  <th>{locale === 'ru' ? 'Сущность' : 'Entity'}</th>
                  <th>{locale === 'ru' ? 'ID сущности' : 'Entity ID'}</th>
                  <th>{locale === 'ru' ? 'Время' : 'Time'}</th>
                  <th>{locale === 'ru' ? 'Статус' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="signal-overflow-ellipsis">{log.actor}</td>
                    <td><StatusBadge tone="neutral">{log.action}</StatusBadge></td>
                    <td>{log.entity}</td>
                    <td className="signal-muted signal-overflow-ellipsis">{log.entityId}</td>
                    <td className="signal-muted">{new Date(log.timestamp).toLocaleString()}</td>
                    <td><StatusBadge tone={toneByStatus[log.status] ?? 'neutral'}>{log.status}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Panel>
    </div>
  );
}