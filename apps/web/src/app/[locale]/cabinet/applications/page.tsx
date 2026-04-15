'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, SectionHeader, StatusBadge } from '@/components/ui/signal-primitives';

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
    <div className="signal-page-shell">
      <PageHeader title={locale === 'ru' ? 'Мои заявки' : 'My applications'} subtitle={locale === 'ru' ? 'Команды и волонтёрские статусы' : 'Team and volunteer statuses'} />
      {loadingData ? <LoadingLines rows={8} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {!loadingData && !error ? (
        <>
          <Panel>
            <SectionHeader title={locale === 'ru' ? 'Командные заявки' : 'Team memberships'} actions={<StatusBadge tone="info">{teams.length}</StatusBadge>} />
            {teams.length === 0 ? <EmptyState title={locale === 'ru' ? 'Команд пока нет' : 'No teams yet'} description={locale === 'ru' ? 'После вступления в команду статус появится здесь.' : 'After joining a team, status will appear here.'} /> : (
              <div className="signal-stack cabinet-list-stack">
                {teams.map((membership: any) => (
                  <Link key={membership.id} href={`/${locale}/events/${membership.team?.event?.slug || ''}`} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{membership.team?.name || 'Team'}</strong>
                      <div className="signal-muted">{membership.team?.event?.title || 'Event'} · {membership.role || 'Member'}</div>
                    </div>
                    <StatusBadge tone={toneByStatus[membership.status] ?? 'neutral'}>{membership.status}</StatusBadge>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionHeader title={locale === 'ru' ? 'Волонтёрские заявки' : 'Volunteer applications'} actions={<StatusBadge tone="info">{volunteerApplications.length}</StatusBadge>} />
            {volunteerApplications.length === 0 ? <EmptyState title={locale === 'ru' ? 'Заявки отсутствуют' : 'No applications'} description={locale === 'ru' ? 'Статусы волонтёрства появятся здесь после подачи.' : 'Volunteer statuses appear here after applying.'} /> : (
              <div className="signal-stack cabinet-list-stack">
                {volunteerApplications.map((application: any) => (
                  <Link key={application.id} href={`/${locale}/events/${application.event?.slug || ''}`} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{application.event?.title || 'Event'}</strong>
                      <div className="signal-muted">{application.event?.location || 'Location'} · {formatDate(application.assignedAt || new Date().toISOString())}</div>
                    </div>
                    <StatusBadge tone={toneByStatus[application.status] ?? 'neutral'}>{application.status}</StatusBadge>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
