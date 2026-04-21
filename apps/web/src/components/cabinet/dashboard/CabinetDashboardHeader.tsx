'use client';

import { PageHeader, ToolbarRow } from '@/components/ui/signal-primitives';
import type { DashboardEventData } from './dashboard.types';

interface CabinetDashboardHeaderProps {
  locale: string;
  events: DashboardEventData[];
  activeEventId: string | null;
  onEventSelect: (eventId: string) => void;
  isSwitching?: boolean;
}

export function CabinetDashboardHeader({
  locale,
  events,
  activeEventId,
  onEventSelect,
  isSwitching,
}: CabinetDashboardHeaderProps) {
  const hasMultipleEvents = events.length > 1;

  return (
    <div className="dashboard-header">
      <PageHeader
        title={locale === 'ru' ? 'Мой кабинет' : 'My cabinet'}
        subtitle={locale === 'ru'
          ? 'Управляйте своим участием в мероприятиях'
          : 'Manage your event participations'}
      />
      
      {hasMultipleEvents && (
        <ToolbarRow>
          <label className="dashboard-event-selector-label">
            <span>{locale === 'ru' ? 'Активное мероприятие:' : 'Active event:'}</span>
            <select
              className="signal-field"
              value={activeEventId || events[0]?.eventId || ''}
              onChange={(e) => onEventSelect(e.target.value)}
              disabled={isSwitching}
            >
              {events.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
        </ToolbarRow>
      )}
    </div>
  );
}
