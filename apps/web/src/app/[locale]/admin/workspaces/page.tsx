'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, PageHeader, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

export default function WorkspacesPage() {
  const locale = useRouteLocale();
  const isRu = locale === 'ru';
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.listWorkspaces()
      .then((result) => setWorkspaces(result.workspaces ?? []))
      .catch((err) => setError(err?.message || (isRu ? 'Не удалось загрузить отделы.' : 'Failed to load workspaces.')))
      .finally(() => setLoading(false));
  }, [isRu]);

  return (
    <div className="admin-page">
      <PageHeader
        title={isRu ? 'Отделы' : 'Workspaces'}
        subtitle={isRu ? 'Структура организации, сотрудники и политики доступа.' : 'Organization structure, staff and access policies.'}
        actions={<Link href={`/${locale}/admin/workspaces/new`} className="btn btn-primary">{isRu ? 'Создать отдел' : 'New workspace'}</Link>}
      />

      {loading ? <LoadingLines rows={6} /> : null}
      {error ? <EmptyState title={error} description={isRu ? 'Проверьте права доступа.' : 'Check access rights.'} /> : null}
      {!loading && !error && workspaces.length === 0 ? (
        <EmptyState title={isRu ? 'Отделов пока нет' : 'No workspaces yet'} description={isRu ? 'Создайте корневую организацию или отдел.' : 'Create a root organization or department.'} />
      ) : null}

      {workspaces.length > 0 ? (
        <Panel>
          <TableShell>
            <table>
              <thead>
                <tr>
                  <th>{isRu ? 'Название' : 'Name'}</th>
                  <th>{isRu ? 'Тип' : 'Kind'}</th>
                  <th>{isRu ? 'Статус' : 'Status'}</th>
                  <th>{isRu ? 'Состав' : 'Counts'}</th>
                  <th>{isRu ? 'Действия' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => (
                  <tr key={workspace.id}>
                    <td>
                      <Link href={`/${locale}/admin/workspaces/${workspace.id}`} className="admin-table-title-link">{workspace.name}</Link>
                      <div className="text-muted">{workspace.slug}</div>
                    </td>
                    <td>{workspace.kind}</td>
                    <td><StatusBadge tone={workspace.status === 'ACTIVE' ? 'success' : 'warning'}>{workspace.status}</StatusBadge></td>
                    <td>{workspace._count?.members ?? 0} / {workspace._count?.events ?? 0}</td>
                    <td>
                      <div className="admin-table-actions">
                        <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/members`}>{isRu ? 'Сотрудники' : 'Staff'}</Link>
                        <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/access`}>{isRu ? 'Доступ' : 'Access'}</Link>
                        <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/map`}>{isRu ? 'Карта' : 'Map'}</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </Panel>
      ) : null}
    </div>
  );
}
