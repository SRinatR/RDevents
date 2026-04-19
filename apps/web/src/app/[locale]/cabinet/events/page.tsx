'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError, eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, ToolbarRow } from '@/components/ui/signal-primitives';

export default function CabinetAllEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [applications, setApplications] = useState<Record<string, any>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [eventsLoading, setEventsLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    Promise.all([eventsApi.list(), eventsApi.myApplications()])
      .then(([eventsResponse, applicationsResponse]) => {
        setEvents(eventsResponse.data || []);
        setApplications(Object.fromEntries((applicationsResponse.applications || []).map((item: any) => [item.event?.slug, item])));
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  if (loading || !user) return null;

  const formatDate = (date: string) => new Date(date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const leadEvent = events[0];
  const tailEvents = events.slice(1);

  const statusLabel = (status?: string) => {
    const ru: Record<string, string> = {
      PENDING: 'Заявка на рассмотрении',
      ACTIVE: 'Одобрено',
      RESERVE: 'В резерве',
      REJECTED: 'Отклонено',
      CANCELLED: 'Отменено',
    };
    const en: Record<string, string> = {
      PENDING: 'Application pending',
      ACTIVE: 'Approved',
      RESERVE: 'Reserve',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
    };
    return status ? ((locale === 'ru' ? ru : en)[status] ?? status) : '';
  };

  async function handleApply(event: any) {
    setSubmittingId(event.id);
    setActionErrors((previous) => ({ ...previous, [event.id]: '' }));
    try {
      const result = await eventsApi.register(event.id, {});
      setApplications((previous) => ({
        ...previous,
        [event.slug]: {
          id: result.membership?.id,
          status: result.membership?.status ?? result.status,
          event,
          assignedAt: new Date().toISOString(),
        },
      }));
    } catch (err) {
      if (err instanceof ApiError && Array.isArray((err.details as any)?.missingFields)) {
        setActionErrors((previous) => ({
          ...previous,
          [event.id]: locale === 'ru' ? 'Заполните обязательные поля профиля в личном кабинете.' : 'Complete required profile fields in your cabinet.',
        }));
      } else if (err instanceof ApiError) {
        setActionErrors((previous) => ({ ...previous, [event.id]: err.message }));
      } else {
        setActionErrors((previous) => ({ ...previous, [event.id]: locale === 'ru' ? 'Не удалось подать заявку.' : 'Failed to submit application.' }));
      }
    } finally {
      setSubmittingId('');
    }
  }

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={locale === 'ru' ? 'Каталог мероприятий' : 'Event catalog'} subtitle={locale === 'ru' ? 'Рабочий вход в события для подачи и управления участием' : 'Operational entry to events for joining and participation management'} />

      <div className="workspace-command-row">
        <Link href={`/${locale}/cabinet/my-events`} className="signal-chip-link">{locale === 'ru' ? 'Мои мероприятия' : 'My events'}</Link>
        <Link href={`/${locale}/cabinet/applications`} className="signal-chip-link">{locale === 'ru' ? 'Заявки и статусы' : 'Applications'}</Link>
        
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
              <div id={`event-${leadEvent.slug}`} className="workspace-event-lead">
                <div className="workspace-event-lead-cover">
                  {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <div className="cover-fallback"><span>{leadEvent.title?.slice(0, 2).toUpperCase()}</span></div>}
                </div>
                <div className="workspace-event-lead-body">
                  <h2>{leadEvent.title}</h2>
                  <div className="signal-muted">{leadEvent.location} · {formatDate(leadEvent.startsAt)} — {formatDate(leadEvent.endsAt)}</div>
                  <ToolbarRow>
                    <button onClick={() => void handleApply(leadEvent)} disabled={submittingId === leadEvent.id || applications[leadEvent.slug]?.status === 'PENDING'} className="btn btn-primary btn-sm">
                      {submittingId === leadEvent.id
                        ? (locale === 'ru' ? 'Отправка...' : 'Submitting...')
                        : applications[leadEvent.slug]?.status === 'PENDING'
                          ? (locale === 'ru' ? 'Ожидает подтверждения' : 'Pending approval')
                          : (locale === 'ru' ? 'Зарегистрироваться' : 'Register')}
                    </button>
                    <Link href={`/${locale}/events/${leadEvent.slug}`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Публичная страница' : 'Public page'}</Link>
                  </ToolbarRow>
                  {applications[leadEvent.slug]?.status ? (
                    <div className="signal-muted">{statusLabel(applications[leadEvent.slug]?.status)}</div>
                  ) : null}
                  {actionErrors[leadEvent.id] ? <Notice tone="danger">{actionErrors[leadEvent.id]}</Notice> : null}
                </div>
              </div>
            ) : null}

            <div className="workspace-event-list">
              {tailEvents.map((event: any) => {
                return (
                  <div key={event.id} id={`event-${event.slug}`} className="signal-ranked-item cabinet-list-item workspace-event-list-item">
                    <div className="cabinet-list-item-main">
                      <div className="signal-avatar cabinet-list-avatar">{event.coverImageUrl ? <img src={event.coverImageUrl} alt="" /> : event.title?.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <strong>{event.title}</strong>
                        <div className="signal-muted">{event.location} · {formatDate(event.startsAt)} — {formatDate(event.endsAt)}</div>
                      </div>
                    </div>
                    <ToolbarRow>
                      <button onClick={() => void handleApply(event)} disabled={submittingId === event.id || applications[event.slug]?.status === 'PENDING'} className="btn btn-primary btn-sm">
                        {submittingId === event.id
                          ? (locale === 'ru' ? 'Отправка...' : 'Submitting...')
                          : applications[event.slug]?.status === 'PENDING'
                            ? (locale === 'ru' ? 'Ожидает подтверждения' : 'Pending approval')
                            : (locale === 'ru' ? 'Зарегистрироваться' : 'Register')}
                      </button>
                      <Link href={`/${locale}/events/${event.slug}`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Публичная страница' : 'Public page'}</Link>
                    </ToolbarRow>
                    {applications[event.slug]?.status ? <div className="signal-muted">{statusLabel(applications[event.slug]?.status)}</div> : null}
                    {actionErrors[event.id] ? <Notice tone="danger">{actionErrors[event.id]}</Notice> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
