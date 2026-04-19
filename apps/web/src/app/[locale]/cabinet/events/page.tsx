'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError, eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, FieldTextarea, LoadingLines, Notice, PageHeader, Panel, SectionHeader, ToolbarRow } from '@/components/ui/signal-primitives';

type MissingField = {
  key: string;
  label: string;
  scope: 'PROFILE' | 'EVENT_FORM';
};

export default function CabinetAllEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useRouteLocale();
  const selectedSlug = searchParams.get('event') ?? '';

  const [events, setEvents] = useState<any[]>([]);
  const [applications, setApplications] = useState<Record<string, any>>({});
  const [answersByEvent, setAnswersByEvent] = useState<Record<string, Record<string, string>>>({});
  const [missingByEvent, setMissingByEvent] = useState<Record<string, MissingField[]>>({});
  const [eventsLoading, setEventsLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
  const selectedEvent = selectedSlug ? events.find((event) => event.slug === selectedSlug) : null;
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

  const setEventAnswer = (eventId: string, key: string, value: string) => {
    setAnswersByEvent((previous) => ({
      ...previous,
      [eventId]: {
        ...(previous[eventId] ?? {}),
        [key]: value,
      },
    }));
  };

  async function handleApply(event: any) {
    setSubmittingId(event.id);
    setMessage('');
    setError('');
    try {
      const answers = answersByEvent[event.id] ?? {};
      const { precheck } = await eventsApi.registrationPrecheck(event.id, answers);
      if (!precheck.ok) {
        setMissingByEvent((previous) => ({ ...previous, [event.id]: precheck.missingFields ?? [] }));
        setMessage(locale === 'ru' ? 'Заполните недостающие данные и повторите проверку.' : 'Complete missing data and run the check again.');
        return;
      }
      const result = await eventsApi.register(event.id, answers);
      setMissingByEvent((previous) => ({ ...previous, [event.id]: [] }));
      setApplications((previous) => ({
        ...previous,
        [event.slug]: {
          id: result.membership?.id,
          status: result.membership?.status ?? result.status,
          event,
          assignedAt: new Date().toISOString(),
        },
      }));
      setMessage((result.membership?.status ?? result.status) === 'PENDING'
        ? (locale === 'ru' ? 'Заявка отправлена администратору на подтверждение.' : 'Application sent to admin approval.')
        : (locale === 'ru' ? 'Участие подтверждено. Workspace открыт в «Моих мероприятиях».' : 'Participation approved. Workspace is available in My events.'));
    } catch (err) {
      if (err instanceof ApiError && Array.isArray((err.details as any)?.missingFields)) {
        setMissingByEvent((previous) => ({ ...previous, [event.id]: (err.details as any).missingFields }));
        setMessage(locale === 'ru' ? 'Заполните недостающие данные и повторите проверку.' : 'Complete missing data and run the check again.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(locale === 'ru' ? 'Не удалось подать заявку.' : 'Failed to submit application.');
      }
    } finally {
      setSubmittingId('');
    }
  }

  function renderApplicationBox(event: any) {
    const application = applications[event.slug];
    const missing = missingByEvent[event.id] ?? [];
    const profileMissing = missing.filter((field) => field.scope === 'PROFILE');
    const eventMissing = missing.filter((field) => field.scope === 'EVENT_FORM');

    return (
      <Panel variant="elevated" className="workspace-application-panel" id={`application-${event.slug}`}>
        <SectionHeader
          title={locale === 'ru' ? 'Подача заявки через ЛК' : 'Cabinet application'}
          subtitle={event.title}
        />
        <div className="signal-muted">{event.location} · {formatDate(event.startsAt)} — {formatDate(event.endsAt)}</div>

        {application ? (
          <Notice tone={application.status === 'ACTIVE' ? 'success' : application.status === 'PENDING' ? 'warning' : 'info'}>
            {statusLabel(application.status)}
          </Notice>
        ) : (
          <Notice tone="info">
            {locale === 'ru'
              ? 'Перед подачей система выполнит precheck профиля и анкеты мероприятия.'
              : 'Before submission, the system runs profile and event form precheck.'}
          </Notice>
        )}

        {profileMissing.length > 0 ? (
          <div className="signal-stack">
            <strong>{locale === 'ru' ? 'Нужно заполнить профиль:' : 'Complete profile fields:'}</strong>
            {profileMissing.map((field) => <div key={field.key} className="signal-ranked-item"><span>{field.label}</span></div>)}
            <Link href={`/${locale}/cabinet/profile?required=${profileMissing.map((field) => field.key).join(',')}&event=${encodeURIComponent(event.title)}`} className="btn btn-secondary btn-sm">
              {locale === 'ru' ? 'Открыть профиль' : 'Open profile'}
            </Link>
          </div>
        ) : null}

        {eventMissing.length > 0 ? (
          <div className="signal-stack">
            <strong>{locale === 'ru' ? 'Анкета мероприятия:' : 'Event form:'}</strong>
            {eventMissing.map((field) => (
              <label key={field.key} className="signal-stack">
                <span className="signal-muted">{field.label}</span>
                <FieldTextarea value={answersByEvent[event.id]?.[field.key] ?? ''} onChange={(inputEvent) => setEventAnswer(event.id, field.key, inputEvent.target.value)} rows={2} />
              </label>
            ))}
          </div>
        ) : null}

        <ToolbarRow>
          {application?.status === 'ACTIVE' ? (
            <Link href={`/${locale}/cabinet/my-events/${event.slug}`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Открыть workspace' : 'Open workspace'}</Link>
          ) : (
            <button onClick={() => void handleApply(event)} disabled={submittingId === event.id || application?.status === 'PENDING'} className="btn btn-primary btn-sm">
              {submittingId === event.id
                ? (locale === 'ru' ? 'Проверка...' : 'Checking...')
                : application?.status === 'PENDING'
                  ? (locale === 'ru' ? 'Ожидает подтверждения' : 'Pending approval')
                  : (locale === 'ru' ? 'Precheck и подать заявку' : 'Precheck and submit')}
            </button>
          )}
          <Link href={`/${locale}/events/${event.slug}`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Публичная страница' : 'Public page'}</Link>
        </ToolbarRow>
      </Panel>
    );
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
            {message ? <Notice tone="info">{message}</Notice> : null}
            {error ? <Notice tone="danger">{error}</Notice> : null}
            {selectedEvent ? renderApplicationBox(selectedEvent) : null}
            {leadEvent ? (
              <div id={`event-${leadEvent.slug}`} className={`workspace-event-lead ${selectedSlug === leadEvent.slug ? 'workspace-event-selected' : ''}`}>
                <div className="workspace-event-lead-cover">
                  {leadEvent.coverImageUrl ? <img src={leadEvent.coverImageUrl} alt={leadEvent.title} /> : <div className="cover-fallback"><span>{leadEvent.title?.slice(0, 2).toUpperCase()}</span></div>}
                </div>
                <div className="workspace-event-lead-body">
                  <h2>{leadEvent.title}</h2>
                  <div className="signal-muted">{leadEvent.location} · {formatDate(leadEvent.startsAt)} — {formatDate(leadEvent.endsAt)}</div>
                  <ToolbarRow>
                    
                    <Link href={`/${locale}/cabinet/events?event=${leadEvent.slug}#event-${leadEvent.slug}`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Подать через ЛК' : 'Apply in cabinet'}</Link>
                    <Link href={`/${locale}/events/${leadEvent.slug}`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Публичная страница' : 'Public page'}</Link>
                  </ToolbarRow>
                </div>
              </div>
            ) : null}

            <div className="workspace-event-list">
              {tailEvents.map((event: any) => {
                return (
                  <div key={event.id} id={`event-${event.slug}`} className={`signal-ranked-item cabinet-list-item workspace-event-list-item ${selectedSlug === event.slug ? 'workspace-event-selected' : ''}`}>
                    <div className="cabinet-list-item-main">
                      <div className="signal-avatar cabinet-list-avatar">{event.coverImageUrl ? <img src={event.coverImageUrl} alt="" /> : event.title?.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <strong>{event.title}</strong>
                        <div className="signal-muted">{event.location} · {formatDate(event.startsAt)} — {formatDate(event.endsAt)}</div>
                      </div>
                    </div>
                    <ToolbarRow>
                      
                      <Link href={`/${locale}/cabinet/events?event=${event.slug}#event-${event.slug}`} className="btn btn-primary btn-sm">{locale === 'ru' ? 'Подать' : 'Apply'}</Link>
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
