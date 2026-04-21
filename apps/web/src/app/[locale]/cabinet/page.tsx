'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouteLocale } from '@/hooks/useRouteParams';
import { eventsApi } from '@/lib/api';
import { LoadingLines, Notice, EmptyState } from '@/components/ui/signal-primitives';
import {
  CabinetDashboardHeader,
  CabinetActiveEventCard,
  CabinetTeamCard,
  CabinetMissingDataCard,
  CabinetDeadlinesCard,
  CabinetQuickActions,
  CabinetInvitationsCard,
  CabinetOtherEventsList,
  CabinetQuickLinks,
  type DashboardResponse,
} from '@/components/cabinet/dashboard';

export default function CabinetPage() {
  const { user, loading: authLoading } = useAuth();
  const locale = useRouteLocale();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitchingEvent, setIsSwitchingEvent] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await eventsApi.dashboard();
      setDashboard(data as DashboardResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDashboard();
    }
  }, [authLoading, user, fetchDashboard]);

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
