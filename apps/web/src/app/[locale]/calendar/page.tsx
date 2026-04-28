'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { LoadingLines, Notice } from '@/components/ui/signal-primitives';

interface CalendarEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: string;
  category: string;
  registrationDeadline: string | null;
  coverImageUrl: string | null;
  milestones: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    occursAt: string;
  }>;
}

interface CalendarData {
  data: CalendarEvent[];
}

type ViewMode = 'list' | 'month';

export default function CalendarPage() {
  const t = useTranslations();
  const locale = useRouteLocale();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const fetchEvents = useCallback(async () => {
    try {
      const now = new Date();
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

      const params = new URLSearchParams({
        start: now.toISOString(),
        end: sixMonthsLater.toISOString(),
      });

      if (selectedCategory) {
        params.set('category', selectedCategory);
      }

      const response = await fetch(`/api/events/calendar?${params}`);
      if (!response.ok) throw new Error('Failed to fetch calendar');
      const data: CalendarData = await response.json();
      setEvents(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) {
    return <LoadingLines />;
  }

  if (error) {
    return (
      <div className="calendar-shell">
        <Notice tone="danger">{error}</Notice>
        <button onClick={fetchEvents} className="btn btn-primary">
          {locale === 'ru' ? 'Повторить' : 'Retry'}
        </button>
      </div>
    );
  }

  const categories = [...new Set(events.map(e => e.category))];

  return (
    <div className="calendar-shell">
      <div className="calendar-header">
        <h1>{locale === 'ru' ? 'Календарь мероприятий' : 'Event calendar'}</h1>

        <div className="calendar-controls">
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>

          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="signal-field"
            >
              <option value="">{locale === 'ru' ? 'Все категории' : 'All categories'}</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="calendar-empty">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <h2>{locale === 'ru' ? 'Нет мероприятий' : 'No events'}</h2>
          <p>
            {locale === 'ru'
              ? 'В ближайшее время нет запланированных мероприятий.'
              : 'There are no events scheduled in the near future.'}
          </p>
          <Link href={`/${locale}/events`} className="btn btn-secondary">
            {locale === 'ru' ? 'Все мероприятия' : 'All events'}
          </Link>
        </div>
      ) : (
        <div className="calendar-content">
          {viewMode === 'list' ? (
            <div className="calendar-list">
              {events.map(event => (
                <CalendarEventCard key={event.id} event={event} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="calendar-month-view">
              <p className="month-view-note">
                {locale === 'ru'
                  ? 'Месячный вид: список мероприятий сгруппирован по месяцам'
                  : 'Month view: events grouped by months'}
              </p>
              <div className="calendar-list">
                {events.map(event => (
                  <CalendarEventCard key={event.id} event={event} locale={locale} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarEventCard({ event, locale }: { event: CalendarEvent; locale: string }) {
  const startDate = new Date(event.startsAt);
  const isUpcoming = startDate > new Date();
  const isOngoing = new Date(event.startsAt) <= new Date() && new Date(event.endsAt) >= new Date();

  return (
    <div className="calendar-event-card">
      <div className="calendar-event-date">
        <div className="date-day">{startDate.getDate()}</div>
        <div className="date-month">
          {startDate.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short' })}
        </div>
        <div className="date-year">{startDate.getFullYear()}</div>
      </div>

      <div className="calendar-event-content">
        <div className="calendar-event-header">
          <h3>{event.title}</h3>
          <div className="event-badges">
            <span className="category-badge">{event.category}</span>
            {isOngoing && <span className="ongoing-badge">{locale === 'ru' ? 'Идёт' : 'Ongoing'}</span>}
            {isUpcoming && event.registrationDeadline && new Date(event.registrationDeadline) > new Date() && (
              <span className="deadline-badge">
                {locale === 'ru' ? 'Регистрация до' : 'Registration until'}{' '}
                {new Date(event.registrationDeadline).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}
              </span>
            )}
          </div>
        </div>

        <p className="calendar-event-description">{event.description}</p>

        <div className="calendar-event-meta">
          <div className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>
              {startDate.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>
          </div>
          <div className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{event.location}</span>
          </div>
        </div>

        <div className="calendar-event-actions">
          <Link href={`/${locale}/events/${event.slug}`} className="btn btn-primary">
            {locale === 'ru' ? 'Подробнее' : 'Details'}
          </Link>
          <a href={`/api/events/${event.slug}/ics`} className="btn btn-secondary" download>
            {locale === 'ru' ? 'Добавить в календарь' : 'Add to calendar'}
          </a>
        </div>
      </div>
    </div>
  );
}
