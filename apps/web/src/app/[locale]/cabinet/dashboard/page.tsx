'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import { eventsApi } from '../../../../lib/api';
import { useRouteLocale } from '../../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel, SectionHeader } from '@/components/ui/signal-primitives';

type DashboardRole = {
  kind: 'participant' | 'volunteer' | 'team_member' | 'team_captain';
  status: string;
};

type DashboardEvent = {
  key: string;
  eventId?: string;
  slug?: string;
  title: string;
  location?: string;
  startsAt?: string;
  roles: DashboardRole[];
};

export default function CabinetDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';

  const [participantApplications, setParticipantApplications] = useState<any[]>([]);
  const [approvedParticipations, setApprovedParticipations] = useState<any[]>([]);
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

    Promise.all([
      eventsApi.myApplications(),
      eventsApi.myEvents(),
      eventsApi.myTeams(),
      eventsApi.myVolunteerApplications(),
    ])
      .then(([applicationsResult, myEventsResult, teamsResult, volunteerResult]) => {
        setParticipantApplications(applicationsResult.applications || []);
        setApprovedParticipations(myEventsResult.events || []);
        setTeams(teamsResult.teams || []);
        setVolunteerApplications(volunteerResult.applications || []);
      })
      .catch(() => setError(isRu ? 'Не удалось загрузить данные дашборда.' : 'Failed to load dashboard data.'))
      .finally(() => setLoadingData(false));
  }, [user, isRu]);

  const { events, activeParticipantCount, activeVolunteerCount } = useMemo(() => {
    const map = new Map<string, DashboardEvent>();

    const ensure = (payload: {
      event?: any;
      fallbackTitle?: string;
      role?: DashboardRole;
    }) => {
      const sourceEvent = payload.event;
      const key = String(sourceEvent?.id ?? sourceEvent?.eventId ?? sourceEvent?.slug ?? sourceEvent?.title ?? payload.fallbackTitle ?? Math.random());
      if (!map.has(key)) {
        map.set(key, {
          key,
          eventId: sourceEvent?.id ?? sourceEvent?.eventId,
          slug: sourceEvent?.slug,
          title: sourceEvent?.title ?? payload.fallbackTitle ?? (isRu ? 'Событие' : 'Event'),
          location: sourceEvent?.location,
          startsAt: sourceEvent?.startsAt,
          roles: [],
        });
      }

      if (payload.role) {
        const target = map.get(key)!;
        if (!target.roles.some((role) => role.kind === payload.role!.kind && role.status === payload.role!.status)) {
          target.roles.push(payload.role);
        }
      }
    };

    for (const item of approvedParticipations) {
      const event = item.event ?? item;
      ensure({ event, role: { kind: 'participant', status: item.status ?? item.registrationStatus ?? 'ACTIVE' } });
    }

    for (const application of participantApplications) {
      ensure({ event: application.event, role: { kind: 'participant', status: application.status ?? 'PENDING' } });
    }

    for (const application of volunteerApplications) {
      ensure({ event: application.event, role: { kind: 'volunteer', status: application.status ?? 'PENDING' } });
    }

    for (const membership of teams) {
      const team = membership.team;
      const teamEvent = team?.event;
      ensure({
        event: teamEvent,
        fallbackTitle: team?.name,
        role: {
          kind: membership.role === 'CAPTAIN' ? 'team_captain' : 'team_member',
          status: membership.status ?? team?.status ?? 'ACTIVE',
        },
      });
    }

    const eventsList = Array.from(map.values()).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    const activeParticipant = eventsList.filter((event) => event.roles.some((role) => role.kind === 'participant' && role.status === 'ACTIVE')).length;
    const activeVolunteer = eventsList.filter((event) => event.roles.some((role) => role.kind === 'volunteer' && role.status === 'ACTIVE')).length;

    return {
      events: eventsList,
      activeParticipantCount: activeParticipant,
      activeVolunteerCount: activeVolunteer,
    };
  }, [approvedParticipations, participantApplications, teams, volunteerApplications, isRu]);

  if (loading || !user) return null;

  const pendingParticipantCount = participantApplications.filter((item) => item.status === 'PENDING').length;
  const pendingVolunteerCount = volunteerApplications.filter((item) => item.status === 'PENDING').length;

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader
        title={isRu ? 'Дашборд' : 'Dashboard'}
        subtitle={isRu ? 'Ваши участия, команды и роли в событиях' : 'Your participations, teams and roles across events'}
      />

      <div className="workspace-status-strip workspace-status-strip-v2">
        <div className="workspace-status-card"><small>{isRu ? 'События с участием' : 'Events with participation'}</small><strong>{events.length}</strong></div>
        <div className="workspace-status-card"><small>{isRu ? 'Мои команды' : 'My teams'}</small><strong>{teams.length}</strong></div>
        <div className="workspace-status-card"><small>{isRu ? 'Активный участник' : 'Active participant'}</small><strong>{activeParticipantCount}</strong></div>
        <div className="workspace-status-card"><small>{isRu ? 'Активный волонтёр' : 'Active volunteer'}</small><strong>{activeVolunteerCount}</strong></div>
      </div>

      {loadingData ? <LoadingLines rows={8} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {!loadingData && !error ? (
        events.length === 0 && teams.length === 0 && participantApplications.length === 0 && volunteerApplications.length === 0 ? (
          <Panel variant="elevated" className="cabinet-workspace-panel">
            <EmptyState
              title={isRu ? 'Пока нет участий' : 'No participations yet'}
              description={isRu ? 'Выберите событие в каталоге и подайте первую заявку.' : 'Choose an event in the catalog and submit your first application.'}
              actions={<Link href={`/${locale}/cabinet/events`} className="btn btn-primary btn-sm">{isRu ? 'Открыть каталог' : 'Open catalog'}</Link>}
            />
          </Panel>
        ) : (
          <div className="workspace-board-grid">
            <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
              <SectionHeader title={isRu ? 'События и роли' : 'Events and roles'} />
              <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
                {events.map((event) => {
                  const hasActive = event.roles.some((role) => role.status === 'ACTIVE');
                  const href = event.slug
                    ? (hasActive ? `/${locale}/cabinet/my-events/${event.slug}` : `/${locale}/events/${event.slug}`)
                    : `/${locale}/cabinet/events`;

                  return (
                    <Link key={event.key} href={href} className="signal-ranked-item cabinet-list-item">
                      <div>
                        <strong>{event.title}</strong>
                        <div className="signal-muted">
                          {[event.location, formatDate(event.startsAt, locale)].filter(Boolean).join(' · ')}
                        </div>
                        <div className="signal-muted">
                          {event.roles.map((role) => `${roleLabel(role.kind, locale)}: ${statusLabel(role.status, locale)}`).join(' · ')}
                        </div>
                      </div>
                      <span className="signal-chip-link">{hasActive ? (isRu ? 'Workspace' : 'Workspace') : (isRu ? 'Страница события' : 'Event page')}</span>
                    </Link>
                  );
                })}
              </div>
            </Panel>

            <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
              <SectionHeader title={isRu ? 'Мои команды' : 'My teams'} />
              {teams.length === 0 ? (
                <EmptyState
                  title={isRu ? 'Команд пока нет' : 'No teams yet'}
                  description={isRu ? 'После вступления в команду она появится здесь.' : 'Joined teams will appear here.'}
                />
              ) : (
                <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
                  {teams.map((membership: any) => {
                    const team = membership.team;
                    const event = team?.event;
                    const href = event?.slug ? `/${locale}/cabinet/events/${event.slug}` : `/${locale}/cabinet/events`;
                    return (
                      <Link key={membership.id} href={href} className="signal-ranked-item cabinet-list-item">
                        <div>
                          <strong>{team?.name ?? (isRu ? 'Команда' : 'Team')}</strong>
                          <div className="signal-muted">{event?.title ?? (isRu ? 'Событие' : 'Event')}</div>
                          <div className="signal-muted">{roleLabel(membership.role === 'CAPTAIN' ? 'team_captain' : 'team_member', locale)} · {statusLabel(membership.status ?? team?.status ?? 'ACTIVE', locale)}</div>
                        </div>
                        <span className="signal-chip-link">{isRu ? 'Открыть' : 'Open'}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel variant="elevated" className="cabinet-workspace-panel workspace-board-column">
              <SectionHeader title={isRu ? 'Ожидающие действия' : 'Pending items'} />
              <div className="signal-stack">
                <div className="signal-ranked-item"><span>{isRu ? 'Заявки участника' : 'Participant applications'}</span><strong>{pendingParticipantCount}</strong></div>
                <div className="signal-ranked-item"><span>{isRu ? 'Волонтёрские заявки' : 'Volunteer applications'}</span><strong>{pendingVolunteerCount}</strong></div>
              </div>
            </Panel>
          </div>
        )
      ) : null}
    </div>
  );
}

function roleLabel(role: DashboardRole['kind'], locale: string) {
  const ru: Record<DashboardRole['kind'], string> = {
    participant: 'Участник',
    volunteer: 'Волонтёр',
    team_member: 'Член команды',
    team_captain: 'Капитан команды',
  };
  const en: Record<DashboardRole['kind'], string> = {
    participant: 'Participant',
    volunteer: 'Volunteer',
    team_member: 'Team member',
    team_captain: 'Team captain',
  };
  return locale === 'ru' ? ru[role] : en[role];
}

function statusLabel(status: string, locale: string) {
  const ru: Record<string, string> = {
    PENDING: 'На рассмотрении',
    ACTIVE: 'Активно',
    RESERVE: 'В резерве',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
    REMOVED: 'Удалено',
    APPROVED: 'Одобрено',
    DRAFT: 'Черновик',
    CHANGES_PENDING: 'Изменения на рассмотрении',
  };
  const en: Record<string, string> = {
    PENDING: 'Pending',
    ACTIVE: 'Active',
    RESERVE: 'Reserve',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    REMOVED: 'Removed',
    APPROVED: 'Approved',
    DRAFT: 'Draft',
    CHANGES_PENDING: 'Changes pending',
  };
  return (locale === 'ru' ? ru : en)[status] ?? status;
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
