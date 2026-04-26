'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useRouteLocale, useRouteParam } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, PageHeader, Panel, StatusBadge, TableShell } from '@/components/ui/signal-primitives';

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
    <div className="admin-page">
      <PageHeader title={isRu ? 'Мероприятия отдела' : 'Workspace events'} subtitle={workspaceId} actions={<Link className="btn btn-primary" href={`/${locale}/admin/events/new`}>{isRu ? 'Создать мероприятие' : 'New event'}</Link>} />
      {loading ? <LoadingLines rows={5} /> : null}
      {!loading && events.length === 0 ? <EmptyState title={isRu ? 'Мероприятий нет' : 'No events'} description={isRu ? 'Создайте мероприятие и привяжите его к отделу.' : 'Create an event and attach it to this workspace.'} /> : null}
      {events.length > 0 ? (
        <Panel>
          <TableShell>
            <table>
              <thead><tr><th>{isRu ? 'Название' : 'Title'}</th><th>{isRu ? 'Статус' : 'Status'}</th><th>{isRu ? 'Дата' : 'Date'}</th><th></th></tr></thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td><Link className="admin-table-title-link" href={`/${locale}/admin/events/${event.id}/overview`}>{event.title}</Link></td>
                    <td><StatusBadge tone={event.status === 'PUBLISHED' ? 'success' : 'neutral'}>{event.status}</StatusBadge></td>
                    <td>{event.startsAt ? new Date(event.startsAt).toLocaleDateString(locale) : '-'}</td>
                    <td><Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/events/${event.id}/staff`}>{isRu ? 'Staff' : 'Staff'}</Link></td>
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
