'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
} from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { EmptyState, LoadingLines, MetricCard, Panel, StatusBadge } from '@/components/ui/signal-primitives';

export default function WorkspaceMapPage() {
  const locale = useRouteLocale();
  const workspaceId = useRouteParam('workspaceId');
  const isRu = locale === 'ru';
  const [map, setMap] = useState<any | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!workspaceId) return;
    adminApi.getWorkspaceOrganizationMap(workspaceId)
      .then(setMap)
      .catch((err) => setError(err?.message || (isRu ? 'Не удалось загрузить карту отдела.' : 'Failed to load workspace map.')));
  }, [workspaceId, isRu]);

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader title={isRu ? 'Карта отдела' : 'Workspace map'} subtitle={workspaceId} />
      {error ? <EmptyState title={error} description={isRu ? 'Проверьте права доступа.' : 'Check access rights.'} /> : null}
      {!map && !error ? <LoadingLines rows={5} /> : null}
      {map ? (
        <>
          <div className="signal-metrics-grid">
            <MetricCard label={isRu ? 'Отделы' : 'Workspaces'} value={map.summary?.workspaces ?? 0} />
            <MetricCard label={isRu ? 'Люди' : 'People'} value={map.summary?.users ?? 0} />
            <MetricCard label={isRu ? 'Мероприятия' : 'Events'} value={map.summary?.events ?? 0} />
            <MetricCard label="Policies" value={map.summary?.policies ?? 0} />
          </div>
          <Panel className="admin-command-panel">
            <div className="admin-table-mobile-cards">
              <AdminDataTable minWidth={720}>
                <AdminDataTableHeader
                  columns={[
                    { label: isRu ? 'Тип' : 'Type', width: '20%' },
                    { label: isRu ? 'Узел' : 'Node', width: '52%' },
                    { label: isRu ? 'Статус' : 'Status', width: '28%' },
                  ]}
                />
                <AdminDataTableBody>
                  {map.nodes?.map((node: any) => (
                    <AdminDataTableRow key={node.id}>
                      <AdminDataTableCell><StatusBadge tone="info">{node.type}</StatusBadge></AdminDataTableCell>
                      <AdminDataTableCell>{node.label}</AdminDataTableCell>
                      <AdminDataTableCell>{node.status || node.kind || '-'}</AdminDataTableCell>
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>

              <AdminMobileList>
                {map.nodes?.map((node: any) => (
                  <AdminMobileCard
                    key={node.id}
                    title={node.label}
                    badge={<StatusBadge tone="info">{node.type}</StatusBadge>}
                    meta={[{ label: isRu ? 'Статус' : 'Status', value: node.status || node.kind || '-' }]}
                  />
                ))}
              </AdminMobileList>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
