'use client';

import Image from 'next/image';
import Link from 'next/link';
import { StatusBadge } from './status-badge';

interface EventHeroProps {
  event: {
    eventId: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string;
    status: string;
    description?: string;
    coverImage?: string;
  };
  locale: string;
}

function formatEventDates(startsAt: string, endsAt: string, locale: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  
  const isSameDay = start.toDateString() === end.toDateString();
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'short',
  });
  const timeFormatter = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isSameDay) {
    return `${dateFormatter.format(start)} ${locale === 'ru' ? 'в' : 'at'} ${timeFormatter.format(start)}`;
  }
  
  return `${dateFormatter.format(start)} — ${dateFormatter.format(end)}`;
}

export function EventHero({ event, locale }: EventHeroProps) {
  const dateRange = formatEventDates(event.startsAt, event.endsAt, locale);

  return (
    <div className="event-hero-card">
      {event.coverImage && (
        <div className="event-hero-cover">
          <Image src={event.coverImage} alt={event.title} width={1200} height={400} style={{ width: '100%', height: 'auto' }} />
          <div className="event-hero-overlay" />
        </div>
      )}
      
      <div className="event-hero-content">
        <div className="event-hero-header">
          <div className="event-hero-info">
            <h1 className="event-hero-title">{event.title}</h1>
            <StatusBadge status={event.status} type="event" size="lg" />
          </div>
        </div>

        <div className="event-hero-meta">
          <div className="meta-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{dateRange}</span>
          </div>
          
          {event.location && (
            <div className="meta-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{event.location}</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="event-hero-description">{event.description}</p>
        )}

        <div className="event-hero-actions">
          <Link href={`/${locale}/events/${event.slug}`} className="btn btn-secondary">
            {locale === 'ru' ? 'Страница события' : 'Event page'}
          </Link>
          <a href={`/api/events/${event.slug}/ics`} className="btn btn-outline" download>
            {locale === 'ru' ? 'Добавить в календарь' : 'Add to calendar'}
          </a>
        </div>
      </div>
    </div>
  );
}