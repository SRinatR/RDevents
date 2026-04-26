'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, PageHeader, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

export default function OrganizationMapPage() {
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const [map, setMap] = useState<any | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getOrganizationMap()
      .then(setMap)
      .catch((err) => setError(err?.message || (isRu ? 'Не удалось загрузить карту.' : 'Failed to load organization map.')));
  }, [isRu]);

  return (
    <div className="admin-page">
      <PageHeader
        title={isRu ? 'Карта организации' : 'Organization map'}
        subtitle={isRu ? 'Отделы, сотрудники, мероприятия и источники доступа без чувствительных данных.' : 'Workspaces, staff, events and access sources without sensitive data.'}
        actions={<Link href={`/${locale}/admin/workspaces`} className="btn btn-secondary">{isRu ? 'Отделы' : 'Workspaces'}</Link>}
      />

      {error ? <EmptyState title={error} description={isRu ? 'Проверьте права доступа или повторите попытку.' : 'Check access rights or try again.'} /> : null}
      {!map && !error ? <LoadingLines rows={6} /> : null}

      {map ? (
        <>
          <div className="signal-metrics-grid">
            <MetricCard label={isRu ? 'Отделы' : 'Workspaces'} value={map.summary?.workspaces ?? 0} />
            <MetricCard label={isRu ? 'Сотрудники' : 'Users'} value={map.summary?.users ?? 0} />
            <MetricCard label={isRu ? 'Мероприятия' : 'Events'} value={map.summary?.events ?? 0} />
            <MetricCard label={isRu ? 'Policies' : 'Policies'} value={map.summary?.policies ?? 0} />
          </div>

          <Panel>
            <TableShell>
              <table>
                <thead>
                  <tr>
                    <th>{isRu ? 'Тип' : 'Type'}</th>
                    <th>{isRu ? 'Название' : 'Label'}</th>
                    <th>{isRu ? 'Статус' : 'Status'}</th>
                    <th>{isRu ? 'Данные' : 'Meta'}</th>
                  </tr>
                </thead>
                <tbody>
                  {map.nodes?.slice(0, 200).map((node: any) => (
                    <tr key={node.id}>
                      <td><StatusBadge tone="info">{node.type}</StatusBadge></td>
                      <td>{node.label}</td>
                      <td>{node.status || node.kind || '-'}</td>
                      <td>{node.meta ? JSON.stringify(node.meta) : '-'}</td>
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
