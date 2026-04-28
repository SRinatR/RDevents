'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, MetricCard, PageHeader, Panel, StatusBadge } from '@/components/ui/signal-primitives';

export default function WorkspaceDetailPage() {
  const locale = useRouteLocale();
  const workspaceId = useRouteParam('workspaceId');
  const isRu = locale === 'ru';
  const [workspace, setWorkspace] = useState<any | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!workspaceId) return;
    adminApi.getWorkspace(workspaceId)
      .then((result) => setWorkspace(result.workspace))
      .catch((err) => setError(err?.message || (isRu ? 'Отдел не найден.' : 'Workspace not found.')));
  }, [workspaceId, isRu]);

  return (
    <div className="admin-page">
      <PageHeader
        title={workspace?.name ?? (isRu ? 'Отдел' : 'Workspace')}
        subtitle={workspace?.description || workspace?.slug}
        actions={<Link href={`/${locale}/admin/workspaces`} className="btn btn-secondary">{isRu ? 'Все отделы' : 'All workspaces'}</Link>}
      />

      {error ? <EmptyState title={error} description={isRu ? 'Проверьте права доступа.' : 'Check access rights.'} /> : null}
      {!workspace && !error ? <LoadingLines rows={5} /> : null}

      {workspace ? (
        <>
          <div className="signal-metrics-grid">
            <MetricCard label={isRu ? 'Сотрудники' : 'Members'} value={workspace._count?.members ?? 0} />
            <MetricCard label={isRu ? 'Мероприятия' : 'Events'} value={workspace._count?.events ?? 0} />
            <MetricCard label="Policies" value={workspace._count?.policies ?? 0} />
          </div>

          <Panel>
            <div className="admin-detail-grid">
              <div><strong>{isRu ? 'Тип' : 'Kind'}</strong><p>{workspace.kind}</p></div>
              <div><strong>{isRu ? 'Статус' : 'Status'}</strong><p><StatusBadge tone={workspace.status === 'ACTIVE' ? 'success' : 'warning'}>{workspace.status}</StatusBadge></p></div>
              <div><strong>Parent</strong><p>{workspace.parent?.name ?? '-'}</p></div>
              <div><strong>ID</strong><p>{workspace.id}</p></div>
            </div>
            <div className="admin-table-actions" style={{ marginTop: 16 }}>
              <Link className="btn btn-primary" href={`/${locale}/admin/workspaces/${workspace.id}/members`}>{isRu ? 'Сотрудники' : 'Members'}</Link>
              <Link className="btn btn-secondary" href={`/${locale}/admin/workspaces/${workspace.id}/access`}>{isRu ? 'Политики доступа' : 'Access policies'}</Link>
              <Link className="btn btn-secondary" href={`/${locale}/admin/workspaces/${workspace.id}/events`}>{isRu ? 'Мероприятия' : 'Events'}</Link>
              <Link className="btn btn-secondary" href={`/${locale}/admin/workspaces/${workspace.id}/map`}>{isRu ? 'Карта' : 'Map'}</Link>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
