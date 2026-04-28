'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import {
  EmptyState,
  LoadingLines,
  Notice,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
  ToolbarRow,
} from '@/components/ui/signal-primitives';

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
    PENDING: 'На рассмотрении',
    APPROVED: 'Одобрено',
    ACTIVE: 'Одобрено',
    RESERVE: 'В резерве',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
    REMOVED: 'Удалено',
    WITHDRAWN: 'Отозвано',
  };
  const en: Record<string, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    ACTIVE: 'Approved',
    RESERVE: 'Reserve',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    REMOVED: 'Removed',
    WITHDRAWN: 'Withdrawn',
  };

  if (!status) return locale === 'ru' ? 'Не подана' : 'Not submitted';
  return (locale === 'ru' ? ru : en)[status] ?? status;
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function CabinetVolunteerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [applications, setApplications] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [applyingEventId, setApplyingEventId] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setError('');
    try {
      const [volunteerResult, eventsResult] = await Promise.all([
        eventsApi.myVolunteerApplications(),
        eventsApi.list({ limit: 100, sort: 'startsAt', order: 'asc' }),
      ]);
      setApplications(volunteerResult.applications || []);
      setEvents(eventsResult.data || []);
    } catch {
      setError(locale === 'ru' ? 'Не удалось загрузить волонтёрский кабинет.' : 'Failed to load volunteer center.');
    } finally {
      setLoadingData(false);
    }
  }, [user, locale]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const applicationByEventId = useMemo(
    () => new Map(applications.map((application) => [application.eventId ?? application.event?.id, application])),
    [applications],
  );

  const volunteerEvents = useMemo(
    () => events.filter((event) => Boolean(event.volunteerApplicationsEnabled)),
    [events],
  );

  const availableEvents = useMemo(
    () => volunteerEvents.filter((event) => !applicationByEventId.has(event.id)),
    [volunteerEvents, applicationByEventId],
  );

  async function handleApply(event: any) {
    setApplyingEventId(event.id);
    setError('');
    setSuccess('');

    try {
      await eventsApi.applyVolunteer(event.id);
      setSuccess(locale === 'ru' ? 'Волонтёрская заявка отправлена.' : 'Volunteer application submitted.');
      await loadData();
    } catch (err: any) {
      setError(err.message || (locale === 'ru' ? 'Не удалось отправить заявку.' : 'Failed to submit application.'));
    } finally {
      setApplyingEventId('');
    }
  }

  if (loading || !user) return null;

  const pendingCount = applications.filter((item) => item.status === 'PENDING').length;
  const activeCount = applications.filter((item) => item.status === 'ACTIVE' || item.status === 'APPROVED').length;
  const rejectedCount = applications.filter((item) => ['REJECTED', 'CANCELLED'].includes(item.status)).length;

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader
        title={locale === 'ru' ? 'Волонтёрский кабинет' : 'Volunteer center'}
        subtitle={locale === 'ru' ? 'Заявки, решения организатора и доступные события в одном месте' : 'Applications, organizer decisions, and available events in one place'}
        actions={<Link href={`/${locale}/cabinet/events`} className="btn btn-secondary btn-sm">{locale === 'ru' ? 'Каталог событий' : 'Event catalog'}</Link>}
      />

      <div className="workspace-command-row">
        <Link href={`/${locale}/cabinet/applications`} className="signal-chip-link">{locale === 'ru' ? 'Все заявки' : 'All applications'}</Link>
        <Link href={`/${locale}/cabinet/profile`} className="signal-chip-link">{locale === 'ru' ? 'Профиль' : 'Profile'}</Link>
        <Link href={`/${locale}/cabinet/support?new=1`} className="signal-chip-link">{locale === 'ru' ? 'Задать вопрос' : 'Ask support'}</Link>
      </div>

      <div className="workspace-status-strip workspace-status-strip-v2 cabinet-overview-strip">
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Всего заявок' : 'Total applications'}</small><strong>{applications.length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'На рассмотрении' : 'Pending'}</small><strong>{pendingCount}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Одобрено' : 'Approved'}</small><strong>{activeCount}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Доступно для подачи' : 'Available to apply'}</small><strong>{availableEvents.length}</strong></div>
      </div>

      {success ? <Notice tone="success">{success}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loadingData ? <LoadingLines rows={8} /> : (
        <div className="workspace-board-grid cabinet-volunteer-grid">
          <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
            <SectionHeader title={locale === 'ru' ? 'Мои волонтёрские заявки' : 'My volunteer applications'} />
            {applications.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Заявок пока нет' : 'No applications yet'}
                description={locale === 'ru' ? 'Выберите событие из списка доступных ролей и отправьте заявку.' : 'Choose an event from available roles and submit an application.'}
              />
            ) : (
              <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
                {applications.map((application) => (
                  <div key={application.id} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{application.event?.title ?? 'Event'}</strong>
                      <div className="signal-muted">
                        {(application.event?.location ?? '—')} · {formatDate(application.assignedAt, locale)}
                      </div>
                    </div>
                    <div className="cabinet-list-item-actions">
                      <StatusBadge tone={statusTone(application.status)}>{statusLabel(application.status, locale)}</StatusBadge>
                      <Link href={`/${locale}/cabinet/events?event=${application.event?.slug ?? ''}&openApplyChoice=1`} className="signal-chip-link">
                        {locale === 'ru' ? 'Открыть' : 'Open'}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
            <SectionHeader title={locale === 'ru' ? 'Доступные волонтёрские роли' : 'Available volunteer roles'} />
            {availableEvents.length === 0 ? (
              <EmptyState
                title={locale === 'ru' ? 'Новых наборов нет' : 'No new openings'}
                description={locale === 'ru' ? 'Когда организаторы откроют набор волонтёров, события появятся здесь.' : 'When organizers open volunteer recruitment, events will appear here.'}
              />
            ) : (
              <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
                {availableEvents.map((event) => (
                  <div key={event.id} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{event.title}</strong>
                      <div className="signal-muted">
                        {event.location} · {formatDate(event.startsAt, locale)}
                      </div>
                    </div>
                    <ToolbarRow>
                      <button
                        type="button"
                        onClick={() => void handleApply(event)}
                        disabled={applyingEventId === event.id}
                        className="btn btn-primary btn-sm"
                      >
                        {applyingEventId === event.id
                          ? (locale === 'ru' ? 'Отправляем...' : 'Submitting...')
                          : (locale === 'ru' ? 'Подать заявку' : 'Apply')}
                      </button>
                      <Link href={`/${locale}/events/${event.slug}`} className="btn btn-secondary btn-sm">
                        {locale === 'ru' ? 'О событии' : 'Event'}
                      </Link>
                    </ToolbarRow>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
            <SectionHeader title={locale === 'ru' ? 'Готовность' : 'Readiness'} />
            <div className="signal-stack">
              <div className="signal-ranked-item">
                <span>{locale === 'ru' ? 'Профиль и контакты' : 'Profile and contacts'}</span>
                <Link href={`/${locale}/cabinet/profile`} className="signal-chip-link">{locale === 'ru' ? 'Проверить' : 'Check'}</Link>
              </div>
              <div className="signal-ranked-item">
                <span>{locale === 'ru' ? 'Отклонённые или отменённые заявки' : 'Rejected or cancelled applications'}</span>
                <StatusBadge tone={rejectedCount > 0 ? 'warning' : 'success'}>{rejectedCount}</StatusBadge>
              </div>
              <div className="signal-ranked-item">
                <span>{locale === 'ru' ? 'Вопрос организаторам' : 'Question for organizers'}</span>
                <Link href={`/${locale}/cabinet/support?new=1`} className="signal-chip-link">{locale === 'ru' ? 'Поддержка' : 'Support'}</Link>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
