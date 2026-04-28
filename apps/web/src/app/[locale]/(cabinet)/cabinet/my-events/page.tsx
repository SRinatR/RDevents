'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { eventsApi } from '@/lib/api';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, StatusBadge } from '@/components/ui/signal-primitives';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

function statusTone(status?: string): StatusTone {
  if (!status) return 'neutral';
  if (['ACTIVE', 'APPROVED', 'CONFIRMED'].includes(status)) return 'success';
  if (['PENDING', 'UNDER_REVIEW', 'SUBMITTED'].includes(status)) return 'warning';
  if (status === 'RESERVE') return 'info';
  if (['REJECTED', 'CANCELLED', 'REMOVED', 'WITHDRAWN'].includes(status)) return 'danger';
  return 'neutral';
}

function statusLabel(status: string | undefined, locale: string) {
  const ru: Record<string, string> = {
    ACTIVE: 'Активно',
    APPROVED: 'Одобрено',
    PENDING: 'На рассмотрении',
    RESERVE: 'В резерве',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
  };
  const en: Record<string, string> = {
    ACTIVE: 'Active',
    APPROVED: 'Approved',
    PENDING: 'Pending',
    RESERVE: 'Reserve',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  };
  if (!status) return locale === 'ru' ? 'Активно' : 'Active';
  return (locale === 'ru' ? ru : en)[status] ?? status;
}

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
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={locale === 'ru' ? 'Мои мероприятия' : 'My events'} subtitle={locale === 'ru' ? 'Только одобренные участия с доступом к рабочему пространству' : 'Only approved participations with workspace access'} />

      <div className="workspace-command-row">
        <Link href={`/${locale}/cabinet/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть каталог' : 'Open catalog'}</Link>
      </div>

      <div className="workspace-status-strip workspace-status-strip-v2">
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Одобренные участия' : 'Approved participations'}</small><strong>{events.length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Основной сценарий' : 'Primary workflow'}</small><strong>{locale === 'ru' ? 'Открыть карточку участия' : 'Open participation workspace'}</strong></div>
      </div>

      <Panel variant="elevated" className="cabinet-workspace-panel">
        {eventsLoading ? <LoadingLines rows={6} /> : error ? <Notice tone="danger">{error}</Notice> : events.length === 0 ? (
          <EmptyState title={locale === 'ru' ? 'Одобренных участий пока нет' : 'No approved participations yet'} description={locale === 'ru' ? 'Поданные заявки и решения организаторов доступны в разделе «Заявки и статусы».' : 'Submitted applications and organizer decisions are available in Applications and statuses.'} actions={<Link href={`/${locale}/cabinet/applications`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Открыть заявки' : 'Open applications'}</Link>} />
        ) : (
          <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
            {events.map((registration: any) => {
              const event = registration.event ?? registration;
              const href = event.slug ? `/${locale}/cabinet/my-events/${event.slug}` : `/${locale}/cabinet/my-events`;
              return (
                <Link key={registration.registrationId ?? registration.id ?? event.id} href={href} className="signal-ranked-item cabinet-list-item workspace-event-journey-item">
                  <div>
                    <strong>{event.title}</strong>
                    <div className="signal-muted">{event.location ? `${event.location} · ` : ''}{event.startsAt && event.endsAt ? `${formatDate(event.startsAt)} — ${formatDate(event.endsAt)}` : ''}</div>
                  </div>
                  <div className="cabinet-list-item-actions">
                    <StatusBadge tone={statusTone(registration.status ?? registration.registrationStatus)}>
                      {statusLabel(registration.status ?? registration.registrationStatus, locale)}
                    </StatusBadge>
                    <span className="signal-chip-link">{locale === 'ru' ? 'Открыть' : 'Open'}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
