'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useRouteLocale } from '../../../hooks/useRouteParams';
import { eventsApi } from '@/lib/api';
import { LoadingLines, Notice } from '@/components/ui/signal-primitives';
import { StatusBadge, RoleBadge } from '@/components/ui/status-badge';
import { EventHero } from '@/components/ui/event-hero';
import { ParticipantStatus } from '@/components/ui/participant-status';
import { TeamCard } from '@/components/ui/team-card';
import { ActionCenter } from '@/components/ui/action-center';
import { DeadlineTimeline } from '@/components/ui/deadline-timeline';

interface DashboardEvent {
  eventId: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  status: string;
  description?: string;
  coverImage?: string;
  myRoles: Array<{ role: string; status: string }>;
  team: {
    id: string;
    name: string;
    status: string;
    isCaptain: boolean;
    membersCount: number;
    maxMembers?: number;
    members?: Array<{
      userId: string;
      name: string;
      email: string;
      role: string;
      status: string;
      avatar?: string;
    }>;
    pendingInvites?: number;
    canEdit: boolean;
  } | null;
  missingProfileFields: string[];
  missingEventFields: string[];
  deadlines: Array<{ type: string; at: string; label?: string }>;
  invitations?: Array<{
    id: string;
    teamName: string;
    teamId: string;
    invitedBy: string;
    expiresAt: string;
  }>;
}

interface DashboardData {
  activeEventId: string | null;
  events: DashboardEvent[];
}

function Avatar({ name, src }: { name: string; src?: string }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <img 
        src={src} 
        alt={name} 
        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm border-2 border-white shadow-sm">
      {initials}
    </div>
  );
}

