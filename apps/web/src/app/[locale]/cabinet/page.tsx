'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { eventsApi } from '@/lib/api';
import { LoadingLines, Notice } from '@/components/ui/signal-primitives';

interface DashboardEvent {
  eventId: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  status: string;
  myRoles: Array<{ role: string; status: string }>;
  team: {
    id: string;
    name: string;
    status: string;
    isCaptain: boolean;
    membersCount: number;
    canEdit: boolean;
  } | null;
  missingProfileFields: string[];
  missingEventFields: string[];
  deadlines: Array<{ type: string; at: string }>;
  quickActions: string[];
}

interface DashboardData {
  activeEventId: string | null;
  events: DashboardEvent[];
}

export default function CabinetPage() {
  const { user, loading: authLoading } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [myEvents, setMyEvents] = useState<MyEventsResponse['events']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingEvent, setIsSwitchingEvent] = useState(false);
  const [dashboardLoadAttempted, setDashboardLoadAttempted] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await eventsApi.dashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setDashboardLoadAttempted(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyEvents = useCallback(async () => {
    try {
      const data = await eventsApi.myEvents();
      setMyEvents((data as unknown as MyEventsResponse).events ?? []);
    } catch (err) {
      setMyEvents([]);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboard();
      fetchMyEvents();
    }
  }, [authLoading, user, fetchDashboard, fetchMyEvents]);

  const handleEventSwitch = useCallback(async (eventId: string) => {
    setIsSwitchingEvent(true);
    try {
      await eventsApi.setActiveEvent(eventId);
      await fetchDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch event');
    } finally {
      setIsSwitchingEvent(false);
    }
  }, [fetchDashboard]);

  if (authLoading || loading) {
    return (
      <div className="cabinet-workspace-page">
        <LoadingLines rows={6} />
      </div>
    );
  }

  if (!user) {
    router.push(`/${locale}/login?next=/${locale}/cabinet`);
    return null;
  }

  if (error) {
    return (
      <div className="cabinet-workspace-page">
        <Notice tone="danger">{error}</Notice>
        <button onClick={fetchDashboard} className="btn btn-primary" style={{ marginTop: '12px' }}>
          {locale === 'ru' ? 'Повторить' : 'Retry'}
        </button>
      </div>
    );
  }

  const dashboardEmptyButHasEvents = dashboardLoadAttempted && (!dashboard || dashboard.events.length === 0);
  const hasMyEvents = myEvents.length > 0;

  if (dashboardEmptyButHasEvents && hasMyEvents) {
    return (
      <div className="cabinet-workspace-page">
        <Notice tone="warning">
          {locale === 'ru'
            ? 'Не удалось полностью собрать панель кабинета. У вас есть мероприятия, откройте список ниже или обновите страницу.'
            : 'Failed to fully load the cabinet panel. You have events, open the list below or refresh the page.'}
        </Notice>
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link href={`/${locale}/cabinet/events`} className="btn btn-primary">
            {locale === 'ru' ? 'Список мероприятий' : 'Events list'}
          </Link>
          {myEvents[0] && (
            <Link href={`/${locale}/cabinet/events/${myEvents[0].slug}`} className="btn btn-secondary">
              {locale === 'ru' ? 'Открыть первое мероприятие' : 'Open first event'}
            </Link>
          )}
          <button onClick={fetchDashboard} className="btn btn-outline">
            {locale === 'ru' ? 'Обновить' : 'Refresh'}
          </button>
        </div>
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ marginBottom: '16px' }}>
            {locale === 'ru' ? 'Ваши мероприятия' : 'Your events'}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {myEvents.map((event) => (
              <Link
                key={event.id}
                href={`/${locale}/cabinet/events/${event.slug}`}
                style={{
                  padding: '16px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  display: 'block',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                {event.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard || dashboard.events.length === 0) {
    return (
      <div className="cabinet-workspace-page">
        <EmptyState
          title={locale === 'ru' ? 'Нет активных мероприятий' : 'No active events'}
          description={locale === 'ru'
            ? 'Вы пока не участвуете ни в одном мероприятии. Присоединяйтесь к событиям!'
            : 'You are not participating in any events yet. Join events!'}
          actions={
            <Link href={`/${locale}/events`} className="btn btn-primary">
              {locale === 'ru' ? 'Каталог мероприятий' : 'Event catalog'}
            </Link>
          }
        />
      </div>
    );
  }

  const activeEvent = dashboard.events.find(e => e.eventId === dashboard.activeEventId) || dashboard.events[0];

  return (
    <div className="cabinet-workspace-page">
      <CabinetDashboardHeader
        locale={locale}
        events={dashboard.events}
        activeEventId={dashboard.activeEventId}
        onEventSelect={handleEventSwitch}
        isSwitching={isSwitchingEvent}
      />

      {isSwitchingEvent && (
        <Notice tone="info">
          {locale === 'ru' ? 'Переключение мероприятия...' : 'Switching event...'}
        </Notice>
      )}

      <CabinetActiveEventCard event={activeEvent} locale={locale} />

      <div className="cabinet-workspace-grid">
        <div className="cabinet-workspace-main">
          <CabinetTeamCard 
            team={activeEvent.team} 
            event={activeEvent} 
            locale={locale} 
          />
          <CabinetMissingDataCard 
            missingFields={activeEvent.missingProfileFields} 
            event={activeEvent} 
            locale={locale} 
          />
          <CabinetInvitationsCard 
            invitations={activeEvent.invitations} 
            locale={locale} 
          />
        </div>
        
        <div className="cabinet-workspace-sidebar">
          <CabinetDeadlinesCard 
            deadlines={activeEvent.deadlines} 
            locale={locale} 
          />
          <CabinetQuickActions 
            quickActions={activeEvent.quickActions} 
            event={activeEvent} 
            locale={locale} 
          />
          <CabinetQuickLinks locale={locale} />
        </div>
      </div>

      <CabinetOtherEventsList 
        events={dashboard.events} 
        activeEventId={activeEvent.eventId} 
        locale={locale} 
      />
    </div>
  );
}
