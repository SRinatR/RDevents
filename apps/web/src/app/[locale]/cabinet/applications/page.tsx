'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

function statusTone(status?: string): StatusTone {
  if (!status) return 'neutral';
  if (['ACTIVE', 'APPROVED', 'CONFIRMED'].includes(status)) return 'success';
  if (['PENDING', 'UNDER_REVIEW', 'SUBMITTED', 'CHANGES_PENDING'].includes(status)) return 'warning';
  if (['RESERVE'].includes(status)) return 'info';
  if (['REJECTED', 'CANCELLED', 'REMOVED', 'WITHDRAWN'].includes(status)) return 'danger';
  return 'neutral';
}

export default function CabinetApplicationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

  const [participantApplications, setParticipantApplications] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [volunteerApplications, setVolunteerApplications] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, router, locale]);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    setError('');
    Promise.all([eventsApi.myApplications(), eventsApi.myTeams(), eventsApi.myVolunteerApplications()])
      .then(([participantResult, teamResult, volunteerResult]) => {
        setParticipantApplications(participantResult.applications || []);
        setTeams(teamResult.teams || []);
        setVolunteerApplications(volunteerResult.applications || []);
      })
      .catch(() => setError(locale === 'ru' ? 'Не удалось загрузить заявки. Попробуйте обновить страницу.' : 'Failed to load applications. Try refreshing the page.'))
      .finally(() => setLoadingData(false));
  }, [user, locale]);

  if (loading || !user) return null;

  const formatDate = (date: string) => new Date(date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const statusLabel = (status: string) => {
    const ru: Record<string, string> = {
      PENDING: 'На рассмотрении',
      APPROVED: 'Одобрено',
      ACTIVE: 'Одобрено',
      RESERVE: 'В резерве',
      REJECTED: 'Отклонено',
      CANCELLED: 'Отменено',
      REMOVED: 'Удалено',
      CHANGES_PENDING: 'Изменения на проверке',
      SUBMITTED: 'Подано',
      UNDER_REVIEW: 'На рассмотрении',
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
      CHANGES_PENDING: 'Changes pending',
      SUBMITTED: 'Submitted',
      UNDER_REVIEW: 'Under review',
      WITHDRAWN: 'Withdrawn',
    };
    return (locale === 'ru' ? ru : en)[status] ?? status;
  };

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={locale === 'ru' ? 'Заявки и статусы' : 'Applications and statuses'} subtitle={locale === 'ru' ? 'Путь заявки: профиль, precheck, подача, решение организатора' : 'Application path: profile, precheck, submit, organizer decision'} />

      <div className="workspace-command-row">
        <Link href={`/${locale}/cabinet/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть каталог событий' : 'Open event catalog'}</Link>
        <Link href={`/${locale}/cabinet/my-events`} className="signal-chip-link">{locale === 'ru' ? 'Перейти к моим событиям' : 'Go to my events'}</Link>
        <Link href={`/${locale}/cabinet/volunteer`} className="signal-chip-link">{locale === 'ru' ? 'Волонтёрство' : 'Volunteer center'}</Link>
      </div>

      <div className="workspace-status-strip workspace-status-strip-v2">
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Заявки участника' : 'Participant applications'}</small><strong>{participantApplications.length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'На рассмотрении' : 'Pending'}</small><strong>{participantApplications.filter((item) => item.status === 'PENDING').length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Одобрено' : 'Approved'}</small><strong>{participantApplications.filter((item) => item.status === 'ACTIVE').length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Командные заявки' : 'Team statuses'}</small><strong>{teams.length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Волонтёрские заявки' : 'Volunteer statuses'}</small><strong>{volunteerApplications.length}</strong></div>
      </div>

      {loadingData ? <LoadingLines rows={8} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {!loadingData && !error ? (
        <div className="workspace-board-grid">
          <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
            <SectionHeader title={locale === 'ru' ? 'Заявки на участие' : 'Participant applications'} />
            {participantApplications.length === 0 ? <EmptyState title={locale === 'ru' ? 'Заявок пока нет' : 'No applications yet'} description={locale === 'ru' ? 'Подайте заявку со страницы события после заполнения профиля.' : 'Submit from an event page after completing your profile.'} /> : (
              <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
                {participantApplications.map((application: any) => {
                  const href = application.status === 'ACTIVE'
                    ? `/${locale}/cabinet/my-events/${application.event?.slug || ''}`
                    : `/${locale}/cabinet/events/${application.event?.slug || ''}`;
                  return (
                    <Link key={application.id} href={href} className="signal-ranked-item cabinet-list-item">
                      <div>
                        <strong>{application.event?.title || 'Event'}</strong>
                        <div className="signal-muted">
                          {statusLabel(application.status)} · {application.assignedAt ? formatDate(application.assignedAt) : ''}
                        </div>
                      </div>
                      <div className="cabinet-list-item-actions">
                        <StatusBadge tone={statusTone(application.status)}>{statusLabel(application.status)}</StatusBadge>
                        <span className="signal-chip-link">
                          {application.status === 'ACTIVE'
                            ? (locale === 'ru' ? 'Workspace' : 'Workspace')
                            : (locale === 'ru' ? 'Открыть' : 'Open')}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
            <SectionHeader title={locale === 'ru' ? 'Командные заявки' : 'Team memberships'} />
            {teams.length === 0 ? <EmptyState title={locale === 'ru' ? 'Команд пока нет' : 'No teams yet'} description={locale === 'ru' ? 'После вступления в команду статус появится здесь.' : 'After joining a team, status will appear here.'} /> : (
              <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
                {teams.map((membership: any) => (
                  <Link key={membership.id} href={`/${locale}/cabinet/events/${membership.team?.event?.slug || ''}?team=edit`} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{membership.team?.name || 'Team'}</strong>
                      <div className="signal-muted">{membership.team?.event?.title || 'Event'} · {membership.role || 'Member'}</div>
                    </div>
                    <div className="cabinet-list-item-actions">
                      <StatusBadge tone={statusTone(membership.status)}>{statusLabel(membership.status || 'ACTIVE')}</StatusBadge>
                      <span className="signal-chip-link">{locale === 'ru' ? 'Команда' : 'Team'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
            <SectionHeader title={locale === 'ru' ? 'Волонтёрские заявки' : 'Volunteer applications'} />
            {volunteerApplications.length === 0 ? <EmptyState title={locale === 'ru' ? 'Заявки отсутствуют' : 'No applications'} description={locale === 'ru' ? 'Статусы волонтёрства появятся здесь после подачи.' : 'Volunteer statuses appear here after applying.'} /> : (
              <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
                {volunteerApplications.map((application: any) => (
                  <Link key={application.id} href={`/${locale}/cabinet/volunteer`} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{application.event?.title || 'Event'}</strong>
                      <div className="signal-muted">{application.event?.location || 'Location'} · {formatDate(application.assignedAt || new Date().toISOString())}</div>
                    </div>
                    <div className="cabinet-list-item-actions">
                      <StatusBadge tone={statusTone(application.status)}>{statusLabel(application.status)}</StatusBadge>
                      <span className="signal-chip-link">{locale === 'ru' ? 'Открыть' : 'Open'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
