'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminTableActions,
  AdminTableCellMain,
} from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { EmptyState, LoadingLines, Panel, StatusBadge } from '@/components/ui/signal-primitives';

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
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader
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
        <Panel className="admin-command-panel">
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={860}>
              <AdminDataTableHeader
                columns={[
                  { label: isRu ? 'Название' : 'Name', width: '28%' },
                  { label: isRu ? 'Тип' : 'Kind', width: '16%' },
                  { label: isRu ? 'Статус' : 'Status', width: '16%' },
                  { label: isRu ? 'Состав' : 'Counts', width: '16%' },
                  { label: isRu ? 'Действия' : 'Actions', align: 'right', width: '24%' },
                ]}
              />
              <AdminDataTableBody>
                {workspaces.map((workspace) => (
                  <AdminDataTableRow key={workspace.id}>
                    <AdminDataTableCell>
                      <AdminTableCellMain
                        title={<Link href={`/${locale}/admin/workspaces/${workspace.id}`} className="admin-table-title-link">{workspace.name}</Link>}
                        subtitle={workspace.slug}
                      />
                    </AdminDataTableCell>
                    <AdminDataTableCell>{workspace.kind}</AdminDataTableCell>
                    <AdminDataTableCell>
                      <StatusBadge tone={workspace.status === 'ACTIVE' ? 'success' : 'warning'}>{workspace.status}</StatusBadge>
                    </AdminDataTableCell>
                    <AdminDataTableCell>{workspace._count?.members ?? 0} / {workspace._count?.events ?? 0}</AdminDataTableCell>
                    <AdminDataTableCell align="right">
                      <AdminTableActions>
                        <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/members`}>{isRu ? 'Сотрудники' : 'Staff'}</Link>
                        <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/access`}>{isRu ? 'Доступ' : 'Access'}</Link>
                        <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/map`}>{isRu ? 'Карта' : 'Map'}</Link>
                      </AdminTableActions>
                    </AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {workspaces.map((workspace) => (
                <AdminMobileCard
                  key={workspace.id}
                  title={<Link href={`/${locale}/admin/workspaces/${workspace.id}`} className="admin-table-title-link">{workspace.name}</Link>}
                  subtitle={workspace.slug}
                  badge={<StatusBadge tone={workspace.status === 'ACTIVE' ? 'success' : 'warning'}>{workspace.status}</StatusBadge>}
                  meta={[
                    { label: isRu ? 'Тип' : 'Kind', value: workspace.kind },
                    { label: isRu ? 'Состав' : 'Counts', value: `${workspace._count?.members ?? 0} / ${workspace._count?.events ?? 0}` },
                  ]}
                  actions={
                    <>
                      <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/members`}>{isRu ? 'Сотрудники' : 'Staff'}</Link>
                      <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/access`}>{isRu ? 'Доступ' : 'Access'}</Link>
                      <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/workspaces/${workspace.id}/map`}>{isRu ? 'Карта' : 'Map'}</Link>
                    </>
                  }
                />
              ))}
            </AdminMobileList>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
