'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, StatusBadge, ToolbarRow } from '@/components/ui/signal-primitives';

export default function CabinetAllEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    eventsApi.list()
      .then((response) => setEvents(response.data || []))
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  if (loading || !user) return null;

  const formatDate = (date: string) => new Date(date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const leadEvent = events[0];
  const tailEvents = events.slice(1);

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={locale === 'ru' ? 'Каталог мероприятий' : 'Event catalog'} subtitle={locale === 'ru' ? 'Рабочий вход в события для подачи и управления участием' : 'Operational entry to events for joining and participation management'} />

      <div className="workspace-command-row">
        <Link href={`/${locale}/cabinet/my-events`} className="signal-chip-link">{locale === 'ru' ? 'Мои мероприятия' : 'My events'}</Link>
        <StatusBadge tone="info">{events.length} {locale === 'ru' ? 'событий' : 'events'}</StatusBadge>
      </div>

      <div className="workspace-status-strip workspace-status-strip-v2">
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Доступно сейчас' : 'Available now'}</small><strong>{events.length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Следующий шаг' : 'Next step'}</small><strong>{locale === 'ru' ? 'Открыть событие и подать участие' : 'Open event and submit participation'}</strong></div>
      </div>

      <Panel variant="elevated" className="workspace-catalog-panel">
        {eventsLoading ? <LoadingLines rows={6} /> : events.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'События пока отсутствуют' : 'No events yet'} description={locale === 'ru' ? 'Каталог пуст. Возвращайтесь позже или проверьте фильтры на публичной странице событий.' : 'Catalog is empty. Check back later or review filters on the public events page.'} />
        ) : (
          <div className="workspace-event-catalog-grid">
            {leadEvent ? (
              <div className="workspace-event-lead">
                <div className="workspace-event-lead-cover">
                  {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <div className="cover-fallback"><span>{leadEvent.title?.slice(0, 2).toUpperCase()}</span></div>}
                </div>
                <div className="workspace-event-lead-body">
                  <h2>{leadEvent.title}</h2>
                  <div className="signal-muted">{leadEvent.location} · {formatDate(leadEvent.startsAt)} — {formatDate(leadEvent.endsAt)}</div>
                  <ToolbarRow>
                    <StatusBadge tone={new Date(leadEvent.registrationDeadline) > new Date() ? 'success' : 'warning'}>{new Date(leadEvent.registrationDeadline) > new Date() ? (locale === 'ru' ? 'Регистрация открыта' : 'Registration open') : (locale === 'ru' ? 'Регистрация закрыта' : 'Registration closed')}</StatusBadge>
                    <Link href={`/${locale}/events/${leadEvent.slug}`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Открыть событие' : 'Open event'}</Link>
                  </ToolbarRow>
                </div>
              </div>
            ) : null}

            <div className="workspace-event-list">
              {tailEvents.map((event: any) => {
                const isOpen = new Date(event.registrationDeadline) > new Date();
                return (
                  <div key={event.id} className="signal-ranked-item cabinet-list-item workspace-event-list-item">
                    <div className="cabinet-list-item-main">
                      <div className="signal-avatar cabinet-list-avatar">{event.coverImageUrl ? <img src={event.coverImageUrl} alt="" /> : event.title?.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <strong>{event.title}</strong>
                        <div className="signal-muted">{event.location} · {formatDate(event.startsAt)} — {formatDate(event.endsAt)}</div>
                      </div>
                    </div>
                    <ToolbarRow>
                      <StatusBadge tone={isOpen ? 'success' : 'warning'}>{isOpen ? (locale === 'ru' ? 'Открыта' : 'Open') : (locale === 'ru' ? 'Закрыта' : 'Closed')}</StatusBadge>
                      <Link href={`/${locale}/events/${event.slug}`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Карточка' : 'View'}</Link>
                    </ToolbarRow>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      <Notice tone="info">{locale === 'ru' ? 'Каталог обновляется автоматически при публикации новых событий.' : 'Catalog updates automatically when new events are published.'}</Notice>
    </div>
  );
}
