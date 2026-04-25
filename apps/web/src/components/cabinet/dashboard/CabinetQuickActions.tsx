'use client';

import Link from 'next/link';
import { Panel, SectionHeader } from '@/components/ui/signal-primitives';
import { getQuickActionLabel } from './dashboard.formatters';
import type { DashboardEventData, QuickAction } from './dashboard.types';

interface CabinetQuickActionsProps {
  quickActions: QuickAction[];
  event: DashboardEventData;
  locale: string;
}

function getActionHref(action: QuickAction, event: DashboardEventData, locale: string): string {
  switch (action) {
    case 'OPEN_PROFILE_REQUIREMENTS':
      return `/${locale}/cabinet/profile?event=${event.slug}`;
    case 'COMPLETE_EVENT_FORM':
      return `/${locale}/cabinet/events/${event.slug}`;
    case 'ACCEPT_TEAM_INVITATION':
      return `/${locale}/cabinet/team-invitations`;
    case 'CREATE_OR_JOIN_TEAM':
      return `/${locale}/cabinet/events/${event.slug}?team=edit`;
    case 'OPEN_TEAM':
      return event.team ? `/${locale}/cabinet/events/${event.slug}?team=edit` : `/${locale}/cabinet/events/${event.slug}`;
    case 'EDIT_TEAM':
      return `/${locale}/cabinet/events/${event.slug}?team=edit`;
    case 'OPEN_CALENDAR':
      return `/api/events/${event.slug}/ics`;
    case 'OPEN_SUPPORT':
      return `/${locale}/cabinet/support`;
    default:
      return '#';
  }
}

function isHighPriority(action: QuickAction): boolean {
  return (
    action === 'OPEN_PROFILE_REQUIREMENTS' ||
    action === 'COMPLETE_EVENT_FORM' ||
    action === 'ACCEPT_TEAM_INVITATION' ||
    action === 'CREATE_OR_JOIN_TEAM'
  );
}

function QuickActionIcon({ action }: { action: QuickAction }) {
  switch (action) {
    case 'OPEN_PROFILE_REQUIREMENTS':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'COMPLETE_EVENT_FORM':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3h6l2 2h3v16H4V5h3z" />
          <path d="M8 11h8" />
          <path d="M8 15h6" />
        </svg>
      );
    case 'ACCEPT_TEAM_INVITATION':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v12H4z" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'CREATE_OR_JOIN_TEAM':
    case 'OPEN_TEAM':
    case 'EDIT_TEAM':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'OPEN_CALENDAR':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 11h18" />
        </svg>
      );
    case 'OPEN_SUPPORT':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
  }
}

export function CabinetQuickActions({ quickActions, event, locale }: CabinetQuickActionsProps) {
  if (!quickActions || quickActions.length === 0) {
    return null;
  }

  return (
    <Panel className="quick-actions-panel">
      <SectionHeader title={locale === 'ru' ? 'Что сделать' : 'What to do'} />
      
      <div className="quick-actions-list">
        {quickActions.map((action) => {
          const label = getQuickActionLabel(action, locale);
          const href = getActionHref(action, event, locale);
          const isCalendar = action === 'OPEN_CALENDAR';
          const priority = isHighPriority(action) ? 'priority-high' : '';
          
          const linkProps = isCalendar 
            ? { target: '_blank' as const, rel: 'noopener noreferrer' as const }
            : {};

          return (
            <Link 
              key={action}
              href={href}
              className={`quick-action-item ${priority}`}
              {...linkProps}
            >
              <span className="quick-action-icon"><QuickActionIcon action={action} /></span>
              <span className="quick-action-label">{label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="quick-action-arrow">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}
