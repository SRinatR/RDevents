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

  return (
    <div className="signal-page-shell">
      <div className="cabinet-page-hero">
        <PageHeader title={locale === 'ru' ? 'Каталог мероприятий' : 'Event catalog'} subtitle={locale === 'ru' ? 'Доступные события для участия' : 'Available events for participation'} />
        <ToolbarRow>
          <Link href={`/${locale}/cabinet/my-events`} className="signal-chip-link">{locale === 'ru' ? 'Мои мероприятия' : 'My events'}</Link>
          <StatusBadge tone="info">{events.length} {locale === 'ru' ? 'событий' : 'events'}</StatusBadge>
        </ToolbarRow>
      </div>

      <Panel className="cabinet-module-panel-strong">
        {eventsLoading ? <LoadingLines rows={6} /> : events.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'События пока отсутствуют' : 'No events yet'} description={locale === 'ru' ? 'Каталог пуст. Возвращайтесь позже или проверьте фильтры на публичной странице событий.' : 'Catalog is empty. Check back later or review filters on the public events page.'} />
        ) : (
          <div className="signal-stack cabinet-list-stack">
            {events.map((event: any) => {
              const isOpen = new Date(event.registrationDeadline) > new Date();
              return (
                <div key={event.id} className="signal-ranked-item cabinet-list-item">
                  <div className="cabinet-list-item-main">
                    <div className="signal-avatar cabinet-list-avatar">{event.coverImageUrl ? <img src={event.coverImageUrl} alt="" /> : event.title?.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{event.title}</strong>
                      <div className="signal-muted">{event.location} · {formatDate(event.startsAt)} — {formatDate(event.endsAt)}</div>
                    </div>
                  </div>
                  <ToolbarRow>
                    <StatusBadge tone={isOpen ? 'success' : 'warning'}>{isOpen ? (locale === 'ru' ? 'Регистрация открыта' : 'Registration open') : (locale === 'ru' ? 'Регистрация закрыта' : 'Registration closed')}</StatusBadge>
                    <Link href={`/${locale}/events/${event.slug}`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Открыть' : 'Open'}</Link>
                  </ToolbarRow>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Notice tone="info">{locale === 'ru' ? 'Эта страница сохраняет текущую логику eventsApi.list без изменений backend-поведения.' : 'This page keeps existing eventsApi.list logic without backend behavior changes.'}</Notice>
    </div>
  );
}
