'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHeader,
  AdminDataTableRow,
  AdminTableCellMain,
} from '@/components/admin/AdminDataTable';
import { AdminMobileCard, AdminMobileList } from '@/components/admin/AdminMobileCard';
import { EmptyState, LoadingLines, Panel, StatusBadge } from '@/components/ui/signal-primitives';

export default function WorkspaceEventsPage() {
  const locale = useRouteLocale();
  const workspaceId = useRouteParam('workspaceId');
  const isRu = locale === 'ru';
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    adminApi.listEvents({ organizerWorkspaceId: workspaceId, limit: 100 })
      .then((result) => setEvents(result.data ?? []))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  return (
    <div className="signal-page-shell admin-control-page">
      <AdminPageHeader title={isRu ? 'Мероприятия отдела' : 'Workspace events'} subtitle={workspaceId} actions={<Link className="btn btn-primary" href={`/${locale}/admin/events/new`}>{isRu ? 'Создать мероприятие' : 'New event'}</Link>} />
      {loading ? <LoadingLines rows={5} /> : null}
      {!loading && events.length === 0 ? <EmptyState title={isRu ? 'Мероприятий нет' : 'No events'} description={isRu ? 'Создайте мероприятие и привяжите его к отделу.' : 'Create an event and attach it to this workspace.'} /> : null}
      {events.length > 0 ? (
        <Panel className="admin-command-panel">
          <div className="admin-table-mobile-cards">
            <AdminDataTable minWidth={760}>
              <AdminDataTableHeader
                columns={[
                  { label: isRu ? 'Название' : 'Title', width: '42%' },
                  { label: isRu ? 'Статус' : 'Status', width: '18%' },
                  { label: isRu ? 'Дата' : 'Date', width: '18%' },
                  { label: isRu ? 'Действия' : 'Actions', width: '22%', align: 'right' },
                ]}
              />
              <AdminDataTableBody>
                {events.map((event) => (
                  <AdminDataTableRow key={event.id}>
                    <AdminDataTableCell>
                      <AdminTableCellMain title={<Link className="admin-table-title-link" href={`/${locale}/admin/events/${event.id}/overview`}>{event.title}</Link>} subtitle={event.slug} />
                    </AdminDataTableCell>
                    <AdminDataTableCell><StatusBadge tone={event.status === 'PUBLISHED' ? 'success' : 'neutral'}>{event.status}</StatusBadge></AdminDataTableCell>
                    <AdminDataTableCell>{event.startsAt ? new Date(event.startsAt).toLocaleDateString(locale) : '-'}</AdminDataTableCell>
                    <AdminDataTableCell align="right"><Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/events/${event.id}/staff`}>{isRu ? 'Staff' : 'Staff'}</Link></AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>

            <AdminMobileList>
              {events.map((event) => (
                <AdminMobileCard
                  key={event.id}
                  title={<Link className="admin-table-title-link" href={`/${locale}/admin/events/${event.id}/overview`}>{event.title}</Link>}
                  subtitle={event.slug}
                  badge={<StatusBadge tone={event.status === 'PUBLISHED' ? 'success' : 'neutral'}>{event.status}</StatusBadge>}
                  meta={[{ label: isRu ? 'Дата' : 'Date', value: event.startsAt ? new Date(event.startsAt).toLocaleDateString(locale) : '-' }]}
                  actions={<Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/events/${event.id}/staff`}>{isRu ? 'Staff' : 'Staff'}</Link>}
                />
              ))}
            </AdminMobileList>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
