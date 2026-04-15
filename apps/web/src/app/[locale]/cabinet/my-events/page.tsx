'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';

export default function MyEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!user) return;
    setEventsLoading(true);
    setError('');
    eventsApi.myEvents()
      .then((result) => setEvents(result.events || []))
      .catch(() => setError(locale === 'ru' ? 'Не удалось загрузить мероприятия.' : 'Failed to load events.'))
      .finally(() => setEventsLoading(false));
  }, [user, locale]);

  if (loading || !user) return null;

  const formatDate = (date: string) => new Date(date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="signal-page-shell cabinet-workspace-page">
      <PageHeader title={locale === 'ru' ? 'Мои мероприятия' : 'My events'} subtitle={locale === 'ru' ? 'Текущие и завершённые участия' : 'Current and completed participations'} />
      <div className="workspace-status-strip">
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Всего участий' : 'Total participations'}</small><strong>{events.length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Режим' : 'Mode'}</small><strong>{locale === 'ru' ? 'Личный трек' : 'Personal track'}</strong></div>
      </div>
      <ToolbarRow><Link href={`/${locale}/cabinet/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть каталог' : 'Open catalog'}</Link></ToolbarRow>

      <Panel variant="elevated" className="cabinet-workspace-panel">
        {eventsLoading ? <LoadingLines rows={6} /> : error ? <Notice tone="danger">{error}</Notice> : events.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'Участий пока нет' : 'No participations yet'} description={locale === 'ru' ? 'Выберите событие из каталога, чтобы начать участие.' : 'Choose an event from catalog to start participating.'} actions={<Link href={`/${locale}/cabinet/events`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Смотреть события' : 'View events'}</Link>} />
        ) : (
          <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
            {events.map((registration: any) => {
              const event = registration.event ?? registration;
              const href = event.slug ? `/${locale}/cabinet/my-events/${event.slug}` : `/${locale}/cabinet/my-events`;
              return (
                <Link key={registration.registrationId ?? registration.id ?? event.id} href={href} className="signal-ranked-item cabinet-list-item">
                  <div>
                    <strong>{event.title}</strong>
                    <div className="signal-muted">{event.location ? `${event.location} · ` : ''}{event.startsAt && event.endsAt ? `${formatDate(event.startsAt)} — ${formatDate(event.endsAt)}` : ''}</div>
                  </div>
                  <StatusBadge tone={registration.status === 'ACTIVE' || registration.status === 'APPROVED' ? 'success' : registration.status === 'PENDING' ? 'warning' : registration.status === 'REJECTED' ? 'danger' : 'neutral'}>{registration.status}</StatusBadge>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