function buildActionItems(event: DashboardEvent, locale: string) {
  const items = [];

  if (event.missingProfileFields.length > 0) {
    items.push({
      id: 'profile-incomplete',
      type: 'profile' as const,
      priority: event.missingProfileFields.length > 3 ? 'high' as const : 'medium' as const,
      title: locale === 'ru' 
        ? `Заполнить профиль — не хватает ${event.missingProfileFields.length} полей`
        : `Complete profile — ${event.missingProfileFields.length} fields missing`,
      description: event.missingProfileFields.slice(0, 2).join(', '),
      href: `/${locale}/cabinet/profile?event=${event.slug}&required=${event.missingProfileFields.join(',')}`,
    });
  }

  if (event.team && event.team.membersCount < (event.team.maxMembers ?? 5)) {
    const needed = (event.team.maxMembers ?? 5) - event.team.membersCount;
    items.push({
      id: 'team-incomplete',
      type: 'team' as const,
      priority: 'medium' as const,
      title: locale === 'ru'
        ? `Команда не укомплектована — нужен ещё ${needed} участник`
        : `Team not complete — need ${needed} more member(s)`,
      href: `/${locale}/events/${event.slug}?action=invite`,
    });
  }

  if (!event.team) {
    items.push({
      id: 'no-team',
      type: 'team' as const,
      priority: 'high' as const,
      title: locale === 'ru' ? 'Вступить в команду' : 'Join a team',
      description: locale === 'ru' ? 'Вы не состоите в команде' : 'You are not in a team',
      href: `/${locale}/events/${event.slug}?action=join-team`,
    });
  }

  const nextDeadline = event.deadlines
    .filter(d => new Date(d.at) > new Date())
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())[0];

  if (nextDeadline) {
    items.push({
      id: 'deadline-action',
      type: 'general' as const,
      priority: 'high' as const,
      title: locale === 'ru' ? 'Подтвердить участие' : 'Confirm participation',
      dueDate: nextDeadline.at,
      href: `/${locale}/cabinet/events/${event.slug}/application`,
    });
  }

  if (event.invitations && event.invitations.length > 0) {
    event.invitations.forEach(inv => {
      items.push({
        id: `invitation-${inv.id}`,
        type: 'invitation' as const,
        priority: 'high' as const,
        title: locale === 'ru' ? `Приглашение в команду "${inv.teamName}"` : `Invitation to team "${inv.teamName}"`,
        description: locale === 'ru' ? `Пригласил: ${inv.invitedBy}` : `Invited by: ${inv.invitedBy}`,
        href: `/${locale}/cabinet/team-invitations?accept=${inv.id}`,
      });
    });
  }

  return items;
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
      const data = await eventsApi.dashboard();
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
  const actionItems = buildActionItems(activeEvent, locale);

  return (
    <div className="cabinet-shell">
      {dashboard.events.length > 1 && (
        <div className="dashboard-event-selector">
          <div className="event-tabs">
            {dashboard.events.map(event => (
              <button
                key={event.eventId}
                className={`event-tab ${event.eventId === activeEvent.eventId ? 'active' : ''}`}
                onClick={() => {
                  const el = document.getElementById(`event-content-${event.eventId}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span className="event-tab-title">{event.title}</span>
                <StatusBadge status={event.status} type="event" size="sm" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div id={`event-content-${activeEvent.eventId}`} className="dashboard-main">
        <EventHero event={activeEvent} locale={locale} />

        <div className="dashboard-cards-row">
          <ParticipantStatus 
            roles={activeEvent.myRoles} 
            eventSlug={activeEvent.slug} 
            locale={locale} 
          />
          
          <TeamCard 
            team={activeEvent.team} 
            eventSlug={activeEvent.slug} 
            locale={locale}
            registrationStatus={activeEvent.myRoles[0]?.status}
          />

          <div className="dashboard-action-card">
            <h3 className="card-section-title">
              {locale === 'ru' ? 'Что сделать сейчас' : 'What to do now'}
            </h3>
            <ActionCenter actions={actionItems} locale={locale} />
          </div>
        </div>

        <div className="dashboard-cards-row-lower">
          <div className="dashboard-deadlines-card">
            <h3 className="card-section-title">
              {locale === 'ru' ? 'Важные даты' : 'Important dates'}
            </h3>
            <DeadlineTimeline deadlines={activeEvent.deadlines} locale={locale} />
          </div>

          {activeEvent.invitations && activeEvent.invitations.length > 0 && (
            <div className="dashboard-invitations-card">
              <h3 className="card-section-title">
                {locale === 'ru' ? 'Приглашения' : 'Invitations'}
                <span className="badge-count">{activeEvent.invitations.length}</span>
              </h3>
              <div className="invitations-list">
                {activeEvent.invitations.map(inv => (
                  <div key={inv.id} className="invitation-item">
                    <div className="invitation-icon">📬</div>
                    <div className="invitation-content">
                      <span className="invitation-team">{inv.teamName}</span>
                      <span className="invitation-meta">
                        {locale === 'ru' ? 'от' : 'from'} {inv.invitedBy}
                      </span>
                    </div>
                    <Link 
                      href={`/${locale}/cabinet/team-invitations?accept=${inv.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      {locale === 'ru' ? 'Принять' : 'Accept'}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-quick-links-card">
            <h3 className="card-section-title">
              {locale === 'ru' ? 'Быстрые ссылки' : 'Quick links'}
            </h3>
            <div className="quick-links-grid">
              <Link href={`/${locale}/cabinet/profile`} className="quick-link-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>{locale === 'ru' ? 'Профиль' : 'Profile'}</span>
              </Link>
              <Link href={`/${locale}/cabinet/events`} className="quick-link-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{locale === 'ru' ? 'Мои события' : 'My events'}</span>
              </Link>
              <Link href={`/${locale}/cabinet/team-invitations`} className="quick-link-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>{locale === 'ru' ? 'Приглашения' : 'Invitations'}</span>
              </Link>
              <Link href={`/${locale}/cabinet/support`} className="quick-link-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>{locale === 'ru' ? 'Поддержка' : 'Support'}</span>
              </Link>
            </div>
          </div>
        </div>

        {otherEvents.length > 0 && (
          <div className="other-events-section">
            <h3 className="section-title">
              {locale === 'ru' ? 'Другие мероприятия' : 'Other events'}
            </h3>
            <div className="other-events-grid">
              {otherEvents.map(event => (
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
                    href={`/${locale}/cabinet/events/${event.slug}`}
                    className="btn btn-secondary btn-sm"
                  >
                    {locale === 'ru' ? 'Открыть' : 'Open'}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}