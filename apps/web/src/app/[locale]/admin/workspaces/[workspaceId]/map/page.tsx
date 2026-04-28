'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, PageHeader, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

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
    <div className="admin-page">
      <PageHeader title={isRu ? 'Карта отдела' : 'Workspace map'} subtitle={workspaceId} />
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
          <Panel>
            <TableShell>
              <table>
                <thead><tr><th>{isRu ? 'Тип' : 'Type'}</th><th>{isRu ? 'Узел' : 'Node'}</th><th>{isRu ? 'Статус' : 'Status'}</th></tr></thead>
                <tbody>
                  {map.nodes?.map((node: any) => (
                    <tr key={node.id}>
                      <td><StatusBadge tone="info">{node.type}</StatusBadge></td>
                      <td>{node.label}</td>
                      <td>{node.status || node.kind || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
