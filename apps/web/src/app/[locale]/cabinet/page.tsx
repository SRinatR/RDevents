'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useRouteLocale } from '../../../hooks/useRouteParams';
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

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch('/api/me/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      const data = await response.json();
      setDashboard(data);
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

  if (authLoading || loading) {
    return <LoadingLines />;
  }

  if (!user) {
    router.push(`/${locale}/login?next=/${locale}/cabinet`);
    return null;
  }

  if (error) {
    return (
      <div className="cabinet-shell">
        <Notice tone="danger">{error}</Notice>
        <button onClick={fetchDashboard} className="btn btn-primary">
          {locale === 'ru' ? 'Повторить' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!dashboard || dashboard.events.length === 0) {
    return (
      <div className="cabinet-shell">
        <div className="cabinet-empty-state">
          <div className="cabinet-empty-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h2>{locale === 'ru' ? 'Нет активных мероприятий' : 'No active events'}</h2>
          <p>
            {locale === 'ru'
              ? 'Вы пока не участвуете ни в одном мероприятии. Присоединяйтесь к событиям!'
              : 'You are not participating in any events yet. Join events!'}
          </p>
          <Link href={`/${locale}/events`} className="btn btn-primary">
            {locale === 'ru' ? 'Каталог мероприятий' : 'Event catalog'}
          </Link>
        </div>
      </div>
    );
  }

  const activeEvent = dashboard.events.find(e => e.eventId === dashboard.activeEventId) || dashboard.events[0];
  const otherEvents = dashboard.events.filter(e => e.eventId !== activeEvent.eventId);

  return (
    <div className="cabinet-shell">
      <div className="cabinet-header">
        <h1>{locale === 'ru' ? 'Мой кабинет' : 'My cabinet'}</h1>

        {dashboard.events.length > 1 && (
          <div className="event-selector">
            <select
              value={activeEvent.eventId}
              onChange={(e) => {
                const event = dashboard.events.find(ev => ev.eventId === e.target.value);
                if (event) {
                  router.push(`/${locale}/cabinet/events/${event.slug}`);
                }
              }}
              className="signal-field"
            >
              {dashboard.events.map(event => (
                <option key={event.eventId} value={event.eventId}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="cabinet-content">
        <div className="event-dashboard">
          <div className="event-card">
            <div className="event-card-header">
              <h2>{activeEvent.title}</h2>
              <span className={`event-status-badge status-${activeEvent.status.toLowerCase()}`}>
                {activeEvent.status}
              </span>
            </div>

            <div className="event-meta">
              <div className="event-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>
                  {new Date(activeEvent.startsAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')} -
                  {new Date(activeEvent.endsAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                </span>
              </div>
              <div className="event-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{activeEvent.location}</span>
              </div>
            </div>

            <div className="my-roles">
              {activeEvent.myRoles.map((role, idx) => (
                <span key={idx} className={`role-badge role-${role.role.toLowerCase()}`}>
                  {role.role}
                </span>
              ))}
            </div>
          </div>

          <div className="dashboard-grid">
            {activeEvent.team && (
              <div className="dashboard-card">
                <h3>{locale === 'ru' ? 'Моя команда' : 'My team'}</h3>
                <div className="team-info">
                  <div className="team-name">{activeEvent.team.name}</div>
                  <div className="team-meta">
                    <span>{activeEvent.team.membersCount} {locale === 'ru' ? 'участников' : 'members'}</span>
                    <span className={`team-status status-${activeEvent.team.status.toLowerCase()}`}>
                      {activeEvent.team.status}
                    </span>
                  </div>
                  {activeEvent.team.isCaptain && (
                    <span className="captain-badge">
                      {locale === 'ru' ? 'Капитан' : 'Captain'}
                    </span>
                  )}
                </div>
                <div className="card-actions">
                  <Link href={`/${locale}/cabinet/events/${activeEvent.slug}/team`} className="btn btn-secondary">
                    {locale === 'ru' ? 'Открыть команду' : 'Open team'}
                  </Link>
                </div>
              </div>
            )}

            {!activeEvent.team && (
              <div className="dashboard-card action-card">
                <h3>{locale === 'ru' ? 'Команда' : 'Team'}</h3>
                <p>{locale === 'ru' ? 'Вы не состоите в команде' : 'You are not in a team'}</p>
                <div className="card-actions">
                  <Link href={`/${locale}/events/${activeEvent.slug}`} className="btn btn-primary">
                    {locale === 'ru' ? 'Создать или присоединиться' : 'Create or join'}
                  </Link>
                </div>
              </div>
            )}

            {(activeEvent.missingProfileFields.length > 0 || activeEvent.missingEventFields.length > 0) && (
              <div className="dashboard-card warning-card">
                <h3>{locale === 'ru' ? 'Незаполненные данные' : 'Missing data'}</h3>
                <div className="missing-fields">
                  {activeEvent.missingProfileFields.slice(0, 3).map(field => (
                    <span key={field} className="missing-field-badge">
                      {field}
                    </span>
                  ))}
                  {activeEvent.missingProfileFields.length > 3 && (
                    <span className="missing-field-badge">
                      +{activeEvent.missingProfileFields.length - 3}
                    </span>
                  )}
                </div>
                <div className="card-actions">
                  <Link
                    href={`/${locale}/cabinet/profile?event=${activeEvent.slug}&required=${activeEvent.missingProfileFields.join(',')}`}
                    className="btn btn-secondary"
                  >
                    {locale === 'ru' ? 'Заполнить профиль' : 'Complete profile'}
                  </Link>
                </div>
              </div>
            )}

            <div className="dashboard-card">
              <h3>{locale === 'ru' ? 'Дедлайны' : 'Deadlines'}</h3>
              <div className="deadlines-list">
                {activeEvent.deadlines.map((deadline, idx) => (
                  <div key={idx} className="deadline-item">
                    <span className="deadline-type">{deadline.type.replace('_', ' ')}</span>
                    <span className="deadline-date">
                      {new Date(deadline.at).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="card-actions">
                <a
                  href={`/api/events/${activeEvent.slug}/ics`}
                  className="btn btn-secondary"
                  download
                >
                  {locale === 'ru' ? 'Добавить в календарь' : 'Add to calendar'}
                </a>
              </div>
            </div>
          </div>

          <div className="quick-actions-bar">
            <Link href={`/${locale}/cabinet/profile`} className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>{locale === 'ru' ? 'Профиль' : 'Profile'}</span>
            </Link>
            <Link href={`/${locale}/cabinet/events`} className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{locale === 'ru' ? 'Мои события' : 'My events'}</span>
            </Link>
            <Link href={`/${locale}/cabinet/team-invitations`} className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>{locale === 'ru' ? 'Приглашения' : 'Invitations'}</span>
            </Link>
            <Link href={`/${locale}/cabinet/support`} className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>{locale === 'ru' ? 'Поддержка' : 'Support'}</span>
            </Link>
          </div>
        </div>

        {otherEvents.length > 0 && (
          <div className="other-events">
            <h3>{locale === 'ru' ? 'Другие мероприятия' : 'Other events'}</h3>
            <div className="other-events-list">
              {otherEvents.map(event => (
                <Link
                  key={event.eventId}
                  href={`/${locale}/cabinet/events/${event.slug}`}
                  className="other-event-item"
                >
                  <span className="other-event-title">{event.title}</span>
                  <span className={`event-status-badge status-${event.status.toLowerCase()}`}>
                    {event.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
