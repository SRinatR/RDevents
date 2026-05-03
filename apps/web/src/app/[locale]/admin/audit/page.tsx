'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { adminApi } from '@/lib/api';
import { EmptyState, FieldInput, FieldSelect, LoadingLines, Notice, PageHeader, Panel, StatusBadge, TableShell, ToolbarRow } from '@/components/ui/signal-primitives';

type AuditLogRow = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  status: string;
};

export default function AdminAuditPage() {
  const t = useTranslations();
  const { user, loading, isAdmin, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/${locale}`);
    }
  }, [user, loading, isAdmin, router, locale]);

  useEffect(() => {
    if (!user || !isPlatformAdmin) {
      setLoadingData(false);
      return;
    }

    let active = true;
    setLoadingData(true);
    setError('');

    adminApi.listAuditLogs({ limit: 100 })
      .then((response) => {
        if (!active) return;
        setLogs(response.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load audit log');
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [user, isPlatformAdmin]);

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

  const actionOptions = Array.from(new Set(logs.map((log) => log.action))).sort();
  const formatAction = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

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
            {actionOptions.map((action) => (
              <option key={action} value={action}>{formatAction(action)}</option>
            ))}
          </FieldSelect>
          
        </ToolbarRow>

        {error ? (
          <Notice tone="danger">{error}</Notice>
        ) : loadingData ? (
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
                    <td><StatusBadge tone="info">{formatAction(log.action)}</StatusBadge></td>
                    <td>{log.entity}</td>
                    <td className="signal-muted signal-overflow-ellipsis">{log.entityId}</td>
                    <td className="signal-muted">{new Date(log.timestamp).toLocaleString()}</td>
                    <td><StatusBadge tone="success">{log.status}</StatusBadge></td>
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
