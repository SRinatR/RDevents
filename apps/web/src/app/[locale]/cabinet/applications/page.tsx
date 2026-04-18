'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, SectionHeader } from '@/components/ui/signal-primitives';

export default function CabinetApplicationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();

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
    Promise.all([eventsApi.myTeams(), eventsApi.myVolunteerApplications()])
      .then(([teamResult, volunteerResult]) => {
        setTeams(teamResult.teams || []);
        setVolunteerApplications(volunteerResult.applications || []);
      })
      .catch(() => setError(locale === 'ru' ? 'Не удалось загрузить заявки. Попробуйте обновить страницу.' : 'Failed to load applications. Try refreshing the page.'))
      .finally(() => setLoadingData(false));
  }, [user, locale]);

  if (loading || !user) return null;

  const formatDate = (date: string) => new Date(date).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const toneByStatus: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { ACTIVE: 'success', PENDING: 'warning', REJECTED: 'danger', ACCEPTED: 'success' };

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader title={locale === 'ru' ? 'Заявки и статусы' : 'Applications and statuses'} subtitle={locale === 'ru' ? 'Командные и волонтёрские треки в едином рабочем виде' : 'Team and volunteer tracks in one operational view'} />

      <div className="workspace-command-row">
        <Link href={`/${locale}/cabinet/events`} className="signal-chip-link">{locale === 'ru' ? 'Открыть каталог событий' : 'Open event catalog'}</Link>
        <Link href={`/${locale}/cabinet/my-events`} className="signal-chip-link">{locale === 'ru' ? 'Перейти к моим событиям' : 'Go to my events'}</Link>
      </div>

      <div className="workspace-status-strip workspace-status-strip-v2">
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Командные заявки' : 'Team statuses'}</small><strong>{teams.length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Волонтёрские заявки' : 'Volunteer statuses'}</small><strong>{volunteerApplications.length}</strong></div>
        <div className="workspace-status-card"><small>{locale === 'ru' ? 'Рабочий контур' : 'Operational loop'}</small><strong>{locale === 'ru' ? 'Отслеживание в одном месте' : 'Tracking in one place'}</strong></div>
      </div>

      {loadingData ? <LoadingLines rows={8} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {!loadingData && !error ? (
        <div className="workspace-board-grid">
          <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
            <SectionHeader title={locale === 'ru' ? 'Командные заявки' : 'Team memberships'} />
            {teams.length === 0 ? <EmptyState title={locale === 'ru' ? 'Команд пока нет' : 'No teams yet'} description={locale === 'ru' ? 'После вступления в команду статус появится здесь.' : 'After joining a team, status will appear here.'} /> : (
              <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
                {teams.map((membership: any) => (
                  <Link key={membership.id} href={`/${locale}/events/${membership.team?.event?.slug || ''}`} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{membership.team?.name || 'Team'}</strong>
                      <div className="signal-muted">{membership.team?.event?.title || 'Event'} · {membership.role || 'Member'}</div>
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
                  <Link key={application.id} href={`/${locale}/events/${application.event?.slug || ''}`} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{application.event?.title || 'Event'}</strong>
                      <div className="signal-muted">{application.event?.location || 'Location'} · {formatDate(application.assignedAt || new Date().toISOString())}</div>
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
