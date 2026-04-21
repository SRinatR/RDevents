'use client';

import Link from 'next/link';
import { Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { StatusBadge } from '@/components/ui/status-badge';
import type { DashboardEventData } from './dashboard.types';

interface CabinetOtherEventsListProps {
  events: DashboardEventData[];
  activeEventId: string | null;
  locale: string;
}

export function CabinetOtherEventsList({ events, activeEventId, locale }: CabinetOtherEventsListProps) {
  const otherEvents = events.filter(e => e.eventId !== activeEventId);
  
  if (otherEvents.length === 0) {
    return null;
  }

  return (
    <Panel className="other-events-panel">
      <SectionHeader 
        title={locale === 'ru' ? 'Другие мероприятия' : 'Other events'} 
      />
      
      <div className="other-events-grid">
        {otherEvents.map((event) => (
          <div key={event.eventId} className="other-event-card">
            <div className="other-event-header">
              <span className="other-event-title">{event.title}</span>
              <StatusBadge status={event.status} type="event" size="sm" />
            </div>
            
            <div className="other-event-meta">
              {new Date(event.startsAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}
              {event.location && ` · ${event.location}`}
            </div>
            
            <Link 
              href={`/${locale}/cabinet/my-events/${event.slug}`}
              className="btn btn-secondary btn-sm"
            >
              {locale === 'ru' ? 'Открыть' : 'Open'}
            </Link>
          </div>
        ))}
      </div>
    </Panel>
  );
}
