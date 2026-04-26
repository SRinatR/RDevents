'use client';

import Link from 'next/link';
import { StatusBadge, RoleBadge } from '@/components/ui/status-badge';
import { formatEventDateRange, formatRegistrationStatus } from './dashboard.formatters';
import type { DashboardEventData } from './dashboard.types';

interface CabinetActiveEventCardProps {
  event: DashboardEventData;
  locale: string;
}

export function CabinetActiveEventCard({ event, locale }: CabinetActiveEventCardProps) {
  const dateRange = formatEventDateRange(event.startsAt, event.endsAt, locale);
  const primaryRole = event.myRoles[0];
  const primaryStatus = primaryRole ? formatRegistrationStatus(primaryRole.status, locale) : null;

  return (
    <div className="active-event-card">
      <div className="active-event-main">
        <div className="active-event-info">
          <h1 className="active-event-title">{event.title}</h1>
          
          <div className="active-event-meta">
            <span className="meta-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {dateRange}
            </span>
            
            {event.location && (
              <span className="meta-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {event.location}
              </span>
            )}
          </div>
        </div>
        
        <div className="active-event-status">
          <StatusBadge status={event.status} type="event" size="lg" />
        </div>
      </div>

      <div className="active-event-roles">
        {event.myRoles.map((r, idx) => (
          <RoleBadge key={`${r.role}-${idx}`} role={r.role} size="md" />
        ))}
        {primaryStatus && (
          <span className="signal-status-pill tone-info">
            {primaryStatus}
          </span>
        )}
      </div>

      <div className="active-event-actions">
        <Link href={`/${locale}/cabinet/events/${event.slug}`} className="btn btn-secondary">
          {locale === 'ru' ? 'Кабинет события' : 'Event cabinet'}
        </Link>
        <a href={`/api/events/${event.slug}/ics`} className="btn btn-ghost" download>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {locale === 'ru' ? 'Календарь' : 'Calendar'}
        </a>
      </div>
    </div>
  );
}
