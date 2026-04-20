'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { eventsApi } from '../../../lib/api';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { EmptyState, LoadingLines, Notice, PageHeader, Panel } from '@/components/ui/signal-primitives';

type ParticipationCard = {
  key: string;
  eventTitle: string;
  eventSlug?: string;
  eventId?: string;
  type: 'PARTICIPANT' | 'VOLUNTEER';
  status?: string;
  teamName?: string | null;
};

export default function CabinetDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useRouteLocale();
  const isRu = locale === 'ru';

  const [participantApplications, setParticipantApplications] = useState<any[]>([]);
  const [volunteerApplications, setVolunteerApplications] = useState<any[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [loading, user, router, locale]);

  useEffect(() => {
    if (!user) return;

    setLoadingData(true);
    setError('');

    Promise.all([
      eventsApi.myApplications(),
      eventsApi.myVolunteerApplications(),
      eventsApi.myEvents(),
      eventsApi.myTeams(),
    ])
      .then(([applicationsResult, volunteerResult, myEventsResult, teamsResult]) => {
        setParticipantApplications(applicationsResult.applications || []);
        setVolunteerApplications(volunteerResult.applications || []);
        setApprovedEvents(myEventsResult.events || []);
        setTeams(teamsResult.teams || []);
      })
      .catch(() => {
        setError(isRu ? 'Не удалось загрузить дашборд.' : 'Failed to load dashboard.');
      })
      .finally(() => setLoadingData(false));
  }, [user, isRu]);

  const participations = useMemo<ParticipationCard[]>(() => {
    const cards: ParticipationCard[] = [];
    const seen = new Set<string>();

    const participantItems = [...participantApplications];

    for (const item of approvedEvents) {
      const event = item.event ?? item;
      const slug = event?.slug;
      if (!slug) continue;
      const exists = participantItems.some((existing) => (existing.event?.slug ?? existing.eventSlug) === slug);
      if (!exists) {
        participantItems.push({
          id: `approved:${slug}`,
          event,
          status: item.status ?? item.registrationStatus ?? 'ACTIVE',
        });
      }
    }

    for (const application of participantItems) {
      const event = application.event ?? application;
      const key = `participant:${event?.id ?? event?.slug ?? application.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const teamMembership = teams.find((membership: any) => {
        const membershipEvent = membership?.team?.event;
        if (event?.id && membershipEvent?.id) return event.id === membershipEvent.id;
        if (event?.slug && membershipEvent?.slug) return event.slug === membershipEvent.slug;
        return false;
      });

      cards.push({
        key,
        eventTitle: event?.title ?? (isRu ? 'Событие' : 'Event'),
        eventSlug: event?.slug,
        eventId: event?.id,
        type: 'PARTICIPANT',
        status: application.status ?? application.registrationStatus,
        teamName: teamMembership?.team?.name ?? null,
      });
    }

    for (const application of volunteerApplications) {
      const event = application.event ?? application;
      const key = `volunteer:${event?.id ?? event?.slug ?? application.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      cards.push({
        key,
        eventTitle: event?.title ?? (isRu ? 'Событие' : 'Event'),
        eventSlug: event?.slug,
        eventId: event?.id,
        type: 'VOLUNTEER',
        status: application.status,
      });
    }

    return cards;
  }, [participantApplications, volunteerApplications, approvedEvents, teams, isRu]);

  if (loading || !user) return null;

  return (
    <div className="signal-page-shell cabinet-workspace-page workspace-page-v2">
      <PageHeader
        title={isRu ? 'Дашборд' : 'Dashboard'}
        subtitle={isRu ? 'Ваши текущие участия' : 'Your current participations'}
      />

      {loadingData ? <LoadingLines rows={6} /> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {!loadingData && !error ? (
        participations.length === 0 ? (
          <Panel variant="elevated" className="cabinet-workspace-panel">
            <EmptyState
              title={isRu ? 'В данный момент вы нигде не участвуете.' : 'You are not participating anywhere at the moment.'}
              description={isRu ? 'Начните с выбора события в каталоге.' : 'Start by selecting an event in the catalog.'}
              actions={<Link href={`/${locale}/cabinet/events`} className="btn btn-primary btn-sm">{isRu ? 'Открыть события' : 'Open events'}</Link>}
            />
          </Panel>
        ) : (
          <Panel variant="elevated" className="cabinet-workspace-panel">
            <div className="signal-stack cabinet-list-stack cabinet-list-stack-premium">
              {participations.map((item) => {
                const isParticipant = item.type === 'PARTICIPANT';
                const canOpenCabinet = isParticipant && Boolean(item.eventSlug);
                const href = canOpenCabinet
                  ? `/${locale}/cabinet/events/${item.eventSlug}`
                  : item.eventSlug
                    ? `/${locale}/events/${item.eventSlug}`
                    : `/${locale}/cabinet/events`;

                return (
                  <div key={item.key} className="signal-ranked-item cabinet-list-item">
                    <div>
                      <strong>{item.eventTitle}</strong>
                      <div className="signal-muted">
                        {isParticipant ? (isRu ? 'Участник' : 'Participant') : (isRu ? 'Волонтёр' : 'Volunteer')}
                        {item.status ? ` · ${statusLabel(item.status, locale)}` : ''}
                      </div>
                      {isParticipant ? (
                        <div className="signal-muted">
                          {item.teamName || (isRu ? 'Команда не создана' : 'No team yet')}
                        </div>
                      ) : null}
                    </div>

                    <Link href={href} className="btn btn-secondary btn-sm">
                      {canOpenCabinet
                        ? (isRu ? 'Открыть кабинет события' : 'Open event cabinet')
                        : (isRu ? 'Открыть событие' : 'Open event')}
                    </Link>
                  </div>
                );
              })}
            </div>
          </Panel>
        )
      ) : null}
    </div>
  );
}

function statusLabel(status: string, locale: string) {
  const ru: Record<string, string> = {
    PENDING: 'На рассмотрении',
    ACTIVE: 'Активно',
    APPROVED: 'Одобрено',
    RESERVE: 'В резерве',
    REJECTED: 'Отклонено',
    CANCELLED: 'Отменено',
    REMOVED: 'Удалено',
  };
  const en: Record<string, string> = {
    PENDING: 'Pending',
    ACTIVE: 'Active',
    APPROVED: 'Approved',
    RESERVE: 'Reserve',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    REMOVED: 'Removed',
  };

  return (locale === 'ru' ? ru : en)[status] ?? status;
}
