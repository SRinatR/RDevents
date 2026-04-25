'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { ApiError, eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, ToolbarRow } from '@/components/ui/signal-primitives';
import {
  buildProfileRequirementUrl,
  filterEventFormMissingFields,
  filterProfileMissingFields,
  type RegistrationMissingField,
} from '@/components/cabinet/profile/profile.requirements';

export default function CabinetAllEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<any[]>([]);
  const [applications, setApplications] = useState<Record<string, any>>({});
  const [volunteerApplications, setVolunteerApplications] = useState<Record<string, any>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [eventsLoading, setEventsLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState('');
  const [applyChoiceEvent, setApplyChoiceEvent] = useState<any>(null);
  const [applyChoiceLoading, setApplyChoiceLoading] = useState('');
  const [applyChoiceError, setApplyChoiceError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    Promise.all([eventsApi.list(), eventsApi.myApplications(), eventsApi.myVolunteerApplications()])
      .then(([eventsResponse, applicationsResponse, volunteerResponse]) => {
        setEvents(eventsResponse.data || []);
        setApplications(Object.fromEntries((applicationsResponse.applications || []).map((item: any) => [item.event?.slug, item])));
        setVolunteerApplications(Object.fromEntries((volunteerResponse.applications || []).map((item: any) => [item.event?.slug, item])));
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    const selectedSlug = searchParams.get('event');
    const shouldOpenChoice = searchParams.get('openApplyChoice') === '1' || Boolean(searchParams.get('applyType'));
    if (!user || !selectedSlug || !shouldOpenChoice || eventsLoading) return;
    const targetEvent = events.find((item) => item.slug === selectedSlug);
    if (!targetEvent) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('applyType');
    params.delete('openApplyChoice');
    router.replace(`/${locale}/cabinet/events${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    document.getElementById(`event-${targetEvent.slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setApplyChoiceError('');
    setApplyChoiceEvent(targetEvent);
  }, [searchParams, user, eventsLoading, events, locale, router]);

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

  const approvedCtaLabel = locale === 'ru'
    ? 'Открыть кабинет события'
    : 'Open event cabinet';

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
        const fields = (err.details as any).missingFields as RegistrationMissingField[];
        const profileFields = filterProfileMissingFields(fields);
        const eventFields = filterEventFormMissingFields(fields);
        if (profileFields.length > 0) {
          router.push(buildProfileRequirementUrl({
            locale,
            requiredFields: profileFields.map((field) => field.key),
            eventTitle: event.title,
            returnTo: `/${locale}/cabinet/events/${event.slug}`,
          }));
          return;
        }
        if (eventFields.length > 0) {
          router.push(`/${locale}/cabinet/events/${event.slug}`);
          return;
        }
        setActionErrors((previous) => ({
          ...previous,
          [event.id]: locale === 'ru' ? 'Заполните недостающие поля для регистрации.' : 'Complete missing registration fields.',
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

  function handleOpenApplyChoice(event: any) {
    setApplyChoiceError('');
    setApplyChoiceEvent(event);
  }

  async function handleApplyTypeSelect(type: 'participant' | 'volunteer') {
    if (!applyChoiceEvent) return;
    setApplyChoiceError('');
    setApplyChoiceLoading(type);
    setSubmittingId(applyChoiceEvent.id);
    setActionErrors((previous) => ({ ...previous, [applyChoiceEvent.id]: '' }));
    try {
      if (type === 'participant') {
        await handleApply(applyChoiceEvent);
        setApplyChoiceEvent(null);
        return;
      }
      const result = await eventsApi.applyVolunteer(applyChoiceEvent.id);
      setVolunteerApplications((previous) => ({ ...previous, [applyChoiceEvent.slug]: result.membership }));
      setApplyChoiceEvent(null);
    } catch (err: any) {
      if (err instanceof ApiError) setApplyChoiceError(err.message);
      else setApplyChoiceError(locale === 'ru' ? 'Не удалось отправить заявку.' : 'Failed to submit application.');
    } finally {
      setApplyChoiceLoading('');
      setSubmittingId('');
    }
  }

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={locale === 'ru' ? 'Каталог мероприятий' : 'Event catalog'} subtitle={locale === 'ru' ? 'Рабочий вход в события для подачи и управления участием' : 'Operational entry to events for joining and participation management'} />

      <div className="workspace-command-row">
        <Link href={`/${locale}/cabinet/my-events`} className="signal-chip-link">{locale === 'ru' ? 'Мои мероприятия' : 'My events'}</Link>
        <Link href={`/${locale}/cabinet/applications`} className="signal-chip-link">{locale === 'ru' ? 'Заявки и статусы' : 'Applications'}</Link>
        <Link href={`/${locale}/cabinet/volunteer`} className="signal-chip-link">{locale === 'ru' ? 'Волонтёрство' : 'Volunteer center'}</Link>
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
                  {leadEvent.coverImageUrl ? <Image src={leadEvent.coverImageUrl} alt={leadEvent.title} fill sizes="(max-width: 768px) 100vw, 500px" style={{ objectFit: 'cover' }} /> : <div className="cover-fallback"><span>{leadEvent.title?.slice(0, 2).toUpperCase()}</span></div>}
                </div>
                <div className="workspace-event-lead-body">
                  <h2>{leadEvent.title}</h2>
                  <div className="signal-muted">{leadEvent.location} · {formatDate(leadEvent.startsAt)} — {formatDate(leadEvent.endsAt)}</div>
                  <ToolbarRow>
                    {volunteerApplications[leadEvent.slug] ? (
                      <span className="signal-muted">{locale === 'ru' ? 'Волонтёрская заявка' : 'Volunteer application'}: {statusLabel(volunteerApplications[leadEvent.slug]?.status)}</span>
                    ) : applications[leadEvent.slug]?.status === 'ACTIVE' ? (
                      <Link href={`/${locale}/cabinet/events/${leadEvent.slug}`} className="btn btn-primary btn-sm">{approvedCtaLabel}</Link>
                    ) : (
                      <button onClick={() => handleOpenApplyChoice(leadEvent)} disabled={submittingId === leadEvent.id || applications[leadEvent.slug]?.status === 'PENDING'} className="btn btn-primary btn-sm">
                        {submittingId === leadEvent.id
                          ? (locale === 'ru' ? 'Отправка...' : 'Submitting...')
                          : applications[leadEvent.slug]?.status === 'PENDING'
                            ? (locale === 'ru' ? 'Ожидает подтверждения' : 'Pending approval')
                            : (locale === 'ru' ? 'Зарегистрироваться' : 'Register')}
                      </button>
                    )}
                    <Link href={`/${locale}/events/${leadEvent.slug}`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Публичная страница' : 'Public page'}</Link>
                  </ToolbarRow>
                  {applications[leadEvent.slug]?.status ? (
                    <div className="signal-muted">{statusLabel(applications[leadEvent.slug]?.status)}</div>
                  ) : null}
                  {volunteerApplications[leadEvent.slug]?.status ? <div className="signal-muted">{statusLabel(volunteerApplications[leadEvent.slug]?.status)}</div> : null}
                  {actionErrors[leadEvent.id] ? <Notice tone="danger">{actionErrors[leadEvent.id]}</Notice> : null}
                </div>
              </div>
            ) : null}

            <div className="workspace-event-list">
              {tailEvents.map((event: any) => {
                return (
                  <div key={event.id} id={`event-${event.slug}`} className="signal-ranked-item cabinet-list-item workspace-event-list-item">
                    <div className="cabinet-list-item-main">
                      <div className="signal-avatar cabinet-list-avatar">{event.coverImageUrl ? <Image src={event.coverImageUrl} alt="" width={48} height={48} style={{ objectFit: 'cover' }} /> : event.title?.slice(0, 2).toUpperCase()}</div>
                      <div>
                        <strong>{event.title}</strong>
                        <div className="signal-muted">{event.location} · {formatDate(event.startsAt)} — {formatDate(event.endsAt)}</div>
                      </div>
                    </div>
                    <ToolbarRow>
                      {volunteerApplications[event.slug] ? (
                        <span className="signal-muted">{locale === 'ru' ? 'Волонтёрская заявка' : 'Volunteer application'}: {statusLabel(volunteerApplications[event.slug]?.status)}</span>
                      ) : applications[event.slug]?.status === 'ACTIVE' ? (
                        <Link href={`/${locale}/cabinet/events/${event.slug}`} className="btn btn-primary btn-sm">{approvedCtaLabel}</Link>
                      ) : (
                        <button onClick={() => handleOpenApplyChoice(event)} disabled={submittingId === event.id || applications[event.slug]?.status === 'PENDING'} className="btn btn-primary btn-sm">
                          {submittingId === event.id
                            ? (locale === 'ru' ? 'Отправка...' : 'Submitting...')
                            : applications[event.slug]?.status === 'PENDING'
                              ? (locale === 'ru' ? 'Ожидает подтверждения' : 'Pending approval')
                              : (locale === 'ru' ? 'Зарегистрироваться' : 'Register')}
                        </button>
                      )}
                      <Link href={`/${locale}/events/${event.slug}`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Публичная страница' : 'Public page'}</Link>
                    </ToolbarRow>
                    {applications[event.slug]?.status ? <div className="signal-muted">{statusLabel(applications[event.slug]?.status)}</div> : null}
                    {volunteerApplications[event.slug]?.status ? <div className="signal-muted">{statusLabel(volunteerApplications[event.slug]?.status)}</div> : null}
                    {actionErrors[event.id] ? <Notice tone="danger">{actionErrors[event.id]}</Notice> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      {applyChoiceEvent ? (
        <div className="signal-modal-backdrop" role="dialog" aria-modal="true">
          <Panel className="signal-modal-card" style={{ maxWidth: 420, width: '100%' }}>
            <h3>{locale === 'ru' ? 'Выберите тип заявки' : 'Choose application type'}</h3>
            <p className="signal-muted">{applyChoiceEvent.title}</p>
            <div className="signal-stack" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" disabled={Boolean(applyChoiceLoading)} onClick={() => void handleApplyTypeSelect('participant')}>
                {applyChoiceLoading === 'participant' ? '...' : (locale === 'ru' ? 'Участник' : 'Participant')}
              </button>
              <button className="btn btn-secondary" disabled={Boolean(applyChoiceLoading) || !applyChoiceEvent.volunteerApplicationsEnabled} onClick={() => void handleApplyTypeSelect('volunteer')}>
                {applyChoiceLoading === 'volunteer' ? '...' : (locale === 'ru' ? 'Волонтёр' : 'Volunteer')}
              </button>
              {!applyChoiceEvent.volunteerApplicationsEnabled ? (
                <p className="signal-muted">
                  {locale === 'ru'
                    ? 'На это событие сейчас не принимают волонтёрские заявки.'
                    : 'This event is not accepting volunteer applications right now.'}
                </p>
              ) : null}
              <button className="btn btn-ghost btn-sm" disabled={Boolean(applyChoiceLoading)} onClick={() => setApplyChoiceEvent(null)}>
                {locale === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              {applyChoiceError ? <Notice tone="danger">{applyChoiceError}</Notice> : null}
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
