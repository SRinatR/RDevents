'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminDataTable, AdminDataTableBody, AdminDataTableCell, AdminDataTableHeader, AdminDataTableRow, AdminTableCellMain } from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminToolbar } from '@/components/admin/AdminToolbar';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Panel, StatusBadge } from '@/components/ui/signal-primitives';

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

  const actionLabel = (action: string) => {
    const labelsRu: Record<string, string> = {
      USER_ROLE_CHANGE: 'Смена роли',
      EVENT_CREATE: 'Создание события',
      EVENT_PUBLISH: 'Публикация события',
      EVENT_DELETE: 'Удаление события',
    };
    const labelsEn: Record<string, string> = {
      USER_ROLE_CHANGE: 'Role change',
      EVENT_CREATE: 'Event create',
      EVENT_PUBLISH: 'Event publish',
      EVENT_DELETE: 'Event delete',
    };

    return (locale === 'ru' ? labelsRu : labelsEn)[action] ?? action;
  };

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
        title={t('admin.audit') ?? 'Audit Log'}
        subtitle={locale === 'ru' ? 'Журнал действий администраторов' : 'Administrator action log'}
      />

      <Panel variant="elevated" className="admin-command-panel">
        <AdminToolbar>
          <FieldInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ru' ? 'Поиск по актору, действию...' : 'Search by actor, action...'}
            className="admin-filter-search admin-toolbar-search"
          />
          <FieldSelect value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="admin-filter-select admin-toolbar-select">
            <option value="ALL">{locale === 'ru' ? 'Все действия' : 'All actions'}</option>
            <option value="USER_ROLE_CHANGE">{locale === 'ru' ? 'Смена роли' : 'Role change'}</option>
            <option value="EVENT_CREATE">{locale === 'ru' ? 'Создание события' : 'Event create'}</option>
            <option value="EVENT_PUBLISH">{locale === 'ru' ? 'Публикация' : 'Publish'}</option>
            <option value="EVENT_DELETE">{locale === 'ru' ? 'Удаление' : 'Delete'}</option>
          </FieldSelect>
        </AdminToolbar>

        {loadingData ? (
          <LoadingLines rows={8} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title={locale === 'ru' ? 'Нет записей' : 'No records'}
            description={locale === 'ru' ? 'Журнал аудита будет заполняться по мере действий администраторов.' : 'Audit log will populate as administrators take actions.'}
          />
        ) : (
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={980}>
              <AdminDataTableHeader
                columns={[
                  { label: locale === 'ru' ? 'Актор' : 'Actor', width: '22%' },
                  { label: locale === 'ru' ? 'Действие' : 'Action', width: '18%' },
                  { label: locale === 'ru' ? 'Сущность' : 'Entity', width: '16%' },
                  { label: locale === 'ru' ? 'ID сущности' : 'Entity ID', width: '16%' },
                  { label: locale === 'ru' ? 'Время' : 'Time', width: '18%' },
                  { label: locale === 'ru' ? 'Статус' : 'Status', width: '10%' },
                ]}
              />
              <AdminDataTableBody>
                {filteredLogs.map((log) => (
                  <AdminDataTableRow key={log.id}>
                    <AdminDataTableCell>
                      <AdminTableCellMain title={log.actor} subtitle={log.entity} />
                    </AdminDataTableCell>
                    <AdminDataTableCell>{actionLabel(log.action)}</AdminDataTableCell>
                    <AdminDataTableCell>{log.entity}</AdminDataTableCell>
                    <AdminDataTableCell truncate className="signal-muted">{log.entityId}</AdminDataTableCell>
                    <AdminDataTableCell className="signal-muted">{new Date(log.timestamp).toLocaleString()}</AdminDataTableCell>
                    <AdminDataTableCell>
                      <StatusBadge tone={toneByStatus[log.status] ?? 'neutral'}>{log.status}</StatusBadge>
                    </AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {filteredLogs.map((log) => (
                <AdminMobileCard
                  key={log.id}
                  title={log.actor}
                  subtitle={actionLabel(log.action)}
                  badge={<StatusBadge tone={toneByStatus[log.status] ?? 'neutral'}>{log.status}</StatusBadge>}
                  meta={[
                    { label: locale === 'ru' ? 'Сущность' : 'Entity', value: log.entity },
                    { label: locale === 'ru' ? 'ID сущности' : 'Entity ID', value: log.entityId },
                    { label: locale === 'ru' ? 'Время' : 'Time', value: new Date(log.timestamp).toLocaleString() },
                  ]}
                />
              ))}
            </AdminMobileList>
          </div>
        )}
      </Panel>
    </div>
  );
}
